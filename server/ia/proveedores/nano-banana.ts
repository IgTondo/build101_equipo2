// Nano Banana, la imagen de Gemini (PLAN.md §7, A10), con la API de interactions de @google/genai.
// Variable: GEMINI_API_KEY con billing: la salida de imagen no tiene free tier (USD 0,0336 por imagen de 1K, 10/2026).
// MODELO_IMAGEN cambia el modelo (por ejemplo gemini-3.1-flash-lite-image: más rápido, mismo precio, solo 1K).
// gemini-2.5-flash-image (la primera Nano Banana) se dio de baja el 2/10/2026.
import { ErrorIA } from '../errores.js'
import { descripcion, porPedido, TIMEOUT_MS, type Vence } from './comun.js'
import { clienteGemini } from './gemini.js'

export const MODELO_NANO_BANANA = 'gemini-nano-banana-2.1'

export function modeloImagen(): string {
  return process.env.MODELO_IMAGEN?.trim() || MODELO_NANO_BANANA
}

export function tieneClaveGemini(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim())
}

// Los errores de interactions traen statusCode (GoogleGenAiError) o status (APIError), no la ApiError de generateContent.
function errorNanoBanana(e: unknown): ErrorIA {
  if (e instanceof ErrorIA) return e
  if (e instanceof Error && /timeout|abort/i.test(e.name)) return new ErrorIA('timeout', 'Nano Banana no respondió a tiempo', { causa: e })
  const { statusCode, status } = (e ?? {}) as { statusCode?: number; status?: number }
  const codigo = statusCode ?? status
  if (codigo === 429) return new ErrorIA('limite', `Nano Banana: ${descripcion(e)}`, { causa: e })
  if (codigo === 401 || codigo === 403) {
    return new ErrorIA('sin_clave', `Nano Banana: key inválida o sin billing (${codigo})`, { causa: e })
  }
  return new ErrorIA('proveedor', `Nano Banana: ${descripcion(e)}`, { causa: e })
}

/** Una imagen cuadrada de 1K en JPEG. Sin reintentos del SDK: el respaldo (FLUX) lo maneja imagen.ts. */
export async function imagenNanoBanana(prompt: string, vence?: Vence) {
  const modelo = modeloImagen()
  let r
  try {
    r = await clienteGemini().interactions.create({
      model: modelo,
      input: prompt,
      response_format: { type: 'image', aspect_ratio: '1:1', image_size: '1K', mime_type: 'image/jpeg', delivery: 'inline' },
    }, { timeout_ms: porPedido(vence)?.timeout ?? TIMEOUT_MS, retries: { strategy: 'none' } })
  } catch (e) {
    throw errorNanoBanana(e)
  }
  const imagen = r.output_image
  if (!imagen?.data) {
    // Sin imagen suele ser un bloqueo de seguridad: el modelo explica en texto por qué.
    throw new ErrorIA('proveedor', `${modelo} respondió sin imagen${r.output_text ? `: ${r.output_text.slice(0, 160)}` : ''}`)
  }
  const mime: 'image/jpeg' | 'image/png' = imagen.mime_type === 'image/png' ? 'image/png' : 'image/jpeg'
  return { imagenBase64: imagen.data, mime, modelo }
}

/** Para /api/salud: leer la ficha del modelo no genera nada ni gasta. */
export async function pingNanoBanana(): Promise<void> {
  try {
    await clienteGemini().models.get({ model: modeloImagen(), config: { httpOptions: { timeout: 5_000 } } })
  } catch (e) {
    throw errorNanoBanana(e)
  }
}
