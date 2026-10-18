// Tests de salud.ts con los SDK mockeados y fetch falso: nunca llaman a una API real.
import { AuthenticationError } from '@anthropic-ai/sdk'
import { APIConnectionTimeoutError } from 'groq-sdk'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { estadoIA } from './salud.js'

const sdk = vi.hoisted(() => ({ retrieve: vi.fn(), listar: vi.fn(), modeloGemini: vi.fn() }))

vi.mock('@anthropic-ai/sdk', async (original) => {
  const real = await original<typeof import('@anthropic-ai/sdk')>()
  class Anthropic { models = { retrieve: sdk.retrieve } }
  return { ...real, default: Anthropic }
})
vi.mock('@google/genai', async (original) => {
  const real = await original<typeof import('@google/genai')>()
  class GoogleGenAI { models = { get: sdk.modeloGemini } }
  return { ...real, GoogleGenAI }
})
vi.mock('groq-sdk', async (original) => {
  const real = await original<typeof import('groq-sdk')>()
  class Groq { models = { list: sdk.listar } }
  return { ...real, default: Groq }
})

const fetchFalso = vi.fn()

function tokenActivo() {
  fetchFalso.mockResolvedValueOnce(new Response(JSON.stringify({ success: true, result: { id: 'x', status: 'active' } })))
}

beforeEach(() => {
  vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test')
  vi.stubEnv('GROQ_API_KEY', 'groq-test')
  vi.stubEnv('CLOUDFLARE_ACCOUNT_ID', 'cuenta-test')
  vi.stubEnv('CLOUDFLARE_API_TOKEN', 'token-test')
  vi.stubEnv('MODELO_VISION', '')
  vi.stubGlobal('fetch', fetchFalso)
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.resetAllMocks()
})

describe('estadoIA', () => {
  it('con todo andando, los tres ok y con latencia; los pings no gastan y cortan a los 5 s', async () => {
    sdk.retrieve.mockResolvedValueOnce({ id: 'claude-haiku-5-5' })
    sdk.listar.mockResolvedValueOnce({ data: [] })
    tokenActivo()
    const r = await estadoIA()
    expect(r.claude).toMatchObject({ ok: true })
    expect(r.transcripcion).toMatchObject({ ok: true })
    expect(r.imagen).toMatchObject({ ok: true })
    expect(r.claude.ms).toBeGreaterThanOrEqual(0)
    expect(sdk.retrieve).toHaveBeenCalledWith('claude-haiku-5-5', {}, { timeout: 5_000, maxRetries: 0 })
    expect(sdk.listar).toHaveBeenCalledWith({ timeout: 5_000, maxRetries: 0 })
    const [url, init] = fetchFalso.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.cloudflare.com/client/v4/user/tokens/verify')
    expect(init.method).toBe('GET')
  })

  it('sin keys, dice cuál falta sin llamar a nadie', async () => {
    for (const v of ['ANTHROPIC_API_KEY', 'GROQ_API_KEY', 'CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_API_TOKEN']) vi.stubEnv(v, '')
    const r = await estadoIA()
    expect(r.claude).toMatchObject({ ok: false, error: 'sin_clave: falta ANTHROPIC_API_KEY' })
    expect(r.transcripcion).toMatchObject({ ok: false, error: 'sin_clave: falta GROQ_API_KEY' })
    expect(r.imagen.ok).toBe(false)
    expect(sdk.retrieve).not.toHaveBeenCalled()
    expect(fetchFalso).not.toHaveBeenCalled()
  })

  it('una key inválida sale como error sin la key', async () => {
    sdk.retrieve.mockRejectedValueOnce(new AuthenticationError(401, { type: 'error' }, 'invalid x-api-key', new Headers()))
    sdk.listar.mockResolvedValueOnce({ data: [] })
    tokenActivo()
    const r = await estadoIA()
    expect(r.claude.ok).toBe(false)
    expect(r.claude.error).toContain('key inválida')
    expect(r.claude.error).not.toContain('sk-ant-test')
  })

  it('si Groq no responde pero Workers AI sí, la transcripción anda por el respaldo', async () => {
    sdk.retrieve.mockResolvedValueOnce({ id: 'claude-haiku-5-5' })
    sdk.listar.mockRejectedValueOnce(new APIConnectionTimeoutError())
    tokenActivo()
    const r = await estadoIA()
    expect(r.transcripcion.ok).toBe(true)
    expect(r.transcripcion.error).toContain('respaldo de Workers AI')
  })

  it('un token de Cloudflare inactivo no está ok', async () => {
    sdk.retrieve.mockResolvedValueOnce({ id: 'claude-haiku-5-5' })
    sdk.listar.mockResolvedValueOnce({ data: [] })
    fetchFalso.mockResolvedValueOnce(new Response(JSON.stringify({ success: true, result: { status: 'disabled' } })))
    const r = await estadoIA()
    expect(r.imagen).toMatchObject({ ok: false })
    expect(r.imagen.error).toContain('disabled')
  })

  it('con GEMINI_API_KEY, la imagen es la de Nano Banana (leer la ficha del modelo no gasta)', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'gemini-test')
    sdk.retrieve.mockResolvedValueOnce({ id: 'claude-haiku-5-5' })
    sdk.listar.mockResolvedValueOnce({ data: [] })
    sdk.modeloGemini.mockResolvedValueOnce({ name: 'models/gemini-nano-banana-2.1' })
    tokenActivo()
    const r = await estadoIA()
    expect(r.imagen).toMatchObject({ ok: true })
    expect(r.imagen.error).toBeUndefined()
    expect(sdk.modeloGemini).toHaveBeenCalledWith(expect.objectContaining({ model: 'gemini-nano-banana-2.1' }))
  })

  it('si Nano Banana no anda pero FLUX sí, la imagen sigue ok por el respaldo y lo dice', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'gemini-test')
    sdk.retrieve.mockResolvedValueOnce({ id: 'claude-haiku-5-5' })
    sdk.listar.mockResolvedValueOnce({ data: [] })
    sdk.modeloGemini.mockRejectedValueOnce(Object.assign(new Error('forbidden'), { statusCode: 403 }))
    tokenActivo()
    const r = await estadoIA()
    expect(r.imagen.ok).toBe(true)
    expect(r.imagen.error).toContain('anda el respaldo FLUX')
  })
})
