// Plantillas de texto, sin LLM: patrones, "qué aprendí", porqué de las sugerencias, frase y alertas.
// Tono (§9): se celebra explorar, nunca se premia "comer todo", nunca se juzga un alimento seguro ni a la familia.
import type { Cambio, Grupo, Nutriente } from '../../shared/contratos.js'
import { type Condicion, claveCondicion } from './condiciones.js'

export const slug = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')

export const decimal = (x: number, d = 2): string => x.toFixed(d).replace('.', ',')
export const porciento = (x: number): string => `${Math.round(x * 100)}%`
export const mayuscula = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)
export const minuscula = (s: string): string => s.charAt(0).toLowerCase() + s.slice(1)

/** "a", "a y b", "a, b y c". */
export function lista(xs: readonly string[]): string {
  if (xs.length <= 1) return xs[0] ?? ''
  return `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`
}

/** "sus papas fritas en bastones" o "su milanesa": el posesivo según la primera palabra. */
export function su(nombre: string): string {
  const n = minuscula(nombre)
  return `${(n.split(' ')[0] ?? '').endsWith('s') ? 'sus' : 'su'} ${n}`
}

export const NOMBRE_NUTRIENTE: Record<Nutriente, string> = {
  energia_kcal: 'energía', proteina_g: 'proteína', calcio_mg: 'calcio', vitamina_d_ug: 'vitamina D', hierro_mg: 'hierro',
  fibra_g: 'fibra', omega3_g: 'omega-3', b12_ug: 'vitamina B12', vitamina_c_mg: 'vitamina C',
}

/** "del calcio", "de la vitamina D". */
export const DEL_NUTRIENTE: Record<Nutriente, string> = {
  energia_kcal: 'de la energía', proteina_g: 'de la proteína', calcio_mg: 'del calcio', vitamina_d_ug: 'de la vitamina D',
  hierro_mg: 'del hierro', fibra_g: 'de la fibra', omega3_g: 'del omega-3', b12_ug: 'de la vitamina B12', vitamina_c_mg: 'de la vitamina C',
}

/** v5.5 · El grupo en palabras, para el modo variedad: "no come fruta", "carne, huevo o legumbres: hace 6 días que no come". */
export const NOMBRE_GRUPO: Record<Grupo, string> = {
  cereal_almidon: 'cereales, panes o papas', proteina: 'carne, huevo o legumbres', verdura: 'verdura', fruta: 'fruta',
  lacteo: 'lácteos', otro: 'otros alimentos',
}
const dias = (n: number) => `${n} ${n === 1 ? 'día' : 'días'}`
/** v5.5 · "hace 6 días que no come fruta" · "no registramos que coma verdura" (diasSinComer null = nunca). */
export const sinComer = (grupo: Grupo, diasSinComer: number | null | undefined): string =>
  diasSinComer == null ? `no registramos que coma ${NOMBRE_GRUPO[grupo]}` : `hace ${dias(diasSinComer)} que no come ${NOMBRE_GRUPO[grupo]}`
/** v5.5 · "fruta: hace 6 días que no come" · "verdura: no registramos que haya comido". */
export const grupoSinComer = (grupo: Grupo, diasSinComer: number | null | undefined): string =>
  `${NOMBRE_GRUPO[grupo]}: ${diasSinComer == null ? 'no registramos que haya comido' : `hace ${dias(diasSinComer)} que no come`}`

export const TEXTO_CAMBIO: Record<Cambio, string> = {
  fortificar: 'que es la versión fortificada', coccion: 'la cocción', forma: 'la forma', sabor: 'el sabor',
  ingrediente: 'el ingrediente', temperatura: 'la temperatura', textura: 'la textura',
}

// ---------- Patrones ----------
const ADJETIVO: Readonly<Record<string, string>> = {
  'textura=crocante': 'crocante', 'textura=blando': 'blando', 'textura=cremoso': 'cremoso', 'textura=masticable': 'masticable',
  'textura=jugoso': 'jugoso', 'textura=mixto': 'de textura mixta',
  'color=blanco': 'blanco', 'color=beige': 'beige', 'color=amarillo': 'amarillo', 'color=naranja': 'naranja', 'color=rojo': 'rojo',
  'color=verde': 'verde', 'color=marron': 'marrón', 'color=mixto': 'de varios colores',
  'sabor=salado': 'salado', 'sabor=dulce': 'dulce', 'sabor=acido': 'ácido', 'sabor=neutro': 'de sabor neutro',
  'temperatura=frio': 'frío', 'temperatura=tibio': 'tibio', 'temperatura=caliente': 'caliente',
}

const MODIFICADOR: Readonly<Record<string, string>> = {
  'forma=baston': 'en bastones', 'forma=redondo': 'en forma redonda', 'forma=plano': 'en forma plana', 'forma=trozos': 'en trozos',
  'forma=pure': 'en puré', 'forma=granos': 'en granos', 'forma=entero': 'entero',
  'presentacion=separado': 'servido separado', 'presentacion=mezclado': 'mezclado', 'presentacion=con_salsa': 'con salsa',
  'coccion=frito': 'frito', 'coccion=horno': 'al horno', 'coccion=hervido': 'hervido', 'coccion=plancha': 'a la plancha',
  'coccion=crudo': 'crudo', 'coccion=listo': 'como viene',
  'distribucion=separados': 'con la comida separada en el plato', 'distribucion=tocandose': 'cuando los alimentos se tocan',
  'distribucion=mezclados': 'cuando los alimentos están mezclados',
  'plato=hondo': 'en plato hondo', 'plato=playo': 'en plato playo', 'plato=con_divisiones': 'en plato con divisiones',
  'plato=otro': 'en otro tipo de plato',
  'momento=desayuno': 'en el desayuno', 'momento=almuerzo': 'en el almuerzo', 'momento=merienda': 'en la merienda',
  'momento=cena': 'en la cena', 'momento=colacion': 'en la colación',
  'juntoASeguro=true': 'al lado de un alimento seguro', 'juntoASeguro=false': 'sin un alimento seguro al lado',
}

/** Cuando no hay adjetivo, algunas condiciones pueden hacer de sujeto. */
const SUJETO: Readonly<Record<string, string>> = {
  'presentacion=mezclado': 'lo mezclado', 'presentacion=con_salsa': 'lo que viene con salsa', 'presentacion=separado': 'lo servido separado',
  'forma=pure': 'lo que viene en puré', 'forma=baston': 'lo que viene en bastones', 'forma=trozos': 'lo que viene en trozos',
  'forma=granos': 'lo que viene en granos', 'forma=redondo': 'lo redondo', 'forma=plano': 'lo plano', 'forma=entero': 'lo entero',
  'coccion=frito': 'lo frito', 'coccion=horno': 'lo hecho al horno', 'coccion=hervido': 'lo hervido', 'coccion=plancha': 'lo hecho a la plancha',
  'coccion=crudo': 'lo crudo', 'coccion=listo': 'lo que se come como viene',
}

/** Las condiciones que concuerdan con un sujeto plural: "los cereales, panes y papas servidos separados". */
const PLURAL: Readonly<Record<string, { m: string; f: string }>> = {
  'presentacion=separado': { m: 'servidos separados', f: 'servidas separadas' },
  'presentacion=mezclado': { m: 'mezclados', f: 'mezcladas' },
  'coccion=frito': { m: 'fritos', f: 'fritas' },
  'coccion=hervido': { m: 'hervidos', f: 'hervidas' },
  'coccion=crudo': { m: 'crudos', f: 'crudas' },
  'coccion=listo': { m: 'como vienen', f: 'como vienen' },
  'forma=entero': { m: 'enteros', f: 'enteras' },
}

const GRUPO: Readonly<Record<Grupo, { sujeto: string; pronombre: 'los' | 'las'; en: string }>> = {
  cereal_almidon: { sujeto: 'los cereales, panes y papas', pronombre: 'los', en: 'entre los cereales, panes y papas' },
  proteina: { sujeto: 'las carnes y otras proteínas', pronombre: 'las', en: 'entre las carnes y otras proteínas' },
  verdura: { sujeto: 'las verduras', pronombre: 'las', en: 'entre las verduras' },
  fruta: { sujeto: 'las frutas', pronombre: 'las', en: 'entre las frutas' },
  lacteo: { sujeto: 'los lácteos', pronombre: 'los', en: 'entre los lácteos' },
  otro: { sujeto: 'los otros alimentos', pronombre: 'los', en: 'entre los otros alimentos' },
}

export interface SujetoPatron {
  frase: string // "lo crocante servido separado", "los cereales, panes y papas servidos separados"
  pronombre: 'lo' | 'los' | 'las'
  plural: boolean
}

/** De qué habla un patrón, sin el verbo: sirve para "lo acepta" y para "ya no parece costarle". */
export function sujetoPatron(condiciones: readonly Condicion[]): SujetoPatron {
  const claves = condiciones.map(claveCondicion)
  const adjetivos = claves.flatMap((k) => (ADJETIVO[k] ? [ADJETIVO[k]] : []))
  const grupo = condiciones.find((c) => c.tipo === 'grupo')?.valor as Grupo | undefined
  let resto = claves.filter((k) => !ADJETIVO[k] && !k.startsWith('grupo='))
  let sujeto: string
  let pronombre: SujetoPatron['pronombre'] = 'lo'
  const modificadores: string[] = []
  if (adjetivos.length) {
    sujeto = `lo ${lista(adjetivos)}`
    if (grupo) modificadores.push(GRUPO[grupo].en)
  } else if (grupo) {
    sujeto = GRUPO[grupo].sujeto
    pronombre = GRUPO[grupo].pronombre
  } else {
    const k = resto.find((x) => SUJETO[x])
    sujeto = k ? (SUJETO[k] ?? '') : 'lo que se sirve'
    resto = resto.filter((x) => x !== k)
  }
  const plural = pronombre !== 'lo'
  const genero = pronombre === 'las' ? 'f' : 'm'
  modificadores.unshift(...resto.map((k) => (plural && PLURAL[k] ? PLURAL[k][genero] : (MODIFICADOR[k] ?? k))))
  return { frase: [sujeto, ...modificadores].join(' '), pronombre, plural }
}

/**
 * "Lo crocante servido separado lo acepta (5 de 5)" · "Las verduras todavía no las acepta (3 de 3)".
 * Hacia el padre nunca se dice "rechaza" (§9): lo que todavía no come es "todavía no lo acepta".
 */
export function textoPatron(condiciones: readonly Condicion[], resultado: 'acepta' | 'rechaza', aFavor?: number, n?: number): string {
  const { frase, pronombre } = sujetoPatron(condiciones)
  const verbo = resultado === 'acepta' ? `${pronombre} acepta` : `todavía no ${pronombre} acepta`
  const cuenta = n ? ` (${aFavor ?? 0} de ${n})` : ''
  return mayuscula(`${frase} ${verbo}${cuenta}`)
}
