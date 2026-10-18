import { describe, expect, it } from 'vitest'
import type { Progreso, Sugerencia } from '../../shared/contratos'
import progresoFixture from '../../fixtures/progreso.json'
import {
  comidaRecienPorHora, comidasDelDia, elegirSugerencia, encaja, primeraFrase, proximaComida, rutaRecetaComida, sugerenciasDe,
  type ComidaDelDia,
} from './proximaComida'

const c = (momento: ComidaDelDia['momento'], hora: string): ComidaDelDia => ({ momento, fechaISO: `2026-10-17T${hora}:00-03:00` })
const sig = (comidas: ComidaDelDia[], hora: number) => proximaComida(comidas, hora).etiqueta

describe('proximaComida', () => {
  it('sigue la secuencia desayuno → almuerzo → cena → desayuno de mañana', () => {
    expect(sig([c('desayuno', '08:30')], 9)).toBe('Para el almuerzo')
    expect(sig([c('desayuno', '08:30'), c('almuerzo', '12:30')], 13)).toBe('Para la cena')
    expect(sig([c('desayuno', '08:30'), c('almuerzo', '12:30'), c('cena', '20:30')], 21)).toBe('Para mañana: desayuno')
    expect(proximaComida([c('cena', '20:30')], 21)).toEqual({ momento: 'desayuno', manana: true, etiqueta: 'Para mañana: desayuno' })
  })

  it('la merienda y la colación llevan a la principal que sigue', () => {
    expect(sig([c('merienda', '17:00')], 17)).toBe('Para la cena')
    expect(sig([c('colacion', '10:30')], 10)).toBe('Para el almuerzo')
    expect(sig([c('colacion', '16:30')], 16)).toBe('Para la cena')
  })

  it('cuenta la comida más avanzada del día, no la última en cargarse', () => {
    expect(sig([c('cena', '20:30'), c('colacion', '21:00')], 21)).toBe('Para mañana: desayuno')
    expect(sig([c('almuerzo', '12:30'), c('desayuno', '08:00')], 13)).toBe('Para la cena')
  })

  it('nunca sugiere una comida que ya pasó por la hora', () => {
    expect(sig([c('desayuno', '08:30')], 16)).toBe('Para la cena')
    expect(sig([c('almuerzo', '12:30')], 22)).toBe('Para mañana: desayuno')
  })

  it('sin comidas hoy, por la hora', () => {
    expect([7, 9, 10, 14, 15, 21, 22, 23].map((h) => sig([], h))).toEqual([
      'Para el desayuno', 'Para el desayuno', 'Para el almuerzo', 'Para el almuerzo',
      'Para la cena', 'Para la cena', 'Para mañana: desayuno', 'Para mañana: desayuno',
    ])
  })

  it('preselecciona al registrar la comida que acaba de terminar', () => {
    expect([8, 13, 17, 21].map(comidaRecienPorHora)).toEqual(['desayuno', 'almuerzo', 'merienda', 'cena'])
  })
})

describe('comidasDelDia', () => {
  const dias = [{ dia: '2026-10-17', comidas: [{ id: 'a', momento: 'desayuno', fechaISO: '2026-10-17T08:00:00-03:00', items: [] }] }] as unknown as Progreso['dias']
  it('junta las del progreso con la recién registrada, sin repetir', () => {
    expect(comidasDelDia(dias, '2026-10-17', [{ id: 'a', momento: 'desayuno', fechaISO: 'x' }])).toHaveLength(1)
    expect(comidasDelDia(dias, '2026-10-17', [{ id: 'b', momento: 'almuerzo', fechaISO: 'x' }]).map((x) => x.momento)).toEqual(['desayuno', 'almuerzo'])
    expect(comidasDelDia(dias, '2026-10-18')).toEqual([])
    expect(comidasDelDia(undefined, '2026-10-17')).toEqual([])
  })
})

const s = (tipo: Sugerencia['tipo'], preparacionId: string, grupo?: Sugerencia['grupo']): Sugerencia =>
  ({ tipo, preparacionId, nombre: preparacionId, probAcepta: 0.5, aporte: {}, porQue: '', ...(grupo ? { grupo } : {}) })

describe('elegirSugerencia', () => {
  it('encaja según los momentos del catálogo (v5.2); lo que no está en el catálogo no encaja', () => {
    expect(encaja('desayuno', s('segura', 'leche_chocolatada'))).toBe(true)
    expect(encaja('almuerzo', s('segura', 'leche_chocolatada'))).toBe(false)
    expect(encaja('cena', s('un_paso', 'yogur_vainilla'))).toBe(false)
    expect(encaja('almuerzo', s('un_paso', 'bastones_queso_horno'))).toBe(true)
    for (const id of ['milanesa_carne_horno', 'papas_fritas_baston', 'bastones_queso_horno', 'nuggets_pollo_horno']) {
      expect(encaja('desayuno', s('un_paso', id)), id).toBe(false)
    }
    expect(encaja('cena', s('un_paso', 'algo_nuevo', 'verdura'))).toBe(false)
  })

  it('prefiere un_paso, después mas_nutritiva, después segura, entre las que encajan', () => {
    const lista = [s('segura', 'leche_chocolatada'), s('un_paso', 'nuggets_pollo_horno'), s('mas_nutritiva', 'yogur_vainilla')]
    expect(elegirSugerencia({ sugerencias: lista }, 'almuerzo')?.preparacionId).toBe('nuggets_pollo_horno')
    expect(elegirSugerencia({ sugerencias: lista }, 'desayuno')?.preparacionId).toBe('yogur_vainilla')
    const soloSegura = [s('segura', 'leche_chocolatada'), s('un_paso', 'nuggets_pollo_horno')]
    expect(elegirSugerencia({ sugerencias: soloSegura }, 'desayuno')?.tipo).toBe('segura')
  })

  it('nunca muestra una que no encaja: si ninguna encaja, null (la tarjeta calma); sin sugerencias, null', () => {
    expect(elegirSugerencia({ sugerencias: [s('segura', 'leche_chocolatada'), s('mas_nutritiva', 'yogur_vainilla')] }, 'cena')).toBeNull()
    expect(elegirSugerencia({ sugerencias: [s('un_paso', 'milanesa_carne_horno'), s('segura', 'papas_fritas_baston')] }, 'desayuno')).toBeNull()
    expect(elegirSugerencia({ sugerencias: [] }, 'cena')).toBeNull()
    expect(elegirSugerencia({}, 'cena')).toBeNull()
  })

  it('si B filtró para esta comida (Progreso.momento), confía en B; si filtró para otra, vuelve a mirar el catálogo', () => {
    const lista = [s('segura', 'algo_de_su_casa'), s('mas_nutritiva', 'tostadas_queso')]
    expect(elegirSugerencia({ sugerencias: lista, momento: 'desayuno' }, 'desayuno')?.preparacionId).toBe('tostadas_queso')
    expect(elegirSugerencia({ sugerencias: [s('segura', 'algo_de_su_casa')], momento: 'desayuno' }, 'desayuno')?.preparacionId).toBe('algo_de_su_casa')
    expect(elegirSugerencia({ sugerencias: lista, momento: 'desayuno' }, 'cena')).toBeNull()
  })

  it('con el fixture: bastones de queso para el almuerzo y la cena, el yogur para el desayuno', () => {
    const p = progresoFixture as unknown as Progreso
    expect(elegirSugerencia(p, 'almuerzo')?.preparacionId).toBe('bastones_queso_horno')
    expect(elegirSugerencia(p, 'cena')?.preparacionId).toBe('bastones_queso_horno')
    expect(elegirSugerencia(p, 'desayuno')?.preparacionId).toBe('yogur_vainilla')
  })

  it('sin sugerencias usa el proximoPaso, si encaja', () => {
    const p = progresoFixture as unknown as Progreso
    const una = sugerenciasDe({ proximoPaso: p.proximoPaso })
    expect(una).toHaveLength(1)
    expect(una[0].tipo).toBe('un_paso')
    expect(elegirSugerencia({ proximoPaso: p.proximoPaso }, 'desayuno')).toBeNull()
  })
})

describe('textos y rutas', () => {
  it('primeraFrase deja una línea', () => {
    expect(primeraFrase('Se parece a sus papas: cambia solo el ingrediente. Ya los vio 5 veces')).toBe('Se parece a sus papas: cambia solo el ingrediente.')
    expect(primeraFrase('La come 14 de cada 14 veces')).toBe('La come 14 de cada 14 veces.')
  })

  it('la receta lleva el candidato, el nutriente y la comida', () => {
    const r = rutaRecetaComida('tomas', s('un_paso', 'bastones_queso_horno'), 'almuerzo', 'calcio_mg')
    expect(r).toBe('/receta?nino=tomas&preparacionId=bastones_queso_horno&nutriente=calcio_mg&momento=almuerzo')
    expect(rutaRecetaComida('tomas', s('un_paso', 'x'), 'cena', undefined, 'base')).toContain('&motor=base')
  })
})
