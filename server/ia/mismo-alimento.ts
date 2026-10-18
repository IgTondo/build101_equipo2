// ¿Es la misma preparación? (v5.8) El modelo propone un preparacionId del catálogo y el código lo verifica contra las
// palabras de la familia (`dicho`) o la descripción de la visión. Un id equivocado le enseña a la app algo falso del
// chico (yogur de frutilla → "yogur bebible de vainilla", pizza de jamón → pizza de muzzarella), un null se completa
// después: ante la duda, null. Medido el 18/10 en 13 relatos: sin esto, 8 de 34 ids estaban mal; con el prompt V2 y
// esto, 0 de 23 (eval en el informe del modelo de perfil).
// Lo que se mira, en orden:
//   1. la clase de alimento: lo que dice la familia (pollo, frutilla, María, jamón…) tiene que estar en el catálogo;
//   2. las familias que se excluyen: cocción (frito ≠ horno), forma (bastones ≠ cubos) y origen (comprado ≠ casero);
//   3. lo que el catálogo agrega con "con X" (arroz con pollo), el plato (milanesa, nuggets, pizza…) y lo que lleva que
//      importa (queso, salsa, jamón, huevo, integral, fortificado, canola, puré) y la familia no dijo;
//   4. los "sin" cruzados: dice sin huevo y el catálogo lo lleva, o el catálogo es sin huevo y dice huevo;
//   5. las alergias del chico (ALERGENO y las otras, con alimentosProhibidos() de server/alergias.ts).
import type { Alergeno, Alimento, PreparacionCatalogo } from '../../shared/contratos.js'
import { alimentosProhibidos, patronAlergia } from '../alergias.js'
import { alimentoPorId } from './catalogo.js'
import { normalizar } from './relato.js'

// Prefijos de palabra (normalizada) → clase. "papa" también es "papas"; "frit" es frito, fritos, fritas.
const CLASES: Record<string, string[]> = {
  pollo: ['pollo', 'pechuga', 'suprema'], vaca: ['carne', 'vacuna', 'vaca', 'bife', 'nalga', 'peceto', 'picada', 'asado'],
  pescado: ['pescado'], merluza: ['merluza'], atun: ['atun'], salmon: ['salmon'],
  soja: ['soja'], lenteja: ['lenteja'], garbanzo: ['garbanzo'], poroto: ['poroto'], cerdo: ['cerdo', 'bondiola'],
  jamon: ['jamon', 'fiambre'], salchicha: ['salchich', 'pancho'], queso: ['queso', 'muzzarella', 'mozzarella', 'muzza', 'dambo', 'gratinad', 'ricota'],
  huevo: ['huevo'], leche: ['leche'], tomate: ['tomate', 'tuco', 'pomarola'], manteca: ['manteca'],
  frutilla: ['frutilla', 'fresa'], vainilla: ['vainilla'], chocolate: ['chocolat', 'cacao'], banana: ['banana'], manzana: ['manzana'],
  pera: ['pera'], durazno: ['durazno'], naranja: ['naranja'], mandarina: ['mandarina'], kiwi: ['kiwi'], uva: ['uva'], anana: ['anana'],
  zapallo: ['zapallo', 'calabaza'], zapallito: ['zapallito'], zanahoria: ['zanahoria'], brocoli: ['brocoli'], arveja: ['arveja'],
  chaucha: ['chaucha'], boniato: ['boniato', 'batata'], morron: ['morron'], choclo: ['choclo'], espinaca: ['espinaca'],
  acelga: ['acelga'], palta: ['palta'], pepino: ['pepino'], papa: ['papa'], arroz: ['arroz'], fideo: ['fideo', 'tallarin', 'tirabuzon', 'spaghetti'],
  noqui: ['noqui'], polenta: ['polenta'], pan: ['pan', 'tostada'], galletita: ['galletit', 'galleta'], agua: ['agua'],
  integral: ['integral'], maria: ['maria'], yogur: ['yogur'], avena: ['avena'], sushi: ['sushi'], empanada: ['empanada'],
  tortilla: ['tortilla'], pizza: ['pizza', 'prepizza'], milanesa: ['milanesa'], nugget: ['nugget', 'patita'],
  hamburguesa: ['hamburguesa'], croqueta: ['croqueta'], chips: ['chip'], licuado: ['licuado'], canola: ['canola'],
  fortificada: ['fortificad', 'vitamina'], pure: ['pure'], pisado: ['pisad'], maiz: ['maiz'], napolitana: ['napolitan'],
}
// Un pescado en particular también es "pescado": "palitos de pescado" puede ser los de merluza; "de salmón", no.
const IMPLICA: Record<string, string> = { merluza: 'pescado', atun: 'pescado', salmon: 'pescado' }
// Nombres que ya dicen lo que llevan: "a la napolitana" es con salsa, queso y jamón aunque no lo nombre.
const LLEVA: Record<string, string[]> = { napolitana: ['tomate', 'queso', 'jamon'] }

// Valores que se excluyen entre sí: si los dos lados dicen uno y no coinciden, no es la misma.
const FAMILIAS: Record<string, Record<string, string[]>> = {
  coccion: { frito: ['frit'], horno: ['horno', 'hornead'], hervido: ['hervid'], plancha: ['plancha', 'grill'], guisado: ['guisad'], crudo: ['crud'] },
  forma: { baston: ['baston', 'palito', 'tira'], cubo: ['cubo', 'cubito', 'trozo', 'cuadradit'], pisado: ['pisad'], rodaja: ['rodaja', 'chip'], gajo: ['gajo'] },
  origen: { comprado: ['super', 'comprad', 'paquete', 'congelad', 'caja', 'marca'], casero: ['caser', 'hecho', 'hago', 'abuela', 'natural', 'exprimid'] },
  variedad: { agua: ['agua'], integral: ['integral'], maria: ['maria'], dulce: ['dulce'], avena: ['avena'], blanco: ['blanc'] },
}

// Lo que, si el catálogo lo lleva, la familia tiene que haberlo dicho: en el nombre o en los ingredientes (lo que se
// agrega a la base) o solo en el nombre (la versión: "integral", "fortificado", "en puré"; un ingrediente que se llama
// cereal_fortificado no hace que los copos de maíz sean "otra versión").
const AGREGADOS = ['queso', 'tomate', 'jamon', 'huevo']
const VERSIONES = ['integral', 'fortificada', 'canola', 'pure', 'pisado']
// El plato: si el catálogo es una milanesa (o nuggets, una pizza…), lo que dijo también (el pollo a la plancha no son nuggets).
const PLATOS = ['milanesa', 'nugget', 'hamburguesa', 'empanada', 'croqueta', 'pizza', 'sushi', 'tortilla', 'licuado', 'galletita']
// En la foto no se ven: el huevo del rebozado, la vitamina D ni el aceite.
const INVISIBLES = new Set(['huevo', 'fortificada', 'canola'])

const palabras = (s: string) => normalizar(s).split(' ').filter(Boolean)

function clasesDe(ws: string[], tabla: Record<string, string[]>): Set<string> {
  const out = new Set<string>()
  for (const w of ws) for (const [c, prefijos] of Object.entries(tabla)) if (prefijos.some((p) => w.startsWith(p))) out.add(c)
  return out
}

function conImplicadas(c: Set<string>): Set<string> {
  for (const x of [...c]) if (IMPLICA[x]) c.add(IMPLICA[x])
  return c
}

/** Palabras afirmadas y negadas: "sin X" y "nada de X" niegan X (y la palabra que sigue, si no es un conector). */
function partir(s: string): { si: string[]; no: string[] } {
  const ws = palabras(s)
  const si: string[] = []
  const no: string[] = []
  for (let i = 0; i < ws.length; i++) {
    const nada = ws[i] === 'nada' && ws[i + 1] === 'de'
    if (ws[i] === 'sin' || nada) {
      const j = nada ? i + 2 : i + 1
      if (ws[j]) no.push(ws[j])
      i = j
      continue
    }
    si.push(ws[i])
  }
  return { si, no }
}

// Las otras alergias ("kiwi", "frutillas") se cruzan con el criterio de server/alergias.ts (pista de alergias): nombre,
// alias, palabras del id y lo que lleva, en singular o plural; y por el alérgeno si es una de siempre con otro nombre.
function otraQueAlcanza(a: Alimento, alergiasOtras: readonly string[]): string | null {
  return alergiasOtras.find((o) => alimentosProhibidos([o], [a]).size > 0)?.trim() ?? null
}

/**
 * La alergia del chico con la que choca un alimento, o null. `alergiasOtras` son las que escribe el padre fuera de
 * ALERGENO ("kiwi"): se cruzan por nombre y alias.
 */
export function alergiaQueChoca(alimentoId: string, alergias: readonly Alergeno[], alergiasOtras: readonly string[] = []): string | null {
  const a = alimentoPorId(alimentoId)
  const deLista = (a?.alergenos ?? []).find((x) => alergias.includes(x))
  if (deLista) return deLista
  return a && alergiasOtras.length ? otraQueAlcanza(a, alergiasOtras) : null
}

/**
 * null si `prep` es la misma preparación que nombró la familia (`dicho`); si no, el motivo (para el log).
 * - `alergias`, `alergiasOtras`: las del chico; una preparación que las lleva nunca es "la que come".
 * - `ingredientesVistos` (visión): los alimentoId que vio el modelo en la foto. Cuentan como dichos (la familia no
 *   habla: la descripción es del modelo) y no se exige lo que no se ve (el huevo del rebozado).
 */
export function verificarId(
  dicho: string,
  prep: Pick<PreparacionCatalogo, 'nombre'> & { ingredientes?: PreparacionCatalogo['ingredientes'] },
  alergias: readonly Alergeno[] = [],
  alergiasOtras: readonly string[] = [],
  ingredientesVistos?: readonly string[],
): string | null {
  const ids = (prep.ingredientes ?? []).map((i) => i.alimentoId)
  const d = partir(dicho)
  const cat = partir(`${prep.nombre} ${ids.map((id) => id.replace(/_/g, ' ')).join(' ')}`)
  const cD = clasesDe(d.si, CLASES)
  const cC = conImplicadas(clasesDe(cat.si, CLASES))
  const vistas = clasesDe(palabras((ingredientesVistos ?? []).map((id) => id.replace(/_/g, ' ')).join(' ')), CLASES)
  const dichas = new Set([...cD, ...vistas, ...[...cD].flatMap((c) => LLEVA[c] ?? [])])

  // 1. Lo que dijo tiene que estar
  const falta = [...cD].filter((c) => !cC.has(c))
  if (falta.length) return `dice ${falta.join(',')} y el catálogo no`

  // 2. Cocción, forma, origen y variedad que se excluyen
  const nombre = palabras(prep.nombre)
  for (const [familia, tabla] of Object.entries(FAMILIAS)) {
    const a = clasesDe(d.si, tabla)
    const b = clasesDe(nombre, tabla)
    if (a.size && b.size && ![...a].some((x) => b.has(x))) return `${familia}: ${[...a].join(',')} ≠ ${[...b].join(',')}`
  }

  // 3. Lo que el catálogo agrega y no dijo
  const conTramo = [...normalizar(prep.nombre.replace(/\(.*?\)/g, '')).matchAll(/\bcon ([a-z ]+)/g)].map((m) => m[1]).join(' ')
  const seVe = (c: string) => !(ingredientesVistos && INVISIBLES.has(c))
  const extra = [...clasesDe(partir(conTramo).si, CLASES)].filter((c) => !dichas.has(c) && seVe(c))
  if (extra.length) return `el catálogo agrega ${extra.join(',')}`
  const enNombre = clasesDe(partir(prep.nombre).si, CLASES)
  const plato = PLATOS.filter((c) => enNombre.has(c) && !cD.has(c))
  if (plato.length) return `el catálogo es ${plato.join(',')} y no lo dijo`
  const agregados = [...AGREGADOS.filter((c) => cC.has(c)), ...VERSIONES.filter((c) => enNombre.has(c))]
    .filter((c) => !dichas.has(c) && seVe(c))
  if (agregados.length) return `el catálogo lleva ${agregados.join(',')} y no lo dijo`

  // 4. Los "sin" cruzados
  for (const c of clasesDe(d.no, CLASES)) if (cC.has(c)) return `dice sin ${c} y el catálogo lo lleva`
  for (const c of clasesDe(cat.no, CLASES)) if (cD.has(c)) return `el catálogo es sin ${c} y dice ${c}`

  // 5. Alergias
  const choque = ids.flatMap((id) => {
    const x = alergiaQueChoca(id, alergias, alergiasOtras)
    return x ? [`${id}:${x}`] : []
  })
  // y lo que el nombre de la preparación dice aunque no esté en sus ingredientes ("licuado de kiwi")
  const nombreSinTildes = normalizar(prep.nombre)
  for (const o of alergiasOtras) if (patronAlergia(o).test(nombreSinTildes) && !choque.some((c) => c.endsWith(`:${o.trim()}`))) choque.push(`nombre:${o.trim()}`)
  if (choque.length) return `alergia ${choque.join(',')}`
  return null
}
