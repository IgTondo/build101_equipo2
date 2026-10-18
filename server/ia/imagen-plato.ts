// A10 · Imagen de cómo servir la receta (PLAN.md §7): Nano Banana 2.1, con FLUX.1 schnell de respaldo
// (generarImagen, server/ia/imagen.ts).
// El prompt se arma por código, en inglés, a partir de datos estructurados, para que la imagen sea fiel a la receta:
//  - cada comida sale del catálogo visual (prompts/imagen-plato.ts), escrito a mano con su forma exacta, corte, tamaño,
//    color y cocción ("long thin sticks shaped exactly like French fries", no "cut into sticks", que salía en cubos);
//    lo que no está ahí se arma con sus atributos (los del catálogo o, para su alimento seguro, los que se mantienen);
//    v5.4 · el plato inventado de la receta creativa (receta.plato, fuera del catálogo) trae su descripción en inglés
//    del LLM: se limpia, se acorta y se le agrega la forma exacta (FORMA_EN) si no la dice;
//  - su alimento seguro en porción normal, a la izquierda; el nuevo en porción chica, a la derecha, con la cantidad
//    que dice la presentación de la receta ("2 bastones", "media tostada") o una por defecto;
//  - las bebidas van en vaso y el yogur en un bol, nunca "en el plato";
//  - plato playo blanco (hondo o con divisiones si una regla del chico lo pide), cenital, separados, nada más.
// v5.7 · Si la receta trae la comida entera (receta.platoCompleto, 2 o más componentes) se dibuja LA COMIDA: cada
// componente con su visual (catálogo visual → el plato inventado → sus atributos → su nombre y grupo), todos en porción
// normal (lo nuevo ya es un plato de verdad, no un bocado de exposición: cantidadEnPresentacion no se usa, porque la
// presentación habla de toda la comida y sus números pueden ser de otro componente). Lo nuevo va en el lugar principal
// (la sección grande de abajo o la mitad izquierda); con 3 o más en el plato, plato con divisiones (salvo que una regla
// pida hondo o rechace las divisiones); las bebidas en vaso a la derecha del plato y los boles a la izquierda.
// Sin platoCompleto (recetas del catálogo, pedidos viejos), exactamente lo de antes.
// Siempre es ilustrativa.
import { z } from 'zod'
import {
  CAMBIO, COCCION, COLOR, FORMA, GRUPO, PRESENTACION, ROL_PLATO, SABOR, TEMPERATURA, TEXTURA,
  type Atributos, type Coccion, type Color, type Forma, type Grupo, type ImagenPlatoRes, type PlatoNuevo, type PreparacionCatalogo, type Regla, type Textura,
} from '../../shared/contratos.js'
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

// v5.4 · Lo que escribe el LLM va a un prompt de imagen: una línea, sin comillas ni caracteres raros, y corto.
export function limpiarTexto(texto: string, max: number): string {
  return texto
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')   // "crème" → "creme"
    .replace(/["`´“”«»]/g, '')
    .replace(/[^\x20-\x7e]/g, ' ')                    // saltos de línea, tabs y lo que no sea ASCII imprimible
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
    .trim()
}
const MAX_IMAGEN = { uno: 80, varios: 80, aspecto: 400 } as const
const textoImagen = (max: number) => z.string().transform((t) => limpiarTexto(t, max)).pipe(z.string().min(1))

const esquemaPlatoNuevo = z.object({
  atributos: z.object({
    textura: z.enum(TEXTURA), forma: z.enum(FORMA), color: z.enum(COLOR), sabor: z.enum(SABOR),
    temperatura: z.enum(TEMPERATURA), presentacion: z.enum(PRESENTACION), grupo: z.enum(GRUPO), coccion: z.enum(COCCION),
  }),
  imagen: z.object({ uno: textoImagen(MAX_IMAGEN.uno), varios: textoImagen(MAX_IMAGEN.varios), aspecto: textoImagen(MAX_IMAGEN.aspecto) }),
})

// v5.7 · La comida entera: de cada componente, lo que usa la imagen (aporte y cubreDelDia se ignoran).
const esquemaComponente = z.object({
  rol: z.enum(ROL_PLATO),
  preparacionId: z.string().trim().min(1).max(80),
  nombre: textoImagen(60),   // va al prompt si no está en el catálogo: sin tildes ni comillas
  nuevo: z.boolean(),
  gramos: z.number(),
  grupo: z.enum(GRUPO),
})
const esquemaPlatoCompleto = z.object({ componentes: z.array(esquemaComponente).max(5) })

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
    plato: esquemaPlatoNuevo.optional(),   // v5.4 · solo en la receta creativa
    platoCompleto: esquemaPlatoCompleto.optional(),   // v5.7 · solo en la receta creativa
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
  const normal = a.forma ? NORMAL_POR_FORMA[a.forma] : 0
  return { uno: que, varios: normal > 1 ? `pieces of ${que}` : que, aspecto, normal, recipiente: recipientePorAtributos(a) }
}

/** Las bebidas (enteras y cremosas) van en vaso; el puré o los granos fríos que se comen como vienen (yogur), en un bol. */
function recipientePorAtributos(a: Partial<Atributos>): Recipiente {
  if (a.forma === 'entero' && a.textura === 'cremoso') return 'vaso'
  return (a.forma === 'pure' || a.forma === 'granos') && a.temperatura === 'frio' && a.coccion === 'listo' ? 'bol' : 'plato'
}

// Si la descripción del LLM ya dice la forma, no se repite.
const DICE_LA_FORMA: Record<Forma, RegExp> = {
  baston: /french fr/i, redondo: /round/i, plano: /\bflat\b/i, trozos: /chunk|bite-size/i, pure: /puree|mash/i, granos: /grain/i, entero: /./,
}

/** v5.4 · El plato inventado de la receta creativa: la descripción del LLM, con la forma exacta que FLUX respeta. */
export function visualDelPlato({ atributos: a, imagen }: PlatoNuevo): Visual {
  const uno = limpiarTexto(imagen.uno, MAX_IMAGEN.uno)
  const varios = limpiarTexto(imagen.varios, MAX_IMAGEN.varios) || uno
  const descripcion = limpiarTexto(imagen.aspecto, MAX_IMAGEN.aspecto)
  const forma = FORMA_EN[a.forma] && !DICE_LA_FORMA[a.forma].test(descripcion) ? FORMA_EN[a.forma] : ''
  const aspecto = [descripcion, forma].filter(Boolean).join(', ') || uno
  return { uno, varios, aspecto, normal: NORMAL_POR_FORMA[a.forma], recipiente: recipientePorAtributos(a) }
}

/** "forma=baston" → { forma: 'baston' }: lo que comparten su alimento seguro y el nuevo (para el que no está en el catálogo). */
function atributosQueSeMantienen(seMantiene: string[] = [], nuevo: Partial<Atributos> | undefined): Partial<Atributos> {
  const a: Record<string, string> = {}
  for (const s of seMantiene) {
    const [k, v] = s.split('=')
    if (k && v) a[k] = v
  }
  // Sin seMantiene, lo del nuevo menos lo que cambió es lo mejor que hay.
  if (!seMantiene.length && nuevo) Object.assign(a, nuevo)
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

/** Los atributos del nuevo: los del catálogo o, si no está (receta creativa), los del plato inventado. */
function atributosDelNuevo({ receta }: PedidoImagenPlato, preparacion: BuscarPreparacion): Partial<Atributos> | undefined {
  return preparacion(receta.preparacionBaseId)?.atributos ?? receta.plato?.atributos
}

/** Cómo se ve su alimento seguro y el nuevo. Exportada para los tests y el script de prueba. */
export function visuales(req: PedidoImagenPlato, preparacion: BuscarPreparacion = preparacionCatalogo): { seguro: Visual; nuevo: Visual } {
  const { receta } = req
  const prepNuevo = preparacion(receta.preparacionBaseId)
  const prepSeguro = preparacion(receta.desde.preparacionId)
  // El nuevo: el catálogo visual, el plato inventado (receta creativa) o sus atributos.
  const nuevo = VISUAL[receta.preparacionBaseId]
    ?? (!prepNuevo && receta.plato ? visualDelPlato(receta.plato) : undefined)
    ?? visualPorAtributos(prepNuevo
      ? { nombre: prepNuevo.nombre, atributos: prepNuevo.atributos, ingredientes: prepNuevo.ingredientes }
      : { nombre: receta.nombre, atributos: atributosQueSeMantienen(receta.seMantiene, undefined), ingredientes: receta.ingredientes })
  const seguro = VISUAL[receta.desde.preparacionId] ?? visualPorAtributos(prepSeguro
    ? { nombre: prepSeguro.nombre, atributos: prepSeguro.atributos, ingredientes: prepSeguro.ingredientes }
    : { nombre: receta.desde.nombre, atributos: atributosQueSeMantienen(receta.seMantiene, atributosDelNuevo(req, preparacion)), ingredientes: [] })
  return { seguro, nuevo }
}

// ---------- v5.7 · La comida entera ----------
// Un componente que no está en el catálogo (ni es lo nuevo): su nombre (sin tildes) y su grupo.
const GRUPO_EN: Record<Grupo, string> = {
  cereal_almidon: 'a simple starchy side', proteina: 'a simple home-cooked protein', verdura: 'simple cooked vegetables',
  fruta: 'simple fresh fruit', lacteo: 'a simple dairy food', otro: 'a simple homemade food',
}
const NUMERO_EN = ['no', 'one', 'two', 'three', 'four', 'five']

interface EnLaComida { id: string; visual: Visual; frase: string; nuevo: boolean }

/** Cada componente con su visual y su frase, lo nuevo primero. */
function componentesDeLaComida(req: PedidoImagenPlato, preparacion: BuscarPreparacion): EnLaComida[] {
  const { receta } = req
  const lista = receta.platoCompleto?.componentes ?? []
  const iNuevo = Math.max(0, lista.findIndex((c) => c.nuevo || c.preparacionId === receta.preparacionBaseId))
  const comida = lista.map((c, i): EnLaComida => {
    const prep = preparacion(c.preparacionId)
    const v = i === iNuevo ? visuales(req, preparacion).nuevo
      : VISUAL[c.preparacionId] ?? (prep ? visualPorAtributos({ nombre: prep.nombre, atributos: prep.atributos, ingredientes: prep.ingredientes }) : undefined)
    // Una bebida va siempre en vaso, aunque no se sepa cómo es.
    const visual = v ? (c.rol === 'bebida' ? { ...v, recipiente: 'vaso' as const } : v)
      : { uno: c.nombre, varios: c.nombre, aspecto: GRUPO_EN[c.grupo], normal: 0, recipiente: c.rol === 'bebida' ? 'vaso' as const : 'plato' as const }
    const frase = v || visual.recipiente !== 'plato' ? porcionNormal(visual) : `a normal portion of ${c.nombre} (${GRUPO_EN[c.grupo]})`
    return { id: c.preparacionId, visual, frase, nuevo: i === iNuevo }
  })
  return [...comida.filter((c) => c.nuevo), ...comida.filter((c) => !c.nuevo)]
}

// Dónde va cada cosa en el plato: lo nuevo, el primero, en el lugar principal.
const ARRIBA: Record<number, string[]> = {
  1: ['top'], 2: ['top-left', 'top-right'], 3: ['top-left', 'top-center', 'top-right'], 4: ['top-left', 'top-center-left', 'top-center-right', 'top-right'],
}
function lugaresEnElPlato(n: number, dividido: boolean): { plato: string; lugares: string[] } {
  if (n <= 1) return { plato: '', lugares: [dividido ? 'In the main section of the plate' : 'In the center of the plate'] }
  if (n === 2) return dividido
    ? { plato: PLATO_EN.con_divisiones, lugares: ['In the left section of the plate', 'In the right section of the plate'] }
    : { plato: '', lugares: ['On the left half of the plate', 'On the right half of the plate'] }
  const arriba = ARRIBA[n - 1] ?? ARRIBA[4]
  return dividido
    ? { plato: `one plain white divided plate with ${NUMERO_EN[n]} separate sections: a large section across the bottom half and ${NUMERO_EN[n - 1]} smaller sections across the top`,
        lugares: ['In the large bottom section', ...arriba.map((l) => `In the ${l} section`)] }
    : { plato: '', lugares: ['On the bottom half of the plate', ...arriba.map((l) => `On the ${l} part of the plate`)] }
}

// Sin plato (todo en vasos y boles): de izquierda a derecha.
const EN_FILA: Record<number, string[]> = {
  1: ['In the center'], 2: ['On the left', 'On the right'], 3: ['On the left', 'In the center', 'On the right'],
  4: ['On the far left', 'In the center-left', 'In the center-right', 'On the far right'],
  5: ['On the far left', 'On the left', 'In the center', 'On the right', 'On the far right'],
}

const lista = (frases: string[]) => frases.length <= 1 ? frases.join('') : `${frases.slice(0, -1).join('; ')}; and ${frases[frases.length - 1]}`

function promptComidaCompleta(req: PedidoImagenPlato, preparacion: BuscarPreparacion): string {
  const { receta, reglas } = req
  const comida = componentesDeLaComida(req, preparacion)
  const enPlato = comida.filter((c) => c.visual.recipiente === 'plato')
  const fuera = comida.filter((c) => c.visual.recipiente !== 'plato')
  // La regla del chico manda; si no dice nada, con 3 o más en el plato, uno con divisiones (se lee mejor).
  const porRegla = platoPara(reglas)
  const plato: PlatoImagen = porRegla !== 'playo' ? porRegla
    : enPlato.length >= 3 && !pide(reglas, 'rechaza', 'plato', 'con_divisiones') ? 'con_divisiones' : 'playo'
  const dividido = plato === 'con_divisiones'
  const { plato: platoDividido, lugares } = lugaresEnElPlato(enPlato.length, dividido)
  const platoEn = platoDividido || PLATO_EN[plato]
  const queNoSeToquen = pide(reglas, 'rechaza', 'distribucion', 'tocandose') || pide(reglas, 'requiere', 'distribucion', 'separados')
  const conSalsa = [atributosDelNuevo(req, preparacion), ...comida.filter((c) => !c.nuevo).map((c) => preparacion(c.id)?.atributos)]
    .some((a) => a?.presentacion === 'con_salsa')
  // Solo si su alimento seguro es parte de la comida y los dos son piezas enteras (bastones, nuggets).
  const nuevo = comida[0]
  const seguro = comida.find((c) => !c.nuevo && c.id === receta.desde.preparacionId)
  const mismaForma = Boolean(seguro && receta.seMantiene?.some((s) => s.startsWith('forma=')))
    && [nuevo, seguro].every((c) => c && c.visual.normal >= 4 && c.visual.recipiente === 'plato')

  const hayVaso = fuera.some((c) => c.visual.recipiente === 'vaso')
  const donde = enPlato.length ? `served on ${platoEn}, on a light wooden table` : 'on a light wooden table'
  const escena: string[] = [hayVaso
    ? `Realistic food photograph taken from a high angle, about 45 degrees, of a complete home-cooked meal ${donde}.`
    : `Realistic overhead food photograph taken from directly above, a 90-degree top-down view of a complete home-cooked meal ${donde}.`]
  if (enPlato.length) {
    // Lo nuevo fuera del plato (un bol, un vaso) va adelante, en el centro; los boles a la izquierda y los vasos a la derecha.
    if (nuevo.visual.recipiente !== 'plato') escena.push(`In front of the plate, closest to the camera: ${nuevo.frase}.`)
    enPlato.forEach((c, i) => escena.push(`${lugares[i]}: ${c.frase}.`))
    const boles = fuera.filter((c) => c !== nuevo && c.visual.recipiente === 'bol')
    const vasos = fuera.filter((c) => c !== nuevo && c.visual.recipiente === 'vaso')
    if (boles.length) escena.push(`On the table to the left of the plate: ${lista(boles.map((c) => c.frase))}.`)
    if (vasos.length) escena.push(`On the table to the right of the plate: ${lista(vasos.map((c) => c.frase))}.`)
    if (enPlato.length >= 2) escena.push(`Each food sits apart ${dividido ? 'in its own section' : 'with a wide strip of empty white plate between them'}`
      + `${queNoSeToquen ? ', with plenty of space' : ''}: no food touches another.`)
    const nVasos = fuera.filter((c) => c.visual.recipiente === 'vaso').length
    const recipientes = [nVasos && (nVasos > 1 ? 'glasses' : 'glass'), fuera.length - nVasos && (fuera.length - nVasos > 1 ? 'bowls' : 'bowl')].filter(Boolean)
    if (fuera.length) escena.push(`The ${recipientes.join(' and the ')} ${fuera.length === 1 ? 'stands' : 'stand'} on the table, next to the plate, not on it.`)
  } else {
    const fila = EN_FILA[comida.length] ?? EN_FILA[5]
    comida.forEach((c, i) => escena.push(`${fila[i]}: ${c.frase}.`))
    escena.push('They are clearly separate and do not touch.')
  }
  return [
    ...escena,
    mismaForma && seguro ? `The ${nuevo.visual.varios} have the same shape and size as the ${seguro.visual.varios}.` : '',
    `Only these ${NUMERO_EN[comida.length] ?? comida.length} foods${conSalsa ? '' : ', plain, with no sauce or garnish on top'}; nothing else in the picture: no cutlery, no napkin, no text, no people, no hands.`,
    'Soft natural daylight, sharp focus, true-to-life colors and textures.',
  ].filter(Boolean).join(' ')
}

export function promptImagenPlato(req: PedidoImagenPlato, preparacion: BuscarPreparacion = preparacionCatalogo): string {
  const { receta, reglas } = req
  if ((receta.platoCompleto?.componentes.length ?? 0) >= 2) return promptComidaCompleta(req, preparacion)   // v5.7
  const { seguro, nuevo } = visuales(req, preparacion)
  const izquierda = porcionNormal(seguro)
  const derecha = porcionChica(nuevo, cantidadEnPresentacion(receta.presentacion))
  const plato = platoPara(reglas)
  const queNoSeToquen = pide(reglas, 'rechaza', 'distribucion', 'tocandose') || pide(reglas, 'requiere', 'distribucion', 'separados')
  // Solo con piezas enteras (bastones, nuggets): con media tostada o un trozo de milanesa se contradiría.
  const mismaForma = Boolean(receta.seMantiene?.some((s) => s.startsWith('forma=')))
    && seguro.normal >= 4 && nuevo.normal >= 4 && seguro.recipiente === 'plato' && nuevo.recipiente === 'plato'
  const conSalsa = [atributosDelNuevo(req, preparacion), preparacion(receta.desde.preparacionId)?.atributos]
    .some((a) => a?.presentacion === 'con_salsa')

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
