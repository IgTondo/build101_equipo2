// A10 · Cómo se ve cada preparación del catálogo, en inglés, para el prompt de la imagen del plato.
// Escrito a mano y probado mirando las imágenes: la forma y el corte van explícitos ("long thin sticks shaped exactly like
// French fries", no "cut into sticks", que FLUX dibujaba como cubos), y las bebidas van en vaso, nunca en el plato.
// Lo que no esté acá se arma con los atributos (imagen-plato.ts → visualPorAtributos).
import type { Forma } from '../../../shared/contratos.js'

export type Recipiente = 'plato' | 'vaso' | 'bol'

export interface Visual {
  /** Una unidad (contables) o el nombre de la comida (no contables): "oven-baked potato fry", "pumpkin puree". */
  uno: string
  /** Varias unidades; en los no contables es igual a `uno`. */
  varios: string
  /** Forma exacta, corte, tamaño, color y cocción. */
  aspecto: string
  /** Unidades en una porción normal; 0 = no contable (puré, granos, bebida). */
  normal: number
  recipiente: Recipiente
}

const FRITAS_PAPA = 'golden, crispy deep-fried potato sticks, long and thin, classic French fries about 8 cm long and 1 cm thick'
const MILANESA = 'a thin, flat, oval cutlet about the size of a palm, coated in golden-brown breadcrumbs, oven-baked and crispy, plain'
const NUGGET = 'small rounded breaded chicken nuggets with a golden, crispy breadcrumb crust'

const contable = (uno: string, varios: string, aspecto: string, normal: number, recipiente: Recipiente = 'plato'): Visual =>
  ({ uno, varios, aspecto, normal, recipiente })
const masa = (nombre: string, aspecto: string, recipiente: Recipiente = 'plato'): Visual =>
  ({ uno: nombre, varios: nombre, aspecto, normal: 0, recipiente })

export const VISUAL: Record<string, Visual> = {
  arroz_con_leche: masa('rice pudding', 'creamy white rice pudding with visible soft rice grains, served cold', 'bol'),
  arroz_con_pollo: masa('chicken and rice', 'yellow rice mixed with small pieces of chicken'),
  arvejas_enteras: masa('boiled green peas', 'loose whole bright green peas, boiled'),
  avena_con_leche: masa('cold oatmeal', 'cold creamy oat porridge, beige', 'bol'),
  banana_pisada: masa('mashed banana', 'pale yellow mashed banana, smooth'),
  bastones_boniato_fritos: contable('sweet potato fry', 'sweet potato fries',
    'bright orange sweet potato cut into long thin sticks shaped exactly like French fries, about 8 cm long and 1 cm thick, fried until crispy', 12),
  bastones_morron_fritos: contable('breaded red bell pepper stick', 'breaded red bell pepper sticks',
    'long thin strips of red bell pepper coated in golden breadcrumbs and fried until crispy, shaped like French fries', 6),
  bastones_queso_fritos: contable('breaded mozzarella stick', 'breaded mozzarella sticks',
    'long rectangular mozzarella cheese sticks, the same length as French fries, coated in golden breadcrumbs and fried until crispy', 6),
  bastones_queso_horno: contable('breaded mozzarella stick', 'breaded mozzarella sticks',
    'long rectangular mozzarella cheese sticks, the same length as French fries, coated in golden breadcrumbs and oven-baked until crispy', 6),
  bastones_zanahoria_horno: contable('oven-roasted carrot stick', 'oven-roasted carrot sticks',
    'orange carrot cut into long thin sticks shaped exactly like French fries, roasted until lightly browned at the edges', 10),
  brocoli_hervido: contable('steamed broccoli floret', 'steamed broccoli florets', 'small bright green broccoli florets, boiled, plain', 6),
  chauchas_hervidas: contable('boiled green bean', 'boiled green beans', 'whole long thin green beans, boiled, plain', 12),
  copos_maiz: masa('corn flakes', 'golden crunchy corn flakes breakfast cereal, dry, without milk', 'bol'),
  croquetas_atun_fritas: contable('tuna croquette', 'tuna croquettes', 'small round croquettes with a golden fried breadcrumb crust', 5),
  fideos_con_salsa: masa('pasta with tomato sauce', 'short pasta covered with red tomato sauce'),
  fideos_manteca_queso: masa('buttered pasta', 'short pasta tossed with butter and a little grated cheese'),
  frutilla_pisada: masa('mashed strawberries', 'red mashed strawberries, smooth'),
  galletitas_agua: contable('square water cracker', 'square water crackers', 'plain pale beige square crackers with small docking holes', 4),
  galletitas_integrales: contable('square whole wheat cracker', 'square whole wheat crackers',
    'brown whole wheat square crackers with small docking holes, the same size as plain water crackers', 4),
  hamburguesa_casera: contable('homemade beef burger patty', 'homemade beef burger patties', 'a round juicy grilled beef patty, without bun', 1),
  jugo_naranja_colado: masa('orange juice', 'smooth strained orange juice without pulp', 'vaso'),
  leche_chocolatada: masa('chocolate milk', 'smooth light brown chocolate milk', 'vaso'),
  leche_chocolatada_fortificada: masa('chocolate milk', 'smooth light brown chocolate milk', 'vaso'),
  lentejas_guisadas: masa('lentil stew', 'brown lentil stew with small carrot pieces', 'bol'),
  licuado_banana_leche: masa('banana milkshake', 'smooth pale yellow banana milkshake', 'vaso'),
  licuado_frutilla_leche: masa('strawberry milkshake', 'smooth pink strawberry milkshake', 'vaso'),
  manzana_bastones: contable('peeled apple stick', 'peeled apple sticks', 'peeled white apple cut into sticks shaped like French fries, raw', 8),
  milanesa_carne_canola: contable('breaded beef cutlet', 'breaded beef cutlets', MILANESA, 1),
  milanesa_carne_con_huevo: contable('breaded beef cutlet', 'breaded beef cutlets', MILANESA, 1),
  milanesa_carne_horno: contable('breaded beef cutlet', 'breaded beef cutlets', MILANESA, 1),
  milanesa_lentejas_horno: contable('breaded lentil cutlet', 'breaded lentil cutlets', MILANESA, 1),
  milanesa_merluza_horno: contable('breaded hake fish fillet', 'breaded hake fish fillets',
    'a thin, flat white fish fillet coated in pale golden breadcrumbs, oven-baked and crispy, plain', 1),
  milanesa_napolitana: contable('breaded beef cutlet with tomato sauce and melted cheese', 'breaded beef cutlets with tomato sauce and melted cheese',
    'a thin breaded beef cutlet topped with red tomato sauce and melted mozzarella', 1),
  nuggets_merluza_fritos: contable('breaded fish nugget', 'breaded fish nuggets', 'small rounded breaded fish nuggets with a golden, crispy breadcrumb crust', 5),
  nuggets_pollo_caseros: contable('chicken nugget', 'chicken nuggets', NUGGET, 5),
  nuggets_pollo_fritos: contable('chicken nugget', 'chicken nuggets', NUGGET, 5),
  nuggets_pollo_horno: contable('chicken nugget', 'chicken nuggets', NUGGET, 5),
  palitos_merluza_fritos: contable('breaded fish stick', 'breaded fish sticks', 'rectangular fish fingers coated in golden breadcrumbs, fried until crispy', 5),
  papa_hervida: contable('boiled potato chunk', 'boiled potato chunks', 'soft pale boiled potato cut into bite-size chunks, plain', 8),
  papas_fritas_baston: contable('French fry', 'French fries', FRITAS_PAPA, 14),
  papas_fritas_canola: contable('French fry', 'French fries', FRITAS_PAPA, 14),
  papas_horno_baston: contable('oven-baked potato fry', 'oven-baked potato fries',
    'potato cut into long thin sticks shaped exactly like French fries, about 8 cm long and 1 cm thick, oven-baked until golden and crispy', 12),
  papas_horno_cubos: contable('oven-baked potato cube', 'oven-baked potato cubes', 'soft potato cut into small cubes, oven-baked and lightly golden', 10),
  pizza_muzzarella: contable('slice of cheese pizza', 'slices of cheese pizza',
    'a triangular slice of thin, crispy pizza topped only with melted mozzarella, without tomato sauce', 1),
  pollo_desmenuzado: masa('shredded chicken', 'soft pale shredded boiled chicken'),
  pollo_plancha: contable('grilled chicken breast fillet', 'grilled chicken breast fillets', 'a flat, juicy grilled chicken breast fillet with light grill marks', 1),
  pure_arvejas: masa('green pea puree', 'smooth bright green pea puree'),
  pure_lentejas: masa('lentil puree', 'smooth brown lentil puree'),
  pure_papa: masa('mashed potatoes', 'smooth creamy pale yellow mashed potatoes'),
  pure_papa_queso: masa('cheesy mashed potatoes', 'smooth creamy mashed potatoes with grated cheese mixed in'),
  pure_zapallo: masa('pumpkin puree', 'smooth bright orange pumpkin puree'),
  tostadas: contable('slice of white bread toast', 'slices of white bread toast',
    'square white sandwich bread toasted golden brown, plain, with nothing on top', 2),
  tostadas_pan_integral: contable('slice of whole wheat toast', 'slices of whole wheat toast',
    'square brown whole wheat sandwich bread, toasted, plain, with nothing on top', 2),
  tostadas_queso: contable('slice of cheese toast', 'slices of cheese toast',
    'square white sandwich bread toast completely covered with melted mozzarella cheese, broiled until bubbly with golden-brown spots', 2),
  yogur_bebible: masa('drinkable vanilla yogurt', 'thick, smooth white drinkable yogurt', 'vaso'),
  yogur_vainilla: masa('vanilla yogurt', 'thick, creamy white vanilla yogurt', 'bol'),
  yogur_vainilla_fortificado: masa('vanilla yogurt', 'thick, creamy white vanilla yogurt', 'bol'),
}

/** La forma con palabras que FLUX respeta (sin catálogo visual, sale de los atributos). */
export const FORMA_EN: Record<Forma, string> = {
  baston: 'cut into long thin sticks shaped exactly like French fries, about 8 cm long and 1 cm thick',
  redondo: 'in small rounded bite-size pieces',
  plano: 'as a thin flat piece',
  trozos: 'cut into bite-size chunks',
  pure: 'as a smooth puree',
  granos: 'as loose small grains',
  entero: '',
}
