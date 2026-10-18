import { describe, expect, it } from 'vitest'
import { afinidades, contar, leerRecetas, leerRegiones, type Receta } from './logica.js'

const regiones = new Map([['Mexico', 'LatinAmerican'], ['Italy', 'SouthernEuropean'], ['American', 'NorthAmerican'], ['Korea', 'EastAsian']])
const pesos = { LatinAmerican: 1, SouthernEuropean: 1, NorthAmerican: 0.25 }
const mapa = { potato: ['papa'], onion: ['cebolla'], beef: ['carne_vacuna', 'carne_picada'], banana: ['banana'], garlic: ['ajo'] }
const existentes = new Set(['papa', 'cebolla', 'carne_vacuna', 'carne_picada', 'banana'])
const receta = (cocina: string, ...ingredientes: string[]): Receta => ({ cocina, ingredientes })
const veces = (k: number, r: Receta) => Array.from({ length: k }, () => r)
const todos = { nMinimo: 1, pesoMinimo: 0, afinidadMinima: 0 }

describe('leerRecetas y leerRegiones', () => {
  it('lee la cocina y los ingredientes separados por tab, sin líneas vacías', () => {
    expect(leerRecetas('Mexico\tpotato\tonion\r\n\nItaly\tbeef\nAmerican\n')).toEqual([
      receta('Mexico', 'potato', 'onion'), receta('Italy', 'beef'),
    ])
  })

  it('las cocinas sin región quedan afuera', () => {
    expect([...leerRegiones('Italy\tSouthernEuropean\nAsian\t\nmexico\tLatinAmerican\n')]).toEqual([
      ['Italy', 'SouthernEuropean'], ['mexico', 'LatinAmerican'],
    ])
  })
})

describe('contar', () => {
  it('pesa por región e ignora las que no pesan', () => {
    const c = contar([receta('Mexico', 'potato', 'onion'), receta('American', 'potato'), receta('Korea', 'potato', 'onion')], regiones, mapa, existentes, pesos)
    expect(c.recetas).toBe(2)
    expect(c.total).toBe(1.25)
    expect(c.solo.get('papa')).toBe(1.25)
    expect(c.juntos.get('cebolla|papa')).toEqual({ peso: 1, n: 1 })
  })

  it('ignora los ids que no están en el catálogo y los ingredientes sin mapa', () => {
    const c = contar([receta('Italy', 'garlic', 'potato', 'saffron')], regiones, mapa, existentes, pesos)
    expect([...c.solo.keys()]).toEqual(['papa'])
    expect(c.juntos.size).toBe(0)
  })

  it('dos alimentos del mismo ingrediente de Ahn no son un par por esa receta', () => {
    const c = contar([receta('Italy', 'beef', 'onion'), receta('Italy', 'beef', 'beef')], regiones, mapa, existentes, pesos)
    expect(c.solo.get('carne_picada')).toBe(2)
    expect(c.juntos.has('carne_picada|carne_vacuna')).toBe(false)
    expect(c.juntos.get('carne_picada|cebolla')).toEqual({ peso: 1, n: 1 })
  })
})

describe('afinidades', () => {
  // papa y cebolla van mucho juntas; la papa con la carne, menos; banana con cebolla, menos que por azar
  const recetas = [
    ...veces(40, receta('Italy', 'potato', 'onion')),
    ...veces(10, receta('Italy', 'potato', 'beef')),
    ...veces(30, receta('Italy', 'banana')),
    ...veces(20, receta('Italy', 'onion', 'banana')),
    ...veces(5, receta('Italy', 'beef')),
  ]
  const conteo = contar(recetas, regiones, mapa, existentes, pesos)
  const pares = afinidades(conteo, todos)
  const de = (a: string, b: string) => pares.find((p) => p.a === a && p.b === b)

  it('es simétrico: cada par en las dos direcciones con el mismo n y afinidad', () => {
    expect(pares.length).toBeGreaterThan(0)
    for (const p of pares) expect(de(p.b, p.a)).toEqual({ a: p.b, b: p.a, n: p.n, afinidad: p.afinidad })
  })

  it('ordena por a y, dentro de cada uno, de más a menos afín', () => {
    const as = pares.map((p) => p.a)
    expect(as).toEqual([...as].sort())
    const dePapa = pares.filter((p) => p.a === 'papa').map((p) => p.afinidad)
    expect(dePapa.length).toBeGreaterThan(1)
    expect(dePapa).toEqual([...dePapa].sort((x, y) => y - x))
  })

  it('va de 0 a 1, más alto lo que va más junto, y lo que se usa menos que por azar no aparece', () => {
    for (const p of pares) {
      expect(p.afinidad).toBeGreaterThan(0)
      expect(p.afinidad).toBeLessThanOrEqual(1)
    }
    expect(de('papa', 'cebolla')!.afinidad).toBeGreaterThan(de('papa', 'carne_vacuna')!.afinidad)
    expect(conteo.juntos.get('banana|cebolla')?.n).toBe(20)
    expect(de('banana', 'cebolla')).toBeUndefined()
  })

  it('el mínimo de soporte saca los pares raros', () => {
    const conMinimo = afinidades(conteo, { nMinimo: 11 })
    expect(conMinimo.some((p) => p.a === 'papa' && p.b === 'carne_vacuna')).toBe(false)
    expect(conMinimo.some((p) => p.a === 'papa' && p.b === 'cebolla')).toBe(true)
  })

  it('el suavizado baja lo que tiene poco soporte aunque vaya siempre junto', () => {
    const raro = [...veces(3, receta('Italy', 'potato', 'banana')), ...veces(200, receta('Italy', 'onion'))]
    const frecuente = [...veces(60, receta('Italy', 'potato', 'banana')), ...veces(4000, receta('Italy', 'onion'))]
    const a = afinidades(contar(raro, regiones, mapa, existentes, pesos), todos)[0]!
    const b = afinidades(contar(frecuente, regiones, mapa, existentes, pesos), todos)[0]!
    expect(a.afinidad).toBeLessThan(b.afinidad)
  })
})
