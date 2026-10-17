// POST /api/registrar-comida { RegistrarComidaReq } → RegistrarComidaRes
// Dueño: pista B (B6, PLAN.md §8). El contrato se valida siempre; sin MONGODB_URI responde el fixture con
// x-nibble-stub: 1 (para desarrollar sin base).
import { registrarComida } from '../server/datos/comidas.js'
import { hayMongo } from '../server/datos/mongo.js'
import { validarRegistrarComida } from '../server/datos/validar.js'
import { manejar, permitir, responderStub } from '../server/http.js'

export default manejar(async (req, res) => {
  if (!permitir(req, res, 'POST')) return
  const comida = validarRegistrarComida(req.body)
  if (!hayMongo()) return responderStub(res, 'registrar-comida')
  res.status(200).json(await registrarComida(comida))
})
