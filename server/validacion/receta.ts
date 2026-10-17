// Validación de la receta (PLAN.md §7, "Validación de receta"): código, nunca IA. La usan generarReceta() (A9) y la eval
// de recetas (A12). Cada problema es una frase en español, clara, que vuelve al LLM en el reintento.
// - La cadena: parte de `desde`, cambia exactamente una cosa (la declarada) y lo que dice que se mantiene es cierto.
// - El perfil: ninguna alergia (según data/alimentos.json), ninguna regla `rechaza` y nada mezclado salvo que ya lo acepte.
// - El texto: ningún alérgeno nombrado en los pasos y ninguna frase de presión, premio, ocultamiento, suplemento o dieta.
// - Los números: ingredientes del catálogo, de 5 a 300 g, y el aporte calculado con la tabla (el del LLM se ignora).
import {
  NUTRIENTE,
  type Alergeno, type Atributos, type Cambio, type Candidato, type Nutrientes, type Plato,
  type PreparacionCatalogo, type Presentacion, type Receta, type Regla,
} from '../../shared/contratos.js'
import { alimentoPorId, esGenerico } from '../ia/catalogo.js'

export interface ContextoValidacion {
  alergias: Alergeno[]                      // las del perfil (cargadas a mano) y las de la evidencia
  reglas: Regla[]                           // las del perfil, con sus condiciones; se validan las de efecto 'rechaza'
  desde: PreparacionCatalogo                // su alimento seguro: el punto de partida de la cadena
  base: PreparacionCatalogo                 // el candidato del catálogo sobre el que se escribe la receta
  presentacionesAceptadas?: Presentacion[]  // las de lo que ya acepta: con 'mezclado' o 'con_salsa' se permiten esas mezclas
}

export interface ResultadoValidacion { ok: boolean; problemas: string[] }

export const GRAMOS_MIN = 5
export const GRAMOS_MAX = 300

export const NOMBRE_CAMBIO: Record<Cambio, string> = {
  fortificar: 'la versión fortificada',
  coccion: 'la cocción',
  forma: 'la forma',
  sabor: 'el sabor',
  ingrediente: 'el ingrediente principal',
  temperatura: 'la temperatura',
  textura: 'la textura',
}

const NOMBRE_ALERGENO: Record<Alergeno, string> = {
  leche: 'leche', huevo: 'huevo', gluten: 'gluten', mani: 'maní', frutos_secos: 'frutos secos',
  soja: 'soja', pescado: 'pescado', mariscos: 'mariscos', sesamo: 'sésamo',
}

const redondear = (x: number) => Math.round(x * 100) / 100
const nombreAlimento = (id: string | undefined) => (id ? alimentoPorId(id)?.nombre ?? id : 'ninguno')

// ---------- La cadena ----------
// Criterio de cadena.ts (PLAN.md §8): cuentan textura, forma, sabor, temperatura, cocción (v4) e ingrediente principal
// (el de más gramos). El color no cuenta: cambia con el ingrediente y no distinguió a los chicos con TEA (Hubbard 2014).
// Si la preparación es la versión fortificada de la de partida (`fortificadaDe`), el cambio es 'fortificar'.
// TODO(B12): cuando B suba server/aprendizaje/cadena.ts, usar su cálculo acá, para que el tablero y la receta cuenten igual.
const DIMENSIONES = ['textura', 'forma', 'sabor', 'temperatura', 'coccion'] as const

export interface Diferencia { cambio: Cambio; antes: string; despues: string }

export function ingredientePrincipal(ingredientes: { alimentoId: string; gramos: number }[]): string | undefined {
  let mejor: { alimentoId: string; gramos: number } | undefined
  for (const i of ingredientes) if (!mejor || i.gramos > mejor.gramos) mejor = i
  return mejor?.alimentoId
}

export function cambiosEntre(desde: PreparacionCatalogo, hacia: PreparacionCatalogo): Diferencia[] {
  if (hacia.fortificadaDe === desde.id) return [{ cambio: 'fortificar', antes: desde.id, despues: hacia.id }]
  const difs: Diferencia[] = []
  for (const d of DIMENSIONES) {
    const antes = desde.atributos[d]
    const despues = hacia.atributos[d]
    // La cocción es opcional en el contrato: si falta en alguna de las dos, no se cuenta.
    if (antes !== undefined && despues !== undefined && antes !== despues) difs.push({ cambio: d, antes, despues })
  }
  const antes = ingredientePrincipal(desde.ingredientes)
  const despues = ingredientePrincipal(hacia.ingredientes)
  if (antes && despues && antes !== despues) difs.push({ cambio: 'ingrediente', antes, despues })
  return difs
}

function describir(d: Diferencia): string {
  if (d.cambio === 'fortificar') return NOMBRE_CAMBIO.fortificar
  if (d.cambio === 'ingrediente') return `${NOMBRE_CAMBIO.ingrediente}: ${nombreAlimento(d.antes)} → ${nombreAlimento(d.despues)}`
  return `${NOMBRE_CAMBIO[d.cambio]}: ${d.antes} → ${d.despues}`
}

const ATRIBUTOS: (keyof Atributos)[] = ['textura', 'forma', 'color', 'sabor', 'temperatura', 'presentacion', 'grupo', 'coccion']
const esAtributo = (x: string): x is keyof Atributos => (ATRIBUTOS as string[]).includes(x)

function problemasDeLaCadena(ctx: ContextoValidacion, cambio: Cambio, seMantiene: string[]): string[] {
  const { desde, base } = ctx
  const p: string[] = []
  const difs = cambiosEntre(desde, base)
  if (difs.length === 0) {
    p.push(`«${base.nombre}» no cambia nada respecto de «${desde.nombre}»: tiene que cambiar exactamente una cosa.`)
  } else if (difs.length > 1) {
    p.push(`De «${desde.nombre}» a «${base.nombre}» cambian ${difs.length} cosas (${difs.map(describir).join('; ')}): tiene que cambiar una sola.`)
  } else if (difs[0].cambio !== cambio) {
    p.push(`El cambio declarado es ${NOMBRE_CAMBIO[cambio]}, pero lo que cambia es ${describir(difs[0])}.`)
  }

  if (seMantiene.length === 0) p.push(`Falta decir qué se mantiene respecto de «${desde.nombre}».`)
  for (const item of seMantiene) {
    const [clave, valor] = item.split('=')
    if (!esAtributo(clave) || valor === undefined) continue
    const a = desde.atributos[clave]
    const b = base.atributos[clave]
    if (a !== valor || b !== valor) {
      p.push(`Dice que se mantiene ${item}, pero en «${desde.nombre}» es ${a ?? 'sin dato'} y en «${base.nombre}», ${b ?? 'sin dato'}.`)
    }
  }

  const pres = base.atributos.presentacion
  if (pres !== 'separado' && !(ctx.presentacionesAceptadas ?? []).includes(pres)) {
    p.push(`«${base.nombre}» se sirve ${pres === 'con_salsa' ? 'con salsa' : 'mezclado'} y todavía no acepta nada así: tiene que ir separado.`)
  }
  return p
}

// ---------- Las reglas del perfil ----------
// Una regla `rechaza` se viola si se cumplen todas sus condiciones. Se miran contra los atributos de la preparación base,
// la distribución que da su presentación y, si la presentación nombra uno, el plato.
type TipoCondicion = Regla['condiciones'][number]['tipo']
type Valores = Partial<Record<TipoCondicion, string>>

function valoresDeLaBase(base: PreparacionCatalogo): Valores {
  return { ...base.atributos, distribucion: base.atributos.presentacion === 'separado' ? 'separados' : 'mezclados' }
}

const PLATOS: [Plato, RegExp][] = [
  ['con_divisiones', /\b(divisiones|dividido|compartimentos?)\b/],
  ['hondo', /\b(plato hondo|bol|bowl|cuenco|compotera)\b/],
  ['playo', /\b(plato playo|plato llano)\b/],
]

function platoDelTexto(texto: string): Plato | undefined {
  return PLATOS.find(([, patron]) => buscar(texto, patron, true) !== null)?.[0]
}

function problemasDeReglas(reglas: Regla[], valores: Valores): string[] {
  return reglas
    .filter((r) => r.efecto === 'rechaza' && r.condiciones.length > 0 && r.condiciones.every((c) => valores[c.tipo] === c.valor))
    .map((r) => `Choca con su regla «${r.texto}» (${r.condiciones.map((c) => `${c.tipo}=${c.valor}`).join(' y ')}).`)
}

// ---------- Los ingredientes ----------
function problemasDeIngredientes(r: Receta, ctx: ContextoValidacion): string[] {
  if (r.ingredientes.length === 0) return ['La receta no tiene ingredientes.']
  const p: string[] = []
  for (const { alimentoId, gramos } of r.ingredientes) {
    if (esGenerico(alimentoId)) {
      p.push(`«${alimentoId}» es un genérico: no se sabe qué alérgenos ni qué nutrientes tiene. Usá un alimento concreto de la lista.`)
      continue
    }
    const a = alimentoPorId(alimentoId)
    if (!a) {
      p.push(`El ingrediente «${alimentoId}» no existe en el catálogo de alimentos: usá un alimentoId de la lista.`)
      continue
    }
    if (!(gramos >= GRAMOS_MIN && gramos <= GRAMOS_MAX)) {
      p.push(`«${a.nombre}»: ${gramos} g está fuera de lo razonable (de ${GRAMOS_MIN} a ${GRAMOS_MAX} g por ingrediente).`)
    }
    const choca = a.alergenos.filter((x) => ctx.alergias.includes(x))
    if (choca.length) {
      p.push(`«${a.nombre}» tiene ${choca.map((x) => NOMBRE_ALERGENO[x]).join(' y ')}, y tiene alergia declarada a eso: sacalo o reemplazalo por otro ingrediente de la lista.`)
    }
  }
  const esperado = ingredientePrincipal(ctx.base.ingredientes)
  const principal = ingredientePrincipal(r.ingredientes)
  if (esperado && principal !== esperado) {
    p.push(`El ingrediente principal (el de más gramos) tiene que ser «${nombreAlimento(esperado)}», el de «${ctx.base.nombre}»; en la receta es «${nombreAlimento(principal)}».`)
  }
  return p
}

// ---------- El texto ----------
interface TextoNormal { t: string; origen: number[] }

/** Minúsculas, sin tildes y con los espacios colapsados. `origen[i]` es la posición de `t[i]` en el texto original. */
function normalizar(texto: string): TextoNormal {
  let t = ''
  const origen: number[] = []
  for (let i = 0; i < texto.length; i++) {
    let c = texto[i].normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
    if (/\s/.test(c)) {
      if (t.endsWith(' ')) continue
      c = ' '
    }
    for (const x of c) {
      t += x
      origen.push(i)
    }
  }
  return { t, origen }
}

const NEGACION = /\b(sin|no|ni|nada de|nunca|en lugar de|en vez de|evit\w*|reemplaz\w*|sustitu\w*)\b/

/**
 * La primera aparición de `patron` (escrito sin tildes ni mayúsculas) en el texto, tal como está escrita, o null.
 * `negable`: se saltean las que tienen una negación antes en la misma frase ("sin salsa por encima", "no lleva huevo").
 */
function buscar(texto: string, patron: RegExp, negable: boolean): string | null {
  const { t, origen } = normalizar(texto)
  for (const m of t.matchAll(new RegExp(patron.source, 'g'))) {
    const ini = m.index
    if (negable) {
      let desde = Math.max(0, ini - 30)
      while (desde > 0 && /[a-z0-9]/.test(t[desde - 1])) desde--
      const frase = t.slice(desde, ini).split(/[.,;:!?()]/).at(-1) ?? ''
      if (NEGACION.test(frase)) continue
    }
    return texto.slice(origen[ini], origen[ini + m[0].length - 1] + 1)
  }
  return null
}

interface Campo { campo: string; texto: string }

function campos(r: Receta): Campo[] {
  return [
    { campo: 'el nombre', texto: r.nombre },
    ...r.pasos.map((texto, i) => ({ campo: `el paso ${i + 1}`, texto })),
    { campo: 'el porqué', texto: r.porQue },
    { campo: 'la presentación', texto: r.presentacion },
    { campo: 'cómo ofrecerlo', texto: r.comoOfrecer },
    ...(r.transparencia ? [{ campo: 'la transparencia', texto: r.transparencia }] : []),
  ]
}

const PRESION = 'es presión para que coma (presionar no funciona y lo aleja del alimento)'
const PREMIO = 'es un premio o una condición para que coma'
const ESCONDER = 'esconde el alimento: tiene que ir a la vista y decirse qué lleva'
const SUPLEMENTO = 'sugiere suplementos o dosis, y eso lo decide su pediatra o nutricionista'
const DIETA = 'sugiere una dieta de eliminación'
const JUICIO = 'juzga al chico o a un alimento'
const SACAR = 'sugiere sacarle un alimento seguro'
const COCINA = '(dorar|cocinar|hornear|derretir|gratinar|enfriar|entibiar|hervir|cocer|tostar|secar|freir|calentar|descongelar|hacer)(se)?'

// El lenguaje prohibido (research, "Implicancias de diseño" 6, 8, 9 y 12), sin tildes ni mayúsculas. Vale aunque esté
// negado ("nada escondido" también se rechaza): el prompt lo pide así y es más simple que adivinar la intención.
const PROHIBIDAS: { patron: RegExp; motivo: string }[] = [
  { patron: new RegExp(`\\bque (se )?(lo |la |los |las )?terminen?\\b(?! de ${COCINA}\\b)`), motivo: PRESION },
  { patron: /\btermin\w* (todo|el plato|la comida|la porcion|lo que)\b/, motivo: PRESION },
  { patron: /\bplato limpio\b/, motivo: PRESION },
  { patron: /\bprobadit\w*/, motivo: PRESION },
  { patron: /\b(un|una) (bocado|bocadito|poquito|mordisco|mordisquito|cucharada|cucharadita) mas\b/, motivo: PRESION },
  { patron: /\baunque sea (un|una) (bocado|bocadito|poquito|mordisco|cucharada|cucharadita)\b/, motivo: PRESION },
  { patron: /\b(tiene|tenes|tienen|tendria|tendrias|hay) que (comer|probar|terminar|tragar)\w*/, motivo: PRESION },
  { patron: /\bdeb(e|es|en|eria|erias|erian) (comer|probar|terminar)\w*/, motivo: PRESION },
  { patron: /\boblig\w*/, motivo: PRESION },
  { patron: /\b(forz(ar|arlo|arla|arlos|ado|ada|ando|alo|ala)|fuerce(s|n)?)\b/, motivo: PRESION },
  { patron: /\bpremi(o|os|ar|arlo|arla|alo|ala|a|as|e|es)\b/, motivo: PREMIO },
  { patron: /\brecompens\w*/, motivo: PREMIO },
  { patron: /\bsi (se )?(lo |la |los |las )?(come|comes|comen|termina|terminas|terminan)\b/, motivo: PREMIO },
  { patron: /\bescond\w*/, motivo: ESCONDER },
  { patron: /\bdisimul\w*/, motivo: ESCONDER },
  { patron: /\bcamufl\w*/, motivo: ESCONDER },
  { patron: /\bocult\w*/, motivo: ESCONDER },
  { patron: /\b(que no|sin que) (se )?(de|den) cuenta\b/, motivo: ESCONDER },
  { patron: /\b(que no|sin que) (se )?(lo |la )?(note|noten|entere|enteren|vea|vean|descubra|descubran)\b/, motivo: ESCONDER },
  { patron: /\bsuplement\w*/, motivo: SUPLEMENTO },
  { patron: /\bmultivitamin\w*/, motivo: SUPLEMENTO },
  { patron: /\bdosis\b/, motivo: SUPLEMENTO },
  { patron: /\b(gotas|capsulas?|comprimidos?|pastillas?|jarabe) (de|con) (vitamina|hierro|calcio|omega)/, motivo: SUPLEMENTO },
  { patron: /\b(vitamina|hierro|calcio|omega)\w*( \w+)? en (gotas|capsulas|comprimidos|pastillas|jarabe)\b/, motivo: SUPLEMENTO },
  { patron: /\bdietas? (de eliminacion|sin \w+|libre de|cetogenica|gfcf|restrictiva)/, motivo: DIETA },
  { patron: /\b(sin gluten ni caseina|gfcf)\b/, motivo: DIETA },
  { patron: /\b(elimin|sac|quit)\w* (el |la |los |las )?(gluten|caseina|tacc|lacteos)\b/, motivo: DIETA },
  { patron: /\b(chatarra|comida basura|porquer\w*|ultraprocesad\w*|caprich\w*|malcriad\w*)/, motivo: JUICIO },
  { patron: /\b(no es|poco|nada) (sano|saludable)\b/, motivo: JUICIO },
  { patron: /\bdej\w* de (darle|darles|ofrecerle|servirle)\b/, motivo: SACAR },
]

// Mezclas por texto (nombre, pasos, presentación y transparencia), salvo que ya acepte esa presentación.
const MEZCLAS: { patron: RegExp; presentacion: Presentacion; que: string }[] = [
  { patron: /\b(guis\w*|estofad\w*|cazuela\w*)/, presentacion: 'mezclado', que: 'un guiso' },
  { patron: /\brellen\w*/, presentacion: 'mezclado', que: 'un relleno' },
  {
    patron: /\bsalsa (\w+ ){0,3}(por )?encima\b|\bpor encima (\w+ ){0,2}salsa\b|\b(cubr\w*|banad\w*|banal\w*|bana|banar|napad\w*|napa|napar) (en|con) (\w+ ){0,3}salsa\b/,
    presentacion: 'con_salsa',
    que: 'salsa por encima',
  },
]

// Alérgenos nombrados en el nombre, los pasos o la transparencia (un rebozado con huevo que no está en la lista).
// Solo palabras inequívocas: la lista de ingredientes ya se mira contra data/alimentos.json.
const PALABRAS_ALERGENO: Record<Alergeno, RegExp> = {
  huevo: /\b(huevos?|claras?|yemas?|mayonesa|merengue)\b/,
  leche: /\b(leche(?! de (almendras?|soja|arroz|avena|coco))|quesos?|manteca|yogur\w*|muzzarella|mozzarella|ricota|crema de leche)\b/,
  gluten: /\b(trigo|pan rallado|harina (de trigo|comun|0+)|fideos(?! de (arroz|maiz))|cebada|centeno|pan (blanco|lactal|integral|de molde))\b/,
  mani: /\b(mani|manies|cacahuates?)\b/,
  frutos_secos: /\b(nuez|nueces|almendras?|avellanas?|castanas?|pistachos?|caju|anacardos?)\b/,
  soja: /\b(soja|tofu|edamame)\b/,
  pescado: /\b(pescados?|merluza|atun|salmon|sardinas?|caballa|brotola|corvina|anchoas?)\b/,
  mariscos: /\b(mariscos?|camaron\w*|langostin\w*|mejillon\w*|calamar\w*|pulpo|almejas?|cangrejos?)\b/,
  sesamo: /\b(sesamo|tahini|tahina)\b/,
}

function problemasDelTexto(r: Receta, ctx: ContextoValidacion): string[] {
  const p: string[] = []
  const todos = campos(r)
  for (const { campo, texto } of todos) if (!texto.trim()) p.push(`Falta ${campo}.`)
  if (r.pasos.length === 0) p.push('Faltan los pasos.')

  const delPlato = todos.filter(({ campo }) => campo !== 'el porqué' && campo !== 'cómo ofrecerlo')
  for (const { patron, presentacion, que } of MEZCLAS) {
    if ((ctx.presentacionesAceptadas ?? []).includes(presentacion)) continue
    for (const { campo, texto } of delPlato) {
      const frase = buscar(texto, patron, true)
      if (frase) p.push(`En ${campo} aparece «${frase}» (${que}): todavía no acepta mezclas, rellenos ni salsa por encima. Las salsas van aparte, para mojar.`)
    }
  }

  const conIngredientes = todos.filter(({ campo }) => campo === 'el nombre' || campo.startsWith('el paso') || campo === 'la transparencia')
  for (const alergeno of ctx.alergias) {
    for (const { campo, texto } of conIngredientes) {
      const frase = buscar(texto, PALABRAS_ALERGENO[alergeno], true)
      if (frase) p.push(`En ${campo} aparece «${frase}» y tiene alergia declarada a ${NOMBRE_ALERGENO[alergeno]}: sacalo de la receta (si hace falta, reemplazalo y decí con qué).`)
    }
  }

  for (const { campo, texto } of todos) {
    for (const { patron, motivo } of PROHIBIDAS) {
      const frase = buscar(texto, patron, false)
      if (frase) p.push(`En ${campo} aparece «${frase}»: ${motivo}. Reescribilo sin esa expresión, ni siquiera para negarla.`)
    }
  }
  return p
}

// ---------- El aporte ----------
/** Nutrientes de una porción con la tabla (`por100g` × gramos ÷ 100), redondeados a 2 decimales. */
export function calcularAporte(ingredientes: { alimentoId: string; gramos: number }[]): Nutrientes {
  const total = Object.fromEntries(NUTRIENTE.map((n) => [n, 0])) as Nutrientes
  for (const { alimentoId, gramos } of ingredientes) {
    const a = alimentoPorId(alimentoId)
    if (!a) continue
    for (const n of NUTRIENTE) total[n] += ((a.por100g[n] ?? 0) * gramos) / 100
  }
  for (const n of NUTRIENTE) total[n] = redondear(total[n])
  return total
}

function problemasDelAporte(r: Receta): string[] {
  const tabla = calcularAporte(r.ingredientes)
  const distintos = NUTRIENTE.filter((n) => {
    const dicho = r.aporte?.[n]
    return typeof dicho !== 'number' || Math.abs(dicho - tabla[n]) > 0.01 + 0.005 * Math.abs(tabla[n])
  })
  if (distintos.length === 0) return []
  const detalle = distintos.map((n) => `${n}: ${r.aporte?.[n] ?? 'sin dato'} en la receta y ${tabla[n]} según la tabla`).join('; ')
  return [`El aporte no coincide con la tabla de alimentos (${detalle}). Lo calcula el código, no el modelo.`]
}

// ---------- Entradas ----------
function problemasDeIds(r: Receta, ctx: ContextoValidacion): string[] {
  const p: string[] = []
  if (r.preparacionBaseId !== ctx.base.id) p.push(`La receta dice que se arma sobre «${r.preparacionBaseId}», pero el candidato es «${ctx.base.id}».`)
  if (r.desde.preparacionId !== ctx.desde.id) p.push(`La receta dice que parte de «${r.desde.preparacionId}», pero el candidato parte de «${ctx.desde.id}».`)
  return p
}

/**
 * Lo que depende solo del candidato (la cadena, la presentación de la base y las reglas): si falla, ningún reintento del
 * LLM lo arregla, así que generarReceta() pasa directo al siguiente candidato sin gastar una llamada.
 */
export function validarCandidato(ctx: ContextoValidacion, candidato: Pick<Candidato, 'cambio' | 'seMantiene'>): ResultadoValidacion {
  const problemas = [
    ...problemasDeLaCadena(ctx, candidato.cambio, candidato.seMantiene),
    ...problemasDeReglas(ctx.reglas, valoresDeLaBase(ctx.base)),
  ]
  return { ok: problemas.length === 0, problemas }
}

export function validarReceta(receta: Receta, ctx: ContextoValidacion): ResultadoValidacion {
  const problemas = [
    ...problemasDeIds(receta, ctx),
    ...problemasDeLaCadena(ctx, receta.cambio, receta.seMantiene),
    ...problemasDeReglas(ctx.reglas, { ...valoresDeLaBase(ctx.base), plato: platoDelTexto(receta.presentacion) }),
    ...problemasDeIngredientes(receta, ctx),
    ...problemasDelTexto(receta, ctx),
    ...problemasDelAporte(receta),
  ]
  return { ok: problemas.length === 0, problemas }
}
