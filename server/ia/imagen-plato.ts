// A10 · Imagen de cómo servir la receta (PLAN.md §7): Nano Banana 2.1, con FLUX.1 schnell de respaldo
// (generarImagen, server/ia/imagen.ts).
// El prompt se arma por código, en inglés, a partir de datos estructurados, para que la imagen sea fiel a la receta:
//  - cada comida sale del catálogo visual (prompts/imagen-plato.ts), escrito a mano con su forma exacta, corte, tamaño,
//    color y cocción ("long thin sticks shaped exactly like French fries", no "cut into sticks", que salía en cubos);
//    lo que no está ahí se arma con sus atributos (los del catálogo o, para su alimento seguro, los que se mantienen);
//  - su alimento seguro en porción normal, a la izquierda; el nuevo en porción chica, a la derecha, con la cantidad
//    que dice la presentación de la receta ("2 bastones", "media tostada") o una por defecto;
//  - las bebidas van en vaso y el yogur en un bol, nunca "en el plato";
//  - plato playo blanco (hondo o con divisiones si una regla del chico lo pide), cenital, separados, nada más.
// Siempre es ilustrativa.
import { z } from 'zod'
import { CAMBIO, type Atributos, type Coccion, type Color, type ImagenPlatoRes, type PreparacionCatalogo, type Regla, type Textura } from '../../shared/contratos.js'
import { ingredientePrincipal } from '../validacion/receta.js'
import { generarImagen } from './imagen.js'
import { FORMA_EN, VISUAL, type Recipiente, type Visual } from './prompts/imagen-plato.js'
import { preparacionCatalogo } from './receta.js'

// ---------- El body de /api/imagen-plato ----------
// Se valida solo la parte de la receta que usa la imagen: un ImagenPlatoReq entero entra tal cual.
const TIPO_CONDICION = ['textura', 'forma', 'color', 'sabor', 'temperatura', 'presentacion', 'grupo', 'coccion', 'distribucion', 'plato'] as const

const esquemaRegla = z.object({
  texto: z.string(),
  condiciones: z.array(z.object({ tipo: z.enum(TIPO_CONDICION), valor: z.string() })),
  efecto: z.enum(['rechaza', 'requiere']),
})

export const esquemaImagenPlatoReq = z.object({
  receta: z.object({
    nombre: z.string().min(1),
    preparacionBaseId: z.string().min(1),
    desde: z.object({ preparacionId: z.string().min(1), nombre: z.string().min(1) }),
    ingredientes: z.array(z.object({ alimentoId: z.string(), nombre: z.string(), gramos: z.number() })),
    // Opcionales para no romper pedidos viejos: la cantidad del nuevo sale de la presentación y, si su alimento seguro
    // no está en el catálogo, su forma sale de lo que se mantiene.
    presentacion: z.string().optional(),
    seMantiene: z.array(z.string()).optional(),
    cambio: z.enum(CAMBIO).optional(),
  }),
  reglas: z.array(esquemaRegla).default([]),
})
export type PedidoImagenPlato = z.infer<typeof esquemaImagenPlatoReq>

// ---------- Sin catálogo visual: con los atributos ----------
const TEXTURA_EN: Record<Textura, string> = { crocante: 'crispy', blando: 'soft', cremoso: 'creamy', masticable: 'chewy', jugoso: 'juicy', mixto: '' }
const COLOR_EN: Record<Color, string> = { blanco: 'white', beige: 'pale golden', amarillo: 'golden', naranja: 'orange', rojo: 'red', verde: 'green', marron: 'brown', mixto: '' }
const COCCION_EN: Record<Coccion, string> = { frito: 'fried', horno: 'oven-baked', hervido: 'boiled', plancha: 'grilled', crudo: 'raw', listo: '' }
const NORMAL_POR_FORMA: Record<Atributos['forma'], number> = { baston: 10, redondo: 5, plano: 1, trozos: 8, pure: 0, granos: 0, entero: 0 }

// Por alimentoId y, si no está, por cada palabra del id ("queso_dambo" → "cheese"). Lo que no está queda como el id.
const INGLES: Record<string, string> = {
  papa: 'potato', boniato: 'sweet potato', zapallo: 'pumpkin', calabaza: 'squash', zanahoria: 'carrot', brocoli: 'broccoli',
  arvejas: 'green peas', chauchas: 'green beans', choclo: 'corn', tomate: 'tomato', espinaca: 'spinach', zucchini: 'zucchini',
  queso: 'cheese', queso_muzzarella: 'mozzarella cheese', queso_rallado: 'grated cheese', leche: 'milk', yogur: 'yogurt',
  manteca: 'butter', pollo: 'chicken', carne: 'beef', carne_vacuna: 'beef', carne_picada: 'ground beef', merluza: 'hake fish',
  pescado: 'fish', atun: 'tuna', huevo: 'egg', lentejas: 'lentils', garbanzos: 'chickpeas', arroz: 'rice', fideos: 'pasta',
  pan: 'bread', pan_blanco: 'white bread', pan_integral: 'whole wheat bread', pan_rallado: 'breadcrumbs', galletitas: 'crackers',
  galletitas_agua: 'water crackers', avena: 'oats', cereal: 'breakfast cereal', harina: 'flour', manzana: 'apple',
  banana: 'banana', naranja: 'orange', frutilla: 'strawberry', frutillas: 'strawberries', kiwi: 'kiwi', pera: 'pear',
  durazno: 'peach', cacao: 'cocoa', morron: 'red bell pepper',
}

function enIngles(alimentoId: string): string {
  if (INGLES[alimentoId]) return INGLES[alimentoId]
  const palabras = alimentoId.split('_').flatMap((p) => (INGLES[p] ? [INGLES[p]] : []))
  return palabras.length ? palabras.join(' ') : alimentoId.replace(/_/g, ' ')
}

/** Lo que se sabe de una comida que no está en el catálogo visual. */
interface SinVisual { nombre: string; atributos: Partial<Atributos>; ingredientes: { alimentoId: string; gramos: number }[] }

export function visualPorAtributos({ nombre, atributos: a, ingredientes }: SinVisual): Visual {
  const principal = ingredientePrincipal(ingredientes)
  const apanado = principal !== 'pan_rallado' && ingredientes.some((i) => i.alimentoId === 'pan_rallado') ? 'breaded' : ''
  const que = principal ? enIngles(principal) : `"${nombre}"`
  const adjetivos = [a.textura && TEXTURA_EN[a.textura], a.color && COLOR_EN[a.color], a.coccion && COCCION_EN[a.coccion], apanado].filter(Boolean)
  const aspecto = [[...adjetivos, que].join(' '), a.forma ? FORMA_EN[a.forma] : ''].filter(Boolean).join(', ')
  const bebida = a.forma === 'entero' && a.textura === 'cremoso'
  const recipiente: Recipiente = bebida ? 'vaso' : (a.forma === 'pure' || a.forma === 'granos') && a.temperatura === 'frio' && a.coccion === 'listo' ? 'bol' : 'plato'
  const normal = a.forma ? NORMAL_POR_FORMA[a.forma] : 0
  return { uno: que, varios: normal > 1 ? `pieces of ${que}` : que, aspecto, normal, recipiente }
}

/** "forma=baston" → { forma: 'baston' }: lo que comparten su alimento seguro y el nuevo (para el que no está en el catálogo). */
function atributosQueSeMantienen(seMantiene: string[] = [], nuevo: PreparacionCatalogo | undefined): Partial<Atributos> {
  const a: Record<string, string> = {}
  for (const s of seMantiene) {
    const [k, v] = s.split('=')
    if (k && v) a[k] = v
  }
  // Sin seMantiene, lo del nuevo menos lo que cambió es lo mejor que hay.
  if (!seMantiene.length && nuevo) Object.assign(a, nuevo.atributos)
  return a as Partial<Atributos>
}

// ---------- Cuántas ----------
const NUMEROS: Record<string, number> = { un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, media: 0.5, medio: 0.5 }
const UNIDADES = 'bastones|bastoncitos|bastón|palitos|palito|nuggets|nugget|croquetas|croqueta|tostadas|tostada|galletitas|galletita|trozos|trozo|trocitos|trocito|pedacitos|pedacito|pedazos|pedazo|rodajas|rodaja|ramitos|ramito|cucharadas|cucharada|cucharaditas|cucharadita|porciones|porción|feta|fetas|milanesa|milanesas|hamburguesa|tiras|tira|bocados|bocado'
const CANTIDAD = new RegExp(`(?:^|[^\\p{L}\\d])(\\d+|${Object.keys(NUMEROS).join('|')})\\s+(?:${UNIDADES})(?![\\p{L}])`, 'giu')

/** La cantidad del nuevo según la presentación de la receta ("2 bastones de queso", "media tostada"), de 0,5 a 5. */
export function cantidadEnPresentacion(presentacion: string | undefined): number | undefined {
  if (!presentacion) return undefined
  for (const m of presentacion.matchAll(CANTIDAD)) {
    const n = NUMEROS[m[1].toLowerCase()] ?? Number(m[1])
    if (n >= 0.5 && n <= 5) return n
  }
  return undefined
}

/** Porción chica por defecto: 2 de lo que se sirve de a muchos, 1 de lo que se sirve de a 2 o 3, medio si es uno solo. */
const chicaPorDefecto = (v: Visual) => (v.normal >= 4 ? 2 : v.normal >= 2 ? 1 : 0.5)

// ---------- Las frases ----------
const porcionNormal = (v: Visual): string => {
  if (v.recipiente === 'vaso') return `a tall clear drinking glass filled with ${v.uno} (${v.aspecto})`
  if (v.recipiente === 'bol') return `a small plain white bowl filled with ${v.uno} (${v.aspecto})`
  if (v.normal > 1) return `a normal portion of ${v.normal >= 6 ? 'about ' : ''}${v.normal} ${v.varios}: ${v.aspecto}`
  if (v.normal === 1) return `one whole ${v.uno}: ${v.aspecto}`
  return `a generous scoop of ${v.uno}: ${v.aspecto}`
}

const porcionChica = (v: Visual, cantidad: number | undefined): string => {
  if (v.recipiente === 'vaso') return `a small short clear glass with only a few sips of ${v.uno} (${v.aspecto})`
  if (v.recipiente === 'bol') return `a very small plain white bowl with just two spoonfuls of ${v.uno} (${v.aspecto})`
  if (v.normal === 0) return `just one small spoonful of ${v.uno}: ${v.aspecto}`
  const n = cantidad ?? chicaPorDefecto(v)
  if (n === 0.5) return `just half of one ${v.uno}, a small piece: ${v.aspecto}`
  if (v.normal === 1 && n === 1) return `just one small piece cut from a ${v.uno}, about a quarter of a whole one: ${v.aspecto}`
  return `exactly ${n === 1 ? `one ${v.uno}` : `${n} ${v.varios}`}, a very small portion: ${v.aspecto}`
}

// ---------- El plato, según las reglas del chico ----------
type PlatoImagen = 'playo' | 'hondo' | 'con_divisiones'

const PLATO_EN: Record<PlatoImagen, string> = {
  playo: 'one plain round white flat plate',
  hondo: 'one plain round white deep plate',
  con_divisiones: 'one plain white divided plate with two separate sections',
}

const pide = (reglas: Regla[], efecto: Regla['efecto'], tipo: string, valor: string) =>
  reglas.some((r) => r.efecto === efecto && r.condiciones.some((c) => c.tipo === tipo && c.valor === valor))

function platoPara(reglas: Regla[]): PlatoImagen {
  if (pide(reglas, 'requiere', 'plato', 'con_divisiones') || pide(reglas, 'rechaza', 'plato', 'playo')) return 'con_divisiones'
  if (pide(reglas, 'requiere', 'plato', 'hondo')) return 'hondo'
  return 'playo'
}

type BuscarPreparacion = (id: string) => PreparacionCatalogo | undefined

/** Cómo se ve su alimento seguro y el nuevo. Exportada para los tests y el script de prueba. */
export function visuales(req: PedidoImagenPlato, preparacion: BuscarPreparacion = preparacionCatalogo): { seguro: Visual; nuevo: Visual } {
  const { receta } = req
  const prepNuevo = preparacion(receta.preparacionBaseId)
  const prepSeguro = preparacion(receta.desde.preparacionId)
  const nuevo = VISUAL[receta.preparacionBaseId] ?? visualPorAtributos(prepNuevo
    ? { nombre: prepNuevo.nombre, atributos: prepNuevo.atributos, ingredientes: prepNuevo.ingredientes }
    : { nombre: receta.nombre, atributos: atributosQueSeMantienen(receta.seMantiene, undefined), ingredientes: receta.ingredientes })
  const seguro = VISUAL[receta.desde.preparacionId] ?? visualPorAtributos(prepSeguro
    ? { nombre: prepSeguro.nombre, atributos: prepSeguro.atributos, ingredientes: prepSeguro.ingredientes }
    : { nombre: receta.desde.nombre, atributos: atributosQueSeMantienen(receta.seMantiene, prepNuevo), ingredientes: [] })
  return { seguro, nuevo }
}

export function promptImagenPlato(req: PedidoImagenPlato, preparacion: BuscarPreparacion = preparacionCatalogo): string {
  const { receta, reglas } = req
  const { seguro, nuevo } = visuales(req, preparacion)
  const izquierda = porcionNormal(seguro)
  const derecha = porcionChica(nuevo, cantidadEnPresentacion(receta.presentacion))
  const plato = platoPara(reglas)
  const queNoSeToquen = pide(reglas, 'rechaza', 'distribucion', 'tocandose') || pide(reglas, 'requiere', 'distribucion', 'separados')
  // Solo con piezas enteras (bastones, nuggets): con media tostada o un trozo de milanesa se contradiría.
  const mismaForma = Boolean(receta.seMantiene?.some((s) => s.startsWith('forma=')))
    && seguro.normal >= 4 && nuevo.normal >= 4 && seguro.recipiente === 'plato' && nuevo.recipiente === 'plato'
  const conSalsa = [receta.preparacionBaseId, receta.desde.preparacionId].some((id) => preparacion(id)?.atributos.presentacion === 'con_salsa')

  const enUnPlato = seguro.recipiente === 'plato' && nuevo.recipiente === 'plato'
  const escena = enUnPlato
    ? [
        `Realistic overhead food photograph taken from directly above, a 90-degree top-down view of ${PLATO_EN[plato]} on a light wooden table.`,
        plato === 'con_divisiones'
          ? `In the left section of the plate: ${izquierda}. In the right section of the plate: ${derecha}.`
          : `On the left half of the plate: ${izquierda}. On the right half of the plate: ${derecha}.`,
        `A wide strip of empty white plate separates the two foods${queNoSeToquen ? ', with plenty of space' : ''}: they do not touch each other.`,
      ]
    : [
        'Realistic food photograph taken from a high angle, about 45 degrees, of a light wooden table.',
        `On the left: ${seguro.recipiente === 'plato' ? `${PLATO_EN[plato]} with ${izquierda}` : izquierda}.`,
        `On the right, set a little apart: ${nuevo.recipiente === 'plato' ? `${PLATO_EN[plato]} with ${derecha}` : derecha}.`,
        'The two are clearly separate and do not touch.',
      ]
  return [
    ...escena,
    mismaForma ? `The ${nuevo.varios} have the same shape and size as the ${seguro.varios}.` : '',
    `Only these two foods${conSalsa ? '' : ', plain, with no sauce or garnish on top'}; nothing else in the picture: no cutlery, no napkin, no text, no people, no hands.`,
    'Soft natural daylight, sharp focus, true-to-life colors and textures.',
  ].filter(Boolean).join(' ')
}

/** Un ImagenPlatoReq entra tal cual: de la receta solo se usa la parte que valida esquemaImagenPlatoReq. */
export async function imagenPlato(req: PedidoImagenPlato): Promise<ImagenPlatoRes> {
  const { imagenBase64, mime } = await generarImagen({ prompt: promptImagenPlato(req) })
  return { imagenBase64, mime, ilustrativa: true }
}
