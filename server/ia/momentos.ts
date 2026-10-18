// v5.10 · En qué comidas va cada alimento y qué es un plato principal. Sin esto la receta creativa armaba combinaciones
// que no existen: cambiando el principal, de sus tostadas salían ravioles para el desayuno (los dos son cereal_almidon y
// pasan el chequeo de grupo), y la comida completa sumaba su pizza al lado de los ravioles nuevos en la cena.
//
// v5.10 · Dos franjas que no se mezclan (pedido de la familia: "que no aparezcan combos raros"): desayuno_merienda
// (desayuno, merienda y colación) y almuerzo_cena. Cada PREPARACIÓN es de una sola franja (franjaDePreparacion): la del
// catálogo (data/preparaciones.json está partido: ninguna mezcla) o, si no es del catálogo (lo que vio la cámara, el
// plato nuevo), la de su tipo: un plato principal, pastas, carnes, verduras cocidas y guarniciones son de almuerzo y
// cena; pan, tostadas, galletitas, cereales, leche, yogur y licuados, de desayuno y merienda. Nunca por la hora en que la
// comió: si comió pizza en la merienda, la pizza sigue siendo de almuerzo y cena.
//
// Cada ALIMENTO, como lo principal de un plato (el de más gramos): la franja de las preparaciones del catálogo donde es
// el principal (la leche, desayuno y merienda; la papa, almuerzo y cena). Para lo que no es el principal de ninguna, un
// default por grupo y familia, sin "a toda hora":
// - panes, galletitas, cereales y avena; leche, yogur y postres de leche; frutas: desayuno y merienda
// - pastas, pizza, el resto de los cereales y almidones (arroz, papa, polenta…), carnes, pescados, legumbres, huevo,
//   jamón, quesos de plato (ricota, muzzarella) y verduras: almuerzo y cena
// - sumados a otro plato, el queso, el huevo, el jamón y lo que se unta van en las dos (el tostado de jamón y queso de la
//   merienda); también los rellenos (harina, pan rallado) y el grupo otro (aceites, condimentos, dulces, frutos secos),
//   que nunca son el plato (eso lo dicen ACOMPANAMIENTOS y GOLOSINAS_Y_ULTRAPROCESADOS, server/grafo/conocimiento.ts)
// LA ÚNICA EXCEPCIÓN: la fruta entera como postre o acompañamiento (rol verdura_fruta) va en las dos franjas: una banana
// de postre en la cena, sí (esFrutaEntera, vaEnLaComida con rol, vaEnLaFranja en plato-completo.ts); un jugo, no.
//
// esPlatoPrincipal: pastas, pizza, milanesas, nuggets, hamburguesas, tartas, guisos y carnes. Una comida lleva uno
// solo, y el cereal o pan del desayuno es pan, tostadas, galletitas o un cereal, nunca uno de estos.
import { MOMENTO, type Atributos, type Grupo, type Momento, type PreparacionCatalogo, type RolPlato } from '../../shared/contratos.js'
import { preparacionesCatalogo } from '../datos/catalogos.js'
import { alimentoPorId } from './catalogo.js'

/** v5.10 · Las dos franjas de comidas que no se mezclan. */
export type Franja = 'desayuno_merienda' | 'almuerzo_cena'
export const NOMBRE_FRANJA: Record<Franja, string> = { desayuno_merienda: 'desayuno y merienda', almuerzo_cena: 'almuerzo y cena' }
/** La franja de una comida: la colación va con el desayuno y la merienda. */
export const franjaDe = (m: Momento): Franja => (m === 'almuerzo' || m === 'cena' ? 'almuerzo_cena' : 'desayuno_merienda')

/** Lo que este módulo mira de una preparación (también una que vio la cámara, con atributos a medias). */
type Plato = { nombre: string; atributos: Partial<Atributos>; ingredientes: readonly { alimentoId: string; gramos: number }[] }

const DM: readonly Franja[] = ['desayuno_merienda']
const AC: readonly Franja[] = ['almuerzo_cena']
const LAS_DOS: readonly Franja[] = ['desayuno_merienda', 'almuerzo_cena']

const familia = (id: string): string => id.split('_')[0]!
/** Lo de más gramos (como principal() de server/aprendizaje/cadena.ts, que usa este módulo: así no hay un ciclo). */
const principalDe = (ingredientes: Plato['ingredientes']): string | null =>
  ingredientes.reduce<{ id: string | null; g: number }>((m, i) => (i.gramos > m.g ? { id: i.alimentoId, g: i.gramos } : m), { id: null, g: -Infinity }).id

/** Panes, galletitas, cereales y avena (por familia del id): desayuno y merienda. */
const DE_DESAYUNO = new Set(['pan', 'galletitas', 'galletas', 'grisines', 'tostadas', 'cereal', 'copos', 'granola', 'avena', 'salvado', 'medialuna', 'torta', 'pororo'])
/** Rellenos y harinas: no son el principal de nada, van donde vaya su plato. */
const RELLENOS = new Set(['harina', 'maicena', 'semola'])
/** Los quesos de plato: como principal, almuerzo y cena; sumados, en las dos. */
const QUESOS = new Set(['queso', 'ricota'])
/** Proteínas que sumadas van en las dos (el tostado de jamón y queso, el huevo revuelto con tostadas, lo que se unta). */
const PROTEINA_SUMADA_EN_LAS_DOS = new Set(['huevo', 'jamon', 'pasta_mani', 'hummus'])
/** Pastas y masas (por familia del id): con su salsa o su relleno, son el plato. */
const PASTAS_Y_MASAS = new Set(['fideos', 'ravioles', 'noquis', 'sorrentinos', 'canelones', 'lasagna', 'prepizza', 'pizza', 'tapa', 'masa'])
/** Las proteínas que son plato principal aunque pesen menos que su guarnición (arroz con pollo: 80 g de arroz y 50 de pollo). */
const PROTEINA_PARA_PLATO = 0.3

let memo: { de: ReadonlyMap<string, PreparacionCatalogo>; franjas: Map<string, Set<Franja>> } | null = null

/** Las franjas de las preparaciones del catálogo donde cada alimento es el principal (se rearma si cambia el catálogo). */
function comoPrincipal(): Map<string, Set<Franja>> {
  const catalogo = preparacionesCatalogo()
  if (memo?.de === catalogo) return memo.franjas
  const franjas = new Map<string, Set<Franja>>()
  for (const p of catalogo.values()) {
    const id = principalDe(p.ingredientes)
    if (!id || !p.momentos?.length) continue
    const f = franjas.get(id) ?? new Set<Franja>()
    for (const m of p.momentos) f.add(franjaDe(m))
    franjas.set(id, f)
  }
  memo = { de: catalogo, franjas }
  return franjas
}

/** El default por grupo y familia, para lo que no es el principal de ninguna preparación del catálogo (ver arriba). */
export function franjasPorGrupo(alimentoId: string, grupo: Grupo | undefined = alimentoPorId(alimentoId)?.grupo, como: 'principal' | 'sumado' = 'principal'): readonly Franja[] {
  const f = familia(alimentoId)
  if (!grupo || grupo === 'otro' || RELLENOS.has(f) || alimentoId === 'pan_rallado') return LAS_DOS
  if (grupo === 'fruta') return DM // de postre, en las dos: vaEnLaComida con rol verdura_fruta
  if (grupo === 'lacteo') return QUESOS.has(f) ? (como === 'sumado' ? LAS_DOS : AC) : DM
  if (grupo === 'cereal_almidon') return DE_DESAYUNO.has(f) ? DM : AC
  if (grupo === 'proteina') return como === 'sumado' && (PROTEINA_SUMADA_EN_LAS_DOS.has(f) || PROTEINA_SUMADA_EN_LAS_DOS.has(alimentoId)) ? LAS_DOS : AC
  return AC
}

/** v5.10 · Las franjas de un alimento: como el principal, las de sus preparaciones o su default; sumado, también su default sumado. */
export function franjasDeAlimento(alimentoId: string, grupo?: Grupo, como: 'principal' | 'sumado' = 'principal'): Franja[] {
  const delCatalogo = comoPrincipal().get(alimentoId)
  const franjas = new Set<Franja>(delCatalogo ?? franjasPorGrupo(alimentoId, grupo, 'principal'))
  if (como === 'sumado') for (const f of franjasPorGrupo(alimentoId, grupo, 'sumado')) franjas.add(f)
  return LAS_DOS.filter((f) => franjas.has(f))
}

/** En qué comidas va como lo principal de un plato: las de sus franjas. */
export function momentosDeAlimento(alimentoId: string, grupo?: Grupo): Momento[] {
  const franjas = franjasDeAlimento(alimentoId, grupo)
  return MOMENTO.filter((m) => franjas.includes(franjaDe(m)))
}

/** v5.10 · La excepción: una fruta entera (no un jugo) de postre o al lado, con rol verdura_fruta, va en las dos franjas. */
const frutaDePostre = (alimentoId: string, grupo: Grupo | undefined, rol: RolPlato | undefined) =>
  rol === 'verdura_fruta' && grupo === 'fruta' && familia(alimentoId) !== 'jugo'

/**
 * Si va en esa comida: como el principal del plato (el de más gramos) o sumado a otro (ahí también el queso, el huevo y
 * el jamón en las dos). Con rol verdura_fruta, la fruta entera va en las dos. Sin comida, va.
 */
export function vaEnLaComida(alimentoId: string, momento: Momento | undefined, como: 'principal' | 'sumado' = 'principal', grupo?: Grupo, rol?: RolPlato): boolean {
  if (!momento) return true
  const g = grupo ?? alimentoPorId(alimentoId)?.grupo
  return frutaDePostre(alimentoId, g, rol) || franjasDeAlimento(alimentoId, g, como).includes(franjaDe(momento))
}

/** v5.10 · Una fruta entera (manzana en bastones, banana pisada, ensalada de frutas): lo de más gramos es una fruta y no un jugo. */
export function esFrutaEntera(p: Plato): boolean {
  const id = principalDe(p.ingredientes)
  return p.atributos.grupo === 'fruta' && Boolean(id) && alimentoPorId(id!)?.grupo === 'fruta' && familia(id!) !== 'jugo'
}

/**
 * v5.10 · La franja de una preparación, una sola: la del catálogo o, si no está (la vio la cámara, es el plato nuevo),
 * la de su tipo, nunca la hora en que la comió. Un plato principal es de almuerzo y cena; si no, la de lo de más gramos
 * (franjasDeAlimento) y, si eso va en las dos o no se sabe, la de su grupo (lácteos y frutas, desayuno y merienda; un
 * cereal o pan, también; las demás guarniciones, carnes y verduras, almuerzo y cena).
 */
export function franjaDePreparacion(p: Plato & { id: string }, catalogo: ReadonlyMap<string, PreparacionCatalogo> = preparacionesCatalogo()): Franja {
  const delCatalogo = catalogo.get(p.id)?.momentos?.[0]
  return delCatalogo ? franjaDe(delCatalogo) : franjaPorTipo(p)
}

/** La franja de una preparación por su tipo (sin mirar el catálogo): franjaDePreparacion para lo que no está en él. */
export function franjaPorTipo(p: Plato): Franja {
  if (esPlatoPrincipal(p)) return 'almuerzo_cena'
  const id = principalDe(p.ingredientes)
  const deLoPrincipal = id ? franjasDeAlimento(id) : []
  if (deLoPrincipal.length === 1) return deLoPrincipal[0]!
  const g = p.atributos.grupo
  if (g === 'lacteo' || g === 'fruta' || g === 'otro') return 'desayuno_merienda'
  if (g === 'cereal_almidon') return esCerealOPan(p) ? 'desayuno_merienda' : 'almuerzo_cena'
  return 'almuerzo_cena'
}

/** v5.10 · Nombres de plato principal, como palabras enteras (sin los dulces: una tarta de manzana es un postre). */
const NOMBRE_DE_PRINCIPAL = /(?<!\p{L})(milanesas?|nuggets|hamburguesas?|tartas?|tartaletas?|guisos?|guisad[oa]s?|estofados?|cazuelas?|pizzas?|pizzetas?|fideos|tallarines|ravioles|sorrentinos|[ñn]oquis|canelones|lasa[ñgn]+as?|empanadas?|tortillas?(?! de trigo)|pastel|alb[oó]ndigas|supremas?|medallones|risotto)(?!\p{L})/iu

/**
 * v5.10 · Si la preparación es un plato principal: pastas, pizza, milanesas, nuggets, hamburguesas, tartas, guisos y
 * carnes. Lo es si es del grupo proteína (carnes, pescados, legumbres, huevo), si lo principal (lo de más gramos) es una
 * pasta, una masa o una proteína, si lleva una carne o legumbre que pesa al menos el 30% (arroz con pollo) o si su nombre
 * lo dice ("Milanesas de berenjena", "Tarta de zapallito"), salvo que sea dulce. Las papas, el puré, el arroz blanco, los
 * bastones de queso o las tostadas no: acompañan.
 */
export function esPlatoPrincipal(p: Plato): boolean {
  if (p.atributos.grupo === 'proteina') return true
  const id = principalDe(p.ingredientes)
  const grupo = (x: string) => alimentoPorId(x)?.grupo
  const esCarneOLegumbre = (x: string) => grupo(x) === 'proteina' && !PROTEINA_SUMADA_EN_LAS_DOS.has(familia(x)) && !PROTEINA_SUMADA_EN_LAS_DOS.has(x)
  if (id && (PASTAS_Y_MASAS.has(familia(id)) || esCarneOLegumbre(id))) return true
  const total = p.ingredientes.reduce((t, i) => t + i.gramos, 0)
  if (total > 0 && p.ingredientes.some((i) => esCarneOLegumbre(i.alimentoId) && i.gramos / total >= PROTEINA_PARA_PLATO)) return true
  return p.atributos.sabor !== 'dulce' && NOMBRE_DE_PRINCIPAL.test(p.nombre)
}

/**
 * v5.10 · El "cereal o pan" del desayuno y la merienda: pan, tostadas, galletitas o un cereal (avena, copos), por lo
 * principal de la preparación. Nunca un plato principal: la pizza y la pasta no son el pan del desayuno.
 */
export function esCerealOPan(p: Plato): boolean {
  const id = principalDe(p.ingredientes)
  return Boolean(id && DE_DESAYUNO.has(familia(id))) && !esPlatoPrincipal(p)
}
