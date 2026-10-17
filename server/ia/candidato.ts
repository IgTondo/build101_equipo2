// El candidato de la tarjeta "Más nutritiva" (PLAN.md §8): puede no estar entre los 3 que trae armarEvidencia(), así
// que se busca en la lista completa del recomendador de B (rec.candidatos), con la misma cuenta que el tablero.
// generarReceta() lo usa solo cuando el preparacionId pedido no está en la evidencia (DepsReceta.candidato).
// api/receta.ts: candidato: (ninoId, preparacionId, nutriente) => buscarCandidato(ninoId, preparacionId, nutriente, motor)
// Acá también va preparacionesDe(): de dónde saca generarReceta() el alimento seguro y la base para validar el cambio.
import type { Candidato, Motor, Nutriente, PreparacionCatalogo } from '../../shared/contratos.js'
import type { PrepConocida } from '../aprendizaje/cadena.js'
import { calcularEstado } from '../aprendizaje/estado.js'
import { type Cargado, cargarNino } from '../datos/cargar.js'
import { hoyUruguay } from '../datos/fechas.js'
import { recomendacionDe } from '../datos/tablero.js'

export interface OpcionesCandidato { nutriente?: Nutriente; motor?: Motor; hoy?: string; ahora?: Date }

/** El candidato `preparacionId` entre todos los de la recomendación, o undefined. Sin red: recibe al chico ya cargado. */
export function candidatoEn(c: Cargado, preparacionId: string, op: OpcionesCandidato = {}): Candidato | undefined {
  const hoy = op.hoy ?? hoyUruguay(op.ahora)
  const estado = calcularEstado(c.nino, c.comidas, c.catalogo, { hasta: hoy })
  const rec = recomendacionDe(c, estado, hoy, op.motor ?? 'grafo', op.nutriente, op.ahora)
  return rec.candidatos.find((x) => x.preparacionId === preparacionId)
}

export async function buscarCandidato(ninoId: string, preparacionId: string, nutriente?: Nutriente, motor: Motor = 'grafo'): Promise<Candidato | undefined> {
  return candidatoEn(await cargarNino(ninoId), preparacionId, { ...(nutriente ? { nutriente } : {}), motor })
}

// ---------- Las preparaciones del chico ----------
// cadena.ts puede partir de algo que el chico come y que no está en el catálogo (lo observado por la visión o lo que
// contó el padre). Para validar el cambio hacen falta todos sus atributos, con la cocción, y sus ingredientes: lo
// observado los trae; lo declarado en el perfil, casi nunca. Lo incompleto no se usa (no se afloja el conteo de cambios).

/** La preparación conocida como PreparacionCatalogo, solo si tiene los 8 atributos y al menos un ingrediente. */
export function completa(p: PrepConocida): PreparacionCatalogo | undefined {
  const { textura, forma, color, sabor, temperatura, presentacion, grupo, coccion } = p.atributos
  if (!textura || !forma || !color || !sabor || !temperatura || !presentacion || !grupo || !coccion || p.ingredientes.length === 0) return undefined
  return { id: p.id, nombre: p.nombre, atributos: { textura, forma, color, sabor, temperatura, presentacion, grupo, coccion }, ingredientes: p.ingredientes }
}

/** Primero el catálogo; si no está, lo que el chico tiene en calcularEstado(...).conocidas, si está completo. Sin red. */
export function preparacionesEn(c: Cargado): (id: string) => PreparacionCatalogo | undefined {
  const conocidas = calcularEstado(c.nino, c.comidas, c.catalogo).conocidas
  return (id) => {
    const delCatalogo = c.catalogo.get(id)
    if (delCatalogo) return delCatalogo
    const p = conocidas.get(id)
    return p ? completa(p) : undefined
  }
}

/** Para DepsReceta.preparaciones. */
export async function preparacionesDe(ninoId: string): Promise<(id: string) => PreparacionCatalogo | undefined> {
  return preparacionesEn(await cargarNino(ninoId))
}
