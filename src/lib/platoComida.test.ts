import { describe, expect, it } from 'vitest'
import type { ItemPlato, PlatoComida, Progreso, Sugerencia } from '../../shared/contratos'
import progresoFixture from '../../fixtures/progreso.json'
import {
  altPlato, cubreEnPalabras, etiquetaComida, lineaDespues, lineaVacio, modeloTarjeta, nombreCorto, pasoHoy, platoParaImagen,
} from './platoComida'

const fixture = progresoFixture as unknown as Progreso

const item = (preparacionId: string, nombre: string): ItemPlato =>
  ({ preparacionId, nombre, porcion: 'mediana', aporte: {}, porQue: 'La come 8 de cada 8 veces' })

const pasito: Sugerencia = {
  tipo: 'un_paso', preparacionId: 'bastones_queso_horno', nombre: 'Bastones de queso horneados', probAcepta: 0.62,
  aporte: { calcio_mg: 212 }, porQue: 'Se parece a sus papas al horno en bastones: cambia solo el ingrediente.',
}

const cena: PlatoComida = {
  momento: 'cena',
  seguros: [item('milanesa_carne_horno', 'Milanesa de carne al horno (rebozada sin huevo)'), item('papas_horno_baston', 'Papas al horno en bastones, crocantes')],
  pasito, nutriente: 'calcio_mg', cubre: 0.55, porQue: 'Lo que ya come para la cena, y un pasito hacia el calcio',
}

describe('cubreEnPalabras', () => {
  it('lleva la cobertura a palabras, nunca a más de "todo"', () => {
    expect(cubreEnPalabras(1, 'calcio_mg')).toBe('Cubre todo el calcio que le falta hoy.')
    expect(cubreEnPalabras(1.8, 'calcio_mg')).toBe('Cubre todo el calcio que le falta hoy.')
    expect(cubreEnPalabras(0.5, 'calcio_mg')).toBe('Cubre la mitad o más del calcio que le falta hoy.')
    expect(cubreEnPalabras(0.99, 'calcio_mg')).toBe('Cubre la mitad o más del calcio que le falta hoy.')
    expect(cubreEnPalabras(0.25, 'calcio_mg')).toBe('Cubre una parte del calcio que le falta hoy.')
    expect(cubreEnPalabras(0.1, 'calcio_mg')).toBe('Cubre un poco del calcio que le falta hoy.')
  })

  it('concuerda con el nutriente: toda la vitamina D, de la fibra, del omega-3', () => {
    expect(cubreEnPalabras(1, 'vitamina_d_ug')).toBe('Cubre toda la vitamina D que le falta hoy.')
    expect(cubreEnPalabras(0.3, 'fibra_g')).toBe('Cubre una parte de la fibra que le falta hoy.')
    expect(cubreEnPalabras(0.6, 'omega3_g')).toBe('Cubre la mitad o más del omega-3 que le falta hoy.')
  })

  it('si no cubre nada, no se sabe, o es la energía (sin meta), no dice nada', () => {
    expect(cubreEnPalabras(0, 'calcio_mg')).toBeNull()
    expect(cubreEnPalabras(Number.NaN, 'calcio_mg')).toBeNull()
    expect(cubreEnPalabras(0.5, 'energia_kcal')).toBeNull()
  })
})

describe('palabras de la tarjeta', () => {
  it('nombreCorto saca el paréntesis y la aclaración después de la coma, pero no lo que NO lleva', () => {
    expect(nombreCorto('Milanesa de carne al horno (rebozada sin huevo)')).toBe('Milanesa de carne al horno (sin huevo)')
    expect(nombreCorto('Milanesa a la napolitana (sin huevo)')).toBe('Milanesa a la napolitana (sin huevo)')
    expect(nombreCorto('Nuggets de pollo (caseros)')).toBe('Nuggets de pollo')
    expect(nombreCorto('Papas al horno en bastones, crocantes')).toBe('Papas al horno en bastones')
    expect(nombreCorto('Leche chocolatada')).toBe('Leche chocolatada')
    expect(nombreCorto('(raro)')).toBe('(raro)')
  })

  it('la etiqueta: la próxima comida es la de hoy; una que ya pasó es la de mañana; la merienda, la de hoy', () => {
    const cenaHoy = { momento: 'cena' as const, manana: false }
    expect(etiquetaComida('cena', cenaHoy)).toBe('Para la cena')
    expect(etiquetaComida('merienda', cenaHoy)).toBe('Para la merienda')
    expect(etiquetaComida('desayuno', cenaHoy)).toBe('Para mañana: desayuno')
    expect(etiquetaComida('almuerzo', { momento: 'almuerzo', manana: false })).toBe('Para el almuerzo')
    expect(etiquetaComida('desayuno', { momento: 'desayuno', manana: true })).toBe('Para mañana: desayuno')
    expect(etiquetaComida('cena', { momento: 'desayuno', manana: true })).toBe('Para mañana: cena')
    expect(pasoHoy('almuerzo', { momento: 'desayuno', manana: false })).toBe(false)
  })

  it('la invitación a registrar y el plato vacío nombran la comida', () => {
    expect(lineaDespues('cena')).toBe('Después de la cena, sacale una foto y contanos cómo le fue.')
    expect(lineaDespues('desayuno')).toBe('Después del desayuno, sacale una foto y contanos cómo le fue.')
    expect(lineaVacio('merienda')).toBe('Todavía no tenemos algo para la merienda. Registrá comidas y van a aparecer ideas.')
  })
})

describe('modeloTarjeta', () => {
  it('con plato: lo seguro con nombres cortos, el pasito con su receta y cómo servirlo, y qué cubre', () => {
    const m = modeloTarjeta('tomas', { ...fixture, plato: cena, momento: 'cena' }, 'cena')
    expect(m).toEqual({
      tipo: 'plato',
      seguros: [{ id: 'milanesa_carne_horno', nombre: 'Milanesa de carne al horno (sin huevo)' }, { id: 'papas_horno_baston', nombre: 'Papas al horno en bastones' }],
      pasito: {
        nombre: 'Bastones de queso horneados',
        receta: '/receta?nino=tomas&preparacionId=bastones_queso_horno&nutriente=calcio_mg&momento=cena',
        servir: '/receta?nino=tomas&preparacionId=bastones_queso_horno&nutriente=calcio_mg&momento=cena&ver=plato',
      },
      cubre: 'Cubre la mitad o más del calcio que le falta hoy.',
    })
  })

  it('nunca más de 3 seguros; sin pasito, sin acciones', () => {
    const muchos = { ...cena, pasito: undefined, seguros: ['a', 'b', 'c', 'd'].map((x) => item(x, x)) }
    const m = modeloTarjeta('tomas', { ...fixture, plato: muchos }, 'cena')
    expect(m.tipo === 'plato' && m.seguros.map((s) => s.id)).toEqual(['a', 'b', 'c'])
    expect(m.tipo === 'plato' && m.pasito).toBeNull()
  })

  it('plato vacío (sin seguros ni pasito): el mensaje calmo, sin caer en la sugerencia suelta', () => {
    const vacio: PlatoComida = { ...cena, momento: 'merienda', seguros: [], pasito: undefined, cubre: 0 }
    expect(modeloTarjeta('tomas', { ...fixture, plato: vacio }, 'merienda')).toEqual({ tipo: 'vacio', texto: lineaVacio('merienda') })
  })

  it('sin plato (B todavía no lo manda): la sugerencia sola de la v5.2, con su receta', () => {
    const m = modeloTarjeta('tomas', fixture, 'cena')
    expect(m.tipo).toBe('sugerencia')
    expect(m.tipo === 'sugerencia' && m.nombre).toBe('Bastones de queso horneados')
    expect(m.tipo === 'sugerencia' && m.porQue).toBe('Se parece a sus papas al horno en bastones.')
    expect(m.tipo === 'sugerencia' && m.receta).toContain('momento=cena')
  })

  it('un plato de otra comida no sirve: cae en la sugerencia de esta', () => {
    expect(modeloTarjeta('tomas', { ...fixture, plato: cena }, 'desayuno').tipo).toBe('sugerencia')
  })

  it('sin plato ni sugerencia que encaje: el mensaje calmo', () => {
    expect(modeloTarjeta('tomas', { ...fixture, sugerencias: [], proximoPaso: undefined }, 'merienda'))
      .toEqual({ tipo: 'sin_idea', texto: lineaVacio('merienda') })
  })
})

describe('platoParaImagen', () => {
  it('dibuja el plato solo si la receta es la de su pasito', () => {
    expect(platoParaImagen(cena, { preparacionBaseId: 'bastones_queso_horno' })).toBe(cena)
    expect(platoParaImagen(cena, { preparacionBaseId: 'nuggets_pollo_horno' })).toBeUndefined()
    expect(platoParaImagen({ ...cena, pasito: undefined }, { preparacionBaseId: 'bastones_queso_horno' })).toBeUndefined()
    expect(platoParaImagen(null, { preparacionBaseId: 'bastones_queso_horno' })).toBeUndefined()
  })

  it('el texto alternativo nombra lo seguro y el pasito al costado', () => {
    expect(altPlato(cena, 'Bastones de queso horneados'))
      .toBe('El plato: Milanesa de carne al horno (sin huevo) y papas al horno en bastones; al costado, en porción chica, bastones de queso horneados.')
  })
})
