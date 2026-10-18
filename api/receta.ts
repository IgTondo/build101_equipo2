// POST /api/receta?motor=base|grafo { RecetaReq } → Receta
// Dueño: pista A (A9, PLAN.md §7). armarEvidencia() y el perfil son de B; la receta, la validación por código y los
// reintentos viven en server/ia/receta.ts. Los errores salen como ErrorApi por manejar().
// v5.4 · Sin preparacionId, la receta creativa (server/ia/receta-creativa.ts): el grafo da la base de conocimiento
// (armarConocimiento; v5.8: armarConocimientoReceta, que suma sus otras alergias) y el LLM inventa un plato nuevo. Con
// preparacionId (la tarjeta de la próxima comida), la de siempre.
import { MOTOR, type Motor, type Receta } from '../shared/contratos.js'
import { ErrorNibble, manejar, param, permitir, responderStub } from '../server/http.js'
import { hayMongo } from '../server/datos/mongo.js'
import { obtenerPerfil } from '../server/datos/perfiles.js'
import { armarEvidencia } from '../server/grafo/evidencia.js'
import { buscarCandidato, preparacionesDe } from '../server/ia/candidato.js'
import { armarConocimientoReceta, generarRecetaCreativa } from '../server/ia/receta-creativa.js'
import { esquemaRecetaReq, generarReceta } from '../server/ia/receta.js'

export default manejar(async (req, res) => {
  if (!permitir(req, res, 'POST')) return
  const pedido = esquemaRecetaReq.parse(req.body)
  const motor = param(req, 'motor') ?? 'grafo'
  if (!(MOTOR as readonly string[]).includes(motor)) throw new ErrorNibble('entrada_invalida', `motor tiene que ser ${MOTOR.join(' o ')}.`)
  // Sin base no hay evidencia ni perfil: como los endpoints de B, responde el fixture con x-nibble-stub: 1 (C, integración)
  if (!hayMongo()) return responderStub(res, 'receta')
  if (!pedido.preparacionId) {
    const creativa = await generarRecetaCreativa(pedido, { conocimiento: (ninoId, op) => armarConocimientoReceta(ninoId, { ...op, motor: motor as Motor }) })
    return res.status(200).json(creativa)
  }
  const receta: Receta = await generarReceta(pedido, {
    // v5.2 · con momento, los candidatos de la evidencia son de esa comida (B, esParaMomento); el preparacionId que
    // eligió la familia se respeta igual, porque `candidato` lo busca entre todos
    armarEvidencia: (ninoId, nutriente) => armarEvidencia(ninoId, nutriente, motor as Motor, pedido.momento),
    perfil: obtenerPerfil,
    // "Más nutritiva" puede pedir un candidato que no está entre los 3 de la evidencia: se busca en la lista completa
    candidato: (ninoId, preparacionId, nutriente) => buscarCandidato(ninoId, preparacionId, nutriente, motor as Motor),
    // Su alimento seguro puede no estar en el catálogo: vale lo que comió, si la visión lo vio con todos sus atributos
    preparaciones: preparacionesDe,
  })
  res.status(200).json(receta)
})
