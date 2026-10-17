// POST /api/relato-comida { RelatoComidaReq } → RelatoComida
// Dueño: pista A (A7, PLAN.md §7). La lógica vive en server/ia/relato.ts: transcripción, Claude y la depuración por código.
import type { RelatoComida, RelatoComidaReq } from '../shared/contratos.js'
import { manejar, permitir } from '../server/http.js'
import { esquemaRelatoReq, interpretarRelato } from '../server/ia/relato.js'

export default manejar(async (req, res) => {
  if (!permitir(req, res, 'POST')) return
  esquemaRelatoReq.parse(req.body) // valida lo que usa el relato; el análisis pasa entero, sin recortar
  const cuerpo: RelatoComida = await interpretarRelato(req.body as RelatoComidaReq)
  res.status(200).json(cuerpo)
})
