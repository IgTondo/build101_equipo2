// Tests de imagen.ts (A4/A10) con fetch falso: nunca llaman a Workers AI.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ErrorIA } from './errores.js'
import { generarImagen } from './imagen.js'

const fetchFalso = vi.fn()
const PROMPT = 'Foto cenital de un plato playo blanco: papas fritas a la izquierda y 2 bastones de queso a la derecha, separados.'

function cloudflareResponde(cuerpo: unknown, status = 200) {
  fetchFalso.mockResolvedValueOnce(new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json' } }))
}

async function errorDe(promesa: Promise<unknown>): Promise<ErrorIA> {
  const e = await promesa.then(() => null, (e: unknown) => e)
  expect(e).toBeInstanceOf(ErrorIA)
  return e as ErrorIA
}

beforeEach(() => {
  vi.stubEnv('CLOUDFLARE_ACCOUNT_ID', 'cuenta-test')
  vi.stubEnv('CLOUDFLARE_API_TOKEN', 'token-test')
  vi.stubGlobal('fetch', fetchFalso)
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.resetAllMocks()
})

describe('generarImagen con FLUX.1 schnell', () => {
  it('devuelve el JPEG en base64 de result.image', async () => {
    cloudflareResponde({ success: true, result: { image: '/9j/4AAQSkZJRg' }, errors: [], messages: [] })
    const r = await generarImagen({ prompt: PROMPT })
    expect(r).toMatchObject({ imagenBase64: '/9j/4AAQSkZJRg', mime: 'image/jpeg', modelo: '@cf/black-forest-labs/flux-1-schnell' })
    expect(r.ms).toBeGreaterThanOrEqual(0)
    const [url, init] = fetchFalso.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.cloudflare.com/client/v4/accounts/cuenta-test/ai/run/@cf/black-forest-labs/flux-1-schnell')
    expect(init.method).toBe('POST')
    expect(init.headers).toMatchObject({ Authorization: 'Bearer token-test' })
    expect(init.signal).toBeInstanceOf(AbortSignal)
    expect(JSON.parse(String(init.body))).toEqual({ prompt: PROMPT, steps: 4 })
  })

  it('reconoce un PNG por la firma', async () => {
    cloudflareResponde({ success: true, result: { image: 'iVBORw0KGgo' } })
    expect((await generarImagen({ prompt: PROMPT })).mime).toBe('image/png')
  })

  it('deja los pasos entre 1 y 8', async () => {
    cloudflareResponde({ success: true, result: { image: '/9j/' } })
    cloudflareResponde({ success: true, result: { image: '/9j/' } })
    await generarImagen({ prompt: PROMPT, pasos: 20 })
    await generarImagen({ prompt: PROMPT, pasos: 0 })
    const pasos = fetchFalso.mock.calls.map(([, init]) => JSON.parse(String((init as RequestInit).body)).steps)
    expect(pasos).toEqual([8, 1])
  })

  it.each([
    [429, 'limite', 'limite_proveedor'],
    [401, 'sin_clave', 'proveedor_caido'],
    [403, 'sin_clave', 'proveedor_caido'],
    [500, 'proveedor', 'proveedor_caido'],
  ])('HTTP %i → %s', async (status, motivo, codigo) => {
    cloudflareResponde({ success: false, errors: [{ code: 1, message: 'algo pasó' }] }, status)
    const e = await errorDe(generarImagen({ prompt: PROMPT }))
    expect(e.motivo).toBe(motivo)
    expect(e.codigo).toBe(codigo)
    expect(JSON.stringify(e.detalle)).not.toContain('token-test')
  })

  it('success: false o sin imagen → proveedor', async () => {
    cloudflareResponde({ success: false, errors: [{ code: 5006, message: 'error' }] })
    cloudflareResponde({ success: true, result: {} })
    expect((await errorDe(generarImagen({ prompt: PROMPT }))).motivo).toBe('proveedor')
    expect((await errorDe(generarImagen({ prompt: PROMPT }))).motivo).toBe('proveedor')
  })

  it('si se pasa de los 25 s → timeout', async () => {
    fetchFalso.mockRejectedValueOnce(new DOMException('The operation timed out.', 'TimeoutError'))
    const e = await errorDe(generarImagen({ prompt: PROMPT }))
    expect(e.motivo).toBe('timeout')
    expect(e.codigo).toBe('timeout')
  })

  it('sin credenciales de Cloudflare → sin_clave, sin llamar', async () => {
    vi.stubEnv('CLOUDFLARE_API_TOKEN', '')
    const e = await errorDe(generarImagen({ prompt: PROMPT }))
    expect(e.motivo).toBe('sin_clave')
    expect(fetchFalso).not.toHaveBeenCalled()
  })

  it('prompt vacío o de más de 2048 caracteres → entrada_invalida', async () => {
    expect((await errorDe(generarImagen({ prompt: '  ' }))).motivo).toBe('entrada_invalida')
    expect((await errorDe(generarImagen({ prompt: 'a'.repeat(2049) }))).motivo).toBe('entrada_invalida')
    expect(fetchFalso).not.toHaveBeenCalled()
  })

  it('con limiteMs, el timeout del fetch es min(25 s, limiteMs); agotado → timeout sin llamar', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout')
    cloudflareResponde({ success: true, result: { image: '/9j/' } })
    cloudflareResponde({ success: true, result: { image: '/9j/' } })
    await generarImagen({ prompt: PROMPT })
    expect(timeout).toHaveBeenLastCalledWith(25_000)
    await generarImagen({ prompt: PROMPT, limiteMs: 10_000 })
    expect(timeout.mock.lastCall?.[0]).toBeLessThanOrEqual(10_000)
    expect((await errorDe(generarImagen({ prompt: PROMPT, limiteMs: 0 }))).motivo).toBe('timeout')
    expect(fetchFalso).toHaveBeenCalledTimes(2)
    timeout.mockRestore()
  })
})
