import { describe, expect, it } from 'vitest'
import { su } from './legible'

describe('su (el alimento seguro en una frase)', () => {
  it('singular o plural según la primera palabra, en minúscula', () => {
    expect(su('Milanesa de carne al horno')).toBe('su milanesa de carne al horno')
    expect(su('Papas fritas')).toBe('sus papas fritas')
    expect(su('Fideos con manteca')).toBe('sus fideos con manteca')
    expect(su('Arroz blanco')).toBe('su arroz blanco')
    expect(su('pizza')).toBe('su pizza')
  })
})
