// A10 · Imagen de cómo servir la receta (PLAN.md §7): FLUX.1 schnell en Workers AI (generarImagen, server/ia/imagen.ts).
// Prompt de presentación funcional, en inglés porque FLUX lo entiende mejor: foto cenital y realista, plato playo blanco
// (o con divisiones si una regla del chico lo pide), su alimento seguro en porción normal y el nuevo separado en porción
// chica, sin salsa encima, sin texto, sin personas y sin decoración. Los alimentos se describen con los atributos del
// catálogo (textura, color, cocción, ingrediente principal y forma), no con el nombre en español. Siempre es ilustrativa.
import { z } from 'zod'
import type { Coccion, Color, Forma, ImagenPlatoRes, PreparacionCatalogo, Regla, Textura } from '../../shared/contratos.js'
import { ingredientePrincipal } from '../validacion/receta.js'
import { generarImagen } from './imagen.js'
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
  }),
  reglas: z.array(esquemaRegla).default([]),
})
export type PedidoImagenPlato = z.infer<typeof esquemaImagenPlatoReq>

// ---------- El vocabulario en inglés ----------
const TEXTURA_EN: Record<Textura, string> = { crocante: 'crispy', blando: 'soft', cremoso: 'creamy', masticable: 'chewy', jugoso: 'juicy', mixto: '' }
const COLOR_EN: Record<Color, string> = { blanco: 'white', beige: 'beige', amarillo: 'golden', naranja: 'orange', rojo: 'red', verde: 'green', marron: 'brown', mixto: '' }
const COCCION_EN: Record<Coccion, string> = { frito: 'fried', horno: 'oven-baked', hervido: 'boiled', plancha: 'grilled', crudo: 'fresh', listo: '' }
const FORMA_EN: Record<Forma, string> = {
  baston: 'cut into sticks', redondo: 'in round pieces', plano: 'in flat pieces', trozos: 'in bite-size pieces',
  pure: 'as a smooth puree', granos: 'as loose grains', entero: 'whole',
}
const CONTABLE: Forma[] = ['baston', 'redondo', 'plano', 'trozos', 'entero']

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
  durazno: 'peach', cacao: 'cocoa',
}

function enIngles(alimentoId: string): string {
  if (INGLES[alimentoId]) return INGLES[alimentoId]
  const palabras = alimentoId.split('_').flatMap((p) => (INGLES[p] ? [INGLES[p]] : []))
  return palabras.length ? palabras.join(' ') : alimentoId.replace(/_/g, ' ')
}

interface Comida { frase: string; forma?: Forma }

/** El alimento en inglés, desde el catálogo; sin catálogo, su ingrediente principal o, si no, el nombre tal cual. */
function describir(prep: PreparacionCatalogo | undefined, nombre: string, ingredientes: { alimentoId: string; gramos: number }[] = []): Comida {
  if (!prep) {
    const principal = ingredientePrincipal(ingredientes)
    return { frase: principal ? enIngles(principal) : `"${nombre}"` }
  }
  const { textura, color, coccion, forma } = prep.atributos
  const principal = ingredientePrincipal(prep.ingredientes)
  const apanado = principal !== 'pan_rallado' && prep.ingredientes.some((i) => i.alimentoId === 'pan_rallado') ? 'breaded' : ''
  const adjetivos = [TEXTURA_EN[textura], COLOR_EN[color], coccion ? COCCION_EN[coccion] : '', apanado].filter(Boolean)
  return { frase: `${[...adjetivos, principal ? enIngles(principal) : `"${prep.nombre}"`].join(' ')}, ${FORMA_EN[forma]}`, forma }
}

const porcionNormal = (c: Comida) => `a normal portion of ${c.frase}`
const porcionChica = (c: Comida) => {
  if (!c.forma) return `a very small portion of ${c.frase}`
  return CONTABLE.includes(c.forma) ? `a very small portion, just 2 pieces of ${c.frase}` : `a very small portion, just one spoonful of ${c.frase}`
}

// ---------- El plato, según las reglas del chico ----------
type PlatoImagen = 'playo' | 'hondo' | 'con_divisiones'

const PLATO_EN: Record<PlatoImagen, string> = {
  playo: 'a plain white flat plate',
  hondo: 'a plain white deep plate',
  con_divisiones: 'a plain white divided plate with separate sections',
}

const pide = (reglas: Regla[], efecto: Regla['efecto'], tipo: string, valor: string) =>
  reglas.some((r) => r.efecto === efecto && r.condiciones.some((c) => c.tipo === tipo && c.valor === valor))

function platoPara(reglas: Regla[]): PlatoImagen {
  if (pide(reglas, 'requiere', 'plato', 'con_divisiones') || pide(reglas, 'rechaza', 'plato', 'playo')) return 'con_divisiones'
  if (pide(reglas, 'requiere', 'plato', 'hondo')) return 'hondo'
  return 'playo'
}

export function promptImagenPlato(req: PedidoImagenPlato, preparacion = preparacionCatalogo): string {
  const { receta, reglas } = req
  const plato = platoPara(reglas)
  const seguro = describir(preparacion(receta.desde.preparacionId), receta.desde.nombre)
  const nuevo = describir(preparacion(receta.preparacionBaseId), receta.nombre, receta.ingredientes)
  const queNoSeToquen = pide(reglas, 'rechaza', 'distribucion', 'tocandose') || pide(reglas, 'requiere', 'distribucion', 'separados')
  return [
    `Realistic overhead photo, shot from directly above, of ${PLATO_EN[plato]} on a light wooden table.`,
    plato === 'con_divisiones'
      ? `In the left section: ${porcionNormal(seguro)}. In a separate section on the right: ${porcionChica(nuevo)}.`
      : `On the left side of the plate: ${porcionNormal(seguro)}. On the right side, clearly separated so they do not touch: ${porcionChica(nuevo)}.`,
    queNoSeToquen ? 'There is a wide empty gap between the two foods: they must not touch at all.' : '',
    'No sauce on the food. No other foods on the plate.',
    'No text, no letters, no labels, no people, no hands, no decoration, no garnish, no props.',
    'Soft natural daylight, simple and clean.',
  ].filter(Boolean).join(' ')
}

/** Un ImagenPlatoReq entra tal cual: de la receta solo se usa la parte que valida esquemaImagenPlatoReq. */
export async function imagenPlato(req: PedidoImagenPlato): Promise<ImagenPlatoRes> {
  const { imagenBase64, mime } = await generarImagen({ prompt: promptImagenPlato(req) })
  return { imagenBase64, mime, ilustrativa: true }
}
