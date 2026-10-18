// Integración de la pista B contra un MongoDB real: los handlers de api/, el bronze en Mongo, el grafo en Mongo
// (MOTOR_GRAFO=mongo) y la reconstrucción, con Tomás y sus 20 comidas del dataset sintético (§10.5).
// Solo corre si se pide: MONGODB_URI_PRUEBA=mongodb://… (usa una base propia "nibble_test_<hora>" y la borra al final).
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import nutricionApi from '../../api/nutricion.js'
import perfilApi from '../../api/perfil.js'
import progresoApi from '../../api/progreso.js'
import registrarApi from '../../api/registrar-comida.js'
import saludApi from '../../api/salud.js'
import type { ErrorApi, Perfil, Progreso, RegistrarComidaRes, SaludRes } from '../../shared/contratos.js'
import type { GrafoVista } from '../grafo/almacen.js'
import { almacen } from '../grafo/almacen.js'
import { evidenciaDe } from '../grafo/evidencia.js'
import { reconstruirGrafo } from '../grafo/reconstruir.js'
import type { Handler } from '../http.js'
import { cargarNino } from './cargar.js'
import { usarCatalogos } from './catalogos.js'
import { obtenerContexto } from './contexto.js'
import { cerrarMongo, col, configurarMongo, db } from './mongo.js'
import { alimentosPrueba, catalogoPrueba, sintetico } from './prueba/catalogos.js'

const URI = process.env.MONGODB_URI_PRUEBA

async function llamar<T = unknown>(handler: Handler, req: { method: string; query?: Record<string, string>; body?: unknown }) {
  let status = 0
  let body: unknown
  const res = {
    status(c: number) {
      status = c
      return res
    },
    json(b: unknown) {
      body = b
      return res
    },
    setHeader() {
      return res
    },
    headersSent: false,
  }
  await handler({ query: {}, ...req } as unknown as VercelRequest, res as unknown as VercelResponse)
  return { status, body: body as T }
}

// Contra Atlas cada consulta tarda: 60 s por test (estas suites corren solo si se piden)
describe.skipIf(!URI)('pista B de punta a punta contra Mongo', { timeout: 60_000 }, () => {
  const tomas = sintetico('tomas')
  const respuestas: RegistrarComidaRes[] = []

  beforeAll(async () => {
    configurarMongo({ uri: URI ?? '', nombreDb: `nibble_test_${Date.now()}` })
    usarCatalogos({ alimentos: alimentosPrueba() })
    process.env.MOTOR_GRAFO = 'mongo'
    process.env.GRAFO_ESTRICTO = '1'
    await almacen('mongo').asegurarEsquema()
    await almacen('mongo').sembrar([...catalogoPrueba().values()], [...alimentosPrueba().values()])
  }, 60_000)

  afterAll(async () => {
    await db().dropDatabase()
    usarCatalogos({ alimentos: null })
    await cerrarMongo()
  }, 60_000)

  it('/api/salud: Mongo responde y el grafo está en Mongo', async () => {
    const r = await llamar<SaludRes>(saludApi, { method: 'GET' })
    expect(r.status).toBe(200)
    expect(r.body.servicios.mongo?.ok).toBe(true)
    expect(r.body.motorGrafo).toBe('mongo')
  })

  it('POST /api/perfil crea a Tomás con lo que contó el padre; repetirlo es entrada inválida', async () => {
    const cuerpo = { ninoId: 'tomas', datos: tomas.datos, borrador: tomas.borrador }
    expect((await llamar(perfilApi, { method: 'POST', body: cuerpo })).body).toEqual({ ninoId: 'tomas' })
    const repetido = await llamar<ErrorApi>(perfilApi, { method: 'POST', body: cuerpo })
    expect(repetido.status).toBe(400)
    expect(repetido.body.error.mensaje).toContain('Ya existe')
  })

  it('POST /api/registrar-comida registra las 20 comidas', async () => {
    for (const comida of tomas.comidas) {
      const r = await llamar<RegistrarComidaRes>(registrarApi, { method: 'POST', body: comida })
      expect(r.status, JSON.stringify(r.body)).toBe(200)
      respuestas.push(r.body)
    }
    expect(await col.comidas().countDocuments({ ninoId: 'tomas' })).toBe(20)
  }, 60_000)

  it('cada respuesta trae nutrientes con rango, la cobertura del día y "qué aprendí"', () => {
    const primera = respuestas[0]
    expect(primera?.comidaId).toMatch(/^c_/)
    expect(primera?.nutrientesComida.valor.energia_kcal).toBeGreaterThan(0)
    expect(primera?.nutrientesComida.min.calcio_mg).toBeLessThan(primera?.nutrientesComida.max.calcio_mg ?? 0)
    expect(primera?.dia.dia).toBe('2026-10-07')
    expect(respuestas[5]?.aprendi.map((a) => a.texto)).toContain(
      'Bastones de queso horneados: 2.ª exposición. Esta vez lo tocó (antes lo dejaba en el plato). Cada paso cuenta.',
    )
    expect(respuestas.every((r) => r.aprendi.length > 0)).toBe(true)
  })

  it('GET /api/progreso: la frase, las alertas y las tres sugerencias, con los dos motores', async () => {
    const r = await llamar<Progreso>(progresoApi, { method: 'GET', query: { ninoId: 'tomas', hasta: '2026-10-16' } })
    expect(r.status).toBe(200)
    expect(r.body.frase).toMatch(/^Esta semana Tomás cubrió/)
    expect(r.body.alertas.map((a) => a.tipo)).toContain('repertorio_chico')
    expect(r.body.sugerencias?.map((s) => s.tipo)).toEqual(['segura', 'un_paso', 'mas_nutritiva'])
    expect(r.body.proximoPaso?.preparacionId).toBe('bastones_queso_horno')
    expect(r.body.aceptadas).toBe(6)
    const base = await llamar<Progreso>(progresoApi, { method: 'GET', query: { ninoId: 'tomas', hasta: '2026-10-16', motor: 'base' } })
    expect(base.body.sugerencias?.length).toBe(3)
  })

  it('(v5.2) GET /api/progreso?momento=: solo sugerencias para esa comida, y lo dice', async () => {
    const pedir = (momento: string) => llamar<Progreso>(progresoApi, { method: 'GET', query: { ninoId: 'tomas', hasta: '2026-10-16', momento } })
    const desayuno = await pedir('desayuno')
    expect(desayuno.status).toBe(200)
    expect(desayuno.body.momento).toBe('desayuno')
    expect(desayuno.body.sugerencias?.map((s) => s.preparacionId)).toEqual(['leche_chocolatada', 'tostadas_queso', 'yogur_bebible'])
    const cena = await pedir('cena')
    expect(cena.body.sugerencias?.map((s) => s.preparacionId)).toEqual(['milanesa_carne_horno', 'bastones_queso_horno', 'bastones_queso_fritos'])
    expect((await pedir('once')).status).toBe(400)
    const sin = await llamar<Progreso>(progresoApi, { method: 'GET', query: { ninoId: 'tomas', hasta: '2026-10-16' } })
    expect(sin.body.momento).toBeUndefined()
    const e = evidenciaDe(await cargarNino('tomas'), { hoy: '2026-10-16', momento: 'desayuno' })
    expect(e.candidatos.map((c) => c.preparacionId)).not.toContain('bastones_queso_horno')
  })

  it('GET /api/nutricion y GET /api/perfil', async () => {
    const n = await llamar<{ comidas: unknown[]; faltan: string[] }>(nutricionApi, { method: 'GET', query: { ninoId: 'tomas', dia: '2026-10-16' } })
    expect(n.body.comidas).toHaveLength(2)
    const p = await llamar<Perfil>(perfilApi, { method: 'GET', query: { ninoId: 'tomas' } })
    expect(p.body.preparaciones.filter((x) => x.estado === 'acepta')).toHaveLength(6)
    expect(p.body.patrones.some((x) => x.texto.startsWith('Lo crocante lo acepta'))).toBe(true)
  })

  it('armarEvidencia (A9) y obtenerContexto (A5)', async () => {
    const e = evidenciaDe(await cargarNino('tomas'), { hoy: '2026-10-16' })
    expect(e.nutriente).toBe('calcio_mg')
    expect(e.candidatos[0]?.preparacionId).toBe('bastones_queso_horno')
    expect(e.alergias).toEqual(['huevo'])
    expect(e.texto.split('\n').length).toBeLessThanOrEqual(25)
    const c = await obtenerContexto('tomas')
    expect(c?.preparaciones[0]?.estado).toBe('acepta')
    expect(c?.catalogo.some((x) => x.id === 'papas_fritas_baston')).toBe(false)
    expect(await obtenerContexto('no-existe')).toBeNull()
  })

  it('GET /api/perfil?vista=grafo, y el grafo se reconstruye desde Mongo sin perder nada', async () => {
    const antes = await llamar<GrafoVista>(perfilApi, { method: 'GET', query: { ninoId: 'tomas', vista: 'grafo' } })
    expect(antes.body.aristas.filter((a) => a.tipo === 'ACEPTA')).toHaveLength(6)
    expect(antes.body.nodos.some((n) => n.tipo === 'Patron')).toBe(true)
    await almacen('mongo').borrarNino('tomas')
    expect((await almacen('mongo').subgrafo('tomas')).aristas).toHaveLength(0)
    expect(await reconstruirGrafo({ ninoId: 'tomas', motor: 'mongo' })).toMatchObject({ ninos: 1, comidas: 20 })
    expect((await almacen('mongo').subgrafo('tomas')).aristas.length).toBe(antes.body.aristas.length)
  })

  it('errores en el formato ErrorApi: entrada inválida, no encontrado, método no permitido', async () => {
    const comida = tomas.comidas[0]
    const mala = await llamar<ErrorApi>(registrarApi, { method: 'POST', body: { ...comida, respuestas: [{ itemIdTmp: 'i1', cuanto: 'muchisimo', porcion: 'mediana' }] } })
    expect(mala.status).toBe(400)
    expect(mala.body.error).toMatchObject({ codigo: 'entrada_invalida', reintentable: false })
    expect(mala.body.error.mensaje).toContain('respuestas[0].cuanto')
    const nadie = await llamar<ErrorApi>(registrarApi, { method: 'POST', body: { ...comida, ninoId: 'nadie' } })
    expect([nadie.status, nadie.body.error.codigo]).toEqual([404, 'no_encontrado'])
    expect((await llamar<ErrorApi>(registrarApi, { method: 'GET' })).body.error.codigo).toBe('metodo_no_permitido')
    expect((await llamar(progresoApi, { method: 'GET', query: { ninoId: 'tomas', motor: 'magia' } })).status).toBe(400)
  })

  it('si el grafo se cae, la comida igual se guarda en Mongo (la fuente de verdad)', async () => {
    const previo = { ...process.env }
    Object.assign(process.env, { MOTOR_GRAFO: 'neo4j', NEO4J_URI: 'bolt://127.0.0.1:1', GRAFO_ESTRICTO: '0', GRAFO_LIMITE_MS: '3000' })
    try {
      const comida = { ...tomas.comidas[0], dia: '2026-10-17', fechaISO: '2026-10-17T12:30:00-03:00' }
      const r = await llamar<RegistrarComidaRes>(registrarApi, { method: 'POST', body: comida })
      expect(r.status).toBe(200)
      expect(await col.comidas().countDocuments({ _id: r.body.comidaId })).toBe(1)
    } finally {
      for (const k of ['MOTOR_GRAFO', 'NEO4J_URI', 'GRAFO_ESTRICTO', 'GRAFO_LIMITE_MS']) {
        if (previo[k] === undefined) delete process.env[k]
        else process.env[k] = previo[k]
      }
    }
  }, 60_000)
})
