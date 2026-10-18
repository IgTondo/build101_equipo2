// v5.10 · Lo puro de scripts/afinidades.ts: leer las recetas de Ahn et al. (2011), contar en cuántas aparece cada
// alimento y cada par (pesadas por región) y pasar eso a una afinidad de 0 a 1.
//
// La afinidad es el PMI normalizado (NPMI, Bouma 2009), positivo y con suavizado:
//   npmi(a, b) = ln(p(a,b) / (p(a) p(b))) / −ln p(a,b)            ∈ [−1, 1]: 0 si se cruzan por azar, 1 si van siempre juntos
//   afinidad   = max(0, npmi) · w(a,b) / (w(a,b) + SUAVIZADO)       ∈ [0, 1)
// con p y w sobre las recetas pesadas por región. Por qué así:
//  - El PMI solo premia lo raro: dos ingredientes de 3 recetas que van juntos en las 3 le ganan a papa–cebolla. El NPMI
//    lo acota y el factor w / (w + SUAVIZADO) le baja el peso a lo que tiene poco soporte (con w = SUAVIZADO, la mitad).
//  - El lift (p(a,b) / p(a) p(b)) tampoco: no tiene techo y se dispara con lo raro.
//  - Lo negativo (se usan menos juntos que por azar: banana–carne picada) es 0, igual que "sin dato": no hay que
//    distinguirlos para sortear un ingrediente.
//  - Además, un mínimo de soporte: N_MINIMO recetas juntos y PESO_MINIMO de peso (una sola receta latina pesa como
//    cuatro norteamericanas), y se descarta lo que queda por debajo de AFINIDAD_MINIMA.
// Las regiones: la cocina uruguaya es italiana, española y rioplatense, así que pesan LatinAmerican y SouthernEuropean;
// NorthAmerican (el 72% del dataset, sobre todo allrecipes) y WesternEuropean (francesa, británica, alemana) suman con
// menos peso, y las de Asia, África, Medio Oriente y el resto de Europa no cuentan (soja, jengibre, comino…).
// Un ingrediente de Ahn puede ser dos nuestros (beef → carne vacuna y picada): ese par no cuenta por esa receta, porque
// sale del mismo ingrediente y no es una combinación.
import type { ParAfinidad } from '../../server/ia/afinidades.js'

export interface Receta { cocina: string; ingredientes: string[] }

export const PESO_REGION: Readonly<Record<string, number>> = {
  LatinAmerican: 1,
  SouthernEuropean: 1,
  NorthAmerican: 0.25,
  WesternEuropean: 0.25,
}
export const SUAVIZADO = 8
export const N_MINIMO = 5
export const PESO_MINIMO = 3
export const AFINIDAD_MINIMA = 0.02

/** Una receta por línea: la cocina y los ingredientes, separados por tab (epic_, allr_ y menu_recipes.txt). */
export function leerRecetas(texto: string): Receta[] {
  return texto.split('\n').flatMap((linea) => {
    const [cocina, ...ingredientes] = linea.trim().split('\t').map((x) => x.trim()).filter(Boolean)
    return cocina && ingredientes.length ? [{ cocina, ingredientes }] : []
  })
}

/** map.txt: cocina → región. Las que no tienen región ("Asian") quedan afuera. */
export function leerRegiones(texto: string): Map<string, string> {
  const regiones = new Map<string, string>()
  for (const linea of texto.split('\n')) {
    const [cocina, region] = linea.trim().split('\t').map((x) => x.trim())
    if (cocina && region) regiones.set(cocina, region)
  }
  return regiones
}

export interface Conteo {
  recetas: number // las que pesan (región con peso)
  total: number // su peso
  solo: Map<string, number> // alimentoId → peso de las recetas en que aparece
  juntos: Map<string, { peso: number; n: number }> // `${a}|${b}` con a < b → peso y cuántas recetas
}

const clave = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`)

export function contar(
  recetas: readonly Receta[],
  regiones: ReadonlyMap<string, string>,
  mapa: Readonly<Record<string, readonly string[]>>,
  existentes: ReadonlySet<string>,
  pesos: Readonly<Record<string, number>> = PESO_REGION,
): Conteo {
  const conteo: Conteo = { recetas: 0, total: 0, solo: new Map(), juntos: new Map() }
  for (const r of recetas) {
    const peso = pesos[regiones.get(r.cocina) ?? ''] ?? 0
    if (peso <= 0) continue
    conteo.recetas++
    conteo.total += peso
    // De qué ingredientes de la receta sale cada alimento nuestro
    const fuentes = new Map<string, Set<string>>()
    for (const ing of new Set(r.ingredientes)) {
      for (const id of mapa[ing] ?? []) {
        if (existentes.has(id)) fuentes.set(id, (fuentes.get(id) ?? new Set()).add(ing))
      }
    }
    const ids = [...fuentes.keys()].sort()
    for (const id of ids) conteo.solo.set(id, (conteo.solo.get(id) ?? 0) + peso)
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const fa = fuentes.get(ids[i]!)!
        const fb = fuentes.get(ids[j]!)!
        if (fa.size === 1 && fb.size === 1 && [...fa][0] === [...fb][0]) continue // el mismo ingrediente de Ahn
        const k = clave(ids[i]!, ids[j]!)
        const x = conteo.juntos.get(k) ?? { peso: 0, n: 0 }
        conteo.juntos.set(k, { peso: x.peso + peso, n: x.n + 1 })
      }
    }
  }
  return conteo
}

export interface OpcionesAfinidad { suavizado?: number; nMinimo?: number; pesoMinimo?: number; afinidadMinima?: number }

/** NPMI positivo con suavizado (arriba). Los pares en las dos direcciones, por `a`, de más a menos afín. */
export function afinidades(c: Conteo, op: OpcionesAfinidad = {}): ParAfinidad[] {
  const suavizado = op.suavizado ?? SUAVIZADO
  const nMinimo = op.nMinimo ?? N_MINIMO
  const pesoMinimo = op.pesoMinimo ?? PESO_MINIMO
  const afinidadMinima = op.afinidadMinima ?? AFINIDAD_MINIMA
  const pares: ParAfinidad[] = []
  for (const [k, { peso, n }] of c.juntos) {
    if (n < nMinimo || peso < pesoMinimo) continue
    const [a, b] = k.split('|') as [string, string]
    const pab = peso / c.total
    const pa = c.solo.get(a)! / c.total
    const pb = c.solo.get(b)! / c.total
    const npmi = pab >= 1 ? 1 : Math.log(pab / (pa * pb)) / -Math.log(pab)
    const afinidad = Math.round(Math.max(0, npmi) * (peso / (peso + suavizado)) * 1000) / 1000
    if (afinidad <= 0 || afinidad < afinidadMinima) continue
    pares.push({ a, b, n, afinidad }, { a: b, b: a, n, afinidad })
  }
  return pares.sort((x, y) => (x.a < y.a ? -1 : x.a > y.a ? 1 : y.afinidad - x.afinidad || (x.b < y.b ? -1 : 1)))
}
