// La próxima comida (PLAN v5.1, §9 "La pantalla principal"): el día se organiza en comidas y cada registro sugiere
// la siguiente. Funciones puras (sin React), testeadas en proximaComida.test.ts.
//
// Reglas:
// 1. La secuencia es desayuno → almuerzo → cena → desayuno de mañana. Cada comida registrada hoy ocupa un lugar en
//    esa secuencia (merienda: entre el almuerzo y la cena; colación: a media mañana si fue antes de las 12, si no a
//    media tarde) y la próxima es la principal que sigue a la más avanzada.
// 2. La hora pone un piso: nunca se sugiere una comida que ya pasó (antes de las 10, desayuno; antes de las 15,
//    almuerzo; antes de las 22, cena; desde las 22, el desayuno de mañana). Sin comidas hoy, manda solo la hora.
import type { ComidaResumen, Momento, Progreso, Sugerencia } from '../../shared/contratos'
import preparaciones from '../../data/preparaciones.json'
import { NOMBRE_CAMBIO } from './vocabulario'

export type Principal = 'desayuno' | 'almuerzo' | 'cena'
/** v5.3 · las comidas que el padre puede planificar en el inicio (la merienda también, aunque la secuencia la saltee). */
export type ComidaPlan = Principal | 'merienda'

export interface ProximaComida {
  momento: Principal
  /** El desayuno de mañana (ya pasó la cena o es tarde). */
  manana: boolean
  /** "Para el almuerzo" · "Para mañana: desayuno" */
  etiqueta: string
}

/** Lo mínimo de una comida para ubicarla en el día. */
export type ComidaDelDia = Pick<ComidaResumen, 'momento' | 'fechaISO'>

// Lugares en la secuencia del día: 0 desayuno, 1 almuerzo, 2 cena, 3 desayuno de mañana.
const PRINCIPALES: Principal[] = ['desayuno', 'almuerzo', 'cena']
const LUGAR: Record<Exclude<Momento, 'colacion'>, number> = { desayuno: 0, almuerzo: 1, merienda: 1.5, cena: 2 }

const ETIQUETA: Record<Principal, string> = {
  desayuno: 'Para el desayuno', almuerzo: 'Para el almuerzo', cena: 'Para la cena',
}

/** La hora (0–23) de Uruguay de una fecha. */
export function horaUruguay(fecha = new Date()): number {
  const h = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Montevideo', hour: 'numeric', hourCycle: 'h23' }).format(fecha)
  return Number(h) % 24
}

/** El lugar de la comida que corresponde por la hora (el piso de la regla 2). */
export function lugarPorHora(hora: number): number {
  if (hora < 10) return 0
  if (hora < 15) return 1
  if (hora < 22) return 2
  return 3
}

function lugarDe(c: ComidaDelDia): number {
  if (c.momento !== 'colacion') return LUGAR[c.momento]
  const t = Date.parse(c.fechaISO)
  const hora = Number.isFinite(t) ? horaUruguay(new Date(t)) : 12
  return hora < 12 ? 0.5 : 1.5
}

/** La próxima comida principal, dadas las comidas registradas hoy y la hora de Uruguay. */
export function proximaComida(comidasHoy: readonly ComidaDelDia[], hora: number): ProximaComida {
  const ultima = comidasHoy.reduce((max, c) => Math.max(max, lugarDe(c)), -1)
  const siguiente = Math.floor(ultima) + 1               // la principal que sigue a la más avanzada
  const lugar = Math.min(Math.max(siguiente, lugarPorHora(hora)), 3)
  if (lugar === 3) return { momento: 'desayuno', manana: true, etiqueta: 'Para mañana: desayuno' }
  const momento = PRINCIPALES[lugar]
  return { momento, manana: false, etiqueta: ETIQUETA[momento] }
}

/** La comida que el padre probablemente acaba de terminar (para preseleccionarla al registrar). */
export function comidaRecienPorHora(hora: number): Momento {
  if (hora < 10) return 'desayuno'
  if (hora < 15) return 'almuerzo'
  if (hora < 19) return 'merienda'
  return 'cena'
}

/** Las comidas de `dia` ('YYYY-MM-DD' de Uruguay) en el progreso, más las que se acaban de registrar (sin repetir). */
export function comidasDelDia(
  dias: Progreso['dias'] | undefined, dia: string, extra: readonly (ComidaDelDia & { id?: string })[] = [],
): ComidaDelDia[] {
  const delProgreso = dias?.find((d) => d.dia === dia)?.comidas ?? []
  const ids = new Set(delProgreso.map((c) => c.id))
  return [...delProgreso, ...extra.filter((c) => !c.id || !ids.has(c.id))]
}

// ---------- La sugerencia para esa comida ----------
// v5.2 · Cada preparación del catálogo dice para qué comidas va (`momentos` en data/preparaciones.json, curado a mano).
// - Con ?momento=, B ya filtra y lo dice en Progreso.momento: si es esta comida, todas encajan.
// - Si el progreso no vino filtrado para esta comida (el fixture, o el inicio pidió por la hora y la próxima comida
//   resultó otra), la pantalla filtra igual con el catálogo. Lo que no está en el catálogo no encaja.
// - Nunca se muestra una que no encaja: si no queda ninguna, null (la tarjeta muestra el mensaje calmo).
// - Entre las que encajan: un_paso (el corazón del producto), después mas_nutritiva, después segura.

const MOMENTOS = new Map<string, readonly string[]>(
  (preparaciones as { id: string; momentos?: string[] }[]).map((p) => [p.id, p.momentos ?? []]),
)

const PREFERENCIA: Record<Sugerencia['tipo'], number> = { un_paso: 0, mas_nutritiva: 1, segura: 2 }

/** ¿La preparación va en esa comida, según el catálogo? */
export function encaja(momento: ComidaPlan, s: Pick<Sugerencia, 'preparacionId'>): boolean {
  return MOMENTOS.get(s.preparacionId)?.includes(momento) ?? false
}

/** Las sugerencias del progreso; si no vinieron, el proximoPaso como una de un_paso (como en el tablero). */
export function sugerenciasDe(p: Pick<Progreso, 'sugerencias' | 'proximoPaso'>): Sugerencia[] {
  if (p.sugerencias?.length) return p.sugerencias
  const c = p.proximoPaso
  if (!c) return []
  return [{
    tipo: 'un_paso', preparacionId: c.preparacionId, nombre: c.nombre, probAcepta: c.puntaje, aporte: c.aportePorcion, candidato: c,
    porQue: `Se parece a ${c.camino.desde.toLocaleLowerCase('es')}: cambia solo ${NOMBRE_CAMBIO[c.cambio]}.`,
  }]
}

/** La sugerencia para la próxima comida, o null si ninguna encaja con esa comida. */
export function elegirSugerencia(p: Pick<Progreso, 'sugerencias' | 'proximoPaso' | 'momento'>, momento: ComidaPlan): Sugerencia | null {
  const filtradas = p.momento === momento
  const lista = sugerenciasDe(p).filter((s) => filtradas || encaja(momento, s))
  return lista.sort((a, b) => PREFERENCIA[a.tipo] - PREFERENCIA[b.tipo])[0] ?? null
}

/** "Se parece a sus papas: cambia solo el ingrediente. Ya los vio 5 veces…" → la primera oración, para una línea. */
export function primeraFrase(texto: string): string {
  const t = texto.trim()
  const i = t.search(/\.\s/)
  const frase = i >= 0 ? t.slice(0, i) : t.replace(/\.$/, '')
  return `${frase}.`
}

/**
 * Una línea para la tarjeta de la próxima comida: la primera oración y, si tiene "dos puntos", lo de antes
 * ("Se parece a sus papas al horno en bastones: cambia solo el ingrediente. Ya los vio…" → "Se parece a sus papas
 * al horno en bastones."). El porqué completo está en la receta.
 */
export function lineaPorQue(texto: string): string {
  const frase = primeraFrase(texto).replace(/\.$/, '')
  const i = frase.indexOf(': ')
  return `${i > 0 ? frase.slice(0, i) : frase}.`
}

/**
 * La receta de la próxima comida: el candidato elegido, el nutriente que más falta y la comida.
 * v5.3 · `ver: 'plato'` abre la receta en la imagen del plato completo ("Ver cómo servirlo").
 */
export function rutaRecetaComida(ninoId: string, s: Sugerencia, momento: ComidaPlan, nutriente?: string, ver?: 'plato'): string {
  const p = new URLSearchParams({ nino: ninoId, preparacionId: s.candidato?.preparacionId ?? s.preparacionId })
  if (nutriente) p.set('nutriente', nutriente)
  p.set('momento', momento)
  if (ver) p.set('ver', ver)
  return `/receta?${p.toString()}`
}

// ---------- La última comida registrada en este celular ----------
// Para que el inicio pida /api/progreso con el ?momento= correcto en una sola vuelta. Opcional: sin storage, la
// pantalla usa la hora y corrige con las comidas que trae el progreso.
const CLAVE = (ninoId: string) => `nibble:ultima-comida:${ninoId}`

export function guardarUltimaComida(ninoId: string, c: ComidaDelDia & { id?: string; dia: string }): void {
  try { localStorage.setItem(CLAVE(ninoId), JSON.stringify(c)) } catch { /* sin storage */ }
}

export function leerUltimaComida(ninoId: string, dia: string): (ComidaDelDia & { id?: string }) | null {
  try {
    const c = JSON.parse(localStorage.getItem(CLAVE(ninoId)) ?? 'null') as (ComidaDelDia & { id?: string; dia: string }) | null
    return c && c.dia === dia && typeof c.momento === 'string' ? c : null
  } catch { return null }
}
