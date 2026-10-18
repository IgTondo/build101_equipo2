// Nutrición por código (PLAN.md §1 y §5.1): gramos × fracción comida × tabla por 100 g. Funciones puras.
import type { Alimento, ItemDetectado, Nutriente, Nutrientes, Porcion, Rango } from '../../shared/contratos.js'
import { NUTRIENTE } from '../../shared/contratos.js'
import { FACTOR_PORCION } from '../aprendizaje/escalera.js'
import { CON_META } from './objetivos.js'

/** Error medio de los gramos estimados desde una foto (§5.1): el rango mostrado es ±35%. */
export const ERROR_GRAMOS = 0.35
/** Por debajo de esta cobertura semanal, el nutriente "falta" (§1). */
export const UMBRAL_FALTA = 0.7
/** Por debajo de esta cobertura semanal de vitamina C, "casi no hay ninguna fuente" (§1 y §10.4). */
export const UMBRAL_SIN_VITAMINA_C = 0.3

export const cero = (): Nutrientes => Object.fromEntries(NUTRIENTE.map((n) => [n, 0])) as Nutrientes

export function sumar(...partes: Partial<Nutrientes>[]): Nutrientes {
  const total = cero()
  for (const p of partes) for (const n of NUTRIENTE) total[n] += p[n] ?? 0
  return total
}

export function escalar(valor: Partial<Nutrientes>, k: number): Nutrientes {
  const r = cero()
  for (const n of NUTRIENTE) r[n] = (valor[n] ?? 0) * k
  return r
}

export function rango(valor: Nutrientes, error = ERROR_GRAMOS): Rango {
  return { valor, min: escalar(valor, 1 - error), max: escalar(valor, 1 + error) }
}

export function sumarRangos(rangos: Rango[]): Rango {
  return {
    valor: sumar(...rangos.map((r) => r.valor)),
    min: sumar(...rangos.map((r) => r.min)),
    max: sumar(...rangos.map((r) => r.max)),
  }
}

/**
 * Nutrientes de una lista de ingredientes en gramos. Lo que no está en la tabla, o todavía no tiene valores (A3 sube
 * primero los ids), cuenta 0 y vuelve en `sinDatos`.
 */
export function aporte(
  ingredientes: { alimentoId: string; gramos: number }[],
  alimentos: ReadonlyMap<string, Alimento>,
): { nutrientes: Nutrientes; sinDatos: string[] } {
  const nutrientes = cero()
  const sinDatos: string[] = []
  for (const { alimentoId, gramos } of ingredientes) {
    const por100g = alimentos.get(alimentoId)?.por100g
    if (!por100g) {
      sinDatos.push(alimentoId)
      continue
    }
    for (const n of NUTRIENTE) nutrientes[n] += ((por100g[n] ?? 0) * gramos) / 100
  }
  return { nutrientes, sinDatos }
}

const normalizar = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]+/g, ' ').trim()

/**
 * Gramos servidos de cada ingrediente. Si la visión contó unidades ("6 nuggets") y el ingrediente principal tiene
 * ese peso por unidad (FNDDS), manda el conteo. Si el padre corrigió la porción:
 * gramos = gramosEst × factor(padre) / factor(visión).
 */
export function gramosServidos(
  item: Pick<ItemDetectado, 'ingredientes' | 'porcion' | 'conteo'>,
  porcionPadre: Porcion,
  alimentos: ReadonlyMap<string, Alimento>,
): { alimentoId: string; gramos: number }[] {
  const correccion = FACTOR_PORCION[porcionPadre] / FACTOR_PORCION[item.porcion]
  let porConteo = 1
  const principal = [...item.ingredientes].sort((a, b) => b.gramosEst - a.gramosEst)[0]
  if (item.conteo && item.conteo.cantidad > 0 && principal && principal.gramosEst > 0) {
    const unidad = normalizar(item.conteo.unidad)
    const peso = alimentos.get(principal.alimentoId)?.porciones?.find((p) => {
      const d = normalizar(p.descripcion)
      return unidad.length > 0 && (d.includes(unidad) || unidad.includes(d))
    })
    if (peso) porConteo = (item.conteo.cantidad * peso.gramos) / principal.gramosEst
  }
  return item.ingredientes.map(({ alimentoId, gramosEst }) => ({ alimentoId, gramos: gramosEst * porConteo * correccion }))
}

/** consumido ÷ objetivo para los 8 nutrientes con meta. Puede pasar de 1. La energía queda en 0: no tiene meta. */
export function cobertura(consumido: Nutrientes, objetivo: Nutrientes): Nutrientes {
  const c = cero()
  for (const n of CON_META) c[n] = objetivo[n] > 0 ? consumido[n] / objetivo[n] : 0
  return c
}

/** Del día: los que no llegan al 100%, de menor a mayor cobertura, sin energía. */
export function faltanDia(cob: Nutrientes): Nutriente[] {
  return CON_META.filter((n) => cob[n] < 1).sort((a, b) => cob[a] - cob[b])
}

/**
 * De la semana (§1): entre los que están por debajo del 70%, en el orden de gravedad del research.
 * Vitamina C primero si casi no hay ninguna fuente (escorbuto) → calcio y vitamina D → hierro → fibra → omega-3
 * → (vitamina C, si hay alguna fuente) → B12 y proteína.
 */
export function faltanSemana(cob: Nutrientes): Nutriente[] {
  const sinFuenteC = cob.vitamina_c_mg < UMBRAL_SIN_VITAMINA_C
  const orden: Nutriente[] = [
    ...(sinFuenteC ? (['vitamina_c_mg'] as const) : []),
    'calcio_mg', 'vitamina_d_ug', 'hierro_mg', 'fibra_g', 'omega3_g',
    ...(sinFuenteC ? [] : (['vitamina_c_mg'] as const)),
    'b12_ug', 'proteina_g',
  ]
  return orden.filter((n) => cob[n] < UMBRAL_FALTA)
}

// ---------- Redondeo para las respuestas (los cálculos usan los valores completos) ----------
const DECIMALES: Record<Nutriente, number> = {
  energia_kcal: 0, proteina_g: 1, calcio_mg: 0, vitamina_d_ug: 2, hierro_mg: 2, fibra_g: 1, omega3_g: 2, b12_ug: 2, vitamina_c_mg: 1,
}
const fijar = (x: number, d: number) => Math.round(x * 10 ** d) / 10 ** d

export function redondear(n: Nutrientes): Nutrientes {
  const r = cero()
  for (const x of NUTRIENTE) r[x] = fijar(n[x], DECIMALES[x])
  return r
}

export function redondearParcial(n: Partial<Nutrientes>): Partial<Nutrientes> {
  const r: Partial<Nutrientes> = {}
  for (const x of NUTRIENTE) {
    const v = n[x]
    if (v !== undefined) r[x] = fijar(v, DECIMALES[x])
  }
  return r
}

export const redondearRango = (r: Rango): Rango => ({ valor: redondear(r.valor), min: redondear(r.min), max: redondear(r.max) })

export function redondearCobertura(c: Nutrientes): Nutrientes {
  const r = cero()
  for (const x of NUTRIENTE) r[x] = fijar(c[x], 3)
  return r
}
