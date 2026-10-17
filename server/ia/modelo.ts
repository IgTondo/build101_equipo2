// Cliente de modelos (PLAN.md §7, A4). Todo lo que pide JSON o texto a un LLM pasa por acá.
// `tarea` elige el modelo: visión, relato, perfil y resumen → Claude Haiku 5.5; receta → Claude Sonnet 5.5.
// PROVEEDOR_IA=claude|gemini|groq cambia de proveedor sin tocar a quien llama (MODELO_GEMINI y MODELO_GROQ eligen el
// modelo de esos dos). Cada proveedor vive en proveedores/; acá están la cadena de respaldo y el reintento.
import type { ZodType } from 'zod'
import { ErrorIA, type MotivoErrorIA } from './errores.js'
import { proveedorClaude } from './proveedores/claude.js'
import {
  MIN_REINTENTO_MS, quedanMs, vencimiento,
  type Conversacion, type Effort, type NombreProveedor, type Pedido, type Proveedor, type Vence,
} from './proveedores/comun.js'
import { proveedorGemini } from './proveedores/gemini.js'
import { proveedorGroq } from './proveedores/groq.js'

export type Tarea = 'vision' | 'relato' | 'perfil' | 'resumen' | 'receta'

export type Parte =
  | { tipo: 'texto'; texto: string }
  | { tipo: 'imagen'; base64: string; mime: 'image/jpeg' | 'image/png' | 'image/webp' }

export interface OpcionesJSON<T> {
  tarea: Tarea
  sistema?: string
  partes: Parte[]
  schema: ZodType<T>     // se manda como JSON Schema (output_config.format) y se valida con Zod; 1 reintento con el error
  maxTokens?: number
  limiteMs?: number      // presupuesto TOTAL: reintento del SDK, corrección y respaldo incluidos (ver conRespaldo)
}

export interface ResultadoJSON<T> {
  datos: T
  modelo: string         // el que respondió de verdad (puede ser el de respaldo)
  ms: number
  reintentos: number
}

export interface OpcionesTexto {
  tarea: Tarea
  sistema?: string
  partes: Parte[]
  maxTokens?: number
  limiteMs?: number      // presupuesto TOTAL, como en OpcionesJSON
}

export interface ResultadoTexto {
  texto: string
  modelo: string
  ms: number
}

export const MODELOS_CLAUDE: Record<Tarea, string> = {
  vision: 'claude-haiku-5-5',
  relato: 'claude-haiku-5-5',
  perfil: 'claude-haiku-5-5',
  resumen: 'claude-haiku-5-5',
  receta: 'claude-sonnet-5-5',
}

/** MODELO_<TAREA> (ej. MODELO_VISION=claude-sonnet-5-5) pisa el de la tabla; se lee en cada llamada (eval A11). */
export function modeloPara(tarea: Tarea): string {
  return process.env[`MODELO_${tarea.toUpperCase()}`]?.trim() || MODELOS_CLAUDE[tarea]
}

const EFFORT: Record<Tarea, Effort> = { vision: 'low', relato: 'low', perfil: 'medium', resumen: 'low', receta: 'medium' }

// Con thinking adaptativo el razonamiento cuenta en max_tokens. Topes holgados para la salida esperada, pero que
// cortan una generación desbocada antes de que se coma los 25 s del timeout.
const MAX_TOKENS: Record<Tarea, number> = { vision: 4096, relato: 3072, perfil: 6144, resumen: 3072, receta: 6144 }
const MAX_TOKENS_REINTENTO = 12_288 // el reintento por max_tokens duplica el tope hasta acá

const MODELO_GEMINI = 'gemini-3.5-flash-lite'
const MODELO_GROQ = 'meta-llama/llama-4-scout-17b-16e-instruct'

const PROVEEDORES: Record<NombreProveedor, Proveedor> = { claude: proveedorClaude, gemini: proveedorGemini, groq: proveedorGroq }
const CADENA: NombreProveedor[] = ['claude', 'gemini', 'groq']
const RESPALDABLE: MotivoErrorIA[] = ['limite', 'proveedor']
const REINTENTOS = 1

function modeloDe(proveedor: NombreProveedor, tarea: Tarea): string {
  if (proveedor === 'gemini') return process.env.MODELO_GEMINI?.trim() || MODELO_GEMINI
  if (proveedor === 'groq') return process.env.MODELO_GROQ?.trim() || MODELO_GROQ
  return modeloPara(tarea)
}

/** El de PROVEEDOR_IA primero; después, los demás en el orden de la cadena. */
function orden(): NombreProveedor[] {
  const principal = (process.env.PROVEEDOR_IA?.trim().toLowerCase() || 'claude') as NombreProveedor
  if (!CADENA.includes(principal)) throw new ErrorIA('sin_clave', `PROVEEDOR_IA="${principal}" no existe (claude | gemini | groq)`)
  return [principal, ...CADENA.filter((p) => p !== principal)]
}

// Si el principal falla por cupo o por un error del proveedor, se prueba el siguiente que tenga key. Con timeout no:
// la función de Vercel corta a los 60 s. El principal se prueba siempre (sin key → sin_clave).
// Con limiteMs, el presupuesto es uno solo para toda la cadena: cada request lleva lo que queda (porPedido) y no se
// arranca un respaldo con menos de MIN_REINTENTO_MS (sale el error del principal).
async function conRespaldo<R>(correr: (proveedor: Proveedor) => Promise<R>, vence: Vence): Promise<R> {
  const fallos: [NombreProveedor, ErrorIA][] = []
  for (const [i, nombre] of orden().entries()) {
    const proveedor = PROVEEDORES[nombre]
    if (i > 0 && !proveedor.tieneClave()) continue
    if (i > 0 && quedanMs(vence) < MIN_REINTENTO_MS) break
    try {
      return await correr(proveedor)
    } catch (e) {
      if (!(e instanceof ErrorIA) || !RESPALDABLE.includes(e.motivo)) throw e
      fallos.push([nombre, e])
    }
  }
  const [, primero] = fallos[0]
  if (fallos.length === 1) throw primero
  const resumen = fallos.map(([nombre, e]) => `${nombre} (${e.motivo})`).join(', ')
  throw new ErrorIA(primero.motivo, `fallaron todos: ${resumen}`, { causa: primero })
}

// Pide, valida y, si no valida, manda la respuesta con los problemas para que la corrija (1 vez). Si se cortó por
// max_tokens, repite el mismo pedido con el doble de lugar: un JSON cortado no se corrige. Con limiteMs, no
// reintenta si quedan menos de MIN_REINTENTO_MS.
async function conversar<T>(conversacion: Conversacion<T>, maxTokens: number, corrige: boolean, vence: Vence) {
  let tope = maxTokens
  let problema = ''
  for (let intento = 0; intento <= REINTENTOS; intento++) {
    if (intento > 0 && quedanMs(vence) < MIN_REINTENTO_MS) {
      throw new ErrorIA('json_invalido', `${problema} (no quedaba tiempo para reintentar)`)
    }
    const turno = await conversacion.pedir(tope)
    if (turno.corte === 'rechazo') throw new ErrorIA('rechazo', `${turno.modelo} no quiso responder`)
    if (turno.corte === 'max_tokens') {
      problema = `se cortó por max_tokens (${tope})`
      tope = Math.max(tope, Math.min(tope * 2, MAX_TOKENS_REINTENTO))
      continue
    }
    if (turno.salida.ok) return { datos: turno.salida.datos, modelo: turno.modelo, reintentos: intento }
    problema = turno.salida.problemas
    if (corrige && intento < REINTENTOS) conversacion.corregir(problema)
  }
  throw new ErrorIA('json_invalido', problema)
}

function pedidoPara(proveedor: Proveedor, opciones: OpcionesTexto, vence: Vence): Pedido {
  if (opciones.partes.length === 0) throw new ErrorIA('entrada_invalida', `${opciones.tarea}: el pedido no tiene partes`)
  return {
    modelo: modeloDe(proveedor.nombre, opciones.tarea),
    effort: EFFORT[opciones.tarea],
    sistema: opciones.sistema,
    partes: opciones.partes,
    vence,
  }
}

// Lanza ErrorIA (ver errores.ts) si falta la key, se pasa del timeout (o de limiteMs) o la salida no valida después
// del reintento.
export async function generarJSON<T>(opciones: OpcionesJSON<T>): Promise<ResultadoJSON<T>> {
  const inicio = Date.now()
  const vence = vencimiento(opciones.limiteMs)
  const tope = opciones.maxTokens ?? MAX_TOKENS[opciones.tarea]
  const r = await conRespaldo((p) => conversar(p.json(pedidoPara(p, opciones, vence), opciones.schema), tope, true, vence), vence)
  return { ...r, ms: Date.now() - inicio }
}

export async function generarTexto(opciones: OpcionesTexto): Promise<ResultadoTexto> {
  const inicio = Date.now()
  const vence = vencimiento(opciones.limiteMs)
  const tope = opciones.maxTokens ?? MAX_TOKENS[opciones.tarea]
  const r = await conRespaldo((p) => conversar(p.texto(pedidoPara(p, opciones, vence)), tope, false, vence), vence)
  return { texto: r.datos, modelo: r.modelo, ms: Date.now() - inicio }
}
