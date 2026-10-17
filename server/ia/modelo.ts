// Cliente de modelos (PLAN.md §7, A4). Todo lo que pide JSON o texto a un LLM pasa por acá.
// `tarea` elige el modelo: visión, relato, perfil y resumen → Claude Haiku 5.5; receta → Claude Sonnet 5.5.
// PROVEEDOR_IA=claude|gemini|groq cambia de proveedor sin tocar a quien llama.
import type { ZodType } from 'zod'
import { ErrorIA } from './errores.js'

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

export function modeloPara(tarea: Tarea): string {
  return MODELOS_CLAUDE[tarea]
}

// Lanza ErrorIA (ver errores.ts) si falta la key, se pasa del timeout o la salida no valida después del reintento.
export async function generarJSON<T>(opciones: OpcionesJSON<T>): Promise<ResultadoJSON<T>> {
  throw new ErrorIA('no_implementado', `generarJSON(${opciones.tarea}) todavía no está implementado`)
}

export async function generarTexto(opciones: OpcionesTexto): Promise<ResultadoTexto> {
  throw new ErrorIA('no_implementado', `generarTexto(${opciones.tarea}) todavía no está implementado`)
}
