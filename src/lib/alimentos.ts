// Un ícono (dibujo vectorial propio, componentes/IconosAlimento) por alimento, para reconocerlo de un vistazo en listas
// y tarjetas (componentes/IconoAlimento). Es un apoyo visual: el nombre siempre va escrito al lado. Se busca por palabras
// del nombre, de lo más específico a lo más general; si ninguna coincide, el del grupo. Acá solo se elige cuál: los
// dibujos viven en el componente.
import type { Grupo } from '../../shared/contratos'

export const ICONOS_ALIMENTO = [
  // Platos y preparaciones
  'empanada', 'pizza', 'tarta', 'sandwich', 'hamburguesa', 'pancho', 'sopa', 'panqueque', 'nuggets', 'milanesa',
  // Proteínas
  'pollo', 'carne', 'pescado', 'huevo',
  // Cereales, panes y papas
  'bastones', 'pure', 'boniato', 'papa', 'arroz', 'fideos', 'galletita', 'medialuna', 'torta', 'pan', 'cereal',
  // Lácteos y dulces
  'frasco', 'licuado', 'leche', 'yogur', 'queso', 'manteca', 'helado', 'chocolate',
  // Frutas
  'manzana', 'banana', 'pera', 'naranja', 'limon', 'frutilla', 'uva', 'durazno', 'kiwi', 'sandia', 'melon', 'anana',
  'palta',
  // Verduras y legumbres
  'zanahoria', 'zapallo', 'tomate', 'brocoli', 'hojas', 'choclo', 'arvejas', 'legumbres', 'pepino', 'morron', 'cebolla',
  // Otros
  'jugo', 'mani', 'pochoclo', 'agua',
  // Uno por grupo, para lo que no se reconoce por el nombre
  'grupo_cereal', 'grupo_proteina', 'grupo_verdura', 'grupo_fruta', 'grupo_lacteo', 'plato',
] as const

export type IconoAlimentoId = (typeof ICONOS_ALIMENTO)[number]

const POR_PALABRA: [RegExp, IconoAlimentoId][] = [
  // Primero el plato (la forma que ve el chico), después el ingrediente: "empanada de carne" es una empanada y
  // "milanesa de pollo" es una milanesa.
  [/arroz con pollo/, 'arroz'],
  [/empanada/, 'empanada'],
  [/pizza|fugazza/, 'pizza'],
  [/tarta|pastel/, 'tarta'],
  [/sandwich|sanguche|chivito/, 'sandwich'],
  [/hamburguesa/, 'hamburguesa'],
  [/pancho|salchicha/, 'pancho'],
  [/sopa|caldo|guiso|estofado|puchero/, 'sopa'],
  [/panqueque|crepe/, 'panqueque'],
  [/nugget/, 'nuggets'],
  [/milanesa/, 'milanesa'],
  [/pollo|suprema/, 'pollo'],
  // "asado" solo al principio: "zapallo asado" es zapallo.
  [/carne|bife|^asado|churrasco|albondiga/, 'carne'],
  [/pescado|merluza|atun|salmon|surimi/, 'pescado'],
  [/huevo|omelet/, 'huevo'],
  // Los bastones son de papa: "bastones de queso" o "de zanahoria" se reconocen por lo que son.
  [/papas? fritas?|papas?\b.*\bbastones?|bastones? de papa/, 'bastones'],
  [/pure/, 'pure'],
  [/boniato|batata/, 'boniato'],
  [/\bpapas?\b/, 'papa'],
  [/arroz|risotto/, 'arroz'],
  [/fideo|pasta|tallarin|noqui|raviol|lasana|canelon|macarron|spaghetti|tirabuzon|mostachol/, 'fideos'],
  [/galletit|galleta|cookie/, 'galletita'],
  [/bizcocho|medialuna|croissant/, 'medialuna'],
  [/torta|budin|muffin|magdalena|alfajor/, 'torta'],
  [/tostada|\bpan\b|\bpanes\b|pancito/, 'pan'],
  [/cereal|copos|avena|granola/, 'cereal'],
  [/dulce de leche|mermelada|\bmiel\b/, 'frasco'],
  [/licuado|batido/, 'licuado'],
  [/bebible|chocolatada|\bleche\b/, 'leche'],
  [/yogur/, 'yogur'],
  [/queso|muzzarella|ricota/, 'queso'],
  [/manteca/, 'manteca'],
  [/helado/, 'helado'],
  [/manzana/, 'manzana'],
  [/banana/, 'banana'],
  [/\bperas?\b/, 'pera'],
  [/naranja|mandarina/, 'naranja'],
  [/frutilla|fresa/, 'frutilla'],
  [/\buvas?\b/, 'uva'],
  [/durazno|mango/, 'durazno'],
  [/kiwi/, 'kiwi'],
  [/sandia/, 'sandia'],
  [/melon/, 'melon'],
  [/anana|\bpina\b/, 'anana'],
  [/limon/, 'limon'],
  [/palta|aguacate/, 'palta'],
  [/zanahoria/, 'zanahoria'],
  // "zapallito" no entra acá (es como un pepino, más abajo).
  [/zapallo\b|calabaza/, 'zapallo'],
  [/tomate/, 'tomate'],
  [/brocoli|coliflor/, 'brocoli'],
  [/lechuga|ensalada|espinaca|acelga|rucula/, 'hojas'],
  [/choclo|maiz|polenta/, 'choclo'],
  [/arveja/, 'arvejas'],
  [/lenteja|poroto|garbanzo/, 'legumbres'],
  [/pepino|zapallito|zucchini/, 'pepino'],
  [/morron|pimiento/, 'morron'],
  [/cebolla/, 'cebolla'],
  [/jugo/, 'jugo'],
  [/chocolate/, 'chocolate'],
  [/\bmani\b|nuez|nueces|almendra|frutos secos/, 'mani'],
  [/pochoclo|palomitas/, 'pochoclo'],
  [/\bagua\b/, 'agua'],
]

const POR_GRUPO: Record<Grupo, IconoAlimentoId> = {
  cereal_almidon: 'grupo_cereal', proteina: 'grupo_proteina', verdura: 'grupo_verdura', fruta: 'grupo_fruta',
  lacteo: 'grupo_lacteo', otro: 'plato',
}

/** "Puré de Papa" → "pure de papa": minúsculas y sin tildes (la ñ queda como n). */
export function normalizar(texto: string): string {
  return texto.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
}

/** Lo que va después de la primera coma es descripción: "Bastones de queso, crocantes como sus papas" es queso. */
export function iconoAlimento(nombre: string, grupo?: Grupo | null): IconoAlimentoId {
  const n = normalizar(nombre).split(',')[0]
  for (const [patron, icono] of POR_PALABRA) if (patron.test(n)) return icono
  return grupo ? POR_GRUPO[grupo] : 'plato'
}
