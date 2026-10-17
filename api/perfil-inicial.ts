// POST /api/perfil-inicial { PerfilInicialReq } → PerfilBorrador
// Dueño: pista A (A8, PLAN.md §7). La lógica vive en server/ia/perfil.ts. La pantalla transcribe antes con /api/transcribir.
import type { PerfilBorrador } from '../shared/contratos.js'
import { manejar, permitir } from '../server/http.js'
import { esquemaPerfilInicialReq, extraerPerfil } from '../server/ia/perfil.js'

export default manejar(async (req, res) => {
  if (!permitir(req, res, 'POST')) return
  const pedido = esquemaPerfilInicialReq.parse(req.body)
  const cuerpo: PerfilBorrador = await extraerPerfil(pedido)
  res.status(200).json(cuerpo)
})
