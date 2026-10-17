// Sube a Vercel las variables de .env.local que figuran en .env.example (C4, deploy).
// Uso: completar .env.local y correr `npm run env:vercel`. Pisa el valor en production, preview y development.
// Nunca imprime los valores. Las variables vacías se saltean.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const leer = (archivo) => Object.fromEntries(
  readFileSync(archivo, 'utf8').split('\n')
    .map((l) => l.replace(/\s+#.*$/, '').trim())
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] }),
)

const permitidas = Object.keys(leer('.env.example')).filter((k) => k !== 'PUERTO_API')
const locales = leer('.env.local')
const vercel = (args, input) => execFileSync('npx', ['vercel', ...args], { input, stdio: ['pipe', 'ignore', 'pipe'] })

for (const nombre of permitidas) {
  const valor = locales[nombre]
  if (!valor) continue
  for (const entorno of ['production', 'preview', 'development']) {
    try { vercel(['env', 'rm', nombre, entorno, '--yes']) } catch { /* no existía */ }
    vercel(['env', 'add', nombre, entorno], valor)
  }
  console.log(`✓ ${nombre}`)
}
console.log('Listo. Para que tomen efecto: npm run deploy')
