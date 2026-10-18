// v5.8 · Las otras alergias contra el catálogo real (data/alimentos.json).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Alimento } from '../shared/contratos.js'
import { alergenoDe, alergiasSinCruce, alimentosProhibidos, limpiarOtras, palabrasDe, patronAlergia } from './alergias.js'

const ALIMENTOS = JSON.parse(readFileSync(join(process.cwd(), 'data', 'alimentos.json'), 'utf8')) as Alimento[]
const porId = new Map(ALIMENTOS.map((a) => [a.id, a]))
const prohibidos = (...otras: string[]) => [...alimentosProhibidos(otras, ALIMENTOS)].sort()

describe('alimentosProhibidos', () => {
  it('kiwi y durazno: el alimento, en singular o plural y con mayúsculas', () => {
    expect(prohibidos('kiwi')).toEqual(['kiwi'])
    expect(prohibidos('Kiwis')).toEqual(['kiwi'])
    expect(prohibidos('duraznos')).toEqual(['durazno', 'durazno_almibar']) // v5.10: el catálogo suma los duraznos en almíbar
    expect(prohibidos('melocotón')).toEqual(['durazno'])
  })

  it('frutillas ↔ frutilla, y por alias (fresa)', () => {
    expect(prohibidos('frutillas')).toEqual(['frutilla'])
    expect(prohibidos('fresa')).toEqual(['frutilla'])
    expect(prohibidos('al kiwi', 'a las frutillas')).toEqual(['frutilla', 'kiwi'])
  })

  it('tomate: también lo que lo lleva (la salsa y el kétchup)', () => {
    expect(prohibidos('tomate')).toEqual(['ketchup', 'salsa_tomate', 'tomate'])
    expect(prohibidos('tomates')).toEqual(['ketchup', 'salsa_tomate', 'tomate'])
  })

  it('un alimento nombrado dentro de la alergia cuenta (ante la duda, se bloquea)', () => {
    expect(prohibidos('durazno en almíbar')).toEqual(['durazno', 'durazno_almibar']) // v5.10: y ahora también el propio
    expect(prohibidos('jugo de naranja')).toEqual(['jugo_naranja', 'naranja'])
  })

  it('"sal" no bloquea la salsa ni lo salado: palabras completas', () => {
    const p = prohibidos('sal')
    expect(p).not.toContain('salsa_tomate')
    expect(p).not.toContain('galletitas_agua') // "galletas saladas"
    expect(p).not.toContain('salmon')
    expect(p).toEqual([])
  })

  it('"colorante rojo" no cruza con ningún alimento', () => {
    expect(prohibidos('colorante rojo')).toEqual([])
  })

  it('una de las de siempre con otras palabras usa los alérgenos de la tabla', () => {
    expect(alergenoDe('lácteos')).toBe('leche')
    const p = prohibidos('lácteos')
    expect(p).toContain('yogur')
    expect(p).toContain('queso_dambo')
    expect(prohibidos('trigo')).toContain('pan_blanco')
  })

  it('nunca los genéricos (otro_fruta no es un alimento concreto), y acepta un Map', () => {
    expect(prohibidos('fruta')).not.toContain('otro_fruta')
    expect([...alimentosProhibidos(['kiwi'], porId)]).toEqual(['kiwi'])
    expect(alimentosProhibidos([], ALIMENTOS).size).toBe(0)
  })
})

describe('alergiasSinCruce', () => {
  it('devuelve las que no alcanzan a ningún alimento, como las escribió el padre', () => {
    expect(alergiasSinCruce(['Kiwi', 'Colorante rojo', 'sal'], ALIMENTOS)).toEqual(['Colorante rojo', 'sal'])
    expect(alergiasSinCruce([], ALIMENTOS)).toEqual([])
  })
})

describe('patronAlergia', () => {
  it('encuentra la alergia en singular o plural y por palabras completas', () => {
    expect(patronAlergia('kiwi').test('cortá los kiwis en rodajas')).toBe(true)
    expect(patronAlergia('frutillas').test('una frutilla al costado')).toBe(true)
    expect(patronAlergia('nuez').test('con nueces picadas')).toBe(true)
    expect(patronAlergia('colorante rojo').test('sin colorantes rojos')).toBe(true)
    expect(patronAlergia('sal').test('con salsa aparte')).toBe(false)
    expect(patronAlergia('sal').test('una pizca de sal')).toBe(true)
    expect(patronAlergia('').test('cualquier cosa')).toBe(false)
  })

  it('sin "al", "a la"… adelante', () => {
    expect(palabrasDe('Alérgica al kiwi')).toEqual(['kiwi'])
    expect(palabrasDe('a las frutillas')).toEqual(['frutillas'])
  })
})

describe('limpiarOtras', () => {
  it('sin vacías ni repetidas', () => {
    expect(limpiarOtras(['  kiwi ', 'Kiwi', '', 'colorante   rojo'])).toEqual(['kiwi', 'colorante rojo'])
    expect(limpiarOtras(undefined)).toEqual([])
  })
})
