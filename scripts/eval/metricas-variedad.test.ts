// v5.10 · Las métricas de la eval de variedad, sobre recetas de ejemplo: las cuatro seguidas que salieron con Valentina
// (milanesa con avena, medallones de ricota, milanesa de pollo con costra de queso, pizzetas de porotos y muzzarella).
import { describe, expect, it } from 'vitest'
import {
  USD_POR_RECETA_ESTIMADO, anotar, conVeces, costoPedido, costoUsd, esQueso, familia, fraseVariedad, frecuencias, nuevosDe,
  repetidos, resumirVariedad, sigueElFoco, type FocoVisto, type PedidoVariedad, type RecetaVista,
} from './metricas-variedad.js'

const MILANESA = { id: 'milanesa_carne_horno', nombre: 'Milanesa de carne al horno', ingredientes: ['carne_vacuna', 'pan_rallado', 'huevo', 'aceite_girasol'] }
const NUGGETS = { id: 'nuggets_pollo_caseros', nombre: 'Nuggets de pollo caseros', ingredientes: ['pollo', 'pan_rallado', 'huevo', 'aceite_girasol'] }
const PIZZA = { id: 'pizza_muzzarella', nombre: 'Pizza de muzzarella', ingredientes: ['harina_trigo', 'queso_muzzarella', 'tomate', 'aceite_oliva'] }

const receta = (nombre: string, desde: RecetaVista['desde'], ingredientes: [string, number][], objetivo = 'calcio'): RecetaVista => ({
  nombre, desde, cambio: 'ingrediente', objetivo, ingredientes: ingredientes.map(([alimentoId, gramos]) => ({ alimentoId, gramos })),
})

const CON_AVENA = receta('Milanesa con avena', MILANESA, [['carne_vacuna', 100], ['avena', 30], ['huevo', 25], ['aceite_girasol', 5]], 'fibra')
const RICOTA = receta('Medallones de ricota', MILANESA, [['ricota', 90], ['pan_rallado', 20], ['huevo', 25], ['queso_rallado', 10]])
const COSTRA = receta('Milanesa de pollo con costra de queso', NUGGETS, [['pollo', 100], ['queso_rallado', 20], ['pan_rallado', 20], ['huevo', 25]])
const PIZZETAS = receta('Pizzetas de porotos y muzzarella', PIZZA, [['porotos', 80], ['harina_trigo', 60], ['queso_muzzarella', 40]], 'fibra')

const pedido = (r: RecetaVista | undefined, extra: Partial<PedidoVariedad> = {}): PedidoVariedad => ({
  momento: 'cena', ms: 10_000, llamadas: 1, uso: { entrada: 5000, salida: 3000 }, ...(r ? { receta: r } : {}), ...extra,
})

describe('familia y esQueso', () => {
  it('la familia es el primer tramo del id', () => {
    expect(familia('queso_muzzarella')).toBe('queso')
    expect(familia('carne_vacuna')).toBe('carne')
    expect(familia('avena')).toBe('avena')
  })

  it('cuentan como queso los queso_* y la ricota; los otros lácteos no', () => {
    expect(['queso_dambo', 'queso_rallado', 'queso_crema', 'ricota'].every(esQueso)).toBe(true)
    expect(['yogur_natural', 'leche_entera', 'quesillo'].some(esQueso)).toBe(false)
  })
})

describe('nuevosDe', () => {
  it('lo que la receta suma respecto de su alimento de partida, sin repetir', () => {
    expect(nuevosDe(CON_AVENA)).toEqual(['avena'])
    expect(nuevosDe(RICOTA)).toEqual(['ricota', 'queso_rallado'])
    expect(nuevosDe(receta('Igual', MILANESA, [['carne_vacuna', 100], ['huevo', 20], ['huevo', 5]]))).toEqual([])
  })
})

describe('sigueElFoco', () => {
  const foco = (f: Partial<FocoVisto>): FocoVisto => ({ desdeId: 'milanesa_carne_horno', modo: 'cambiar_principal', nutriente: 'calcio_mg', ...f })

  it('sin foco no se mide', () => {
    expect(sigueElFoco(CON_AVENA, undefined)).toBeNull()
    expect(sigueElFoco(CON_AVENA, foco({ desdeId: '' }))).toBeNull()
  })

  it('el código pidió partir del pollo desmenuzado y el LLM eligió igual su milanesa: no lo sigue', () => {
    expect(sigueElFoco(CON_AVENA, foco({ desdeId: 'pollo_desmenuzado' }))).toBe(false)
  })

  it('sin ingrediente sorteado (el código de hoy), alcanza con partir del alimento del foco', () => {
    expect(sigueElFoco(CON_AVENA, foco({}))).toBe(true)
  })

  it('al cambiar el principal, el ingrediente sorteado tiene que ser el de más gramos', () => {
    expect(sigueElFoco(RICOTA, foco({ ingrediente: 'ricota' }))).toBe(true)
    expect(sigueElFoco(RICOTA, foco({ ingrediente: 'queso_rallado' }))).toBe(false)
  })

  it('al sumar un ingrediente, alcanza con que esté', () => {
    expect(sigueElFoco(CON_AVENA, foco({ modo: 'sumar_ingrediente', ingrediente: 'avena' }))).toBe(true)
    expect(sigueElFoco(CON_AVENA, foco({ modo: 'sumar_ingrediente', ingrediente: 'lentejas' }))).toBe(false)
  })
})

describe('anotar (las anteriores, como las guarda la app)', () => {
  it('la más nueva al final, sin repetir y como mucho 10', () => {
    expect(anotar([], 'A')).toEqual(['A'])
    expect(anotar(['A', 'B'], 'A')).toEqual(['B', 'A'])
    const diez = Array.from({ length: 10 }, (_, i) => `R${i}`)
    expect(anotar(diez, 'R10')).toEqual([...diez.slice(1), 'R10'])
  })
})

describe('costo', () => {
  it('Sonnet 5.5: USD 2 por millón de entrada y 10 por millón de salida', () => {
    expect(costoUsd({ entrada: 1_000_000, salida: 0 })).toBe(2)
    expect(costoUsd({ entrada: 5000, salida: 3000 })).toBeCloseTo(0.04)
  })

  it('con el uso de la API, el real; si llamó al LLM sin uso, la estimación; si no llamó, nada', () => {
    expect(costoPedido({ uso: { entrada: 0, salida: 1_000_000 }, llamadas: 1 })).toEqual({ usd: 10, estimado: false })
    expect(costoPedido({ uso: null, llamadas: 2 })).toEqual({ usd: USD_POR_RECETA_ESTIMADO, estimado: true })
    expect(costoPedido({ uso: null, llamadas: 0 })).toEqual({ usd: 0, estimado: false })
  })
})

describe('frecuencias, conVeces y repetidos', () => {
  it('de más a menos, y a igualdad en el orden en que aparecieron', () => {
    expect(frecuencias(['avena', 'pollo', 'queso', 'pollo'])).toEqual([{ valor: 'pollo', veces: 2 }, { valor: 'avena', veces: 1 }, { valor: 'queso', veces: 1 }])
    expect(conVeces(['avena', 'pollo', 'pollo'])).toBe('pollo ×2, avena')
    expect(conVeces([])).toBe('—')
  })

  it('los nombres repetidos se comparan sin tildes ni mayúsculas, como la validación', () => {
    expect(repetidos(['Medallones de ricota', 'Milanesa con avena', 'medallones de RICOTA', 'Medallónes de ricota'])).toEqual([{ nombre: 'Medallones de ricota', veces: 3 }])
    expect(repetidos(['A', 'B'])).toEqual([])
  })
})

describe('resumirVariedad (las cuatro seguidas de Valentina, más dos que no salieron)', () => {
  const focoMilanesa: FocoVisto = { desdeId: 'milanesa_carne_horno', modo: 'cambiar_principal', nutriente: 'calcio_mg' }
  const pedidos = [
    pedido(CON_AVENA, { foco: { ...focoMilanesa, desdeId: 'pollo_desmenuzado' }, ms: 8000 }), // no siguió el foco
    pedido(RICOTA, { foco: focoMilanesa, ms: 12_000 }),
    pedido(COSTRA, { foco: { ...focoMilanesa, desdeId: 'papas_fritas_baston' }, ms: 20_000, uso: null }), // sin uso: estimado
    pedido(PIZZETAS, { momento: 'desayuno', ms: 10_000 }),                                                // sin foco
    pedido(undefined, { falla: 'sin_candidatos', ms: 30_000, llamadas: 2, uso: { entrada: 10_000, salida: 6000 } }),
    pedido(undefined, { falla: 'error', ms: null, llamadas: 0, uso: null, error: 'falta ANTHROPIC_API_KEY' }),
  ]
  const r = resumirVariedad(pedidos)

  it('cuenta los pedidos, las recetas y los principales distintos (el de más gramos)', () => {
    expect(r).toMatchObject({ pedidos: 6, recetas: 4 })
    expect(r.principales).toEqual(['carne_vacuna', 'ricota', 'pollo', 'porotos'])
    expect(r.familias).toEqual(['carne', 'ricota', 'pollo', 'porotos'])
  })

  it('alimentos de partida distintos y cuántas llevan queso (3 de 4: casi todo lleva queso)', () => {
    expect(r.partidas).toEqual(['milanesa_carne_horno', 'nuggets_pollo_caseros', 'pizza_muzzarella'])
    expect(r.conQueso).toEqual({ ok: 3, total: 4 })
  })

  it('cuántas siguieron el foco, entre las que tenían uno', () => {
    expect(r.siguenFoco).toEqual({ ok: 1, total: 3 })
  })

  it('fallas por tipo, y la latencia sin los errores', () => {
    expect(r.fallas).toEqual({ sin_candidatos: 1, timeout: 0, error: 1 })
    expect(r.latencia.media).toBe(16_000)
    expect(r.latencia.p95).toBe(30_000)
  })

  it('tokens y costo: el real donde hay uso; la estimación donde llamó y no se sabe (y lo dice)', () => {
    expect(r.tokens).toEqual({ entrada: 25_000, salida: 15_000 })
    expect(r.costo.usd).toBeCloseTo(costoUsd(r.tokens) + USD_POR_RECETA_ESTIMADO)
    expect(r.costo.estimado).toBe(true)
  })

  it('los nombres repetidos, y la frase', () => {
    const otra = resumirVariedad([...pedidos, pedido({ ...RICOTA, nombre: 'Medallones de Ricota' })])
    expect(r.repetidos).toEqual([])
    expect(otra.repetidos).toEqual([{ nombre: 'Medallones de ricota', veces: 2 }])
    expect(fraseVariedad(r)).toBe('De 4 recetas, 4 ingredientes principales distintos (4 familias) y 3 alimentos de partida distintos; 3 de 4 llevan queso.')
    expect(fraseVariedad(otra)).toContain('; un nombre se repite.')
  })

  it('sin pedidos ni recetas no se rompe', () => {
    const vacio = resumirVariedad([])
    expect(vacio).toMatchObject({ pedidos: 0, recetas: 0, principales: [], conQueso: { ok: 0, total: 0 }, latencia: { media: null, p95: null } })
    expect(vacio.costo).toEqual({ usd: 0, estimado: false })
    expect(fraseVariedad(resumirVariedad([pedido(undefined, { falla: 'timeout' })]))).toBe('No salió la receta pedida.')
    expect(fraseVariedad(resumirVariedad([pedido(undefined, { falla: 'timeout' }), pedido(undefined, { falla: 'error' })]))).toBe('No salió ninguna de las 2 recetas pedidas.')
  })
})
