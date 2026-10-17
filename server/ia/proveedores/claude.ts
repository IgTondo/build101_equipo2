// Claude con el SDK oficial (PLAN.md §7, A4). JSON con output_config.format (JSON Schema propio, ver schemaClaude)
// + validación Zod. Sin temperature ni top_p, sin `thinking` (corre el adaptativo por defecto) y sin prefill: los
// modelos 5.5 los rechazan. El effort va dentro de output_config.
import Anthropic, {
  APIConnectionTimeoutError,
  APIUserAbortError,
  AuthenticationError,
  PermissionDeniedError,
  RateLimitError,
  type AutoParseableOutputFormat,
} from '@anthropic-ai/sdk'
import { z, type ZodType } from 'zod'
import { ErrorIA } from '../errores.js'
import type { Parte } from '../modelo.js'
import {
  descripcion, ordenarPartes, pedidoDeCorreccion, porPedido, validarJSON, validarTexto,
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
  // La única señal que mandamos es la de limiteMs (porPedido): si cortó, se acabó el presupuesto.
  if (e instanceof APIUserAbortError) return new ErrorIA('timeout', 'Claude: se agotó el tiempo de la llamada (limiteMs)', { causa: e })
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

type Nodo = Record<string, unknown>

const FORMATOS = new Set(['date-time', 'time', 'date', 'duration', 'email', 'hostname', 'uri', 'ipv4', 'ipv6', 'uuid'])
const A_LA_DESCRIPCION = new Set([
  'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf', 'minLength', 'maxLength', 'pattern', 'minItems', 'maxItems',
])

const adaptarTodos = (nodos: unknown) => (nodos as Nodo[]).map(adaptar)
const adaptarMapa = (mapa: unknown) => Object.fromEntries(Object.entries(mapa as Record<string, Nodo>).map(([k, v]) => [k, adaptar(v)]))

// Un nodo de z.toJSONSchema → lo que acepta la salida estructurada. Se queda con type, enum, const, anyOf, allOf,
// properties, required, items, $ref/$defs, description, title, los formatos soportados y minItems 0 o 1; cada object
// lleva additionalProperties: false. Las restricciones que la API no acepta van como pista en la descripción (como
// hace el SDK) y Zod las sigue validando. El resto ($schema, default…) se descarta.
function adaptar(nodo: Nodo): Nodo {
  const fuera: Nodo = {}
  const pistas: string[] = []
  for (const [clave, valor] of Object.entries(nodo)) {
    if (['type', 'enum', 'const', 'required', 'title', 'description', '$ref'].includes(clave)) fuera[clave] = valor
    else if (clave === 'properties') fuera.properties = adaptarMapa(valor)
    else if (clave === '$defs') fuera.$defs = adaptarMapa(valor)
    else if (clave === 'anyOf' || clave === 'oneOf') fuera.anyOf = adaptarTodos(valor)
    else if (clave === 'allOf') fuera.allOf = adaptarTodos(valor)
    else if (clave === 'items' && typeof valor === 'object') fuera.items = adaptar(valor as Nodo)
    else if (clave === 'prefixItems') {
      // z.tuple: la API no tiene tuplas; va como array del tipo de sus elementos y Zod controla el largo.
      const elementos = adaptarTodos(valor)
      const iguales = elementos.every((e) => JSON.stringify(e) === JSON.stringify(elementos[0]))
      fuera.items = iguales ? elementos[0] : { anyOf: elementos }
    } else if (clave === 'format' && FORMATOS.has(String(valor))) fuera.format = valor
    else if (clave === 'minItems' && (valor === 0 || valor === 1)) fuera.minItems = valor
    else if (clave === 'propertyNames' || (clave === 'additionalProperties' && typeof valor === 'object' && valor && Object.keys(valor).length)) {
      throw new Error('La salida estructurada de Claude no acepta z.record (pide additionalProperties: false): usá un array de objetos')
    } else if (A_LA_DESCRIPCION.has(clave) && Math.abs(Number(valor)) !== Number.MAX_SAFE_INTEGER) {
      pistas.push(`${clave}: ${JSON.stringify(valor)}`)
    }
  }
  if (fuera.type === 'object') {
    fuera.properties ??= {}
    fuera.additionalProperties = false
  }
  if (pistas.length) fuera.description = [fuera.description, `{${pistas.join(', ')}}`].filter(Boolean).join('\n\n')
  return fuera
}

/** El JSON Schema que va en output_config.format. No usamos el de zodOutputFormat: manda enum y const a la descripción. */
export function schemaClaude(schema: ZodType): Nodo {
  return adaptar(z.toJSONSchema(schema) as Nodo)
}

// messages.parse() tira AnthropicError si la salida no valida, y con eso se pierde la respuesta que el reintento
// tiene que mandar de vuelta. Por eso el formato lleva un parse que no tira (en el pedido viaja { type, schema }).
function formato<T>(schema: ZodType<T>): AutoParseableOutputFormat<Validacion<T>> {
  return { type: 'json_schema', schema: schemaClaude(schema), parse: (texto) => validarJSON(schema, texto) }
}

function base(pedido: Pedido, maxTokens: number, mensajes: Anthropic.MessageParam[]) {
  return {
    model: pedido.modelo,
    max_tokens: maxTokens,
    ...(pedido.sinThinking ? { thinking: { type: 'disabled' as const } } : {}),
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
          }, porPedido(pedido.vence)),
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
          clienteClaude().messages.create(
            { ...base(pedido, maxTokens, mensajes), output_config: { effort: pedido.effort } },
            porPedido(pedido.vence),
          ),
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
