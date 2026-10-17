// Rehace el grafo (silver) desde Mongo (bronze), PLAN.md §4.3 y §13: si Neo4j se cayó, si se cambió de motor o si
// cambiaron las reglas del aprendizaje. Mongo nunca se toca.
// Uso: npx tsx --env-file=.env.local scripts/reconstruir-grafo.ts [ninoId] [--motor=neo4j|mongo] [--sin-seed]
import { cerrarMongo } from '../server/datos/mongo.js'
import { type MotorGrafo, cerrarNeo4j } from '../server/grafo/cliente.js'
import { reconstruirGrafo } from '../server/grafo/reconstruir.js'

async function main() {
  const args = process.argv.slice(2)
  const motor = args.find((a) => a.startsWith('--motor='))?.slice('--motor='.length)
  const ninoId = args.find((a) => !a.startsWith('--'))
  const r = await reconstruirGrafo({
    ...(ninoId ? { ninoId } : {}),
    ...(motor === 'neo4j' || motor === 'mongo' ? { motor: motor as MotorGrafo } : {}),
    sembrar: !args.includes('--sin-seed'),
  })
  console.log(`Grafo reconstruido en ${r.motor}: ${r.ninos} chico(s), ${r.comidas} comidas.`)
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
