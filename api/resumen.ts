// GET /api/resumen?ninoId → ResumenRes
// Dueño: pista C (C8, PLAN.md §9). Stub de C1: devuelve fixtures/resumen.json con x-nibble-stub: 1.
import { manejar, permitir, responderStub } from '../server/http.js'

export default manejar(async (req, res) => {
  if (!permitir(req, res, 'GET')) return
  await responderStub(res, 'resumen')
})
