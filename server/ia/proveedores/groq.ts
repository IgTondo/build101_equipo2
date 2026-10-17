// Groq con groq-sdk (PLAN.md §4.1): Llama 4 Scout como respaldo del LLM (acepta imágenes) y Whisper para voz.ts.
// Variable: GROQ_API_KEY; modelo del LLM: MODELO_GROQ. Misma validación Zod que Claude.
import Groq, { APIConnectionTimeoutError, AuthenticationError, PermissionDeniedError, RateLimitError } from 'groq-sdk'
import type { ChatCompletionContentPart, ChatCompletionMessageParam } from 'groq-sdk/resources/chat/completions'
import type { ZodType } from 'zod'
import { ErrorIA } from '../errores.js'
import type { Parte } from '../modelo.js'
import {
  descripcion, jsonSchemaDe, ordenarPartes, pedidoDeCorreccion, validarJSON, validarTexto,
  type Conversacion, type Pedido, type Proveedor, type Validacion,
} from './comun.js'

let cliente: Groq | null = null

export function clienteGroq(): Groq {
  const apiKey = process.env.GROQ_API_KEY?.trim()
  if (!apiKey) throw new ErrorIA('sin_clave', 'falta GROQ_API_KEY')
  cliente ??= new Groq({ apiKey, timeout: 25_000, maxRetries: 1 })
  return cliente
}

export function tieneClaveGroq(): boolean {
  return Boolean(process.env.GROQ_API_KEY?.trim())
}

/** De la clase más específica a la más general. */
export function errorGroq(e: unknown): ErrorIA {
  if (e instanceof ErrorIA) return e
  if (e instanceof APIConnectionTimeoutError) return new ErrorIA('timeout', 'Groq no respondió a tiempo', { causa: e })
  if (e instanceof RateLimitError) return new ErrorIA('limite', `Groq: ${descripcion(e)}`, { causa: e })
  if (e instanceof AuthenticationError || e instanceof PermissionDeniedError) {
    return new ErrorIA('sin_clave', `Groq: key inválida (${e.status})`, { causa: e })
  }
  return new ErrorIA('proveedor', `Groq: ${descripcion(e)}`, { causa: e })
}

function contenido(partes: Parte[]): ChatCompletionContentPart[] {
  return ordenarPartes(partes).map((p): ChatCompletionContentPart =>
    p.tipo === 'imagen'
      ? { type: 'image_url', image_url: { url: `data:${p.mime};base64,${p.base64}` } }
      : { type: 'text', text: p.texto },
  )
}

function conversacion<T>(pedido: Pedido, validar: (texto: string) => Validacion<T>, schema?: ZodType<T>): Conversacion<T> {
  const mensajes: ChatCompletionMessageParam[] = [
    ...(pedido.sistema ? [{ role: 'system' as const, content: pedido.sistema }] : []),
    { role: 'user', content: contenido(pedido.partes) },
  ]
  let ultima = ''
  return {
    async pedir(maxTokens) {
      let r
      try {
        r = await clienteGroq().chat.completions.create({
          model: pedido.modelo,
          messages: [...mensajes],
          max_completion_tokens: maxTokens,
          ...(schema
            ? { response_format: { type: 'json_schema' as const, json_schema: { name: 'respuesta', schema: jsonSchemaDe(schema) } } }
            : {}),
        })
      } catch (e) {
        throw errorGroq(e)
      }
      const eleccion = r.choices[0]
      ultima = eleccion?.message.content ?? ''
      const corte = eleccion?.finish_reason === 'length' ? 'max_tokens' : 'fin'
      return { salida: validar(ultima), corte, modelo: r.model }
    },
    corregir(problemas) {
      mensajes.push({ role: 'assistant', content: ultima }, { role: 'user', content: pedidoDeCorreccion(problemas) })
    },
  }
}

export const proveedorGroq: Proveedor = {
  nombre: 'groq',
  tieneClave: tieneClaveGroq,
  json: <T>(pedido: Pedido, schema: ZodType<T>) => conversacion(pedido, (texto) => validarJSON(schema, texto), schema),
  texto: (pedido: Pedido) => conversacion(pedido, validarTexto),
}

/** Para /api/salud: listar modelos no gasta cupo. */
export async function pingGroq(): Promise<void> {
  try {
    await clienteGroq().models.list({ timeout: 5_000, maxRetries: 0 })
  } catch (e) {
    throw errorGroq(e)
  }
}
