// v5.4 · La base de conocimiento del chico para la receta creativa (PLAN §7, "Generar receta"). El grafo ya no elige el
// plato: junta lo que sabe (lo que come seguro con sus atributos, lo que rechaza y por qué, lo que está en exposición,
// los patrones, las reglas de la familia y los nutrientes que faltan) y el LLM inventa un plato nuevo a UN cambio de
// uno de sus alimentos seguros. El código después vuelve a contar los cambios, las alergias, las reglas y el aporte.
// Para que no salga siempre lo mismo, el código elige un "foco" al azar: de qué alimento seguro partir, cómo cambiarlo y
// para qué nutriente. Los modos tocan el ingrediente porque es lo que mueve el nutriente: cambiar la forma o la cocción
// de sus papas no le suma calcio.
// v5.5 · Modo variedad: si no falta ningún nutriente clave esta semana (todos ≥ 70%) y no se pidió uno, el objetivo es
// sumar variedad: el grupo que menos come (variedadDe, nutricion/progreso.ts) o, si come de todos, algo nuevo a un cambio.
// Sin nutrientes que cumplir (`nutrientes` vacío, sin mínimo); con grupo, el foco cambia el ingrediente principal por uno
// de ese grupo (sumar un ingrediente no cambia el grupo del plato).
// v5.10 · Variedad de recetas: los "Ricos en X" van uno por familia (un solo queso) y sin golosinas ni ultraprocesados,
// el foco trae el ingrediente que el plato nuevo TIENE que usar (sorteado entre esos ricos o entre los del grupo) y lo
// que ya usó en las recetas que vio la familia (`anteriores`) no se repite: sale de los ricos y del sorteo.
// v5.10 · El sorteo del ingrediente pesa por lo que combina con lo que queda del plato de partida (afinidades de Ahn
// 2011, server/ia/afinidades.ts): sin eso salían "licuado de queso dambo y banana" y "milanesa de yogur".
import type { Alergeno, Alimento, Dieta, Grupo, Momento, Motor, Nutriente, Nutrientes, PreparacionCatalogo, Presentacion, Regla, Variedad } from '../../shared/contratos.js'
import { NUTRIENTE } from '../../shared/contratos.js'
import { alimentosProhibidos, limpiarOtras, normalizar } from '../alergias.js'
import { APORTE_MINIMO, esAncla, esSegura, principal } from '../aprendizaje/cadena.js'
import { calcularEstado } from '../aprendizaje/estado.js'
import { menorCobertura } from '../aprendizaje/recomendador.js'
import { NOMBRE_GRUPO, NOMBRE_NUTRIENTE, decimal, grupoSinComer, lista, minuscula, porciento } from '../aprendizaje/textos.js'
import { type Cargado, cargarNino } from '../datos/cargar.js'
import { hoyUruguay } from '../datos/fechas.js'
import { recomendacionDe } from '../datos/tablero.js'
import { afinidadCon, afines } from '../ia/afinidades.js'
import { completa } from '../ia/candidato.js'
import { esCondimento } from '../ia/condimentos.js'
import { energiaDeReferencia } from '../ia/plato-completo.js'
import { faltanSemana } from '../nutricion/calcular.js'
import { coberturaDia, gruposDesde, semana, variedadDe } from '../nutricion/progreso.js'

export interface OpcionNutriente {
  nutriente: Nutriente
  coberturaSemana: number
  faltaHoy: number
  minimo: number // por porción: el APORTE_MINIMO (15%) de su objetivo diario, como los candidatos de cadena.ts
  // los del catálogo sin sus alérgenos, de más a menos · v5.10: por porción (porPorcion, en porcionG gramos)
  ricos: { alimentoId: string; nombre: string; por100g: number; porPorcion: number; porcionG: number }[]
}

export interface Conocimiento {
  nombre: string
  alergias: Alergeno[]
  dieta: Dieta
  momento?: Momento
  energiaReferencia: number // v5.7 · kcal por día para dimensionar el plato completo (no es una meta: ver plato-completo.ts)
  seguros: PreparacionCatalogo[] // los puntos de partida: lo que acepta, va en esta comida y es seguro (puede estar vacío)
  aceptadas: PreparacionCatalogo[] // todo lo que acepta, con todos sus atributos: para "eso ya lo come"
  reglas: Regla[]
  presentacionesAceptadas: Presentacion[]
  nutrientes: OpcionNutriente[] // el pedido, o hasta 3 de los que faltan (en el orden de §1) · v5.5: vacío en modo variedad
  variedad?: Variedad // v5.5 · modo variedad: no falta ningún nutriente; el grupo que menos come, si hay
  coberturas: Record<Nutriente, { coberturaSemana: number; faltaHoy: number }> // v5.5 · de todos: la evidencia del nutriente que se muestra
  metaDiaria: Nutrientes // v5.5 · el objetivo diario del chico
  foco: Foco
  recientes: string[] // v5.10 · alimentoIds que aparecen en los nombres de `anteriores` (las recetas que ya vio la familia), sin acompañamientos ni rellenos
  texto: string // lo que ve el LLM
}

export const MODO = ['cambiar_principal', 'sumar_ingrediente'] as const
export type Modo = (typeof MODO)[number]
/** En modo nutriente trae `nutriente`; en modo variedad (v5.5) no, y trae `grupo` si hay uno que menos come. */
export interface Foco {
  desdeId: string; modo: Modo; nutriente?: Nutriente; grupo?: Grupo
  ingrediente?: string // v5.10 · alimentoId sorteado que el plato nuevo TIENE que usar: en 'cambiar_principal', como
                       // ingrediente principal (el de más gramos); en 'sumar_ingrediente', sumado. Sale de los ricos del
                       // nutriente del foco (o, en modo variedad con grupo, de los alimentos de ese grupo), sin los
                       // recientes y sin los ingredientes del alimento de partida. Puede faltar si no hay ninguno posible.
}

/**
 * v5.6 · Lo que acompaña pero no es el plato: grasas, dulces y aderezos. No cuentan como "rico en" un nutriente (el
 * omega-3 del aceite de canola daba "puré con aceite"), ni alcanzan para el cambio ni para el aporte de la receta creativa.
 */
export const ACOMPANAMIENTOS: ReadonlySet<string> = new Set([
  'aceite_girasol', 'aceite_canola', 'aceite_oliva', 'manteca', 'azucar', 'dulce_de_leche', 'mermelada', 'miel',
  'mayonesa', 'ketchup', 'cacao_azucarado',
  'crema_leche', 'dulce_batata', // v5.10 · la crema y el dulce de batata acompañan: no son el plato
])

/**
 * v5.10 · Lo que no puede ser "lo nuevo" de una receta para que coma mejor, aunque sea rico en un nutriente: no va en los
 * "Ricos en X" ni sale sorteado como ingrediente del foco (el LLM igual los puede usar, de la lista de ingredientes).
 * Antes, "Ricos en calcio" traía chocolate y pan rallado, y omega-3 sugería galletitas, nuggets, papas chips y medialuna.
 */
export const GOLOSINAS_Y_ULTRAPROCESADOS: ReadonlySet<string> = new Set([
  // Golosinas, postres y masas dulces
  'chocolate', 'alfajor', 'bizcochuelo', 'helado', 'postre_lacteo', 'galletitas_dulces', 'galletitas_avena', 'medialuna',
  'galletitas_rellenas', 'postre_chocolate', 'flan', 'torta_frita', // v5.10 · los de la tanda 2 del catálogo
  // Bebidas azucaradas y barras de paquete (v5.10): el jugo de verdad es la fruta, o jugo_naranja
  'refresco', 'jugo_envasado', 'barra_cereal',
  // Snacks y galletitas o grisines de paquete: el omega-3 y el hierro les vienen del aceite y de la harina fortificada
  'papas_chips', 'galletitas_agua', 'galletitas_integrales', 'grisines', 'pororo',
  'papas_fritas', // v5.10 · su omega-3 es el aceite de la fritura: salía "cambiá su licuado por papas fritas"; la papa es `papa`
  // Carnes procesadas, rebozados comerciales y fiambres: la versión casera (pollo, carne, merluza) es la que suma
  'salchicha', 'hamburguesa_comercial', 'nuggets_pollo', 'palitos_pescado', 'chorizo', 'jamon',
  // Masa y cereal de paquete: el hierro y la vitamina D se los agregan, el plato no es eso
  'prepizza', 'cereal_fortificado',
  // Solo para rebozar o ligar: no son un alimento del plato
  'pan_rallado', 'harina_trigo', 'harina_maiz', 'harina_arroz', 'harina_integral', 'harina_garbanzo', // v5.10 · la polenta es `polenta`
])

/** v5.10 · La familia de un alimento, el primer tramo del id: queso_rallado, queso_dambo y queso_muzzarella son queso. */
export const familia = (id: string): string => id.split('_')[0]!

const UNIDAD: Record<Nutriente, string> = {
  energia_kcal: 'kcal', proteina_g: 'g', calcio_mg: 'mg', vitamina_d_ug: 'µg', hierro_mg: 'mg', fibra_g: 'g', omega3_g: 'g', b12_ug: 'µg', vitamina_c_mg: 'mg',
}
/** Cambiar el principal da platos más distintos (más peso); sumar un ingrediente es el paso más chico. */
const MODOS_FOCO: Modo[] = ['cambiar_principal', 'cambiar_principal', 'cambiar_principal', 'sumar_ingrediente']
const MAX_NUTRIENTES = 3
const MAX_RICOS = 8
const MIN_RICOS = 3 // v5.10 · si sacar los recientes deja menos, vuelven los que más aportan
const MAX_RICOS_POR_GRUPO = 2 // v5.10 · que no sean todos lácteos: entran leches y yogures, y no solo quesos
const MIN_PORCION_PRINCIPAL_G = 40 // v5.10 · "un plato cuyo principal es lino" no sirve: 10 g no son un plato
/**
 * v5.10 · Cambiando el principal, de qué grupos puede ser el nuevo según el grupo del principal de su plato: un lácteo
 * por otro, una fruta por otra, una proteína por otra (las legumbres son proteína); papas por boniato o por bastones de
 * zanahoria (food chaining clásico) y al revés. Del grupo otro, ninguno. Sin esto salían "ravioles en un licuado".
 */
export const GRUPOS_PARA_CAMBIAR: Readonly<Record<Grupo, readonly Grupo[]>> = {
  lacteo: ['lacteo'], fruta: ['fruta'], proteina: ['proteina'],
  cereal_almidon: ['cereal_almidon', 'verdura'], verdura: ['verdura', 'cereal_almidon'], otro: [],
}
const MIN_LETRAS_ALIAS = 4 // v5.10 · "pan" o "res" aparecen en todo: los alias más cortos no cuentan para los recientes
const MIN_AFINES = 2 // v5.10 · con menos candidatos que combinen con su plato, el sorteo no mira la afinidad
const MAX_COMBINACIONES = 6 // v5.10 · las "combinaciones probadas" del principal que ve el LLM

/** v5.10 · Ni un genérico otro_<grupo> ni uno de alimentos_fdc (fdc_…, sin alérgenos curados ni en la lista del LLM). */
const esCurado = (id: string) => !id.startsWith('otro_') && !id.startsWith('fdc_')

/**
 * v5.10 · Los alimentos que identifican las recetas que ya vio la familia: los que aparecen en sus nombres, en palabras
 * completas y sin mayúsculas ni tildes, por el nombre o los alias de cada alimento curado, o por la familia cuando nombra
 * a varios ("costra de queso" son todos los quesos). El término más largo va primero y se consume: "dulce de leche" no es
 * leche. Los acompañamientos, las golosinas y los rellenos (pan rallado, harina, aceite) no identifican el plato: no
 * cuentan. Lo que viene después de "como su(s)" es el alimento seguro al que se parece, no lo que lleva: en "Medallones
 * de ricota crocantes, como sus nuggets" está la ricota, no los nuggets.
 */
export function recientesDe(anteriores: readonly string[], alimentos: ReadonlyMap<string, Alimento>): string[] {
  const textos = anteriores.map((n) => ` ${normalizar(n).replace(/(^| )como sus?( .*)?$/, '')} `).filter((t) => t.trim())
  if (!textos.length) return []
  const curados = [...alimentos.values()].filter((a) => esCurado(a.id))
  const porFamilia = new Map<string, number>()
  for (const a of curados) porFamilia.set(familia(a.id), (porFamilia.get(familia(a.id)) ?? 0) + 1)
  const terminos = new Map<string, string[]>() // término → los alimentos que nombra
  const sumar = (t: string, id: string) => terminos.set(t, [...(terminos.get(t) ?? []), id])
  for (const a of curados) {
    sumar(normalizar(a.nombre), a.id)
    for (const x of a.alias.map(normalizar)) if (x.replace(/ /g, '').length >= MIN_LETRAS_ALIAS) sumar(x, a.id)
    const f = familia(a.id)
    if (f.length >= MIN_LETRAS_ALIAS && (porFamilia.get(f) ?? 0) > 1) sumar(f, a.id)
  }
  const deMasLargo = [...terminos].filter(([t]) => t).sort(([a], [b]) => b.length - a.length)
  const aparecen = new Set<string>()
  for (let texto of textos) {
    for (const [t, ids] of deMasLargo) {
      if (!texto.includes(` ${t} `)) continue
      for (const id of ids) aparecen.add(id)
      texto = texto.split(` ${t} `).join(' | ')
    }
  }
  return curados.filter((a) => aparecen.has(a.id) && !ACOMPANAMIENTOS.has(a.id) && !esCondimento(a.id) && !GOLOSINAS_Y_ULTRAPROCESADOS.has(a.id)).map((a) => a.id)
}

const atributosEnTexto = (p: PreparacionCatalogo) => {
  const a = p.atributos
  return [a.textura, a.forma, a.sabor, a.temperatura, a.coccion ?? 'sin dato', a.presentacion].join(', ')
}

export function conocimientoDe(
  c: Cargado,
  op: { nutriente?: Nutriente; momento?: Momento; motor?: Motor; hoy?: string; ahora?: Date; azar?: () => number; anteriores?: string[] } = {},
): Conocimiento {
  const azar = op.azar ?? Math.random
  const hoy = op.hoy ?? hoyUruguay(op.ahora)
  const estado = calcularEstado(c.nino, c.comidas, c.catalogo, { hasta: hoy })
  const sem = semana(estado.comidas, hoy, c.objetivo)
  const delDia = coberturaDia(hoy, estado.comidas, c.objetivo).consumido.valor
  const d = c.nino.datos
  // v5.10 · Como el schema del LLM (receta-creativa.ts): su dieta cuenta como alergia y sus otras alergias, también
  const alergias = [...d.alergias, ...(d.dieta === 'sin_gluten_caseina' ? (['gluten', 'leche'] as const) : [])]
  const prohibidos = alimentosProhibidos(limpiarOtras(d.alergiasOtras), c.alimentos)
  const sinAlergenos = (id: string) => !prohibidos.has(id) && (c.alimentos.get(id)?.alergenos ?? []).every((x) => !alergias.includes(x))
  // v5.10 · Lo que puede ser "lo nuevo" de una receta: un alimento curado, que no sea un acompañamiento ni una golosina
  const paraLoNuevo = (a: Alimento) => esCurado(a.id) && !ACOMPANAMIENTOS.has(a.id) && !esCondimento(a.id) && !GOLOSINAS_Y_ULTRAPROCESADOS.has(a.id) && sinAlergenos(a.id)
  const recientes = recientesDe(op.anteriores ?? [], c.alimentos)
  const esReciente = new Set(recientes)
  const preparacion = (id: string) => {
    const p = c.catalogo.get(id)
    if (p) return p
    const conocida = estado.conocidas.get(id)
    return conocida ? completa(conocida) : undefined
  }

  // Lo que come seguro: el punto de partida de la cadena. Primero lo que va en esta comida (lo anotado en el catálogo o,
  // si no es del catálogo, las comidas en que lo come según lo que se sabe de él).
  const estados = [...estado.estados.values()]
  const aceptadas = estados
    .filter((s) => s.estado === 'acepta')
    .flatMap((s) => {
      const p = preparacion(s.prepId)
      const momentos = p?.momentos ?? estado.conocidas.get(s.prepId)?.momentos ?? []
      return p ? [{ p, s, vaEnLaComida: !op.momento || momentos.includes(op.momento) }] : []
    })
    .sort((a, b) => Number(b.vaEnLaComida) - Number(a.vaEnLaComida) || b.s.p - a.s.p)
  // Se parte solo de lo que va en esta comida (la imagen lo sirve al lado: "Servilo al lado de su pizza" en el desayuno
  // no), se conoce entero y no tiene sus alérgenos. Si nada va en esta comida, no hay punto de partida: la receta
  // creativa no arranca (mejor eso que partir de la milanesa para el desayuno).
  const seguros = aceptadas.filter((x) => x.vaEnLaComida && esAncla(x.p) && esSegura(x.p, d.alergias, c.alimentos))
  const otras = aceptadas.filter((x) => !seguros.includes(x))

  // Los nutrientes que puede elegir: el pedido o los que faltan. La vitamina D casi no está en los alimentos: solo si se pide.
  const faltan = sem.diasRegistrados ? faltanSemana(sem.cobertura) : []
  const elegibles = op.nutriente ? [op.nutriente] : faltan.filter((n) => n !== 'vitamina_d_ug').slice(0, MAX_NUTRIENTES)
  // v5.5 · Si no falta ninguno (y no se pidió uno), sumar variedad: sin nutrientes que cumplir
  const variedad = op.nutriente ? null : variedadDe(sem.diasRegistrados, faltan, gruposDesde(estado.comidas, hoy))
  const coberturas = Object.fromEntries(NUTRIENTE.map((n) => [n, {
    coberturaSemana: Math.round(sem.cobertura[n] * 1000) / 1000,
    faltaHoy: Math.round(Math.max(0, c.objetivo[n] - delDia[n]) * 10) / 10,
  }])) as Conocimiento['coberturas']
  const aElegir = variedad ? [] : elegibles.length ? elegibles : [faltan[0] ?? menorCobertura(sem.cobertura)]
  // v5.10 · Los ricos: de más a menos aporte POR PORCIÓN (el queso rallado tiene mucho calcio cada 100 g, pero la porción
  // es de 10 g), el que más aporta de cada familia, como máximo MAX_RICOS_POR_GRUPO de cada grupo y sin los recientes (si
  // quedan menos de MIN_RICOS, vuelven los recientes que más aportan)
  const porPorcionEn = (n: Nutriente) => (a: Alimento) => (a.por100g[n] * a.porcionMedianaG) / 100
  /** Todos los que aportan `n`, de más a menos por porción, el mejor de cada familia (sin topes). */
  const unoPorFamilia = (n: Nutriente): Alimento[] => {
    const porPorcion = porPorcionEn(n)
    const porFamilia = new Map<string, Alimento>()
    for (const a of [...c.alimentos.values()].filter((a) => paraLoNuevo(a) && a.por100g[n] > 0).sort((a, b) => porPorcion(b) - porPorcion(a))) {
      if (!porFamilia.has(familia(a.id))) porFamilia.set(familia(a.id), a)
    }
    return [...porFamilia.values()]
  }
  const ricosEn = (n: Nutriente): OpcionNutriente['ricos'] => {
    const porPorcion = porPorcionEn(n)
    const todos = unoPorFamilia(n)
    // De más a menos, con el tope por grupo y hasta `recientes` de los recientes
    const conTope = (recientes: number) => {
      const porGrupo = new Map<Grupo, number>()
      return todos.filter((a) => {
        const reciente = esReciente.has(a.id)
        if ((reciente && recientes === 0) || (porGrupo.get(a.grupo) ?? 0) >= MAX_RICOS_POR_GRUPO) return false
        porGrupo.set(a.grupo, (porGrupo.get(a.grupo) ?? 0) + 1)
        if (reciente) recientes--
        return true
      })
    }
    const sinRecientes = conTope(0)
    return (sinRecientes.length >= MIN_RICOS ? sinRecientes : conTope(MIN_RICOS - sinRecientes.length))
      .slice(0, MAX_RICOS)
      .map((a) => ({ alimentoId: a.id, nombre: a.nombre, por100g: a.por100g[n], porPorcion: Math.round(porPorcion(a) * 100) / 100, porcionG: a.porcionMedianaG }))
  }
  const nutrientes: OpcionNutriente[] = aElegir.map((n) => ({
    nutriente: n,
    ...coberturas[n],
    minimo: Math.round(APORTE_MINIMO * c.objetivo[n] * 100) / 100,
    ricos: ricosEn(n),
  }))

  // El foco, al azar: el alimento seguro entre los que van en esta comida, el modo y el nutriente (el primero pesa doble).
  // v5.5 · En modo variedad, sin nutriente; con un grupo, siempre cambiar el principal por uno de ese grupo.
  const paraFoco = seguros
  const elegir = <T>(xs: readonly T[]): T | undefined => xs[Math.min(xs.length - 1, Math.floor(azar() * xs.length))]
  const porNutriente = nutrientes.map((x) => x.nutriente)
  let desde = elegir(paraFoco)?.p
  const sorteado = elegir(MODOS_FOCO) ?? 'cambiar_principal'
  let modo: Modo = variedad?.grupo ? 'cambiar_principal' : sorteado
  // v5.10 · Sumando un ingrediente, el principal del plato nuevo sigue siendo el de su plato: si ya lo usó hace poco, se
  // parte de otro alimento seguro o, si todos lo tienen reciente, se cambia el principal
  const principalReciente = (p: PreparacionCatalogo) => esReciente.has(principal(p.ingredientes) ?? '')
  if (modo === 'sumar_ingrediente' && desde && principalReciente(desde)) {
    const otro = elegir(paraFoco.filter((x) => !principalReciente(x.p)))?.p
    if (otro) desde = otro
    else modo = 'cambiar_principal'
  }
  const desdeId = desde?.id ?? ''
  const foco: Foco = variedad
    ? { desdeId, modo, ...(variedad.grupo ? { grupo: variedad.grupo } : {}) }
    : { desdeId, modo, nutriente: elegir([porNutriente[0], ...porNutriente].filter((n) => n !== undefined)) ?? nutrientes[0]!.nutriente }

  // v5.10 · El ingrediente que el plato nuevo tiene que usar: entre los ricos del nutriente del foco (los que más aportan
  // pesan más) o, en modo variedad con grupo, entre los de ese grupo. Ni lo que ya lleva su plato, ni lo reciente, ni un
  // grupo que sus reglas rechazan ("No come verduras": la espinaca es rica en calcio, pero ese plato no pasa).
  const delGrupo = variedad?.grupo ? [...c.alimentos.values()].filter((a) => a.grupo === variedad.grupo && paraLoNuevo(a)).map((a) => a.id) : []
  const deSuPlato = new Set(desde?.ingredientes.map((i) => i.alimentoId) ?? [])
  const suPrincipal = desde ? principal(desde.ingredientes) : null
  const rechazaGrupo = (g: Grupo | undefined) =>
    c.nino.reglas.some((r) => r.efecto === 'rechaza' && r.condiciones.length > 0 && r.condiciones.every((x) => x.tipo === 'grupo' && x.valor === g))
  // v5.10 · Cambiando el principal, el ingrediente tiene que poder ser el plato: ni frutos secos ni semillas (grupo otro)
  // ni lo que se come de a poco (porción de menos de 40 g), y de un grupo que pueda reemplazar a su principal
  // (GRUPOS_PARA_CAMBIAR; en modo variedad, el grupo es el que pide la variedad). Sumados, sí van.
  const grupoDelPrincipal = suPrincipal ? c.alimentos.get(suPrincipal)?.grupo : undefined
  const puedeSerPrincipal = (id: string) => {
    const a = c.alimentos.get(id)
    if (!a || a.grupo === 'otro' || a.porcionMedianaG < MIN_PORCION_PRINCIPAL_G) return false
    return Boolean(variedad?.grupo) || !grupoDelPrincipal || GRUPOS_PARA_CAMBIAR[grupoDelPrincipal].includes(a.grupo)
  }
  const cambia = modo === 'cambiar_principal'
  const posible = (id: string) =>
    !esReciente.has(id) && !deSuPlato.has(id) && !rechazaGrupo(c.alimentos.get(id)?.grupo) && (!cambia || puedeSerPrincipal(id))
  // Cambiando el principal, los que más aportan entre los que pueden reemplazarlo (no solo los 8 ricos de la lista, que
  // tienen como mucho 2 por grupo: desde sus papas fritas quedaban 2 cereales y 2 verduras)
  const candidatos = variedad
    ? delGrupo.filter(posible)
    : !foco.nutriente
      ? []
      : cambia
        ? unoPorFamilia(foco.nutriente).map((a) => a.id).filter(posible).slice(0, MAX_RICOS)
        : (nutrientes.find((x) => x.nutriente === foco.nutriente)?.ricos ?? []).map((r) => r.alimentoId).filter(posible)
  const base = candidatos.map((_, i) => (variedad ? 1 : candidatos.length - i))
  // v5.10 · El peso se multiplica por lo que combina con su plato. Cambiando el principal, solo entre los que combinan
  // (con uno alcanza); sumando, si hay al menos MIN_AFINES. Si no (o sin datos de afinidad), el sorteo por lugar entre los
  // posibles (cambiando el principal, del mismo grupo o uno compatible, nunca de otro), y queda en el log.
  const conQue = contextoAfinidad(desde, modo)
  const afinidad = candidatos.map((id) => afinidadConPlato(id, conQue))
  const combinan = candidatos.flatMap((_, i) => (afinidad[i]! > 0 ? [i] : []))
  const porAfinidad = combinan.length >= (cambia ? 1 : MIN_AFINES)
  const ingrediente = porAfinidad
    ? elegirConPesos(combinan.map((i) => candidatos[i]!), combinan.map((i) => base[i]! * afinidad[i]!), azar)
    : elegirConPesos(candidatos, base, azar)
  if (ingrediente) foco.ingrediente = ingrediente
  if (!porAfinidad && desde && candidatos.length > 1) {
    console.info(JSON.stringify({ evento: 'foco_sin_afinidad', desdeId, modo, conQue, candidatos: candidatos.length, combinan: combinan.length, ingrediente }))
  }
  // v5.10 · Las combinaciones probadas del principal de su plato, para que el LLM arme algo que combine
  const combinaciones = suPrincipal
    ? afines(conDatos(suPrincipal), MAX_COMBINACIONES, (id) => { const a = c.alimentos.get(id); return Boolean(a && paraLoNuevo(a)) }).map((x) => x.alimentoId)
    : []

  const rechaza = estados.filter((s) => s.estado === 'rechaza' || (s.declarada === 'rechaza' && s.estado !== 'acepta'))
  const enExposicion = estados.filter((s) => s.estado === 'en_proceso' && s.veces >= 1 && s.declarada !== 'rechaza')
  const presentacionesAceptadas = [...new Set(aceptadas.map((x) => x.p.atributos.presentacion).filter((pr) => pr !== 'separado'))]
  const ideas = (recomendacionDe(c, estado, hoy, op.motor ?? 'grafo', nutrientes[0]?.nutriente, op.ahora, op.momento).ideas ?? []).slice(0, 6)

  const lineas = [
    `Chico: ${d.nombre}, ${d.edad} años. Alergias: ${d.alergias.length ? lista(d.alergias) : 'ninguna'}${d.dieta === 'sin_gluten_caseina' ? '. Dieta sin gluten ni caseína' : ''}.`,
    ...(op.momento ? [`La receta es para: ${op.momento}.`] : []),
    'Lo que come seguro (los puntos de partida posibles; id: nombre · textura, forma, sabor, temperatura, cocción, presentación · ingrediente principal · cuánto lo come):',
    ...seguros.map(({ p, s }) => {
      const cuanto = s.veces > 0 ? `comió ${s.comio} de ${s.veces}` : 'según contó la familia'
      return `- ${p.id}: ${p.nombre} · ${atributosEnTexto(p)} · ${principal(p.ingredientes) ?? 'sin dato'} · ${cuanto}`
    }),
    ...(otras.length ? [`También come (no sirven de punto de partida para esta comida): ${otras.map((x) => x.p.nombre).join(' · ')}.`] : []),
    `Lo que rechaza o todavía le cuesta: ${rechaza.map((s) => {
      const p = preparacion(s.prepId)
      return `${s.nombre}${s.motivoDeclarado ? ` (${s.motivoDeclarado})` : ''}${p ? ` [${atributosEnTexto(p)}]` : ''}`
    }).join(' · ') || 'nada registrado'}.`,
    `En exposición (ya se los están ofreciendo: no los propongas): ${enExposicion.map((s) => `${s.nombre} (${s.veces} ${s.veces === 1 ? 'vez' : 'veces'})`).join(' · ') || 'ninguno'}.`,
    `Patrones del grafo: ${estado.patrones.slice(0, 8).map((p) => `${p.texto} (confianza ${decimal(p.confianza)})`).join(' · ') || 'todavía pocos datos'}.`,
    `Reglas de la familia: ${c.nino.reglas.length ? c.nino.reglas.map((r) => r.texto).join(' · ') : 'ninguna'}.`,
    ...(variedad
      ? lineasVariedad(variedad, delGrupo)
      : [
          'Le falta (elegí uno):',
          ...nutrientes.map((x) => `- ${x.nutriente} (${NOMBRE_NUTRIENTE[x.nutriente]}): esta semana cubre ${porciento(x.coberturaSemana)}; hoy le faltan ${decimal(x.faltaHoy, 0)} ${UNIDAD[x.nutriente]}. La porción tiene que aportar al menos ${decimal(x.minimo, 1)} ${UNIDAD[x.nutriente]}. Ricos en ${NOMBRE_NUTRIENTE[x.nutriente]}, por porción: ${x.ricos.map((r) => `${r.alimentoId} (${decimal(r.porPorcion, 1)} ${UNIDAD[x.nutriente]} en ${r.porcionG} g; ${decimal(r.por100g, 1)}/100 g)`).join(', ')}.`),
        ]),
    ...(recientes.length ? [`Ya usó hace poco (no los repitas como ingrediente principal): ${recientes.join(', ')}.`] : []), // v5.10
    ...(combinaciones.length ? [`Combinaciones probadas en recetas reales: ${minuscula(c.alimentos.get(suPrincipal!)?.nombre ?? suPrincipal!)} va bien con ${combinaciones.join(', ')}.`] : []), // v5.10
    ...(ideas.length ? [`Ideas del catálogo del grafo, solo como referencia (podés inventar otra): ${ideas.map((i) => (variedad ? i.nombre : `${i.nombre} (${NOMBRE_NUTRIENTE[i.nutriente]})`)).join(' · ')}.`] : []),
  ]

  return {
    nombre: d.nombre,
    alergias: d.alergias,
    dieta: d.dieta,
    ...(op.momento ? { momento: op.momento } : {}),
    energiaReferencia: energiaDeReferencia(d.edad, d.sexo),
    seguros: seguros.map((x) => x.p),
    aceptadas: aceptadas.map((x) => x.p),
    reglas: c.nino.reglas,
    presentacionesAceptadas,
    nutrientes,
    ...(variedad ? { variedad } : {}),
    coberturas,
    metaDiaria: c.objetivo,
    foco,
    recientes,
    texto: lineas.join('\n'),
  }
}

/**
 * v5.10 · Uno al azar según su peso. Los ricos pesan por su lugar (de n, el primero n, el segundo n − 1 … y el último 1;
 * con pesos iguales es el sorteo parejo) y, si combinan con su plato, por esa afinidad también.
 */
function elegirConPesos<T>(xs: readonly T[], pesos: readonly number[], azar: () => number): T | undefined {
  let r = azar() * pesos.reduce((a, b) => a + b, 0)
  for (const [i, x] of xs.entries()) {
    r -= pesos[i]!
    if (r < 0) return x
  }
  return xs.at(-1)
}

/**
 * v5.10 · El id con el que se busca su afinidad: el suyo o, si no está en las recetas de Ahn, el de su familia que sí
 * está (yogur_bebible combina como yogur, porotos_soja como porotos, huevo_revuelto como huevo). Con los ricos por
 * porción entran esas variantes, y sin esto la afinidad no tenía con qué pesar el sorteo.
 */
export const conDatos = (id: string): string => (afines(id, 1).length > 0 || afines(familia(id), 1).length === 0 ? id : familia(id))

/** v5.10 · Lo que combina `id` con un plato (afinidadCon), buscando cada uno por conDatos. */
export function afinidadConPlato(id: string, plato: readonly string[]): number {
  return afinidadCon(conDatos(id), plato.map(conDatos))
}

/**
 * v5.10 · Con qué tiene que combinar el ingrediente del foco: lo que queda del plato de partida. Sumando un ingrediente,
 * todo su plato; cambiando el principal, lo demás y, si no queda nada, como en la banana pisada, el principal. Los
 * acompañamientos (aceite, azúcar, manteca) y los condimentos no cuentan, y lo que no tiene datos de afinidad tampoco:
 * el pan rallado no está en las recetas de Ahn, así que la milanesa sin la carne no deja nada y cuenta la carne.
 */
export function contextoAfinidad(desde: Pick<PreparacionCatalogo, 'ingredientes'> | undefined, modo: Modo): string[] {
  if (!desde) return []
  const cuenta = (id: string) => !ACOMPANAMIENTOS.has(id) && !esCondimento(id) && afines(conDatos(id), 1).length > 0
  const ids = [...new Set(desde.ingredientes.map((i) => i.alimentoId))].filter(cuenta)
  if (modo === 'sumar_ingrediente') return ids
  const p = principal(desde.ingredientes)
  const resto = ids.filter((id) => id !== p)
  return resto.length ? resto : ids
}

/** v5.5 · Lo que ve el LLM en modo variedad: no le falta ningún nutriente; el grupo que menos come y con qué alimentos. */
function lineasVariedad(v: Variedad, delGrupo: string[]): string[] {
  const intro = 'No le falta ningún nutriente clave esta semana (todos por encima del 70%). El objetivo es sumar variedad'
  if (!v.grupo) {
    return [`${intro}: come de todos los grupos, así que alcanza con un plato nuevo a un solo cambio de lo que ya come. No hace falta llegar a un mínimo de ningún nutriente.`]
  }
  return [
    `${intro}: ${grupoSinComer(v.grupo, v.diasSinComer)}.`,
    `El plato nuevo tiene que ser de ${NOMBRE_GRUPO[v.grupo]} (atributos.grupo = ${v.grupo}) y su ingrediente principal (el de más gramos) también${delGrupo.length ? `: ${delGrupo.join(', ')}` : ''}. No hace falta llegar a un mínimo de ningún nutriente.`,
  ]
}

export async function armarConocimiento(
  ninoId: string, op: { nutriente?: Nutriente; momento?: Momento; motor?: Motor; anteriores?: string[] } = {},
): Promise<Conocimiento> {
  return conocimientoDe(await cargarNino(ninoId), op)
}
