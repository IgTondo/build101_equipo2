// POST /api/receta?motor=base|grafo { RecetaReq } → Receta
// Dueño: pista A (A9, PLAN.md §7). armarEvidencia() y el perfil son de B; la receta, la validación por código y los
// reintentos viven en server/ia/receta.ts. Los errores salen como ErrorApi por manejar().
import { MOTOR, type Motor, type Receta } from '../shared/contratos.js'
import { ErrorNibble, manejar, param, permitir } from '../server/http.js'
import { obtenerPerfil } from '../server/datos/perfiles.js'
import { armarEvidencia } from '../server/grafo/evidencia.js'
import { esquemaRecetaReq, generarReceta } from '../server/ia/receta.js'

export default manejar(async (req, res) => {
  if (!permitir(req, res, 'POST')) return
  const pedido = esquemaRecetaReq.parse(req.body)
  const motor = param(req, 'motor') ?? 'grafo'
  if (!(MOTOR as readonly string[]).includes(motor)) throw new ErrorNibble('entrada_invalida', `motor tiene que ser ${MOTOR.join(' o ')}.`)
  const receta: Receta = await generarReceta(pedido, {
    armarEvidencia: (ninoId, nutriente) => armarEvidencia(ninoId, nutriente, motor as Motor),
    perfil: obtenerPerfil,
  })
  res.status(200).json(receta)
})
