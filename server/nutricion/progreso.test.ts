import { describe, expect, it } from 'vitest'
import { calcularEstado } from '../aprendizaje/estado.js'
import { sumarDias } from '../datos/fechas.js'
import { alimentosPrueba, catalogoPrueba, comidasSinteticas, ninoDoc, sintetico } from '../datos/prueba/catalogos.js'
import { cero } from './calcular.js'
import { objetivosPara } from './objetivos.js'
import { type Semana, armarProgreso, frase } from './progreso.js'

const semanaCon = (diasRegistrados: number): Semana => ({ desde: '2026-10-10', hasta: '2026-10-16', diasRegistrados, promedio: cero(), cobertura: cero() })

describe('la frase del tablero', () => {
  it('compara con la semana pasada solo si la hubo', () => {
    expect(frase('Tomás', semanaCon(3), [], 6, 1)).toMatch(/Come 6 preparaciones \(1 más que la semana pasada\)\.$/)
    expect(frase('Tomás', semanaCon(3), [], 6, 0)).toMatch(/Come 6 preparaciones \(igual que la semana pasada\)\.$/)
    expect(frase('Tomás', semanaCon(3), [], 6, null)).toMatch(/Come 6 preparaciones\.$/)
    expect(frase('Tomás', semanaCon(3), [], 1, null)).toMatch(/Come 1 preparación\.$/)
  })

  it('un chico creado hoy no dice "igual que la semana pasada"', () => {
    const catalogo = catalogoPrueba()
    const alimentos = alimentosPrueba()
    const s = sintetico('tomas')
    const hoy = '2026-10-16'
    const nino = ninoDoc(s, `${hoy}T08:00:00-03:00`)
    const comidas = comidasSinteticas(s, alimentos, catalogo).filter((c) => c.dia === hoy)
    const p = armarProgreso({
      nino, comidas, hoy, dias: 28, recomendacion: null,
      objetivo: objetivosPara(s.datos.edad, s.datos.sexo),
      estado: calcularEstado(nino, comidas, catalogo),
      estadoHace7: calcularEstado(nino, comidas, catalogo, { hasta: sumarDias(hoy, -7) }),
      estadoHace14: calcularEstado(nino, comidas, catalogo, { hasta: sumarDias(hoy, -14) }),
    })
    expect(p.frase).toMatch(/^Esta semana Tomás cubrió \d de 8 nutrientes\. .+ Come \d+ preparaci(ón|ones)\.$/)
    expect(p.frase).not.toContain('semana pasada')
  })
})
