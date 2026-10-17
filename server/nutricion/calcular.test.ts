import { describe, expect, it } from 'vitest'
import type { Alimento, Nutrientes } from '../../shared/contratos.js'
import { aporte, cero, cobertura, faltanDia, faltanSemana, gramosServidos, rango } from './calcular.js'
import { objetivosPara } from './objetivos.js'

const alimento = (id: string, por100g: Partial<Nutrientes>, extra: Partial<Alimento> = {}): Alimento => ({
  id, nombre: id, alias: [], fdcId: null, grupo: 'otro', por100g: { ...cero(), ...por100g }, alergenos: [],
  porcionMedianaG: 100, fuente: 'USDA', ...extra,
})

const tabla = new Map([
  ['queso', alimento('queso', { calcio_mg: 500, proteina_g: 20 })],
  ['papa', alimento('papa', { vitamina_c_mg: 10, energia_kcal: 80 })],
  ['nuggets_pollo', alimento('nuggets_pollo', { proteina_g: 15 }, { porciones: [{ descripcion: '1 nugget', gramos: 16 }] })],
])

const coberturaCon = (valores: Partial<Nutrientes>): Nutrientes => ({ ...cero(), ...valores })

describe('objetivos por edad y sexo (§10.1)', () => {
  it('6 años: calcio 1000 mg, vitamina D 15 µg, vitamina C 25 mg, fibra 25 g, y la energía sin meta', () => {
    const o = objetivosPara(6, 'masculino')
    expect(o).toMatchObject({ calcio_mg: 1000, vitamina_d_ug: 15, vitamina_c_mg: 25, fibra_g: 25, proteina_g: 19, b12_ug: 1.2 })
    expect(o.energia_kcal).toBe(0)
  })

  it('de 9 a 13 años, la fibra y el omega-3 dependen del sexo', () => {
    expect(objetivosPara(10, 'femenino')).toMatchObject({ fibra_g: 26, omega3_g: 1, calcio_mg: 1300 })
    expect(objetivosPara(10, 'masculino')).toMatchObject({ fibra_g: 31, omega3_g: 1.2 })
  })

  it('la indicación del nutricionista reemplaza la tabla, nutriente por nutriente', () => {
    const o = objetivosPara(6, 'masculino', { calcio_mg: 800 })
    expect(o.calcio_mg).toBe(800)
    expect(o.vitamina_d_ug).toBe(15)
  })

  it('fuera de 1–18 años usa la franja más cercana', () => {
    expect(objetivosPara(0, 'femenino').calcio_mg).toBe(700)
    expect(objetivosPara(25, 'femenino').hierro_mg).toBe(15)
  })
})

describe('nutrientes de una comida (§5.1)', () => {
  it('gramos × tabla por 100 g; lo que no está en la tabla cuenta 0 y se avisa', () => {
    const { nutrientes, sinDatos } = aporte([{ alimentoId: 'queso', gramos: 40 }, { alimentoId: 'raro', gramos: 30 }], tabla)
    expect(nutrientes.calcio_mg).toBeCloseTo(200)
    expect(nutrientes.proteina_g).toBeCloseTo(8)
    expect(sinDatos).toEqual(['raro'])
  })

  it('un alimento que todavía no tiene valores (A3 sube primero los ids) cuenta 0 y se avisa, sin romper', () => {
    const soloId = new Map([['papa', { id: 'papa', nombre: 'Papa', alias: [], grupo: 'cereal_almidon', alergenos: [] } as unknown as Alimento]])
    const { nutrientes, sinDatos } = aporte([{ alimentoId: 'papa', gramos: 120 }], soloId)
    expect(nutrientes).toEqual(cero())
    expect(sinDatos).toEqual(['papa'])
  })

  it('si el padre corrige la porción: gramos = gramosEst × factor(padre) / factor(visión)', () => {
    const item = { porcion: 'mediana' as const, ingredientes: [{ alimentoId: 'papa', gramosEst: 120 }] }
    expect(gramosServidos(item, 'chica', tabla)[0]?.gramos).toBeCloseTo(72)
    expect(gramosServidos({ ...item, porcion: 'chica' }, 'grande', tabla)[0]?.gramos).toBeCloseTo(300)
  })

  it('si la visión contó unidades y hay peso por unidad (FNDDS), manda el conteo', () => {
    const item = { porcion: 'mediana' as const, ingredientes: [{ alimentoId: 'nuggets_pollo', gramosEst: 80 }], conteo: { cantidad: 6, unidad: 'nuggets' } }
    expect(gramosServidos(item, 'mediana', tabla)[0]?.gramos).toBeCloseTo(96)
    expect(gramosServidos({ ...item, conteo: { cantidad: 6, unidad: 'bastones' } }, 'mediana', tabla)[0]?.gramos).toBeCloseTo(80)
  })

  it('el rango mostrado es ±35%', () => {
    const r = rango({ ...cero(), calcio_mg: 200 })
    expect(r.min.calcio_mg).toBeCloseTo(130)
    expect(r.max.calcio_mg).toBeCloseTo(270)
  })
})

describe('cobertura y lo que le falta (§1)', () => {
  it('cobertura = consumido ÷ objetivo (puede pasar de 1) y la energía no tiene meta', () => {
    const c = cobertura({ ...cero(), calcio_mg: 1500, energia_kcal: 1200 }, objetivosPara(6, 'masculino'))
    expect(c.calcio_mg).toBeCloseTo(1.5)
    expect(c.energia_kcal).toBe(0)
  })

  it('del día: lo que no llega al 100%, de menor a mayor cobertura', () => {
    const cob = coberturaCon({ calcio_mg: 0.5, vitamina_d_ug: 0.1, hierro_mg: 1.2, fibra_g: 0.9, omega3_g: 2, b12_ug: 1, vitamina_c_mg: 3, proteina_g: 1.1 })
    expect(faltanDia(cob)).toEqual(['vitamina_d_ug', 'calcio_mg', 'fibra_g'])
  })

  it('de la semana: debajo del 70%, en el orden de gravedad del research (calcio antes que vitamina D aunque cubra más)', () => {
    const cob = coberturaCon({ calcio_mg: 0.48, vitamina_d_ug: 0.2, hierro_mg: 0.65, fibra_g: 0.75, omega3_g: 0.1, b12_ug: 0.5, vitamina_c_mg: 0.5, proteina_g: 0.3 })
    expect(faltanSemana(cob)).toEqual(['calcio_mg', 'vitamina_d_ug', 'hierro_mg', 'omega3_g', 'vitamina_c_mg', 'b12_ug', 'proteina_g'])
  })

  it('la vitamina C va primero solo si casi no hay ninguna fuente (< 30%)', () => {
    const cob = coberturaCon({ calcio_mg: 0.5, vitamina_d_ug: 1, hierro_mg: 1, fibra_g: 1, omega3_g: 1, b12_ug: 1, proteina_g: 1, vitamina_c_mg: 0.2 })
    expect(faltanSemana(cob)).toEqual(['vitamina_c_mg', 'calcio_mg'])
  })
})
