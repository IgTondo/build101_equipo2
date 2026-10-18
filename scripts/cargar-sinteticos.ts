// Carga a los chicos del dataset sintético (PLAN.md §10.5) con el flujo real: crearPerfil + registrarComida,
// comida por comida y con sus fechas. Es una simulación declarada: quedan con prefijo ("sint-valentina", la de la demo,
// y "sint-tomas" y "sint-lucia", los de los tests) para no pisar a un chico real. Sirve para probar el tablero y las
// recetas. Sin argumentos carga a Tomás y a Lucía; Valentina (6 semanas, 181 comidas) se pide aparte.
// --hasta=YYYY-MM-DD corre todas las fechas (dia y fechaISO, con su hora y su -03:00) los días enteros que hagan falta
// para que la última comida del chico caiga ese día: así la demo muestra "esta semana" aunque el dataset sea viejo.
// Sin --hasta, las fechas quedan como en el JSON.
// Uso: npx tsx --env-file=.env.local scripts/cargar-sinteticos.ts [tomas] [lucia] [valentina] [--prefijo=sint-] [--hasta=2026-10-18]
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { DatosBasicos, PerfilBorrador, RegistrarComidaReq } from '../shared/contratos.js'
import { registrarComida } from '../server/datos/comidas.js'
import { diasEntre, esDia, sumarDias } from '../server/datos/fechas.js'
import { cerrarMongo } from '../server/datos/mongo.js'
import { crearPerfil } from '../server/datos/perfiles.js'
import { obtenerProgreso } from '../server/datos/tablero.js'
import { cerrarNeo4j } from '../server/grafo/cliente.js'

interface Sintetico {
  datos: DatosBasicos
  borrador: PerfilBorrador
  comidas: RegistrarComidaReq[]
}

/** Corre las comidas días enteros para que la última caiga en `hasta`. La hora y el huso (-03:00) no se tocan. */
export function correrHasta(comidas: readonly RegistrarComidaReq[], hasta: string): RegistrarComidaReq[] {
  const ultimo = comidas.reduce((max, c) => (c.dia > max ? c.dia : max), '')
  if (!ultimo) return [...comidas]
  const n = diasEntre(ultimo, hasta)
  return comidas.map((c) => ({ ...c, dia: sumarDias(c.dia, n), fechaISO: sumarDias(c.fechaISO.slice(0, 10), n) + c.fechaISO.slice(10) }))
}

async function main() {
  const args = process.argv.slice(2)
  const prefijo = args.find((a) => a.startsWith('--prefijo='))?.slice('--prefijo='.length) ?? 'sint-'
  const hasta = args.find((a) => a.startsWith('--hasta='))?.slice('--hasta='.length)
  if (hasta !== undefined && !esDia(hasta)) throw new Error(`--hasta tiene que ser YYYY-MM-DD (vino "${hasta}")`)
  const pedidos = args.filter((a) => !a.startsWith('--'))
  for (const id of pedidos.length ? pedidos : ['tomas', 'lucia']) {
    const s = JSON.parse(readFileSync(join(process.cwd(), 'data', 'sinteticos', `${id}.json`), 'utf8')) as Sintetico
    if (hasta) s.comidas = correrHasta(s.comidas, hasta)
    const ninoId = `${prefijo}${id}`
    await crearPerfil({ ninoId, datos: s.datos, borrador: s.borrador }, { reemplazar: true })
    for (const comida of s.comidas) await registrarComida({ ...comida, ninoId })
    const ultimo = s.comidas.at(-1)?.dia
    const p = await obtenerProgreso(ninoId, ultimo ? { hasta: ultimo } : {})
    console.log(`${ninoId}: ${s.comidas.length} comidas. ${p.frase}`)
    console.log(`  Un pasito: ${p.proximoPaso?.nombre ?? '—'} · Alertas: ${p.alertas.map((a) => a.tipo).join(', ') || 'ninguna'}`)
  }
}

// Solo corre si se ejecuta el script (no si se importa correrHasta)
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .catch((e: unknown) => {
      console.error(e)
      process.exitCode = 1
    })
    .finally(async () => {
      await cerrarNeo4j()
      await cerrarMongo()
    })
}
