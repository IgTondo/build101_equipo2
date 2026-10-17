// GET /api/nutricion?ninoId&dia=YYYY-MM-DD → CoberturaDia
// Dueño: pista B (B7, PLAN.md §8). Sin `dia`, hoy en Uruguay. Sin MONGODB_URI responde el fixture con x-nibble-stub: 1.
import { esDia, hoyUruguay } from '../server/datos/fechas.js'
import { hayMongo } from '../server/datos/mongo.js'
import { obtenerNutricionDia } from '../server/datos/tablero.js'
import { ErrorNibble, manejar, param, permitir, responderStub } from '../server/http.js'

export default manejar(async (req, res) => {
  if (!permitir(req, res, 'GET')) return
  if (!hayMongo()) return responderStub(res, 'nutricion')
  const ninoId = param(req, 'ninoId')
  if (!ninoId) throw new ErrorNibble('entrada_invalida', 'Falta ninoId.')
  const dia = param(req, 'dia') ?? hoyUruguay()
  if (!esDia(dia)) throw new ErrorNibble('entrada_invalida', 'dia tiene que ser YYYY-MM-DD.')
  res.status(200).json(await obtenerNutricionDia(ninoId, dia))
})
