// A10 · v5.3: la imagen del plato completo de una comida (ImagenPlatoReq.plato) con los platos de Tomás y Lucía.
// Va directo a Nano Banana (sin el respaldo de FLUX, para no gastar el cupo de Workers AI). Guarda cada JPEG y su prompt.
// Uso: `npx tsx --env-file=.env.local scripts/probar-imagen-plato.ts <carpeta> [id…]` (sin ids, todos).
//      Con `--solo-prompt` imprime los prompts y no genera nada.
// Costo: USD 0,0336 por imagen (Nano Banana 2.1, con billing).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ImagenPlatoReq, ItemPlato, Receta, Sugerencia } from '../shared/contratos.js'
import { promptImagenPlato } from '../server/ia/imagen-plato.js'
import { imagenNanoBanana } from '../server/ia/proveedores/nano-banana.js'

const FIXTURE = JSON.parse(readFileSync(join(process.cwd(), 'fixtures', 'receta.json'), 'utf8')) as Receta
const receta = (preparacionBaseId: string, desde: [string, string], presentacion: string, seMantiene: string[]): Receta =>
  ({ ...FIXTURE, preparacionBaseId, desde: { preparacionId: desde[0], nombre: desde[1] }, presentacion, seMantiene })
const seguro = (preparacionId: string, nombre: string): ItemPlato => ({ preparacionId, nombre, porcion: 'mediana', aporte: {}, porQue: '' })
const pasito = (preparacionId: string, nombre: string): Sugerencia =>
  ({ tipo: 'un_paso', preparacionId, nombre, probAcepta: 0.5, aporte: {}, porQue: '' })
const base = { nutriente: 'calcio_mg' as const, cubre: 0.5, porQue: '' }

const CASOS: [string, ImagenPlatoReq][] = [
  ['tomas-cena', { receta: FIXTURE, reglas: [], plato: { ...base, momento: 'cena',
    seguros: [seguro('milanesa_carne_horno', 'Milanesa de carne al horno'), seguro('papas_horno_baston', 'Papas al horno en bastones')],
    pasito: pasito('bastones_queso_horno', 'Bastones de queso al horno') } }],
  ['tomas-desayuno', { receta: receta('tostadas_queso', ['tostadas', 'Tostadas de pan blanco'],
    'Sus tostadas y media tostada con queso al costado.', ['forma=plano', 'textura=crocante', 'coccion=horno']), reglas: [],
  plato: { ...base, momento: 'desayuno', seguros: [seguro('leche_chocolatada', 'Leche chocolatada'), seguro('tostadas', 'Tostadas')],
    pasito: pasito('tostadas_queso', 'Tostadas con queso') } }],
  ['lucia-almuerzo', { receta: receta('pure_papa_queso', ['pure_papa', 'Puré de papa'],
    'Sus fideos y una cucharada de puré con queso al costado.', ['forma=pure', 'textura=cremoso']), reglas: [],
  plato: { ...base, momento: 'almuerzo', seguros: [seguro('fideos_manteca_queso', 'Fideos con manteca y queso')],
    pasito: pasito('pure_papa_queso', 'Puré de papa con queso') } }],
  // Variantes: 4 en el plato (3 seguros + el pasito) y un pasito en bol al lado de un plato con vaso.
  ['tomas-cena-4', { receta: FIXTURE, reglas: [], plato: { ...base, momento: 'cena',
    seguros: [seguro('milanesa_carne_horno', 'Milanesa de carne al horno'), seguro('papas_horno_baston', 'Papas al horno en bastones'),
      seguro('manzana_bastones', 'Manzana en bastones')],
    pasito: pasito('bastones_queso_horno', 'Bastones de queso al horno') } }],
  ['tomas-merienda-yogur', { receta: receta('yogur_vainilla', ['leche_chocolatada', 'Leche chocolatada'], '', ['textura=cremoso', 'sabor=dulce']),
    reglas: [], plato: { ...base, momento: 'merienda', seguros: [seguro('leche_chocolatada', 'Leche chocolatada'), seguro('galletitas_agua', 'Galletitas de agua')],
      pasito: pasito('yogur_vainilla', 'Yogur de vainilla') } }],
]

const args = process.argv.slice(2)
const soloPrompt = args.includes('--solo-prompt')
const posicionales = args.filter((a) => a !== '--solo-prompt')
const [carpeta, ...ids] = soloPrompt ? ['', ...posicionales] : posicionales
if (!soloPrompt && !carpeta) throw new Error('falta la carpeta')
if (carpeta && !soloPrompt) mkdirSync(carpeta, { recursive: true })
for (const [id, req] of CASOS.filter(([id]) => !ids.length || ids.includes(id))) {
  const prompt = promptImagenPlato(req)
  if (soloPrompt) { console.log(`--- ${id} (${prompt.length} caracteres)\n${prompt}\n`); continue }
  writeFileSync(join(carpeta, `${id}.txt`), `${prompt}\n`)
  const inicio = Date.now()
  try {
    const r = await imagenNanoBanana(prompt)
    writeFileSync(join(carpeta, `${id}.jpg`), Buffer.from(r.imagenBase64, 'base64'))
    console.log(`OK    ${id} · ${r.modelo} · ${Date.now() - inicio} ms`)
  } catch (e) {
    console.log(`FALLA ${id} · ${e instanceof Error ? e.message : String(e)}`)
  }
}
