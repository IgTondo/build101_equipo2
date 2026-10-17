// El estado del chico (capa silver, PLAN.md §4.3): se recalcula de cero desde el bronze cada vez que hace falta.
// Con menos de 100 comidas tarda milisegundos, y así cambiar de motor o de reglas nunca pierde nada.
import type { PreparacionCatalogo } from '../../shared/contratos.js'
import type { ComidaDoc, NinoDoc } from '../datos/tipos.js'
import { type ConfigAceptacion, type EstadoPrep, CONFIG_ACEPTACION, ordenarComidas, procesarHistorial } from './aceptacion.js'
import type { PrepConocida } from './cadena.js'
import type { Observacion } from './condiciones.js'
import {
  type ConfigPatrones, type Patron, type PatronInvestigacion,
  CONFIG_PATRONES, combinarConInvestigacion, minarPatrones, patronesInvestigacion,
} from './patrones.js'
import { slug } from './textos.js'

export interface EstadoNino {
  hasta: string | null
  comidas: ComidaDoc[] // las que entraron, en orden
  observaciones: Observacion[]
  estados: Map<string, EstadoPrep>
  aprendidos: Patron[] // TODOS los que pasan los umbrales (para el diff de "qué aprendí")
  patrones: Patron[] // los vigentes: hasta 10 aprendidos + investigación (se muestran y los usa el recomendador)
  confirmados: Patron[]
  borrados: Patron[]
  conocidas: Map<string, PrepConocida>
}

export interface OpcionesEstado {
  hasta?: string // 'YYYY-MM-DD': solo las comidas hasta ese día (para "hace 7 días" y "hace 14 días")
  investigacion?: readonly PatronInvestigacion[]
  cfgAceptacion?: ConfigAceptacion
  cfgPatrones?: ConfigPatrones
}

export function calcularEstado(
  nino: Pick<NinoDoc, 'borrador'>,
  comidas: readonly ComidaDoc[],
  catalogo: ReadonlyMap<string, PreparacionCatalogo>,
  op: OpcionesEstado = {},
): EstadoNino {
  const hasta = op.hasta
  const incluidas = ordenarComidas(hasta ? comidas.filter((c) => c.dia <= hasta) : comidas)
  const cfgPatrones = op.cfgPatrones ?? CONFIG_PATRONES
  const { estados, observaciones } = procesarHistorial(incluidas, nino.borrador, op.cfgAceptacion ?? CONFIG_ACEPTACION)
  const aprendidos = minarPatrones(observaciones, cfgPatrones)
  const { vigentes, confirmados, borrados } = combinarConInvestigacion(
    aprendidos, op.investigacion ?? patronesInvestigacion(), observaciones, cfgPatrones,
  )
  return {
    hasta: hasta ?? null, comidas: incluidas, observaciones, estados, aprendidos, patrones: vigentes, confirmados, borrados,
    conocidas: preparacionesConocidas(nino.borrador, incluidas, catalogo),
  }
}

/** Catálogo ∪ lo observado (lo último, para lo que no está en el catálogo) ∪ lo que contó el padre. */
export function preparacionesConocidas(
  borrador: NinoDoc['borrador'],
  comidas: readonly ComidaDoc[],
  catalogo: ReadonlyMap<string, PreparacionCatalogo>,
): Map<string, PrepConocida> {
  const m = new Map<string, PrepConocida>()
  for (const p of catalogo.values()) m.set(p.id, { id: p.id, nombre: p.nombre, atributos: p.atributos, ingredientes: p.ingredientes })
  for (const c of comidas) {
    for (const it of c.items) {
      if (!catalogo.has(it.preparacionId)) {
        m.set(it.preparacionId, { id: it.preparacionId, nombre: it.nombre, atributos: it.atributos, ingredientes: it.ingredientes })
      }
    }
  }
  for (const a of borrador.acepta) {
    const id = a.preparacionId ?? slug(a.nombre)
    if (!m.has(id)) m.set(id, { id, nombre: a.nombre, atributos: a.atributos, ingredientes: [] })
  }
  return m
}

export function contar(estado: EstadoNino, cual: EstadoPrep['estado']): number {
  let n = 0
  for (const s of estado.estados.values()) if (s.estado === cual && (cual !== 'en_proceso' || s.veces > 0)) n++
  return n
}
