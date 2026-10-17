// Carga .env.local antes que server/ia/: cada eval lo importa primero, y ESM evalúa los imports en orden.
// En Actions (evals.yml) las keys llegan como secretos del repo y este archivo no encuentra nada que cargar.
import { config } from 'dotenv'

config({ path: ['.env.local', '.env'], quiet: true })
