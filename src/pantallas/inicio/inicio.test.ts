import { describe, expect, it } from 'vitest'
import type { CoberturaDia, Progreso } from '../../../shared/contratos'
import { comidasRegistradas, lineaSemana, porEstado } from './Hoy'

describe('Hoy', () => {
  it('la línea de la semana nombra los dos que más faltan, sin porcentajes', () => {
    const semana = { cobertura: {}, faltan: ['calcio_mg', 'vitamina_d_ug', 'fibra_g', 'omega3_g'], energiaPromedioKcal: 700 } as unknown as Progreso['semana']
    expect(lineaSemana(semana)).toBe('Semana: le falta más calcio y vitamina D.')
    expect(lineaSemana({ ...semana, faltan: [] })).toBe('Semana: no le falta ninguno.')
  })

  it('agrupa los nutrientes del día por estado, sin grupos vacíos y respetando el orden', () => {
    const cobertura = { proteina_g: 2.6, b12_ug: 3.23, hierro_mg: 0.94, calcio_mg: 0.49, vitamina_d_ug: 0.1 } as CoberturaDia['cobertura']
    expect(porEstado(cobertura, ['calcio_mg', 'vitamina_d_ug', 'hierro_mg', 'b12_ug', 'proteina_g'])).toEqual([
      { estado: 'cubierto', nutrientes: ['b12_ug', 'proteina_g'] },
      { estado: 'casi', nutrientes: ['hierro_mg'] },
      { estado: 'falta', nutrientes: ['calcio_mg', 'vitamina_d_ug'] },
    ])
  })

  it('las comidas del día, en el orden en que se registraron', () => {
    const dia = { comidas: [
      { momento: 'almuerzo', fechaISO: '2026-10-17T12:30:00-03:00' },
      { momento: 'desayuno', fechaISO: '2026-10-17T08:30:00-03:00' },
      { momento: 'merienda', fechaISO: '2026-10-17T17:00:00-03:00' },
    ] } as unknown as CoberturaDia
    expect(comidasRegistradas(dia)).toBe('Desayuno, almuerzo y merienda')
  })

  it('si se repite una comida, la cuenta en vez de repetirla', () => {
    const dia = { comidas: [
      { momento: 'cena', fechaISO: '2026-10-17T21:30:00-03:00' },
      { momento: 'almuerzo', fechaISO: '2026-10-17T12:30:00-03:00' },
      { momento: 'cena', fechaISO: '2026-10-17T20:30:00-03:00' },
    ] } as unknown as CoberturaDia
    expect(comidasRegistradas(dia)).toBe('Almuerzo y 2 cenas')
  })
})
