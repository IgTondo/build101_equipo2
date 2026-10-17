// POST /api/registrar-comida { RegistrarComidaReq } → RegistrarComidaRes
// Dueño: pista B (B6, PLAN.md §8). Stub de C1: devuelve fixtures/registrar-comida.json con x-nibble-stub: 1.
import { manejar, permitir, responderStub } from '../server/http.js'

export default manejar(async (req, res) => {
  if (!permitir(req, res, 'POST')) return
  await responderStub(res, 'registrar-comida')
})
