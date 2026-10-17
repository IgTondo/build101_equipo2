// Propagación (PLAN.md §8): PageRank personalizado sobre el grafo bipartito Preparación ↔ Atributo.
// Parte de lo que el chico acepta, camina por los atributos compartidos y le da puntaje a lo que nunca probó.
// Los rechazos restan. Es food chaining hecho algoritmo, en memoria y sin librerías.
import type { Atributos } from '../../shared/contratos.js'
import { type Condicion, type TipoAtributo, TIPOS_ATRIBUTO, esAtributo } from './condiciones.js'

export const CONFIG_PROPAGACION = { iteraciones: 20, reinicio: 0.15, pesoNegativo: 0.5 }

export interface NodoPreparacion {
  id: string
  atributos: Partial<Atributos>
}

/** Importancia de cada tipo de atributo según los patrones que lo usan (suma de confianzas, hasta 1). */
export function importanciaPorTipo(patrones: readonly { condiciones: readonly Condicion[]; confianza: number }[]): Partial<Record<TipoAtributo, number>> {
  const imp: Partial<Record<TipoAtributo, number>> = {}
  for (const p of patrones) {
    for (const tipo of new Set(p.condiciones.map((c) => c.tipo))) {
      if (esAtributo(tipo)) imp[tipo] = Math.min(1, (imp[tipo] ?? 0) + p.confianza)
    }
  }
  return imp
}

/**
 * Semilla positiva s(p) = max(0, puntaje − 0,5); negativa r(p) = max(0, 0,5 − puntaje). Arista con peso
 * 1 + importancia del tipo. 20 iteraciones de x ← 0,15·s + 0,85·W·x. Resultado: PPR(s) − 0,5·PPR(r), llevado a
 * [−1, 1] dividiendo por el máximo entre las preparaciones que no son semilla positiva (las candidatas).
 */
export function propagar(
  preparaciones: readonly NodoPreparacion[],
  puntajes: ReadonlyMap<string, number>,
  importancia: Partial<Record<TipoAtributo, number>> = {},
  cfg = CONFIG_PROPAGACION,
): Map<string, number> {
  const P = preparaciones.length
  const vecinos: { j: number; w: number }[][] = preparaciones.map(() => [])
  const idxAtributo = new Map<string, number>()
  preparaciones.forEach((prep, i) => {
    for (const tipo of TIPOS_ATRIBUTO) {
      const valor = prep.atributos[tipo]
      if (!valor) continue
      const k = `${tipo}:${valor}`
      let j = idxAtributo.get(k)
      if (j === undefined) {
        j = vecinos.length
        idxAtributo.set(k, j)
        vecinos.push([])
      }
      const w = 1 + (importancia[tipo] ?? 0)
      vecinos[i]?.push({ j, w })
      vecinos[j]?.push({ j: i, w })
    }
  })
  const N = vecinos.length
  const grado = vecinos.map((vs) => vs.reduce((s, v) => s + v.w, 0))

  const semilla = (f: (p: number) => number) => {
    const s = new Float64Array(N)
    preparaciones.forEach((prep, i) => {
      const p = puntajes.get(prep.id)
      if (p !== undefined) s[i] = Math.max(0, f(p))
    })
    const total = s.reduce((a, b) => a + b, 0)
    if (total > 0) for (let i = 0; i < N; i++) s[i] = (s[i] ?? 0) / total
    return { s, total }
  }

  const ppr = (s: Float64Array) => {
    let x = Float64Array.from(s)
    for (let it = 0; it < cfg.iteraciones; it++) {
      const y = new Float64Array(N)
      for (let u = 0; u < N; u++) {
        const xu = x[u] ?? 0
        const gu = grado[u] ?? 0
        if (xu === 0 || gu === 0) continue
        for (const { j, w } of vecinos[u] ?? []) y[j] = (y[j] ?? 0) + (xu * w) / gu
      }
      for (let k = 0; k < N; k++) y[k] = cfg.reinicio * (s[k] ?? 0) + (1 - cfg.reinicio) * (y[k] ?? 0)
      x = y
    }
    return x
  }

  const positiva = semilla((p) => p - 0.5)
  const negativa = semilla((p) => 0.5 - p)
  const ps = positiva.total > 0 ? ppr(positiva.s) : new Float64Array(N)
  const pr = negativa.total > 0 ? ppr(negativa.s) : new Float64Array(N)
  const bruto = Array.from({ length: P }, (_, i) => (ps[i] ?? 0) - cfg.pesoNegativo * (pr[i] ?? 0))
  let max = 0
  for (let i = 0; i < P; i++) if ((positiva.s[i] ?? 0) === 0) max = Math.max(max, Math.abs(bruto[i] ?? 0))
  return new Map(preparaciones.map((prep, i) => [prep.id, max > 0 ? (bruto[i] ?? 0) / max : 0]))
}
