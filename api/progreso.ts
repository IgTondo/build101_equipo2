// GET /api/progreso?ninoId&dias=28&motor=base|grafo&hasta=YYYY-MM-DD → Progreso
// Dueño: pista B (B7, PLAN.md §8). `motor` es el switch del tablero (§4.3); `hasta` fija "hoy" para historiales
// cargados con fecha pasada. Sin MONGODB_URI responde el fixture con x-nibble-stub: 1 (para desarrollar sin base).
import { MOTOR, type Motor } from '../shared/contratos.js'
import { esDia } from '../server/datos/fechas.js'
import { hayMongo } from '../server/datos/mongo.js'
import { obtenerProgreso } from '../server/datos/tablero.js'
import { ErrorNibble, manejar, param, permitir, responderStub } from '../server/http.js'

export default manejar(async (req, res) => {
  if (!permitir(req, res, 'GET')) return
  if (!hayMongo()) return responderStub(res, 'progreso')
  const ninoId = param(req, 'ninoId')
  if (!ninoId) throw new ErrorNibble('entrada_invalida', 'Falta ninoId.')
  const motor = param(req, 'motor') ?? 'grafo'
  if (!(MOTOR as readonly string[]).includes(motor)) throw new ErrorNibble('entrada_invalida', `motor tiene que ser ${MOTOR.join(' o ')}.`)
  const dias = Number(param(req, 'dias') ?? 28)
  if (!Number.isFinite(dias)) throw new ErrorNibble('entrada_invalida', 'dias tiene que ser un número.')
  const hasta = param(req, 'hasta')
  if (hasta && !esDia(hasta)) throw new ErrorNibble('entrada_invalida', 'hasta tiene que ser YYYY-MM-DD.')
  res.status(200).json(await obtenerProgreso(ninoId, { dias, motor: motor as Motor, ...(hasta ? { hasta } : {}) }))
})
