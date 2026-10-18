// El grafo en Mongo (MOTOR_GRAFO=mongo, PLAN.md §4.3 y §13): colecciones `nodos` y `relaciones`, misma interfaz que
// Neo4j. Es el plan B si Neo4j no conecta desde Vercel, y no pierde nada: guarda la misma proyección.
import type { AnyBulkWriteOperation } from 'mongodb'
import { preparacionesCatalogo } from '../datos/catalogos.js'
import { type NodoDoc, type RelacionDoc, col, pingMongo } from '../datos/mongo.js'
import type { AlmacenGrafo, GrafoVista } from './almacen.js'
import { armarVista } from './almacen-neo4j.js'
import { type Proyeccion, TIPOS_ESTADO, proyectarCatalogo, proyectarComida, proyectarConocimiento, proyectarNino, unir } from './proyeccion.js'

const idNodo = (label: string, id: string) => `${label}:${id}`

async function escribir(p: Proyeccion): Promise<void> {
  const nodos: AnyBulkWriteOperation<NodoDoc>[] = p.nodos.map((n) => ({
    updateOne: {
      filter: { _id: idNodo(n.label, n.id) },
      update: {
        $set: { label: n.label, id: n.id, ...Object.fromEntries(Object.entries(n.props).map(([k, v]) => [`props.${k}`, v])) },
        $setOnInsert: { ninoId: n.ninoId },
      },
      upsert: true,
    },
  }))
  const relaciones: AnyBulkWriteOperation<RelacionDoc>[] = p.aristas.map((a) => {
    const desde = idNodo(a.desde.label, a.desde.id)
    const hasta = idNodo(a.hasta.label, a.hasta.id)
    return {
      updateOne: {
        filter: { _id: `${a.tipo}:${desde}->${hasta}` },
        update: { $set: { tipo: a.tipo, desde, hasta, ninoId: a.ninoId, props: a.props } },
        upsert: true,
      },
    }
  })
  if (nodos.length) await col.nodos().bulkWrite(nodos, { ordered: false })
  if (relaciones.length) await col.relaciones().bulkWrite(relaciones, { ordered: false })
}

async function borrarConocimiento(ninoId: string): Promise<void> {
  await col.relaciones().deleteMany({ ninoId, tipo: { $in: [...TIPOS_ESTADO, 'TIENE_PATRON'] } })
  // Los atributos e ingredientes de sus preparaciones propias se reescriben enteros (no quedan aristas viejas)
  await col.relaciones().deleteMany({ ninoId, tipo: { $in: ['TIENE', 'CONTIENE'] }, desde: { $regex: '^Preparacion:' } })
  const patrones = await col.nodos().find({ ninoId, label: 'Patron' }, { projection: { _id: 1 } }).toArray()
  const ids = patrones.map((p) => p._id)
  if (ids.length) {
    await col.relaciones().deleteMany({ desde: { $in: ids } })
    await col.nodos().deleteMany({ _id: { $in: ids } })
  }
}

export const almacenMongo: AlmacenGrafo = {
  motor: 'mongo',

  async asegurarEsquema() {
    await col.nodos().createIndex({ ninoId: 1, label: 1 })
    await col.relaciones().createIndexes([{ key: { ninoId: 1, tipo: 1 } }, { key: { desde: 1 } }, { key: { hasta: 1 } }])
  },

  async sembrar(preparaciones, alimentos) {
    await escribir(proyectarCatalogo(preparaciones, alimentos))
  },

  async escribirNino(nino, objetivo, estado) {
    await col.relaciones().deleteMany({ ninoId: nino._id, tipo: { $in: ['ALERGICO_A', 'OBJETIVO', 'SIGUE'] } })
    const reglas = await col.nodos().find({ ninoId: nino._id, label: 'Regla' }, { projection: { _id: 1 } }).toArray()
    if (reglas.length) {
      await col.relaciones().deleteMany({ desde: { $in: reglas.map((r) => r._id) } })
      await col.nodos().deleteMany({ _id: { $in: reglas.map((r) => r._id) } })
    }
    await borrarConocimiento(nino._id)
    await escribir(unir(proyectarNino(nino, objetivo), proyectarConocimiento(nino._id, estado, new Set(preparacionesCatalogo().keys()))))
  },

  async escribirComida(comida, estado) {
    await borrarConocimiento(comida.ninoId)
    const catalogo = new Set(preparacionesCatalogo().keys())
    await escribir(unir(proyectarComida(comida, catalogo), proyectarConocimiento(comida.ninoId, estado, catalogo)))
  },

  async borrarNino(ninoId) {
    await col.relaciones().deleteMany({ ninoId })
    await col.nodos().deleteMany({ ninoId })
  },

  async subgrafo(ninoId): Promise<GrafoVista> {
    const estados = await col.relaciones().find({ ninoId, tipo: { $in: [...TIPOS_ESTADO] } }).toArray()
    const prepIds = estados.map((r) => r.hasta)
    const [nodosPrep, tiene, patrones, nino] = await Promise.all([
      col.nodos().find({ _id: { $in: prepIds } }).toArray(),
      col.relaciones().find({ tipo: 'TIENE', desde: { $in: prepIds } }).toArray(),
      col.nodos().find({ ninoId, label: 'Patron' }).toArray(),
      col.nodos().findOne({ _id: idNodo('Nino', ninoId) }),
    ])
    const condiciones = await col.relaciones().find({ tipo: 'CONDICION', desde: { $in: patrones.map((p) => p._id) } }).toArray()
    const nombre = new Map(nodosPrep.map((n) => [n._id, String(n.props.nombre ?? n.id)]))
    const sinLabel = (id: string) => id.slice(id.indexOf(':') + 1)
    return armarVista(
      'mongo',
      ninoId,
      String(nino?.props.nombre ?? ninoId),
      estados.map((r) => ({
        id: sinLabel(r.hasta), nombre: nombre.get(r.hasta) ?? sinLabel(r.hasta), estado: r.tipo,
        puntaje: Number(r.props.puntaje ?? 0), veces: Number(r.props.veces ?? 0),
        atributos: tiene.filter((t) => t.desde === r.hasta).map((t) => sinLabel(t.hasta)),
      })),
      patrones.map((p) => ({
        id: p.id, texto: String(p.props.texto ?? ''), resultado: String(p.props.resultado ?? ''),
        condiciones: condiciones.filter((c) => c.desde === p._id).map((c) => sinLabel(c.hasta)),
      })),
    )
  },

  async borrarHuerfanas() {
    // Las preparaciones fuera del catálogo de antes (compartidas entre chicos, sin ninoId) que ya nadie usa
    const candidatas = await col.nodos().find({ label: 'Preparacion', ninoId: null, 'props.catalogo': { $ne: true } }, { projection: { _id: 1 } }).toArray()
    const ids = candidatas.map((n) => n._id)
    if (!ids.length) return 0
    const usadas = new Set(await col.relaciones().distinct('hasta', { hasta: { $in: ids } }))
    const huerfanas = ids.filter((id) => !usadas.has(id))
    if (!huerfanas.length) return 0
    await col.relaciones().deleteMany({ desde: { $in: huerfanas } })
    await col.nodos().deleteMany({ _id: { $in: huerfanas } })
    return huerfanas.length
  },

  ping: pingMongo,
}
