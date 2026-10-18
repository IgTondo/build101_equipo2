// Recomendador enchufable (PLAN.md §4.3 y §8): `grafo` (propagación + patrones, el de producción) o `base`
// (α/β por atributo, la misma base de la curva de §11.4). Los dos usan los mismos candidatos de cadena.ts.
import type { Cambio, Candidato, IdeaReceta, Momento, Motor, Nutriente, Nutrientes, PreparacionCatalogo, Sugerencia, Variedad } from '../../shared/contratos.js'
import { aporte, cero, redondearParcial } from '../nutricion/calcular.js'
import { CON_META } from '../nutricion/objetivos.js'
import { alfaBeta, pAtributos } from './aceptacion.js'
import { type EntradaCadena, type PasoCadena, DIFICULTAD, candidatosCadena, esSegura, principal } from './cadena.js'
import { type Contexto, type Observacion, cumple } from './condiciones.js'
import type { Patron } from './patrones.js'
import { importanciaPorTipo, propagar } from './propagacion.js'
import { DEL_NUTRIENTE, NOMBRE_NUTRIENTE, TEXTO_CAMBIO, porciento, sinComer, su } from './textos.js'

export interface EntradaRecomendador extends EntradaCadena {
  observaciones: readonly Observacion[]
  patrones: readonly Patron[] // los vigentes (aprendidos + investigación)
  faltan: readonly Nutriente[] // en el orden de prioridad de §1
  coberturaSemana: Nutrientes
  evitarSegura?: readonly string[] // lo que se sirvió en la última comida del mismo momento: no repetir el mismo tema
  variedad?: Variedad // v5.5 · modo variedad (variedadDe, nutricion/progreso.ts): no falta ningún nutriente clave esta semana
}

export interface Recomendacion {
  motor: Motor
  nutriente: Nutriente
  candidatos: Candidato[]
  sugerencias: Sugerencia[] // siempre en el orden segura, un_paso, mas_nutritiva
  ideas?: IdeaReceta[] // v5.4 · solo con momento: para que "Generar receta" no repita
  variedad?: Variedad // v5.5 · modo variedad: mas_nutritiva suma el grupo que menos come (o algo nuevo) en vez de un nutriente
}

/** Cómo se va a servir lo nuevo (§7): separado y al lado de su alimento seguro. Los patrones de contexto se miran con esto. */
const CONTEXTO_SUGERIDO: Partial<Contexto> = { distribucion: 'separados', juntoASeguro: true }
const PESO_PATRONES = 0.3
const PESO_DIFICULTAD = 0.05
/** Mientras está en proceso y lleva menos de 10 exposiciones, se sigue sugiriendo el mismo y servido igual (§8). */
const MAX_EXPOSICIONES_MISMO = 10

interface Puntuado {
  paso: PasoCadena
  puntaje: number
  patrones: string[]
}
/** El puntaje de una preparación para el chico; `cambio` null = sin penalidad de dificultad (la usa simular-nino). */
export type Puntuador = (cand: Pick<PreparacionCatalogo, 'id' | 'atributos'>, cambio: Cambio | null) => { puntaje: number; patrones: string[] }
type EntradaPuntuador = Pick<EntradaRecomendador, 'estados' | 'conocidas' | 'patrones' | 'observaciones'>

/**
 * propagación + 0,3·(confianza del patrón a favor más fuerte − la del patrón en contra más fuerte) − 0,05·dificultad.
 * El plan suma todas las confianzas (Σ), pero los patrones que se muestran se pisan entre sí ("lo crocante", "lo
 * crocante en forma plana", "lo plano"…): sumarlos premia parecerse a lo seguro de muchas maneras redundantes.
 */
function puntuadorGrafo(e: EntradaPuntuador): Puntuador {
  const puntajes = new Map([...e.estados.values()].map((s) => [s.prepId, s.p]))
  const prop = propagar([...e.conocidas.values()], puntajes, importanciaPorTipo(e.patrones))
  return (cand, cambio) => {
    const aplican = e.patrones.filter((p) => cumple(p.condiciones, cand.atributos, CONTEXTO_SUGERIDO))
    const mas = (resultado: Patron['resultado']) =>
      Math.max(0, ...aplican.filter((p) => p.resultado === resultado).map((p) => p.confianza))
    const bonus = mas('acepta') - mas('rechaza')
    return {
      puntaje: (prop.get(cand.id) ?? 0) + PESO_PATRONES * bonus - (cambio ? PESO_DIFICULTAD * DIFICULTAD[cambio] : 0),
      patrones: aplican.map((p) => p.texto),
    }
  }
}

/** La base trata cada atributo por separado: no ve combinaciones (por eso existe el grafo). */
function puntuadorBase(e: EntradaPuntuador): Puntuador {
  const ab = alfaBeta(e.observaciones)
  return (cand, cambio) => ({
    puntaje: 2 * (pAtributos(ab, cand.atributos) - 0.5) - (cambio ? PESO_DIFICULTAD * DIFICULTAD[cambio] : 0),
    patrones: [],
  })
}

export const puntuador = (e: EntradaPuntuador, motor: Motor): Puntuador => (motor === 'grafo' ? puntuadorGrafo(e) : puntuadorBase(e))

export function menorCobertura(cob: Nutrientes): Nutriente {
  return [...CON_META].sort((a, b) => cob[a] - cob[b])[0] ?? 'calcio_mg'
}

const redondear = (x: number, d = 3) => Math.round(x * 10 ** d) / 10 ** d
const logistica = (x: number) => 1 / (1 + Math.exp(-3 * x))
const destacar = (mantiene: string[]) => {
  const d = mantiene.filter((s) => s.startsWith('forma=') || s.startsWith('textura='))
  return d.length ? d : mantiene.slice(0, 2)
}

function aCandidato({ paso, puntaje, patrones }: Puntuado): Candidato {
  const e = paso.estadoDesde
  return {
    preparacionId: paso.cand.id,
    nombre: paso.cand.nombre,
    puntaje: redondear(puntaje),
    camino: { desde: paso.desde.nombre, aceptacion: e.veces > 0 ? `${e.comio}/${e.veces}` : 'según la familia', atributos: destacar(paso.seMantiene) },
    desdeId: paso.desde.id,
    cambio: paso.cambio,
    seMantiene: paso.seMantiene,
    patrones,
    aportePorcion: redondearParcial(paso.aporte),
  }
}

/**
 * v5.2 · ¿Se sugiere para esa comida? Sin momento, todo vale (el tablero de la semana). Con momento, solo lo que el
 * catálogo anota para esa comida (`momentos`); lo que no está en el catálogo o no está anotado no sale: mejor ninguna
 * sugerencia que la chocolatada para la cena. No se mapean comidas entre sí: el desayuno solo acepta lo anotado
 * `desayuno` (lo de merienda que va al desayuno ya lo dice su anotación).
 */
export function esParaMomento(prep: Pick<PreparacionCatalogo, 'momentos'> | undefined, momento?: Momento): boolean {
  return !momento || (prep?.momentos?.includes(momento) ?? false)
}

/**
 * Con `variedad` (v5.5, no falta ningún nutriente y no se pidió uno): la segura y el pasito siguen con el nutriente de
 * menor cobertura, y la "más nutritiva" pasa a ser la que suma variedad: entre los candidatos a un cambio de cualquier
 * nutriente (todos aportan al menos el 15% de alguno), la de más puntaje del grupo que menos come; si no hay de ese
 * grupo, o come de todos, la de más puntaje que no sea el pasito. El tipo sigue siendo mas_nutritiva (la pantalla lo usa).
 */
export function recomendar(e: EntradaRecomendador, motor: Motor = 'grafo', nutrienteElegido?: Nutriente): Recomendacion {
  const nutriente = nutrienteElegido ?? e.faltan[0] ?? menorCobertura(e.coberturaSemana)
  const variedad = nutrienteElegido ? undefined : e.variedad
  const puntuar1 = puntuador(e, motor)
  const puntuar = (n: Nutriente): Puntuado[] =>
    candidatosCadena(e, n)
      .filter((paso) => esParaMomento(paso.cand, e.momento))
      .map((paso) => ({ paso, ...puntuar1(paso.cand, paso.cambio) }))
      .sort((a, b) => b.puntaje - a.puntaje || a.paso.cand.id.localeCompare(b.paso.cand.id))
  const lista = puntuar(nutriente)
  const sugerencias: Sugerencia[] = []

  // Va a gustarle (explotar)
  const segura = sugerenciaSegura(e, nutriente)
  if (segura) sugerencias.push(segura)

  // Un pasito (explorar con sentido): la exposición en curso sigue igual; si no hay, el mejor candidato
  let unPaso: { x: Puntuado; n: Nutriente; enCurso: boolean } | null = null
  for (const n of [nutriente, ...e.faltan.filter((f) => f !== nutriente)]) {
    const x = (n === nutriente ? lista : puntuar(n)).find((c) => enCurso(e, c.paso.cand.id))
    if (x) {
      unPaso = { x, n, enCurso: true }
      break
    }
  }
  if (!unPaso && lista[0]) unPaso = { x: lista[0], n: nutriente, enCurso: false }
  if (unPaso) sugerencias.push(sugerenciaPaso('un_paso', unPaso.x, unPaso.n, unPaso.enCurso, e))

  // v5.5 · Modo variedad: los candidatos a un cambio de cualquier nutriente, una vez cada uno, primero los del grupo que menos come
  const variadas = variedad ? candidatosVariedad(puntuar, variedad) : []

  if (variedad) {
    // Más variada (v5.5): la de más puntaje del grupo que menos come; si no hay, cualquier cosa nueva a un cambio
    const sinPaso = variadas.filter((c) => c.paso.cand.id !== unPaso?.x.paso.cand.id)
    const delGrupo = sinPaso.find((c) => c.paso.cand.atributos.grupo === variedad.grupo)
    const x = delGrupo ?? sinPaso[0]
    if (x) sugerencias.push(sugerenciaPaso('mas_nutritiva', x, nutriente, false, e, delGrupo ? variedad : {}))
  } else {
    // Más nutritiva: la que más aporta al nutriente que más falta, aunque tenga menos puntaje
    const masNutritiva = lista
      .filter((c) => c.paso.cand.id !== unPaso?.x.paso.cand.id)
      .sort((a, b) => b.paso.aporte[nutriente] - a.paso.aporte[nutriente] || b.puntaje - a.puntaje)[0]
    if (masNutritiva) sugerencias.push(sugerenciaPaso('mas_nutritiva', masNutritiva, nutriente, false, e))
  }

  const rec: Recomendacion = { motor, nutriente, candidatos: lista.map(aCandidato), sugerencias, ...(variedad ? { variedad } : {}) }
  if (!e.momento) return rec
  // v5.4 · Las ideas de "Generar receta": los candidatos de cada nutriente que falta, sin lo que está en exposición
  // (eso lo repite la tarjeta de la próxima comida, a propósito; acá el padre busca ideas nuevas). v5.5 · En modo
  // variedad, las variadas (primero las del grupo que menos come).
  const enExposicion = e.catalogo.filter((p) => enCurso(e, p.id))
  const porNutriente = variedad
    ? [{ n: nutriente, lista: variadas }]
    : [nutriente, ...e.faltan.filter((f) => f !== nutriente)].map((n) => ({ n, lista: n === nutriente ? lista : puntuar(n) }))
  return { ...rec, ideas: ideasReceta(porNutriente, enExposicion, (id) => enCurso(e, id)) }
}

/** v5.5 · Los candidatos a un cambio de todos los nutrientes con meta, sin repetir, por puntaje; los del grupo pedido primero. */
function candidatosVariedad(puntuar: (n: Nutriente) => Puntuado[], variedad: Variedad): Puntuado[] {
  const vistos = new Set<string>()
  const todos = CON_META.flatMap(puntuar).filter((c) => !vistos.has(c.paso.cand.id) && Boolean(vistos.add(c.paso.cand.id)))
  const delGrupo = (c: Puntuado) => Number(c.paso.cand.atributos.grupo === variedad.grupo)
  return todos.sort((a, b) => delGrupo(b) - delGrupo(a) || b.puntaje - a.puntaje || a.paso.cand.id.localeCompare(b.paso.cand.id))
}

/** ¿Está en exposición? En proceso, ofrecido al menos una vez y todavía sin las 10 exposiciones (§8). */
function enCurso(e: EntradaRecomendador, id: string): boolean {
  const s = e.estados.get(id)
  return s?.estado === 'en_proceso' && s.veces >= 1 && s.veces < MAX_EXPOSICIONES_MISMO
}

/** Mismo ingrediente principal y misma forma: para el padre es "lo mismo otra vez" (bastones de queso al horno o fritos). */
const pareceA = (a: PreparacionCatalogo, b: PreparacionCatalogo) =>
  a.atributos.forma === b.atributos.forma && principal(a.ingredientes) !== null && principal(a.ingredientes) === principal(b.ingredientes)

/**
 * v5.4 · Una de cada nutriente por vuelta (el mejor puntaje de cada uno): si se tomara la lista entera del primer
 * nutriente, "Generar receta" daría todas las de calcio (bastones de queso, pizza…) seguidas. Cada preparación sale una
 * sola vez, con el primer nutriente que la trajo. Lo que está en exposición no sale, y lo que se le parece (o se parece
 * a una idea anterior) va al final: en la demo no tiene que parecer que se repite.
 */
function ideasReceta(
  porNutriente: readonly { n: Nutriente; lista: readonly Puntuado[] }[], enExposicion: readonly PreparacionCatalogo[], excluir: (id: string) => boolean,
): IdeaReceta[] {
  const vistas = new Set<string>()
  const ideas: PreparacionCatalogo[] = []
  const parecidas: PreparacionCatalogo[] = []
  const nutrienteDe = new Map<string, Nutriente>()
  const largo = Math.max(0, ...porNutriente.map((x) => x.lista.length))
  for (let k = 0; k < largo; k++) {
    for (const { n, lista } of porNutriente) {
      const c = lista[k]?.paso.cand
      if (!c || vistas.has(c.id) || excluir(c.id)) continue
      vistas.add(c.id)
      nutrienteDe.set(c.id, n)
      if ([...enExposicion, ...ideas].some((x) => pareceA(x, c))) parecidas.push(c)
      else ideas.push(c)
    }
  }
  return [...ideas, ...parecidas].map((c) => ({ preparacionId: c.id, nombre: c.nombre, nutriente: nutrienteDe.get(c.id) ?? porNutriente[0]!.n }))
}

/**
 * Entre lo que acepta, la de mayor p × aporte al nutriente que más falta, salteando lo de la última comida del mismo
 * momento. Con momento, solo lo que va en esa comida (lo anotado en el catálogo o, si no es del catálogo, en lo que se
 * sabe de él). Nunca algo con sus alérgenos (o sin ingredientes conocidos, si tiene alergias).
 */
function sugerenciaSegura(e: EntradaRecomendador, n: Nutriente): Sugerencia | null {
  const evitar = new Set(e.evitarSegura ?? [])
  const delCatalogo = e.momento ? new Map(e.catalogo.map((p) => [p.id, p])) : null
  const opciones = [...e.estados.values()]
    .filter((s) => s.estado === 'acepta' && (!delCatalogo || esParaMomento(delCatalogo.get(s.prepId) ?? e.conocidas.get(s.prepId), e.momento)))
    .flatMap((s) => {
      const prep = e.conocidas.get(s.prepId)
      if (!esSegura(prep ?? { ingredientes: [] }, e.alergias, e.alimentos, e.prohibidos)) return []
      const ap = prep && prep.ingredientes.length ? aporte(prep.ingredientes, e.alimentos).nutrientes : cero()
      return [{ s, prep, ap, valor: s.p * (e.objetivo[n] > 0 ? ap[n] / e.objetivo[n] : 0) }]
    })
  const elegibles = opciones.some((o) => !evitar.has(o.s.prepId)) ? opciones.filter((o) => !evitar.has(o.s.prepId)) : opciones
  const mejor = elegibles.sort((a, b) => b.valor - a.valor || b.s.p - a.s.p || a.s.prepId.localeCompare(b.s.prepId))[0]
  if (!mejor) return null
  const s = mejor.s
  const partes = [s.veces > 0 ? `La come ${s.comio} de cada ${s.veces} ${s.veces === 1 ? 'vez' : 'veces'}` : 'Según contaste, la come seguido']
  if (mejor.valor > 0) partes.push(`aporta ${porciento(mejor.ap[n] / e.objetivo[n])} ${DEL_NUTRIENTE[n]} del día`)
  const grupo = mejor.prep?.atributos.grupo
  return {
    tipo: 'segura',
    preparacionId: s.prepId,
    nombre: mejor.prep?.nombre ?? s.nombre,
    probAcepta: redondear(s.p, 2),
    aporte: redondearParcial(mejor.ap),
    porQue: `${partes.join(' y ')}.`,
    ...(grupo ? { grupo } : {}),
  }
}

/** Con `variedad` (v5.5, solo mas_nutritiva): el porQué habla de la variedad que suma, no de un nutriente. */
function sugerenciaPaso(
  tipo: 'un_paso' | 'mas_nutritiva', x: Puntuado, n: Nutriente, enCurso: boolean, e: EntradaRecomendador, variedad?: Variedad,
): Sugerencia {
  const { paso } = x
  const estado = e.estados.get(paso.cand.id)
  const pct = e.objetivo[n] > 0 ? porciento(paso.aporte[n] / e.objetivo[n]) : ''
  const parecido =
    paso.cambio === 'fortificar'
      ? `Es ${su(paso.desde.nombre)} en versión fortificada: no cambia nada más.`
      : `Se parece a ${su(paso.desde.nombre)}: cambia solo ${TEXTO_CAMBIO[paso.cambio]}.`
  const partes =
    tipo === 'un_paso'
      ? [
          parecido,
          ...(enCurso && estado
            ? [`Ya se lo ofreciste ${estado.veces} ${estado.veces === 1 ? 'vez' : 'veces'}: seguí igual, sin pedirle que lo coma.`]
            : []),
          ...(pct ? [`Aporta ${pct} ${DEL_NUTRIENTE[n]} del día.`] : []),
        ]
      : variedad
        ? [
            variedad.grupo
              ? `No le falta ningún nutriente clave esta semana: esta suma variedad, porque ${sinComer(variedad.grupo, variedad.diasSinComer)}.`
              : 'No le falta ningún nutriente clave esta semana: esta suma variedad, algo nuevo a un solo cambio de lo que ya come.',
            parecido,
          ]
        : [`Es la que más ${NOMBRE_NUTRIENTE[n]} aporta: ${pct} de lo que necesita por día.`, parecido]
  return {
    tipo,
    preparacionId: paso.cand.id,
    nombre: paso.cand.nombre,
    probAcepta: redondear(estado && estado.veces >= 3 ? estado.p : logistica(x.puntaje), 2),
    aporte: redondearParcial(paso.aporte),
    porQue: partes.join(' '),
    candidato: aCandidato(x),
    grupo: paso.cand.atributos.grupo,
    ...(variedad ? { objetivo: { tipo: 'variedad' as const, ...variedad } } : {}),
  }
}
