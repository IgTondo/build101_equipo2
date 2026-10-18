// v5.10 · En qué comidas va cada alimento y qué es un plato principal. Sin esto la receta creativa armaba combinaciones
// que no existen: cambiando el principal, de sus tostadas salían ravioles para el desayuno (los dos son cereal_almidon y
// pasan el chequeo de grupo), y la comida completa sumaba su pizza al lado de los ravioles nuevos en la cena.
//
// momentosDeAlimento: las comidas de las preparaciones de data/preparaciones.json donde ese alimento es el principal (el
// de más gramos): la leche, en desayuno, merienda y colación; la papa, en almuerzo y cena. Para lo que no es el principal
// de ninguna, un default por grupo y familia:
// - frutas y lácteos: cualquier comida (una pera, un yogur o un queso van a toda hora)
// - panes, galletitas, cereales y avena: desayuno y merienda, además de las otras (el pan acompaña también el almuerzo)
// - el huevo, el jamón y lo que se unta (pasta de maní, hummus): cualquier comida (huevo revuelto, tostado de jamón)
// - pastas, pizza, el resto de los cereales y almidones (arroz, papa, polenta…), carnes, pescados, legumbres y verduras:
//   almuerzo y cena
// - el grupo otro (aceites, condimentos, dulces, frutos secos): cualquier comida; nunca son el plato y eso lo dicen
//   ACOMPANAMIENTOS y GOLOSINAS_Y_ULTRAPROCESADOS (server/grafo/conocimiento.ts)
// Sumado a otro plato (vaEnLaComida(…, 'sumado')) vale también el default: el queso es el principal solo de los
// bastones de queso (almuerzo y cena), pero sumado a sus tostadas va en el desayuno.
//
// esPlatoPrincipal: pastas, pizza, milanesas, nuggets, hamburguesas, tartas, guisos y carnes. Una comida lleva uno
// solo, y el cereal o pan del desayuno es pan, tostadas, galletitas o un cereal, nunca uno de estos.
import { MOMENTO, type Grupo, type Momento, type PreparacionCatalogo } from '../../shared/contratos.js'
import { principal } from '../aprendizaje/cadena.js'
import { preparacionesCatalogo } from '../datos/catalogos.js'
import { alimentoPorId } from './catalogo.js'

const TODAS: readonly Momento[] = MOMENTO
const ALMUERZO_Y_CENA: readonly Momento[] = ['almuerzo', 'cena']

const familia = (id: string): string => id.split('_')[0]!

/** Panes, galletitas, cereales y avena (por familia del id): también desayuno y merienda. */
const DE_DESAYUNO = new Set(['pan', 'galletitas', 'galletas', 'grisines', 'tostadas', 'cereal', 'copos', 'granola', 'avena', 'salvado', 'medialuna', 'torta', 'pororo'])
/** Rellenos y harinas: no son el principal de nada, van donde vaya su plato. */
const RELLENOS = new Set(['harina', 'maicena', 'semola'])
/** Proteínas que no son un plato de almuerzo: el huevo, el jamón y lo que se unta. */
const PROTEINA_DE_TODA_HORA = new Set(['huevo', 'jamon', 'pasta_mani', 'hummus'])
/** Pastas y masas (por familia del id): con su salsa o su relleno, son el plato. */
const PASTAS_Y_MASAS = new Set(['fideos', 'ravioles', 'noquis', 'sorrentinos', 'canelones', 'lasagna', 'prepizza', 'pizza', 'tapa', 'masa'])
/** Las proteínas que son plato principal aunque pesen menos que su guarnición (arroz con pollo: 80 g de arroz y 50 de pollo). */
const PROTEINA_PARA_PLATO = 0.3

let memo: { de: ReadonlyMap<string, PreparacionCatalogo>; momentos: Map<string, Set<Momento>> } | null = null

/** Las comidas de las preparaciones del catálogo donde cada alimento es el principal (se rearma si cambia el catálogo). */
function comoPrincipal(): Map<string, Set<Momento>> {
  const catalogo = preparacionesCatalogo()
  if (memo?.de === catalogo) return memo.momentos
  const momentos = new Map<string, Set<Momento>>()
  for (const p of catalogo.values()) {
    const id = principal(p.ingredientes)
    if (!id || !p.momentos?.length) continue
    const m = momentos.get(id) ?? new Set<Momento>()
    for (const x of p.momentos) m.add(x)
    momentos.set(id, m)
  }
  memo = { de: catalogo, momentos }
  return momentos
}

/** El default por grupo y familia, para lo que no es el principal de ninguna preparación (ver arriba). */
export function momentosPorGrupo(alimentoId: string, grupo: Grupo | undefined = alimentoPorId(alimentoId)?.grupo): readonly Momento[] {
  const f = familia(alimentoId)
  if (grupo === 'fruta' || grupo === 'lacteo' || grupo === 'otro' || !grupo) return TODAS
  if (grupo === 'cereal_almidon') return DE_DESAYUNO.has(f) || RELLENOS.has(f) ? TODAS : ALMUERZO_Y_CENA
  if (grupo === 'proteina') return PROTEINA_DE_TODA_HORA.has(f) || PROTEINA_DE_TODA_HORA.has(alimentoId) ? TODAS : ALMUERZO_Y_CENA
  return ALMUERZO_Y_CENA
}

/** En qué comidas va como lo principal de un plato: las de sus preparaciones del catálogo o, si no hay, el default. */
export function momentosDeAlimento(alimentoId: string, grupo?: Grupo): Momento[] {
  const delCatalogo = comoPrincipal().get(alimentoId)
  return delCatalogo ? MOMENTO.filter((m) => delCatalogo.has(m)) : [...momentosPorGrupo(alimentoId, grupo)]
}

/**
 * Si va en esa comida: como el principal del plato (el de más gramos) o sumado a otro (ahí también vale su default:
 * queso sumado a sus tostadas, sí; lentejas sumadas a su yogur, no). Sin comida, va.
 */
export function vaEnLaComida(alimentoId: string, momento: Momento | undefined, como: 'principal' | 'sumado' = 'principal', grupo?: Grupo): boolean {
  if (!momento) return true
  if (momentosDeAlimento(alimentoId, grupo).includes(momento)) return true
  return como === 'sumado' && momentosPorGrupo(alimentoId, grupo).includes(momento)
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
export function esPlatoPrincipal(p: Pick<PreparacionCatalogo, 'nombre' | 'atributos' | 'ingredientes'>): boolean {
  if (p.atributos.grupo === 'proteina') return true
  const id = principal(p.ingredientes)
  const grupo = (x: string) => alimentoPorId(x)?.grupo
  const esCarneOLegumbre = (x: string) => grupo(x) === 'proteina' && !PROTEINA_DE_TODA_HORA.has(familia(x)) && !PROTEINA_DE_TODA_HORA.has(x)
  if (id && (PASTAS_Y_MASAS.has(familia(id)) || esCarneOLegumbre(id))) return true
  const total = p.ingredientes.reduce((t, i) => t + i.gramos, 0)
  if (total > 0 && p.ingredientes.some((i) => esCarneOLegumbre(i.alimentoId) && i.gramos / total >= PROTEINA_PARA_PLATO)) return true
  return p.atributos.sabor !== 'dulce' && NOMBRE_DE_PRINCIPAL.test(p.nombre)
}

/**
 * v5.10 · El "cereal o pan" del desayuno y la merienda: pan, tostadas, galletitas o un cereal (avena, copos), por lo
 * principal de la preparación. Nunca un plato principal: la pizza y la pasta no son el pan del desayuno.
 */
export function esCerealOPan(p: Pick<PreparacionCatalogo, 'nombre' | 'atributos' | 'ingredientes'>): boolean {
  const id = principal(p.ingredientes)
  return Boolean(id && DE_DESAYUNO.has(familia(id))) && !esPlatoPrincipal(p)
}
