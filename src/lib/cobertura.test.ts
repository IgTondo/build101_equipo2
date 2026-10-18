import { describe, expect, it } from 'vitest'
import { contarEstados, estadoCobertura, fraccionBarra, porcentajeTope, resumenEstados, UMBRAL } from './cobertura'

describe('estado de la cobertura', () => {
  it('Cubierto desde el 100%, Casi del 70 al 99%, Le falta por debajo del 70%', () => {
    expect(estadoCobertura(1.58)).toBe('cubierto')
    expect(estadoCobertura(1)).toBe('cubierto')
    expect(estadoCobertura(0.99)).toBe('casi')
    expect(estadoCobertura(UMBRAL.casi)).toBe('casi')
    expect(estadoCobertura(0.69)).toBe('falta')
    expect(estadoCobertura(0)).toBe('falta')
  })
  it('lo que no es un número cuenta como 0', () => {
    expect(estadoCobertura(Number.NaN)).toBe('falta')
    expect(estadoCobertura(-1)).toBe('falta')
  })
  it('el umbral de "Casi" es el 70% de PLAN §1', () => {
    expect(UMBRAL).toEqual({ cubierto: 1, casi: 0.7 })
  })
})

describe('barra y porcentaje con tope', () => {
  it('la barra se llena hasta el 100% y no pasa', () => {
    expect(fraccionBarra(0.4)).toBe(0.4)
    expect(fraccionBarra(2.6)).toBe(1)
    expect(fraccionBarra(-0.2)).toBe(0)
    expect(fraccionBarra(Number.NaN)).toBe(0)
  })
  it('ningún porcentaje pasa de 100%', () => {
    expect(porcentajeTope(1.58)).toBe('100%')
    expect(porcentajeTope(0.404)).toBe('40%')
    expect(porcentajeTope(0.996)).toBe('100%')
  })
})

describe('contarEstados', () => {
  it('cuenta los 8 con meta (la energía no)', () => {
    const c = { energia_kcal: 0, proteina_g: 1.74, calcio_mg: 0.4, vitamina_d_ug: 0.09, hierro_mg: 0.73, fibra_g: 0.22, omega3_g: 0.19, b12_ug: 2.01, vitamina_c_mg: 0.85 }
    expect(contarEstados(c)).toEqual({ cubierto: 2, casi: 2, falta: 4 })
  })
  it('la cuenta en una línea, con singular y plural', () => {
    expect(resumenEstados({ cubierto: 2, casi: 2, falta: 4 })).toBe('2 cubiertos · 2 casi · 4 le faltan')
    expect(resumenEstados({ cubierto: 1, casi: 0, falta: 1 })).toBe('1 cubierto · 0 casi · 1 le falta')
  })
})
