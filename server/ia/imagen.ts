// Generación de imagen (PLAN.md §7, A4 y A10): FLUX.1 schnell en Cloudflare Workers AI.
// Variables: CLOUDFLARE_ACCOUNT_ID y CLOUDFLARE_API_TOKEN.
import { ErrorIA } from './errores.js'
import { correrWorkersAI } from './proveedores/cloudflare.js'
import { vencimiento } from './proveedores/comun.js'

export interface OpcionesImagen {
  prompt: string
  pasos?: number         // FLUX schnell: de 1 a 8 (por defecto, 4)
  limiteMs?: number      // presupuesto total: el timeout es min(25 s, limiteMs)
}

export interface ResultadoImagen {
  imagenBase64: string
  mime: 'image/jpeg' | 'image/png'
  modelo: string
  ms: number
}

const MODELO = '@cf/black-forest-labs/flux-1-schnell'
const MAX_PROMPT = 2048 // límite del modelo

export async function generarImagen(opciones: OpcionesImagen): Promise<ResultadoImagen> {
  const inicio = Date.now()
  const prompt = opciones.prompt.trim()
  if (!prompt || prompt.length > MAX_PROMPT) {
    throw new ErrorIA('entrada_invalida', `el prompt de la imagen tiene que tener de 1 a ${MAX_PROMPT} caracteres (tiene ${prompt.length})`)
  }
  const pasos = Math.min(8, Math.max(1, Math.round(opciones.pasos ?? 4)))
  const r = await correrWorkersAI<{ image?: string }>(MODELO, { prompt, steps: pasos }, vencimiento(opciones.limiteMs))
  if (!r.image) throw new ErrorIA('proveedor', 'FLUX respondió sin imagen')
  // Devuelve JPEG en base64; si algún día viene PNG, se reconoce por la firma ('iVBOR' = \x89PNG).
  const mime = r.image.startsWith('iVBOR') ? 'image/png' : 'image/jpeg'
  return { imagenBase64: r.image, mime, modelo: MODELO, ms: Date.now() - inicio }
}
