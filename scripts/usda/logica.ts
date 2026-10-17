// Lógica pura de scripts/usda.ts: de filas de los CSV de FoodData Central a `Alimento`. Sin E/S, para testearla
// con CSV chiquitos. Los CSV descargados son datos no confiables: solo se leen como texto y se convierten a número.
import { NUTRIENTE, type Alimento, type Grupo, type Nutriente, type Nutrientes } from '../../shared/contratos.js'

export type Dataset = NonNullable<Alimento['dataset']>
export type Porcion = NonNullable<Alimento['porciones']>[number]
export type Fila = Record<string, string | undefined>
export type Crudos = Map<number, number> // nutrient_id de FDC → cantidad cada 100 g, en la unidad de nutrient.csv

// Ids de nutrientes en FDC (PLAN.md §10.1). Unidades de nutrient.csv: kcal, g, mg, µg (UG) y UI para 1110.
export const FDC = {
  energia: 1008, energiaGeneral: 2047, energiaEspecifica: 2048, proteina: 1003, calcio: 1087, hierro: 1089, fibra: 1079,
  vitaminaD: 1114, vitaminaDUI: 1110, b12: 1178, vitaminaC: 1162, ala: 1404, pufa183: 1270, epa: 1278, dpa: 1280, dha: 1272,
} as const
export const IDS_FDC = new Set<number>(Object.values(FDC))
const UI_POR_UG_VITAMINA_D = 40
const UNIDAD: Record<number, string> = {
  [FDC.energia]: 'KCAL', [FDC.energiaGeneral]: 'KCAL', [FDC.energiaEspecifica]: 'KCAL', [FDC.proteina]: 'G', [FDC.calcio]: 'MG',
  [FDC.hierro]: 'MG', [FDC.fibra]: 'G', [FDC.vitaminaD]: 'UG', [FDC.vitaminaDUI]: 'IU', [FDC.b12]: 'UG', [FDC.vitaminaC]: 'MG',
  [FDC.ala]: 'G', [FDC.pufa183]: 'G', [FDC.epa]: 'G', [FDC.dpa]: 'G', [FDC.dha]: 'G',
}

// Comidas tal como se comen (con porciones) → SR Legacy → Foundation
export const PRIORIDAD: Dataset[] = ['fndds', 'sr_legacy', 'foundation']
export const DATASET_DE_TIPO: Record<string, Dataset> = { survey_fndds_food: 'fndds', sr_legacy_food: 'sr_legacy', foundation_food: 'foundation' }

export const redondear = (x: number, decimales = 3): number => Math.round(x * 10 ** decimales) / 10 ** decimales

export function mediana(xs: number[]): number {
  if (!xs.length) return 0
  const o = [...xs].sort((a, b) => a - b)
  const m = Math.floor(o.length / 2)
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2
}

/** Los 9 nutrientes de §10.1 a partir de los crudos de FDC. Lo que no tiene dato va en 0 y se anota en `faltantes`. */
export function aNutrientes(crudos: Crudos): { por100g: Nutrientes; faltantes: Nutriente[] } {
  const v = (id: number) => crudos.get(id)
  const primero = (...ids: number[]) => ids.map(v).find((x) => x !== undefined)
  // ALA: 1404 si está; si no, 1270 ("18:3" sin diferenciar, que en alimentos comunes es casi todo ALA)
  const ala = crudos.has(FDC.ala) ? v(FDC.ala) : v(FDC.pufa183)
  const omega3 = [ala, v(FDC.epa), v(FDC.dpa), v(FDC.dha)].filter((x) => x !== undefined)
  const vitaminaDUI = v(FDC.vitaminaDUI)
  const valores: Record<Nutriente, number | undefined> = {
    energia_kcal: primero(FDC.energia, FDC.energiaGeneral, FDC.energiaEspecifica),
    proteina_g: v(FDC.proteina),
    calcio_mg: v(FDC.calcio),
    vitamina_d_ug: v(FDC.vitaminaD) ?? (vitaminaDUI === undefined ? undefined : vitaminaDUI / UI_POR_UG_VITAMINA_D),
    hierro_mg: v(FDC.hierro),
    fibra_g: v(FDC.fibra),
    omega3_g: omega3.length ? omega3.reduce((a, b) => a + b, 0) : undefined,
    b12_ug: v(FDC.b12),
    vitamina_c_mg: v(FDC.vitaminaC),
  }
  const por100g = {} as Nutrientes
  const faltantes: Nutriente[] = []
  for (const n of NUTRIENTE) {
    const x = valores[n]
    if (x === undefined) faltantes.push(n)
    por100g[n] = redondear(Math.max(0, x ?? 0))
  }
  return { por100g, faltantes }
}

/**
 * Traductor de la columna nutrient_id de food_nutrient.csv al id de FDC, a partir de nutrient.csv. FNDDS 2021–2023
 * escribe ahí el nutrient_nbr viejo (301 = calcio) en lugar del id (1087); SR Legacy y Foundation, el id. Los dos
 * rangos no se pisan (nbr < 1000 < id), así que el traductor acepta cualquiera de los dos.
 */
export function traductorNutrientes(filasNutrient: Iterable<Fila>): Map<number, number> {
  const filas = [...filasNutrient]
  const ids = new Set(filas.map((f) => Number(f.id)))
  const traductor = new Map<number, number>()
  for (const f of filas) {
    const id = Number(f.id)
    traductor.set(id, id)
    const nbr = Number(f.nutrient_nbr)
    if (f.nutrient_nbr?.trim() && Number.isInteger(nbr) && !ids.has(nbr)) traductor.set(nbr, id)
  }
  return traductor
}

/** Problemas de unidades en nutrient.csv para los nutrientes de §10.1 (vacío si todo está como se espera). */
export function controlarUnidades(filasNutrient: Iterable<Fila>): string[] {
  const problemas: string[] = []
  for (const f of filasNutrient) {
    const esperada = UNIDAD[Number(f.id)]
    const unidad = f.unit_name?.trim().toUpperCase()
    if (esperada && unidad !== esperada) problemas.push(`${f.id} (${f.name}): ${unidad}, se esperaba ${esperada}`)
  }
  return problemas
}

/** Junta las filas de food_nutrient.csv por alimento, quedándose con los nutrientes de §10.1 (y los alimentos pedidos). */
export async function juntarNutrientes(
  filas: AsyncIterable<Fila> | Iterable<Fila>, fdcIds?: Set<number>, traductor?: Map<number, number>,
): Promise<Map<number, Crudos>> {
  const porAlimento = new Map<number, Crudos>()
  for await (const f of filas) {
    const crudo = Number(f.nutrient_id)
    const nutriente = traductor ? traductor.get(crudo) ?? crudo : crudo
    if (!IDS_FDC.has(nutriente)) continue
    const fdcId = Number(f.fdc_id)
    if (fdcIds && !fdcIds.has(fdcId)) continue
    if (!f.amount?.trim()) continue
    const cantidad = Number(f.amount)
    if (!Number.isFinite(cantidad)) continue
    let crudos = porAlimento.get(fdcId)
    if (!crudos) porAlimento.set(fdcId, (crudos = new Map()))
    crudos.set(nutriente, cantidad)
  }
  return porAlimento
}

/**
 * Una fila de food_portion.csv a { descripcion, gramos }. Cada dataset la escribe distinto: FNDDS en portion_description
 * ("1 cup", con un código numérico en modifier), SR Legacy en amount + modifier ("1 serving 1 roll") y Foundation en
 * amount + measure_unit ("2 tablespoon"). "Quantity not specified" no es una porción.
 */
export function aPorcion(f: Fila, unidades: Map<string, string>): Porcion | null {
  const gramos = Number(f.gram_weight)
  if (!Number.isFinite(gramos) || gramos <= 0) return null
  const descripcion = f.portion_description?.trim() ?? ''
  if (/quantity not specified/i.test(descripcion)) return null
  const cantidad = Number(f.amount)
  const unidad = unidades.get(f.measure_unit_id ?? '')
  const modificador = f.modifier?.trim() ?? ''
  const texto = [
    f.amount?.trim() && Number.isFinite(cantidad) ? String(cantidad) : '',
    unidad && unidad !== 'undetermined' ? unidad : '',
    descripcion || (/^\d+$/.test(modificador) ? '' : modificador),
  ].join(' ').replace(/\s+/g, ' ').trim()
  if (!texto || /^[\d.]+$/.test(texto)) return null
  return { descripcion: texto, gramos: redondear(gramos, 1) }
}

/** Sin repetidas, en el orden de seq_num del CSV. */
export function juntarPorciones(porciones: Porcion[]): Porcion[] {
  const vistas = new Set<string>()
  return porciones.filter((p) => !vistas.has(p.descripcion) && vistas.add(p.descripcion))
}

export function porcionMediana(porciones: Porcion[]): number {
  return porciones.length ? Math.round(mediana(porciones.map((p) => p.gramos))) : 100
}

// Categoría de FDC (WWEIA en FNDDS, food_category en SR Legacy y Foundation) → grupo de la guía uruguaya.
// Gana la primera regla que matchea; el orden importa ("Peanut butter" es otro antes que proteína, "Vegetable juice" es verdura).
const REGLAS_GRUPO: [RegExp, Grupo][] = [
  [/^(baby|formula|human milk|plant-based|protein and nutritional)/, 'otro'],
  [/butter|margarine|cream and cream substitutes/, 'otro'],
  [/milk|cheese|yogurt|dairy|pudding/, 'lacteo'],
  [/dishes|sandwich|burger|pizza|burrito|nacho|turnover|fried rice|stir-fry|egg rolls|mexican|soup|chips|popcorn|pretzel|bars|cakes|cookies|doughnut|candy|gelatin|drink|beverage|coffee|tea$|beer|wine|liquor|water|mayonnaise|dressing|oils|condiment|olives|sauce|sugar|jams|spices|fats|sweets|snacks|fast foods|meals|restaurant|american indian|branded|quality|not included|smoothies/, 'otro'],
  [/egg|beef|pork|lamb|veal|game|poultry|chicken|turkey|liver|fish|shellfish|cold cuts|bacon|frankfurter|sausage|beans, peas|legume|nut|seed|soy|meat/, 'proteina'],
  [/potato|corn|starchy|rice|pasta|noodle|grain|bread|rolls|bagel|tortilla|biscuit|pancake|cereal|oatmeal|grits|cracker|baked products/, 'cereal_almidon'],
  [/vegetable|tomato|carrot|broccoli|spinach|lettuce|green|string beans|cabbage|onion|coleslaw/, 'verdura'],
  [/fruit|apple|banana|grape|peach|strawberr|berr|citrus|melon|pear|pineapple|mango|juice/, 'fruta'],
]

export function inferirGrupo(categoria: string, descripcion: string): Grupo {
  const c = categoria.toLowerCase()
  const g = REGLAS_GRUPO.find(([re]) => re.test(c))?.[1] ?? 'otro'
  // SR Legacy y Foundation juntan huevos con lácteos y papas con verduras
  if (g === 'lacteo' && /^eggs?\b/i.test(descripcion)) return 'proteina'
  if (g === 'verdura' && /^(potato|potatoes|sweet potato|yam|cassava|plantain)/i.test(descripcion) && !/chips/i.test(descripcion)) return 'cereal_almidon'
  return g
}

/** De varios fdcId candidatos para un alimento, el de mejor dataset según PRIORIDAD (a igual dataset, el primero listado). */
export function elegirFdc(candidatos: number[], datasetDe: (fdcId: number) => Dataset | undefined): number | undefined {
  return candidatos
    .map((fdcId, orden) => ({ fdcId, orden, rango: PRIORIDAD.indexOf(datasetDe(fdcId) ?? ('' as Dataset)) }))
    .filter((c) => c.rango >= 0)
    .sort((a, b) => a.rango - b.rango || a.orden - b.orden)[0]?.fdcId
}

export interface AlimentoFdc { fdcId: number; descripcion: string; dataset: Dataset; categoria: string }

/** Un alimento cualquiera de FDC en formato `Alimento` (colección alimentos_fdc): nombre en inglés, sin alérgenos curados. */
export function aAlimentoFdc(food: AlimentoFdc, crudos: Crudos | undefined, porciones: Porcion[]): Alimento {
  const { por100g, faltantes } = aNutrientes(crudos ?? new Map())
  return {
    id: `fdc_${food.fdcId}`, nombre: food.descripcion, alias: [], fdcId: food.fdcId, grupo: inferirGrupo(food.categoria, food.descripcion),
    por100g, alergenos: [], porcionMedianaG: porcionMediana(porciones), fuente: 'USDA', dataset: food.dataset,
    ...(porciones.length ? { porciones } : {}), ...(faltantes.length ? { faltantes } : {}),
  }
}

/** Suma lo agregado por la fortificación a los nutrientes del alimento base; lo agregado deja de faltar. */
export function fortificar(base: Pick<Alimento, 'por100g' | 'faltantes'>, agregado: Partial<Nutrientes>): Pick<Alimento, 'por100g' | 'faltantes'> {
  const por100g = { ...base.por100g }
  for (const [n, x] of Object.entries(agregado) as [Nutriente, number][]) por100g[n] = redondear(por100g[n] + x)
  const faltantes = (base.faltantes ?? []).filter((n) => !(n in agregado))
  return { por100g, ...(faltantes.length ? { faltantes } : {}) }
}

/** Nutrientes de un genérico otro_<grupo>: la mediana, nutriente por nutriente, de los curados del grupo. */
export function nutrientesMediana(alimentos: Pick<Alimento, 'por100g'>[]): Nutrientes {
  const por100g = {} as Nutrientes
  for (const n of NUTRIENTE) por100g[n] = redondear(mediana(alimentos.map((a) => a.por100g[n])))
  return por100g
}
