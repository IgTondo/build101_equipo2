// GET /api/salud → SaludRes: ping a Mongo y a Neo4j, y el estado de la IA con estadoIA() de A (pings que no gastan).
// Dueño: pista B (B1–B2, PLAN.md §8). Neo4j cuenta solo si es el motor del grafo o si está configurado.
import type { EstadoServicio, SaludRes } from '../shared/contratos.js'
import { asegurarIndices, hayMongo, pingMongo } from '../server/datos/mongo.js'
import { almacen } from '../server/grafo/almacen.js'
import { motorGrafo } from '../server/grafo/cliente.js'
import { manejar, permitir } from '../server/http.js'
import { estadoIA } from '../server/ia/salud.js'

async function medir(f: () => Promise<number>): Promise<EstadoServicio> {
  try {
    return { ok: true, ms: await f() }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export default manejar(async (req, res) => {
  if (!permitir(req, res, 'GET')) return
  const motor = motorGrafo()
  const [mongo, neo4j, ia] = await Promise.all([
    hayMongo()
      ? medir(async () => {
          const ms = await pingMongo()
          await asegurarIndices()
          return ms
        })
      : Promise.resolve<EstadoServicio>({ ok: false, error: 'Falta MONGODB_URI' }),
    motor === 'neo4j' || process.env.NEO4J_URI ? medir(() => almacen('neo4j').ping()) : Promise.resolve(undefined),
    estadoIA(),
  ])
  const servicios: SaludRes['servicios'] = { mongo, ...(neo4j ? { neo4j } : {}), ...ia }
  const cuerpo: SaludRes = { ok: Object.values(servicios).every((s) => s.ok), servicios, motorGrafo: motor }
  res.status(200).json(cuerpo)
})
