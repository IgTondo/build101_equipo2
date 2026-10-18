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
// Hasta que B ordene las sugerencias por ?momento=, la pantalla elige entre las que llegan (§5, Sugerencia.grupo):
// - Encaja con la comida según el grupo (Sugerencia.grupo o, si no viene, el de data/preparaciones.json):
//   desayuno → lácteo, cereal o almidón, fruta; almuerzo y cena → proteína, verdura, cereal o almidón, y lácteo solo
//   si es salado (bastones de queso): lo dulce o bebible (chocolatada, licuado, yogur) es de desayuno o merienda.
// - Primero las que encajan, después las de grupo desconocido, al final las que no encajan.
// - Dentro de cada nivel: un_paso (el corazón del producto), después mas_nutritiva, después segura.

interface InfoPreparacion { grupo: string; sabor: string }
const CATALOGO = new Map<string, InfoPreparacion>(
  (preparaciones as { id: string; atributos: InfoPreparacion }[]).map((p) => [p.id, { grupo: p.atributos.grupo, sabor: p.atributos.sabor }]),
)

const PREFERENCIA: Record<Sugerencia['tipo'], number> = { un_paso: 0, mas_nutritiva: 1, segura: 2 }

/** 2 = encaja, 1 = no sabemos el grupo, 0 = no encaja. */
export function encaja(momento: Principal, s: Pick<Sugerencia, 'preparacionId' | 'grupo'>): 0 | 1 | 2 {
  const info = CATALOGO.get(s.preparacionId)
  const grupo = s.grupo ?? info?.grupo
  if (!grupo) return 1
  if (momento === 'desayuno') return grupo === 'lacteo' || grupo === 'cereal_almidon' || grupo === 'fruta' ? 2 : 0
  if (grupo === 'proteina' || grupo === 'verdura' || grupo === 'cereal_almidon') return 2
  if (grupo === 'lacteo') return info ? (info.sabor === 'salado' ? 2 : 0) : 1
  return 0
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

/** La sugerencia para la próxima comida, o null si no hay ninguna. */
export function elegirSugerencia(p: Pick<Progreso, 'sugerencias' | 'proximoPaso'>, momento: Principal): Sugerencia | null {
  const lista = sugerenciasDe(p)
  if (!lista.length) return null
  return [...lista].sort((a, b) => encaja(momento, b) - encaja(momento, a) || PREFERENCIA[a.tipo] - PREFERENCIA[b.tipo])[0]
}

/** "Se parece a sus papas: cambia solo el ingrediente. Ya los vio 5 veces…" → la primera oración, para una línea. */
export function primeraFrase(texto: string): string {
  const t = texto.trim()
  const i = t.search(/\.\s/)
  const frase = i >= 0 ? t.slice(0, i) : t.replace(/\.$/, '')
  return `${frase}.`
}

/** La receta de la próxima comida: el candidato elegido, el nutriente que más falta y la comida. */
export function rutaRecetaComida(ninoId: string, s: Sugerencia, momento: Principal, nutriente?: string, motor?: string): string {
  const p = new URLSearchParams({ nino: ninoId, preparacionId: s.candidato?.preparacionId ?? s.preparacionId })
  if (nutriente) p.set('nutriente', nutriente)
  p.set('momento', momento)
  if (motor && motor !== 'grafo') p.set('motor', motor)
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
