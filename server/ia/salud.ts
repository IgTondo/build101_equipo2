// Estado de los servicios de IA para /api/salud (B). Pings que no gastan cupo, de 5 s, en paralelo:
// Claude models.retrieve, Groq listar modelos y Cloudflare verificar el token.
import type { EstadoServicio } from '../../shared/contratos.js'
import { ErrorIA } from './errores.js'
import { modeloPara } from './modelo.js'
import { pingClaude } from './proveedores/claude.js'
import { verificarCloudflare } from './proveedores/cloudflare.js'
import { descripcion } from './proveedores/comun.js'
import { pingGroq } from './proveedores/groq.js'

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
  const [claude, groq, cloudflare] = await Promise.all([
    medir(() => pingClaude(modeloPara('vision'))),
    medir(pingGroq),
    medir(verificarCloudflare),
  ])
  // Si Groq no anda pero Workers AI sí, la transcripción sigue andando por el respaldo.
  const transcripcion = groq.ok || !cloudflare.ok ? groq : { ...cloudflare, error: `Groq: ${groq.error}; anda el respaldo de Workers AI` }
  return { claude, transcripcion, imagen: cloudflare }
}
