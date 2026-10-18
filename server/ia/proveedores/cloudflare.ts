// Workers AI por REST (PLAN.md §4.1): FLUX.1 schnell (imagen.ts) y Whisper de respaldo (voz.ts).
// Variables: CLOUDFLARE_ACCOUNT_ID y CLOUDFLARE_API_TOKEN (con permiso de Workers AI).
import { ErrorIA } from '../errores.js'
import { descripcion, porPedido, TIMEOUT_MS, type Vence } from './comun.js'

const API = 'https://api.cloudflare.com/client/v4'

interface Credenciales { cuenta: string; token: string }

interface Respuesta<T> {
  success: boolean
  result?: T
  errors?: { code: number; message: string }[]
}

export function credencialesCloudflare(): Credenciales | null {
  const cuenta = process.env.CLOUDFLARE_ACCOUNT_ID?.trim()
  const token = process.env.CLOUDFLARE_API_TOKEN?.trim()
  return cuenta && token ? { cuenta, token } : null
}

async function pedir<T>(url: string, token: string, init: RequestInit, timeoutMs: number, que: string) {
  try {
    const res = await fetch(url, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
    })
    const json = (await res.json().catch(() => null)) as Respuesta<T> | null
    return { res, json }
  } catch (e) {
    if (e instanceof Error && e.name === 'TimeoutError') throw new ErrorIA('timeout', `${que} no respondió a tiempo`, { causa: e })
    throw new ErrorIA('proveedor', `${que}: ${descripcion(e)}`, { causa: e })
  }
}

// 4006: se terminaron las 10.000 neuronas gratis del día (vuelven a las 00:00 UTC). Reintentar no sirve hasta entonces.
const SIN_CUPO_DIARIO = 4006

function errorHttp(status: number, json: Respuesta<unknown> | null, que: string): ErrorIA {
  const mensaje = json?.errors?.[0]?.message ?? ''
  if (json?.errors?.some((e) => e.code === SIN_CUPO_DIARIO)) {
    return new ErrorIA('limite', `${que}: sin cupo diario (${SIN_CUPO_DIARIO}) ${mensaje}`.trim(), {
      mensaje: 'Por hoy se terminó el cupo gratuito de este servicio. Vuelve a estar disponible mañana.',
    })
  }
  if (status === 429) return new ErrorIA('limite', `${que}: ${mensaje || 'sin cupo'}`)
  if (status === 401 || status === 403) return new ErrorIA('sin_clave', `${que}: token inválido o sin permiso (${status})`)
  return new ErrorIA('proveedor', `${que}: HTTP ${status} ${mensaje}`.trim())
}

/** POST /accounts/{cuenta}/ai/run/{modelo}. Devuelve `result`. Con `vence` (limiteMs), el timeout es lo que queda. */
export async function correrWorkersAI<T>(modelo: string, cuerpo: unknown, vence?: Vence): Promise<T> {
  const c = credencialesCloudflare()
  if (!c) throw new ErrorIA('sin_clave', 'faltan CLOUDFLARE_ACCOUNT_ID y CLOUDFLARE_API_TOKEN')
  const que = `Workers AI (${modelo})`
  const timeoutMs = porPedido(vence)?.timeout ?? TIMEOUT_MS // sin reintentos: alcanza con acotar el timeout
  const { res, json } = await pedir<T>(`${API}/accounts/${c.cuenta}/ai/run/${modelo}`, c.token, {
    method: 'POST',
    body: JSON.stringify(cuerpo),
  }, timeoutMs, que)
  if (!res.ok || !json?.success || json.result === undefined) throw errorHttp(res.status, json, que)
  return json.result
}

/** Para /api/salud: verificar el token no gasta neuronas. */
export async function verificarCloudflare(): Promise<void> {
  const c = credencialesCloudflare()
  if (!c) throw new ErrorIA('sin_clave', 'faltan CLOUDFLARE_ACCOUNT_ID y CLOUDFLARE_API_TOKEN')
  const { res, json } = await pedir<{ status?: string }>(`${API}/user/tokens/verify`, c.token, { method: 'GET' }, 5_000, 'Cloudflare')
  if (!res.ok || !json?.success) throw errorHttp(res.status, json, 'Cloudflare')
  if (json.result?.status !== 'active') throw new ErrorIA('sin_clave', `Cloudflare: el token está ${json.result?.status ?? 'inactivo'}`)
}
