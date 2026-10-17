// POST /api/perfil { CrearPerfilReq } → CrearPerfilRes · GET /api/perfil?ninoId → Perfil
// GET /api/perfil?ninoId&vista=grafo → el subgrafo del chico para visualizarlo (C13 + B13). Va acá y no en un
// /api/grafo propio porque Vercel Hobby permite 12 funciones.
// Dueño: pista B (B8, PLAN.md §8). Sin MONGODB_URI responde los fixtures con x-nibble-stub: 1.
import { leerNino } from '../server/datos/cargar.js'
import { hayMongo } from '../server/datos/mongo.js'
import { crearPerfil, obtenerPerfil } from '../server/datos/perfiles.js'
import { validarPerfil } from '../server/datos/validar.js'
import { almacen } from '../server/grafo/almacen.js'
import { ErrorNibble, manejar, param, permitir, responderStub } from '../server/http.js'

export default manejar(async (req, res) => {
  if (!permitir(req, res, 'GET', 'POST')) return
  if (req.method === 'POST') {
    const perfil = validarPerfil(req.body)
    if (!hayMongo()) return responderStub(res, 'perfil-crear')
    res.status(200).json(await crearPerfil(perfil))
    return
  }
  if (!hayMongo()) return responderStub(res, param(req, 'vista') === 'grafo' ? 'perfil-grafo' : 'perfil')
  const ninoId = param(req, 'ninoId')
  if (!ninoId) throw new ErrorNibble('entrada_invalida', 'Falta ninoId.')
  if (param(req, 'vista') === 'grafo') {
    await leerNino(ninoId)
    res.status(200).json(await almacen().subgrafo(ninoId))
    return
  }
  res.status(200).json(await obtenerPerfil(ninoId))
})
