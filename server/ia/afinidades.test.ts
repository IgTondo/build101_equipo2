import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { AFINIDAD_MINIMA, N_MINIMO } from '../../scripts/afinidades/logica.js'
import { afines, afinidad, afinidadCon, fijarAfinidades, type Afinidades, type ParAfinidad } from './afinidades.js'
import { alimentoPorId } from './catalogo.js'

afterEach(() => fijarAfinidades(null))

describe('afinidades con datos de ejemplo', () => {
  // En una sola dirección: el módulo los indexa en las dos
  const ejemplo: ParAfinidad[] = [
    { a: 'banana', b: 'frutilla', n: 120, afinidad: 0.26 },
    { a: 'banana', b: 'yogur', n: 80, afinidad: 0.18 },
    { a: 'avena', b: 'banana', n: 70, afinidad: 0.18 },
    { a: 'banana', b: 'leche', n: 300, afinidad: 0.08 },
    { a: 'papa', b: 'zanahoria', n: 700, afinidad: 0.3 },
  ]

  it('afinidad es simétrica y da 0 sin dato', () => {
    fijarAfinidades(ejemplo)
    expect(afinidad('banana', 'frutilla')).toBe(0.26)
    expect(afinidad('frutilla', 'banana')).toBe(0.26)
    expect(afinidad('banana', 'carne_picada')).toBe(0)
    expect(afinidad('no_existe', 'banana')).toBe(0)
    expect(afinidad('banana', 'banana')).toBe(0)
  })

  it('afines va de más a menos afín y a igual afinidad gana el de más recetas', () => {
    fijarAfinidades(ejemplo)
    expect(afines('banana')).toEqual([
      { alimentoId: 'frutilla', afinidad: 0.26, n: 120 },
      { alimentoId: 'yogur', afinidad: 0.18, n: 80 },
      { alimentoId: 'avena', afinidad: 0.18, n: 70 },
      { alimentoId: 'leche', afinidad: 0.08, n: 300 },
    ])
    expect(afines('zanahoria')).toEqual([{ alimentoId: 'papa', afinidad: 0.3, n: 700 }])
    expect(afines('no_existe')).toEqual([])
  })

  it('afines con k y con filtro (el filtro va antes del corte)', () => {
    fijarAfinidades(ejemplo)
    expect(afines('banana', 2).map((x) => x.alimentoId)).toEqual(['frutilla', 'yogur'])
    expect(afines('banana', 2, (id) => id !== 'frutilla').map((x) => x.alimentoId)).toEqual(['yogur', 'avena'])
    expect(afines('banana', 0)).toEqual([])
  })

  it('lo que devuelve afines no cambia el caché', () => {
    fijarAfinidades(ejemplo)
    const r = afines('banana')
    r[0]!.afinidad = 99
    r.pop()
    expect(afines('banana')[0]!.afinidad).toBe(0.26)
    expect(afines('banana')).toHaveLength(4)
  })

  it('afinidadCon: la mayor con algún ingrediente del plato, sin contarse a sí mismo', () => {
    fijarAfinidades(ejemplo)
    expect(afinidadCon('banana', ['leche', 'avena'])).toBe(0.18)
    expect(afinidadCon('banana', ['banana', 'leche'])).toBe(0.08)
    expect(afinidadCon('banana', ['carne_picada'])).toBe(0)
    expect(afinidadCon('banana', [])).toBe(0)
  })

  it('ignora los pares sin afinidad y los de un alimento consigo mismo', () => {
    fijarAfinidades([{ a: 'papa', b: 'papa', n: 9, afinidad: 1 }, { a: 'papa', b: 'arroz', n: 9, afinidad: 0 }])
    expect(afines('papa')).toEqual([])
  })
})

describe('data/afinidades.json (el real)', () => {
  const archivo = JSON.parse(readFileSync(join(process.cwd(), 'data', 'afinidades.json'), 'utf8')) as Afinidades
  const { pares } = archivo

  it('dice de dónde sale, con su licencia y la fecha', () => {
    expect(archivo.fuente).toMatch(/Ahn.*Flavor network and the principles of food pairing/)
    expect(archivo.fuente).toContain('10.5281/zenodo.11449657')
    expect(archivo.licencia).toBe('CC BY 4.0')
    expect(archivo.generado).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(pares.length).toBeGreaterThan(200)
  })

  it('todos los ids existen en data/alimentos.json, sin genéricos ni un alimento consigo mismo', () => {
    const ids = new Set(pares.flatMap((p) => [p.a, p.b]))
    expect([...ids].filter((id) => !alimentoPorId(id))).toEqual([])
    expect([...ids].filter((id) => id.startsWith('otro_'))).toEqual([])
    expect(pares.filter((p) => p.a === p.b)).toEqual([])
  })

  it('es simétrico, sin repetidos, ordenado y sin pares por debajo del umbral', () => {
    const clave = (p: ParAfinidad) => `${p.a}|${p.b}`
    const porClave = new Map(pares.map((p) => [clave(p), p]))
    expect(porClave.size).toBe(pares.length)
    for (const p of pares) expect(porClave.get(`${p.b}|${p.a}`), clave(p)).toEqual({ a: p.b, b: p.a, n: p.n, afinidad: p.afinidad })
    for (let i = 1; i < pares.length; i++) {
      const [x, y] = [pares[i - 1]!, pares[i]!]
      expect(x.a < y.a || (x.a === y.a && x.afinidad >= y.afinidad), `${clave(x)} → ${clave(y)}`).toBe(true)
    }
    for (const p of pares) {
      expect(p.n, clave(p)).toBeGreaterThanOrEqual(N_MINIMO)
      expect(p.afinidad, clave(p)).toBeGreaterThanOrEqual(AFINIDAD_MINIMA)
      expect(p.afinidad, clave(p)).toBeLessThanOrEqual(1)
    }
  })

  it('tiene sentido: la banana va con la frutilla o el yogur antes que con la carne picada', () => {
    const conCarne = afinidad('banana', 'carne_picada')
    expect(Math.max(afinidad('banana', 'frutilla'), afinidad('banana', 'yogur'))).toBeGreaterThan(conCarne)
    expect(afinidad('banana', 'frutilla')).toBeGreaterThan(0.1)
  })

  it('tiene sentido: la zanahoria va con las lentejas o las arvejas antes que con el chocolate', () => {
    const conChocolate = afinidad('zanahoria', 'chocolate')
    expect(Math.max(afinidad('zanahoria', 'lentejas'), afinidad('zanahoria', 'arvejas'))).toBeGreaterThan(conChocolate)
    expect(afinidad('zanahoria', 'arvejas')).toBeGreaterThan(0.1)
  })

  it('tiene sentido: los fideos van con el queso rallado y la salsa de tomate; la papa con la zanahoria', () => {
    const deFideos = afines('fideos', 6).map((x) => x.alimentoId)
    expect(deFideos).toContain('queso_rallado')
    expect(deFideos).toContain('salsa_tomate')
    expect(afines('papa', 3).map((x) => x.alimentoId)).toContain('zanahoria')
  })
})
