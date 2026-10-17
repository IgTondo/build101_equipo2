import { Readable } from 'node:stream'
import { describe, expect, it } from 'vitest'
import { NUTRIENTE, type Nutrientes } from '../../shared/contratos.js'
import { filasCsv } from './csv.js'
import {
  aAlimentoFdc, aNutrientes, aPorcion, controlarUnidades, elegirFdc, FDC, fortificar, inferirGrupo, juntarNutrientes,
  juntarPorciones, mediana, nutrientesMediana, porcionMediana, traductorNutrientes, type Crudos, type Dataset, type Fila,
} from './logica.js'

const csv = (texto: string) => filasCsv(Readable.from([texto.trim() + '\n']))
async function filas(texto: string): Promise<Fila[]> {
  const r: Fila[] = []
  for await (const f of csv(texto)) r.push(f)
  return r
}
const crudos = (o: Record<number, number>): Crudos => new Map(Object.entries(o).map(([k, v]) => [Number(k), v]))
const ceros = (): Nutrientes => Object.fromEntries(NUTRIENTE.map((n) => [n, 0])) as Nutrientes

const NUTRIENT_CSV = `
"id","name","unit_name","nutrient_nbr","rank"
"1008","Energy","KCAL","208","300.0"
"1087","Calcium, Ca","MG","301","5300.0"
"1114","Vitamin D (D2 + D3)","UG","328","8700.0"
"1270","PUFA 18:3","G","619","13900.0"
"1051","Water","G","255","100.0"`

describe('juntarNutrientes', () => {
  it('lee food_nutrient con ids de FDC (SR Legacy, Foundation) y se queda con los de §10.1', async () => {
    const r = await juntarNutrientes(csv(`
"id","fdc_id","nutrient_id","amount","data_points"
"1","100","1008","61",""
"2","100","1087","113","3"
"3","100","1051","88.1",""
"4","200","1087","",""
"5","200","1003","abc",""`))
    expect([...r.keys()]).toEqual([100])
    expect(r.get(100)).toEqual(crudos({ 1008: 61, 1087: 113 }))
  })

  it('traduce el nutrient_nbr viejo que usa FNDDS (301 = calcio) con nutrient.csv', async () => {
    const traductor = traductorNutrientes(await filas(NUTRIENT_CSV))
    expect(traductor.get(301)).toBe(1087)
    expect(traductor.get(1087)).toBe(1087)
    const r = await juntarNutrientes(csv(`
"id","fdc_id","nutrient_id","amount"
"1","2709224","301","5"
"2","2709224","208","97"
"3","2709224","619","0.027"
"4","2709224","255","74.9"`), undefined, traductor)
    expect(r.get(2709224)).toEqual(crudos({ 1087: 5, 1008: 97, 1270: 0.027 }))
  })

  it('filtra por los alimentos pedidos', async () => {
    const r = await juntarNutrientes(csv(`
"id","fdc_id","nutrient_id","amount"
"1","1","1003","10"
"2","2","1003","20"`), new Set([2]))
    expect([...r.keys()]).toEqual([2])
  })
})

describe('controlarUnidades', () => {
  it('no se queja de nutrient.csv tal como viene', async () => {
    expect(controlarUnidades(await filas(NUTRIENT_CSV))).toEqual([])
  })
  it('avisa si un nutriente viene en otra unidad (kJ por kcal, mg por µg)', () => {
    const p = controlarUnidades([{ id: '1008', name: 'Energy', unit_name: 'kJ' }, { id: '1114', name: 'Vitamin D', unit_name: 'MG' }])
    expect(p).toHaveLength(2)
    expect(p[0]).toContain('KJ')
  })
})

describe('aNutrientes', () => {
  it('devuelve las 9 claves, con 0 y marcado lo que falta', () => {
    const { por100g, faltantes } = aNutrientes(crudos({ [FDC.proteina]: 3.15, [FDC.calcio]: 113 }))
    expect(Object.keys(por100g).sort()).toEqual([...NUTRIENTE].sort())
    expect(por100g.calcio_mg).toBe(113)
    expect(por100g.vitamina_c_mg).toBe(0)
    expect(faltantes).toContain('vitamina_c_mg')
    expect(faltantes).not.toContain('calcio_mg')
    expect(faltantes).toHaveLength(7)
  })

  it('energía: 1008, y si falta 2047 y después 2048', () => {
    expect(aNutrientes(crudos({ 1008: 100, 2047: 110, 2048: 120 })).por100g.energia_kcal).toBe(100)
    expect(aNutrientes(crudos({ 2047: 110, 2048: 120 })).por100g.energia_kcal).toBe(110)
    const soloEspecifica = aNutrientes(crudos({ 2048: 120 }))
    expect(soloEspecifica.por100g.energia_kcal).toBe(120)
    expect(soloEspecifica.faltantes).not.toContain('energia_kcal')
  })

  it('omega-3 = ALA + EPA + DPA + DHA, con ALA de 1404 o, si no está, de 1270', () => {
    expect(aNutrientes(crudos({ 1404: 0.1, 1270: 0.5, 1278: 0.2, 1280: 0.05, 1272: 0.3 })).por100g.omega3_g).toBe(0.65)
    expect(aNutrientes(crudos({ 1270: 0.5, 1272: 0.3 })).por100g.omega3_g).toBe(0.8)
    expect(aNutrientes(crudos({ 1272: 0.3 })).faltantes).not.toContain('omega3_g')
    expect(aNutrientes(crudos({})).faltantes).toContain('omega3_g')
  })

  it('vitamina D en µg (1114); si solo hay UI (1110), divide por 40', () => {
    expect(aNutrientes(crudos({ 1114: 1.3, 1110: 999 })).por100g.vitamina_d_ug).toBe(1.3)
    expect(aNutrientes(crudos({ 1110: 52 })).por100g.vitamina_d_ug).toBe(1.3)
  })

  it('redondea a 3 decimales y nunca da negativos', () => {
    const { por100g } = aNutrientes(crudos({ [FDC.hierro]: 0.123456, [FDC.fibra]: -0.2 }))
    expect(por100g.hierro_mg).toBe(0.123)
    expect(por100g.fibra_g).toBe(0)
  })
})

describe('aPorcion', () => {
  const unidades = new Map([['9999', 'undetermined'], ['1001', 'tablespoon'], ['1000', 'cup']])
  const fila = (o: Partial<Fila>): Fila => ({ amount: '', measure_unit_id: '9999', portion_description: '', modifier: '', gram_weight: '', ...o })

  it('FNDDS: la descripción está en portion_description y modifier es un código', () => {
    expect(aPorcion(fila({ portion_description: '1 nugget', modifier: '10205', gram_weight: '16.0' }), unidades)).toEqual({ descripcion: '1 nugget', gramos: 16 })
  })
  it('SR Legacy: amount + modifier', () => {
    expect(aPorcion(fila({ amount: '1', modifier: 'cup', gram_weight: '244' }), unidades)).toEqual({ descripcion: '1 cup', gramos: 244 })
  })
  it('Foundation: amount + unidad de measure_unit', () => {
    expect(aPorcion(fila({ amount: '2.0', measure_unit_id: '1001', gram_weight: '35.84' }), unidades)).toEqual({ descripcion: '2 tablespoon', gramos: 35.8 })
  })
  it('descarta "Quantity not specified", pesos 0 o vacíos y porciones sin descripción', () => {
    expect(aPorcion(fila({ portion_description: 'Quantity not specified', gram_weight: '120' }), unidades)).toBeNull()
    expect(aPorcion(fila({ portion_description: '1 cup', gram_weight: '0.0' }), unidades)).toBeNull()
    expect(aPorcion(fila({ portion_description: '1 cup' }), unidades)).toBeNull()
    expect(aPorcion(fila({ amount: '1', gram_weight: '30' }), unidades)).toBeNull()
  })
  it('lee food_portion.csv de punta a punta', async () => {
    const r: (ReturnType<typeof aPorcion>)[] = []
    for await (const f of csv(`
"id","fdc_id","seq_num","amount","measure_unit_id","portion_description","modifier","gram_weight"
"1","2706096","1","","9999","1 nugget","10205","16.0"
"2","2706096","2","","9999","Quantity not specified","90000","96.0"`)) r.push(aPorcion(f, unidades))
    expect(r).toEqual([{ descripcion: '1 nugget', gramos: 16 }, null])
  })
})

describe('porciones', () => {
  it('juntarPorciones saca repetidas y respeta el orden', () => {
    const ps = [{ descripcion: '1 cup', gramos: 140 }, { descripcion: '1 oz', gramos: 28 }, { descripcion: '1 cup', gramos: 150 }]
    expect(juntarPorciones(ps)).toEqual(ps.slice(0, 2))
  })
  it('porcionMediana: mediana redondeada, o 100 g si no hay porciones', () => {
    expect(porcionMediana([])).toBe(100)
    expect(porcionMediana([{ descripcion: 'a', gramos: 16 }, { descripcion: 'b', gramos: 96 }, { descripcion: 'c', gramos: 140 }])).toBe(96)
    expect(porcionMediana([{ descripcion: 'a', gramos: 15 }, { descripcion: 'b', gramos: 30.5 }])).toBe(23)
  })
  it('mediana de pares y de vacío', () => {
    expect(mediana([3, 1, 2, 10])).toBe(2.5)
    expect(mediana([])).toBe(0)
  })
})

describe('inferirGrupo', () => {
  it.each([
    ['Milk, whole', 'Milk, whole', 'lacteo'],
    ['Chicken patties, nuggets and tenders', 'Chicken nuggets, from frozen', 'proteina'],
    ['Beans, peas, legumes', 'Lentils, from dried', 'proteina'],
    ['Rice', 'Rice, white, cooked', 'cereal_almidon'],
    ['White potatoes, baked or boiled', 'Potato, boiled', 'cereal_almidon'],
    ['Citrus fruits', 'Orange, raw', 'fruta'],
    ['Vegetable juice', 'Tomato juice', 'verdura'],
    ['Pizza', 'Pizza, cheese', 'otro'],
    ['Peanut butter and jelly sandwiches', 'PB&J', 'otro'],
    ['Butter and animal fats', 'Butter, stick', 'otro'],
    ['Finfish and Shellfish Products', 'Fish, cod', 'proteina'],
    ['Baked Products', 'Bread, white', 'cereal_almidon'],
    ['', 'Algo sin categoría', 'otro'],
  ])('%s → %s', (categoria, descripcion, grupo) => {
    expect(inferirGrupo(categoria, descripcion)).toBe(grupo)
  })
  it('corrige huevos entre los lácteos y papas entre las verduras (SR Legacy)', () => {
    expect(inferirGrupo('Dairy and Egg Products', 'Egg, whole, raw, fresh')).toBe('proteina')
    expect(inferirGrupo('Dairy and Egg Products', 'Cheese, cheddar')).toBe('lacteo')
    expect(inferirGrupo('Vegetables and Vegetable Products', 'Potatoes, boiled, cooked without skin')).toBe('cereal_almidon')
    expect(inferirGrupo('Vegetables and Vegetable Products', 'Carrots, raw')).toBe('verdura')
  })
})

describe('elegirFdc', () => {
  const datasets = new Map<number, Dataset>([[1, 'foundation'], [2, 'sr_legacy'], [3, 'fndds'], [4, 'sr_legacy']])
  const datasetDe = (id: number) => datasets.get(id)
  it('prioriza FNDDS → SR Legacy → Foundation, sin importar el orden listado', () => {
    expect(elegirFdc([1, 2, 3], datasetDe)).toBe(3)
    expect(elegirFdc([1, 2], datasetDe)).toBe(2)
  })
  it('a igual dataset gana el primero listado; los que no están en los CSV se ignoran', () => {
    expect(elegirFdc([4, 2], datasetDe)).toBe(4)
    expect(elegirFdc([99, 1], datasetDe)).toBe(1)
    expect(elegirFdc([99], datasetDe)).toBeUndefined()
  })
})

describe('aAlimentoFdc', () => {
  it('convierte un alimento de FDC a Alimento con id fdc_<fdcId>, nombre en inglés y grupo inferido', () => {
    const a = aAlimentoFdc(
      { fdcId: 2706096, descripcion: 'Chicken nuggets, from frozen', dataset: 'fndds', categoria: 'Chicken patties, nuggets and tenders' },
      crudos({ 1008: 298, 1003: 13.36 }),
      [{ descripcion: '1 nugget', gramos: 16 }, { descripcion: '1 cup', gramos: 140 }, { descripcion: '4 nuggets', gramos: 64 }],
    )
    expect(a).toMatchObject({ id: 'fdc_2706096', nombre: 'Chicken nuggets, from frozen', alias: [], fdcId: 2706096, grupo: 'proteina', alergenos: [], porcionMedianaG: 64, fuente: 'USDA', dataset: 'fndds' })
    expect(a.por100g.energia_kcal).toBe(298)
    expect(a.porciones).toHaveLength(3)
    expect(a.faltantes).toHaveLength(7)
  })
  it('sin nutrientes ni porciones: todo en 0, todo faltante y porción de 100 g', () => {
    const a = aAlimentoFdc({ fdcId: 1, descripcion: 'X', dataset: 'sr_legacy', categoria: 'Snacks' }, undefined, [])
    expect(a.por100g).toEqual(ceros())
    expect(a.faltantes).toEqual([...NUTRIENTE])
    expect(a.porcionMedianaG).toBe(100)
    expect(a).not.toHaveProperty('porciones')
  })
})

describe('fortificar y nutrientesMediana', () => {
  it('fortificar suma el agregado y deja de marcarlo como faltante', () => {
    const base = { por100g: { ...ceros(), vitamina_d_ug: 2.5, omega3_g: 0.011 }, faltantes: ['omega3_g' as const, 'fibra_g' as const] }
    const r = fortificar(base, { omega3_g: 0.5, vitamina_d_ug: 2.5 })
    expect(r.por100g.omega3_g).toBe(0.511)
    expect(r.por100g.vitamina_d_ug).toBe(5)
    expect(r.faltantes).toEqual(['fibra_g'])
    expect(base.por100g.vitamina_d_ug).toBe(2.5)
  })
  it('nutrientesMediana toma la mediana nutriente por nutriente', () => {
    const a = (calcio: number, hierro: number) => ({ por100g: { ...ceros(), calcio_mg: calcio, hierro_mg: hierro } })
    const m = nutrientesMediana([a(100, 1), a(200, 9), a(700, 2)])
    expect(m.calcio_mg).toBe(200)
    expect(m.hierro_mg).toBe(2)
    expect(m.energia_kcal).toBe(0)
  })
})
