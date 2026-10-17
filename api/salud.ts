// GET /api/salud → SaludRes (ping a Mongo, Neo4j, Claude y transcripción)
// Dueño: pista B (B1–B2, PLAN.md §8). Stub de C1: devuelve fixtures/salud.json con x-nibble-stub: 1.
import { manejar, permitir, responderStub } from '../server/http.js'

export default manejar(async (req, res) => {
  if (!permitir(req, res, 'GET')) return
  await responderStub(res, 'salud')
})
