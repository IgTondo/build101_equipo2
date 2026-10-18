// A10: la imagen del plato con 5 recetas reales, por el mismo camino que /api/imagen-plato (promptImagenPlato →
// generarImagen: Nano Banana con billing o FLUX.1 schnell). Guarda cada JPEG y su prompt para mirarlos.
// Uso: `npx tsx scripts/probar-imagen.ts [carpeta]` (por defecto, una en el tmpdir).
// Costo: con FLUX, unas 58 neuronas por imagen (≈ 290 de las 10.000 gratis por día); con Nano Banana, USD 0,0336 c/u.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { config } from 'dotenv'
import type { ImagenPlatoReq, Receta, Regla } from '../shared/contratos.js'
import { generarImagen } from '../server/ia/imagen.js'
import { promptImagenPlato } from '../server/ia/imagen-plato.js'

config({ path: '.env.local', quiet: true })

const FIXTURE = JSON.parse(readFileSync(join(process.cwd(), 'fixtures', 'receta.json'), 'utf8')) as Receta
const receta = (preparacionBaseId: string, desde: [string, string], presentacion: string, seMantiene: string[]): Receta =>
  ({ ...FIXTURE, preparacionBaseId, desde: { preparacionId: desde[0], nombre: desde[1] }, presentacion, seMantiene })
const noSeToquen: Regla = { texto: 'Que no se toquen', condiciones: [{ tipo: 'distribucion', valor: 'tocandose' }], efecto: 'rechaza' }

const CASOS: [string, ImagenPlatoReq][] = [
  ['1-papas-horno_a_bastones-queso', { receta: FIXTURE, reglas: [] }],
  ['2-chocolatada_a_yogur-bebible', { receta: receta('yogur_bebible', ['leche_chocolatada', 'Leche chocolatada'],
    'Su vaso de chocolatada y, al lado, un vaso chico con un poco de yogur bebible.', ['textura=cremoso', 'sabor=dulce', 'temperatura=frio']), reglas: [] }],
  ['3-milanesa-carne_a_merluza', { receta: receta('milanesa_merluza_horno', ['milanesa_carne_horno', 'Milanesa de carne al horno'],
    'Su milanesa de carne a la izquierda y un pedacito de milanesa de merluza a la derecha.', ['forma=plano', 'textura=crocante', 'coccion=horno']), reglas: [] }],
  ['4-tostadas_a_tostadas-queso', { receta: receta('tostadas_queso', ['tostadas', 'Tostadas de pan blanco'],
    'Sus tostadas a la izquierda y media tostada con queso a la derecha.', ['forma=plano', 'textura=crocante', 'coccion=horno']), reglas: [] }],
  ['5-papas-fritas_a_boniato', { receta: receta('bastones_boniato_fritos', ['papas_fritas_baston', 'Papas fritas en bastones'],
    'Sus papas fritas a la izquierda y 3 bastones de boniato a la derecha.', ['forma=baston', 'textura=crocante', 'coccion=frito']), reglas: [noSeToquen] }],
]

const carpeta = process.argv[2] ?? join(tmpdir(), `nibble-imagenes-${Date.now()}`)
mkdirSync(carpeta, { recursive: true })
for (const [id, req] of CASOS) {
  const prompt = promptImagenPlato(req)
  writeFileSync(join(carpeta, `${id}.txt`), `${prompt}\n`)
  try {
    const r = await generarImagen({ prompt })
    writeFileSync(join(carpeta, `${id}.jpg`), Buffer.from(r.imagenBase64, 'base64'))
    console.log(`OK    ${id} · ${r.modelo} · ${r.ms} ms`)
  } catch (e) {
    console.log(`FALLA ${id} · ${e instanceof Error ? e.message : String(e)}`)
  }
}
console.log(`Imágenes y prompts en ${carpeta}`)
