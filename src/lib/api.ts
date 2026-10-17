// Cliente tipado de la API (C1). Las pantallas llaman a estas funciones y nunca a fetch directo:
// si la respuesta no es 2xx, tiran ErrorDeApi con el ErrorApi del contrato (mensaje para el padre + reintentable).
import type {
  AnalisisComida, AnalizarComidaReq, CoberturaDia, CrearPerfilReq, CrearPerfilRes, ErrorApi,
  ImagenPlatoReq, ImagenPlatoRes, Motor, Perfil, PerfilBorrador, PerfilInicialReq, Progreso, Receta,
  RecetaReq, RegistrarComidaReq, RegistrarComidaRes, RelatoComida, RelatoComidaReq, ResumenRes,
  SaludRes, TranscribirReq, TranscribirRes,
} from '../../shared/contratos'

export class ErrorDeApi extends Error {
  constructor(readonly status: number, readonly cuerpo: ErrorApi) {
    super(cuerpo.error.mensaje)
  }
  get reintentable() { return this.cuerpo.error.reintentable }
  get codigo() { return this.cuerpo.error.codigo }
}

interface Opciones { metodo?: 'GET' | 'POST'; cuerpo?: unknown; timeoutMs?: number; senal?: AbortSignal }

export interface Respuesta<T> { datos: T; stub: boolean; ms: number }

/** Pide a /api y devuelve los datos junto con si vinieron de un stub (header x-nibble-stub). */
export async function pedirConMeta<T>(ruta: string, { metodo = 'GET', cuerpo, timeoutMs = 30_000, senal }: Opciones = {}): Promise<Respuesta<T>> {
  const t0 = performance.now()
  const corte = AbortSignal.timeout(timeoutMs)
  let r: Response
  try {
    r = await fetch(ruta, {
      method: metodo,
      headers: cuerpo === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
      signal: senal ? AbortSignal.any([corte, senal]) : corte,
    })
  } catch (e) {
    const porTiempo = corte.aborted
    throw new ErrorDeApi(0, { error: {
      codigo: porTiempo ? 'timeout' : 'proveedor_caido',
      mensaje: porTiempo ? 'Está tardando más de lo normal. ¿Probás de nuevo?' : 'No hay conexión. Revisá el wifi o los datos y probá de nuevo.',
      reintentable: true, detalle: String(e),
    } })
  }
  const texto = await r.text()
  let json: unknown
  try { json = texto ? JSON.parse(texto) : null } catch { json = null }
  if (!r.ok) {
    const cuerpoError = (json as ErrorApi | null)?.error ? (json as ErrorApi)
      : { error: { codigo: 'interno', mensaje: 'Algo falló de nuestro lado. ¿Probás de nuevo?', reintentable: true, detalle: texto.slice(0, 300) } } satisfies ErrorApi
    throw new ErrorDeApi(r.status, cuerpoError)
  }
  return { datos: json as T, stub: r.headers.get('x-nibble-stub') === '1', ms: Math.round(performance.now() - t0) }
}

export async function pedir<T>(ruta: string, opciones?: Opciones): Promise<T> {
  return (await pedirConMeta<T>(ruta, opciones)).datos
}

const q = (params: Record<string, string | number | undefined>) =>
  new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])).toString()

// Todas aceptan una AbortSignal al final, para cancelar si el padre se va de la pantalla.
export const api = {
  analizarComida: (req: AnalizarComidaReq, senal?: AbortSignal) => pedir<AnalisisComida>('/api/analizar-comida', { metodo: 'POST', cuerpo: req, timeoutMs: 25_000, senal }),
  relatoComida: (req: RelatoComidaReq, senal?: AbortSignal) => pedir<RelatoComida>('/api/relato-comida', { metodo: 'POST', cuerpo: req, senal }),
  transcribir: (req: TranscribirReq, senal?: AbortSignal) => pedir<TranscribirRes>('/api/transcribir', { metodo: 'POST', cuerpo: req, senal }),
  perfilInicial: (req: PerfilInicialReq, senal?: AbortSignal) => pedir<PerfilBorrador>('/api/perfil-inicial', { metodo: 'POST', cuerpo: req, senal }),
  receta: (req: RecetaReq, motor?: Motor, senal?: AbortSignal) => pedir<Receta>(`/api/receta?${q({ motor })}`, { metodo: 'POST', cuerpo: req, timeoutMs: 60_000, senal }),
  imagenPlato: (req: ImagenPlatoReq, senal?: AbortSignal) => pedir<ImagenPlatoRes>('/api/imagen-plato', { metodo: 'POST', cuerpo: req, timeoutMs: 40_000, senal }),
  crearPerfil: (req: CrearPerfilReq, senal?: AbortSignal) => pedir<CrearPerfilRes>('/api/perfil', { metodo: 'POST', cuerpo: req, senal }),
  perfil: (ninoId: string, senal?: AbortSignal) => pedir<Perfil>(`/api/perfil?${q({ ninoId })}`, { senal }),
  registrarComida: (req: RegistrarComidaReq, senal?: AbortSignal) => pedir<RegistrarComidaRes>('/api/registrar-comida', { metodo: 'POST', cuerpo: req, senal }),
  nutricion: (ninoId: string, dia: string, senal?: AbortSignal) => pedir<CoberturaDia>(`/api/nutricion?${q({ ninoId, dia })}`, { senal }),
  progreso: (ninoId: string, dias = 28, motor?: Motor, senal?: AbortSignal) => pedir<Progreso>(`/api/progreso?${q({ ninoId, dias, motor })}`, { senal }),
  salud: (senal?: AbortSignal) => pedir<SaludRes>('/api/salud', { senal }),
  resumen: (ninoId: string, senal?: AbortSignal) => pedir<ResumenRes>(`/api/resumen?${q({ ninoId })}`, { timeoutMs: 40_000, senal }),
}

/** Los 12 endpoints (límite de funciones de Vercel Hobby), para la pantalla /estado. */
export const ENDPOINTS = [
  { nombre: 'analizar-comida', metodo: 'POST', pista: 'A' },
  { nombre: 'relato-comida', metodo: 'POST', pista: 'A' },
  { nombre: 'transcribir', metodo: 'POST', pista: 'A' },
  { nombre: 'perfil-inicial', metodo: 'POST', pista: 'A' },
  { nombre: 'receta', metodo: 'POST', pista: 'A' },
  { nombre: 'imagen-plato', metodo: 'POST', pista: 'A' },
  { nombre: 'perfil', metodo: 'GET', pista: 'B' },
  { nombre: 'registrar-comida', metodo: 'POST', pista: 'B' },
  { nombre: 'nutricion', metodo: 'GET', pista: 'B' },
  { nombre: 'progreso', metodo: 'GET', pista: 'B' },
  { nombre: 'salud', metodo: 'GET', pista: 'B' },
  { nombre: 'resumen', metodo: 'GET', pista: 'C' },
] as const
