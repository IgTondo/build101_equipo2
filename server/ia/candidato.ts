// El candidato de la tarjeta "Más nutritiva" (PLAN.md §8): puede no estar entre los 3 que trae armarEvidencia(), así
// que se busca en la lista completa del recomendador de B (rec.candidatos), con la misma cuenta que el tablero.
// generarReceta() lo usa solo cuando el preparacionId pedido no está en la evidencia (DepsReceta.candidato).
// api/receta.ts: candidato: (ninoId, preparacionId, nutriente) => buscarCandidato(ninoId, preparacionId, nutriente, motor)
import type { Candidato, Motor, Nutriente } from '../../shared/contratos.js'
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
