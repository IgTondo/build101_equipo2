// Funciones puras del tablero (C3): orden, escalas y textos. Sin React, para poder testearlas.
import type { CoberturaDia, ComidaResumen, Grupo, Nutriente, Nutrientes, Progreso } from '../../../shared/contratos'
import { diaUruguay } from '../../lib/nino'
import { NUTRIENTES_CON_META } from '../../lib/vocabulario'

/**
 * Orden de las barras: primero los que faltan, en el orden de prioridad de §1 (el mismo de `semana.faltan`,
 * que es también el de la frase y el nutriente por defecto de la receta); después el resto, en el orden fijo
 * de NUTRIENTES_CON_META, para que no bailen de una semana a otra.
 */
export function ordenarNutrientes(faltan: readonly Nutriente[]): Nutriente[] {
  const primero = faltan.filter((n) => NUTRIENTES_CON_META.includes(n))
  return [...primero, ...NUTRIENTES_CON_META.filter((n) => !primero.includes(n))]
}

/** La pista de la barra va de 0 a TOPE_ESCALA (120%): el 100% queda visible y lo que pasa del 120% se corta. */
export const TOPE_ESCALA = 1.2
export const MARCA_100 = 1 / TOPE_ESCALA

/** Fracción de la pista (0 a 1) que ocupa una cobertura, y si se recortó por pasar del tope. */
export function escalaBarra(cobertura: number): { fraccion: number; recortada: boolean } {
  const v = Number.isFinite(cobertura) ? Math.max(0, cobertura) : 0
  return { fraccion: Math.min(v, TOPE_ESCALA) / TOPE_ESCALA, recortada: v > TOPE_ESCALA }
}

/** Promedio de cobertura de los 8 con meta, con cada uno topeado en 100% (que sobre B12 no tape lo que falta). */
export function coberturaPromedio(cobertura: Partial<Nutrientes>): number {
  const valores = NUTRIENTES_CON_META.map((n) => Math.min(Math.max(cobertura[n] ?? 0, 0), 1))
  return valores.reduce((s, v) => s + v, 0) / valores.length
}

/** 762 → "≈ 760 kcal por día": la energía es un dato aproximado, se redondea a la decena. */
export function textoEnergia(kcal: number): string {
  const r = Math.round(kcal / 10) * 10
  return `≈ ${r.toLocaleString('es-UY')} kcal por día`
}

export function textoTendencia(diferencia: number): string {
  if (diferencia === 0) return 'Igual que la semana pasada'
  const n = Math.abs(diferencia)
  return `${n} ${diferencia > 0 ? 'más' : 'menos'} que la semana pasada`
}

/** Cuándo comió del grupo por última vez. 0 = hoy; null = nunca lo registramos. */
export function textoDiasSinComer(dias: number | null): string {
  if (dias === null) return 'Todavía no lo registramos'
  if (dias <= 0) return 'Hoy'
  if (dias === 1) return 'Ayer'
  return `Hace ${dias} días`
}

const GRUPO_EN_FRASE: Record<Grupo, string> = {
  cereal_almidon: 'cereales ni almidones', proteina: 'proteínas', verdura: 'verdura', fruta: 'fruta', lacteo: 'lácteos', otro: 'otros alimentos',
}
/** Los grupos que se muestran (§1: días desde la última fruta, verdura, lácteo y proteína; más los cereales). */
export const GRUPOS_VISIBLES: Grupo[] = ['verdura', 'fruta', 'lacteo', 'proteina', 'cereal_almidon']

/** "Hace 10 días que no come verdura" para el grupo que hace más que no aparece (desde 3 días), o null. */
export function fraseGrupoAusente(grupos: readonly { grupo: Grupo; diasSinComer: number | null }[], desde = 3): string | null {
  const conDato = grupos.filter((g) => GRUPOS_VISIBLES.includes(g.grupo) && g.diasSinComer !== null && g.diasSinComer >= desde)
  if (!conDato.length) return null
  const peor = conDato.reduce((a, b) => ((b.diasSinComer ?? 0) > (a.diasSinComer ?? 0) ? b : a))
  return `Hace ${peor.diasSinComer} días que no come ${GRUPO_EN_FRASE[peor.grupo]}`
}

export function textoVeces(veces: number): string {
  return `Ofrecido ${veces} ${veces === 1 ? 'vez' : 'veces'} de 8 a 15`
}

export interface ComidaConDia extends ComidaResumen { dia: string }

export function hayComidas(dias: readonly CoberturaDia[]): boolean {
  return dias.some((d) => d.comidas.length > 0)
}

/** 'YYYY-MM-DD' + n días (n puede ser negativo). */
export function sumarDias(dia: string, n: number): string {
  const d = new Date(`${dia}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/**
 * Si la semana de `hoy` vino sin comidas, el último día con alguna comida registrada, sacado de lo que B igual
 * calcula sobre todo el historial: los días desde la última vez de cada grupo, la última exposición y las semanas
 * de la evolución que tienen datos. null = nunca se registró nada (el tablero muestra el estado vacío).
 */
export function ultimoDiaConComidas(p: Pick<Progreso, 'grupos' | 'exposiciones' | 'semanas'>, hoy: string): string | null {
  const masNuevo = (dias: string[]) => dias.filter((d) => d < hoy).sort().at(-1) ?? null
  // Primero los días exactos; las semanas de la evolución solo dicen "algún día de esa semana".
  const exactos = [
    ...p.grupos.flatMap((g) => (g.diasSinComer !== null ? [sumarDias(hoy, -g.diasSinComer)] : [])),
    ...p.exposiciones.flatMap((e) => (Number.isFinite(Date.parse(e.ultimaISO)) ? [diaUruguay(new Date(e.ultimaISO))] : [])),
  ]
  const porSemana = p.semanas.filter((s) => Object.values(s.cobertura).some((v) => v > 0)).map((s) => sumarDias(s.desde, 6))
  return masNuevo(exactos) ?? masNuevo(porSemana)
}

/** Días de `desde` a `hasta` ('YYYY-MM-DD'). */
export function diasEntre(desde: string, hasta: string): number {
  return Math.round((diaUTC(hasta).getTime() - diaUTC(desde).getTime()) / 86_400_000)
}

/**
 * B cuenta los días sin comer de cada grupo desde `hasta` (el "hoy" que se le pidió). Para el padre, "hace cuánto"
 * es desde hoy: se suman los días que pasaron entre `hasta` y hoy.
 */
export function gruposDesdeHoy(grupos: Progreso['grupos'], hasta: string, hoy: string): Progreso['grupos'] {
  const desfase = Math.max(diasEntre(hasta, hoy), 0)
  return grupos.map((g) => (g.diasSinComer === null ? g : { ...g, diasSinComer: g.diasSinComer + desfase }))
}

/** Las últimas comidas, de la más nueva a la más vieja. */
export function ultimasComidas(dias: readonly CoberturaDia[], cuantas = 5): ComidaConDia[] {
  return dias
    .flatMap((d) => d.comidas.map((c) => ({ ...c, dia: d.dia })))
    .sort((a, b) => Date.parse(b.fechaISO) - Date.parse(a.fechaISO))
    .slice(0, cuantas)
}

/** El último día con datos (para el detalle "hoy" de cada barra). */
export function ultimoDia(dias: readonly CoberturaDia[]): CoberturaDia | null {
  if (!dias.length) return null
  return [...dias].sort((a, b) => a.dia.localeCompare(b.dia))[dias.length - 1]
}

const diaUTC = (dia: string) => new Date(`${dia}T12:00:00Z`)

/** 'YYYY-MM-DD' → "Hoy", "Ayer" o "viernes 16" (comparado con `hoy`, también 'YYYY-MM-DD' de Uruguay). */
export function etiquetaDia(dia: string, hoy: string): string {
  const diferencia = Math.round((diaUTC(hoy).getTime() - diaUTC(dia).getTime()) / 86_400_000)
  if (diferencia === 0) return 'Hoy'
  if (diferencia === 1) return 'Ayer'
  return new Intl.DateTimeFormat('es-UY', { weekday: 'long', day: 'numeric', timeZone: 'UTC' }).format(diaUTC(dia))
}

/** 'YYYY-MM-DD' → "19/9". */
export function fechaCorta(dia: string): string {
  const [, m, d] = dia.split('-').map(Number)
  return `${d}/${m}`
}

export function mayuscula(s: string): string {
  return s ? s[0].toLocaleUpperCase('es') + s.slice(1) : s
}

const VALOR_LEGIBLE: Record<string, string> = {
  baston: 'bastón', pure: 'puré', marron: 'marrón', acido: 'ácido', frio: 'frío', con_salsa: 'con salsa',
  horno: 'al horno', plancha: 'a la plancha', listo: 'como viene',
}
/** "forma=baston" → "bastón"; "coccion=horno" → "al horno" (para "Se mantiene: …"). */
export function valorAtributo(par: string): string {
  const v = par.includes('=') ? par.slice(par.indexOf('=') + 1) : par
  return VALOR_LEGIBLE[v] ?? v.replace(/_/g, ' ')
}

/** La receta de una sugerencia: el candidato elegido y el nutriente que más falta. */
export function rutaReceta(ninoId: string, preparacionId: string, nutriente?: Nutriente): string {
  const p = new URLSearchParams({ nino: ninoId, preparacionId })
  if (nutriente) p.set('nutriente', nutriente)
  return `/receta?${p.toString()}`
}

/** El contrato no dice si la miniatura trae el prefijo data:, así que se aceptan las dos formas. */
export function srcMiniatura(thumbBase64: string): string {
  return thumbBase64.startsWith('data:') ? thumbBase64 : `data:image/jpeg;base64,${thumbBase64}`
}

/** "Subió de 32% a 40%" · "Se mantuvo en 9%" · "Bajó de 40% a 35%": el resumen en texto de una serie de la evolución. */
export function textoEvolucion(primero: number, ultimo: number): string {
  const a = Math.round(primero * 100)
  const b = Math.round(ultimo * 100)
  if (a === b) return `Se mantuvo en ${b}%`
  return `${b > a ? 'Subió' : 'Bajó'} de ${a}% a ${b}%`
}
