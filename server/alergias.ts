// v5.8 · Las alergias que no están en ALERGENO (DatosBasicos.alergiasOtras): "kiwi", "frutillas", "colorante rojo",
// como las escribe el padre. Se cruzan con data/alimentos.json por nombre, alias y las palabras del id, por palabras
// completas y sin mirar mayúsculas, tildes ni plurales ("frutillas" ↔ frutilla, "nueces" ↔ nuez).
// Ante la duda, se bloquea: dejar afuera un alimento cuesta poco; dejar pasar un alérgeno, una alergia. Por eso un
// alimento cuyo nombre aparece dentro de la alergia también cuenta ("durazno en almíbar" bloquea el durazno). Lo que no
// cruza con ningún alimento (alergiasSinCruce: "colorante rojo") se sigue controlando en el texto de la receta y se le
// dice al LLM, y la pantalla le avisa al padre que no se puede revisar ingrediente por ingrediente.
// Es puro (sin node:): lo usa también el front (src/lib/alergias.ts) para ese aviso.
import type { Alergeno, Alimento } from '../shared/contratos.js'

/** Minúsculas, sin tildes, lo que no es letra ni número como espacio, sin espacios de más. */
export function normalizar(texto: string): string {
  return texto.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

// Lo que el padre (o el relato) pone antes de lo que es: "al kiwi", "a la frutilla", "alergia a los duraznos".
const PREFIJO = /^((alergic[oa]s?|alergias?|intolerancias?|intolerantes?)( (a|al|a la|a las|a los|de))? |(al|a la|a las|a los|a|el|la|los|las) )+/

/** La alergia como palabras normalizadas, sin "al", "a la"… adelante. */
export function palabrasDe(otra: string): string[] {
  const n = normalizar(otra).replace(PREFIJO, '')
  return n ? n.split(' ') : []
}

/** Las formas de una palabra para comparar en singular o plural: frutillas → frutilla, limones → limon, nueces → nuez. */
function formas(w: string): Set<string> {
  const f = new Set([w])
  if (w.length > 3 && w.endsWith('s')) f.add(w.slice(0, -1))
  if (w.length > 4 && w.endsWith('es')) f.add(w.slice(0, -2))
  if (w.length > 4 && w.endsWith('ces')) f.add(`${w.slice(0, -3)}z`)
  return f
}

const mismaPalabra = (a: string, b: string) => {
  const fa = formas(a)
  for (const x of formas(b)) if (fa.has(x)) return true
  return false
}

/** ¿`aguja` aparece en `pajar` como palabras seguidas y completas? */
function contiene(pajar: readonly string[], aguja: readonly string[]): boolean {
  if (!aguja.length || aguja.length > pajar.length) return false
  for (let i = 0; i + aguja.length <= pajar.length; i++) {
    if (aguja.every((w, j) => mismaPalabra(pajar[i + j], w))) return true
  }
  return false
}

// Lo que un alimento lleva aunque su nombre no lo diga (el kétchup es tomate). Corto y a mano: solo lo evidente.
const LLEVA: Record<string, string[]> = {
  ketchup: ['tomate'],
  salsa_tomate: ['tomate'],
  chocolate: ['cacao'],
  cacao_azucarado: ['chocolate'],
  alfajor: ['chocolate', 'dulce de leche', 'cacao'],
  helado: ['crema'],
  mayonesa: ['huevo'],
  jugo_naranja: ['naranja'],
  mermelada: ['fruta'],
}

// Si escribió una de las alergias de siempre con otras palabras ("lácteos", "trigo"), también cuentan los alimentos con
// ese alérgeno en la tabla (la tabla sabe que el pan tiene gluten; el nombre del pan no lo dice).
const COMO_ALERGENO: [string, Alergeno][] = [
  ['leche', 'leche'], ['lacteo', 'leche'], ['lacteos', 'leche'], ['lactosa', 'leche'], ['caseina', 'leche'], ['proteina de leche', 'leche'],
  ['huevo', 'huevo'], ['huevos', 'huevo'], ['clara', 'huevo'], ['yema', 'huevo'],
  ['gluten', 'gluten'], ['trigo', 'gluten'], ['tacc', 'gluten'], ['harina de trigo', 'gluten'],
  ['mani', 'mani'], ['cacahuate', 'mani'], ['cacahuete', 'mani'],
  ['frutos secos', 'frutos_secos'], ['nuez', 'frutos_secos'], ['nueces', 'frutos_secos'], ['almendra', 'frutos_secos'], ['almendras', 'frutos_secos'], ['avellana', 'frutos_secos'], ['avellanas', 'frutos_secos'],
  ['soja', 'soja'], ['soya', 'soja'],
  ['pescado', 'pescado'], ['pescados', 'pescado'],
  ['marisco', 'mariscos'], ['mariscos', 'mariscos'], ['camaron', 'mariscos'], ['camarones', 'mariscos'],
  ['sesamo', 'sesamo'], ['ajonjoli', 'sesamo'],
]

/** La alergia de siempre que nombra, si nombra una ("lácteos" → leche). */
export function alergenoDe(otra: string): Alergeno | undefined {
  const p = palabrasDe(otra).join(' ')
  return COMO_ALERGENO.find(([t]) => t === p)?.[1]
}

const esGenerico = (id: string) => id.startsWith('otro_')

/** Los términos con que se nombra un alimento: el id con espacios, el nombre, los alias y lo que lleva. */
function terminos(a: Alimento): string[][] {
  return [a.id.replace(/_/g, ' '), a.nombre, ...(a.alias ?? []), ...(LLEVA[a.id] ?? [])]
    .map((t) => normalizar(t).split(' ').filter(Boolean))
    .filter((t) => t.length > 0)
}

/** ¿Esta alergia alcanza a este alimento? */
function alcanza(alergia: readonly string[], alergeno: Alergeno | undefined, a: Alimento): boolean {
  if (esGenerico(a.id) || !alergia.length) return false
  if (alergeno && a.alergenos?.includes(alergeno)) return true
  // La alergia está en un nombre del alimento ("frutilla" en "frutillas", "tomate" en "salsa de tomate"), o un nombre
  // del alimento está en la alergia ("durazno" en "durazno en almíbar").
  return terminos(a).some((t) => contiene(t, alergia) || contiene(alergia, t))
}

function lista(alimentos: Iterable<Alimento> | ReadonlyMap<string, Alimento>): Alimento[] {
  return 'get' in alimentos && typeof alimentos.get === 'function' ? [...(alimentos as ReadonlyMap<string, Alimento>).values()] : [...(alimentos as Iterable<Alimento>)]
}

/** Los alimentos (alimentoId) que cada alergia alcanza. */
function cruce(otras: readonly string[], alimentos: Iterable<Alimento> | ReadonlyMap<string, Alimento>): Map<string, Set<string>> {
  const todos = lista(alimentos)
  const res = new Map<string, Set<string>>()
  for (const otra of otras) {
    const palabras = palabrasDe(otra)
    const alergeno = alergenoDe(otra)
    res.set(otra, new Set(todos.filter((a) => alcanza(palabras, alergeno, a)).map((a) => a.id)))
  }
  return res
}

/** Los alimentos (alimentoId) que no puede comer por sus otras alergias. Vacío si no tiene. */
export function alimentosProhibidos(otras: readonly string[], alimentos: Iterable<Alimento> | ReadonlyMap<string, Alimento>): Set<string> {
  const ids = new Set<string>()
  if (!otras.length) return ids
  for (const s of cruce(otras, alimentos).values()) for (const id of s) ids.add(id)
  return ids
}

/** Las otras alergias que no alcanzan a ningún alimento del catálogo ("colorante rojo"), tal como las escribió. */
export function alergiasSinCruce(otras: readonly string[], alimentos: Iterable<Alimento> | ReadonlyMap<string, Alimento>): string[] {
  if (!otras.length) return []
  return [...cruce(otras, alimentos)].filter(([, s]) => s.size === 0).map(([otra]) => otra)
}

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Una palabra en singular o plural: kiwi(s), frutilla(s), limon(es), nuez/nueces. */
function patronPalabra(w: string): string {
  const bases = [...formas(w)]
  const conZ = bases.filter((b) => b.endsWith('z')).map((b) => `${escapar(b.slice(0, -1))}ces`)
  return `(?:${[...bases.map((b) => `${escapar(b)}(?:s|es)?`), ...conZ].join('|')})`
}

/**
 * La alergia en un texto ya sin tildes ni mayúsculas (el de validacion/receta.ts), por palabras completas y en singular
 * o plural: "kiwi" encuentra "kiwis" y "Kiwi"; "sal" no encuentra "salsa". Sin el flag `u`: buscar() lo rearma con 'g'.
 * Una alergia vacía no encuentra nada.
 */
export function patronAlergia(otra: string): RegExp {
  const palabras = palabrasDe(otra)
  if (!palabras.length) return /(?!)/
  return new RegExp(`\\b${palabras.map(patronPalabra).join('[\\s-]+')}\\b`)
}

/** Las otras alergias en limpio: sin vacías ni repetidas (sin mirar mayúsculas ni tildes), con los espacios en orden. */
export function limpiarOtras(otras: readonly string[] | undefined): string[] {
  const vistas = new Set<string>()
  const res: string[] = []
  for (const o of otras ?? []) {
    const t = o.trim().replace(/\s+/g, ' ')
    const k = palabrasDe(t).join(' ')
    if (!k || vistas.has(k)) continue
    vistas.add(k)
    res.push(t)
  }
  return res
}
