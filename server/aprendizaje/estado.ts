// El estado del chico (capa silver, PLAN.md §4.3): se recalcula de cero desde el bronze cada vez que hace falta.
// Con menos de 100 comidas tarda milisegundos, y así cambiar de motor o de reglas nunca pierde nada.
import type { Atributos, Momento, PreparacionCatalogo } from '../../shared/contratos.js'
import { MOMENTO } from '../../shared/contratos.js'
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

/** Una preparación conocida con las comidas en las que va (cadena.ts suma `momentos` a PrepConocida). */
type Conocida = PrepConocida & { momentos?: Momento[] }

const ordenMomentos = (ms: Iterable<Momento>): Momento[] => {
  const hay = new Set(ms)
  return MOMENTO.filter((m) => hay.has(m))
}
const sinVacios = (a: Partial<Atributos> | undefined): Partial<Atributos> =>
  Object.fromEntries(Object.entries(a ?? {}).filter(([, v]) => Boolean(v))) as Partial<Atributos>

/**
 * Todo lo que el chico conoce, con lo que hace falta para razonar sobre ello (atributos, ingredientes y momentos).
 * El orden importa: 1) el catálogo (curado: sus atributos son la convención aunque el padre lo haya nombrado distinto);
 * 2) lo que contó el padre, lo que acepta Y lo que rechaza (si no, la señal negativa se pierde), con sus atributos,
 * ingredientes y momentos cuando no es del catálogo; 3) lo observado por la visión (completo: manda sobre lo declarado,
 * y sus momentos son las comidas en las que se lo vio, sumados a los declarados).
 * Los documentos viejos (sin ingredientes ni momentos) siguen funcionando: quedan incompletos, como antes.
 */
export function preparacionesConocidas(
  borrador: NinoDoc['borrador'],
  comidas: readonly ComidaDoc[],
  catalogo: ReadonlyMap<string, PreparacionCatalogo>,
): Map<string, PrepConocida> {
  const m = new Map<string, Conocida>()
  for (const p of catalogo.values()) {
    m.set(p.id, { id: p.id, nombre: p.nombre, atributos: p.atributos, ingredientes: p.ingredientes, ...(p.momentos ? { momentos: p.momentos } : {}) })
  }

  // 2. Lo declarado (primero lo que rechaza y después lo que acepta, como estadosIniciales: si está en las dos, manda acepta)
  const declarados: { nombre: string; preparacionId: string | null; atributos?: Partial<Atributos>; ingredientes?: { alimentoId: string; gramos: number }[]; momentos?: Momento[] }[] =
    [...(borrador.rechaza ?? []), ...(borrador.acepta ?? [])]
  for (const a of declarados) {
    const id = a.preparacionId ?? slug(a.nombre)
    if (!id || catalogo.has(id)) continue
    const previa = m.get(id)
    const ingredientes = (a.ingredientes ?? []).filter((i) => i && i.alimentoId)
    const momentos = ordenMomentos([...(previa?.momentos ?? []), ...(a.momentos ?? [])])
    m.set(id, {
      id,
      nombre: a.nombre,
      atributos: { ...(previa?.atributos ?? {}), ...sinVacios(a.atributos) },
      ingredientes: ingredientes.length ? ingredientes : (previa?.ingredientes ?? []),
      ...(momentos.length ? { momentos } : {}),
    })
  }

  // 3. Lo observado: lo último que se vio de cada preparación fuera del catálogo, y en qué comidas se la vio
  const vistos = new Map<string, Set<Momento>>()
  for (const c of comidas) {
    for (const it of c.items) {
      if (catalogo.has(it.preparacionId)) continue
      const previa = m.get(it.preparacionId)
      const momentos = vistos.get(it.preparacionId) ?? new Set(previa?.momentos ?? [])
      if (c.momento) momentos.add(c.momento)
      vistos.set(it.preparacionId, momentos)
      m.set(it.preparacionId, {
        id: it.preparacionId,
        nombre: it.nombre,
        atributos: { ...(previa?.atributos ?? {}), ...sinVacios(it.atributos) },
        ingredientes: it.ingredientes.length ? it.ingredientes : (previa?.ingredientes ?? []),
        ...(momentos.size ? { momentos: ordenMomentos(momentos) } : {}),
      })
    }
  }
  return m
}

export function contar(estado: EstadoNino, cual: EstadoPrep['estado']): number {
  let n = 0
  for (const s of estado.estados.values()) if (s.estado === cual && (cual !== 'en_proceso' || s.veces > 0)) n++
  return n
}
