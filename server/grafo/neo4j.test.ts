// El motor Neo4j contra un servidor real. Solo corre si se pide: NEO4J_PRUEBA=1 y NEO4J_URI (+ usuario y clave).
// Nunca borra la base entera: solo lo del chico de prueba ("prueba-tomas"); el catálogo se escribe con MERGE.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { calcularEstado } from '../aprendizaje/estado.js'
import { objetivoDe } from '../datos/cargar.js'
import { usarCatalogos } from '../datos/catalogos.js'
import { alimentosPrueba, catalogoPrueba, ninoDoc, sintetico } from '../datos/prueba/catalogos.js'
import { resolverComida } from '../datos/resolver.js'
import { coberturaDia } from '../nutricion/progreso.js'
import { almacenNeo4j } from './almacen-neo4j.js'
import { cerrarNeo4j, consultar } from './cliente.js'

const habilitado = process.env.NEO4J_PRUEBA === '1' && Boolean(process.env.NEO4J_URI)
const ninoId = 'prueba-tomas'

// Contra Aura cada consulta tarda: 60 s por test (estas suites corren solo si se piden)
describe.skipIf(!habilitado)('motor Neo4j (servidor real)', { timeout: 60_000 }, () => {
  const catalogo = catalogoPrueba()
  const alimentos = alimentosPrueba()
  const s = sintetico('tomas')
  const nino = { ...ninoDoc(s), _id: ninoId }
  const comidas = s.comidas.map((req, i) =>
    resolverComida({ ...req, ninoId }, { id: `${ninoId}-${String(i + 1).padStart(2, '0')}`, creadoISO: req.fechaISO, alimentos, catalogo }),
  )
  const final = calcularEstado(nino, comidas, catalogo)

  beforeAll(async () => {
    usarCatalogos({ alimentos })
    await almacenNeo4j.asegurarEsquema()
    await almacenNeo4j.borrarNino(ninoId)
  }, 60_000)

  afterAll(async () => {
    await almacenNeo4j.borrarNino(ninoId)
    usarCatalogos({ alimentos: null })
    await cerrarNeo4j()
  }, 60_000)

  it('constraints de unicidad (B3)', async () => {
    const nombres = (await consultar<{ name: string }>('SHOW CONSTRAINTS YIELD name RETURN name')).map((r) => r.name)
    expect(nombres).toEqual(expect.arrayContaining(['nino_id', 'comida_id', 'item_id', 'preparacion_id', 'ingrediente_id', 'nutriente_nombre', 'atributo_id']))
  })

  it('seed del catálogo (B5): preparaciones con TIENE y CONTIENE, ingredientes con APORTA; sembrar dos veces no duplica', async () => {
    await almacenNeo4j.sembrar([...catalogo.values()], [...alimentos.values()])
    await almacenNeo4j.sembrar([...catalogo.values()], [...alimentos.values()])
    // Solo las del catálogo actual: en una base compartida puede haber preparaciones de seeds anteriores
    const [preps] = await consultar<{ n: number }>('MATCH (p:Preparacion {catalogo: true}) WHERE p.id IN $ids RETURN count(p) AS n', { ids: [...catalogo.keys()] })
    expect(preps?.n).toBe(catalogo.size)
    const [tiene] = await consultar<{ n: number }>("MATCH (:Preparacion {id: 'bastones_queso_horno'})-[r:TIENE]->(:Atributo) RETURN count(r) AS n")
    expect(tiene?.n).toBe(8)
    const [calcio] = await consultar<{ mg: number }>(
      `MATCH (:Preparacion {id: 'bastones_queso_horno'})-[c:CONTIENE]->(:Ingrediente)-[a:APORTA]->(:Nutriente {nombre: 'calcio_mg'})
       RETURN sum(c.gramos * a.por100g / 100) AS mg`,
    )
    expect(calcio?.mg).toBeGreaterThan(150)
  }, 60_000)

  it('escribe al chico (B8) y sus 20 comidas, cada una en una transacción con el conocimiento al día (B6)', async () => {
    await almacenNeo4j.escribirNino(nino, objetivoDe(nino), calcularEstado(nino, [], catalogo))
    const [inicial] = await consultar<{ acepta: number; alergia: string; reglas: number }>(
      `MATCH (n:Nino {id: $id}) OPTIONAL MATCH (n)-[:ACEPTA]->(p) WITH n, count(p) AS acepta
       MATCH (n)-[:ALERGICO_A]->(a:Alergeno) OPTIONAL MATCH (n)-[:SIGUE]->(r:Regla) RETURN acepta, a.id AS alergia, count(r) AS reglas`,
      { id: ninoId },
    )
    expect(inicial).toEqual({ acepta: 5, alergia: 'huevo', reglas: 1 })
    for (let i = 0; i < comidas.length; i++) {
      const c = comidas[i]
      if (c) await almacenNeo4j.escribirComida(c, calcularEstado(nino, comidas.slice(0, i + 1), catalogo))
    }
    const [r] = await consultar<{ comidas: number; items: number; acepta: number; patrones: number }>(
      `MATCH (n:Nino {id: $id})
       CALL (n) { MATCH (n)-[:COMIO]->(c:Comida) RETURN count(c) AS comidas }
       CALL (n) { MATCH (n)-[:COMIO]->(:Comida)-[:INCLUYE]->(i:Item) RETURN count(i) AS items }
       CALL (n) { MATCH (n)-[:ACEPTA]->(p:Preparacion) RETURN count(p) AS acepta }
       CALL (n) { MATCH (n)-[:TIENE_PATRON]->(p:Patron) RETURN count(p) AS patrones }
       RETURN comidas, items, acepta, patrones`,
      { id: ninoId },
    )
    expect(r).toEqual({ comidas: 20, items: final.observaciones.length, acepta: 6, patrones: final.patrones.length })
  }, 120_000)

  it('la consulta de nutrientes del día sobre el grafo (§8) da lo mismo que el código', async () => {
    const [r] = await consultar<{ mg: number }>(
      `MATCH (:Nino {id: $id})-[:COMIO]->(c:Comida {dia: '2026-10-16'})-[:INCLUYE]->(i:Item)-[k:CONTIENE]->(:Ingrediente)-[ap:APORTA]->(:Nutriente {nombre: 'calcio_mg'})
       RETURN sum(k.gramos * i.fraccion * ap.por100g / 100) AS mg`,
      { id: ninoId },
    )
    const codigo = coberturaDia('2026-10-16', comidas, objetivoDe(nino)).consumido.valor.calcio_mg
    expect(r?.mg).toBeCloseTo(codigo, 0)
  })

  it('cada ítem guarda su cita y sus atributos observados; las condiciones de los patrones apuntan a atributos', async () => {
    const [item] = await consultar<{ cita: string; textura: string; coccion: string }>(
      `MATCH (:Nino {id: $id})-[:COMIO]->(:Comida {dia: '2026-10-07', momento: 'cena'})-[:INCLUYE]->(i:Item)-[:ES]->(:Preparacion {id: 'hamburguesa_casera'})
       RETURN i.cita AS cita, i.textura AS textura, i.coccion AS coccion`,
      { id: ninoId },
    )
    expect(item).toEqual({ cita: 'La hamburguesa: la sacó del plato, porque no le gusta cómo se siente en la boca.', textura: 'jugoso', coccion: 'plancha' })
    const condiciones = await consultar<{ id: string }>(
      "MATCH (:Nino {id: $id})-[:TIENE_PATRON]->(p:Patron {clave: 'textura=jugoso → rechaza'})-[:CONDICION]->(a:Atributo) RETURN a.id AS id",
      { id: ninoId },
    )
    expect(condiciones).toEqual([{ id: 'textura:jugoso' }])
  })

  it('reescribir una comida no duplica nada (MERGE); el subgrafo sirve para visualizar; borrar no deja rastros', async () => {
    const ultima = comidas.at(-1)
    if (ultima) await almacenNeo4j.escribirComida(ultima, final)
    const [n] = await consultar<{ items: number }>('MATCH (:Nino {id: $id})-[:COMIO]->(:Comida)-[:INCLUYE]->(i:Item) RETURN count(i) AS items', { id: ninoId })
    expect(n?.items).toBe(final.observaciones.length)
    const vista = await almacenNeo4j.subgrafo(ninoId)
    expect(vista.aristas.filter((a) => a.tipo === 'ACEPTA')).toHaveLength(6)
    expect(vista.nodos.find((x) => x.id === 'prep:bastones_queso_horno')?.props).toMatchObject({ estado: 'EN_PROCESO', veces: 5 })
    await almacenNeo4j.borrarNino(ninoId)
    const [resto] = await consultar<{ n: number }>("MATCH (x) WHERE x.id STARTS WITH 'prueba-tomas' RETURN count(x) AS n")
    expect(resto?.n).toBe(0)
  }, 60_000)
})
