// v5.4 · Receta creativa (PLAN §7 y §9, "Generar receta"): /api/receta sin preparacionId. El grafo arma la base de
// conocimiento del chico y sortea un foco (armarConocimiento, server/grafo/conocimiento.ts) → el LLM inventa un plato
// nuevo a UN cambio de un alimento seguro (prompts/receta-creativa.ts) → el código arma la preparación con los atributos
// y los ingredientes que declaró, cuenta los cambios con cadena.ts y valida como la receta del catálogo
// (validacion/receta.ts), más el aporte mínimo, que no sea algo que ya come y que no repita una receta que ya vio
// → si falla, 1 reintento con los problemas → si sigue mal, ErrorNibble('sin_candidatos'): otro pedido sortea otro foco.
// v5.5 · Modo variedad (no le falta ningún nutriente, Conocimiento.variedad): sin aporte mínimo; si hay un grupo que
// menos come, el plato tiene que ser de ese grupo (atributos.grupo y el ingrediente principal). La evidencia muestra el
// nutriente al que más aporta respecto de su meta, y Receta.objetivo dice para qué es.
import type { Alergeno, Evidencia, Nutriente, Nutrientes, PreparacionCatalogo, Receta, RecetaReq } from '../../shared/contratos.js'
import { DIMENSIONES, cambios, principal } from '../aprendizaje/cadena.js'
import { NOMBRE_GRUPO, NOMBRE_NUTRIENTE, decimal, slug } from '../aprendizaje/textos.js'
import { ACOMPANAMIENTOS, type Conocimiento } from '../grafo/conocimiento.js'
import { ErrorNibble } from '../http.js'
import { CON_META } from '../nutricion/objetivos.js'
import { calcularAporte, cambiosEntre, problemasPorTipo, aplanar, type ContextoValidacion } from '../validacion/receta.js'
import { alimentoPorId, alimentos } from './catalogo.js'
import { generarJSON } from './modelo.js'
import { ajustarPorciones, armarPlatoCompleto, problemasDelPlato } from './plato-completo.js'
import { esquemaSalidaCreativa, promptRecetaCreativa, SISTEMA_RECETA_CREATIVA, type SalidaCreativa } from './prompts/receta-creativa.js'
import { CORTE_MS, TOPE_NUEVA_LLAMADA_MS, coberturaDeLoQueFalta, sinAlergenos, type IntentoReceta } from './receta.js'

export interface DepsRecetaCreativa {
  conocimiento: (ninoId: string, op: { nutriente?: Nutriente; momento?: RecetaReq['momento'] }) => Promise<Conocimiento>
  ahora?: () => number
  alIntentar?: (intento: Omit<IntentoReceta, 'salida' | 'problemas'> & { salida: SalidaCreativa; problemas: string[] }) => void
}

/** Lo que pide su dieta cuenta como alergia para validar (sin gluten ni caseína = sin gluten ni leche). */
function alergiasDe(k: Conocimiento): Alergeno[] {
  return [...new Set<Alergeno>([...k.alergias, ...(k.dieta === 'sin_gluten_caseina' ? (['gluten', 'leche'] as const) : [])])]
}

const normal = (s: string) => slug(s).replace(/_/g, ' ')

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
  const comida = ids.filter((id) => !ACOMPANAMIENTOS.has(id))
  if (nuevos.length === 0) {
    p.push(`«${receta.nombre}» usa los mismos ingredientes que «${desde.nombre}»: es más de lo mismo. Proponé un plato de verdad distinto, con un ingrediente nuevo.`)
  } else if (nuevos.every((id) => ACOMPANAMIENTOS.has(id))) {
    p.push(`Lo único nuevo de «${receta.nombre}» es ${nuevos.map((id) => alimentoPorId(id)?.nombre ?? id).join(' y ')}: un aceite, una grasa o un dulce no es un plato nuevo. El cambio tiene que ser un alimento (una verdura, una legumbre, un lácteo, una carne, un cereal…).`)
  }
  if (/\baceite\b/i.test(receta.nombre)) p.push(`El nombre «${receta.nombre}» habla del aceite: el plato es lo que se come, no con qué se cocina. Poné un nombre que dé ganas.`)
  if (comida.length < MIN_INGREDIENTES_COMIDA || ids.length < MIN_INGREDIENTES) {
    p.push(`La receta es muy simple (${ids.length} ingredientes): tiene que ser una preparación casera elaborada, con al menos ${MIN_INGREDIENTES} ingredientes y ${MIN_INGREDIENTES_COMIDA} de ellos alimentos de verdad (no aceite, manteca ni dulces).`)
  }
  if (receta.pasos.length < MIN_PASOS) p.push(`Tiene ${receta.pasos.length} pasos: una receta elaborada lleva al menos ${MIN_PASOS} (preparar, armar o rebozar, cocinar y servir).`)
  const n = receta.evidencia.nutriente
  if (minimo > 0) {
    const sinAcompanar = calcularAporte(receta.ingredientes.filter((i) => !ACOMPANAMIENTOS.has(i.alimentoId)))[n]
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
export function completarCreativa(salida: SalidaCreativa, k: Conocimiento, desde: PreparacionCatalogo): Receta {
  const base = platoDe(salida)
  const difs = cambiosEntre(desde, base)
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
    cambio: difs[0]?.cambio ?? 'ingrediente',
    seMantiene: DIMENSIONES.flatMap((dim) => {
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
    plato: { atributos: salida.atributos, imagen: salida.imagen },
    platoCompleto: armarPlatoCompleto({ preparacion: base, rol: salida.rol, aporte }, ajustarPorciones(aporte.energia_kcal, salida.acompanamientos ?? [], k), k),
    objetivo: k.variedad ? { tipo: 'variedad', ...k.variedad } : { tipo: 'nutriente', nutriente: n }, // v5.5
  }
}

/** Lo que valida la receta del catálogo, más lo propio de un plato inventado. */
export function problemasCreativa(
  receta: Receta, k: Conocimiento, desde: PreparacionCatalogo, anteriores: readonly string[],
  acompanamientos?: readonly { preparacionId: string; gramos: number }[],
): string[] {
  const base: PreparacionCatalogo = { id: receta.preparacionBaseId, nombre: receta.nombre, atributos: receta.plato!.atributos, ingredientes: receta.ingredientes }
  const ctx: ContextoValidacion = { alergias: alergiasDe(k), reglas: k.reglas, desde, base, presentacionesAceptadas: k.presentacionesAceptadas }
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
  if (anteriores.some((a) => normal(a) === normal(receta.nombre))) p.push(`«${receta.nombre}» ya lo vio la familia: proponé un plato distinto.`)
  // v5.7 · La comida completa: estructura, energía y proteína del plato entero
  if (receta.platoCompleto) p.push(...problemasDelPlato(receta.platoCompleto, acompanamientos ?? receta.platoCompleto.componentes.filter((c) => !c.nuevo), k))
  return p
}

function registrar(datos: Record<string, unknown>, aviso = false) {
  const linea = JSON.stringify({ evento: 'receta_creativa', ...datos })
  if (aviso) console.warn(linea)
  else console.info(linea)
}

export async function generarRecetaCreativa(req: RecetaReq, deps: DepsRecetaCreativa): Promise<Receta> {
  const ahora = deps.ahora ?? Date.now
  const t0 = ahora()
  const k = await deps.conocimiento(req.ninoId, { ...(req.nutriente ? { nutriente: req.nutriente } : {}), ...(req.momento ? { momento: req.momento } : {}) })
  if (k.seguros.length === 0) {
    throw new ErrorNibble('sin_candidatos', 'Todavía no sabemos qué come seguro: registrá algunas comidas y aparecen recetas.')
  }
  const anteriores = (req.anteriores ?? []).slice(-10)
  const alergias = alergiasDe(k)
  const ingredientes = alimentos().filter((a) => sinAlergenos(a.id, alergias)).map((a) => ({ alimentoId: a.id, nombre: a.nombre }))
  const schema = esquemaSalidaCreativa(ingredientes.map((i) => i.alimentoId), k.seguros.map((s) => s.id), k.nutrientes.map((x) => x.nutriente))

  let anterior: { salida: SalidaCreativa; problemas: string[] } | undefined
  for (let intento = 0; intento < 2; intento++) {
    if (ahora() - t0 > TOPE_NUEVA_LLAMADA_MS) {
      registrar({ ninoId: req.ninoId, resultado: 'sin_tiempo', intento, ms: ahora() - t0 }, true)
      throw new ErrorNibble('timeout', 'Tardamos demasiado en armar una receta segura. ¿Probás de nuevo?')
    }
    const desdeLlamada = ahora()
    const { datos } = await generarJSON({
      tarea: 'receta',
      sistema: SISTEMA_RECETA_CREATIVA,
      partes: [{ tipo: 'texto', texto: promptRecetaCreativa({ conocimiento: k, ingredientes, anteriores, ...(anterior ? { anterior } : {}) }) }],
      schema,
      limiteMs: CORTE_MS - (desdeLlamada - t0),
    })
    const desde = k.seguros.find((s) => s.id === datos.desdeId)!
    const receta = completarCreativa(datos, k, desde)
    const problemas = problemasCreativa(receta, k, desde, anteriores, receta.platoCompleto?.componentes.filter((c) => !c.nuevo) ?? datos.acompanamientos)
    deps.alIntentar?.({ llamada: intento + 1, preparacionId: receta.preparacionBaseId, reintento: intento > 0, salida: datos, problemas, ms: ahora() - desdeLlamada })
    if (problemas.length === 0) {
      registrar({ ninoId: req.ninoId, nombre: receta.nombre, desde: desde.id, cambio: receta.cambio, nutriente: receta.evidencia.nutriente, objetivo: receta.objetivo, foco: k.foco, llamadas: intento + 1, ms: ahora() - t0 })
      return { ...receta, validacion: { ok: true, problemas: [], reintentos: intento } }
    }
    anterior = { salida: datos, problemas }
  }
  registrar({ ninoId: req.ninoId, resultado: 'no_paso', foco: k.foco, problemas: anterior?.problemas, ms: ahora() - t0 }, true)
  throw new ErrorNibble('sin_candidatos', 'Esta vez no salió una receta segura. Probá otra idea.', { problemas: anterior?.problemas ?? [] })
}
