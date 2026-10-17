// Neo4j Aura (PLAN.md §4.1 y B1): driver a nivel de módulo con disableLosslessIntegers, y la elección del motor del
// grafo (§4.3). Aura Free se pausa si no se usa: abrir la consola el domingo antes del pitch.
import neo4j, { type Driver, type ManagedTransaction } from 'neo4j-driver'

export type MotorGrafo = 'neo4j' | 'mongo'

/** MOTOR_GRAFO=neo4j|mongo. Sin la variable: neo4j si hay NEO4J_URI; si no, mongo (el plan B de §13). */
export function motorGrafo(): MotorGrafo {
  const m = process.env.MOTOR_GRAFO
  if (m === 'neo4j' || m === 'mongo') return m
  return process.env.NEO4J_URI ? 'neo4j' : 'mongo'
}

let driver: Driver | null = null

export function driverNeo4j(): Driver {
  if (driver) return driver
  const uri = process.env.NEO4J_URI
  if (!uri) throw new Error('Falta NEO4J_URI')
  driver = neo4j.driver(uri, neo4j.auth.basic(process.env.NEO4J_USERNAME || 'neo4j', process.env.NEO4J_PASSWORD || ''), {
    disableLosslessIntegers: true,
    maxConnectionPoolSize: 5,
    connectionAcquisitionTimeout: 10_000,
  })
  return driver
}

const baseDeDatos = () => process.env.NEO4J_DATABASE || undefined

export async function consultar<T = Record<string, unknown>>(
  cypher: string,
  parametros: Record<string, unknown> = {},
  modo: 'leer' | 'escribir' = 'leer',
): Promise<T[]> {
  const { records } = await driverNeo4j().executeQuery(cypher, parametros, {
    database: baseDeDatos(),
    routing: modo === 'leer' ? neo4j.routing.READ : neo4j.routing.WRITE,
  })
  return records.map((r) => r.toObject() as T)
}

/** Varias escrituras en UNA transacción (registrarComida, B6). */
export async function enTransaccion(fn: (tx: ManagedTransaction) => Promise<void>): Promise<void> {
  const sesion = driverNeo4j().session({ database: baseDeDatos(), defaultAccessMode: neo4j.session.WRITE })
  try {
    await sesion.executeWrite(fn)
  } finally {
    await sesion.close()
  }
}

export async function pingNeo4j(): Promise<number> {
  const t = Date.now()
  await consultar('RETURN 1 AS ok')
  return Date.now() - t
}

export async function cerrarNeo4j(): Promise<void> {
  await driver?.close()
  driver = null
}
