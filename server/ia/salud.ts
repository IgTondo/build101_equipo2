// Estado de los servicios de IA para /api/salud (B). Pings que no gastan cupo, de 5 s, en paralelo:
// Claude models.retrieve, Groq listar modelos, Cloudflare verificar el token y la ficha del modelo de Nano Banana.
import type { EstadoServicio } from '../../shared/contratos.js'
import { ErrorIA } from './errores.js'
import { modeloPara } from './modelo.js'
import { pingClaude } from './proveedores/claude.js'
import { verificarCloudflare } from './proveedores/cloudflare.js'
import { descripcion } from './proveedores/comun.js'
import { pingGroq } from './proveedores/groq.js'
import { pingNanoBanana, tieneClaveGemini } from './proveedores/nano-banana.js'

export interface EstadoIA {
  claude: EstadoServicio
  transcripcion: EstadoServicio
  imagen: EstadoServicio
}

async function medir(ping: () => Promise<void>): Promise<EstadoServicio> {
  const inicio = Date.now()
  try {
    await ping()
    return { ok: true, ms: Date.now() - inicio }
  } catch (e) {
    const error = e instanceof ErrorIA ? `${e.motivo}: ${e.detalle.detalle}` : descripcion(e)
    return { ok: false, ms: Date.now() - inicio, error }
  }
}

export async function estadoIA(): Promise<EstadoIA> {
  const [claude, groq, cloudflare, nanoBanana] = await Promise.all([
    medir(() => pingClaude(modeloPara('vision'))),
    medir(pingGroq),
    medir(verificarCloudflare),
    tieneClaveGemini() ? medir(pingNanoBanana) : null,
  ])
  // Si el principal no anda pero Workers AI sí, la transcripción y la imagen siguen andando por el respaldo.
  const transcripcion = groq.ok || !cloudflare.ok ? groq : { ...cloudflare, error: `Groq: ${groq.error}; anda el respaldo de Workers AI` }
  const imagen = !nanoBanana ? cloudflare
    : nanoBanana.ok || !cloudflare.ok ? nanoBanana
      : { ...cloudflare, error: `Nano Banana: ${nanoBanana.error}; anda el respaldo FLUX` }
  return { claude, transcripcion, imagen }
}
