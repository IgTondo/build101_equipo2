// Datos de entrada del resumen para el nutricionista (C8): el progreso y el perfil del chico.
// Por ahora salen de fixtures/progreso.json y fixtures/perfil.json, porque las funciones reales de B todavía no existen.
// El handler manda x-nibble-stub: 1 mientras deFixture sea true: el texto se genera de verdad, pero los números son de ejemplo.
//
// TODO(C8 → B7/B8): cuando existan, cambiar el cuerpo de estas dos funciones por las de B y devolver deFixture: false.
//   - cargarProgreso → la lógica de GET /api/progreso (B7), llamada directo desde server/ (no por HTTP), con dias = 7.
//   - cargarPerfil   → la lectura del perfil de GET /api/perfil (B8). Si el chico no existe, B tira ErrorNibble('no_encontrado').
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Perfil, Progreso } from '../../shared/contratos.js'

export interface Cargado<T> { datos: T; deFixture: boolean }

async function leerFixture<T>(nombre: string): Promise<T> {
  const ruta = join(process.cwd(), 'fixtures', `${nombre}.json`) // en Vercel, vercel.json → includeFiles
  return JSON.parse(await readFile(ruta, 'utf8')) as T
}

/** Progreso del chico (cobertura semanal, repertorio, grupos, exposiciones, alertas y comidas con su conducta). */
export async function cargarProgreso(_ninoId: string): Promise<Cargado<Progreso>> {
  return { datos: await leerFixture<Progreso>('progreso'), deFixture: true }
}

/** Perfil del chico (nombre, edad, alergias, dieta). El resumen se puede armar sin él. */
export async function cargarPerfil(_ninoId: string): Promise<Cargado<Perfil>> {
  return { datos: await leerFixture<Perfil>('perfil'), deFixture: true }
}
