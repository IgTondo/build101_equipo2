// POST /api/imagen-plato { ImagenPlatoReq } → ImagenPlatoRes
// Dueño: pista A (A10, PLAN.md §7). Stub de C1: devuelve fixtures/imagen-plato.json con x-nibble-stub: 1.
import { manejar, permitir, responderStub } from '../server/http.js'

export default manejar(async (req, res) => {
  if (!permitir(req, res, 'POST')) return
  await responderStub(res, 'imagen-plato')
})
