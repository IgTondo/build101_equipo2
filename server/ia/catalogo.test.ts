import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ALERGENO, GRUPO, NUTRIENTE, type Alergeno, type Alimento, type Nutriente } from '../../shared/contratos.js'
import { alimentoPorId, alimentos, esGenerico, fijarAlimentos, idGenerico, idsAlimentos } from './catalogo.js'
import { CONDIMENTOS, esCondimento } from './condimentos.js'

const leer = (...ruta: string[]): unknown => JSON.parse(readFileSync(join(process.cwd(), ...ruta), 'utf8'))

// v5.10 · Los 96 curados hasta v5.9: los usan B, C, el dataset sintético y los tests. Se suman alimentos, nunca se renombran.
const IDS_V5_9 = `arroz fideos fideos_huevo noquis pan_blanco pan_integral pan_rallado galletitas_agua galletitas_integrales
galletitas_dulces galletitas_avena grisines avena cereal_fortificado harina_trigo polenta papa boniato choclo
prepizza medialuna carne_vacuna carne_picada pollo nuggets_pollo hamburguesa_comercial carne_cerdo salchicha
jamon chorizo huevo huevo_enriquecido merluza palitos_pescado atun salmon lentejas garbanzos porotos
pasta_mani zanahoria zapallo zapallito brocoli chauchas arvejas tomate salsa_tomate lechuga espinaca acelga
cebolla morron pepino coliflor remolacha banana manzana pera naranja jugo_naranja mandarina frutilla kiwi
durazno uva sandia melon anana leche leche_vitamina_d yogur yogur_vitamina_d yogur_bebible queso_dambo
queso_muzzarella queso_rallado queso_crema ricota helado postre_lacteo aceite_girasol aceite_canola
aceite_oliva manteca azucar cacao_azucarado dulce_de_leche alfajor mermelada mayonesa ketchup papas_chips
chocolate miel bizcochuelo`.split(/\s+/)

const mediana = (xs: number[]) => {
  const o = [...xs].sort((a, b) => a - b)
  const m = Math.floor(o.length / 2)
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2
}

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

  it('tiene entre 230 y 270 alimentos curados (v5.10: eran 96), más los 6 genéricos', () => {
    const genericos = idsAlimentos().filter(esGenerico)
    expect(genericos.sort()).toEqual(GRUPO.map(idGenerico).sort())
    const curados = alimentos().length - genericos.length
    expect(curados).toBeGreaterThanOrEqual(230)
    expect(curados).toBeLessThanOrEqual(270)
  })

  it('v5.10 · cada grupo tiene variedad (al menos 20 alimentos sin contar los condimentos)', () => {
    for (const g of GRUPO) {
      const n = alimentos().filter((a) => a.grupo === g && !esGenerico(a.id) && !esCondimento(a.id)).length
      expect(n, g).toBeGreaterThanOrEqual(20)
    }
  })

  it('v5.10 · siguen los 96 ids de v5.9, con su grupo de siempre', () => {
    expect(IDS_V5_9).toHaveLength(96)
    expect(IDS_V5_9.filter((id) => !alimentoPorId(id))).toEqual([])
    expect(alimentoPorId('papa')?.grupo).toBe('cereal_almidon')
    expect(alimentoPorId('pasta_mani')?.grupo).toBe('proteina')
    expect(alimentoPorId('choclo')?.grupo).toBe('cereal_almidon')
  })

  it('v5.10 · los condimentos existen, son del grupo otro, sin alérgenos y con porción chica', () => {
    expect(CONDIMENTOS.size).toBeGreaterThanOrEqual(15)
    for (const id of CONDIMENTOS) {
      const a = alimentoPorId(id)
      expect(a, id).toBeDefined()
      expect(a!.grupo, id).toBe('otro')
      expect(a!.alergenos, id).toEqual([])
      expect(a!.porcionMedianaG, id).toBeLessThanOrEqual(10)
      expect(esCondimento(id)).toBe(true)
    }
    expect(esCondimento('oregano')).toBe(true)
    expect(esCondimento('queso_rallado')).toBe(false)
  })

  it('v5.10 · el genérico otro_otro no cuenta los condimentos (las especias secas le subían el calcio y el hierro)', () => {
    const otros = alimentos().filter((a) => a.grupo === 'otro' && !esGenerico(a.id) && !esCondimento(a.id))
    const generico = alimentoPorId(idGenerico('otro'))!
    for (const n of NUTRIENTE) expect(generico.por100g[n], n).toBeCloseTo(mediana(otros.map((a) => a.por100g[n])), 3)
    expect(generico.porcionMedianaG).toBe(Math.round(mediana(otros.map((a) => a.porcionMedianaG))))
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
    // v5.10
    expect(v('kale', 'calcio_mg')).toBeGreaterThan(200)
    expect(v('rucula', 'calcio_mg')).toBeGreaterThan(100)
    expect(v('morron_amarillo', 'vitamina_c_mg')).toBeGreaterThan(150)
    expect(v('perejil', 'vitamina_c_mg')).toBeGreaterThan(100)
    expect(v('palta', 'energia_kcal')).toBeGreaterThan(140)
    expect(v('compota_manzana', 'vitamina_c_mg')).toBeLessThan(5) // sin el ácido ascórbico que le agrega EE. UU.
    expect(v('tomillo', 'hierro_mg')).toBeGreaterThan(60) // seco: por eso los condimentos tienen su propio tope
    expect(v('leche_polvo', 'calcio_mg')).toBeGreaterThan(800)
    expect(v('queso_colonia', 'calcio_mg')).toBeGreaterThan(700)
    expect(v('salvado_avena', 'fibra_g')).toBeGreaterThan(10)
    expect(v('arroz_integral', 'fibra_g')).toBeGreaterThan(v('arroz', 'fibra_g'))
    expect(v('fideos_integrales', 'fibra_g')).toBeGreaterThan(v('fideos', 'fibra_g'))
    expect(v('higado', 'hierro_mg')).toBeGreaterThan(5)
    expect(v('higado', 'b12_ug')).toBeGreaterThan(50) // por eso el tope de B12 es 100
    expect(v('sardina', 'calcio_mg')).toBeGreaterThan(300) // en lata, con las espinas
    expect(v('caballa', 'omega3_g')).toBeGreaterThan(1)
    expect(v('semillas_chia', 'omega3_g')).toBeGreaterThan(15)
    expect(v('semillas_lino', 'omega3_g')).toBeGreaterThan(15)
    expect(v('nueces', 'omega3_g')).toBeGreaterThan(5)
    expect(v('porotos_negros', 'fibra_g')).toBeGreaterThan(7)
    expect(v('tofu', 'calcio_mg')).toBeGreaterThan(150)
  })

  it('v5.10 · sin los agregados de EE. UU. que acá no vienen', () => {
    const v = (id: string, n: Nutriente) => alimentoPorId(id)!.por100g[n]
    for (const id of ['yogur_natural', 'yogur_frutas', 'leche_descremada', 'leche_deslactosada', 'flan']) expect(v(id, 'vitamina_d_ug'), id).toBeLessThan(0.5)
    expect(v('harina_maiz', 'hierro_mg')).toBeLessThan(2) // la de acá no se enriquece
    expect(v('tortilla_trigo', 'calcio_mg')).toBeLessThan(100)
    expect(v('pan_hamburguesa', 'calcio_mg')).toBeLessThan(100)
    expect(v('pan_sin_gluten', 'calcio_mg')).toBeLessThan(100)
    expect(v('leche_deslactosada', 'calcio_mg')).toBe(v('leche', 'calcio_mg'))
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
    // v5.10
    for (const id of ['fideos_integrales', 'cuscus', 'burgol', 'cebada', 'semola', 'salvado_avena', 'harina_integral', 'tortilla_trigo', 'pan_arabe', 'pan_hamburguesa', 'ravioles', 'panqueques', 'torta_frita', 'galletitas_rellenas']) {
      expect(tiene(id, 'gluten'), id).toBe(true)
    }
    for (const id of ['leche_polvo', 'leche_descremada', 'leche_deslactosada', 'yogur_natural', 'yogur_griego', 'queso_colonia', 'queso_fresco', 'queso_cheddar', 'queso_cottage', 'arroz_con_leche', 'flan', 'postre_chocolate', 'pure_papa']) {
      expect(tiene(id, 'leche'), id).toBe(true)
    }
    for (const id of ['ravioles', 'panqueques', 'flan']) expect(tiene(id, 'huevo'), id).toBe(true)
    for (const id of ['pan_arabe', 'pan_hamburguesa', 'hummus', 'semillas_sesamo']) expect(tiene(id, 'sesamo'), id).toBe(true)
    for (const id of ['corvina', 'lenguado', 'pejerrey', 'sardina', 'caballa']) expect(tiene(id, 'pescado'), id).toBe(true)
    for (const id of ['nueces', 'almendras', 'castanas_caju', 'avellanas', 'coco_rallado', 'barra_cereal']) expect(tiene(id, 'frutos_secos'), id).toBe(true)
    for (const id of ['mani', 'barra_cereal']) expect(tiene(id, 'mani'), id).toBe(true)
    for (const id of ['porotos_soja', 'tofu']) expect(tiene(id, 'soja'), id).toBe(true)
    for (const id of ['huevo_revuelto', 'huevo_frito']) expect(tiene(id, 'huevo'), id).toBe(true)
    expect(tiene('camarones', 'mariscos')).toBe(true)
    expect(tiene('crema_leche', 'leche')).toBe(true)
    expect(tiene('salsa_blanca', 'gluten')).toBe(true)
  })

  it('v5.10 · lo sin gluten no lleva gluten (para la dieta sin gluten ni caseína)', () => {
    for (const id of ['fideos_sin_gluten', 'pan_sin_gluten', 'arroz_integral', 'quinoa', 'harina_arroz', 'harina_maiz', 'maicena', 'mandioca', 'galletas_arroz', 'pororo']) {
      expect(alimentoPorId(id)?.alergenos, id).not.toContain('gluten')
    }
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
