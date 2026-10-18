import { describe, expect, it } from 'vitest'
import { NOMBRE_ROL, nutrientesDelPlato, porcentajeDelDia } from './plato'

describe('nutrientesDelPlato', () => {
  const cubre = { energia_kcal: 0.3, proteina_g: 1.2, calcio_mg: 0.1, hierro_mg: 0.4, fibra_g: 0.25, vitamina_c_mg: 0.6, omega3_g: 0.05 }

  it('primero el de la receta, después la proteína y los dos que más cubre', () => {
    expect(nutrientesDelPlato(cubre, 'omega3_g')).toEqual(['omega3_g', 'proteina_g', 'vitamina_c_mg', 'hierro_mg'])
  })

  it('si el de la receta es la proteína, no se repite: suma otro', () => {
    expect(nutrientesDelPlato(cubre, 'proteina_g')).toEqual(['proteina_g', 'vitamina_c_mg', 'hierro_mg', 'fibra_g'])
  })

  it('nunca la energía, y los que el plato no aporta quedan afuera', () => {
    expect(nutrientesDelPlato({ energia_kcal: 0.5, calcio_mg: 0.2 }, 'calcio_mg')).toEqual(['calcio_mg'])
    expect(nutrientesDelPlato({ proteina_g: 0.3 }, 'energia_kcal')).toEqual(['proteina_g'])
  })

  it('el de la receta va aunque no venga en cubreDelDia', () => {
    expect(nutrientesDelPlato({ proteina_g: 0.3 }, 'vitamina_d_ug', 3)).toEqual(['vitamina_d_ug', 'proteina_g'])
  })

  it('respeta cuántos', () => {
    expect(nutrientesDelPlato(cubre, 'omega3_g', 3)).toEqual(['omega3_g', 'proteina_g', 'vitamina_c_mg'])
  })
})

describe('porcentajeDelDia', () => {
  it('el porcentaje real, redondeado', () => {
    expect(porcentajeDelDia(0.35)).toBe('35% del día')
    expect(porcentajeDelDia(1.2)).toBe('todo lo del día')
    expect(porcentajeDelDia(1)).toBe('todo lo del día')
  })

  it('si aporta algo, al menos 1%; si no, 0%', () => {
    expect(porcentajeDelDia(0.002)).toBe('1% del día')
    expect(porcentajeDelDia(0)).toBe('0% del día')
    expect(porcentajeDelDia(undefined)).toBe('0% del día')
    expect(porcentajeDelDia(Number.NaN)).toBe('0% del día')
  })
})

describe('NOMBRE_ROL', () => {
  it('en castellano', () => {
    expect(NOMBRE_ROL.cereal_pan).toBe('Pan o cereal')
    expect(NOMBRE_ROL.verdura_fruta).toBe('Verdura o fruta')
  })
})
