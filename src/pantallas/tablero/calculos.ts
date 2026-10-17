// Funciones puras del tablero (C3): orden, escalas y textos. Sin React, para poder testearlas.
import { MOTOR, type CoberturaDia, type ComidaResumen, type Grupo, type Motor, type Nutriente, type Nutrientes, type PatronVista } from '../../../shared/contratos'
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

export function nivelConfianza(confianza: number): 'alta' | 'media' | 'baja' {
  if (confianza >= 0.8) return 'alta'
  if (confianza >= 0.5) return 'media'
  return 'baja'
}

/** Patrones: primero lo aprendido de sus comidas, después la investigación; dentro, por evidencia (apoyo × confianza). */
export function ordenarPatrones(patrones: readonly PatronVista[]): PatronVista[] {
  const peso = (p: PatronVista) => p.apoyo * p.confianza
  return [...patrones].sort((a, b) => (a.fuente === b.fuente ? peso(b) - peso(a) : a.fuente === 'aprendido' ? -1 : 1))
}

export interface ComidaConDia extends ComidaResumen { dia: string }

export function hayComidas(dias: readonly CoberturaDia[]): boolean {
  return dias.some((d) => d.comidas.length > 0)
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

export function leerMotor(valor: string | null): Motor {
  return (MOTOR as readonly string[]).includes(valor ?? '') ? (valor as Motor) : 'grafo'
}

/** La receta de una sugerencia: el candidato elegido y el nutriente que más falta. El motor viaja si no es el de siempre. */
export function rutaReceta(ninoId: string, preparacionId: string, nutriente?: Nutriente, motor: Motor = 'grafo'): string {
  const p = new URLSearchParams({ nino: ninoId, preparacionId })
  if (nutriente) p.set('nutriente', nutriente)
  if (motor !== 'grafo') p.set('motor', motor)
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
