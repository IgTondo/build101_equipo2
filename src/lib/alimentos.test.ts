import { describe, expect, it } from 'vitest'
import { ICONOS_ALIMENTO, iconoAlimento, normalizar } from './alimentos'

describe('iconoAlimento', () => {
  it('reconoce lo que come Tomás', () => {
    expect(iconoAlimento('Papas fritas en bastones')).toBe('bastones')
    expect(iconoAlimento('Papas al horno en bastones, crocantes')).toBe('bastones')
    expect(iconoAlimento('Milanesa de carne al horno')).toBe('milanesa')
    expect(iconoAlimento('Tostadas de pan blanco')).toBe('pan')
    expect(iconoAlimento('Galletitas de agua')).toBe('galletita')
    expect(iconoAlimento('Leche chocolatada fría')).toBe('leche')
  })

  it('va de lo específico a lo general: primero el plato, después el ingrediente', () => {
    expect(iconoAlimento('Puré de papa')).toBe('pure')
    expect(iconoAlimento('Papa hervida en trozos')).toBe('papa')
    expect(iconoAlimento('Arroz con pollo')).toBe('arroz')
    expect(iconoAlimento('Milanesa de pollo')).toBe('milanesa')
    expect(iconoAlimento('Milanesa de lentejas')).toBe('milanesa')
    expect(iconoAlimento('Nuggets de pollo')).toBe('nuggets')
    expect(iconoAlimento('Pollo a la plancha')).toBe('pollo')
    expect(iconoAlimento('Dulce de leche')).toBe('frasco')
    expect(iconoAlimento('Licuado de banana')).toBe('licuado')
    expect(iconoAlimento('Yogur bebible de frutilla')).toBe('leche')
    expect(iconoAlimento('Empanada de carne')).toBe('empanada')
    expect(iconoAlimento('Polenta')).toBe('choclo')
  })

  it('los bastones son de papa: los de otra cosa se reconocen por lo que son', () => {
    expect(iconoAlimento('Bastones de queso horneados')).toBe('queso')
    expect(iconoAlimento('Bastones de zanahoria horneados')).toBe('zanahoria')
    // Lo que va después de la coma es descripción
    expect(iconoAlimento('Bastones de queso al horno, crocantes como sus papas')).toBe('queso')
  })

  it('el zapallo no es zapallito, y "asado" solo cuenta al principio', () => {
    expect(iconoAlimento('Zapallo asado', 'verdura')).toBe('zapallo')
    expect(iconoAlimento('Calabaza al horno')).toBe('zapallo')
    expect(iconoAlimento('Zapallitos rellenos')).toBe('pepino')
    expect(iconoAlimento('Asado de tira')).toBe('carne')
  })

  it('sin coincidencia usa el grupo, y sin grupo un plato', () => {
    expect(iconoAlimento('Algo raro', 'fruta')).toBe('grupo_fruta')
    expect(iconoAlimento('Algo raro', 'lacteo')).toBe('grupo_lacteo')
    expect(iconoAlimento('Algo raro', 'cereal_almidon')).toBe('grupo_cereal')
    expect(iconoAlimento('Algo raro', 'otro')).toBe('plato')
    expect(iconoAlimento('Algo raro')).toBe('plato')
  })

  it('normaliza tildes y eñes', () => {
    expect(normalizar('Ñoquis de Calabaza')).toBe('noquis de calabaza')
    expect(iconoAlimento('Ñoquis de calabaza')).toBe('fideos')
    expect(iconoAlimento('Brócoli hervido')).toBe('brocoli')
  })

  it('cada ícono tiene un id único', () => {
    expect(new Set(ICONOS_ALIMENTO).size).toBe(ICONOS_ALIMENTO.length)
  })
})
