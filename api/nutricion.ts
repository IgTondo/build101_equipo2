// GET /api/nutricion?ninoId&dia=YYYY-MM-DD → CoberturaDia
// Dueño: pista B (B7, PLAN.md §8). Stub de C1: devuelve fixtures/nutricion.json con x-nibble-stub: 1.
import { manejar, permitir, responderStub } from '../server/http.js'

export default manejar(async (req, res) => {
  if (!permitir(req, res, 'GET')) return
  await responderStub(res, 'nutricion')
})
