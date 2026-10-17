// Catálogo curado de alimentos (data/alimentos.json, A3). Lo usan la visión (enum de alimentoId) y la validación
// de recetas (alérgenos y nutrientes). Los que no están se mapean a un genérico otro_<grupo>.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { GRUPO, type Alimento, type Grupo } from '../../shared/contratos.js'

let lista: Alimento[] | null = null
let porId: Map<string, Alimento> | null = null

export function alimentos(): Alimento[] {
  lista ??= JSON.parse(readFileSync(join(process.cwd(), 'data', 'alimentos.json'), 'utf8')) as Alimento[] // vercel.json → includeFiles
  return lista
}

export function alimentoPorId(id: string): Alimento | undefined {
  porId ??= new Map(alimentos().map((a) => [a.id, a]))
  return porId.get(id)
}

export function idsAlimentos(): string[] {
  return alimentos().map((a) => a.id)
}

export function idGenerico(grupo: Grupo): string {
  return `otro_${grupo}`
}

export function esGenerico(id: string): boolean {
  return GRUPO.some((g) => id === idGenerico(g))
}

/** Solo para tests: reemplaza el catálogo (null vuelve a leer el archivo). */
export function fijarAlimentos(nuevos: Alimento[] | null): void {
  lista = nuevos
  porId = null
}
