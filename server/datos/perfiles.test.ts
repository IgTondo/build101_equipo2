// crearPerfil completa lo declarado ANTES de razonar (server/ia/completar.ts, mockeado): con las alergias del chico,
// con tiempo límite y, si falla o tarda, con lo que contó el padre tal cual (crear el perfil nunca falla por esto).
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AlimentoDeclarado, Atributos, DatosBasicos, PerfilBorrador } from '../../shared/contratos.js'
import type { NinoDoc } from './tipos.js'

const completarAlimentos = vi.fn<(a: AlimentoDeclarado[], ctx: unknown) => Promise<AlimentoDeclarado[]>>()
vi.mock('../ia/completar.js', () => ({ completarAlimentos: (a: AlimentoDeclarado[], ctx: unknown) => completarAlimentos(a, ctx) }))

const guardados: NinoDoc[] = []
vi.mock('./mongo.js', () => ({
  asegurarIndices: async () => {},
  col: {
    ninos: () => ({ insertOne: async (n: NinoDoc) => void guardados.push(n), updateOne: async () => ({}), replaceOne: async () => ({}) }),
    comidas: () => ({ deleteMany: async () => ({}) }),
  },
}))
const escribirNino = vi.fn(async () => {})
vi.mock('../grafo/almacen.js', () => ({
  almacen: () => ({ escribirNino, borrarNino: async () => {} }),
  sinFrenar: async (_: string, fn: () => Promise<void>) => {
    await fn()
    return true
  },
}))

const { completarBorrador, crearPerfil, declaradoIncompleto } = await import('./perfiles.js')
const { usarCatalogos } = await import('./catalogos.js')
const { catalogoPrueba } = await import('./prueba/catalogos.js')

const SUSHI: Atributos = { textura: 'blando', forma: 'redondo', color: 'blanco', sabor: 'salado', temperatura: 'frio', presentacion: 'separado', grupo: 'cereal_almidon', coccion: 'hervido' }
const datos: DatosBasicos = { nombre: 'Rosario', edad: 6, sexo: 'femenino', alergias: ['pescado', 'sesamo'], alergiasOtras: ['kiwi'], alertas: [], dieta: 'ninguna' }
const borrador = (): PerfilBorrador => ({
  acepta: [
    { nombre: 'Sushi', dicho: 'le encanta el sushi', preparacionId: null, atributos: { temperatura: 'frio', grupo: 'proteina', coccion: 'crudo' } },
    { nombre: 'Papas fritas en bastones', preparacionId: 'papas_fritas_baston', atributos: {} },
  ],
  rechaza: [{ nombre: 'Repollo', preparacionId: null, motivo: 'sabor_olor' }],
  reglas: [],
})
const completo = (a: AlimentoDeclarado): AlimentoDeclarado => ({
  ...a,
  nombre: 'OTRO NOMBRE', // el modelo no puede cambiar el nombre que dijo el padre
  atributos: { ...SUSHI, coccion: 'listo' },
  ingredientes: [{ alimentoId: 'arroz', gramos: 80 }, { alimentoId: 'pepino', gramos: 10 }],
  momentos: ['cena', 'almuerzo'],
  inferido: true,
  duda: '¿El sushi que come lleva pescado?',
})

beforeEach(() => {
  completarAlimentos.mockReset()
  escribirNino.mockClear()
  guardados.length = 0
  usarCatalogos({ preparaciones: catalogoPrueba() })
})

describe('completarBorrador', () => {
  it('manda a completar solo lo que no es del catálogo e incompleto (acepta y rechaza), con alergias, otras, dieta y edad', async () => {
    completarAlimentos.mockImplementation(async (xs) => xs.map(completo))
    const b = await completarBorrador(borrador(), datos)
    expect(completarAlimentos).toHaveBeenCalledTimes(1)
    const [enviados, ctx] = completarAlimentos.mock.calls[0] ?? []
    expect(enviados?.map((a) => a.nombre)).toEqual(['Sushi', 'Repollo'])
    expect(ctx).toEqual({ alergias: ['pescado', 'sesamo'], alergiasOtras: ['kiwi'], dieta: 'ninguna', edad: 6 })
    const sushi = b.acepta[0]
    // Lo que dijo el padre manda: el nombre, sus palabras y los atributos que traía; lo demás es lo típico
    expect(sushi).toMatchObject({ nombre: 'Sushi', dicho: 'le encanta el sushi', preparacionId: null, inferido: true, duda: '¿El sushi que come lleva pescado?' })
    // El grupo es el del ingrediente principal (el arroz), no el que dijo el modelo
    expect(sushi?.atributos).toEqual({ ...SUSHI, grupo: 'cereal_almidon', coccion: 'crudo' })
    expect(sushi?.ingredientes).toHaveLength(2)
    expect(sushi?.momentos).toEqual(['almuerzo', 'cena'])
    expect(b.acepta[1]).toEqual(borrador().acepta[1]) // el del catálogo no se toca
    expect(b.rechaza[0]).toMatchObject({ nombre: 'Repollo', motivo: 'sabor_olor', ingredientes: [{ alimentoId: 'arroz', gramos: 80 }, { alimentoId: 'pepino', gramos: 10 }] })
  })

  it('si falla, queda lo original (nada se pierde)', async () => {
    completarAlimentos.mockRejectedValue(new Error('se cayó'))
    expect(await completarBorrador(borrador(), datos)).toEqual(borrador())
  })

  it('si tarda más que el límite, sigue con lo original', async () => {
    completarAlimentos.mockImplementation(() => new Promise(() => {}))
    const inicio = Date.now()
    expect(await completarBorrador(borrador(), datos, { limiteMs: 50 })).toEqual(borrador())
    expect(Date.now() - inicio).toBeLessThan(1000)
  })

  it('si vuelve otra cantidad, no se adivina cuál es cuál', async () => {
    completarAlimentos.mockImplementation(async (xs) => xs.slice(1).map(completo))
    expect(await completarBorrador(borrador(), datos)).toEqual(borrador())
  })

  it('valores fuera del vocabulario que devuelva el modelo no se guardan', async () => {
    completarAlimentos.mockImplementation(async (xs) => xs.map((a) => ({ ...completo(a), atributos: { ...SUSHI, textura: 'gomoso' as Atributos['textura'] } })))
    const b = await completarBorrador({ ...borrador(), acepta: [{ nombre: 'Gomitas', preparacionId: null, atributos: {} }] }, datos)
    expect(b.acepta[0]?.atributos.textura).toBeUndefined()
    expect(b.acepta[0]?.atributos.forma).toBe('redondo')
  })

  it('lo renombrado igual que una preparación del catálogo pasa a ser esa (sin llamar al modelo)', async () => {
    const b = await completarBorrador({ acepta: [{ nombre: 'Papas fritas en bastones', preparacionId: null, atributos: {} }], rechaza: [], reglas: [] }, datos)
    expect(completarAlimentos).not.toHaveBeenCalled()
    expect(b.acepta[0]).toMatchObject({ preparacionId: 'papas_fritas_baston', atributos: { forma: 'baston', coccion: 'frito' }, momentos: ['almuerzo', 'cena'] })
  })

  it('lo completo no se manda', () => {
    expect(declaradoIncompleto({ nombre: 'Sushi', preparacionId: null, atributos: SUSHI, ingredientes: [{ alimentoId: 'arroz', gramos: 80 }], momentos: ['cena'] })).toBe(false)
    expect(declaradoIncompleto({ nombre: 'Sushi', preparacionId: null, atributos: SUSHI, momentos: ['cena'] })).toBe(true)
    expect(declaradoIncompleto({ nombre: 'Papas', preparacionId: 'papas_fritas_baston', atributos: {} })).toBe(false)
  })
})

describe('crearPerfil', () => {
  it('guarda el borrador completado y razona con él (el grafo recibe el Sushi con ingredientes)', async () => {
    completarAlimentos.mockImplementation(async (xs) => xs.map(completo))
    await crearPerfil({ ninoId: 'rosario-prueba', datos, borrador: borrador() })
    expect(guardados[0]?.borrador.acepta[0]?.ingredientes).toHaveLength(2)
    const estado = (escribirNino.mock.calls[0] as unknown[] | undefined)?.[2] as { conocidas: Map<string, { ingredientes: unknown[] }> } | undefined
    expect(estado?.conocidas.get('sushi')?.ingredientes).toHaveLength(2)
    expect(estado?.conocidas.get('repollo')?.ingredientes).toHaveLength(2)
  })

  it('si el modelo tarda, el perfil se crea igual con lo que contó el padre', async () => {
    completarAlimentos.mockImplementation(() => new Promise(() => {}))
    expect(await crearPerfil({ ninoId: 'rosario-prueba', datos, borrador: borrador() }, { limiteMs: 50 })).toEqual({ ninoId: 'rosario-prueba' })
    expect(guardados[0]?.borrador).toEqual(borrador())
  })

  it('completar: false no llama al modelo', async () => {
    await crearPerfil({ ninoId: 'rosario-prueba', datos, borrador: borrador() }, { completar: false })
    expect(completarAlimentos).not.toHaveBeenCalled()
  })
})
