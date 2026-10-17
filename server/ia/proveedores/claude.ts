// Claude con el SDK oficial (PLAN.md §7, A4). JSON con output_config.format (zodOutputFormat) + validación Zod.
// Sin temperature ni top_p, sin `thinking` (corre el adaptativo por defecto) y sin prefill: los modelos 5.5 los
// rechazan. El effort va dentro de output_config.
import Anthropic, {
  APIConnectionTimeoutError,
  AuthenticationError,
  PermissionDeniedError,
  RateLimitError,
  type AutoParseableOutputFormat,
} from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import type { ZodType } from 'zod'
import { ErrorIA } from '../errores.js'
import type { Parte } from '../modelo.js'
import {
  descripcion, ordenarPartes, pedidoDeCorreccion, validarJSON, validarTexto,
  type Conversacion, type Pedido, type Proveedor, type Turno, type Validacion,
} from './comun.js'

let cliente: Anthropic | null = null

export function clienteClaude(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()
  if (!apiKey) throw new ErrorIA('sin_clave', 'falta ANTHROPIC_API_KEY')
  // apiKey explícita: así el SDK nunca cae en un perfil local ni en la suscripción (§4.1).
  cliente ??= new Anthropic({ apiKey, timeout: 25_000, maxRetries: 1 })
  return cliente
}

/** De la clase más específica a la más general. */
export function errorClaude(e: unknown): ErrorIA {
  if (e instanceof ErrorIA) return e
  if (e instanceof APIConnectionTimeoutError) return new ErrorIA('timeout', 'Claude no respondió a tiempo', { causa: e })
  if (e instanceof RateLimitError) return new ErrorIA('limite', `Claude: ${descripcion(e)}`, { causa: e })
  if (e instanceof AuthenticationError || e instanceof PermissionDeniedError) {
    return new ErrorIA('sin_clave', `Claude: key inválida (${e.status})`, { causa: e })
  }
  return new ErrorIA('proveedor', `Claude: ${descripcion(e)}`, { causa: e })
}

async function llamar<R>(pedido: () => Promise<R>): Promise<R> {
  try {
    return await pedido()
  } catch (e) {
    throw errorClaude(e)
  }
}

function contenido(partes: Parte[]): Anthropic.ContentBlockParam[] {
  return ordenarPartes(partes).map((p): Anthropic.ContentBlockParam =>
    p.tipo === 'imagen'
      ? { type: 'image', source: { type: 'base64', media_type: p.mime, data: p.base64 } }
      : { type: 'text', text: p.texto },
  )
}

function corte(motivo: Anthropic.StopReason | null): Turno<unknown>['corte'] {
  if (motivo === 'refusal') return 'rechazo'
  if (motivo === 'max_tokens') return 'max_tokens'
  return 'fin'
}

// messages.parse() tira AnthropicError si la salida no valida, y con eso se pierde la respuesta que el reintento
// tiene que mandar de vuelta. Por eso: el JSON Schema de zodOutputFormat con un parse que no tira.
function formato<T>(schema: ZodType<T>): AutoParseableOutputFormat<Validacion<T>> {
  let base: AutoParseableOutputFormat<T>
  try {
    base = zodOutputFormat(schema)
  } catch (e) {
    throw new Error(`zodOutputFormat no pudo convertir el schema (${descripcion(e)}). z.tuple no está soportado: usá z.array(…).length(n)`)
  }
  return { type: base.type, schema: base.schema, parse: (texto) => validarJSON(schema, texto) }
}

function base(pedido: Pedido, maxTokens: number, mensajes: Anthropic.MessageParam[]) {
  return {
    model: pedido.modelo,
    max_tokens: maxTokens,
    ...(pedido.sistema ? { system: pedido.sistema } : {}),
    messages: [...mensajes], // copia: el array sigue creciendo con la corrección
  }
}

export const proveedorClaude: Proveedor = {
  nombre: 'claude',
  tieneClave: () => Boolean(process.env.ANTHROPIC_API_KEY?.trim()),

  json<T>(pedido: Pedido, schema: ZodType<T>): Conversacion<T> {
    const formatoJSON = formato(schema)
    const mensajes: Anthropic.MessageParam[] = [{ role: 'user', content: contenido(pedido.partes) }]
    let ultima: Anthropic.ContentBlock[] = []
    return {
      async pedir(maxTokens) {
        const r = await llamar(() =>
          clienteClaude().messages.parse({
            ...base(pedido, maxTokens, mensajes),
            output_config: { format: formatoJSON, effort: pedido.effort },
          }),
        )
        ultima = r.content
        const salida = r.parsed_output ?? { ok: false, problemas: 'la respuesta vino sin texto' }
        return { salida, corte: corte(r.stop_reason), modelo: r.model }
      },
      corregir(problemas) {
        // El content va entero (con los bloques de thinking): la API no quiere que se editen.
        mensajes.push({ role: 'assistant', content: ultima }, { role: 'user', content: pedidoDeCorreccion(problemas) })
      },
    }
  },

  texto(pedido: Pedido): Conversacion<string> {
    const mensajes: Anthropic.MessageParam[] = [{ role: 'user', content: contenido(pedido.partes) }]
    return {
      async pedir(maxTokens) {
        const r = await llamar(() =>
          clienteClaude().messages.create({ ...base(pedido, maxTokens, mensajes), output_config: { effort: pedido.effort } }),
        )
        const texto = r.content.map((b) => (b.type === 'text' ? b.text : '')).join('')
        return { salida: validarTexto(texto), corte: corte(r.stop_reason), modelo: r.model }
      },
      corregir() {}, // no se usa: un texto vacío no se corrige, se repite el pedido
    }
  },
}

/** Para /api/salud: no gasta tokens. */
export async function pingClaude(modelo: string): Promise<void> {
  await llamar(() => clienteClaude().models.retrieve(modelo, {}, { timeout: 5_000, maxRetries: 0 }))
}
