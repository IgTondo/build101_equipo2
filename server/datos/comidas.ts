// POST /api/registrar-comida (B6): primero Mongo (el bronze, la fuente de verdad), después Neo4j (el conocimiento).
// Calcula la nutrición con la tabla, aprende (aceptación, exposiciones, patrones), arma "qué aprendí" y las alertas.
import { randomUUID } from 'node:crypto'
import type { Alerta, RegistrarComidaReq, RegistrarComidaRes } from '../../shared/contratos.js'
import { queAprendi } from '../aprendizaje/aprendi.js'
import { calcularEstado } from '../aprendizaje/estado.js'
import { almacen, sinFrenar } from '../grafo/almacen.js'
import { redondearRango } from '../nutricion/calcular.js'
import { coberturaDia, evaluarAlertas, semana } from '../nutricion/progreso.js'
import { preparacionesCatalogo, resolverAlimentos } from './catalogos.js'
import { idsDeAlimentos, leerNino, objetivoDe } from './cargar.js'
import { sumarDias } from './fechas.js'
import { asegurarIndices, col } from './mongo.js'
import { guardarPatron } from './perfiles.js'
import { resolverComida } from './resolver.js'

export async function registrarComida(req: RegistrarComidaReq, op: { ahora?: Date } = {}): Promise<RegistrarComidaRes> {
  await asegurarIndices()
  const nino = await leerNino(req.ninoId)
  const previas = await col.comidas().find({ ninoId: req.ninoId }).sort({ fechaISO: 1 }).toArray()
  const catalogo = preparacionesCatalogo()
  const ingredientesNuevos = req.analisis.items.flatMap((it) => it.ingredientes.map((i) => i.alimentoId))
  const alimentos = await resolverAlimentos([...idsDeAlimentos(catalogo, previas), ...ingredientesNuevos])
  const nombres = new Map(previas.flatMap((c) => c.items.map((it) => [it.preparacionId, it.nombre] as const)))

  // 1. Bronze: el documento de la comida, con todo
  const comida = resolverComida(req, { id: `c_${randomUUID()}`, creadoISO: (op.ahora ?? new Date()).toISOString(), alimentos, catalogo, nombres })
  await col.comidas().insertOne(comida)
  const todas = [...previas, comida]

  // 2. Silver: el estado antes y después de esta comida (se recalcula de cero; son milisegundos)
  const antes = calcularEstado(nino, previas, catalogo)
  const despues = calcularEstado(nino, todas, catalogo)
  const objetivo = objetivoDe(nino)

  // 3. Las alertas que disparó esta comida (§10.4): las nuevas, más tos o arcadas si aparecieron ahora
  const hace14 = calcularEstado(nino, todas, catalogo, { hasta: sumarDias(req.dia, -14) })
  // Si se carga una comida con fecha pasada, las alertas se miran al día de esa comida (sin las posteriores)
  const hayPosteriores = previas.some((c) => c.dia > req.dia)
  const alDia = (lista: typeof todas, estado: typeof antes) => (hayPosteriores ? calcularEstado(nino, lista, catalogo, { hasta: req.dia }) : estado)
  const alertasAntes = evaluarAlertas(nino, previas, alDia(previas, antes), hace14, req.dia, semana(previas, req.dia, objetivo))
  const alertasDespues = evaluarAlertas(nino, todas, alDia(todas, despues), hace14, req.dia, semana(todas, req.dia, objetivo))
  const tiposAntes = new Set(alertasAntes.map((a) => a.tipo))
  const alertas: Alerta[] = alertasDespues.filter(
    (a) =>
      !tiposAntes.has(a.tipo) ||
      (a.tipo === 'atragantamiento' && comida.conducta.includes('atragantamiento')) ||
      (a.tipo === 'arcadas' && comida.conducta.includes('arcadas')),
  )

  // 4. El conocimiento al grafo (Neo4j o Mongo, §4.3). Si falla, la comida no se pierde: reconstruir-grafo lo rehace.
  await sinFrenar('escribir la comida en el grafo', () => almacen().escribirComida(comida, despues))
  await col.ninos().updateOne(
    { _id: nino._id },
    { $set: { patrones: despues.patrones.map(guardarPatron), actualizadoISO: new Date().toISOString() } },
  )

  return {
    comidaId: comida._id,
    nutrientesComida: redondearRango(comida.nutrientes),
    dia: coberturaDia(req.dia, todas, objetivo),
    aprendi: queAprendi(antes, despues, comida, nino.reglas),
    alertas,
  }
}
