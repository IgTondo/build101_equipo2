// Generación de imagen (PLAN.md §7, A4 y A10): Nano Banana 2.1 de Gemini (proveedores/nano-banana.ts) y, de
// respaldo, FLUX.1 schnell en Cloudflare Workers AI. Sin GEMINI_API_KEY va directo a FLUX; con key, FLUX entra si
// Nano Banana falla por cupo, por la key (sin billing) o por error del proveedor. Con timeout no: la función corta a
// los 60 s. Variables: GEMINI_API_KEY (con billing) y, para el respaldo, CLOUDFLARE_ACCOUNT_ID y CLOUDFLARE_API_TOKEN.
import { ErrorIA } from './errores.js'
import { correrWorkersAI, credencialesCloudflare } from './proveedores/cloudflare.js'
import { MIN_REINTENTO_MS, quedanMs, vencimiento, type Vence } from './proveedores/comun.js'
import { imagenNanoBanana, tieneClaveGemini } from './proveedores/nano-banana.js'

export interface OpcionesImagen {
  prompt: string
  pasos?: number         // solo FLUX schnell: de 1 a 8 (por defecto, 4)
  limiteMs?: number      // presupuesto total, respaldo incluido: cada pedido lleva min(25 s, lo que queda)
}

export interface ResultadoImagen {
  imagenBase64: string
  mime: 'image/jpeg' | 'image/png'
  modelo: string         // el que respondió de verdad (puede ser el de respaldo)
  ms: number
}

const MODELO_FLUX = '@cf/black-forest-labs/flux-1-schnell'
const MAX_PROMPT = 2048 // límite de FLUX; con Nano Banana sobra
const RESPALDABLE = ['limite', 'proveedor', 'sin_clave']

async function conFlux(prompt: string, pasos: number, vence: Vence) {
  const r = await correrWorkersAI<{ image?: string }>(MODELO_FLUX, { prompt, steps: pasos }, vence)
  if (!r.image) throw new ErrorIA('proveedor', 'FLUX respondió sin imagen')
  // Devuelve JPEG en base64; si algún día viene PNG, se reconoce por la firma ('iVBOR' = \x89PNG).
  const mime: 'image/jpeg' | 'image/png' = r.image.startsWith('iVBOR') ? 'image/png' : 'image/jpeg'
  return { imagenBase64: r.image, mime, modelo: MODELO_FLUX }
}

async function conRespaldo(prompt: string, pasos: number, vence: Vence) {
  const hayFlux = credencialesCloudflare() !== null
  if (!tieneClaveGemini()) {
    if (!hayFlux) throw new ErrorIA('sin_clave', 'faltan GEMINI_API_KEY (Nano Banana) y las credenciales de Cloudflare (FLUX)')
    return conFlux(prompt, pasos, vence)
  }
  try {
    return await imagenNanoBanana(prompt, vence)
  } catch (e) {
    if (!hayFlux || !(e instanceof ErrorIA) || !RESPALDABLE.includes(e.motivo)) throw e
    if (quedanMs(vence) < MIN_REINTENTO_MS) throw e // con limiteMs: sin tiempo para el respaldo
    console.warn(JSON.stringify({ evento: 'imagen', aviso: 'respaldo_flux', motivo: e.motivo, detalle: e.detalle.detalle }))
    return conFlux(prompt, pasos, vence)
  }
}

export async function generarImagen(opciones: OpcionesImagen): Promise<ResultadoImagen> {
  const inicio = Date.now()
  const prompt = opciones.prompt.trim()
  if (!prompt || prompt.length > MAX_PROMPT) {
    throw new ErrorIA('entrada_invalida', `el prompt de la imagen tiene que tener de 1 a ${MAX_PROMPT} caracteres (tiene ${prompt.length})`)
  }
  const pasos = Math.min(8, Math.max(1, Math.round(opciones.pasos ?? 4)))
  const r = await conRespaldo(prompt, pasos, vencimiento(opciones.limiteMs))
  return { ...r, ms: Date.now() - inicio }
}
