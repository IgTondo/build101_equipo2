// v5.10 · Qué ingredientes combinan entre sí: co-ocurrencia en recetas reales → data/afinidades.json.
// Uso: npx tsx scripts/afinidades.ts
// Lee el dataset de Ahn, Ahnert, Bagrow y Barabási (2011), "Flavor network and the principles of food pairing",
// Sci. Rep. 1:196 (CC BY 4.0, https://doi.org/10.5281/zenodo.11449657), que va descomprimido en
// data/usda/flavor/scirep-cuisines-detail/ (ignorado). Traduce sus ingredientes a nuestros alimentoId
// (scripts/afinidades/mapa.ts), cuenta en cuántas recetas van juntos y les da una afinidad de 0 a 1
// (scripts/afinidades/logica.ts: NPMI positivo con suavizado, pesado por región). Los ids del mapa que todavía no están
// en data/alimentos.json se ignoran y se avisan. Lo lee server/ia/afinidades.ts.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Alimento } from '../shared/contratos.js'
import { afinidades, contar, leerRecetas, leerRegiones, PESO_REGION, type Receta } from './afinidades/logica.js'
import { MAPA } from './afinidades/mapa.js'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const DATOS = join(RAIZ, 'data', 'usda', 'flavor', 'scirep-cuisines-detail')
const ARCHIVOS = ['epic_recipes.txt', 'allr_recipes.txt', 'menu_recipes.txt']
const SALIDA = join(RAIZ, 'data', 'afinidades.json')

if (!existsSync(join(DATOS, 'map.txt'))) {
  console.error(`Falta el dataset en ${DATOS}: descomprimir flavor.zip de https://doi.org/10.5281/zenodo.11449657 ahí.`)
  process.exit(1)
}

const leer = (archivo: string) => readFileSync(join(DATOS, archivo), 'utf8')
const recetas: Receta[] = ARCHIVOS.flatMap((a) => leerRecetas(leer(a)))
const regiones = leerRegiones(leer('map.txt'))
const catalogo = JSON.parse(readFileSync(join(RAIZ, 'data', 'alimentos.json'), 'utf8')) as Alimento[]
const existentes = new Set(catalogo.map((a) => a.id))

const faltan = [...new Set(Object.values(MAPA).flat())].filter((id) => !existentes.has(id)).sort()
if (faltan.length) console.log(`Ids del mapa que todavía no están en data/alimentos.json (se ignoran): ${faltan.join(', ')}`)
const sinUsar = [...existentes].filter((id) => !id.startsWith('otro_') && !Object.values(MAPA).some((ids) => ids.includes(id))).sort()
console.log(`Alimentos del catálogo sin ingrediente de Ahn: ${sinUsar.join(', ') || 'ninguno'}`)

const conteo = contar(recetas, regiones, MAPA, existentes)
const pares = afinidades(conteo)
const conPares = new Set(pares.map((p) => p.a))

const pesos = Object.entries(PESO_REGION).map(([r, p]) => `${r} ${p}`).join(', ')
const cabecera = {
  fuente: `Ahn, Ahnert, Bagrow y Barabási (2011), "Flavor network and the principles of food pairing", Sci. Rep. 1:196 · https://doi.org/10.5281/zenodo.11449657 · co-ocurrencia en ${conteo.recetas} de ${recetas.length} recetas (epicurious, allrecipes, menupan), pesadas por región (${pesos}) · afinidad: NPMI positivo con suavizado (scripts/afinidades/logica.ts)`,
  licencia: 'CC BY 4.0',
  generado: new Date().toISOString().slice(0, 10),
}
// Un par por línea: se lee y se diffea mejor
const json = `${JSON.stringify(cabecera, null, 2).slice(0, -2)},\n  "pares": [\n${pares.map((p) => `    ${JSON.stringify(p)}`).join(',\n')}\n  ]\n}\n`
writeFileSync(SALIDA, json)
console.log(`${pares.length / 2} pares entre ${conPares.size} alimentos → ${SALIDA}`)
