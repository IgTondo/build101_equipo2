// completarAlimentos() (v5.8) con generarJSON mockeado: qué se completa, qué no se pisa y que nunca falla.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AlimentoDeclarado } from '../../shared/contratos.js'
import { completarAlimentos, incompleto, type SalidaCompletar } from './completar.js'
import { generarJSON } from './modelo.js'

vi.mock('./modelo.js', () => ({ generarJSON: vi.fn() }))
const mockJSON = vi.mocked(generarJSON)

type ItemLLM = SalidaCompletar['items'][number]
const ATR: ItemLLM['atributos'] = { textura: 'crocante', forma: 'plano', color: 'beige', sabor: 'salado', temperatura: 'caliente', presentacion: 'separado', grupo: 'proteina', coccion: 'horno' }
const item = (n: number, x: Partial<ItemLLM> = {}): ItemLLM => ({ n, atributos: ATR, ingredientes: [], momentos: [], duda: null, ...x })

function responde(items: ItemLLM[]) {
  mockJSON.mockResolvedValueOnce({ datos: { items }, modelo: 'claude-haiku-5-5', ms: 900, reintentos: 0 })
}

const MILANESA: AlimentoDeclarado = { nombre: 'Milanesa de pollo', dicho: 'la milanesa de pollo que hago yo', preparacionId: null, atributos: { coccion: 'frito' } }
const PAPAS: AlimentoDeclarado = { nombre: 'Papas fritas', preparacionId: 'papas_fritas_baston', atributos: {} }
const SUSHI: AlimentoDeclarado = { nombre: 'Sushi de palta', preparacionId: null, atributos: {} }
const COMPLETO: AlimentoDeclarado = {
  nombre: 'Arroz blanco', preparacionId: null, ingredientes: [{ alimentoId: 'arroz', gramos: 80 }],
  atributos: { textura: 'blando', forma: 'granos', color: 'blanco', sabor: 'neutro', temperatura: 'caliente', presentacion: 'separado', grupo: 'cereal_almidon', coccion: 'hervido' },
}

beforeEach(() => {
  mockJSON.mockReset()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('completarAlimentos', () => {
  it('solo los que no están en el catálogo y están a medias', () => {
    expect([MILANESA, PAPAS, SUSHI, COMPLETO].map(incompleto)).toEqual([true, false, true, false])
  })

  it('sin nada que completar, no llama al modelo y devuelve lo mismo', async () => {
    const lista = [PAPAS, COMPLETO]
    expect(await completarAlimentos(lista, { alergias: [] })).toBe(lista)
    expect(mockJSON).not.toHaveBeenCalled()
  })

  it('una sola llamada (tarea perfil) con los incompletos numerados, la edad, las alergias y la dieta', async () => {
    responde([item(1), item(2)])
    await completarAlimentos([MILANESA, PAPAS, SUSHI], { alergias: ['pescado'], alergiasOtras: ['kiwi'], dieta: 'sin_gluten_caseina', edad: 6 })
    expect(mockJSON).toHaveBeenCalledTimes(1)
    const o = mockJSON.mock.calls[0][0]
    expect(o.tarea).toBe('perfil')
    const texto = o.partes[0].tipo === 'texto' ? o.partes[0].texto : ''
    expect(texto).toContain('6 años; alergias: pescado, kiwi; sin gluten ni caseína')
    expect(texto).toContain('1. Milanesa de pollo (la familia dijo: "la milanesa de pollo que hago yo") [ya se sabe: coccion=frito]')
    expect(texto).toContain('2. Sushi de palta')
    expect(texto).not.toContain('Papas fritas')
    expect(o.sistema).toContain('- otro_verdura: ')
  })

  it('completa los 8 atributos sin pisar lo que se sabía, ingredientes válidos, momentos de MOMENTO, inferido y la duda', async () => {
    responde([
      item(2, {
        atributos: { ...ATR, grupo: 'cereal_almidon', temperatura: 'frio', coccion: 'crudo' },
        ingredientes: [{ alimentoId: 'arroz', gramos: 80 }, { alimentoId: 'otro_verdura', gramos: 30 }, { alimentoId: 'salmon', gramos: 40 }, { alimentoId: 'inventado', gramos: 10 }],
        momentos: ['cena', 'postre'],
      }),
      item(1, { ingredientes: [{ alimentoId: 'pollo', gramos: 100 }, { alimentoId: 'pan_rallado', gramos: 20 }, { alimentoId: 'huevo', gramos: 25 }], momentos: ['almuerzo'], duda: '¿Lleva huevo el rebozado?' }),
    ])
    const [mila, papas, sushi] = await completarAlimentos([MILANESA, PAPAS, SUSHI], { alergias: ['pescado'] })
    expect(mila).toEqual({
      ...MILANESA,
      atributos: { ...ATR, coccion: 'frito' },
      ingredientes: [{ alimentoId: 'pollo', gramos: 100 }, { alimentoId: 'pan_rallado', gramos: 20 }, { alimentoId: 'huevo', gramos: 25 }],
      // La duda del huevo no queda: el chico es alérgico al pescado, no al huevo (dudaRelevante)
      momentos: ['almuerzo'], inferido: true,
    })
    expect(papas).toBe(PAPAS)
    expect(sushi.ingredientes).toEqual([{ alimentoId: 'arroz', gramos: 80 }, { alimentoId: 'otro_verdura', gramos: 30 }])
    expect(sushi.momentos).toEqual(['cena'])
    expect(sushi.duda).toMatch(/salm[oó]n.*alergia/)
    expect(Object.keys(sushi.atributos)).toHaveLength(8)
  })

  it('la duda del modelo queda solo si es por una alergia de este chico', async () => {
    responde([item(1, { duda: '¿Lleva huevo el rebozado?' })])
    const [conHuevo] = await completarAlimentos([MILANESA], { alergias: ['huevo'] })
    expect(conHuevo.duda).toBe('¿Lleva huevo el rebozado?')
  })

  it('los ingredientes y los momentos que ya tenía no se pisan', async () => {
    const conIngredientes: AlimentoDeclarado = { ...MILANESA, ingredientes: [{ alimentoId: 'pollo', gramos: 90 }], momentos: ['cena'] }
    responde([item(1, { ingredientes: [{ alimentoId: 'carne_vacuna', gramos: 100 }], momentos: ['almuerzo'] })])
    const [x] = await completarAlimentos([conIngredientes], { alergias: [] })
    expect(x.ingredientes).toEqual([{ alimentoId: 'pollo', gramos: 90 }])
    expect(x.momentos).toEqual(['cena'])
    expect(Object.keys(x.atributos)).toHaveLength(8)
  })

  it('números que no existen o repetidos se ignoran; lo que no volvió queda como estaba', async () => {
    responde([item(7), item(1), item(1, { atributos: { ...ATR, color: 'verde' } })])
    const [mila, sushi] = await completarAlimentos([MILANESA, SUSHI], { alergias: [] })
    expect(mila.atributos.color).toBe('beige')
    expect(sushi).toBe(SUSHI)
  })

  it('si el modelo falla, devuelve la entrada sin cambios', async () => {
    mockJSON.mockRejectedValueOnce(new Error('se cayó'))
    const lista = [MILANESA, SUSHI]
    expect(await completarAlimentos(lista, { alergias: [] })).toBe(lista)
  })
})
