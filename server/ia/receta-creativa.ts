// v5.4 · Receta creativa (PLAN §7 y §9, "Generar receta"): /api/receta sin preparacionId. El grafo arma la base de
// conocimiento del chico y sortea un foco (armarConocimiento, server/grafo/conocimiento.ts) → el LLM inventa un plato
// nuevo a UN cambio de un alimento seguro (prompts/receta-creativa.ts) → el código arma la preparación con los atributos
// y los ingredientes que declaró, cuenta los cambios con cadena.ts y valida como la receta del catálogo
// (validacion/receta.ts), más el aporte mínimo, que no sea algo que ya come y que no repita una receta que ya vio
// → si falla, 1 reintento con los problemas → si sigue mal, ErrorNibble('sin_candidatos'): otro pedido sortea otro foco.
// v5.5 · Modo variedad (no le falta ningún nutriente, Conocimiento.variedad): sin aporte mínimo; si hay un grupo que
// menos come, el plato tiene que ser de ese grupo (atributos.grupo y el ingrediente principal). La evidencia muestra el
// nutriente al que más aporta respecto de su meta, y Receta.objetivo dice para qué es.
// v5.8 · Sus otras alergias (DatosBasicos.alergiasOtras, "kiwi", "colorante rojo"): los alimentos que alcanzan
// (server/alergias.ts) no están en la lista de ingredientes ni en el schema, el LLM las lee en la base de conocimiento y
// la validación rechaza un ingrediente que alcancen o un texto que las nombre.
// v5.10 · Variedad: las recetas que ya vio (`anteriores`) llegan al conocimiento, que sortea un ingrediente para el foco
// (Foco.ingrediente) y dice qué alimentos ya usó (Conocimiento.recientes). En el primer intento el foco es obligatorio:
// el schema solo acepta su alimento de partida y la validación pide su ingrediente (el principal, o sumado); en el
// reintento se relaja a cualquier seguro y cualquier ingrediente. Nunca, en ninguno, un principal que ya usó hace poco.
// v5.10 · Hasta 3 intentos: si el primero no pasa, el segundo no relaja el mismo foco: pide otro (el conocimiento evita
// el alimento de partida y el ingrediente del primero) y también es estricto. Solo si tampoco pasa y no se pasó de
// TOPE_NUEVA_LLAMADA_MS, el tercero relaja, con los problemas del segundo. Con el plato elegido, el primero y el reintento.
// v5.10 · Lo principal de lo nuevo va en esa comida (server/ia/momentos.ts: nunca ravioles en el desayuno) y, si lo nuevo
// es un plato principal (pastas, pizza, milanesas…), es el principal de la comida: lo que ya come no suma otro.
import type { Alergeno, Candidato, Evidencia, Momento, Motor, Nutriente, Nutrientes, PreparacionCatalogo, Receta, RecetaReq, RolPlato } from '../../shared/contratos.js'
import { alimentosProhibidos, limpiarOtras } from '../alergias.js'
import { DIMENSIONES, cambios, principal } from '../aprendizaje/cadena.js'
import { NOMBRE_GRUPO, NOMBRE_NUTRIENTE, TEXTO_CAMBIO, decimal, slug } from '../aprendizaje/textos.js'
import { cargarNino } from '../datos/cargar.js'
import { ACOMPANAMIENTOS, conocimientoDe, type Conocimiento, type Evitar, type Foco } from '../grafo/conocimiento.js'
import { esCondimento } from './condimentos.js'
import { ErrorNibble } from '../http.js'
import { CON_META } from '../nutricion/objetivos.js'
import { calcularAporte, cambiosEntre, problemasPorTipo, aplanar, type ContextoValidacion } from '../validacion/receta.js'
import { alimentoPorId, alimentos } from './catalogo.js'
import { generarJSON } from './modelo.js'
import { esPlatoPrincipal, vaEnLaComida } from './momentos.js'
import { ajustarPorciones, armarPlatoCompleto, completarConLoQueCome, estructuraDe, problemasDelPlato } from './plato-completo.js'
import { esquemaSalidaCreativa, promptRecetaCreativa, SISTEMA_RECETA_CREATIVA, type SalidaCreativa } from './prompts/receta-creativa.js'
import { CORTE_MS, TOPE_NUEVA_LLAMADA_MS, coberturaDeLoQueFalta, sinAlergenos, type IntentoReceta } from './receta.js'

/** v5.8 · La base de conocimiento con sus otras alergias, como las escribió el padre (Conocimiento no las trae). */
export type ConocimientoReceta = Conocimiento & { alergiasOtras?: string[] }

/**
 * La base de conocimiento del chico (armarConocimiento) más sus otras alergias: lo que usa api/receta.ts. v5.10 · Con
 * las recetas que ya vio (`anteriores`), que conocimientoDe usa para el ingrediente del foco y los recientes.
 */
export async function armarConocimientoReceta(ninoId: string, op: { nutriente?: Nutriente; momento?: Momento; motor?: Motor; anteriores?: string[]; evitar?: EvitarFoco } = {}): Promise<ConocimientoReceta> {
  const c = await cargarNino(ninoId)
  const otras = limpiarOtras(c.nino.datos.alergiasOtras)
  return { ...conocimientoDe(c, op), ...(otras.length ? { alergiasOtras: otras } : {}) }
}

/**
 * v5.10 · Lo que el conocimiento no tiene que volver a sortear para el foco: el alimento de partida y el ingrediente del
 * intento que no pasó. Tipo local hasta que esté en conocimiento.ts (carril foco-ricos).
 */
export type EvitarFoco = Evitar // v5.10 · el de server/grafo/conocimiento.ts

export interface DepsRecetaCreativa {
  conocimiento: (ninoId: string, op: { nutriente?: Nutriente; momento?: RecetaReq['momento']; anteriores?: string[]; evitar?: EvitarFoco }) => Promise<ConocimientoReceta>
  ahora?: () => number
  // v5.10 · con el foco de ese intento (sin el plato elegido)
  alIntentar?: (intento: Omit<IntentoReceta, 'salida' | 'problemas'> & { salida: SalidaCreativa; problemas: string[]; foco?: Foco }) => void
  /**
   * v5.9 · Con RecetaReq.preparacionId (una sugerencia del catálogo: la próxima comida, "Un pasito"), lo nuevo ya está
   * elegido: el candidato de la cadena con su preparación y su alimento de partida. Sin esto, o si no aparece, la creativa.
   */
  elegido?: (ninoId: string, preparacionId: string, nutriente?: Nutriente) => Promise<Elegido | undefined>
}

/** v5.9 · El plato que eligió la app: la preparación del catálogo, su candidato (cambio y lo que se mantiene) y de dónde parte. */
export interface Elegido { preparacion: PreparacionCatalogo; candidato: Candidato; desde: PreparacionCatalogo }

/** Lo que pide su dieta cuenta como alergia para validar (sin gluten ni caseína = sin gluten ni leche). */
function alergiasDe(k: Conocimiento): Alergeno[] {
  return [...new Set<Alergeno>([...k.alergias, ...(k.dieta === 'sin_gluten_caseina' ? (['gluten', 'leche'] as const) : [])])]
}

const normal = (s: string) => slug(s).replace(/_/g, ' ')

/** v5.8 · Sus otras alergias y los alimentos del catálogo que alcanzan. */
function otrasAlergiasDe(k: ConocimientoReceta): { otras: string[]; prohibidos: Set<string> } {
  const otras = limpiarOtras(k.alergiasOtras)
  return { otras, prohibidos: alimentosProhibidos(otras, alimentos()) }
}

/** v5.8 · La base de conocimiento que ve el LLM, con sus otras alergias abajo de la línea del chico. */
export function textoConOtrasAlergias(texto: string, otras: readonly string[]): string {
  if (!otras.length) return texto
  const linea = `Otras alergias, como las contó la familia (nada que las lleve, ni en los ingredientes ni en los pasos): ${otras.join(', ')}.`
  const lineas = texto.split('\n')
  const i = lineas.findIndex((l) => l.startsWith('Chico:'))
  lineas.splice(i + 1, 0, linea)
  return lineas.join('\n')
}

const ARTICULO: Record<Momento, [string, string]> = {
  desayuno: ['el', 'un'], almuerzo: ['el', 'un'], merienda: ['la', 'una'], cena: ['la', 'una'], colacion: ['la', 'una'],
}
const NOMBRE_MOMENTO: Record<Momento, string> = { desayuno: 'desayuno', almuerzo: 'almuerzo', merienda: 'merienda', cena: 'cena', colacion: 'colación' }

/** Sin un alimento seguro para esta comida no hay de dónde partir: se dice para qué comida falta (v5.8). */
export function textoSinSeguros(nombre: string, momento?: Momento): string {
  if (!momento) return `Todavía no sabemos qué come ${nombre} seguro: registrá algunas comidas y aparecen recetas.`
  const [el, un] = ARTICULO[momento]
  const m = NOMBRE_MOMENTO[momento]
  return `Todavía no sabemos qué come ${nombre} en ${el} ${m}: registrá ${un} ${m} o contanos qué come.`
}

/** v5.10 · Lo que acompaña y no es el plato: grasas, dulces, aderezos y condimentos. No alcanza para el cambio ni para el aporte. */
const deRelleno = (id: string): boolean => ACOMPANAMIENTOS.has(id) || esCondimento(id)

/** v5.6 · Una receta elaborada: al menos estos ingredientes de verdad (sin contar acompañamientos) y estos pasos. */
export const MIN_INGREDIENTES_COMIDA = 2
export const MIN_INGREDIENTES = 3
export const MIN_PASOS = 4

/**
 * v5.6 · Lo que hace que una receta sea pobre aunque sea segura (el corazón de la app no puede ser "puré con aceite"):
 * el cambio es solo una grasa o un dulce, es más de lo mismo (los mismos ingredientes que su alimento seguro), tiene
 * pocos ingredientes o pocos pasos, o llega al nutriente solo gracias a un acompañamiento.
 */
export function problemasDeCalidad(receta: Receta, desde: PreparacionCatalogo, minimo: number): string[] {
  const p: string[] = []
  const ids = receta.ingredientes.map((i) => i.alimentoId)
  const deSuPlato = new Set(desde.ingredientes.map((i) => i.alimentoId))
  const nuevos = ids.filter((id) => !deSuPlato.has(id))
  const comida = ids.filter((id) => !deRelleno(id))
  if (nuevos.length === 0) {
    p.push(`«${receta.nombre}» usa los mismos ingredientes que «${desde.nombre}»: es más de lo mismo. Proponé un plato de verdad distinto, con un ingrediente nuevo.`)
  } else if (nuevos.every((id) => deRelleno(id))) {
    p.push(`Lo único nuevo de «${receta.nombre}» es ${nuevos.map((id) => alimentoPorId(id)?.nombre ?? id).join(' y ')}: un aceite, una grasa o un dulce no es un plato nuevo. El cambio tiene que ser un alimento (una verdura, una legumbre, un lácteo, una carne, un cereal…).`)
  }
  if (/\baceite\b/i.test(receta.nombre)) p.push(`El nombre «${receta.nombre}» habla del aceite: el plato es lo que se come, no con qué se cocina. Poné un nombre que dé ganas.`)
  if (comida.length < MIN_INGREDIENTES_COMIDA || ids.length < MIN_INGREDIENTES) {
    p.push(`La receta es muy simple (${ids.length} ingredientes): tiene que ser una preparación casera elaborada, con al menos ${MIN_INGREDIENTES} ingredientes y ${MIN_INGREDIENTES_COMIDA} de ellos alimentos de verdad (no aceite, manteca ni dulces).`)
  }
  if (receta.pasos.length < MIN_PASOS) p.push(`Tiene ${receta.pasos.length} pasos: una receta elaborada lleva al menos ${MIN_PASOS} (preparar, armar o rebozar, cocinar y servir).`)
  const n = receta.evidencia.nutriente
  if (minimo > 0) {
    const sinAcompanar = calcularAporte(receta.ingredientes.filter((i) => !deRelleno(i.alimentoId)))[n]
    if (receta.aporte[n] >= minimo && sinAcompanar < minimo) {
      p.push(`El ${NOMBRE_NUTRIENTE[n]} sale casi todo del aceite o de un dulce (sin eso aporta ${decimal(sinAcompanar, 1)} y el mínimo es ${decimal(minimo, 1)}): tiene que venir de un alimento. Si con ${NOMBRE_NUTRIENTE[n]} no se puede, elegí otro nutriente de la lista.`)
    }
  }
  return p
}

/** El plato que inventó el LLM, como una preparación más (no está en el catálogo: el id empieza con "nuevo_"). */
export function platoDe(salida: SalidaCreativa): PreparacionCatalogo {
  return {
    id: `nuevo_${slug(salida.nombre).slice(0, 60) || 'plato'}`,
    nombre: salida.nombre.trim(),
    atributos: salida.atributos,
    ingredientes: salida.ingredientes.map(({ alimentoId, gramos }) => ({ alimentoId, gramos })),
  }
}

/** v5.5 · El nutriente al que más aporta la porción respecto de su meta diaria: el que se muestra en modo variedad. */
export function nutrienteQueMasAporta(aporte: Nutrientes, meta: Nutrientes): Nutriente {
  const parte = (n: Nutriente) => (meta[n] > 0 ? aporte[n] / meta[n] : 0)
  return [...CON_META].sort((a, b) => parte(b) - parte(a))[0] ?? 'calcio_mg'
}

/** La receta completa: el cambio y lo que se mantiene los cuenta el código (cadena.ts), nunca el LLM. */
export function completarCreativa(salida: SalidaCreativa, k: ConocimientoReceta, desde: PreparacionCatalogo, elegido?: Elegido): Receta {
  // v5.9 · Con el plato elegido, la preparación es la del catálogo (sus atributos y su id); el LLM escribe la receta
  const base: PreparacionCatalogo = elegido
    ? { ...elegido.preparacion, nombre: salida.nombre.trim() || elegido.preparacion.nombre, ingredientes: salida.ingredientes.map(({ alimentoId, gramos }) => ({ alimentoId, gramos })) }
    : platoDe(salida)
  const difs = cambiosEntre(desde, base)
  // v5.10 · Si lo nuevo es un plato principal (unos ravioles, una milanesa), es el principal de la comida, lo declare o no
  const rol: RolPlato = esPlatoPrincipal(base) ? 'principal' : salida.rol
  const ingredientes = salida.ingredientes.map(({ alimentoId, gramos }) => ({ alimentoId, nombre: alimentoPorId(alimentoId)?.nombre ?? alimentoId, gramos }))
  const aporte = calcularAporte(ingredientes)
  // En modo variedad no hay nutriente pedido: se muestra al que más aporta (v5.5)
  const n = k.variedad
    ? nutrienteQueMasAporta(aporte, k.metaDiaria)
    : k.nutrientes.some((x) => x.nutriente === salida.nutriente) ? salida.nutriente! : (k.foco.nutriente ?? k.nutrientes[0]!.nutriente)
  const evidencia: Evidencia = {
    nutriente: n,
    coberturaSemana: k.coberturas[n].coberturaSemana,
    faltaHoy: k.coberturas[n].faltaHoy,
    candidatos: [],
    reglas: k.reglas.map((r) => r.texto),
    alergias: k.alergias,
    texto: k.texto,
  }
  return {
    nombre: base.nombre,
    preparacionBaseId: base.id,
    desde: { preparacionId: desde.id, nombre: desde.nombre },
    cambio: elegido ? elegido.candidato.cambio : difs[0]?.cambio ?? 'ingrediente',
    seMantiene: elegido ? elegido.candidato.seMantiene : DIMENSIONES.flatMap((dim) => {
      const v = desde.atributos[dim]
      return v && v === base.atributos[dim] ? [`${dim}=${v}`] : []
    }),
    ingredientes,
    pasos: salida.pasos,
    porQue: salida.porQue,
    presentacion: salida.presentacion,
    comoOfrecer: salida.comoOfrecer,
    transparencia: salida.transparencia?.trim() || null,
    aporte,
    coberturaDeLoQueFalta: coberturaDeLoQueFalta(aporte, evidencia),
    validacion: { ok: false, problemas: [], reintentos: 0 },
    evidencia,
    plato: { atributos: elegido ? { ...salida.atributos, ...elegido.preparacion.atributos, coccion: elegido.preparacion.atributos.coccion ?? salida.atributos.coccion } : salida.atributos, imagen: salida.imagen },
    platoCompleto: armarPlatoCompleto(
      { preparacion: base, rol, aporte },
      ajustarPorciones(aporte.energia_kcal, completarConLoQueCome({ rol, grupo: base.atributos.grupo, desdeId: desde.id }, salida.acompanamientos ?? [], k), k),
      k,
    ),
    objetivo: k.variedad ? { tipo: 'variedad', ...k.variedad } : { tipo: 'nutriente', nutriente: n }, // v5.5
  }
}

/**
 * v5.10 · Lo que pide el foco sorteado. Primer intento: su ingrediente es el principal (cambiar_principal) o está sumado
 * (sumar_ingrediente). Reintento (`relajado`): puede ser otro, pero lo sumado no puede ser algo que ya usó hace poco. En
 * los dos, el ingrediente principal no puede ser uno de los recientes.
 */
export function problemasDelFoco(receta: Receta, k: ConocimientoReceta, desde: PreparacionCatalogo, relajado: boolean): string[] {
  const p: string[] = []
  const { modo, ingrediente } = k.foco
  const recientes = new Set(k.recientes ?? [])
  const nombre = (id: string) => alimentoPorId(id)?.nombre ?? id
  const tiene = principal(receta.ingredientes)
  if (ingrediente && !relajado) {
    if (modo === 'cambiar_principal' && tiene !== ingrediente) {
      p.push(`Esta vez el ingrediente principal (el de más gramos) tiene que ser ${nombre(ingrediente)} (${ingrediente}), y en «${receta.nombre}» es ${tiene ? nombre(tiene) : 'ninguno'}: armá el plato con ${nombre(ingrediente)} como lo que más pesa.`)
    }
    if (modo === 'sumar_ingrediente' && !receta.ingredientes.some((i) => i.alimentoId === ingrediente)) {
      p.push(`Esta vez a su «${desde.nombre}» hay que sumarle ${nombre(ingrediente)} (${ingrediente}), y «${receta.nombre}» no lo lleva.`)
    }
  }
  if (tiene && recientes.has(tiene)) {
    p.push(`Ya usó ${nombre(tiene)} hace poco (está en las recetas que vio la familia): el ingrediente principal de «${receta.nombre}» tiene que ser otro.`)
  }
  if (ingrediente && relajado && modo === 'sumar_ingrediente') {
    const deSuPlato = new Set(desde.ingredientes.map((i) => i.alimentoId))
    const repetidos = receta.ingredientes.map((i) => i.alimentoId).filter((id) => id !== tiene && !deSuPlato.has(id) && !deRelleno(id) && recientes.has(id))
    if (repetidos.length) p.push(`Ya usó ${repetidos.map(nombre).join(' y ')} hace poco (está en las recetas que vio la familia): sumale otro alimento.`)
  }
  return p
}

/**
 * v5.10 · Lo principal de lo nuevo (el ingrediente de más gramos) tiene que ir en esa comida: tostadas → ravioles pasa el
 * chequeo de grupo (los dos son cereales), pero los ravioles no son para el desayuno. En modo variedad, si nada del grupo
 * que pide va en esa comida (una verdura en el desayuno), manda el grupo: si no, ninguna receta pasaría.
 */
export function problemasDelMomento(receta: Receta, k: Conocimiento): string[] {
  const m = k.momento
  const id = principal(receta.ingredientes)
  if (!m || !id || vaEnLaComida(id, m)) return []
  const g = k.variedad?.grupo
  if (g && alimentoPorId(id)?.grupo === g && !alimentos().some((a) => a.grupo === g && vaEnLaComida(a.id, m))) return []
  const [el] = ARTICULO[m]
  const comida = `${el} ${NOMBRE_MOMENTO[m]}`
  return [`«${alimentoPorId(id)?.nombre ?? id}» no es para ${comida}: lo principal de «${receta.nombre}» (el ingrediente de más gramos) tiene que ser algo que se come en ${comida} (${estructuraDe(m).plato}). Partí de algo que ya come en ${comida} y cambiá su ingrediente por otro de esa comida.`]
}

/**
 * Lo que valida la receta del catálogo, más lo propio de un plato inventado. v5.10 · Sin el plato elegido, también lo
 * que pide el foco (problemasDelFoco): `relajado` en el reintento.
 */
export function problemasCreativa(
  receta: Receta, k: ConocimientoReceta, desde: PreparacionCatalogo, anteriores: readonly string[],
  acompanamientos?: readonly { preparacionId: string; gramos: number }[],
  elegido?: Elegido,
  relajado = false,
): string[] {
  // Con el plato elegido, la preparación del catálogo (con su fortificadaDe: "la versión fortificada" es un cambio válido)
  const base: PreparacionCatalogo = elegido
    ? { ...elegido.preparacion, nombre: receta.nombre, ingredientes: receta.ingredientes }
    : { id: receta.preparacionBaseId, nombre: receta.nombre, atributos: receta.plato!.atributos, ingredientes: receta.ingredientes }
  const { otras, prohibidos } = otrasAlergiasDe(k)
  const ctx: ContextoValidacion = {
    alergias: alergiasDe(k), reglas: k.reglas, desde, base, presentacionesAceptadas: k.presentacionesAceptadas,
    ...(otras.length ? { alergiasOtras: otras, prohibidos } : {}),
  }
  const p = aplanar(problemasPorTipo(receta, ctx))
  const n = receta.evidencia.nutriente
  // v5.5 · En modo variedad no hay mínimo de nutriente: lo que cuenta es el grupo
  const minimo = k.variedad ? 0 : k.nutrientes.find((x) => x.nutriente === n)?.minimo ?? 0
  const g = k.variedad?.grupo
  if (g) {
    const idPrincipal = principal(receta.ingredientes)
    const delPrincipal = idPrincipal ? alimentoPorId(idPrincipal)?.grupo : undefined
    const declarado = receta.plato!.atributos.grupo
    if (declarado !== g || (delPrincipal && delPrincipal !== g)) {
      p.push(`El objetivo es sumar variedad con ${NOMBRE_GRUPO[g]}: el plato tiene que ser de ese grupo (atributos.grupo = ${g}) y su ingrediente principal, el de más gramos, también; «${receta.nombre}» es de ${NOMBRE_GRUPO[delPrincipal && delPrincipal !== g ? delPrincipal : declarado]}. Cambiá el ingrediente principal de su alimento seguro por uno de ${NOMBRE_GRUPO[g]}.`)
    }
  }
  if (receta.aporte[n] < minimo) {
    const ricos = k.nutrientes.find((x) => x.nutriente === n)?.ricos.slice(0, 4).map((r) => r.alimentoId) ?? []
    p.push(`La porción aporta ${decimal(receta.aporte[n], 1)} de ${NOMBRE_NUTRIENTE[n]} y el mínimo es ${decimal(minimo, 1)}: subí los gramos de un ingrediente rico en ${NOMBRE_NUTRIENTE[n]} (${ricos.join(', ')}) o elegí otro plato.`)
  }
  p.push(...problemasDeCalidad(receta, desde, minimo))
  const igual = k.aceptadas.find((s) => s.id !== desde.id && cambios(s, base).length === 0)
  if (igual) p.push(`«${receta.nombre}» es lo mismo que «${igual.nombre}», que ya come: proponé un plato nuevo.`)
  // v5.9 · Con el plato elegido no se pide que sea otro (repetir la exposición está bien): sí que sea ESE plato
  if (!elegido && anteriores.some((a) => normal(a) === normal(receta.nombre))) p.push(`«${receta.nombre}» ya lo vio la familia: proponé un plato distinto.`)
  if (!elegido) p.push(...problemasDelFoco(receta, k, desde, relajado), ...problemasDelMomento(receta, k)) // v5.10
  if (elegido) {
    const esperado = principal(elegido.preparacion.ingredientes)
    const tiene = principal(receta.ingredientes)
    if (esperado && tiene !== esperado) p.push(`La receta es de «${elegido.preparacion.nombre}»: su ingrediente principal (el de más gramos) tiene que ser ${alimentoPorId(esperado)?.nombre ?? esperado}, y en la tuya es ${tiene ? alimentoPorId(tiene)?.nombre ?? tiene : 'ninguno'}.`)
  }
  // v5.7 · La comida completa: estructura, energía y proteína del plato entero
  if (receta.platoCompleto) p.push(...problemasDelPlato(receta.platoCompleto, acompanamientos ?? receta.platoCompleto.componentes.filter((c) => !c.nuevo), k, { elegido: Boolean(elegido), nuevo: base }))
  return p
}

function registrar(datos: Record<string, unknown>, aviso = false) {
  const linea = JSON.stringify({ evento: 'receta_creativa', ...datos })
  if (aviso) console.warn(linea)
  else console.info(linea)
}

/**
 * v5.10 · Los intentos: el foco sorteado, estricto; otro foco (el conocimiento evita el del primero), también estricto;
 * y el reintento relajado con los problemas del último. Con el plato elegido no hay foco: el primero y el reintento.
 */
type Paso = 'foco' | 'otro_foco' | 'relajado'

export async function generarRecetaCreativa(req: RecetaReq, deps: DepsRecetaCreativa): Promise<Receta> {
  const ahora = deps.ahora ?? Date.now
  const t0 = ahora()
  const anteriores = (req.anteriores ?? []).slice(-10)
  const op = { ...(req.nutriente ? { nutriente: req.nutriente } : {}), ...(req.momento ? { momento: req.momento } : {}), ...(anteriores.length ? { anteriores } : {}) }
  let k = await deps.conocimiento(req.ninoId, op)
  // Sin el respaldo de "todo lo que acepta" (conocimiento.ts): si nada de lo que come va en esta comida, se dice cuál falta
  const elegido = req.preparacionId && deps.elegido ? await deps.elegido(req.ninoId, req.preparacionId, req.nutriente) : undefined
  if (k.seguros.length === 0 && !elegido) throw new ErrorNibble('sin_candidatos', textoSinSeguros(k.nombre, k.momento ?? req.momento))
  const alergias = alergiasDe(k)
  const { otras, prohibidos } = otrasAlergiasDe(k)
  const ingredientes = alimentos()
    .filter((a) => sinAlergenos(a.id, alergias) && !prohibidos.has(a.id))
    .map((a) => ({ alimentoId: a.id, nombre: a.nombre }))
  const alimentoIds = ingredientes.map((i) => i.alimentoId)
  const pasos: Paso[] = elegido ? ['foco', 'relajado'] : ['foco', 'otro_foco', 'relajado']
  const focos: Foco[] = []

  let anterior: { salida: SalidaCreativa; problemas: string[] } | undefined
  for (let intento = 0; intento < pasos.length; intento++) {
    const paso = pasos[intento]!
    if (ahora() - t0 > TOPE_NUEVA_LLAMADA_MS) {
      registrar({ ninoId: req.ninoId, resultado: 'sin_tiempo', intento, ...(elegido ? {} : { focos }), ms: ahora() - t0 }, true)
      throw new ErrorNibble('timeout', 'Tardamos demasiado en armar una receta segura. ¿Probás de nuevo?', anterior ? { problemas: anterior.problemas } : undefined)
    }
    // v5.10 · El segundo no relaja el mismo foco: otro, que no parta del mismo alimento ni use el mismo ingrediente
    if (paso === 'otro_foco') {
      k = await deps.conocimiento(req.ninoId, { ...op, evitar: { desdeIds: [k.foco.desdeId], ...(k.foco.ingrediente ? { ingredientes: [k.foco.ingrediente] } : {}) } })
    }
    const kPrompt = otras.length ? { ...k, texto: textoConOtrasAlergias(k.texto, otras) } : k
    const seguroIds = elegido ? [elegido.desde.id] : k.seguros.map((s) => s.id)
    // Estricto: solo el alimento de partida del foco y su ingrediente. Si ese alimento no está entre los seguros, el foco
    // no se puede cumplir y va relajado: cualquier seguro, para no terminar en sin_candidatos por un foco imposible
    const relajado = paso === 'relajado' || (!elegido && !seguroIds.includes(k.foco.desdeId))
    if (!elegido) focos.push(k.foco)
    registrar({
      ninoId: req.ninoId, resultado: 'intento', intento, paso,
      ...(elegido ? { elegido: elegido.preparacion.id } : { foco: k.foco, estricto: !relajado }),
      ...(paso === 'relajado' && anterior ? { problemas: anterior.problemas } : {}),
    })
    const schema = esquemaSalidaCreativa(alimentoIds, seguroIds, k.nutrientes.map((x) => x.nutriente), relajado || elegido ? seguroIds : [k.foco.desdeId])
    // Con otro foco, el pedido es nuevo: los problemas de una receta que partía de otro lado no le sirven
    const previa = paso === 'relajado' ? anterior : undefined
    const desdeLlamada = ahora()
    const { datos } = await generarJSON({
      tarea: 'receta',
      sistema: SISTEMA_RECETA_CREATIVA,
      partes: [{ tipo: 'texto', texto: promptRecetaCreativa({
        conocimiento: kPrompt, ingredientes, anteriores, ...(previa ? { anterior: previa } : {}),
        ...(elegido ? { elegido: { preparacion: elegido.preparacion, desde: { id: elegido.desde.id, nombre: elegido.desde.nombre }, cambio: TEXTO_CAMBIO[elegido.candidato.cambio] } } : {}),
      }) }],
      schema,
      limiteMs: CORTE_MS - (desdeLlamada - t0),
    })
    const desde = elegido ? elegido.desde : k.seguros.find((s) => s.id === datos.desdeId)!
    const receta = completarCreativa(datos, k, desde, elegido)
    const problemas = problemasCreativa(receta, k, desde, anteriores, receta.platoCompleto?.componentes.filter((c) => !c.nuevo) ?? datos.acompanamientos, elegido, relajado)
    deps.alIntentar?.({ llamada: intento + 1, preparacionId: receta.preparacionBaseId, reintento: intento > 0, salida: datos, problemas, ms: ahora() - desdeLlamada, ...(elegido ? {} : { foco: k.foco }) })
    if (problemas.length === 0) {
      registrar({ ninoId: req.ninoId, nombre: receta.nombre, desde: desde.id, cambio: receta.cambio, nutriente: receta.evidencia.nutriente, objetivo: receta.objetivo, foco: k.foco, paso, llamadas: intento + 1, ms: ahora() - t0 })
      return { ...receta, validacion: { ok: true, problemas: [], reintentos: intento } }
    }
    anterior = { salida: datos, problemas }
  }
  registrar({ ninoId: req.ninoId, resultado: 'no_paso', ...(elegido ? {} : { focos }), problemas: anterior?.problemas, ms: ahora() - t0 }, true)
  throw new ErrorNibble('sin_candidatos', 'Esta vez no salió una receta segura. Probá otra idea.', { problemas: anterior?.problemas ?? [] })
}
