// POST /api/transcribir { TranscribirReq } → TranscribirRes
// Dueño: pista A (A7, PLAN.md §7). Stub de C1: devuelve fixtures/transcribir.json con x-nibble-stub: 1.
import { manejar, permitir, responderStub } from '../server/http.js'

export default manejar(async (req, res) => {
  if (!permitir(req, res, 'POST')) return
  await responderStub(res, 'transcribir')
})
