// Tests de voz.ts (A4/A7): Groq mockeado y fetch falso para Workers AI. Nunca llaman a una API real.
import { APIConnectionTimeoutError, RateLimitError } from 'groq-sdk'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ErrorIA } from './errores.js'
import { sinFrasesInventadas, transcribir } from './voz.js'

const sdk = vi.hoisted(() => ({ transcribir: vi.fn() }))

vi.mock('groq-sdk', async (original) => {
  const real = await original<typeof import('groq-sdk')>()
  class Groq { audio = { transcriptions: { create: sdk.transcribir } } }
  return { ...real, default: Groq }
})

const AUDIO = Buffer.from('audio de prueba').toString('base64')
const fetchFalso = vi.fn()

function cloudflareResponde(cuerpo: unknown, status = 200) {
  fetchFalso.mockResolvedValueOnce(new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json' } }))
}

async function errorDe(promesa: Promise<unknown>): Promise<ErrorIA> {
  const e = await promesa.then(() => null, (e: unknown) => e)
  expect(e).toBeInstanceOf(ErrorIA)
  return e as ErrorIA
}

beforeEach(() => {
  vi.stubEnv('GROQ_API_KEY', 'groq-test')
  vi.stubEnv('CLOUDFLARE_ACCOUNT_ID', '')
  vi.stubEnv('CLOUDFLARE_API_TOKEN', '')
  vi.stubGlobal('fetch', fetchFalso)
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.resetAllMocks()
})

describe('transcribir con Groq', () => {
  it('manda el audio como archivo con la extensión del mime, en español y con la pista', async () => {
    sdk.transcribir.mockResolvedValueOnce({ text: '  Comió las papas y el dambo lo apartó.  ' })
    const r = await transcribir({ audioBase64: AUDIO, mime: 'audio/webm;codecs=opus', pista: 'papas fritas, dambo' })
    expect(r).toMatchObject({ texto: 'Comió las papas y el dambo lo apartó.', modelo: 'whisper-large-v3-turbo' })
    expect(r.ms).toBeGreaterThanOrEqual(0)
    const p = sdk.transcribir.mock.calls[0][0]
    expect(p).toMatchObject({ model: 'whisper-large-v3-turbo', language: 'es', prompt: 'papas fritas, dambo' })
    expect(p.file.name).toBe('nota.webm')
    expect(p.file.type).toBe('audio/webm')
    expect(Buffer.from(await p.file.arrayBuffer()).toString()).toBe('audio de prueba')
  })

  it.each([
    ['audio/mp4', 'nota.m4a'],
    ['audio/mpeg', 'nota.mp3'],
    ['audio/ogg;codecs=opus', 'nota.ogg'],
    ['audio/wav', 'nota.wav'],
    ['AUDIO/WEBM', 'nota.webm'],
  ])('%s → %s', async (mime, archivo) => {
    sdk.transcribir.mockResolvedValueOnce({ text: 'hola' })
    await transcribir({ audioBase64: AUDIO, mime })
    expect(sdk.transcribir.mock.calls[0][0].file.name).toBe(archivo)
    expect(sdk.transcribir.mock.calls[0][0]).not.toHaveProperty('prompt')
  })

  it('un formato que Whisper no lee → entrada_invalida, sin llamar a Groq', async () => {
    const e = await errorDe(transcribir({ audioBase64: AUDIO, mime: 'audio/flac' }))
    expect(e.motivo).toBe('entrada_invalida')
    expect(sdk.transcribir).not.toHaveBeenCalled()
  })

  it('transcripción vacía → audio_vacio con el código de contrato audio_no_entendido', async () => {
    sdk.transcribir.mockResolvedValueOnce({ text: '   ' })
    const e = await errorDe(transcribir({ audioBase64: AUDIO, mime: 'audio/mp4' }))
    expect(e.motivo).toBe('audio_vacio')
    expect(e.codigo).toBe('audio_no_entendido')
  })

  it('audio vacío → audio_no_entendido, sin llamar a Groq', async () => {
    const e = await errorDe(transcribir({ audioBase64: '', mime: 'audio/mp4' }))
    expect(e.codigo).toBe('audio_no_entendido')
    expect(sdk.transcribir).not.toHaveBeenCalled()
  })

  it('recorta la pista a lo que Whisper usa', async () => {
    sdk.transcribir.mockResolvedValueOnce({ text: 'hola' })
    await transcribir({ audioBase64: AUDIO, mime: 'audio/mp4', pista: 'milanesa, '.repeat(200) })
    expect(sdk.transcribir.mock.calls[0][0].prompt.length).toBeLessThanOrEqual(600)
  })
})

describe('frases que Whisper inventa con silencio o ruido', () => {
  it.each([
    'Subtítulos realizados por la comunidad de Amara.org',
    ' Subtítulos por la comunidad de Amara.org',
    'subtitulos realizados por la comunidad de amara.org',
    'Subtitulado por la comunidad de Amara.org.',
    '¡Gracias por ver el video!',
    'Gracias por ver.',
    'Muchas gracias por ver el vídeo. ¡Suscríbete al canal!',
    'Gracias por ver, suscríbete al canal.',
    'SUSCRÍBETE',
    '...',
  ])('"%s" sola → audio_no_entendido', async (alucinacion) => {
    sdk.transcribir.mockResolvedValueOnce({ text: alucinacion })
    const e = await errorDe(transcribir({ audioBase64: AUDIO, mime: 'audio/mp4' }))
    expect(e.motivo).toBe('audio_vacio')
    expect(e.codigo).toBe('audio_no_entendido')
  })

  it('si queda relato, lo devuelve sin esas frases y tal cual (tildes y mayúsculas)', async () => {
    sdk.transcribir.mockResolvedValueOnce({ text: ' Comió todas las papas y el dambo lo apartó. Subtítulos realizados por la comunidad de Amara.org' })
    const r = await transcribir({ audioBase64: AUDIO, mime: 'audio/mp4' })
    expect(r.texto).toBe('Comió todas las papas y el dambo lo apartó.')
  })

  it('saca las frases al principio, en el medio o en otra línea', () => {
    expect(sinFrasesInventadas('¡Gracias por ver! Lo probó y lo escupió.')).toBe('Lo probó y lo escupió.')
    expect(sinFrasesInventadas('El boniato ni lo miró. ¡Suscríbete! La milanesa, toda.')).toBe('El boniato ni lo miró. La milanesa, toda.')
    expect(sinFrasesInventadas('Comió el puré.\nGracias por ver el video.')).toBe('Comió el puré.')
  })

  it('no toca un relato que usa esas palabras dentro de una oración', () => {
    const relato = 'Le dije gracias por ver la tele conmigo y comió el puré.'
    expect(sinFrasesInventadas(relato)).toBe(relato)
  })

  it('filtra también lo que transcribe el respaldo de Workers AI', async () => {
    vi.stubEnv('GROQ_API_KEY', '')
    vi.stubEnv('CLOUDFLARE_ACCOUNT_ID', 'cuenta-test')
    vi.stubEnv('CLOUDFLARE_API_TOKEN', 'token-test')
    cloudflareResponde({ success: true, result: { text: 'Subtítulos realizados por la comunidad de Amara.org' } })
    const e = await errorDe(transcribir({ audioBase64: AUDIO, mime: 'audio/webm' }))
    expect(e.codigo).toBe('audio_no_entendido')
    expect(e.detalle.detalle).toContain('inventa')
  })
})

describe('respaldo en Workers AI', () => {
  beforeEach(() => {
    vi.stubEnv('CLOUDFLARE_ACCOUNT_ID', 'cuenta-test')
    vi.stubEnv('CLOUDFLARE_API_TOKEN', 'token-test')
  })

  it('si Groq da 429, transcribe Whisper en Workers AI con el audio en base64', async () => {
    sdk.transcribir.mockRejectedValueOnce(new RateLimitError(429, { type: 'error' }, 'rate limited', new Headers()))
    cloudflareResponde({ success: true, result: { text: 'Lo probó y lo dejó.' } })
    const r = await transcribir({ audioBase64: AUDIO, mime: 'audio/mp4', pista: 'boniato' })
    expect(r).toMatchObject({ texto: 'Lo probó y lo dejó.', modelo: '@cf/openai/whisper-large-v3-turbo' })
    const [url, init] = fetchFalso.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.cloudflare.com/client/v4/accounts/cuenta-test/ai/run/@cf/openai/whisper-large-v3-turbo')
    expect(init.method).toBe('POST')
    expect(init.headers).toMatchObject({ Authorization: 'Bearer token-test' })
    expect(JSON.parse(String(init.body))).toEqual({ audio: AUDIO, task: 'transcribe', language: 'es', initial_prompt: 'boniato' })
  })

  it('sin key de Groq va directo a Workers AI', async () => {
    vi.stubEnv('GROQ_API_KEY', '')
    cloudflareResponde({ success: true, result: { text: 'Comió todo.' } })
    const r = await transcribir({ audioBase64: AUDIO, mime: 'audio/webm' })
    expect(r.modelo).toBe('@cf/openai/whisper-large-v3-turbo')
    expect(sdk.transcribir).not.toHaveBeenCalled()
  })

  it('con timeout de Groq no pasa al respaldo', async () => {
    sdk.transcribir.mockRejectedValueOnce(new APIConnectionTimeoutError())
    const e = await errorDe(transcribir({ audioBase64: AUDIO, mime: 'audio/mp4' }))
    expect(e.motivo).toBe('timeout')
    expect(fetchFalso).not.toHaveBeenCalled()
  })

  it('si Workers AI también devuelve vacío → audio_no_entendido', async () => {
    vi.stubEnv('GROQ_API_KEY', '')
    cloudflareResponde({ success: true, result: { text: '' } })
    const e = await errorDe(transcribir({ audioBase64: AUDIO, mime: 'audio/mp4' }))
    expect(e.codigo).toBe('audio_no_entendido')
  })

  it('sin ninguna key → sin_clave', async () => {
    vi.stubEnv('GROQ_API_KEY', '')
    vi.stubEnv('CLOUDFLARE_API_TOKEN', '')
    const e = await errorDe(transcribir({ audioBase64: AUDIO, mime: 'audio/mp4' }))
    expect(e.motivo).toBe('sin_clave')
    expect(fetchFalso).not.toHaveBeenCalled()
  })
})

describe('limiteMs', () => {
  let ahora = 1_000_000

  beforeEach(() => {
    ahora = 1_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => ahora)
    vi.stubEnv('CLOUDFLARE_ACCOUNT_ID', 'cuenta-test')
    vi.stubEnv('CLOUDFLARE_API_TOKEN', 'token-test')
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('sin limiteMs, Groq va sin opciones por request', async () => {
    sdk.transcribir.mockResolvedValueOnce({ text: 'hola' })
    await transcribir({ audioBase64: AUDIO, mime: 'audio/mp4' })
    expect(sdk.transcribir.mock.calls[0][1]).toBeUndefined()
  })

  it('con limiteMs, Groq lleva timeout, maxRetries y la señal del presupuesto', async () => {
    sdk.transcribir.mockResolvedValueOnce({ text: 'hola' })
    await transcribir({ audioBase64: AUDIO, mime: 'audio/mp4', limiteMs: 20_000 })
    const opciones = sdk.transcribir.mock.calls[0][1]
    expect(opciones).toMatchObject({ timeout: 20_000, maxRetries: 0 })
    expect(opciones.signal).toBeInstanceOf(AbortSignal)
  })

  it('el respaldo de Workers AI usa lo que queda; con menos de 8 s no se intenta', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout')
    const limite = () => { ahora += 15_000; return Promise.reject(new RateLimitError(429, { type: 'error' }, 'rate limited', new Headers())) }
    sdk.transcribir.mockImplementationOnce(limite)
    cloudflareResponde({ success: true, result: { text: 'Comió todo.' } })
    const r = await transcribir({ audioBase64: AUDIO, mime: 'audio/mp4', limiteMs: 35_000 })
    expect(r.modelo).toBe('@cf/openai/whisper-large-v3-turbo')
    expect(timeout).toHaveBeenLastCalledWith(20_000) // el fetch a Workers AI: 35 s − 15 s

    sdk.transcribir.mockImplementationOnce(limite)
    const e = await errorDe(transcribir({ audioBase64: AUDIO, mime: 'audio/mp4', limiteMs: 20_000 }))
    expect(e.motivo).toBe('limite')
    expect(fetchFalso).toHaveBeenCalledTimes(1)
  })

  it('con el presupuesto agotado → timeout, sin llamar', async () => {
    const e = await errorDe(transcribir({ audioBase64: AUDIO, mime: 'audio/mp4', limiteMs: 0 }))
    expect(e.motivo).toBe('timeout')
    expect(sdk.transcribir).not.toHaveBeenCalled()
  })
})
