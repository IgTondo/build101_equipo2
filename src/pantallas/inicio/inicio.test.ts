import { describe, expect, it } from 'vitest'
import type { CoberturaDia, Progreso } from '../../../shared/contratos'
import { comidasRegistradas, lineaSemana } from './Hoy'

describe('Hoy', () => {
  it('la línea de la semana cuenta los cubiertos y nombra los dos que más faltan', () => {
    const semana = { cobertura: {}, faltan: ['calcio_mg', 'vitamina_d_ug', 'fibra_g', 'omega3_g'], energiaPromedioKcal: 700 } as unknown as Progreso['semana']
    expect(lineaSemana(semana)).toBe('Semana: 4 de 8 nutrientes cubiertos. Le falta más: calcio y vitamina D.')
    expect(lineaSemana({ ...semana, faltan: [] })).toBe('Semana: 8 de 8 nutrientes cubiertos.')
  })

  it('las comidas del día, en el orden en que se registraron', () => {
    const dia = { comidas: [
      { momento: 'almuerzo', fechaISO: '2026-10-17T12:30:00-03:00' },
      { momento: 'desayuno', fechaISO: '2026-10-17T08:30:00-03:00' },
      { momento: 'merienda', fechaISO: '2026-10-17T17:00:00-03:00' },
    ] } as unknown as CoberturaDia
    expect(comidasRegistradas(dia)).toBe('Desayuno, almuerzo y merienda')
  })
})
