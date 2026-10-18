// Un glifo (emoji) por alimento, para reconocerlo de un vistazo en listas y tarjetas (componentes/IconoAlimento).
// Es un apoyo visual: el nombre siempre va escrito al lado. Se busca por palabras del nombre, de lo más específico a lo
// más general; si ninguna coincide, el del grupo. Los emoji van solo acá: nunca en títulos, botones ni textos.
import type { Grupo } from '../../shared/contratos'

const POR_PALABRA: [RegExp, string][] = [
  // Primero el plato (la forma que ve el chico), después el ingrediente: "empanada de carne" es una empanada.
  [/arroz con pollo/, '🍛'],
  [/empanada/, '🥟'],
  [/pizza|fugazza/, '🍕'],
  [/tarta|pastel/, '🥧'],
  [/sandwich|sanguche|chivito/, '🥪'],
  [/hamburguesa/, '🍔'],
  [/pancho|salchicha/, '🌭'],
  [/sopa|caldo|guiso|estofado|puchero/, '🍲'],
  [/panqueque|crepe/, '🥞'],
  [/nugget|pollo|suprema/, '🍗'],
  // "asado" solo al principio: "zapallo asado" es zapallo.
  [/milanesa|carne|bife|^asado|churrasco|albondiga/, '🥩'],
  [/pescado|merluza|atun|salmon|surimi/, '🐟'],
  [/huevo|omelet/, '🥚'],
  [/papas? fritas?/, '🍟'],
  [/pure/, '🥔'],
  [/boniato|batata/, '🍠'],
  [/\bpapas?\b/, '🥔'],
  [/arroz|risotto/, '🍚'],
  [/fideo|pasta|tallarin|noqui|raviol|lasana|canelon|macarron|spaghetti|tirabuzon|mostachol/, '🍝'],
  [/galletit|galleta|cookie/, '🍪'],
  [/bizcocho|medialuna|croissant/, '🥐'],
  [/torta|budin|muffin|magdalena|alfajor/, '🧁'],
  [/tostada|\bpan\b|\bpanes\b|pancito/, '🍞'],
  [/cereal|copos|avena|granola/, '🥣'],
  [/dulce de leche|mermelada|\bmiel\b/, '🍯'],
  [/bebible|chocolatada|\bleche\b|licuado/, '🥛'],
  [/yogur/, '🥣'],
  [/queso|muzzarella|ricota/, '🧀'],
  [/manteca/, '🧈'],
  [/helado/, '🍦'],
  [/manzana/, '🍎'],
  [/banana/, '🍌'],
  [/\bperas?\b/, '🍐'],
  [/naranja|mandarina/, '🍊'],
  [/frutilla|fresa/, '🍓'],
  [/\buvas?\b/, '🍇'],
  [/durazno/, '🍑'],
  [/kiwi/, '🥝'],
  [/sandia/, '🍉'],
  [/melon/, '🍈'],
  [/anana|\bpina\b/, '🍍'],
  [/mango/, '🥭'],
  [/limon/, '🍋'],
  [/palta|aguacate/, '🥑'],
  [/zanahoria/, '🥕'],
  [/tomate/, '🍅'],
  [/brocoli|coliflor/, '🥦'],
  [/lechuga|ensalada|espinaca|acelga|rucula/, '🥬'],
  [/choclo|maiz/, '🌽'],
  [/arveja/, '🫛'],
  [/lenteja|poroto|garbanzo/, '🫘'],
  [/pepino|zapallito|zucchini/, '🥒'],
  [/morron|pimiento/, '🫑'],
  [/cebolla/, '🧅'],
  [/jugo/, '🧃'],
  [/chocolate/, '🍫'],
  [/\bmani\b|nuez|nueces|almendra|frutos secos/, '🥜'],
  [/pochoclo|palomitas/, '🍿'],
  [/\bagua\b/, '💧'],
]

const POR_GRUPO: Record<Grupo, string> = {
  cereal_almidon: '🌾', proteina: '🍗', verdura: '🥦', fruta: '🍎', lacteo: '🥛', otro: '🍽️',
}

/** "Puré de Papa" → "pure de papa": minúsculas y sin tildes (la ñ queda como n). */
export function normalizar(texto: string): string {
  return texto.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
}

export function glifoAlimento(nombre: string, grupo?: Grupo | null): string {
  const n = normalizar(nombre)
  for (const [patron, glifo] of POR_PALABRA) if (patron.test(n)) return glifo
  return grupo ? POR_GRUPO[grupo] : '🍽️'
}
