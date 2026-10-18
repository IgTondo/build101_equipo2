// v5.10 · Platos comunes. Pedido del usuario: "nadie va a comer una pizza con masa de fideos. Pensalo en comidas que se
// podrían vender en una cantina o restaurante común". Salían "Pizzetas crocantes de fideos integrales y muzzarella",
// "Chips de ñoquis crocantes con lino, para el desayuno", "Crackers de panqueque con nueces", "Licuado cremoso de queso
// dambo y banana" o "Milanesa de yogur al horno": a un cambio de lo que come y nutritivos, pero nadie los vende.
//
// problemasDePlatoComun mira el nombre de la receta creativa (ya sin la comparación, limpiarNombre) y pide reintento si:
// (a) su tipo de plato no está en PLATOS_COMUNES para su franja (desayuno, merienda y colación, o almuerzo y cena): un
//     licuado en la cena, una milanesa en el desayuno, unas "hojuelas" a cualquier hora. El tipo es lo primero del
//     nombre (sin "mini", "caseros", "crocantes"…), con las entradas de varias palabras primero: "arroz con leche" es de
//     la merienda y "arroz", del almuerzo. En singular o plural y con diminutivo (milanesitas, tostaditas, pancitos).
//     La fruta va en las dos franjas (de postre en el almuerzo y la cena); los postres de leche, solo en desayuno y
//     merienda, como las franjas estrictas del carril receta-foco;
// (b) una pasta, una masa o un pan es la base o la forma de otro plato: "pizzetas de fideos", "chips de ñoquis",
//     "crackers de panqueque", "crema fría de ravioles". Cuenta cuando va "de" (de qué está hecho), salvo en los platos
//     comunes que lo llevan así (sopa de fideos, budín de pan, tostadas de pan integral) y en lo que reboza (pan
//     rallado, rebozado de galletitas). También una masa o una base de otra cosa ("pizza con base de yogur");
// (c) un alimento con una forma rara: queso, carne, legumbres o una pasta en un licuado; yogur, fruta o un dulce en una
//     milanesa, unos nuggets o una hamburguesa. Solo lo que dice el nombre del plato ("de queso dambo y banana").
// Las listas son generosas: rechazar un plato normal cuesta un reintento (unos 15 s) y el prompt ya pide platos comunes.
import type { Momento } from '../../shared/contratos.js'
import { normalizar } from '../alergias.js'

/** Desayuno, merienda y colación, o almuerzo y cena. Tipo local: el de server/ia/momentos.ts llega del carril receta-foco. */
export type Franja = 'desayuno_merienda' | 'almuerzo_cena'
export const franjaDe = (m: Momento): Franja => (m === 'almuerzo' || m === 'cena' ? 'almuerzo_cena' : 'desayuno_merienda')

/** Las frutas, de postre o de merienda, y lo que va a toda hora (un sándwich, unos huevos revueltos, una tarta). */
const DE_LAS_DOS = [
  'sandwich', 'sanguche', 'huevos', 'revuelto', 'omelette', 'panqueques', 'crepes', 'torta', 'tarta', 'tartaleta', 'budin',
  'queso', 'bastones', 'palitos', 'cubos', 'rodajas', 'gajos', 'brochetas', 'bowl',
  'ensalada de frutas', 'compota', 'fruta', 'banana', 'manzana', 'pera', 'frutillas', 'naranja', 'mandarina', 'durazno',
  'uvas', 'kiwi', 'melon', 'sandia', 'ciruelas', 'frambuesas', 'arandanos', 'mango', 'anana',
]
const DE_ALMUERZO_Y_CENA = [
  // rebozados y carnes
  'milanesa', 'suprema', 'nuggets', 'patitas', 'formitas', 'bocaditos', 'medallones', 'croquetas', 'bunuelos', 'torrejas',
  'albondigas', 'albondiguitas', 'hamburguesa', 'chivito', 'panchos', 'salchichas', 'chorizo', 'pollo', 'pechuga', 'muslos',
  'pata', 'carne', 'bife', 'churrasco', 'asado', 'costillas', 'matambre', 'arrollado', 'bondiola', 'cerdo', 'lomo',
  'peceto', 'carre', 'chuleta', 'entrecot', 'vacio', 'colita', 'cordero', 'pan de carne', 'pan de pollo',
  'pescado', 'merluza', 'filet', 'filete', 'salmon', 'atun', 'brotola', 'corvina', 'lenguado', 'rabas',
  // masas y pastas
  'pizza', 'pizzetas', 'fugazza', 'fugazzeta', 'faina', 'calzone', 'empanadas', 'pascualina', 'quiche', 'tortilla',
  'frittata', 'fritata', 'pastel', 'lasana', 'lasagna', 'canelones', 'ravioles', 'sorrentinos', 'capeletis', 'capelettis',
  'agnolotis', 'tortellini', 'noquis', 'fideos', 'tallarines', 'spaghetti', 'espaguetis', 'tirabuzones', 'monitas',
  'mostacholes', 'penne', 'macarrones', 'pasta', 'polenta', 'risotto', 'arroz', 'wrap', 'tacos', 'burritos',
  'quesadillas', 'fajitas', 'provoleta',
  // guisos y sopas
  'guiso', 'guisado', 'estofado', 'cazuela', 'puchero', 'locro', 'buseca', 'carbonada', 'sopa', 'caldo', 'crema',
  'minestron', 'lentejas', 'porotos', 'garbanzos', 'arvejas', 'hummus', 'falafel',
  // guarniciones y verduras
  'papas', 'pure', 'boniato', 'calabaza', 'zapallo', 'zapallitos', 'berenjenas', 'morrones', 'tomates', 'champinones',
  'hongos', 'brocoli', 'coliflor', 'chauchas', 'espinaca', 'acelga', 'choclo', 'humita', 'verduras', 'vegetales',
  'zanahorias', 'ensalada', 'gratinado', 'gratin', 'souffle', 'timbal', 'salteado', 'wok', 'chips',
]
const DE_DESAYUNO_Y_MERIENDA = [
  // bebidas
  'licuado', 'batido', 'smoothie', 'jugo', 'leche', 'chocolatada', 'cocoa', 'cafe', 'te', 'submarino', 'mate',
  // lácteos, postres y cereales
  'yogur', 'yogurt', 'postre', 'postrecito', 'flan', 'gelatina', 'helado', 'arroz con leche', 'avena', 'porridge', 'granola',
  'cereales', 'copos', 'muesli',
  // panadería
  'tostadas', 'tostado', 'pan', 'medialunas', 'croissant', 'bizcochos', 'galletitas', 'galletas', 'crackers', 'grisines',
  'bizcochuelo', 'muffins', 'magdalenas', 'scones', 'cookies', 'brownie', 'alfajores', 'pastafrola', 'churros', 'waffles',
  'chipa', 'facturas', 'donas', 'rosca', 'barritas', 'pororo',
]

/** v5.10 · Los tipos de plato comunes de cada franja, sin tildes, en singular o en plural (el chequeo acepta los dos). */
export const PLATOS_COMUNES: Readonly<Record<Franja, readonly string[]>> = {
  desayuno_merienda: [...DE_DESAYUNO_Y_MERIENDA, ...DE_LAS_DOS],
  almuerzo_cena: [...DE_ALMUERZO_Y_CENA, ...DE_LAS_DOS],
}

/** Ejemplos para el prompt y para el reintento: los platos que pidió el usuario. */
export const EJEMPLOS_DE_PLATOS: Readonly<Record<Franja, string>> = {
  almuerzo_cena: 'milanesa de pollo o de berenjena, nuggets caseros de pollo, hamburguesa casera de lentejas, tarta de zapallitos, tortilla de papas, empanadas de carne, fideos con salsa bolognesa, arroz con pollo, guiso de lentejas o puré de calabaza',
  desayuno_merienda: 'tostadas con queso, tostado de jamón y queso, yogur con frutilla y granola, licuado de banana con leche, avena con leche y manzana, panqueques con dulce de leche, budín de banana, galletitas de avena o arroz con leche',
}
const DONDE: Readonly<Record<Franja, string>> = {
  almuerzo_cena: 'una cantina escolar, un bar o un restaurante común',
  desayuno_merienda: 'una cafetería o una cantina escolar',
}
const NOMBRE_FRANJA: Readonly<Record<Franja, string>> = { almuerzo_cena: 'almuerzo y cena', desayuno_merienda: 'desayuno y merienda' }
const COMIDA: Readonly<Record<Momento, string>> = {
  desayuno: 'el desayuno', almuerzo: 'el almuerzo', merienda: 'la merienda', cena: 'la cena', colacion: 'la colación',
}
const deLa = (m: Momento) => `de ${COMIDA[m]}`.replace(/^de el /, 'del ')

/**
 * Una pasta, una masa o un pan (como se escribe en el nombre) y los platos comunes que sí la llevan "de": es el plato en
 * sí, nunca la base ni la forma de otro. Las mismas clases que claseDePreparacion (server/grafo/conocimiento.ts).
 */
const PREPARACIONES: readonly { palabra: string; cual: string; en: readonly string[] }[] = [
  ...['fideos', 'tallarines', 'spaghetti', 'espaguetis', 'tirabuzones', 'monitas', 'mostacholes', 'penne', 'macarrones']
    .map((palabra) => ({ palabra, cual: 'los fideos', en: ['sopa', 'caldo', 'ensalada'] })),
  { palabra: 'capeletis', cual: 'los capeletis', en: ['sopa', 'caldo'] },
  { palabra: 'noquis', cual: 'los ñoquis', en: [] },
  { palabra: 'ravioles', cual: 'los ravioles', en: [] },
  { palabra: 'sorrentinos', cual: 'los sorrentinos', en: [] },
  { palabra: 'canelones', cual: 'los canelones', en: [] },
  { palabra: 'lasana', cual: 'la lasaña', en: [] },
  { palabra: 'panqueques', cual: 'los panqueques', en: [] },
  { palabra: 'crepes', cual: 'los crepes', en: [] },
  { palabra: 'waffles', cual: 'los waffles', en: [] },
  { palabra: 'pizza', cual: 'la pizza', en: [] },
  { palabra: 'prepizza', cual: 'la prepizza', en: [] },
  { palabra: 'tortilla', cual: 'la tortilla', en: ['wrap', 'tacos', 'burritos', 'quesadillas', 'fajitas'] },
  { palabra: 'pan', cual: 'el pan', en: ['tostadas', 'tostado', 'sandwich', 'sanguche', 'budin', 'torrejas'] },
  { palabra: 'galletitas', cual: 'las galletitas', en: ['torta', 'tarta', 'postre'] },
  { palabra: 'galletas', cual: 'las galletas', en: ['torta', 'tarta', 'postre'] },
]
/** Lo que reboza o cubre: "rebozado de pan", "costra de galletitas", "migas de pan" no son la base del plato. */
const CUBRE = new Set(['rebozado', 'rebozada', 'rebozados', 'rebozadas', 'rebozo', 'apanado', 'apanados', 'empanado', 'empanados', 'costra', 'cobertura', 'miga', 'migas'])
/** Después de la preparación: pan rallado, galletitas molidas. */
const MOLIDO = new Set(['rallado', 'rallada', 'molido', 'molida', 'molidas', 'molidos', 'trituradas', 'triturado'])
/** La masa o la base de un plato común: de pizza, de tarta, de empanadas, de hojaldre, de harina, de galletitas. */
const BASE = new Set(['masa', 'base', 'tapa', 'tapas'])
const MASA_COMUN = ['pizza', 'tarta', 'tartaleta', 'empanadas', 'pascualina', 'hojaldre', 'harina', 'trigo', 'pan', 'galletitas', 'galletas', 'papa', 'casa']

/** Un alimento con una forma rara: lo que no va "de" en esos platos (el licuado de queso, la milanesa de yogur). */
const RAROS: readonly { platos: readonly string[]; no: readonly string[]; texto: string }[] = [
  {
    platos: ['licuado', 'batido', 'smoothie', 'jugo', 'chocolatada', 'submarino'],
    no: ['queso', 'dambo', 'muzzarella', 'mozzarella', 'muzarella', 'ricota', 'parmesano', 'provolone', 'sardo', 'cheddar',
      'pollo', 'carne', 'jamon', 'atun', 'pescado', 'merluza', 'cerdo', 'huevo', 'lentejas', 'porotos', 'garbanzos', 'arvejas',
      'tofu', 'papa', 'boniato', 'mandioca', 'polenta', 'arroz', ...PREPARACIONES.map((x) => x.palabra)],
    texto: 'un licuado, un batido o un jugo lleva fruta, leche, yogur, avena o cacao',
  },
  {
    platos: ['milanesa', 'suprema', 'nuggets', 'hamburguesa', 'medallones', 'croquetas', 'albondigas', 'patitas', 'formitas', 'bocaditos', 'palitos'],
    no: ['yogur', 'yogurt', 'leche', 'crema', 'manteca', 'dulce', 'banana', 'manzana', 'pera', 'frutillas', 'durazno', 'naranja',
      'chocolate', 'cacao', 'vainilla', 'miel', 'azucar', 'avena', 'granola', ...PREPARACIONES.map((x) => x.palabra)],
    texto: 'una milanesa, unos nuggets o una hamburguesa son de carne, pollo, pescado, legumbres, soja o una verdura',
  },
]

const ARTICULOS = new Set(['el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'su', 'sus', 'mi', 'mis'])
/** Artículos y adjetivos que van antes del tipo: "Mini hamburguesas", "Crocantes bastones", "Las tostadas". */
const ANTES = new Set([
  ...ARTICULOS, 'mini', 'minis', 'doble', 'super', 'tradicional', 'tradicionales', 'crocante', 'crocantes', 'crujiente',
  'crujientes', 'suave', 'suaves',
  ...['rico', 'delicioso', 'sabroso', 'casero', 'clasico', 'tierno', 'dorado', 'nuevo', 'pequeno', 'tibio', 'esponjoso']
    .flatMap((a) => { const r = a.slice(0, -1); return [`${r}o`, `${r}a`, `${r}os`, `${r}as`] }),
])
/** Lo que corta la lista de "de qué está hecho": "de banana con leche", "de pollo al horno". */
const CORTA = new Set(['de', 'del', 'con', 'al', 'a', 'en', 'para', 'sin', 'por', 'sobre', 'tipo', 'estilo', 'que', 'como'])
const CONECTOR = new Set(['de', 'del', 'con', 'y'])

/** Las formas de una palabra para comparar: singular o plural (tostadas, tostada; panes, pan) y sin diminutivo (pancitos, tostaditas). */
function formas(w: string): Set<string> {
  const sinDiminutivo = [w, w.replace(/cit[oa]s?$/, ''), w.replace(/it([oa]s?)$/, '$1')]
  return new Set(sinDiminutivo.flatMap((x) => [x, x.replace(/es$/, ''), x.replace(/s$/, '')]).filter(Boolean))
}
const misma = (a: string, b: string): boolean => {
  const fb = formas(b)
  return [...formas(a)].some((x) => fb.has(x))
}
const enLista = (w: string, lista: readonly string[]): boolean => lista.some((x) => misma(w, x))

/** Un pedazo del nombre (entre comas, paréntesis o rayas) en palabras: normalizadas y como estaban, para los mensajes. */
interface Parte { n: string[]; o: string[] }
function partes(nombre: string): Parte[] {
  return nombre.split(/[,;:()—–]|\s-\s/).map((p) => {
    const o = p.split(/[^\p{L}\p{N}]+/u).filter(Boolean)
    return { o: o.map((w) => w.toLowerCase()), n: o.map(normalizar) }
  }).filter((p) => p.n.length)
}

/** Las entradas de las dos listas en palabras, las más largas primero ("arroz con leche" antes que "arroz"). */
const ENTRADAS = [...new Set([...PLATOS_COMUNES.desayuno_merienda, ...PLATOS_COMUNES.almuerzo_cena])]
  .map((t) => t.split(' '))
  .sort((a, b) => b.length - a.length)

/**
 * El tipo de plato del nombre: la entrada de PLATOS_COMUNES con la que empieza, sin artículos ni adjetivos adelante
 * ("Arroz con leche" → arroz con leche, "Tortilla de papas" → tortilla, "Mini milanesitas" → milanesa), o su primera
 * palabra si no es ninguna (sin `entrada`). `fin`: dónde termina el tipo en la primera parte del nombre.
 */
export function tipoDelNombre(nombre: string): { tipo: string; entrada?: string; fin: number } | undefined {
  const p = partes(nombre)[0]
  if (!p) return undefined
  let i = 0
  while (i < p.n.length - 1 && ANTES.has(p.n[i]!)) i++
  const entrada = ENTRADAS.find((e) => e.every((w, j) => (CONECTOR.has(w) ? p.n[i + j] === w : p.n[i + j] !== undefined && misma(p.n[i + j]!, w))))
  return entrada
    ? { tipo: p.o.slice(i, i + entrada.length).join(' '), entrada: entrada.join(' '), fin: i + entrada.length }
    : { tipo: p.o[i]!, fin: i + 1 }
}

/** De qué está hecho: las palabras después de cada "de" hasta lo que corta la lista (sin artículos), y las dos de antes. */
function listasDe(p: Parte): { desde: number; antes: string[]; palabras: number[] }[] {
  return p.n.flatMap((w, i) => {
    if (w !== 'de' && w !== 'del') return []
    const palabras: number[] = []
    for (let j = i + 1; j < p.n.length && !CORTA.has(p.n[j]!); j++) if (!['y', 'e'].includes(p.n[j]!) && !ARTICULOS.has(p.n[j]!)) palabras.push(j)
    return [{ desde: i, antes: p.n.slice(Math.max(0, i - 2), i), palabras }]
  })
}

/**
 * v5.10 · Por qué el plato no es un plato común para esa comida (vacío si lo es): (a) su tipo no está en la lista de su
 * franja, (b) una pasta, una masa o un pan es la base de otro plato (o la masa es de otra cosa), (c) un alimento con una
 * forma rara. Sin comida, vale cualquiera de las dos franjas. Cada problema dice qué platos sí, para el reintento.
 */
export function problemasDePlatoComun(nombre: string, momento?: Momento): string[] {
  const t = tipoDelNombre(nombre)
  if (!t) return []
  const p: string[] = []
  const franja = momento ? franjaDe(momento) : undefined
  const ejemplos = franja ? EJEMPLOS_DE_PLATOS[franja] : `${EJEMPLOS_DE_PLATOS.almuerzo_cena}; ${EJEMPLOS_DE_PLATOS.desayuno_merienda}`
  // (a) El tipo de plato, en la lista de su franja
  if (!t.entrada) {
    p.push(`«${nombre}» no es un plato común${momento ? ` para ${COMIDA[momento]}` : ''}: tiene que ser uno de los que se venden en ${DONDE[franja ?? 'almuerzo_cena']}, por ejemplo ${ejemplos}. Armalo con un ingrediente de la lista.`)
  } else if (franja && momento && !PLATOS_COMUNES[franja].includes(t.entrada)) {
    const otra: Franja = franja === 'almuerzo_cena' ? 'desayuno_merienda' : 'almuerzo_cena'
    p.push(`«${nombre}» es un plato de ${NOMBRE_FRANJA[otra]}, no ${deLa(momento)}. Para ${COMIDA[momento]}, un plato común de ${DONDE[franja]}: por ejemplo ${ejemplos}.`)
  }
  // (b) Una pasta, una masa o un pan como base de otro plato, o una masa de otra cosa ("base cremosa de yogur")
  const ps = partes(nombre)
  const preparaciones = new Set<string>()
  const bases = new Set<string>()
  ps.forEach((parte, k) => {
    for (const l of listasDe(parte)) {
      if (l.antes.length && CUBRE.has(l.antes.at(-1)!)) continue
      for (const j of l.palabras) {
        const prep = PREPARACIONES.find((x) => misma(parte.n[j]!, x.palabra))
        if (!prep || MOLIDO.has(parte.n[j + 1] ?? '')) continue
        // El plato mismo ("Ñoquis de calabaza") o uno común que la lleva así ("Sopa de fideos", "Tostadas de pan integral")
        const loLleva = (x: string | undefined) => x !== undefined && (misma(x, prep.palabra) || prep.en.some((y) => misma(x, y)))
        if (!(k === 0 && loLleva(t.entrada)) && !loLleva(l.antes.at(-1))) preparaciones.add(prep.cual)
      }
      const b = l.antes.findIndex((w) => BASE.has(w))
      const de = l.palabras[0]
      if (b >= 0 && de !== undefined && !enLista(parte.n[de]!, MASA_COMUN) && !PREPARACIONES.some((x) => misma(parte.n[de]!, x.palabra))) {
        bases.add(`${l.antes.slice(b).join(' ')} de ${parte.o[de]}`)
      }
    }
  })
  for (const cual of preparaciones) {
    const es = /^(el|la) /.test(cual) ? 'es' : 'son'
    p.push(`En «${nombre}», ${cual} ${es} la base o la forma de otro plato: una pasta, una masa o un pan (fideos, ñoquis, ravioles, panqueques, pan, tortilla de trigo) es el plato en sí, servido como siempre (fideos con salsa, ñoquis con tuco, tostadas de pan integral), nunca la masa ni la forma de otro (nada de pizza con masa de fideos ni chips de ñoquis). Proponé un plato común, por ejemplo ${ejemplos}.`)
  }
  for (const b of bases) {
    p.push(`«${nombre}» tiene una base rara (${b}): la masa de un plato común es la de siempre (de pizza, de tarta, de empanadas), no de otro alimento. Proponé un plato común, por ejemplo ${ejemplos}.`)
  }
  // (c) Un alimento con una forma rara, en lo que dice de qué es el plato ("Licuado cremoso de queso dambo y banana")
  const raro = t.entrada ? RAROS.find((r) => enLista(t.entrada!, r.platos)) : undefined
  const primera = ps[0]!
  const suya = raro ? listasDe(primera).find((l) => l.desde >= t.fin && !primera.n.slice(t.fin, l.desde).some((w) => CORTA.has(w))) : undefined
  if (raro && suya) {
    // Cada alimento con las palabras que lo siguen ("queso dambo"); una pasta en el licuado ya la dijo (b)
    const alimentos = suya.palabras.reduce<number[][]>((g, j) => (g.length && g.at(-1)!.at(-1) === j - 1 ? g.at(-1)!.push(j) : g.push([j]), g), [])
    const raros = alimentos
      .filter((g) => g.some((j) => enLista(primera.n[j]!, raro.no) && !(preparaciones.size && PREPARACIONES.some((x) => misma(primera.n[j]!, x.palabra)))))
      .map((g) => g.map((j) => primera.o[j]!).join(' '))
    if (raros.length) p.push(`En «${nombre}» no va ${raros.join(' ni ')}: ${raro.texto}. Usá un ingrediente de la lista que se use de verdad en ese plato, o proponé otro plato común.`)
  }
  return p
}
