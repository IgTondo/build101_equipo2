// Tests de modelo.ts (A4) con los tres SDK mockeados: nunca llaman a una API real.
// El mock de messages.parse imita al SDK: corre output_config.format.parse() sobre el texto y lo deja en parsed_output.
import {
  APIConnectionTimeoutError, APIUserAbortError, AuthenticationError, InternalServerError, RateLimitError,
} from '@anthropic-ai/sdk'
import { ApiError } from '@google/genai'
import { RateLimitError as RateLimitGroq } from 'groq-sdk'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { ErrorIA } from './errores.js'
import { generarJSON, generarTexto, modeloPara, type Parte } from './modelo.js'

const sdk = vi.hoisted(() => ({ claudeParse: vi.fn(), claudeCreate: vi.fn(), gemini: vi.fn(), groq: vi.fn() }))

vi.mock('@anthropic-ai/sdk', async (original) => {
  const real = await original<typeof import('@anthropic-ai/sdk')>()
  class Anthropic { messages = { parse: sdk.claudeParse, create: sdk.claudeCreate } }
  return { ...real, default: Anthropic }
})
vi.mock('@google/genai', async (original) => {
  const real = await original<typeof import('@google/genai')>()
  class GoogleGenAI { models = { generateContent: sdk.gemini } }
  return { ...real, GoogleGenAI }
})
vi.mock('groq-sdk', async (original) => {
  const real = await original<typeof import('groq-sdk')>()
  class Groq { chat = { completions: { create: sdk.groq } } }
  return { ...real, default: Groq }
})

const Plato = z.object({ alimentos: z.array(z.object({ nombre: z.string(), gramos: z.number() })) })
const VALIDO = '{"alimentos":[{"nombre":"papas fritas","gramos":120}]}'
const SIN_GRAMOS = '{"alimentos":[{"nombre":"papas fritas"}]}'
const PARTES: Parte[] = [{ tipo: 'texto', texto: '¿Qué hay en el plato?' }, { tipo: 'imagen', base64: 'AAAA', mime: 'image/jpeg' }]
const KEY = 'sk-ant-secreta-de-test'

interface ParamsClaude {
  model: string
  max_tokens: number
  messages: { role: string; content: unknown }[]
  output_config?: { effort?: string; format?: { type: string; parse(texto: string): unknown } }
  [otro: string]: unknown
}

function mensajeClaude(params: ParamsClaude, texto: string, stop = 'end_turn') {
  const formato = params.output_config?.format
  return {
    id: 'msg_test', type: 'message', role: 'assistant', model: params.model,
    content: texto ? [{ type: 'thinking', thinking: '', signature: 'firma' }, { type: 'text', text: texto, citations: null }] : [],
    stop_reason: stop,
    parsed_output: texto && formato ? formato.parse(texto) : null,
  }
}

type RespuestaFalsa = string | { texto: string; stop: string } | Error

function claudeResponde(...respuestas: RespuestaFalsa[]) {
  for (const r of respuestas) {
    const responder = async (params: ParamsClaude) => {
      if (r instanceof Error) throw r
      return typeof r === 'string' ? mensajeClaude(params, r) : mensajeClaude(params, r.texto, r.stop)
    }
    sdk.claudeParse.mockImplementationOnce(responder)
    sdk.claudeCreate.mockImplementationOnce(responder)
  }
}

function geminiResponde(texto: string, finishReason = 'STOP') {
  sdk.gemini.mockResolvedValueOnce({
    text: texto,
    candidates: [{ content: { role: 'model', parts: [{ text: texto }] }, finishReason }],
    modelVersion: 'gemini-3.5-flash-lite',
  })
}

function groqResponde(texto: string) {
  sdk.groq.mockResolvedValueOnce({
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    choices: [{ message: { role: 'assistant', content: texto }, finish_reason: 'stop' }],
  })
}

const llamada = (fn: typeof sdk.claudeParse, i = 0) => fn.mock.calls[i][0] as ParamsClaude
const error429 = () => new RateLimitError(429, { type: 'error' }, 'rate limited', new Headers())

async function errorDe(promesa: Promise<unknown>): Promise<ErrorIA> {
  const e = await promesa.then(() => null, (e: unknown) => e)
  expect(e).toBeInstanceOf(ErrorIA)
  return e as ErrorIA
}

beforeEach(() => {
  for (const v of ['GEMINI_API_KEY', 'GROQ_API_KEY', 'PROVEEDOR_IA', 'MODELO_VISION', 'MODELO_RECETA', 'MODELO_GEMINI', 'MODELO_GROQ']) {
    vi.stubEnv(v, '')
  }
  vi.stubEnv('ANTHROPIC_API_KEY', KEY)
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetAllMocks()
})

describe('generarJSON con Claude', () => {
  it('devuelve los datos validados, el modelo y la latencia', async () => {
    claudeResponde(VALIDO)
    const r = await generarJSON({ tarea: 'vision', sistema: 'Sos un nutricionista.', partes: PARTES, schema: Plato })
    expect(r.datos).toEqual({ alimentos: [{ nombre: 'papas fritas', gramos: 120 }] })
    expect(r.modelo).toBe('claude-haiku-5-5')
    expect(r.reintentos).toBe(0)
    expect(r.ms).toBeGreaterThanOrEqual(0)
    const p = llamada(sdk.claudeParse)
    expect(p.system).toBe('Sos un nutricionista.')
    expect(p.max_tokens).toBe(4096)
    // La imagen va antes del texto aunque venga después en `partes`.
    expect(p.messages).toEqual([{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'AAAA' } },
        { type: 'text', text: '¿Qué hay en el plato?' },
      ],
    }])
  })

  it('manda effort dentro de output_config y nunca temperature ni top_p; visión y receta sin thinking (la receta, desde el 18/10: 4 veces más rápida)', async () => {
    claudeResponde(VALIDO, VALIDO)
    await generarJSON({ tarea: 'vision', partes: PARTES, schema: Plato })
    await generarJSON({ tarea: 'receta', partes: PARTES, schema: Plato })
    const [vision, receta] = [llamada(sdk.claudeParse, 0), llamada(sdk.claudeParse, 1)]
    expect(vision.output_config?.effort).toBe('low')
    expect(vision.output_config?.format?.type).toBe('json_schema')
    expect(vision.thinking).toEqual({ type: 'disabled' })
    expect(receta.model).toBe('claude-sonnet-5-5')
    expect(receta.output_config?.effort).toBe('medium')
    expect(receta.thinking).toEqual({ type: 'disabled' })
    for (const p of [vision, receta]) {
      expect(p).not.toHaveProperty('temperature')
      expect(p).not.toHaveProperty('top_p')
      expect(p).not.toHaveProperty('effort')
    }
  })

  it('CLAUDE_SIN_THINKING pisa qué tareas van sin thinking (vacío: todas lo usan)', async () => {
    claudeResponde(VALIDO, VALIDO)
    vi.stubEnv('CLAUDE_SIN_THINKING', '')
    await generarJSON({ tarea: 'vision', partes: PARTES, schema: Plato })
    vi.stubEnv('CLAUDE_SIN_THINKING', 'relato, receta')
    await generarJSON({ tarea: 'receta', partes: PARTES, schema: Plato })
    expect(llamada(sdk.claudeParse, 0)).not.toHaveProperty('thinking')
    expect(llamada(sdk.claudeParse, 1).thinking).toEqual({ type: 'disabled' })
  })

  it('si no valida, reintenta una vez con la respuesta y los problemas de Zod', async () => {
    claudeResponde(SIN_GRAMOS, VALIDO)
    const r = await generarJSON({ tarea: 'vision', partes: PARTES, schema: Plato })
    expect(r.reintentos).toBe(1)
    expect(r.datos.alimentos[0].gramos).toBe(120)
    const segunda = llamada(sdk.claudeParse, 1)
    expect(segunda.messages).toHaveLength(3)
    // La respuesta vuelve entera, con el bloque de thinking.
    expect(segunda.messages[1]).toMatchObject({ role: 'assistant', content: [{ type: 'thinking' }, { type: 'text', text: SIN_GRAMOS }] })
    expect(segunda.messages[2].role).toBe('user')
    expect(segunda.messages[2].content).toContain('alimentos.0.gramos')
    // La primera llamada no se modificó después de mandarla.
    expect(llamada(sdk.claudeParse, 0).messages).toHaveLength(1)
  })

  it('si no valida dos veces, tira json_invalido', async () => {
    claudeResponde('esto no es JSON', SIN_GRAMOS)
    const e = await errorDe(generarJSON({ tarea: 'vision', partes: PARTES, schema: Plato }))
    expect(e.motivo).toBe('json_invalido')
    expect(e.codigo).toBe('proveedor_caido')
    expect(sdk.claudeParse).toHaveBeenCalledTimes(2)
  })

  it('si se corta por max_tokens, repite el pedido con el doble de lugar (sin la respuesta cortada)', async () => {
    claudeResponde({ texto: '{"alimentos":[{"nom', stop: 'max_tokens' }, VALIDO)
    const r = await generarJSON({ tarea: 'vision', partes: PARTES, schema: Plato })
    expect(r.reintentos).toBe(1)
    const segunda = llamada(sdk.claudeParse, 1)
    expect(segunda.max_tokens).toBe(8192)
    expect(segunda.messages).toHaveLength(1)
  })

  it('stop_reason refusal → rechazo, sin reintento', async () => {
    claudeResponde({ texto: '', stop: 'refusal' })
    const e = await errorDe(generarJSON({ tarea: 'vision', partes: PARTES, schema: Plato }))
    expect(e.motivo).toBe('rechazo')
    expect(sdk.claudeParse).toHaveBeenCalledTimes(1)
  })

  it('timeout de conexión → timeout, sin pasar al respaldo', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'gemini-test')
    claudeResponde(new APIConnectionTimeoutError())
    const e = await errorDe(generarJSON({ tarea: 'vision', partes: PARTES, schema: Plato }))
    expect(e.motivo).toBe('timeout')
    expect(e.codigo).toBe('timeout')
    expect(sdk.gemini).not.toHaveBeenCalled()
  })

  it('sin ANTHROPIC_API_KEY → sin_clave, sin llamar al SDK', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '')
    const e = await errorDe(generarJSON({ tarea: 'vision', partes: PARTES, schema: Plato }))
    expect(e.motivo).toBe('sin_clave')
    expect(sdk.claudeParse).not.toHaveBeenCalled()
  })

  it('401 → sin_clave con "key inválida", y la key nunca aparece en el detalle', async () => {
    claudeResponde(new AuthenticationError(401, { type: 'error' }, 'invalid x-api-key', new Headers()))
    const e = await errorDe(generarJSON({ tarea: 'vision', partes: PARTES, schema: Plato }))
    expect(e.motivo).toBe('sin_clave')
    expect(e.detalle.detalle).toContain('key inválida')
    expect(JSON.stringify(e.detalle)).not.toContain(KEY)
  })

  it('MODELO_VISION pisa el modelo de la tarea en cada llamada', async () => {
    vi.stubEnv('MODELO_VISION', 'claude-sonnet-5-5')
    expect(modeloPara('vision')).toBe('claude-sonnet-5-5')
    expect(modeloPara('relato')).toBe('claude-haiku-5-5')
    claudeResponde(VALIDO)
    const r = await generarJSON({ tarea: 'vision', partes: PARTES, schema: Plato })
    expect(llamada(sdk.claudeParse).model).toBe('claude-sonnet-5-5')
    expect(r.modelo).toBe('claude-sonnet-5-5')
    vi.stubEnv('MODELO_VISION', '')
    expect(modeloPara('vision')).toBe('claude-haiku-5-5')
  })

  it('el schema enviado conserva enum y const, cierra cada object y no lleva lo que la API no soporta', async () => {
    const Item = z.object({
      textura: z.enum(['crocante', 'blando']),
      origen: z.literal('duda'),
      confianza: z.number().min(0).max(1),
      nombre: z.string().min(1),
      caja: z.tuple([z.number(), z.number(), z.number(), z.number()]).nullable(),
      atributos: z.object({ coccion: z.enum(['frito', 'horno']).nullable() }),
    })
    const Schema = z.object({ items: z.array(Item).max(3) })
    claudeResponde('{"items":[{"textura":"crocante","origen":"duda","confianza":0.9,"nombre":"papas","caja":[1,2,3,4],"atributos":{"coccion":null}}]}')
    const r = await generarJSON({ tarea: 'vision', partes: PARTES, schema: Schema })
    expect(r.datos.items[0].caja).toEqual([1, 2, 3, 4])
    // Lo que viaja en el pedido (el parse no se serializa).
    const enviado = JSON.parse(JSON.stringify(llamada(sdk.claudeParse).output_config?.format))
    expect(Object.keys(enviado)).toEqual(['type', 'schema'])
    expect(enviado.type).toBe('json_schema')
    const { schema } = enviado
    const item = schema.properties.items.items
    expect(item.properties.textura).toEqual({ type: 'string', enum: ['crocante', 'blando'] })
    expect(item.properties.origen).toEqual({ type: 'string', const: 'duda' })
    expect(item.properties.atributos.properties.coccion.anyOf[0].enum).toEqual(['frito', 'horno'])
    expect(item.properties.caja.anyOf[0]).toMatchObject({ type: 'array', items: { type: 'number' } })
    for (const objeto of [schema, item, item.properties.atributos]) expect(objeto.additionalProperties).toBe(false)
    const texto = JSON.stringify(schema)
    for (const clave of ['$schema', 'minimum', 'maximum', 'minLength', 'maxItems', 'prefixItems']) expect(texto).not.toContain(`"${clave}"`)
    // Las restricciones que no viajan quedan como pista para el modelo (y las sigue validando Zod).
    expect(item.properties.confianza.description).toBe('{minimum: 0, maximum: 1}')
  })

  it('z.record no se puede mandar a Claude: avisa en vez de mandar un object vacío', async () => {
    const ConRecord = z.object({ gramos: z.record(z.string(), z.number()) })
    await expect(generarJSON({ tarea: 'vision', partes: PARTES, schema: ConRecord })).rejects.toThrow(/z\.record/)
    expect(sdk.claudeParse).not.toHaveBeenCalled()
  })

  it('sin partes → entrada_invalida', async () => {
    const e = await errorDe(generarJSON({ tarea: 'vision', partes: [], schema: Plato }))
    expect(e.motivo).toBe('entrada_invalida')
  })
})

describe('generarTexto', () => {
  it('concatena los bloques de texto y no manda format', async () => {
    sdk.claudeCreate.mockResolvedValueOnce({
      model: 'claude-haiku-5-5',
      content: [{ type: 'thinking', thinking: '', signature: 'x' }, { type: 'text', text: 'Esta semana ' }, { type: 'text', text: 'comió 4 verduras.' }],
      stop_reason: 'end_turn',
    })
    const r = await generarTexto({ tarea: 'resumen', partes: [{ tipo: 'texto', texto: 'Resumí.' }] })
    expect(r).toMatchObject({ texto: 'Esta semana comió 4 verduras.', modelo: 'claude-haiku-5-5' })
    const p = llamada(sdk.claudeCreate)
    expect(p.output_config).toEqual({ effort: 'low' })
    expect(p).not.toHaveProperty('temperature')
  })

  it('si se corta por max_tokens, repite con más lugar', async () => {
    claudeResponde({ texto: 'Esta semana', stop: 'max_tokens' }, 'Esta semana comió bien.')
    const r = await generarTexto({ tarea: 'resumen', partes: [{ tipo: 'texto', texto: 'Resumí.' }] })
    expect(r.texto).toBe('Esta semana comió bien.')
    expect(llamada(sdk.claudeCreate, 1).max_tokens).toBe(6144)
  })
})

describe('respaldo en cadena (claude → gemini → groq)', () => {
  it('si Claude da 429 y hay key de Gemini, responde Gemini con el mismo schema', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'gemini-test')
    claudeResponde(error429())
    geminiResponde(VALIDO)
    const r = await generarJSON({ tarea: 'vision', sistema: 'Sistema', partes: PARTES, schema: Plato })
    expect(r.modelo).toBe('gemini-3.5-flash-lite')
    expect(r.datos.alimentos).toHaveLength(1)
    const p = sdk.gemini.mock.calls[0][0]
    expect(p.model).toBe('gemini-3.5-flash-lite')
    expect(p.config.responseMimeType).toBe('application/json')
    expect(p.config.responseJsonSchema).toMatchObject({ type: 'object', required: ['alimentos'] })
    expect(p.config.responseJsonSchema).not.toHaveProperty('$schema')
    expect(p.config.systemInstruction).toBe('Sistema')
    expect(p.config).not.toHaveProperty('temperature')
    expect(p.contents[0].parts[0]).toEqual({ inlineData: { mimeType: 'image/jpeg', data: 'AAAA' } })
  })

  it('si Claude y Gemini fallan, responde Groq (con la imagen como data URL)', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'gemini-test')
    vi.stubEnv('GROQ_API_KEY', 'groq-test')
    vi.stubEnv('MODELO_GROQ', 'otro-modelo-groq')
    claudeResponde(new InternalServerError(529, { type: 'error' }, 'overloaded', new Headers()))
    sdk.gemini.mockRejectedValueOnce(new ApiError({ message: 'server error', status: 500 }))
    groqResponde(VALIDO)
    const r = await generarJSON({ tarea: 'vision', partes: PARTES, schema: Plato })
    expect(r.modelo).toBe('meta-llama/llama-4-scout-17b-16e-instruct')
    const p = sdk.groq.mock.calls[0][0]
    expect(p.model).toBe('otro-modelo-groq')
    expect(p.response_format).toMatchObject({ type: 'json_schema', json_schema: { name: 'respuesta' } })
    expect(p.messages[0].content[0]).toEqual({ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,AAAA' } })
  })

  it('saltea los proveedores sin key; si no queda ninguno, tira el error del principal', async () => {
    claudeResponde(error429())
    const e = await errorDe(generarJSON({ tarea: 'vision', partes: PARTES, schema: Plato }))
    expect(e.motivo).toBe('limite')
    expect(e.codigo).toBe('limite_proveedor')
    expect(sdk.gemini).not.toHaveBeenCalled()
    expect(sdk.groq).not.toHaveBeenCalled()
  })

  it('si fallan todos, el error resume la cadena', async () => {
    vi.stubEnv('GROQ_API_KEY', 'groq-test')
    claudeResponde(error429())
    sdk.groq.mockRejectedValueOnce(new RateLimitGroq(429, { type: 'error' }, 'rate limited', new Headers()))
    const e = await errorDe(generarJSON({ tarea: 'vision', partes: PARTES, schema: Plato }))
    expect(e.motivo).toBe('limite')
    expect(e.detalle.detalle).toBe('fallaron todos: claude (limite), groq (limite)')
  })

  it('json_invalido no pasa al respaldo', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'gemini-test')
    claudeResponde(SIN_GRAMOS, SIN_GRAMOS)
    const e = await errorDe(generarJSON({ tarea: 'vision', partes: PARTES, schema: Plato }))
    expect(e.motivo).toBe('json_invalido')
    expect(sdk.gemini).not.toHaveBeenCalled()
  })

  it('PROVEEDOR_IA=groq usa Groq como principal y corrige con la misma validación', async () => {
    vi.stubEnv('PROVEEDOR_IA', 'groq')
    vi.stubEnv('GROQ_API_KEY', 'groq-test')
    groqResponde(SIN_GRAMOS)
    groqResponde(VALIDO)
    const r = await generarJSON({ tarea: 'relato', partes: PARTES, schema: Plato })
    expect(r.reintentos).toBe(1)
    expect(sdk.claudeParse).not.toHaveBeenCalled()
    const segunda = sdk.groq.mock.calls[1][0]
    expect(segunda.messages.slice(1).map((m: { role: string }) => m.role)).toEqual(['assistant', 'user'])
    expect(segunda.messages[1].content).toBe(SIN_GRAMOS)
  })

  it('PROVEEDOR_IA=gemini: un bloqueo de seguridad es rechazo', async () => {
    vi.stubEnv('PROVEEDOR_IA', 'gemini')
    vi.stubEnv('GEMINI_API_KEY', 'gemini-test')
    geminiResponde('', 'SAFETY')
    const e = await errorDe(generarJSON({ tarea: 'vision', partes: PARTES, schema: Plato }))
    expect(e.motivo).toBe('rechazo')
  })

  it('un PROVEEDOR_IA desconocido es un error de configuración', async () => {
    vi.stubEnv('PROVEEDOR_IA', 'openai')
    const e = await errorDe(generarJSON({ tarea: 'vision', partes: PARTES, schema: Plato }))
    expect(e.motivo).toBe('sin_clave')
    expect(e.detalle.detalle).toContain('openai')
  })
})

describe('limiteMs: presupuesto total de la llamada', () => {
  // Reloj de mentira: cada respuesta falsa puede "tardar" sumándole ms.
  let ahora = 1_000_000
  interface OpcionesPedido { timeout: number; maxRetries: number; signal: AbortSignal }
  const opciones = (fn: typeof sdk.claudeParse, i = 0) => fn.mock.calls[i][1] as OpcionesPedido

  function tarda(ms: number, r: RespuestaFalsa) {
    sdk.claudeParse.mockImplementationOnce(async (params: ParamsClaude) => {
      ahora += ms
      if (r instanceof Error) throw r
      return typeof r === 'string' ? mensajeClaude(params, r) : mensajeClaude(params, r.texto, r.stop)
    })
  }

  beforeEach(() => {
    ahora = 1_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => ahora)
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('sin limiteMs, los pedidos van sin opciones: valen las del cliente (25 s y 1 reintento)', async () => {
    claudeResponde(VALIDO)
    await generarJSON({ tarea: 'vision', partes: PARTES, schema: Plato })
    expect(sdk.claudeParse.mock.calls[0][1]).toBeUndefined()
  })

  it('cada request lleva min(25 s, lo que queda), 1 reintento del SDK solo si quedan más de 30 s, y la señal', async () => {
    claudeResponde(VALIDO, VALIDO)
    await generarJSON({ tarea: 'vision', partes: PARTES, schema: Plato, limiteMs: 50_000 })
    await generarJSON({ tarea: 'vision', partes: PARTES, schema: Plato, limiteMs: 20_000 })
    expect(opciones(sdk.claudeParse, 0)).toMatchObject({ timeout: 25_000, maxRetries: 1 })
    expect(opciones(sdk.claudeParse, 0).signal).toBeInstanceOf(AbortSignal)
    expect(opciones(sdk.claudeParse, 1)).toMatchObject({ timeout: 20_000, maxRetries: 0 })
  })

  it('el reintento por JSON inválido usa lo que queda', async () => {
    tarda(20_000, SIN_GRAMOS)
    claudeResponde(VALIDO)
    const r = await generarJSON({ tarea: 'vision', partes: PARTES, schema: Plato, limiteMs: 40_000 })
    expect(r.reintentos).toBe(1)
    expect(opciones(sdk.claudeParse, 1)).toMatchObject({ timeout: 20_000, maxRetries: 0 })
  })

  it('si quedan menos de 8 s, no reintenta: json_invalido', async () => {
    tarda(13_000, SIN_GRAMOS)
    const e = await errorDe(generarJSON({ tarea: 'vision', partes: PARTES, schema: Plato, limiteMs: 20_000 }))
    expect(e.motivo).toBe('json_invalido')
    expect(e.detalle.detalle).toContain('no quedaba tiempo')
    expect(sdk.claudeParse).toHaveBeenCalledTimes(1)
  })

  it('con el presupuesto agotado → timeout, sin llamar', async () => {
    const e = await errorDe(generarJSON({ tarea: 'vision', partes: PARTES, schema: Plato, limiteMs: 0 }))
    expect(e.motivo).toBe('timeout')
    expect(e.codigo).toBe('timeout')
    expect(sdk.claudeParse).not.toHaveBeenCalled()
  })

  it('si la señal del presupuesto corta el request → timeout, sin pasar al respaldo', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'gemini-test')
    claudeResponde(new APIUserAbortError())
    const e = await errorDe(generarJSON({ tarea: 'vision', partes: PARTES, schema: Plato, limiteMs: 50_000 }))
    expect(e.motivo).toBe('timeout')
    expect(sdk.gemini).not.toHaveBeenCalled()
  })

  it('el respaldo hereda lo que queda del presupuesto', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'gemini-test')
    tarda(25_000, error429())
    geminiResponde(VALIDO)
    const r = await generarJSON({ tarea: 'vision', partes: PARTES, schema: Plato, limiteMs: 45_000 })
    expect(r.modelo).toBe('gemini-3.5-flash-lite')
    const config = sdk.gemini.mock.calls[0][0].config
    expect(config.httpOptions).toEqual({ timeout: 20_000 })
    expect(config.abortSignal).toBeInstanceOf(AbortSignal)
  })

  it('no arranca el respaldo con menos de 8 s: sale el error del principal', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'gemini-test')
    tarda(25_000, error429())
    const e = await errorDe(generarJSON({ tarea: 'vision', partes: PARTES, schema: Plato, limiteMs: 30_000 }))
    expect(e.motivo).toBe('limite')
    expect(sdk.gemini).not.toHaveBeenCalled()
  })

  it('Groq y generarTexto también llevan las opciones por request', async () => {
    vi.stubEnv('PROVEEDOR_IA', 'groq')
    vi.stubEnv('GROQ_API_KEY', 'groq-test')
    groqResponde(VALIDO)
    await generarJSON({ tarea: 'vision', partes: PARTES, schema: Plato, limiteMs: 50_000 })
    expect(sdk.groq.mock.calls[0][1]).toMatchObject({ timeout: 25_000, maxRetries: 1 })
    vi.stubEnv('PROVEEDOR_IA', '')
    claudeResponde('Comió bien.')
    await generarTexto({ tarea: 'resumen', partes: [{ tipo: 'texto', texto: 'Resumí.' }], limiteMs: 10_000 })
    expect(opciones(sdk.claudeCreate)).toMatchObject({ timeout: 10_000, maxRetries: 0 })
  })
})
