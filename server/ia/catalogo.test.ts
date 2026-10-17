import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ALERGENO, GRUPO, type Alergeno, type Alimento } from '../../shared/contratos.js'
import { alimentoPorId, alimentos, esGenerico, fijarAlimentos, idGenerico, idsAlimentos } from './catalogo.js'

const leer = (...ruta: string[]): unknown => JSON.parse(readFileSync(join(process.cwd(), ...ruta), 'utf8'))

// Todos los alimentoId que aparezcan en cualquier nivel del JSON
function alimentoIds(o: unknown, ids = new Set<string>()): Set<string> {
  if (Array.isArray(o)) for (const x of o) alimentoIds(x, ids)
  else if (o && typeof o === 'object') {
    for (const [k, v] of Object.entries(o)) {
      if (k === 'alimentoId' && typeof v === 'string') ids.add(v)
      else alimentoIds(v, ids)
    }
  }
  return ids
}

afterEach(() => fijarAlimentos(null))

describe('data/alimentos.json', () => {
  it('tiene ids únicos en snake_case sin tildes', () => {
    const ids = idsAlimentos()
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[a-z][a-z0-9_]*$/)
  })

  it('tiene entre 80 y 100 alimentos curados, más los 6 genéricos', () => {
    const genericos = idsAlimentos().filter(esGenerico)
    expect(genericos.sort()).toEqual(GRUPO.map(idGenerico).sort())
    const curados = alimentos().length - genericos.length
    expect(curados).toBeGreaterThanOrEqual(80)
    expect(curados).toBeLessThanOrEqual(100)
  })

  it('cada genérico pertenece a su grupo', () => {
    for (const g of GRUPO) expect(alimentoPorId(idGenerico(g))?.grupo).toBe(g)
  })

  it('incluye los 26 alimentoIds de data/sinteticos/indice.json', () => {
    const { alimentoIds: ids } = leer('data', 'sinteticos', 'indice.json') as { alimentoIds: string[] }
    expect(ids).toHaveLength(26)
    expect(ids.filter((id) => !alimentoPorId(id))).toEqual([])
  })

  it.each(['preparaciones.json', 'tomas.json', 'lucia.json'])('todos los alimentoId de data/sinteticos/%s existen', (archivo) => {
    const ids = [...alimentoIds(leer('data', 'sinteticos', archivo))]
    expect(ids.length).toBeGreaterThan(0)
    expect(ids.filter((id) => !alimentoPorId(id))).toEqual([])
  })

  it('grupo y alérgenos están dentro del vocabulario de contratos', () => {
    for (const a of alimentos()) {
      expect(GRUPO, a.id).toContain(a.grupo)
      expect(new Set(a.alergenos).size, a.id).toBe(a.alergenos.length)
      for (const al of a.alergenos) expect(ALERGENO, a.id).toContain(al)
    }
  })

  it('tiene nombre y alias en minúscula', () => {
    for (const a of alimentos()) {
      expect(a.nombre.length, a.id).toBeGreaterThan(0)
      for (const s of a.alias) expect(s, a.id).toBe(s.toLowerCase())
    }
  })

  it('marca los alérgenos que no pueden faltar', () => {
    const tiene = (id: string, al: Alergeno) => alimentoPorId(id)?.alergenos.includes(al)
    for (const id of ['huevo', 'huevo_enriquecido', 'mayonesa', 'nuggets_pollo', 'fideos_huevo']) expect(tiene(id, 'huevo'), id).toBe(true)
    for (const id of ['leche', 'yogur', 'queso_muzzarella', 'queso_rallado', 'manteca', 'dulce_de_leche']) expect(tiene(id, 'leche'), id).toBe(true)
    for (const id of ['pan_blanco', 'pan_rallado', 'fideos', 'galletitas_agua', 'harina_trigo']) expect(tiene(id, 'gluten'), id).toBe(true)
    for (const id of ['merluza', 'atun', 'palitos_pescado']) expect(tiene(id, 'pescado'), id).toBe(true)
  })
})

describe('fijarAlimentos', () => {
  it('reemplaza el catálogo y null vuelve a leer el archivo', () => {
    const uno = { ...alimentos()[0], id: 'solo_este' } as Alimento
    fijarAlimentos([uno])
    expect(idsAlimentos()).toEqual(['solo_este'])
    expect(alimentoPorId('solo_este')).toBe(uno)
    fijarAlimentos(null)
    expect(alimentoPorId('solo_este')).toBeUndefined()
    expect(alimentoPorId('papa')?.grupo).toBe('cereal_almidon')
  })
})
