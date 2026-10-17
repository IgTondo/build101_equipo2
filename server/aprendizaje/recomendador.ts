// Recomendador enchufable (PLAN.md §4.3 y §8): `grafo` (propagación + patrones, el de producción) o `base`
// (α/β por atributo, la misma base de la curva de §11.4). Los dos usan los mismos candidatos de cadena.ts.
import type { Cambio, Candidato, Motor, Nutriente, Nutrientes, PreparacionCatalogo, Sugerencia } from '../../shared/contratos.js'
import { aporte, cero, redondearParcial } from '../nutricion/calcular.js'
import { CON_META } from '../nutricion/objetivos.js'
import { alfaBeta, pAtributos } from './aceptacion.js'
import { type EntradaCadena, type PasoCadena, DIFICULTAD, candidatosCadena } from './cadena.js'
import { type Contexto, type Observacion, cumple } from './condiciones.js'
import type { Patron } from './patrones.js'
import { importanciaPorTipo, propagar } from './propagacion.js'
import { DEL_NUTRIENTE, NOMBRE_NUTRIENTE, TEXTO_CAMBIO, porciento, su } from './textos.js'

export interface EntradaRecomendador extends EntradaCadena {
  observaciones: readonly Observacion[]
  patrones: readonly Patron[] // los vigentes (aprendidos + investigación)
  faltan: readonly Nutriente[] // en el orden de prioridad de §1
  coberturaSemana: Nutrientes
  evitarSegura?: readonly string[] // lo que se sirvió en la última comida del mismo momento: no repetir el mismo tema
}

export interface Recomendacion {
  motor: Motor
  nutriente: Nutriente
  candidatos: Candidato[]
  sugerencias: Sugerencia[] // siempre en el orden segura, un_paso, mas_nutritiva
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

export function recomendar(e: EntradaRecomendador, motor: Motor = 'grafo', nutrienteElegido?: Nutriente): Recomendacion {
  const nutriente = nutrienteElegido ?? e.faltan[0] ?? menorCobertura(e.coberturaSemana)
  const puntuar1 = puntuador(e, motor)
  const puntuar = (n: Nutriente): Puntuado[] =>
    candidatosCadena(e, n)
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
    const x = (n === nutriente ? lista : puntuar(n)).find((c) => {
      const s = e.estados.get(c.paso.cand.id)
      return s?.estado === 'en_proceso' && s.veces >= 1 && s.veces < MAX_EXPOSICIONES_MISMO
    })
    if (x) {
      unPaso = { x, n, enCurso: true }
      break
    }
  }
  if (!unPaso && lista[0]) unPaso = { x: lista[0], n: nutriente, enCurso: false }
  if (unPaso) sugerencias.push(sugerenciaPaso('un_paso', unPaso.x, unPaso.n, unPaso.enCurso, e))

  // Más nutritiva: la que más aporta al nutriente que más falta, aunque tenga menos puntaje
  const masNutritiva = lista
    .filter((c) => c.paso.cand.id !== unPaso?.x.paso.cand.id)
    .sort((a, b) => b.paso.aporte[nutriente] - a.paso.aporte[nutriente] || b.puntaje - a.puntaje)[0]
  if (masNutritiva) sugerencias.push(sugerenciaPaso('mas_nutritiva', masNutritiva, nutriente, false, e))

  return { motor, nutriente, candidatos: lista.map(aCandidato), sugerencias }
}

/** Entre lo que acepta, la de mayor p × aporte al nutriente que más falta, salteando lo de la última comida del mismo momento. */
function sugerenciaSegura(e: EntradaRecomendador, n: Nutriente): Sugerencia | null {
  const evitar = new Set(e.evitarSegura ?? [])
  const opciones = [...e.estados.values()]
    .filter((s) => s.estado === 'acepta')
    .map((s) => {
      const prep = e.conocidas.get(s.prepId)
      const ap = prep && prep.ingredientes.length ? aporte(prep.ingredientes, e.alimentos).nutrientes : cero()
      return { s, prep, ap, valor: s.p * (e.objetivo[n] > 0 ? ap[n] / e.objetivo[n] : 0) }
    })
  const elegibles = opciones.some((o) => !evitar.has(o.s.prepId)) ? opciones.filter((o) => !evitar.has(o.s.prepId)) : opciones
  const mejor = elegibles.sort((a, b) => b.valor - a.valor || b.s.p - a.s.p || a.s.prepId.localeCompare(b.s.prepId))[0]
  if (!mejor) return null
  const s = mejor.s
  const partes = [s.veces > 0 ? `La come ${s.comio} de cada ${s.veces} ${s.veces === 1 ? 'vez' : 'veces'}` : 'Según contaste, la come seguido']
  if (mejor.valor > 0) partes.push(`aporta ${porciento(mejor.ap[n] / e.objetivo[n])} ${DEL_NUTRIENTE[n]} del día`)
  return {
    tipo: 'segura',
    preparacionId: s.prepId,
    nombre: mejor.prep?.nombre ?? s.nombre,
    probAcepta: redondear(s.p, 2),
    aporte: redondearParcial(mejor.ap),
    porQue: `${partes.join(' y ')}.`,
  }
}

function sugerenciaPaso(tipo: 'un_paso' | 'mas_nutritiva', x: Puntuado, n: Nutriente, enCurso: boolean, e: EntradaRecomendador): Sugerencia {
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
      : [`Es la que más ${NOMBRE_NUTRIENTE[n]} aporta: ${pct} de lo que necesita por día.`, parecido]
  return {
    tipo,
    preparacionId: paso.cand.id,
    nombre: paso.cand.nombre,
    probAcepta: redondear(estado && estado.veces >= 3 ? estado.p : logistica(x.puntaje), 2),
    aporte: redondearParcial(paso.aporte),
    porQue: partes.join(' '),
    candidato: aCandidato(x),
  }
}
