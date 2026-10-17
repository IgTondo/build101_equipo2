// Gemini Flash-Lite con @google/genai (respaldo, PLAN.md §4.1). Variable: GEMINI_API_KEY; modelo: MODELO_GEMINI.
// El schema va con z.toJSONSchema y la salida pasa por la misma validación Zod que Claude.
import { ApiError, FinishReason, GoogleGenAI, type Content, type GenerateContentConfig, type Part } from '@google/genai'
import type { ZodType } from 'zod'
import { ErrorIA } from '../errores.js'
import type { Parte } from '../modelo.js'
import {
  descripcion, jsonSchemaDe, ordenarPartes, pedidoDeCorreccion, validarJSON, validarTexto,
  type Conversacion, type Pedido, type Proveedor, type Turno, type Validacion,
} from './comun.js'

let cliente: GoogleGenAI | null = null

function clienteGemini(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) throw new ErrorIA('sin_clave', 'falta GEMINI_API_KEY')
  cliente ??= new GoogleGenAI({ apiKey, httpOptions: { timeout: 25_000 } })
  return cliente
}

function errorGemini(e: unknown): ErrorIA {
  if (e instanceof ErrorIA) return e
  // El SDK corta con un AbortController al llegar a httpOptions.timeout.
  if (e instanceof Error && (e.name === 'AbortError' || e.name === 'TimeoutError')) {
    return new ErrorIA('timeout', 'Gemini no respondió a tiempo', { causa: e })
  }
  if (e instanceof ApiError && e.status === 429) return new ErrorIA('limite', `Gemini: ${descripcion(e)}`, { causa: e })
  if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
    return new ErrorIA('sin_clave', `Gemini: key inválida (${e.status})`, { causa: e })
  }
  return new ErrorIA('proveedor', `Gemini: ${descripcion(e)}`, { causa: e })
}

const RECHAZOS: string[] = [
  FinishReason.SAFETY, FinishReason.PROHIBITED_CONTENT, FinishReason.BLOCKLIST, FinishReason.SPII, FinishReason.RECITATION,
]

function partes(lista: Parte[]): Part[] {
  return ordenarPartes(lista).map((p): Part =>
    p.tipo === 'imagen' ? { inlineData: { mimeType: p.mime, data: p.base64 } } : { text: p.texto },
  )
}

function conversacion<T>(pedido: Pedido, validar: (texto: string) => Validacion<T>, config: GenerateContentConfig): Conversacion<T> {
  const contenidos: Content[] = [{ role: 'user', parts: partes(pedido.partes) }]
  let ultima: Content | undefined
  return {
    async pedir(maxTokens) {
      let r
      try {
        r = await clienteGemini().models.generateContent({
          model: pedido.modelo,
          contents: [...contenidos],
          config: { ...config, ...(pedido.sistema ? { systemInstruction: pedido.sistema } : {}), maxOutputTokens: maxTokens },
        })
      } catch (e) {
        throw errorGemini(e)
      }
      const candidato = r.candidates?.[0]
      ultima = candidato?.content
      const motivo = candidato?.finishReason
      const corte: Turno<T>['corte'] =
        r.promptFeedback?.blockReason || (motivo && RECHAZOS.includes(motivo)) ? 'rechazo'
          : motivo === FinishReason.MAX_TOKENS ? 'max_tokens'
            : 'fin'
      return { salida: validar(r.text ?? ''), corte, modelo: r.modelVersion ?? pedido.modelo }
    },
    corregir(problemas) {
      if (ultima) contenidos.push(ultima) // tal cual vino (con sus thought signatures)
      contenidos.push({ role: 'user', parts: [{ text: pedidoDeCorreccion(problemas) }] })
    },
  }
}

export const proveedorGemini: Proveedor = {
  nombre: 'gemini',
  tieneClave: () => Boolean(process.env.GEMINI_API_KEY?.trim()),
  json: <T>(pedido: Pedido, schema: ZodType<T>) =>
    conversacion(pedido, (texto) => validarJSON(schema, texto), {
      responseMimeType: 'application/json',
      responseJsonSchema: jsonSchemaDe(schema),
    }),
  texto: (pedido: Pedido) => conversacion(pedido, validarTexto, {}),
}
