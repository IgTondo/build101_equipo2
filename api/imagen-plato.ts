// POST /api/imagen-plato { ImagenPlatoReq } → ImagenPlatoRes
// Dueño: pista A (A10, PLAN.md §7). Prompt de presentación funcional → Nano Banana 2.1 (respaldo: FLUX.1 schnell)
// (server/ia/imagen-plato.ts). La imagen vuelve siempre con ilustrativa: true.
import type { ImagenPlatoRes } from '../shared/contratos.js'
import { manejar, permitir } from '../server/http.js'
import { esquemaImagenPlatoReq, imagenPlato } from '../server/ia/imagen-plato.js'

export default manejar(async (req, res) => {
  if (!permitir(req, res, 'POST')) return
  const pedido = esquemaImagenPlatoReq.parse(req.body)
  const cuerpo: ImagenPlatoRes = await imagenPlato(pedido)
  res.status(200).json(cuerpo)
})
