// Carga a los chicos del dataset sintético (PLAN.md §10.5) con el flujo real: crearPerfil + registrarComida,
// comida por comida y con sus fechas. Es una simulación declarada: quedan como "sint-tomas", "sint-lucia" y
// "sint-valentina" para no pisar al Tomás de la demo, que se carga a mano con el flujo real (§6). Sirve para probar
// el tablero y las recetas. Sin argumentos carga a Tomás y a Lucía; Valentina (6 semanas, 181 comidas) se pide aparte.
// Uso: npx tsx --env-file=.env.local scripts/cargar-sinteticos.ts [tomas] [lucia] [valentina] [--prefijo=sint-]
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { DatosBasicos, PerfilBorrador, RegistrarComidaReq } from '../shared/contratos.js'
import { registrarComida } from '../server/datos/comidas.js'
import { cerrarMongo } from '../server/datos/mongo.js'
import { crearPerfil } from '../server/datos/perfiles.js'
import { obtenerProgreso } from '../server/datos/tablero.js'
import { cerrarNeo4j } from '../server/grafo/cliente.js'

interface Sintetico {
  datos: DatosBasicos
  borrador: PerfilBorrador
  comidas: RegistrarComidaReq[]
}

async function main() {
  const args = process.argv.slice(2)
  const prefijo = args.find((a) => a.startsWith('--prefijo='))?.slice('--prefijo='.length) ?? 'sint-'
  const pedidos = args.filter((a) => !a.startsWith('--'))
  for (const id of pedidos.length ? pedidos : ['tomas', 'lucia']) {
    const s = JSON.parse(readFileSync(join(process.cwd(), 'data', 'sinteticos', `${id}.json`), 'utf8')) as Sintetico
    const ninoId = `${prefijo}${id}`
    await crearPerfil({ ninoId, datos: s.datos, borrador: s.borrador }, { reemplazar: true })
    for (const comida of s.comidas) await registrarComida({ ...comida, ninoId })
    const ultimo = s.comidas.at(-1)?.dia
    const p = await obtenerProgreso(ninoId, ultimo ? { hasta: ultimo } : {})
    console.log(`${ninoId}: ${s.comidas.length} comidas. ${p.frase}`)
    console.log(`  Un pasito: ${p.proximoPaso?.nombre ?? '—'} · Alertas: ${p.alertas.map((a) => a.tipo).join(', ') || 'ninguna'}`)
  }
}

main()
  .catch((e: unknown) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await cerrarNeo4j()
    await cerrarMongo()
  })
