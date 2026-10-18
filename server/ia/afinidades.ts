// v5.10 · Qué alimentos combinan entre sí: data/afinidades.json, que arma scripts/afinidades.ts con la co-ocurrencia
// en unas 50 mil recetas reales (Ahn et al. 2011, CC BY 4.0). La afinidad va de 0 (sin dato o no se usan juntos) a 1
// (van siempre juntos). Sirve para pesar el sorteo del ingrediente del foco por lo que combina con el alimento de
// partida y para darle al LLM combinaciones probadas. Cacheado, como catalogo.ts.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export interface ParAfinidad { a: string; b: string; n: number; afinidad: number } // n: en cuántas recetas van juntos
export interface Afinidades { fuente: string; licencia: string; generado: string; pares: ParAfinidad[] }
export interface Afin { alimentoId: string; afinidad: number; n: number }

let pares: ParAfinidad[] | null = null
let porId: Map<string, Map<string, Afin>> | null = null
let ordenados: Map<string, Afin[]> | null = null

/** Los pares del archivo (vercel.json → includeFiles). Sin el archivo, ninguno: todo da 0 y el sorteo queda como antes. */
function datos(): ParAfinidad[] {
  if (pares) return pares
  try {
    pares = (JSON.parse(readFileSync(join(process.cwd(), 'data', 'afinidades.json'), 'utf8')) as Afinidades).pares
  } catch (e) {
    console.warn(`afinidades: no se pudo leer data/afinidades.json (${(e as Error).message}); sin afinidades`)
    pares = []
  }
  return pares
}

/** Indexa en las dos direcciones aunque el par venga en una sola (los datos de ejemplo de los tests). */
function indice(): Map<string, Map<string, Afin>> {
  if (porId) return porId
  const m = new Map<string, Map<string, Afin>>()
  const sumar = (a: string, b: string, p: ParAfinidad) => {
    const de = m.get(a) ?? new Map<string, Afin>()
    if (!de.has(b)) de.set(b, { alimentoId: b, afinidad: p.afinidad, n: p.n })
    m.set(a, de)
  }
  for (const p of datos()) {
    if (p.a === p.b || !(p.afinidad > 0)) continue
    sumar(p.a, p.b, p)
    sumar(p.b, p.a, p)
  }
  porId = m
  return m
}

/** Todos los pares, tal como vienen: para proyectarlos al grafo como COMBINA (proyeccion.ts). */
export function paresAfinidad(): readonly ParAfinidad[] {
  return datos()
}

export function afinidad(a: string, b: string): number {
  return indice().get(a)?.get(b)?.afinidad ?? 0
}

/** Los que combinan con `id`, de más a menos afín (a igual afinidad, el de más recetas). `k`: cuántos (todos si falta). */
export function afines(id: string, k = Infinity, filtro?: (alimentoId: string) => boolean): Afin[] {
  ordenados ??= new Map()
  let todos = ordenados.get(id)
  if (!todos) {
    todos = [...(indice().get(id)?.values() ?? [])].sort((x, y) => y.afinidad - x.afinidad || y.n - x.n || (x.alimentoId < y.alimentoId ? -1 : 1))
    ordenados.set(id, todos)
  }
  const r: Afin[] = []
  for (const x of todos) {
    if (r.length >= k) break
    if (!filtro || filtro(x.alimentoId)) r.push({ ...x })
  }
  return r
}

/**
 * Lo que combina `id` con un plato: la mayor afinidad con alguno de sus ingredientes (sin contarse a sí mismo).
 * Para pesar el sorteo del ingrediente del foco por los ingredientes del alimento de partida.
 */
export function afinidadCon(id: string, ingredientes: readonly string[]): number {
  return Math.max(0, ...ingredientes.filter((i) => i !== id).map((i) => afinidad(id, i)))
}

/** Solo para tests: reemplaza los pares (null vuelve a leer el archivo). */
export function fijarAfinidades(nuevos: ParAfinidad[] | null): void {
  pares = nuevos
  porId = null
  ordenados = null
}
