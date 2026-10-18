import { describe, expect, it } from 'vitest'
import type { RegistrarComidaReq } from '../../shared/contratos.js'
import { sintetico } from './prueba/catalogos.js'
import { validarPerfil, validarRegistrarComida } from './validar.js'

const comida = (): RegistrarComidaReq => structuredClone(sintetico('tomas').comidas[0] as RegistrarComidaReq)

describe('validarRegistrarComida: los ítems', () => {
  it('conserva nombreIngles (para buscar en alimentos_fdc lo que cayó en otro_<grupo>), sin espacios de más', () => {
    const req = comida()
    const [primero] = req.analisis.items
    if (!primero) throw new Error('Falta el primer ítem')
    primero.nombreIngles = '  sweet potato, baked '
    expect(validarRegistrarComida(req).analisis.items[0]?.nombreIngles).toBe('sweet potato, baked')
  })

  it('sin nombreIngles (o vacío, o null como lo deja la visión), el ítem no lo lleva', () => {
    expect(validarRegistrarComida(comida()).analisis.items[0]).not.toHaveProperty('nombreIngles')
    const req = comida() as unknown as { analisis: { items: Record<string, unknown>[] } }
    if (req.analisis.items[0]) req.analisis.items[0].nombreIngles = null
    if (req.analisis.items[1]) req.analisis.items[1].nombreIngles = '   '
    const items = validarRegistrarComida(req).analisis.items
    expect(items[0]).not.toHaveProperty('nombreIngles')
    expect(items[1]).not.toHaveProperty('nombreIngles')
  })
})

describe('validarPerfil (v5.8): lo declarado completo y las otras alergias', () => {
  const tomas = sintetico('tomas')
  const pedido = (extra: { datos?: Record<string, unknown>; acepta?: unknown[]; rechaza?: unknown[] } = {}) => ({
    datos: { ...tomas.datos, ...extra.datos },
    borrador: { ...tomas.borrador, ...(extra.acepta ? { acepta: extra.acepta } : {}), ...(extra.rechaza ? { rechaza: extra.rechaza } : {}) },
  })

  it('un pedido viejo (sin los campos nuevos) pasa igual', () => {
    const r = validarPerfil(pedido())
    expect(r.borrador.acepta.length).toBe(tomas.borrador.acepta.length)
    expect(r.datos).not.toHaveProperty('alergiasOtras')
  })

  it('acepta dicho, los 8 atributos, ingredientes, momentos, inferido y duda; en rechaza también', () => {
    const sushi = {
      nombre: 'Sushi', preparacionId: null, dicho: '  le encanta el sushi ',
      atributos: { textura: 'blando', forma: 'redondo', color: 'blanco', sabor: 'salado', temperatura: 'frio', presentacion: 'separado', grupo: 'cereal_almidon', coccion: 'hervido' },
      ingredientes: [{ alimentoId: 'arroz', gramos: 80 }], momentos: ['almuerzo', 'cena', 'cena'], inferido: true, duda: '¿Lleva pescado?',
    }
    const repollo = { nombre: 'Repollo', preparacionId: null, motivo: 'sabor_olor', atributos: { grupo: 'verdura' }, ingredientes: [{ alimentoId: 'repollo', gramos: 50 }], momentos: ['almuerzo'] }
    const r = validarPerfil(pedido({ acepta: [sushi], rechaza: [repollo] }))
    expect(r.borrador.acepta[0]).toEqual({ ...sushi, dicho: 'le encanta el sushi', momentos: ['almuerzo', 'cena'] })
    expect(r.borrador.rechaza[0]).toEqual(repollo)
  })

  it('los ingredientes solo se guardan si no es del catálogo (los del catálogo son los del catálogo)', () => {
    const r = validarPerfil(pedido({ acepta: [{ nombre: 'Papas', preparacionId: 'papas_fritas_baston', atributos: {}, ingredientes: [{ alimentoId: 'papa', gramos: 100 }] }] }))
    expect(r.borrador.acepta[0]).not.toHaveProperty('ingredientes')
  })

  it('un momento o un atributo fuera del vocabulario es entrada inválida', () => {
    expect(() => validarPerfil(pedido({ acepta: [{ nombre: 'Sushi', preparacionId: null, atributos: {}, momentos: ['brunch'] }] }))).toThrow(/momentos/)
    expect(() => validarPerfil(pedido({ rechaza: [{ nombre: 'Sopa', preparacionId: null, motivo: 'textura', atributos: { textura: 'gomosa' } }] }))).toThrow(/textura/)
  })

  it('alergiasOtras: sin espacios de más, sin vacías ni repetidas; máx. 10 de hasta 40 letras', () => {
    expect(validarPerfil(pedido({ datos: { alergiasOtras: ['  kiwi ', '', 'Kiwi', 'colorante  rojo'] } })).datos.alergiasOtras).toEqual(['kiwi', 'colorante rojo'])
    expect(validarPerfil(pedido({ datos: { alergiasOtras: [] } })).datos).not.toHaveProperty('alergiasOtras')
    expect(() => validarPerfil(pedido({ datos: { alergiasOtras: ['x'.repeat(41)] } }))).toThrow(/largo/)
    expect(() => validarPerfil(pedido({ datos: { alergiasOtras: Array.from({ length: 11 }, (_, i) => `a${i}`) } }))).toThrow(/10/)
    expect(() => validarPerfil(pedido({ datos: { alergiasOtras: [3] } }))).toThrow(/texto/)
  })
})
