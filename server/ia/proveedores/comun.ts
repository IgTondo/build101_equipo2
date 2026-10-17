// Piezas comunes a los proveedores de LLM (PLAN.md §7, A4). Cada proveedor arma una Conversacion; el bucle de
// reintento (modelo.ts) es el mismo para todos: pedir → validar con Zod → si no valida, corregir una vez.
import { z, type ZodType } from 'zod'
import type { Parte } from '../modelo.js'

export type NombreProveedor = 'claude' | 'gemini' | 'groq'
export type Effort = 'low' | 'medium'

/** Lo que modelo.ts ya resolvió a partir de la tarea. */
export interface Pedido {
  modelo: string
  effort: Effort         // solo lo usa Claude (output_config.effort)
  sistema?: string
  partes: Parte[]
}

export type Validacion<T> = { ok: true; datos: T } | { ok: false; problemas: string }

export interface Turno<T> {
  salida: Validacion<T>
  corte: 'fin' | 'max_tokens' | 'rechazo'
  modelo: string         // el que respondió
}

/** `pedir` manda lo acumulado; `corregir` agrega la última respuesta y un pedido de corrección con los problemas. */
export interface Conversacion<T> {
  pedir(maxTokens: number): Promise<Turno<T>>
  corregir(problemas: string): void
}

export interface Proveedor {
  nombre: NombreProveedor
  tieneClave(): boolean
  json<T>(pedido: Pedido, schema: ZodType<T>): Conversacion<T>
  texto(pedido: Pedido): Conversacion<string>
}

export function validarJSON<T>(schema: ZodType<T>, texto: string): Validacion<T> {
  let json: unknown
  try {
    json = JSON.parse(texto)
  } catch (e) {
    return { ok: false, problemas: `no es JSON válido (${descripcion(e)})` }
  }
  const r = schema.safeParse(json)
  if (r.success) return { ok: true, datos: r.data }
  const problemas = r.error.issues.slice(0, 10).map((i) => `- ${i.path.join('.') || '(raíz)'}: ${i.message}`)
  return { ok: false, problemas: problemas.join('\n') }
}

export function validarTexto(texto: string): Validacion<string> {
  const limpio = texto.trim()
  return limpio ? { ok: true, datos: limpio } : { ok: false, problemas: 'la respuesta vino sin texto' }
}

export function pedidoDeCorreccion(problemas: string): string {
  return `Tu respuesta anterior no cumple el schema:\n${problemas}\nRespondé de nuevo solo con el JSON completo y corregido.`
}

/** JSON Schema para Gemini y Groq (Claude usa zodOutputFormat). Sin `$schema`, que no necesitan. */
export function jsonSchemaDe(schema: ZodType): Record<string, unknown> {
  const json: Record<string, unknown> = { ...z.toJSONSchema(schema) }
  delete json.$schema
  return json
}

/** Las imágenes van antes del texto. */
export function ordenarPartes(partes: Parte[]): Parte[] {
  return [...partes.filter((p) => p.tipo === 'imagen'), ...partes.filter((p) => p.tipo === 'texto')]
}

/** Para el `detalle` de un ErrorIA: corto y sin nada que no venga en el mensaje del error. */
export function descripcion(e: unknown): string {
  return (e instanceof Error ? e.message : String(e)).slice(0, 300)
}
