// A1 (PLAN.md §7): prueba las keys contra los proveedores reales. Uso: `npx tsx scripts/probar-ia.ts`.
// Visión con hasta 3 fotos de eval/fotos/ (¿reconoce bien?, ¿las cajas sirven?), una imagen con Nano Banana (o FLUX) y Whisper con
// una nota de iPhone (.mp4/.m4a) y otra de Android (.webm) de eval/voz/. Pasa por server/ia: prueba el mismo código
// que usa la app. Imprime OK/FALLA, latencia y los headers de límites (x-ratelimit-*); nunca las keys.
// Costo: < USD 0,05 (3 fotos en Claude Haiku 5.5 y una imagen de Nano Banana, USD 0,0336; FLUX y Whisper entran en
// los free tiers).
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { extname, join } from 'node:path'
import { config } from 'dotenv'
import { z } from 'zod'
import { ErrorIA } from '../server/ia/errores.js'
import { generarImagen } from '../server/ia/imagen.js'
import { generarJSON, modeloPara, type Parte } from '../server/ia/modelo.js'
import { transcribir } from '../server/ia/voz.js'

config({ path: '.env.local', quiet: true })

const KEYS: [string, string][] = [
  ['ANTHROPIC_API_KEY', 'Claude: visión, relato, perfil, receta y resumen'],
  ['GROQ_API_KEY', 'Whisper en Groq (y Llama 4 Scout de respaldo)'],
  ['CLOUDFLARE_ACCOUNT_ID', 'Workers AI: FLUX y Whisper de respaldo'],
  ['CLOUDFLARE_API_TOKEN', 'Workers AI: FLUX y Whisper de respaldo'],
  ['GEMINI_API_KEY', 'Nano Banana (imagen, con billing) y respaldo del LLM'],
]
const KEY_DEL_PROVEEDOR: Record<string, string> = { claude: 'ANTHROPIC_API_KEY', gemini: 'GEMINI_API_KEY', groq: 'GROQ_API_KEY' }

const hay = (variable: string) => Boolean(process.env[variable]?.trim())

// Los SDK toman el fetch global al crear su cliente, en la primera llamada: envolviéndolo antes se ven los headers
// de límites de cada respuesta sin tocar server/ia. Se guarda solo el host, nunca la URL (lleva la cuenta).
const limites = new Map<string, Record<string, string>>()
const fetchOriginal = globalThis.fetch
globalThis.fetch = async (entrada: string | URL | Request, init?: RequestInit) => {
  const res = await fetchOriginal(entrada, init)
  const host = new URL(entrada instanceof Request ? entrada.url : entrada).host
  const headers: Record<string, string> = {}
  res.headers.forEach((valor, nombre) => {
    if (/^(x-ratelimit-|anthropic-ratelimit-|retry-after)/.test(nombre)) headers[nombre] = valor
  })
  if (Object.keys(headers).length > 0) limites.set(host, headers)
  return res
}

type Estado = 'OK' | 'FALLA' | 'SALTEADA'
const resultados: { estado: Estado; prueba: string; ms?: number }[] = []

const sangrar = (texto: string) => texto.split('\n').map((l) => `         ${l}`).join('\n')

function saltear(prueba: string, motivo: string): void {
  resultados.push({ estado: 'SALTEADA', prueba })
  console.log(`SALTEADA ${prueba} · ${motivo}`)
}

async function probar(prueba: string, correr: () => Promise<string>): Promise<void> {
  limites.clear()
  const inicio = Date.now()
  try {
    const nota = await correr()
    const ms = Date.now() - inicio
    resultados.push({ estado: 'OK', prueba, ms })
    console.log(`OK       ${prueba} · ${ms} ms\n${sangrar(nota)}`)
  } catch (e) {
    const ms = Date.now() - inicio
    const nota = e instanceof ErrorIA ? `${e.motivo}: ${e.detalle.detalle}` : e instanceof Error ? e.message : String(e)
    resultados.push({ estado: 'FALLA', prueba, ms })
    console.log(`FALLA    ${prueba} · ${ms} ms · ${nota}`)
  }
  for (const [host, headers] of limites) {
    console.log(sangrar(`límites de ${host}:\n${Object.entries(headers).map(([k, v]) => `  ${k}: ${v}`).join('\n')}`))
  }
}

// ---------- Visión ----------
const SISTEMA_VISION = [
  'Identificás los alimentos en la foto de un plato. Respondé solo el JSON del schema, en español rioplatense.',
  'Cajas en [ymin, xmin, ymax, xmax], normalizadas de 0 a 1000.',
  'Gramos: usá el plato y los cubiertos como escala (plato playo ≈ 26 cm, cuchara ≈ 15 cm).',
].join('\n')

const Plato = z.object({
  sinComida: z.boolean(),
  alimentos: z.array(z.object({
    nombre: z.string(),
    gramosEst: z.number(),
    caja: z.tuple([z.number(), z.number(), z.number(), z.number()]),
    confianza: z.number().describe('De 0 a 1'),
  })),
})

const MIME_FOTO: Record<string, Extract<Parte, { tipo: 'imagen' }>['mime']> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
}

function archivos(carpeta: string): string[] {
  const dir = join(process.cwd(), carpeta)
  return existsSync(dir) ? readdirSync(dir).sort().map((f) => join(dir, f)) : []
}

async function probarVision(): Promise<void> {
  const proveedor = process.env.PROVEEDOR_IA?.trim().toLowerCase() || 'claude'
  const key = KEY_DEL_PROVEEDOR[proveedor] ?? 'ANTHROPIC_API_KEY'
  const fotos = archivos('eval/fotos').filter((f) => MIME_FOTO[extname(f).toLowerCase()]).slice(0, 3)
  const nombre = proveedor === 'claude' ? modeloPara('vision') : proveedor
  if (!hay(key)) return saltear(`Visión (${nombre})`, `falta ${key}`)
  if (fotos.length === 0) return saltear(`Visión (${nombre})`, 'no hay fotos en eval/fotos/')
  for (const foto of fotos) {
    await probar(`Visión (${nombre}) · ${foto.split('/').pop()}`, async () => {
      const partes: Parte[] = [
        { tipo: 'imagen', base64: readFileSync(foto).toString('base64'), mime: MIME_FOTO[extname(foto).toLowerCase()] },
        { tipo: 'texto', texto: 'Listá los alimentos del plato, cada uno con su caja.' },
      ]
      const r = await generarJSON({ tarea: 'vision', sistema: SISTEMA_VISION, partes, schema: Plato })
      const lineas = r.datos.alimentos.map((a) => `- ${a.nombre} · ${a.gramosEst} g · caja [${a.caja.join(', ')}] · confianza ${a.confianza}`)
      return [`${r.modelo} · reintentos: ${r.reintentos}${r.datos.sinComida ? ' · sin comida' : ''}`, ...lineas].join('\n')
    })
  }
}

// ---------- Imagen ----------
const PROMPT_IMAGEN = 'Foto cenital realista de un plato playo blanco sobre una mesa de madera. A la izquierda, papas fritas en bastones (porción normal). A la derecha, separados y sin tocarlas, 2 bastones de queso horneados (porción chica). Sin salsa, sin texto, sin personas, sin decoración.'

async function probarImagen(): Promise<void> {
  const flux = hay('CLOUDFLARE_ACCOUNT_ID') && hay('CLOUDFLARE_API_TOKEN')
  const nombre = hay('GEMINI_API_KEY') ? `Nano Banana${flux ? ', respaldo FLUX' : ''}` : 'FLUX.1 schnell'
  if (!hay('GEMINI_API_KEY') && !flux) return saltear('Imagen', 'falta GEMINI_API_KEY (Nano Banana) o las credenciales de Cloudflare (FLUX)')
  await probar(`Imagen (${nombre})`, async () => {
    const r = await generarImagen({ prompt: PROMPT_IMAGEN })
    const ruta = join(tmpdir(), `nibble-imagen-${Date.now()}.${r.mime === 'image/png' ? 'png' : 'jpg'}`)
    writeFileSync(ruta, Buffer.from(r.imagenBase64, 'base64'))
    return `${r.modelo} · guardada en ${ruta}`
  })
}

// ---------- Voz ----------
const PISTA = 'milanesa, papas fritas, dambo, boniato, nuggets, arvejas, puré, bastones de queso'

const NOTAS: { etiqueta: string; extensiones: string[]; mime: string; dispositivo: string }[] = [
  { etiqueta: 'iPhone, audio/mp4', extensiones: ['.mp4', '.m4a'], mime: 'audio/mp4', dispositivo: 'un iPhone' },
  { etiqueta: 'Android, audio/webm', extensiones: ['.webm'], mime: 'audio/webm', dispositivo: 'un Android (Chrome)' },
]

async function probarVoz(): Promise<void> {
  const puede = hay('GROQ_API_KEY') || (hay('CLOUDFLARE_ACCOUNT_ID') && hay('CLOUDFLARE_API_TOKEN'))
  const audios = archivos('eval/voz')
  for (const nota of NOTAS) {
    const prueba = `Whisper (${nota.etiqueta})`
    const archivo = audios.find((f) => nota.extensiones.includes(extname(f).toLowerCase()))
    if (!puede) {
      saltear(prueba, 'falta GROQ_API_KEY (o las credenciales de Cloudflare para el respaldo)')
      continue
    }
    if (!archivo) {
      saltear(prueba, `no hay nota ${nota.extensiones.join('/')} en eval/voz/: grabá una en ${nota.dispositivo}`)
      continue
    }
    await probar(`${prueba} · ${archivo.split('/').pop()}`, async () => {
      const r = await transcribir({ audioBase64: readFileSync(archivo).toString('base64'), mime: nota.mime, pista: PISTA })
      return `${r.modelo}: "${r.texto}"`
    })
  }
}

// ---------- Main ----------
console.log('Keys (.env.local):')
for (const [variable, para] of KEYS) console.log(`  ${hay(variable) ? 'está ' : 'FALTA'} ${variable} · ${para}`)
console.log()

await probarVision()
await probarImagen()
await probarVoz()

console.log('\nResumen:')
for (const r of resultados) console.log(`  ${r.estado.padEnd(8)} ${r.prueba}${r.ms === undefined ? '' : ` · ${r.ms} ms`}`)
const fallas = resultados.filter((r) => r.estado === 'FALLA').length
console.log(fallas > 0 ? `\n${fallas} falla(s): avisá ya en el grupo (§7, A1).` : '\nNinguna falla.')
process.exitCode = fallas > 0 ? 1 : 0
