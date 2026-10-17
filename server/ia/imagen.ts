// Generación de imagen (PLAN.md §7, A4 y A10): FLUX.1 schnell en Cloudflare Workers AI.
// Variables: CLOUDFLARE_ACCOUNT_ID y CLOUDFLARE_API_TOKEN.
import { ErrorIA } from './errores.js'

export interface OpcionesImagen {
  prompt: string
  pasos?: number         // FLUX schnell: de 1 a 8 (por defecto, 4)
}

export interface ResultadoImagen {
  imagenBase64: string
  mime: 'image/jpeg' | 'image/png'
  modelo: string
  ms: number
}

export async function generarImagen(opciones: OpcionesImagen): Promise<ResultadoImagen> {
  throw new ErrorIA('no_implementado', `generarImagen todavía no está implementado (${opciones.prompt.length} caracteres)`)
}
