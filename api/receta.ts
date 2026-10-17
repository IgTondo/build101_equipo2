// POST /api/receta?motor=base|grafo { RecetaReq } → Receta
// Dueño: pista A (A9, PLAN.md §7). Stub de C1: devuelve fixtures/receta.json con x-nibble-stub: 1.
import { manejar, permitir, responderStub } from '../server/http.js'

export default manejar(async (req, res) => {
  if (!permitir(req, res, 'POST')) return
  await responderStub(res, 'receta')
})
