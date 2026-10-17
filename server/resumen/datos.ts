// Datos de entrada del resumen para el nutricionista (C8): el progreso de la semana y el perfil del chico.
// Con MONGODB_URI salen de las funciones de B, llamadas directo (no por HTTP): obtenerProgreso con 7 días (B7) y
// obtenerPerfil (B8). Si el chico no existe, B tira ErrorNibble('no_encontrado') y el handler responde 404.
// Sin base (desarrollo sin Mongo) se leen fixtures/progreso.json y fixtures/perfil.json, y el handler manda
// x-nibble-stub: 1 porque deFixture es true: el texto se genera de verdad, pero los números son de ejemplo.
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Perfil, Progreso } from '../../shared/contratos.js'
import { hayMongo } from '../datos/mongo.js'
import { obtenerPerfil } from '../datos/perfiles.js'
import { obtenerProgreso } from '../datos/tablero.js'

export interface Cargado<T> { datos: T; deFixture: boolean }

/** La semana del resumen: los últimos 7 días, igual que la cobertura del tablero. */
export const DIAS_RESUMEN = 7

async function leerFixture<T>(nombre: string): Promise<T> {
  const ruta = join(process.cwd(), 'fixtures', `${nombre}.json`) // en Vercel, vercel.json → includeFiles
  return JSON.parse(await readFile(ruta, 'utf8')) as T
}

/** Progreso del chico (cobertura semanal, repertorio, grupos, exposiciones, alertas y comidas con su conducta). */
export async function cargarProgreso(ninoId: string): Promise<Cargado<Progreso>> {
  if (hayMongo()) return { datos: await obtenerProgreso(ninoId, { dias: DIAS_RESUMEN }), deFixture: false }
  return { datos: await leerFixture<Progreso>('progreso'), deFixture: true }
}

/** Perfil del chico (nombre, edad, alergias, dieta). El resumen se puede armar sin él. */
export async function cargarPerfil(ninoId: string): Promise<Cargado<Perfil>> {
  if (hayMongo()) return { datos: await obtenerPerfil(ninoId), deFixture: false }
  return { datos: await leerFixture<Perfil>('perfil'), deFixture: true }
}
