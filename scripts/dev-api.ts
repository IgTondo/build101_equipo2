// Servidor local de la API (C1): monta cada api/<nombre>.ts en /api/<nombre>, igual que Vercel,
// para que nadie dependa de tener acceso al proyecto de Vercel. Lo levanta `npm run dev` junto con Vite,
// que le pasa /api por proxy. Lee .env.local y respeta el límite de 4,5 MB del body de Vercel.
import { readdirSync } from 'node:fs'
import { basename, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { config } from 'dotenv'
import express, { type NextFunction, type Request, type Response } from 'express'
import { enviarError, type Handler } from '../server/http.js'

config({ path: ['.env.local', '.env'], quiet: true })

const PUERTO = Number(process.env.PUERTO_API ?? 3001)
const DIR_API = join(process.cwd(), 'api')

const app = express()
app.use(express.json({ limit: '4.5mb' }))

const nombres = readdirSync(DIR_API).filter((f) => f.endsWith('.ts')).map((f) => basename(f, '.ts'))
for (const nombre of nombres) {
  const { default: handler } = (await import(pathToFileURL(join(DIR_API, `${nombre}.ts`)).href)) as { default: Handler }
  app.all(`/api/${nombre}`, (req, res) => handler(req as unknown as VercelRequest, res as unknown as VercelResponse))
}

app.use('/api', (_req, res) => enviarError(res as unknown as VercelResponse, 'no_encontrado', 'Ese endpoint no existe.'))

// Errores de express.json (body muy grande o JSON roto), con el mismo formato que Vercel devolvería.
app.use((err: { type?: string; message?: string }, _req: Request, res: Response, _next: NextFunction) => {
  const r = res as unknown as VercelResponse
  if (err.type === 'entity.too.large') return enviarError(r, 'muy_grande', 'La foto o el audio pesan demasiado.')
  if (err.type === 'entity.parse.failed') return enviarError(r, 'entrada_invalida', 'El cuerpo no es JSON válido.')
  enviarError(r, 'interno', 'Algo falló de nuestro lado.', err.message)
})

app.listen(PUERTO, () => console.log(`API local en http://localhost:${PUERTO}/api · ${nombres.length} endpoints: ${nombres.join(', ')}`))
