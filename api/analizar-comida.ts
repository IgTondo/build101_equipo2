// POST /api/analizar-comida { AnalizarComidaReq } → AnalisisComida
// Dueño: pista A (A5, PLAN.md §7). Stub de C1: devuelve fixtures/analizar-comida.json con x-nibble-stub: 1.
import { manejar, permitir, responderStub } from '../server/http.js'

export default manejar(async (req, res) => {
  if (!permitir(req, res, 'POST')) return
  await responderStub(res, 'analizar-comida')
})
