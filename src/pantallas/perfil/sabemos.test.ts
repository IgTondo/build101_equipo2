import { describe, expect, it } from 'vitest'
import type { PatronVista, Perfil } from '../../../shared/contratos'
import perfilFixture from '../../../fixtures/perfil.json'
import { fraseParaPadres, loQueNotamos, loQueSabemos } from './sabemos'

const perfil = perfilFixture as Perfil
const patron = (texto: string, resultado: PatronVista['resultado'], apoyo = 3, confianza = 0.5, fuente: PatronVista['fuente'] = 'aprendido'): PatronVista =>
  ({ texto, resultado, apoyo, confianza, fuente })

describe('fraseParaPadres', () => {
  it('dice "le gusta" y "todavía no le gusta", sin "rechaza" ni "(n de m)"', () => {
    expect(fraseParaPadres('Lo crocante lo acepta (28 de 35)')).toBe('Le gusta lo crocante')
    expect(fraseParaPadres('Lo hervido lo rechaza (8 de 8)')).toBe('Todavía no le gusta lo hervido')
    expect(fraseParaPadres('Las verduras las rechaza (3 de 3)')).toBe('Todavía no le gustan las verduras')
    expect(fraseParaPadres('Los cereales, panes y papas servido separado los acepta (17 de 20)')).toBe('Le gustan los cereales, panes y papas servido separado')
    expect(fraseParaPadres('Lo blando lo rechaza, aunque sea un alimento que acepta en otra textura'))
      .toBe('Todavía no le gusta lo blando, aunque sea un alimento que acepta en otra textura')
    expect(fraseParaPadres('Lo mezclado lo rechaza (según la investigación)')).toBe('Todavía no le gusta lo mezclado')
  })

  it('si no reconoce la frase, igual saca "rechaza"', () => {
    expect(fraseParaPadres('Las texturas mixtas suelen rechazarse')).toBe('Las texturas mixtas suelen costar')
  })
})

describe('loQueNotamos', () => {
  it('hasta 3, primero lo que le gusta, sin la investigación ni sujetos repetidos', () => {
    const r = loQueNotamos([
      patron('Lo crocante lo acepta (28 de 35)', 'acepta', 35, 0.51),
      patron('Lo crocante entre los cereales, panes y papas lo acepta (18 de 18)', 'acepta', 18, 0.86),
      patron('Lo amarillo lo acepta (12 de 14)', 'acepta', 14, 0.59),
      patron('Lo beige lo acepta (4 de 4)', 'acepta', 4, 0.57),
      patron('Lo hervido lo rechaza (8 de 8)', 'rechaza', 8, 0.69),
      patron('Lo mezclado lo rechaza (según la investigación)', 'rechaza', 40, 0.9, 'investigacion'),
    ])
    expect(r).toEqual(['Le gusta lo crocante', 'Le gusta lo amarillo', 'Todavía no le gusta lo hervido'])
    expect(r.join(' ')).not.toMatch(/rechaza|\d|investigaci/i)
  })

  it('si no hay nada que le guste, completa con lo que todavía no', () => {
    const r = loQueNotamos([patron('Lo hervido lo rechaza', 'rechaza', 8), patron('Lo blando lo rechaza', 'rechaza', 6), patron('Lo jugoso lo rechaza', 'rechaza', 3)])
    expect(r).toHaveLength(3)
    expect(r[0]).toBe('Todavía no le gusta lo hervido')
  })

  it('sin patrones, nada', () => {
    expect(loQueNotamos([])).toEqual([])
  })
})

describe('loQueSabemos', () => {
  it('le gusta (hasta 6), está probando (hasta 4) y lo que notamos (hasta 3)', () => {
    const s = loQueSabemos(perfil)
    const aceptadas = perfil.preparaciones.filter((p) => p.estado === 'acepta').length
    expect(s.leGusta.length).toBe(Math.min(aceptadas, 6))
    expect(s.leGusta.every((p) => p.estado === 'acepta')).toBe(true)
    expect(s.leGustaMas).toBe(Math.max(aceptadas - 6, 0))
    expect(s.probando.length).toBeLessThanOrEqual(4)
    expect(s.probando.every((p) => p.estado === 'en_proceso')).toBe(true)
    expect(s.notamos.length).toBeGreaterThan(0)
    expect(s.notamos.length).toBeLessThanOrEqual(3)
    expect(s.notamos[0]).toMatch(/^Le gusta/)
  })
})
