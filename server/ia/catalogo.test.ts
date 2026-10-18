import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ALERGENO, GRUPO, NUTRIENTE, type Alergeno, type Alimento, type Nutriente } from '../../shared/contratos.js'
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

  it('incluye los 33 alimentoIds de data/sinteticos/indice.json', () => {
    const { alimentoIds: ids } = leer('data', 'sinteticos', 'indice.json') as { alimentoIds: string[] }
    expect(ids).toHaveLength(33) // v5.4: 26 de Tomás y Lucía + 7 que suma Valentina
    expect(ids.filter((id) => !alimentoPorId(id))).toEqual([])
  })

  it.each(['preparaciones.json', 'tomas.json', 'lucia.json', 'valentina.json'])('todos los alimentoId de data/sinteticos/%s existen', (archivo) => {
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

  it('por100g tiene los 9 nutrientes, todos números ≥ 0; faltantes dentro del vocabulario', () => {
    for (const a of alimentos()) {
      expect(Object.keys(a.por100g).sort(), a.id).toEqual([...NUTRIENTE].sort())
      for (const n of NUTRIENTE) {
        expect(Number.isFinite(a.por100g[n]), `${a.id}.${n}`).toBe(true)
        expect(a.por100g[n], `${a.id}.${n}`).toBeGreaterThanOrEqual(0)
      }
      for (const n of a.faltantes ?? []) expect(NUTRIENTE, a.id).toContain(n)
    }
  })

  it('cada alimento declara su fuente: USDA con fdcId y dataset, equipo sin fdcId', () => {
    for (const a of alimentos()) {
      expect(a.porcionMedianaG, a.id).toBeGreaterThan(0)
      if (a.fuente === 'USDA') {
        expect(Number.isInteger(a.fdcId), a.id).toBe(true)
        expect(['foundation', 'sr_legacy', 'fndds'], a.id).toContain(a.dataset)
      } else {
        expect(a.fuente, a.id).toBe('equipo')
        expect(a.fdcId, a.id).toBeNull()
      }
      for (const p of a.porciones ?? []) {
        expect(p.descripcion.length, a.id).toBeGreaterThan(0)
        expect(p.gramos, a.id).toBeGreaterThan(0)
      }
    }
    for (const g of GRUPO) expect(alimentoPorId(idGenerico(g))?.fuente).toBe('equipo')
  })

  it('valores conocidos dentro de rangos razonables (cada 100 g)', () => {
    const v = (id: string, n: Nutriente) => alimentoPorId(id)!.por100g[n]
    expect(v('leche', 'calcio_mg')).toBeGreaterThan(100)
    expect(v('leche', 'calcio_mg')).toBeLessThan(135)
    expect(v('naranja', 'vitamina_c_mg')).toBeGreaterThan(40)
    expect(v('naranja', 'vitamina_c_mg')).toBeLessThan(70)
    expect(v('kiwi', 'vitamina_c_mg')).toBeGreaterThan(50)
    expect(v('salmon', 'omega3_g')).toBeGreaterThan(1)
    expect(v('lentejas', 'hierro_mg')).toBeGreaterThan(2)
    expect(v('aceite_girasol', 'energia_kcal')).toBeGreaterThan(850)
    expect(v('pollo', 'proteina_g')).toBeGreaterThan(25)
  })

  it('las versiones fortificadas aportan más que su base', () => {
    const v = (id: string, n: Nutriente) => alimentoPorId(id)!.por100g[n]
    expect(v('leche_vitamina_d', 'vitamina_d_ug')).toBeGreaterThan(v('leche', 'vitamina_d_ug') + 0.5)
    expect(v('yogur_vitamina_d', 'vitamina_d_ug')).toBeGreaterThan(v('yogur', 'vitamina_d_ug') + 0.5)
    expect(v('huevo_enriquecido', 'omega3_g')).toBeGreaterThan(v('huevo', 'omega3_g'))
    expect(v('huevo_enriquecido', 'vitamina_d_ug')).toBeGreaterThan(v('huevo', 'vitamina_d_ug'))
    expect(v('cereal_fortificado', 'hierro_mg')).toBeGreaterThan(10)
    expect(v('aceite_canola', 'omega3_g')).toBeGreaterThan(v('aceite_girasol', 'omega3_g'))
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
