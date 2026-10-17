// El grafo en Neo4j (PLAN.md §8). Las etiquetas y los tipos salen de listas cerradas (proyeccion.ts), así que se
// pueden interpolar en el Cypher sin riesgo; los valores siempre van como parámetros.
import type { ManagedTransaction } from 'neo4j-driver'
import { preparacionesCatalogo } from '../datos/catalogos.js'
import type { AlmacenGrafo, GrafoVista } from './almacen.js'
import { consultar, enTransaccion, pingNeo4j } from './cliente.js'
import {
  type Label, type Proyeccion, type TipoArista, LABELS, TIPOS_ESTADO, proyectarCatalogo, proyectarComida, proyectarConocimiento,
  proyectarNino, unir,
} from './proyeccion.js'

const clave = (label: Label) => (label === 'Nutriente' ? 'nombre' : 'id')

type Ejecutor = (cypher: string, parametros: Record<string, unknown>) => Promise<unknown>

/** Todas las aristas que puede generar proyeccion.ts: tipo, etiqueta de origen y de destino. */
const GRUPOS: readonly (readonly [TipoArista, Label, Label])[] = [
  ['APORTA', 'Ingrediente', 'Nutriente'], ['TIENE_ALERGENO', 'Ingrediente', 'Alergeno'], ['TIENE', 'Preparacion', 'Atributo'],
  ['CONTIENE', 'Preparacion', 'Ingrediente'], ['FORTIFICADA_DE', 'Preparacion', 'Preparacion'],
  ['ALERGICO_A', 'Nino', 'Alergeno'], ['SIGUE', 'Nino', 'Regla'], ['CONDICION', 'Regla', 'Atributo'], ['CONDICION', 'Regla', 'Contexto'],
  ['OBJETIVO', 'Nino', 'Nutriente'],
  ['COMIO', 'Nino', 'Comida'], ['EN_CONTEXTO', 'Comida', 'Contexto'], ['RESULTADO', 'Comida', 'Reaccion'], ['INCLUYE', 'Comida', 'Item'],
  ['ES', 'Item', 'Preparacion'], ['CONTIENE', 'Item', 'Ingrediente'],
  ['ACEPTA', 'Nino', 'Preparacion'], ['EN_PROCESO', 'Nino', 'Preparacion'], ['RECHAZA', 'Nino', 'Preparacion'],
  ['TIENE_PATRON', 'Nino', 'Patron'], ['CONDICION', 'Patron', 'Atributo'], ['CONDICION', 'Patron', 'Contexto'],
]

/** El texto de la consulta de escritura es siempre el mismo (con las listas vacías que toquen): Neo4j la planifica una vez. */
function consultaDeEscritura(borrados: readonly string[]): string {
  return [
    ...borrados.map((b) => `CALL () { ${b} }`),
    ...LABELS.map((label, i) => `CALL () { UNWIND $n${i} AS f MERGE (n:${label} {${clave(label)}: f.id}) SET n += f.props }`),
    ...GRUPOS.map(
      ([tipo, de, a], i) =>
        `CALL () { UNWIND $a${i} AS f MATCH (x:${de} {${clave(de)}: f.desde}) MATCH (y:${a} {${clave(a)}: f.hasta}) MERGE (x)-[r:${tipo}]->(y) SET r += f.props }`,
    ),
    'RETURN 1 AS ok',
  ].join('\n')
}

/**
 * Una sola consulta por escritura (una ida y vuelta, que contra Aura es lo que más cuesta): primero los borrados que
 * se pidan, después un `CALL () { UNWIND … MERGE … }` por etiqueta y, al final, uno por tipo de arista.
 */
async function escribir(p: Proyeccion, run: Ejecutor, borrados: readonly string[] = [], parametros: Record<string, unknown> = {}): Promise<void> {
  const params: Record<string, unknown> = { ...parametros }
  LABELS.forEach((label, i) => {
    const filas = new Map<string, Record<string, unknown>>()
    for (const n of p.nodos) if (n.label === label) filas.set(n.id, { ...(filas.get(n.id) ?? {}), ...n.props })
    params[`n${i}`] = [...filas].map(([id, props]) => ({ id, props }))
  })
  GRUPOS.forEach(([tipo, de, a], i) => {
    params[`a${i}`] = p.aristas
      .filter((x) => x.tipo === tipo && x.desde.label === de && x.hasta.label === a)
      .map((x) => ({ desde: x.desde.id, hasta: x.hasta.id, props: x.props }))
  })
  const sinGrupo = p.aristas.find((x) => !GRUPOS.some(([t, de, a]) => x.tipo === t && x.desde.label === de && x.hasta.label === a))
  if (sinGrupo) throw new Error(`Arista sin grupo en almacen-neo4j: ${sinGrupo.tipo} ${sinGrupo.desde.label}→${sinGrupo.hasta.label}`)
  await run(consultaDeEscritura(borrados), params)
}

const enTx = (tx: ManagedTransaction): Ejecutor => (cypher, parametros) => tx.run(cypher, parametros)

/** El conocimiento del chico que se recalcula entero: aristas de estado y patrones (usa el parámetro $ninoId). */
const BORRAR_CONOCIMIENTO = [
  `MATCH (:Nino {id: $ninoId})-[r:${TIPOS_ESTADO.join('|')}]->() DELETE r`,
  'MATCH (:Nino {id: $ninoId})-[:TIENE_PATRON]->(p:Patron) DETACH DELETE p',
]

const CONSTRAINTS = [
  'CREATE CONSTRAINT nino_id IF NOT EXISTS FOR (n:Nino) REQUIRE n.id IS UNIQUE',
  'CREATE CONSTRAINT comida_id IF NOT EXISTS FOR (n:Comida) REQUIRE n.id IS UNIQUE',
  'CREATE CONSTRAINT item_id IF NOT EXISTS FOR (n:Item) REQUIRE n.id IS UNIQUE',
  'CREATE CONSTRAINT preparacion_id IF NOT EXISTS FOR (n:Preparacion) REQUIRE n.id IS UNIQUE',
  'CREATE CONSTRAINT ingrediente_id IF NOT EXISTS FOR (n:Ingrediente) REQUIRE n.id IS UNIQUE',
  'CREATE CONSTRAINT nutriente_nombre IF NOT EXISTS FOR (n:Nutriente) REQUIRE n.nombre IS UNIQUE',
  'CREATE CONSTRAINT atributo_id IF NOT EXISTS FOR (n:Atributo) REQUIRE n.id IS UNIQUE',
  'CREATE CONSTRAINT contexto_id IF NOT EXISTS FOR (n:Contexto) REQUIRE n.id IS UNIQUE',
  'CREATE CONSTRAINT reaccion_id IF NOT EXISTS FOR (n:Reaccion) REQUIRE n.id IS UNIQUE',
  'CREATE CONSTRAINT alergeno_id IF NOT EXISTS FOR (n:Alergeno) REQUIRE n.id IS UNIQUE',
  'CREATE CONSTRAINT regla_id IF NOT EXISTS FOR (n:Regla) REQUIRE n.id IS UNIQUE',
  'CREATE CONSTRAINT patron_id IF NOT EXISTS FOR (n:Patron) REQUIRE n.id IS UNIQUE',
]

export const almacenNeo4j: AlmacenGrafo = {
  motor: 'neo4j',

  async asegurarEsquema() {
    for (const c of CONSTRAINTS) await consultar(c, {}, 'escribir')
  },

  async sembrar(preparaciones, alimentos) {
    await enTransaccion((tx) => escribir(proyectarCatalogo(preparaciones, alimentos), enTx(tx)))
  },

  async escribirNino(nino, objetivo, estado) {
    const borrados = [
      'MATCH (:Nino {id: $ninoId})-[r:ALERGICO_A|OBJETIVO]->() DELETE r',
      'MATCH (:Nino {id: $ninoId})-[:SIGUE]->(g:Regla) DETACH DELETE g',
      ...BORRAR_CONOCIMIENTO,
    ]
    await enTransaccion((tx) =>
      escribir(unir(proyectarNino(nino, objetivo), proyectarConocimiento(nino._id, estado)), enTx(tx), borrados, { ninoId: nino._id }),
    )
  },

  async escribirComida(comida, estado) {
    const catalogo = new Set(preparacionesCatalogo().keys())
    await enTransaccion((tx) =>
      escribir(unir(proyectarComida(comida, catalogo), proyectarConocimiento(comida.ninoId, estado)), enTx(tx), BORRAR_CONOCIMIENTO, { ninoId: comida.ninoId }),
    )
  },

  async borrarNino(ninoId) {
    await enTransaccion(async (tx) => {
      const run = enTx(tx)
      await run('MATCH (:Nino {id: $id})-[:COMIO]->(:Comida)-[:INCLUYE]->(i:Item) DETACH DELETE i', { id: ninoId })
      await run('MATCH (:Nino {id: $id})-[:COMIO]->(c:Comida) DETACH DELETE c', { id: ninoId })
      await run('MATCH (:Nino {id: $id})-[:TIENE_PATRON|SIGUE]->(x) DETACH DELETE x', { id: ninoId })
      await run('MATCH (n:Nino {id: $id}) DETACH DELETE n', { id: ninoId })
    })
  },

  async subgrafo(ninoId): Promise<GrafoVista> {
    const preps = await consultar<{ id: string; nombre: string; estado: string; puntaje: number; veces: number; atributos: string[] }>(
      `MATCH (:Nino {id: $id})-[r:${TIPOS_ESTADO.join('|')}]->(p:Preparacion)
       OPTIONAL MATCH (p)-[:TIENE]->(a:Atributo)
       RETURN p.id AS id, p.nombre AS nombre, type(r) AS estado, r.puntaje AS puntaje, r.veces AS veces, collect(a.id) AS atributos`,
      { id: ninoId },
    )
    const patrones = await consultar<{ id: string; texto: string; resultado: string; condiciones: string[] }>(
      `MATCH (:Nino {id: $id})-[:TIENE_PATRON]->(p:Patron)
       OPTIONAL MATCH (p)-[:CONDICION]->(x)
       RETURN p.id AS id, p.texto AS texto, p.resultado AS resultado, collect(x.id) AS condiciones`,
      { id: ninoId },
    )
    const nino = await consultar<{ nombre: string }>('MATCH (n:Nino {id: $id}) RETURN n.nombre AS nombre', { id: ninoId })
    return armarVista('neo4j', ninoId, nino[0]?.nombre ?? ninoId, preps, patrones)
  },

  ping: pingNeo4j,
}

/** Mismo formato de vista para los dos motores. */
export function armarVista(
  motor: GrafoVista['motor'],
  ninoId: string,
  nombre: string,
  preps: { id: string; nombre: string; estado: string; puntaje: number; veces: number; atributos: string[] }[],
  patrones: { id: string; texto: string; resultado: string; condiciones: string[] }[],
): GrafoVista {
  const nodos = new Map<string, GrafoVista['nodos'][number]>([[`nino:${ninoId}`, { id: `nino:${ninoId}`, tipo: 'Nino', nombre, props: {} }]])
  const aristas: GrafoVista['aristas'] = []
  const atributo = (id: string) => {
    if (!nodos.has(`atr:${id}`)) nodos.set(`atr:${id}`, { id: `atr:${id}`, tipo: 'Atributo', nombre: id.replace(':', '='), props: {} })
    return `atr:${id}`
  }
  for (const p of preps) {
    nodos.set(`prep:${p.id}`, { id: `prep:${p.id}`, tipo: 'Preparacion', nombre: p.nombre, props: { estado: p.estado, puntaje: p.puntaje, veces: p.veces } })
    aristas.push({ desde: `nino:${ninoId}`, hasta: `prep:${p.id}`, tipo: p.estado, props: { puntaje: p.puntaje } })
    for (const a of p.atributos) aristas.push({ desde: `prep:${p.id}`, hasta: atributo(a), tipo: 'TIENE', props: {} })
  }
  for (const p of patrones) {
    nodos.set(`pat:${p.id}`, { id: `pat:${p.id}`, tipo: 'Patron', nombre: p.texto, props: { resultado: p.resultado } })
    aristas.push({ desde: `nino:${ninoId}`, hasta: `pat:${p.id}`, tipo: 'TIENE_PATRON', props: {} })
    for (const c of p.condiciones) aristas.push({ desde: `pat:${p.id}`, hasta: atributo(c), tipo: 'CONDICION', props: {} })
  }
  return { motor, nodos: [...nodos.values()], aristas }
}
