import { describe, expect, it } from 'vitest'
import { glifoAlimento, normalizar } from './alimentos'

describe('glifoAlimento', () => {
  it('reconoce lo que come Tomás', () => {
    expect(glifoAlimento('Papas fritas en bastones')).toBe('🍟')
    expect(glifoAlimento('Milanesa de carne al horno')).toBe('🥩')
    expect(glifoAlimento('Tostadas de pan blanco')).toBe('🍞')
    expect(glifoAlimento('Galletitas de agua')).toBe('🍪')
    expect(glifoAlimento('Leche chocolatada fría')).toBe('🥛')
  })

  it('va de lo específico a lo general', () => {
    expect(glifoAlimento('Puré de papa')).toBe('🥔')
    expect(glifoAlimento('Arroz con pollo')).toBe('🍛')
    expect(glifoAlimento('Milanesa de pollo')).toBe('🍗')
    expect(glifoAlimento('Dulce de leche')).toBe('🍯')
    expect(glifoAlimento('Yogur bebible de frutilla')).toBe('🥛')
    expect(glifoAlimento('Empanada de carne')).toBe('🥟')
  })

  it('sin coincidencia usa el grupo, y sin grupo un plato', () => {
    expect(glifoAlimento('Zapallo asado', 'verdura')).toBe('🥦')
    expect(glifoAlimento('Algo raro', 'lacteo')).toBe('🥛')
    expect(glifoAlimento('Algo raro')).toBe('🍽️')
  })

  it('normaliza tildes y eñes', () => {
    expect(normalizar('Ñoquis de Calabaza')).toBe('noquis de calabaza')
    expect(glifoAlimento('Ñoquis')).toBe('🍝')
  })
})
