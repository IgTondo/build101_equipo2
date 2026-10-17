// POST /api/perfil { CrearPerfilReq } → CrearPerfilRes · GET /api/perfil?ninoId → Perfil
// Dueño: pista B (B8, PLAN.md §8). Stub de C1: devuelve fixtures/perfil-crear.json (POST) o fixtures/perfil.json (GET).
import { manejar, permitir, responderStub } from '../server/http.js'

export default manejar(async (req, res) => {
  if (!permitir(req, res, 'GET', 'POST')) return
  await responderStub(res, req.method === 'POST' ? 'perfil-crear' : 'perfil')
})
