import { describe, expect, it } from 'vitest'
import { textoParaPadres } from './vocabulario'

describe('textoParaPadres', () => {
  it('cambia "lo rechaza" por "todavía no lo acepta" y respeta el pronombre', () => {
    expect(textoParaPadres('Lo hervido lo rechaza (8 de 8)')).toBe('Lo hervido todavía no lo acepta (8 de 8)')
    expect(textoParaPadres('Las verduras las rechaza (3 de 3)')).toBe('Las verduras todavía no las acepta (3 de 3)')
    expect(textoParaPadres('Se confirma: lo blando lo rechaza (6 de 6).')).toBe('Se confirma: lo blando todavía no lo acepta (6 de 6).')
    expect(textoParaPadres('Lo que se sirve cuando los alimentos se tocan lo rechaza (según la investigación)'))
      .toBe('Lo que se sirve cuando los alimentos se tocan todavía no lo acepta (según la investigación)')
  })

  it('no toca lo que acepta', () => {
    expect(textoParaPadres('Lo crocante lo acepta (26 de 31)')).toBe('Lo crocante lo acepta (26 de 31)')
  })
})
