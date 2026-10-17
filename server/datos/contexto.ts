// obtenerContexto(ninoId) para A (/api/analizar-comida, §7): el catálogo personal del chico primero, después el
// semilla, y sus reglas (para preguntar si "que no se toquen" aplica a lo que se ve). Si falla, devuelve null y A
// sigue sin contexto.
import type { Alergeno, Regla } from '../../shared/contratos.js'
import { calcularEstado } from '../aprendizaje/estado.js'
import { cargarNino } from './cargar.js'

export interface ContextoNino {
  ninoId: string
  nombre: string
  edad: number
  alergias: Alergeno[]
  reglas: Regla[]
  /** Lo que el chico ya conoce: primero lo que acepta, después lo que está probando. "id: nombre" para el prompt. */
  preparaciones: { id: string; nombre: string; estado: 'acepta' | 'en_proceso' | 'rechaza' }[]
  /** El catálogo semilla, sin lo que ya está arriba. */
  catalogo: { id: string; nombre: string }[]
}

export async function obtenerContexto(ninoId: string): Promise<ContextoNino | null> {
  try {
    const c = await cargarNino(ninoId)
    const estado = calcularEstado(c.nino, c.comidas, c.catalogo)
    const orden = { acepta: 0, en_proceso: 1, rechaza: 2 }
    const preparaciones = [...estado.estados.values()]
      .sort((a, b) => orden[a.estado] - orden[b.estado] || b.veces - a.veces || b.p - a.p)
      .map((e) => ({ id: e.prepId, nombre: e.nombre, estado: e.estado }))
    const propias = new Set(preparaciones.map((p) => p.id))
    return {
      ninoId,
      nombre: c.nino.datos.nombre,
      edad: c.nino.datos.edad,
      alergias: c.nino.datos.alergias,
      reglas: c.nino.reglas,
      preparaciones,
      catalogo: [...c.catalogo.values()].filter((p) => !propias.has(p.id)).map((p) => ({ id: p.id, nombre: p.nombre })),
    }
  } catch (e) {
    console.warn('[contexto]', (e as Error).message)
    return null
  }
}
