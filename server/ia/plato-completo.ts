// v5.7 · La receta creativa es una COMIDA COMPLETA (PLAN §9): lo nuevo (el paso de food chaining) + lo que ya come que
// la completa, según la comida. Un solo alimento nuevo: los demás componentes son cosas que acepta y que van en esa
// comida (Conocimiento.seguros). El código arma el aporte del plato entero con la tabla y valida la estructura: cuántas
// cosas, cuánta energía y cuánta proteína para esa comida, y que no haya dos principales.
import { CON_META } from '../nutricion/objetivos.js'
import { NUTRIENTE, type ComponentePlato, type Momento, type Nutrientes, type PlatoCompleto, type PreparacionCatalogo, type RolPlato } from '../../shared/contratos.js'
import { decimal } from '../aprendizaje/textos.js'
import type { Conocimiento } from '../grafo/conocimiento.js'
import { calcularAporte } from '../validacion/receta.js'

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

/** Lo que ve el LLM para armar la comida: la estructura y con qué de lo que ya come puede completarla. */
export function textoComidaCompleta(k: Conocimiento): string[] {
  const e = estructuraDe(k.momento)
  const kcal = k.energiaReferencia
  return [
    `La receta es una COMIDA COMPLETA${k.momento ? ` para ${k.momento}` : ''}: ${e.plato}. Son de ${e.componentes[0]} a ${e.componentes[1]} cosas en total, contando lo nuevo.`,
    `Lo nuevo es UNA de esas cosas (en almuerzo y cena, de preferencia el principal: un plato potente, no una guarnición chiquita). El resto se completa con lo que ya come de esta lista (preparacionId, grupo, porción típica):`,
    ...k.seguros.map((p) => `- ${p.id}: ${p.nombre} · ${p.atributos.grupo} · ~${Math.round(porcionDe(p))} g`),
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
export function problemasDelPlato(plato: PlatoCompleto, acompanamientos: readonly { preparacionId: string; gramos: number }[], k: Conocimiento): string[] {
  const p: string[] = []
  const e = estructuraDe(k.momento)
  const para = k.momento ? ` para ${k.momento}` : ''
  const cuantos = plato.componentes.length
  const fuera = acompanamientos.filter((a) => !k.seguros.some((s) => s.id === a.preparacionId)).map((a) => a.preparacionId)
  if (fuera.length) p.push(`${fuera.join(', ')} no está entre lo que ya come para esta comida: completá el plato solo con la lista de lo que ya come.`)
  if (new Set(acompanamientos.map((a) => a.preparacionId)).size !== acompanamientos.length) p.push('Repetiste un acompañamiento: cada cosa va una sola vez.')
  if (cuantos < e.componentes[0] || cuantos > e.componentes[1]) {
    p.push(`El plato tiene ${cuantos} ${cuantos === 1 ? 'cosa' : 'cosas'} y una comida completa${para} lleva de ${e.componentes[0]} a ${e.componentes[1]}: ${e.plato}.`)
  }
  // Pedido de la familia (18/10): platos potentes. En almuerzo y cena lo nuevo es el principal, salvo que el objetivo
  // sea sumar verdura o fruta (ahí lo nuevo es esa verdura o fruta)
  const nuevo = plato.componentes.find((c) => c.nuevo)
  const sumaVerduraOFruta = k.variedad?.grupo === 'verdura' || k.variedad?.grupo === 'fruta'
  if ((k.momento === 'almuerzo' || k.momento === 'cena') && !sumaVerduraOFruta && nuevo && nuevo.rol !== 'principal') {
    p.push(`En ${k.momento} lo nuevo tiene que ser el principal, un plato potente (una proteína: carne, pollo, legumbres, queso…), no una ${NOMBRE_ROL[nuevo.rol]}. Partí de su principal (por ejemplo, su milanesa o sus nuggets) y que lo que ya come sea la guarnición y la verdura.`)
  }
  if (plato.componentes.filter((c) => c.rol === 'principal').length > 1) p.push('Hay dos principales: lo que ya come completa el plato como guarnición, verdura o fruta, no como otro principal.')
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
