// POST /api/receta?motor=base|grafo { RecetaReq } → Receta
// Dueño: pista A (A9, PLAN.md §7). armarEvidencia() y el perfil son de B; la receta, la validación por código y los
// reintentos viven en server/ia/receta.ts. Los errores salen como ErrorApi por manejar().
// v5.4 · Sin preparacionId, la receta creativa (server/ia/receta-creativa.ts): el grafo da la base de conocimiento
// (armarConocimiento; v5.8: armarConocimientoReceta, que suma sus otras alergias) y el LLM inventa un plato nuevo. Con
// preparacionId (la tarjeta de la próxima comida), la de siempre.
// v5.9 · Toda receta es una comida completa: con preparacionId (una sugerencia del catálogo) también va por la creativa,
// con ese plato ya elegido (`elegido`); el resto de la comida se arma con lo que ya come. Si el candidato no aparece,
// una comida completa nueva para esa comida; sin momento (el tablero viejo), la receta de siempre (generarReceta).
// v5.10 · Las recetas que ya vio (`anteriores`) llegan hasta conocimientoDe: el foco sortea un ingrediente que no repita.
import { MOTOR, type Motor, type Nutriente, type Receta } from '../shared/contratos.js'
import { ErrorNibble, manejar, param, permitir, responderStub } from '../server/http.js'
import { hayMongo } from '../server/datos/mongo.js'
import { obtenerPerfil } from '../server/datos/perfiles.js'
import { armarEvidencia } from '../server/grafo/evidencia.js'
import { buscarCandidato, preparacionesDe } from '../server/ia/candidato.js'
import { armarConocimientoReceta, generarRecetaCreativa } from '../server/ia/receta-creativa.js'
import { esquemaRecetaReq, generarReceta } from '../server/ia/receta.js'
import type { Elegido } from '../server/ia/receta-creativa.js'

/** El candidato de la cadena para ese plato, con su preparación y su alimento de partida completos; si no, undefined. */
async function elegidoDe(ninoId: string, preparacionId: string, nutriente: Nutriente | undefined, motor: Motor): Promise<Elegido | undefined> {
  const [candidato, preparaciones] = await Promise.all([buscarCandidato(ninoId, preparacionId, nutriente, motor), preparacionesDe(ninoId)])
  const preparacion = preparaciones(preparacionId)
  const desde = candidato ? preparaciones(candidato.desdeId) : undefined
  return candidato && preparacion && desde ? { candidato, preparacion, desde } : undefined
}

export default manejar(async (req, res) => {
  if (!permitir(req, res, 'POST')) return
  const pedido = esquemaRecetaReq.parse(req.body)
  const motor = param(req, 'motor') ?? 'grafo'
  if (!(MOTOR as readonly string[]).includes(motor)) throw new ErrorNibble('entrada_invalida', `motor tiene que ser ${MOTOR.join(' o ')}.`)
  // Sin base no hay evidencia ni perfil: como los endpoints de B, responde el fixture con x-nibble-stub: 1 (C, integración)
  if (!hayMongo()) return responderStub(res, 'receta')
  const conocimiento = (ninoId: string, op: Parameters<typeof armarConocimientoReceta>[1]) => armarConocimientoReceta(ninoId, { ...op, motor: motor as Motor })
  if (!pedido.preparacionId) return res.status(200).json(await generarRecetaCreativa(pedido, { conocimiento }))
  const elegido = await elegidoDe(pedido.ninoId, pedido.preparacionId, pedido.nutriente, motor as Motor)
  if (elegido) return res.status(200).json(await generarRecetaCreativa(pedido, { conocimiento, elegido: async () => elegido }))
  // Si ese plato ya no es un candidato (la sugerencia quedó vieja), una comida completa nueva para esa comida: nunca un plato suelto
  if (pedido.momento) {
    const { preparacionId: _sinPlato, ...sinPlato } = pedido
    return res.status(200).json(await generarRecetaCreativa(sinPlato, { conocimiento }))
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
