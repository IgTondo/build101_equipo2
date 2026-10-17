// Patrones combinados (PLAN.md §8): combinaciones de hasta 3 condiciones con su n, su media y la media del resto.
// También combina lo aprendido con los patrones de investigación (§10.2), que los datos confirman o borran.
import { leerJSON } from '../datos/archivos.js'
import { type Condicion, type Observacion, claveCondicion, condicionesDe, cumple, esAtributo } from './condiciones.js'
import { comio, noComio } from './escalera.js'
import { textoPatron } from './textos.js'

export const CONFIG_PATRONES = {
  minN: 3,
  umbralAcepta: 0.75,
  umbralRechaza: 0.25,
  minDiferencia: 0.2, // contra la media del RESTO (v4), no contra la global
  minMejora: 0.1, // una combinación más larga tiene que mejorar a las más cortas que contiene
  maxCondiciones: 3,
  maxPatrones: 12, // los que se muestran, guardan y usa el recomendador: hasta la mitad de cada lado (acepta / rechaza)
  minExposicionesPrep: 0, // > 0: saca de la minería las preparaciones con menos exposiciones (§10.5, nota para B)
}
export type ConfigPatrones = typeof CONFIG_PATRONES

/** Tolerancia para comparar medias: 0,9 − 0,8 da 0,0999… en punto flotante. */
const EPS = 1e-9

export interface Patron {
  clave: string // "textura=crocante ∧ presentacion=separado → acepta"
  condiciones: Condicion[]
  resultado: 'acepta' | 'rechaza'
  n: number
  media: number
  mediaResto: number
  aFavor: number // observaciones que van en el sentido del patrón: el "5" de "(5 de 5)"
  confianza: number // de 0 a 1
  fuente: 'aprendido' | 'investigacion'
  texto: string
  evidencia?: string
  cubre: number[] // índices de las observaciones que cumplen las condiciones
}

export interface PatronInvestigacion {
  condiciones: Condicion[]
  resultado: 'acepta' | 'rechaza'
  confianza: number
  evidencia: string
}

/** Orden de las condiciones: el research pide más peso para textura, mezcla y forma. */
const PRIORIDAD: readonly string[] = [
  'textura', 'presentacion', 'forma', 'color', 'sabor', 'coccion', 'temperatura', 'grupo',
  'distribucion', 'plato', 'juntoASeguro', 'momento',
]
const ordenCondicion = (a: Condicion, b: Condicion) =>
  PRIORIDAD.indexOf(a.tipo) - PRIORIDAD.indexOf(b.tipo) || a.valor.localeCompare(b.valor)
const claveCombo = (condiciones: readonly Condicion[]) => [...condiciones].sort(ordenCondicion).map(claveCondicion).join(' ∧ ')
export const clavePatron = (condiciones: readonly Condicion[], resultado: string) => `${claveCombo(condiciones)} → ${resultado}`

/** Más n y más lejos de 0,5 primero (§8: n·|media − 0,5|). */
const relevancia = (p: Pick<Patron, 'n' | 'media'>) => p.n * Math.abs(p.media - 0.5)
const confianzaDe = (media: number, n: number) => (Math.abs(media - 0.5) / 0.5) * (n / (n + 3))

function* combinaciones<T>(xs: readonly T[], max: number, desde = 0, actual: T[] = []): Generator<T[]> {
  for (let i = desde; i < xs.length; i++) {
    const siguiente = [...actual, xs[i] as T]
    yield siguiente
    if (siguiente.length < max) yield* combinaciones(xs, max, i + 1, siguiente)
  }
}

const subconjuntosPropios = <T>(xs: readonly T[]): T[][] => [...combinaciones(xs, xs.length - 1)]
const media = (os: readonly number[]) => (os.length ? os.reduce((s, x) => s + x, 0) / os.length : Number.NaN)

/** ¿Las observaciones de la combinación pasan los umbrales de §8 en la dirección del resultado? */
function evaluar(sub: readonly Observacion[], todas: readonly Observacion[], cfg: ConfigPatrones) {
  const n = sub.length
  const m = media(sub.map((x) => x.o))
  const total = todas.reduce((s, x) => s + x.o, 0)
  const mResto = todas.length > n ? (total - m * n) / (todas.length - n) : Number.NaN
  let resultado: 'acepta' | 'rechaza' | null = null
  if (n >= cfg.minN && todas.length > n) {
    if (m >= cfg.umbralAcepta - EPS && m - mResto >= cfg.minDiferencia - EPS) resultado = 'acepta'
    else if (m <= cfg.umbralRechaza + EPS && mResto - m >= cfg.minDiferencia - EPS) resultado = 'rechaza'
  }
  return { n, media: m, mediaResto: mResto, resultado }
}

/**
 * Un patrón con condiciones de contexto (plato, distribución, momento, junto a un seguro) solo vale si el efecto
 * aparece DENTRO de las mismas preparaciones: la misma comida, con y sin ese contexto. Si no, es un artefacto de qué
 * se sirvió (con chicos selectivos, "la merienda" es siempre la leche chocolatada).
 */
function efectoDeContexto(condiciones: readonly Condicion[], resultado: 'acepta' | 'rechaza', obs: readonly Observacion[], cfg: ConfigPatrones): boolean {
  const contexto = condiciones.filter((c) => !esAtributo(c.tipo))
  if (!contexto.length) return true
  const atributos = condiciones.filter((c) => esAtributo(c.tipo))
  const porPrep = new Map<string, { dentro: number[]; fuera: number[] }>()
  for (const x of obs) {
    if (!cumple(atributos, x.atributos)) continue
    const g = porPrep.get(x.prepId) ?? { dentro: [], fuera: [] }
    if (cumple(contexto, {}, x.contexto)) g.dentro.push(x.o)
    else g.fuera.push(x.o)
    porPrep.set(x.prepId, g)
  }
  // Diferencia dentro de cada preparación que aparece con y sin el contexto, ponderada por sus observaciones con contexto
  let n = 0
  let suma = 0
  for (const g of porPrep.values()) {
    if (!g.dentro.length || !g.fuera.length) continue
    n += g.dentro.length
    suma += g.dentro.length * (media(g.dentro) - media(g.fuera))
  }
  if (n < cfg.minN) return false
  const d = suma / n
  return resultado === 'acepta' ? d >= cfg.minDiferencia - EPS : -d >= cfg.minDiferencia - EPS
}

const aFavorDe = (sub: readonly Observacion[], resultado: 'acepta' | 'rechaza') =>
  sub.filter((x) => (resultado === 'acepta' ? comio(x.cuanto) : noComio(x.cuanto))).length

/**
 * Minería de patrones: todas las combinaciones de 1 a 3 condiciones (atributos + contexto). Queda la que tiene
 * n ≥ 3, media ≥ 0,75 (acepta) o ≤ 0,25 (rechaza) y se aleja al menos 0,2 de la media del resto. Se poda la que
 * no mejora en 0,1 a una sub-combinación que también pasa, y entre las que cubren exactamente las mismas
 * observaciones queda la más simple. Devuelve TODAS las que pasan, ordenadas por n·|media − 0,5|: cuáles se muestran
 * lo decide `seleccionarPatrones`.
 */
export function minarPatrones(observaciones: readonly Observacion[], cfg: ConfigPatrones = CONFIG_PATRONES): Patron[] {
  let indices = observaciones.map((_, i) => i)
  if (cfg.minExposicionesPrep > 0) {
    const veces = new Map<string, number>()
    for (const x of observaciones) veces.set(x.prepId, (veces.get(x.prepId) ?? 0) + 1)
    indices = indices.filter((i) => (veces.get(observaciones[i]?.prepId ?? '') ?? 0) >= cfg.minExposicionesPrep)
  }
  const obs = indices.map((i) => observaciones[i] as Observacion)
  const grupos = new Map<string, { condiciones: Condicion[]; idx: number[] }>()
  obs.forEach((x, i) => {
    const condiciones = condicionesDe(x.atributos, x.contexto).sort(ordenCondicion)
    for (const combo of combinaciones(condiciones, cfg.maxCondiciones)) {
      const k = combo.map(claveCondicion).join(' ∧ ')
      const g = grupos.get(k) ?? { condiciones: combo, idx: [] }
      g.idx.push(i)
      grupos.set(k, g)
    }
  })

  // 1. Umbrales, y el contexto tiene que mostrar su efecto dentro de las mismas preparaciones
  const pasan = new Map<string, Patron>()
  for (const [k, g] of grupos) {
    if (g.idx.length < cfg.minN) continue
    const sub = g.idx.map((i) => obs[i] as Observacion)
    const ev = evaluar(sub, obs, cfg)
    if (!ev.resultado || !efectoDeContexto(g.condiciones, ev.resultado, obs, cfg)) continue
    const aFavor = aFavorDe(sub, ev.resultado)
    pasan.set(k, {
      clave: `${k} → ${ev.resultado}`, condiciones: g.condiciones, resultado: ev.resultado,
      n: ev.n, media: ev.media, mediaResto: ev.mediaResto, aFavor, confianza: confianzaDe(ev.media, ev.n),
      fuente: 'aprendido', texto: textoPatron(g.condiciones, ev.resultado, aFavor, ev.n),
      cubre: g.idx.map((i) => indices[i] as number),
    })
  }

  // 2. Poda (§8): las de 3 condiciones que no mejoran en 0,1 a una sub-combinación de 2 que también pasa. Las de 2 no
  //    se podan contra las de 1 (las de 1 las sumamos para encontrar reglas simples como "blando → rechaza"): así
  //    sobrevive "verde ∧ puré → acepta" aunque "puré → acepta" ya lo explique casi todo. La vista saca los redundantes.
  const podados = [...pasan.values()].filter((p) => {
    if (p.condiciones.length < 3) return true
    return subconjuntosPropios(p.condiciones)
      .filter((sub) => sub.length === p.condiciones.length - 1)
      .every((sub) => {
        const s = pasan.get(sub.map(claveCondicion).join(' ∧ '))
        return !s || s.resultado !== p.resultado || Math.abs(p.media - s.media) >= cfg.minMejora - EPS
      })
  })

  // 3. Equivalentes: misma cobertura y mismo resultado → la de menos condiciones (y, a igualdad, la de atributos más importantes)
  const prioridades = (p: Patron) => p.condiciones.map((c) => String(PRIORIDAD.indexOf(c.tipo)).padStart(2, '0')).join(',')
  const preferible = (a: Patron, b: Patron) =>
    a.condiciones.length - b.condiciones.length || prioridades(a).localeCompare(prioridades(b)) || a.clave.localeCompare(b.clave)
  const porCobertura = new Map<string, Patron>()
  for (const p of podados) {
    const k = `${p.cubre.join(',')}|${p.resultado}`
    const otro = porCobertura.get(k)
    if (!otro || preferible(p, otro) < 0) porCobertura.set(k, p)
  }

  return [...porCobertura.values()].sort((a, b) => relevancia(b) - relevancia(a) || a.clave.localeCompare(b.clave))
}

/**
 * Los que se muestran (y usa el recomendador): por relevancia, hasta la mitad de cada lado para que "lo que rechaza"
 * no quede tapado por lo que más come, y sin redundantes (todas sus observaciones ya cubiertas por uno elegido del
 * mismo lado, con una media que no se aleja ni 0,1: "en trozos" no suma nada al lado de "blando").
 */
export function seleccionarPatrones(patrones: readonly Patron[], max: number, cfg: ConfigPatrones = CONFIG_PATRONES): Patron[] {
  const elegidos: Patron[] = []
  const redundante = (p: Patron) =>
    elegidos.some((q) => {
      if (q.resultado !== p.resultado) return false
      const enQ = new Set(q.cubre)
      return p.cubre.every((i) => enQ.has(i)) && Math.abs(p.media - q.media) < cfg.minMejora - EPS
    })
  const porLado = Math.ceil(max / 2)
  const cuenta = { acepta: 0, rechaza: 0 }
  for (const p of patrones) {
    if (elegidos.length >= max) break
    if (cuenta[p.resultado] >= porLado || redundante(p)) continue
    elegidos.push(p)
    cuenta[p.resultado]++
  }
  for (const p of patrones) {
    if (elegidos.length >= max) break
    if (!elegidos.includes(p) && !redundante(p)) elegidos.push(p)
  }
  return elegidos
}

export function patronesInvestigacion(): PatronInvestigacion[] {
  return leerJSON<{ patrones: PatronInvestigacion[] }>('data/patrones-investigacion.json')?.patrones ?? []
}

export interface Combinados {
  vigentes: Patron[] // los que se usan y se muestran: lo aprendido elegido + lo de investigación que sigue en pie
  confirmados: Patron[] // de investigación, confirmados por los datos del chico
  borrados: Patron[] // de investigación, contradichos por los datos del chico
}

/**
 * Los patrones de investigación arrancan con confianza baja. Si los datos del chico los cumplen (umbrales de §8),
 * se confirman; si con n ≥ 3 van para el otro lado de 0,5, se borran; si no, siguen como "según la investigación".
 */
export function combinarConInvestigacion(
  aprendidos: readonly Patron[],
  investigacion: readonly PatronInvestigacion[],
  observaciones: readonly Observacion[],
  cfg: ConfigPatrones = CONFIG_PATRONES,
): Combinados {
  const mostrados = seleccionarPatrones(aprendidos, cfg.maxPatrones, cfg)
  const vigentes: Patron[] = [...mostrados]
  const confirmados: Patron[] = []
  const borrados: Patron[] = []
  for (const r of investigacion) {
    const condiciones = [...r.condiciones].sort(ordenCondicion)
    const cubre = observaciones.flatMap((x, i) => (cumple(condiciones, x.atributos, x.contexto) ? [i] : []))
    const sub = cubre.map((i) => observaciones[i] as Observacion)
    const ev = evaluar(sub, observaciones, cfg)
    const patron: Patron = {
      clave: clavePatron(condiciones, r.resultado), condiciones, resultado: r.resultado,
      n: ev.n, media: ev.n ? ev.media : 0.5, mediaResto: ev.mediaResto, aFavor: aFavorDe(sub, r.resultado),
      confianza: r.confianza, fuente: 'investigacion', texto: `${textoPatron(condiciones, r.resultado)} (según la investigación)`,
      evidencia: r.evidencia, cubre,
    }
    if (ev.resultado === r.resultado && efectoDeContexto(condiciones, r.resultado, observaciones, cfg)) {
      confirmados.push(patron)
      // Si ningún patrón aprendido que se muestra ya lo explica (mismas condiciones o menos), entra como aprendido
      const explicado = mostrados.some(
        (q) => q.resultado === r.resultado && q.condiciones.every((c) => condiciones.some((d) => claveCondicion(d) === claveCondicion(c))),
      )
      if (!explicado) {
        vigentes.push({
          ...patron, fuente: 'aprendido', confianza: Math.max(r.confianza, confianzaDe(ev.media, ev.n)),
          texto: textoPatron(condiciones, r.resultado, patron.aFavor, ev.n),
        })
      }
    } else if (ev.n >= cfg.minN && (r.resultado === 'acepta' ? ev.media < 0.5 : ev.media > 0.5)) {
      borrados.push(patron)
    } else {
      vigentes.push(patron)
    }
  }
  return { vigentes, confirmados, borrados }
}
