// Catálogos: alimentos (data/alimentos.json de A3, más la colección alimentos_fdc) y preparaciones (B11).
import type { Alimento, PreparacionCatalogo } from '../../shared/contratos.js'
import { leerJSON } from './archivos.js'
import { col } from './mongo.js'

let alimentosFijos: ReadonlyMap<string, Alimento> | null = null
let preparacionesFijas: ReadonlyMap<string, PreparacionCatalogo> | null = null
let alimentosMemo: Map<string, Alimento> | null = null
let preparacionesMemo: Map<string, PreparacionCatalogo> | null = null

/** Tests y scripts: catálogos propios en lugar de los archivos (null vuelve a los archivos). */
export function usarCatalogos(c: { alimentos?: ReadonlyMap<string, Alimento> | null; preparaciones?: ReadonlyMap<string, PreparacionCatalogo> | null }): void {
  if (c.alimentos !== undefined) alimentosFijos = c.alimentos
  if (c.preparaciones !== undefined) preparacionesFijas = c.preparaciones
  alimentosMemo = null
  preparacionesMemo = null
}

/**
 * El catálogo curado de A3. `ALIMENTOS_ARCHIVO` permite apuntar a otro (por ejemplo, el fixture de los tests de B
 * para desarrollar antes de que A3 lo suba). Si no está, queda vacío: los nutrientes cuentan 0 y se avisa.
 */
export function alimentosCatalogo(): ReadonlyMap<string, Alimento> {
  if (alimentosFijos) return alimentosFijos
  if (!alimentosMemo) {
    const crudo = leerJSON<Alimento[] | { alimentos: Alimento[] }>(process.env.ALIMENTOS_ARCHIVO || 'data/alimentos.json')
    const lista = Array.isArray(crudo) ? crudo : (crudo?.alimentos ?? [])
    alimentosMemo = new Map(lista.map((a) => [a.id, a]))
  }
  return alimentosMemo
}

/** data/preparaciones.json (B11); si todavía no está, las 28 de los sintéticos. */
export function preparacionesCatalogo(): ReadonlyMap<string, PreparacionCatalogo> {
  if (preparacionesFijas) return preparacionesFijas
  if (!preparacionesMemo) {
    const lista = leerJSON<PreparacionCatalogo[]>('data/preparaciones.json') ?? leerJSON<PreparacionCatalogo[]>('data/sinteticos/preparaciones.json') ?? []
    preparacionesMemo = new Map(lista.map((p) => [p.id, p]))
  }
  return preparacionesMemo
}

/** La tabla para estos ids: el catálogo curado y, lo que falte, de alimentos_fdc (lo carga A3 en Mongo). */
export async function resolverAlimentos(ids: Iterable<string>): Promise<Map<string, Alimento>> {
  const tabla = new Map(alimentosCatalogo())
  const faltan = [...new Set(ids)].filter((id) => !tabla.has(id))
  if (faltan.length && !alimentosFijos) {
    try {
      const encontrados = await col.alimentosFdc().find({ id: { $in: faltan } }, { projection: { _id: 0 } }).toArray()
      for (const a of encontrados) tabla.set(a.id, a)
    } catch (e) {
      console.warn('[alimentos] no se pudo buscar en alimentos_fdc:', (e as Error).message)
    }
  }
  return tabla
}
