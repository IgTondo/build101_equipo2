// El almacén del grafo (PLAN.md §4.3): Neo4j o Mongo según MOTOR_GRAFO, con la misma interfaz. El resto del código
// no sabe qué hay detrás. Silver y gold se pueden rehacer de cero desde el bronze (scripts/reconstruir-grafo.ts).
import type { Alimento, Nutrientes, PreparacionCatalogo } from '../../shared/contratos.js'
import type { EstadoNino } from '../aprendizaje/estado.js'
import type { ComidaDoc, NinoDoc } from '../datos/tipos.js'
import { almacenMongo } from './almacen-mongo.js'
import { almacenNeo4j } from './almacen-neo4j.js'
import { type MotorGrafo, motorGrafo } from './cliente.js'

/** Para la visualización (C13): nodos y aristas del subgrafo de un chico. */
export interface GrafoVista {
  motor: MotorGrafo
  nodos: { id: string; tipo: string; nombre: string; props: Record<string, unknown> }[]
  aristas: { desde: string; hasta: string; tipo: string; props: Record<string, unknown> }[]
}

export interface AlmacenGrafo {
  readonly motor: MotorGrafo
  /** B3: constraints de unicidad (Neo4j) o índices (Mongo). */
  asegurarEsquema(): Promise<void>
  /** B5: el grafo base con el catálogo. */
  sembrar(preparaciones: readonly PreparacionCatalogo[], alimentos: readonly Alimento[]): Promise<void>
  /** B8: el chico, sus alergias, reglas y objetivos, y su conocimiento inicial. */
  escribirNino(nino: NinoDoc, objetivo: Nutrientes, estado: EstadoNino): Promise<void>
  /** B6: la comida y el conocimiento actualizado, en una transacción. */
  escribirComida(comida: ComidaDoc, estado: EstadoNino): Promise<void>
  borrarNino(ninoId: string): Promise<void>
  /** Las preparaciones fuera del catálogo sin chico (de antes de que fueran de cada chico) que ya nadie usa. */
  borrarHuerfanas(): Promise<number>
  subgrafo(ninoId: string): Promise<GrafoVista>
  ping(): Promise<number>
}

export function almacen(motor: MotorGrafo = motorGrafo()): AlmacenGrafo {
  return motor === 'neo4j' ? almacenNeo4j : almacenMongo
}

/**
 * Las escrituras al grafo no frenan el ciclo principal: si Neo4j tarda o se cae, la comida ya está en Mongo y el
 * grafo se rehace después. Se avisa en el log. En los tests se puede pedir que el error se propague.
 */
export async function sinFrenar(que: string, fn: () => Promise<void>, ms = Number(process.env.GRAFO_LIMITE_MS) || 8000): Promise<boolean> {
  let reloj: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      fn(),
      new Promise<never>((_, rechazar) => {
        reloj = setTimeout(() => rechazar(new Error(`tardó más de ${ms} ms`)), ms)
      }),
    ])
    return true
  } catch (e) {
    if (process.env.GRAFO_ESTRICTO === '1') throw e
    console.error(`[grafo] no se pudo ${que}:`, (e as Error).message)
    return false
  } finally {
    clearTimeout(reloj)
  }
}
