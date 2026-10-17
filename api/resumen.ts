// GET /api/resumen?ninoId → ResumenRes
// Dueño: pista C (C8, PLAN.md §9). Los números los arma el código (server/resumen/numeros.ts); el texto, Claude Haiku 5.5
// con "usá solo estos números" y un chequeo por código, o una plantilla si no se puede (server/resumen/texto.ts).
// El progreso y el perfil salen de B (obtenerProgreso y obtenerPerfil) cuando hay MONGODB_URI; si no, de los fixtures,
// y entonces la respuesta lleva x-nibble-stub: 1 (el texto es real, pero los números son de ejemplo).
import type { ResumenRes } from '../shared/contratos.js'
import { ErrorNibble, HEADER_STUB, manejar, param, permitir } from '../server/http.js'
import { cargarPerfil, cargarProgreso } from '../server/resumen/datos.js'
import { hechosResumen } from '../server/resumen/numeros.js'
import { redactarResumen } from '../server/resumen/texto.js'

export default manejar(async (req, res) => {
  if (!permitir(req, res, 'GET')) return
  const ninoId = param(req, 'ninoId')?.trim()
  if (!ninoId) throw new ErrorNibble('entrada_invalida', 'Falta indicar de qué chico es el resumen.', { campo: 'ninoId' })

  const [progreso, perfil] = await Promise.all([
    cargarProgreso(ninoId),
    cargarPerfil(ninoId).catch((e: unknown) => {
      if (e instanceof ErrorNibble && e.codigo === 'no_encontrado') throw e
      console.warn(JSON.stringify({ evento: 'resumen', aviso: 'sin_perfil', error: e instanceof Error ? e.message : String(e) }))
      return null // el resumen se arma igual, sin nombre ni edad
    }),
  ])

  const { hechos, lineas } = hechosResumen(progreso.datos, perfil?.datos ?? null)
  const { texto, fuente } = await redactarResumen(hechos, lineas)

  if (progreso.deFixture || perfil?.deFixture) res.setHeader(HEADER_STUB, '1')
  res.setHeader('x-nibble-resumen-fuente', fuente)
  const cuerpo: ResumenRes = { texto, progreso: progreso.datos, generadoISO: new Date().toISOString() }
  res.status(200).json(cuerpo)
})
