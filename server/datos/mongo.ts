// MongoDB Atlas (PLAN.md §4.1 y B2): lo que pasó (el bronze). El cliente se crea a nivel de módulo para reusar la
// conexión entre invocaciones de las funciones de Vercel. MONGODB_URI la crea la integración de Vercel Marketplace.
import { type Db, MongoClient } from 'mongodb'
import type { Alimento } from '../../shared/contratos.js'
import type { ComidaDoc, NinoDoc } from './tipos.js'

/** El grafo en Mongo (MOTOR_GRAFO=mongo, §4.3): misma interfaz que Neo4j. */
export interface NodoDoc {
  _id: string // "Preparacion:papas_fritas_baston"
  label: string
  id: string
  ninoId: string | null // null: nodo compartido (catálogo, atributos, nutrientes)
  props: Record<string, unknown>
}
export interface RelacionDoc {
  _id: string // "TIENE:Preparacion:x->Atributo:textura:crocante"
  tipo: string
  desde: string // _id del nodo
  hasta: string
  ninoId: string | null
  props: Record<string, unknown>
}
export interface RecetaDoc {
  _id: string
  ninoId: string
  creadoISO: string
  [campo: string]: unknown
}

let cliente: MongoClient | null = null
let base: Db | null = null
let indices: Promise<void> | null = null

/** Tests y scripts: otra URI u otra base. */
export function configurarMongo(op: { uri: string; nombreDb?: string }): void {
  cliente = new MongoClient(op.uri, { maxPoolSize: 5, serverSelectionTimeoutMS: 8000 })
  base = cliente.db(op.nombreDb ?? 'nibble')
  indices = null
}

/** ¿Hay base? Sin MONGODB_URI los endpoints de B responden sus fixtures (x-nibble-stub: 1). */
export const hayMongo = (): boolean => base !== null || Boolean(process.env.MONGODB_URI)

export function db(): Db {
  if (base) return base
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('Falta MONGODB_URI')
  cliente = new MongoClient(uri, { maxPoolSize: 5, serverSelectionTimeoutMS: 8000 })
  base = cliente.db(process.env.MONGODB_DB || 'nibble')
  return base
}

export const col = {
  ninos: () => db().collection<NinoDoc>('ninos'),
  comidas: () => db().collection<ComidaDoc>('comidas'),
  recetas: () => db().collection<RecetaDoc>('recetas'),
  /** La crea y la llena scripts/usda.ts de A (_id = id del alimento, con su índice de texto): acá solo se lee. */
  alimentosFdc: () => db().collection<Alimento & { _id: string }>('alimentos_fdc'),
  nodos: () => db().collection<NodoDoc>('nodos'),
  relaciones: () => db().collection<RelacionDoc>('relaciones'),
}

/** Índices de B2. Una vez por instancia; si falla, se reintenta la próxima. */
export function asegurarIndices(): Promise<void> {
  indices ??= (async () => {
    await col.comidas().createIndexes([{ key: { ninoId: 1, dia: 1 } }, { key: { ninoId: 1, fechaISO: 1 } }])
    await col.recetas().createIndex({ ninoId: 1, creadoISO: -1 })
    await col.nodos().createIndex({ ninoId: 1, label: 1 })
    await col.relaciones().createIndexes([{ key: { ninoId: 1, tipo: 1 } }, { key: { desde: 1 } }, { key: { hasta: 1 } }])
  })().catch((e: unknown) => {
    indices = null
    throw e
  })
  return indices
}

export async function pingMongo(): Promise<number> {
  const t = Date.now()
  await db().command({ ping: 1 })
  return Date.now() - t
}

export async function cerrarMongo(): Promise<void> {
  await cliente?.close()
  cliente = null
  base = null
  indices = null
}
