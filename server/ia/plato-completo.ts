// v5.7 · La receta creativa es una COMIDA COMPLETA (PLAN §9): lo nuevo (el paso de food chaining) + lo que ya come que
// la completa, según la comida. Un solo alimento nuevo: los demás componentes son cosas que acepta y que van en esa
// comida (Conocimiento.seguros). El código arma el aporte del plato entero con la tabla y valida la estructura: cuántas
// cosas, cuánta energía y cuánta proteína para esa comida, y que no haya dos principales.
// v5.10 · Un solo plato principal por comida (server/ia/momentos.ts, esPlatoPrincipal: pastas, pizza, milanesas, nuggets,
// hamburguesas, tartas, guisos, carnes), aunque venga de guarnición: salía la pizza al lado de los ravioles nuevos. El
// cereal o pan del desayuno es pan, tostadas, galletitas o un cereal (esCerealOPan), nunca pizza ni pasta.
import { CON_META } from '../nutricion/objetivos.js'
import { NUTRIENTE, type ComponentePlato, type Momento, type Nutrientes, type PlatoCompleto, type PreparacionCatalogo, type RolPlato } from '../../shared/contratos.js'
import { decimal } from '../aprendizaje/textos.js'
import type { Conocimiento } from '../grafo/conocimiento.js'
import { calcularAporte } from '../validacion/receta.js'
import { esCerealOPan, esPlatoPrincipal } from './momentos.js'

interface Estructura {
  componentes: [number, number]   // cuántas cosas en total, con lo nuevo
  energia: [number, number]       // fracción de la energía del día
  proteina: number                // fracción mínima de la proteína del día
  plato: string                   // cómo se arma, para el LLM
}

/** Cómo es una comida completa para un chico (aprox. 25–35% de la energía en almuerzo y cena, 20–25% en desayuno). */
export const ESTRUCTURA: Record<Momento, Estructura> = {
  almuerzo: { componentes: [3, 4], energia: [0.25, 0.45], proteina: 0.25, plato: 'un principal potente (proteína: carne, pollo, pescado, legumbres, huevo o queso) + una guarnición (papa, boniato, arroz, fideos, polenta, pan) + una verdura o fruta' },
  cena: { componentes: [3, 4], energia: [0.25, 0.45], proteina: 0.25, plato: 'un principal potente (proteína: carne, pollo, pescado, legumbres, huevo o queso) + una guarnición (papa, boniato, arroz, fideos, polenta, pan) + una verdura o fruta' },
  desayuno: { componentes: [2, 4], energia: [0.15, 0.32], proteina: 0.12, plato: 'un lácteo (leche, yogur, queso, ricota) + un cereal o pan (tostadas, galletitas, avena, copos) + una fruta' },
  merienda: { componentes: [2, 4], energia: [0.12, 0.3], proteina: 0.1, plato: 'un lácteo + un cereal o pan + una fruta, como el desayuno pero un poco más liviano' },
  colacion: { componentes: [1, 2], energia: [0.04, 0.15], proteina: 0, plato: 'algo liviano: una fruta, un lácteo o un puñado de algo crocante' },
}
const SIN_MOMENTO: Estructura = { componentes: [2, 4], energia: [0.12, 0.45], proteina: 0.1, plato: 'una comida completa: algo principal + lo que ya come que la complete' }
export const estructuraDe = (m?: Momento): Estructura => (m ? ESTRUCTURA[m] : SIN_MOMENTO)

export const NOMBRE_ROL: Record<RolPlato, string> = {
  principal: 'principal', guarnicion: 'guarnición', verdura_fruta: 'verdura o fruta', lacteo: 'lácteo', cereal_pan: 'cereal o pan', bebida: 'bebida',
}

/**
 * La energía de referencia para dimensionar el plato: el gasto estimado (EER del IOM, actividad moderada) por edad y sexo.
 * No es una meta (data/objetivos.json no tiene meta de energía y la app no se la muestra al padre): solo dice de qué
 * tamaño es una comida completa para este chico.
 */
export function energiaDeReferencia(edad: number, sexo: 'masculino' | 'femenino'): number {
  if (edad < 4) return 1050
  if (edad < 9) return sexo === 'masculino' ? 1550 : 1450
  if (edad < 14) return sexo === 'masculino' ? 2050 : 1850
  return sexo === 'masculino' ? 2600 : 2050
}

const porcionDe = (p: PreparacionCatalogo) => p.ingredientes.reduce((t, i) => t + i.gramos, 0)

/**
 * Cuántas cosas lleva como mínimo el plato para ESTE chico: las de la comida completa, salvo que lo que ya come no
 * alcance para completarla sin otro principal (Rosario come milanesa, hamburguesa y sushi: en la cena, lo nuevo + el
 * sushi). Con repertorio chico es justo cuando más sirve la app: el plato se completa con lo que haya.
 */
export function minimoComponentes(k: Conocimiento): number {
  const e = estructuraDe(k.momento)
  const acompanan = k.seguros.filter((s) => s.atributos.grupo !== 'proteina').length
  return Math.max(1, Math.min(e.componentes[0], 1 + acompanan))
}

/** Lo que ve el LLM para armar la comida: la estructura y con qué de lo que ya come puede completarla. */
export function textoComidaCompleta(k: Conocimiento): string[] {
  const e = estructuraDe(k.momento)
  const kcal = k.energiaReferencia
  return [
    `La receta es una COMIDA COMPLETA${k.momento ? ` para ${k.momento}` : ''}: ${e.plato}. Son de ${minimoComponentes(k)} a ${e.componentes[1]} cosas en total, contando lo nuevo${minimoComponentes(k) < e.componentes[0] ? ' (come pocas cosas: completá con lo que haya de la lista, sin sumar otro principal)' : ''}.`,
    `Lo nuevo es UNA de esas cosas (en almuerzo y cena, de preferencia el principal: un plato potente, no una guarnición chiquita). El resto se completa con lo que ya come de esta lista (preparacionId, grupo, porción típica):`,
    ...k.seguros.map((p) => `- ${p.id}: ${p.nombre} · ${p.atributos.grupo} · ~${Math.round(porcionDe(p))} g${esPlatoPrincipal(p) ? ' · plato principal' : ''}`),
    // v5.10
    `Un solo plato principal por comida: pastas, pizza, milanesas, nuggets, hamburguesas, tartas, guisos y carnes lo son aunque vayan al lado (si lo nuevo es uno, de la lista no va ninguno marcado "plato principal").${k.momento && !['almuerzo', 'cena'].includes(k.momento) ? ' El cereal o pan es pan, tostadas, galletitas o un cereal (avena, copos), nunca pizza ni pasta.' : ''}`,
    `El plato entero tiene que tener entre ${Math.round(e.energia[0] * kcal)} y ${Math.round(e.energia[1] * kcal)} kcal${e.proteina ? ` y al menos ${decimal(e.proteina * k.metaDiaria.proteina_g, 0)} g de proteína` : ''} (la app lo calcula con la tabla: ajustá los gramos de cada cosa).`,
  ]
}

/**
 * Las porciones de lo que ya come, ajustadas para que el plato entero entre en las calorías de esa comida: el LLM no
 * calcula bien las calorías y un reintento cuesta 15 s. Se escala parejo lo que ya come (de 30 a 300 g cada cosa);
 * lo nuevo queda como en su receta. Si ni así entra, lo dice problemasDelPlato().
 */
export function ajustarPorciones<T extends { preparacionId: string; gramos: number }>(kcalNuevo: number, acompanamientos: readonly T[], k: Conocimiento): T[] {
  const e = estructuraDe(k.momento)
  const ref = k.energiaReferencia
  const kcalPorGramo = (id: string) => {
    const p = k.seguros.find((s) => s.id === id)
    const g = p ? porcionDe(p) : 0
    return p && g ? calcularAporte(p.ingredientes).energia_kcal / g : 0
  }
  const kcalDe = (xs: readonly T[]) => xs.reduce((t, a) => t + a.gramos * kcalPorGramo(a.preparacionId), 0)
  const total = kcalNuevo + kcalDe(acompanamientos)
  const [min, max] = [e.energia[0] * ref, e.energia[1] * ref]
  const resto = kcalDe(acompanamientos)
  if (!ref || !resto || (total >= min && total <= max)) return [...acompanamientos]
  const objetivo = total > max ? max * 0.95 : min * 1.05
  const factor = Math.max(0, objetivo - kcalNuevo) / resto
  return acompanamientos.map((a) => ({ ...a, gramos: Math.round(Math.min(300, Math.max(30, a.gramos * factor))) }))
}

const ROL_POR_GRUPO: Record<string, RolPlato> = {
  proteina: 'principal', cereal_almidon: 'guarnicion', verdura: 'verdura_fruta', fruta: 'verdura_fruta', lacteo: 'lacteo', otro: 'guarnicion',
}
const ROL_DESAYUNO: Record<string, RolPlato> = {
  proteina: 'principal', cereal_almidon: 'cereal_pan', verdura: 'verdura_fruta', fruta: 'verdura_fruta', lacteo: 'lacteo', otro: 'cereal_pan',
}

/**
 * Lo que el LLM dejó afuera, completado con lo que YA COME (nunca algo nuevo): sin esto, un puré nuevo podía quedar solo
 * en la cena. Saca lo que no está en su lista o vino sin gramos, y suma de sus alimentos seguros para esa comida lo que
 * falte: en almuerzo y cena un principal con proteína (si lo nuevo no lo es) y una verdura o fruta; después, lo que haya
 * hasta el mínimo. No repite el alimento del que parte lo nuevo si es del mismo tipo (puré con queso + su puré).
 * v5.10 · Nunca suma un segundo plato principal (si lo nuevo es uno, como los ravioles, viene con rol principal), ni de
 * guarnición ni de verdura; y el cereal o pan del desayuno es solo pan, tostadas, galletitas o un cereal.
 */
export function completarConLoQueCome<T extends { preparacionId: string; rol: RolPlato; gramos: number }>(
  nuevo: { rol: RolPlato; grupo: string; desdeId?: string }, acompanamientos: readonly T[], k: Conocimiento,
): { preparacionId: string; rol: RolPlato; gramos: number }[] {
  const desayuno = k.momento === 'desayuno' || k.momento === 'merienda' || k.momento === 'colacion'
  const rolDe = (s: PreparacionCatalogo): RolPlato => {
    if (esPlatoPrincipal(s)) return 'principal'
    if (desayuno && s.atributos.grupo === 'cereal_almidon' && !esCerealOPan(s)) return 'guarnicion'
    return (desayuno ? ROL_DESAYUNO : ROL_POR_GRUPO)[s.atributos.grupo] ?? 'guarnicion'
  }
  const plato: { preparacionId: string; rol: RolPlato; gramos: number }[] = acompanamientos
    .filter((a, i, xs) => a.gramos > 0 && k.seguros.some((s) => s.id === a.preparacionId) && xs.findIndex((x) => x.preparacionId === a.preparacionId) === i)
    .map((a) => ({ preparacionId: a.preparacionId, rol: a.rol, gramos: a.gramos }))
  const usados = new Set(plato.map((a) => a.preparacionId))
  const disponibles = k.seguros.filter((s) => !usados.has(s.id) && !(s.id === nuevo.desdeId && s.atributos.grupo === nuevo.grupo))
  const sumar = (s: PreparacionCatalogo, rol: RolPlato) => {
    plato.push({ preparacionId: s.id, rol, gramos: Math.round(porcionDe(s)) || 100 })
    usados.add(s.id)
  }
  const tomar = (pred: (s: PreparacionCatalogo) => boolean) => disponibles.find((s) => !usados.has(s.id) && pred(s))
  const hayRol = (rol: RolPlato) => nuevo.rol === rol || plato.some((a) => a.rol === rol)
  // v5.10 · Si ya hay un plato principal (lo nuevo o lo que eligió el LLM), no se suma otro
  const esPrincipal = (id: string) => { const s = k.seguros.find((x) => x.id === id); return Boolean(s && esPlatoPrincipal(s)) }
  const hayPrincipal = () => hayRol('principal') || plato.some((a) => esPrincipal(a.preparacionId))
  const acompana = (s: PreparacionCatalogo) => !esPlatoPrincipal(s)
  if (!desayuno && k.momento) {
    if (!hayPrincipal()) { const p = tomar((s) => s.atributos.grupo === 'proteina'); if (p) sumar(p, 'principal') }
    if (!hayRol('verdura_fruta')) { const v = tomar((s) => (s.atributos.grupo === 'verdura' || s.atributos.grupo === 'fruta') && acompana(s)); if (v) sumar(v, 'verdura_fruta') }
    if (!hayRol('guarnicion')) { const g = tomar((s) => s.atributos.grupo === 'cereal_almidon' && acompana(s)); if (g) sumar(g, 'guarnicion') }
  } else if (desayuno) {
    const deRol: Record<'lacteo' | 'cereal_pan' | 'verdura_fruta', (s: PreparacionCatalogo) => boolean> = {
      lacteo: (s) => s.atributos.grupo === 'lacteo' && acompana(s),
      cereal_pan: esCerealOPan,
      verdura_fruta: (s) => (s.atributos.grupo === 'fruta' || s.atributos.grupo === 'verdura') && acompana(s),
    }
    for (const rol of ['lacteo', 'cereal_pan', 'verdura_fruta'] as const) {
      if (plato.length + 1 >= estructuraDe(k.momento).componentes[1]) break
      if (!hayRol(rol)) { const x = tomar(deRol[rol]); if (x) sumar(x, rol) }
    }
  }
  // Hasta el mínimo, con lo que haya que no sea otro principal
  while (plato.length + 1 < minimoComponentes(k)) {
    const x = tomar((s) => acompana(s) || !hayPrincipal())
    if (!x) break
    sumar(x, rolDe(x))
  }
  return plato
}

/** El plato entero: lo nuevo (con su receta) + lo que ya come, con el aporte de la tabla y cuánto del día cubre. */
export function armarPlatoCompleto(
  nuevo: { preparacion: PreparacionCatalogo; rol: RolPlato; aporte: Nutrientes },
  acompanamientos: readonly { preparacionId: string; rol: RolPlato; gramos: number }[],
  k: Conocimiento,
): PlatoCompleto {
  const componentes: ComponentePlato[] = [{
    rol: nuevo.rol, preparacionId: nuevo.preparacion.id, nombre: nuevo.preparacion.nombre, nuevo: true,
    gramos: Math.round(porcionDe(nuevo.preparacion)), grupo: nuevo.preparacion.atributos.grupo,
  }]
  const aporte = { ...nuevo.aporte }
  for (const a of acompanamientos) {
    const p = k.seguros.find((s) => s.id === a.preparacionId)
    if (!p) continue
    const total = porcionDe(p) || 1
    const suyo = calcularAporte(p.ingredientes.map((i) => ({ alimentoId: i.alimentoId, gramos: (i.gramos * a.gramos) / total })))
    for (const n of NUTRIENTE) aporte[n] += suyo[n]
    componentes.push({ rol: a.rol, preparacionId: p.id, nombre: p.nombre, nuevo: false, gramos: Math.round(a.gramos), grupo: p.atributos.grupo })
  }
  for (const n of NUTRIENTE) aporte[n] = Math.round(aporte[n] * 100) / 100
  const cubreDelDia: Partial<Nutrientes> = {}
  if (k.energiaReferencia > 0) cubreDelDia.energia_kcal = Math.round((aporte.energia_kcal / k.energiaReferencia) * 1000) / 1000
  for (const n of CON_META) {
    if (k.metaDiaria[n] > 0) cubreDelDia[n] = Math.round((aporte[n] / k.metaDiaria[n]) * 1000) / 1000
  }
  return { componentes, aporte, cubreDelDia }
}

/** Lo que hace que no sea una comida completa para esa comida. Cada problema vuelve al LLM en el reintento. */
export function problemasDelPlato(
  plato: PlatoCompleto, acompanamientos: readonly { preparacionId: string; gramos: number }[], k: Conocimiento,
  op: { elegido?: boolean; nuevo?: Pick<PreparacionCatalogo, 'nombre' | 'atributos' | 'ingredientes'> } = {},
): string[] {
  const p: string[] = []
  const e = estructuraDe(k.momento)
  const para = k.momento ? ` para ${k.momento}` : ''
  const cuantos = plato.componentes.length
  const fuera = acompanamientos.filter((a) => !k.seguros.some((s) => s.id === a.preparacionId)).map((a) => a.preparacionId)
  if (fuera.length) p.push(`${fuera.join(', ')} no está entre lo que ya come para esta comida: completá el plato solo con la lista de lo que ya come.`)
  if (new Set(acompanamientos.map((a) => a.preparacionId)).size !== acompanamientos.length) p.push('Repetiste un acompañamiento: cada cosa va una sola vez.')
  const minimo = minimoComponentes(k)
  if (cuantos < minimo || cuantos > e.componentes[1]) {
    p.push(`El plato tiene ${cuantos} ${cuantos === 1 ? 'cosa' : 'cosas'} y una comida completa${para} lleva de ${minimo} a ${e.componentes[1]}: ${e.plato}.`)
  }
  // Pedido de la familia (18/10): platos potentes. En almuerzo y cena lo nuevo es el principal, salvo que el objetivo
  // sea sumar verdura o fruta (ahí lo nuevo es esa verdura o fruta)
  const nuevo = plato.componentes.find((c) => c.nuevo)
  const sumaVerduraOFruta = k.variedad?.grupo === 'verdura' || k.variedad?.grupo === 'fruta'
  // v5.9 · Si lo nuevo lo eligió la app y es una guarnición (el puré con queso), vale, pero el principal lo pone lo que ya come
  const conPrincipal = plato.componentes.some((c) => !c.nuevo && c.rol === 'principal')
  if (op.elegido && nuevo && nuevo.rol !== 'principal' && (k.momento === 'almuerzo' || k.momento === 'cena') && !conPrincipal) {
    p.push(`«${nuevo.nombre}» es la ${NOMBRE_ROL[nuevo.rol]}: la comida necesita un principal potente de lo que ya come (su milanesa, sus nuggets, su hamburguesa…), con rol principal.`)
  }
  if (!op.elegido && (k.momento === 'almuerzo' || k.momento === 'cena') && !sumaVerduraOFruta && nuevo && nuevo.rol !== 'principal') {
    p.push(`En ${k.momento} lo nuevo tiene que ser el principal, un plato potente (una proteína: carne, pollo, legumbres, queso…), no una ${NOMBRE_ROL[nuevo.rol]}. Partí de su principal (por ejemplo, su milanesa o sus nuggets) y que lo que ya come sea la guarnición y la verdura.`)
  }
  // v5.10 · Un solo plato principal por comida, aunque venga de guarnición (la pizza al lado de los ravioles nuevos)
  const prepDe = (c: ComponentePlato) => (c.nuevo ? op.nuevo : k.seguros.find((s) => s.id === c.preparacionId))
  const principales = plato.componentes.filter((c) => {
    const prep = prepDe(c)
    return c.rol === 'principal' || Boolean(prep && esPlatoPrincipal(prep))
  })
  if (principales.length > 1) {
    const deMas = principales.filter((c) => !c.nuevo)
    p.push(`Hay dos platos principales (${principales.map((c) => `«${c.nombre}»`).join(' y ')}): una comida lleva uno solo. ${deMas.length < principales.length ? `Sacá ${deMas.map((c) => `«${c.nombre}»`).join(' y ')} y completá` : 'Lo que ya come completa el plato'} con una guarnición (papas, puré, arroz), una verdura o una fruta de lo que ya come, no con otro principal (pastas, pizza, milanesas, nuggets, hamburguesas, tartas, guisos o carnes).`)
  }
  // v5.10 · El cereal o pan de lo que ya come: pan, tostadas, galletitas o un cereal
  const noSonPan = plato.componentes.filter((c) => {
    const prep = prepDe(c)
    return !c.nuevo && c.rol === 'cereal_pan' && prep && !esCerealOPan(prep)
  })
  if (noSonPan.length) {
    p.push(`${noSonPan.map((c) => `«${c.nombre}»`).join(' y ')} no ${noSonPan.length === 1 ? 'es' : 'son'} el cereal o pan${para}: ese lugar es para pan, tostadas, galletitas o un cereal (avena, copos), nunca pizza ni pasta.`)
  }
  const malGramos = acompanamientos.filter((a) => !(a.gramos >= 15 && a.gramos <= 350))
  if (malGramos.length) p.push(`Porciones fuera de lo razonable (de 15 a 350 g): ${malGramos.map((a) => `${a.preparacionId} ${a.gramos} g`).join(', ')}.`)
  const kcal = plato.aporte.energia_kcal
  const meta = k.energiaReferencia
  if (meta > 0 && (kcal < e.energia[0] * meta || kcal > e.energia[1] * meta)) {
    p.push(`El plato entero tiene ${Math.round(kcal)} kcal y una comida completa${para} va de ${Math.round(e.energia[0] * meta)} a ${Math.round(e.energia[1] * meta)} kcal: ajustá los gramos (o sumá lo que falte del plato).`)
  }
  const prot = plato.aporte.proteina_g
  if (e.proteina && k.metaDiaria.proteina_g > 0 && prot < e.proteina * k.metaDiaria.proteina_g) {
    p.push(`El plato entero tiene ${decimal(prot, 1)} g de proteína y${para} necesita al menos ${decimal(e.proteina * k.metaDiaria.proteina_g, 0)} g: que el principal sea una proteína de verdad (carne, pollo, legumbres, queso, huevo si no es alérgico) o subí su porción.`)
  }
  return p
}
