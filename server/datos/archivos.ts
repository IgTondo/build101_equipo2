// Lectura de los JSON de data/ con caché a nivel de módulo.
// Las rutas son relativas a la raíz del repo (process.cwd(): la raíz en local, /var/task en Vercel).
// En Vercel, data/** tiene que entrar al bundle de las funciones (`includeFiles` en vercel.json).
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const cache = new Map<string, unknown>()

/** Devuelve null si el archivo no existe (por ejemplo, data/alimentos.json antes de que A3 lo genere). */
export function leerJSON<T>(ruta: string): T | null {
  if (cache.has(ruta)) return cache.get(ruta) as T
  const absoluta = join(process.cwd(), ruta)
  if (!existsSync(absoluta)) return null
  const valor = JSON.parse(readFileSync(absoluta, 'utf8')) as T
  cache.set(ruta, valor)
  return valor
}

export function olvidarJSON(): void {
  cache.clear()
}
