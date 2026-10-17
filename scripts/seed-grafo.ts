// B3 + B5: crea las constraints y siembra el grafo base con el catálogo (Nutrientes, Ingredientes + APORTA {por100g},
// Atributos, Preparaciones + TIENE + CONTIENE). Se puede correr las veces que haga falta: todo es MERGE.
// Uso: npx tsx --env-file=.env.local scripts/seed-grafo.ts [neo4j|mongo]   (sin argumento: según MOTOR_GRAFO)
import { alimentosCatalogo, preparacionesCatalogo } from '../server/datos/catalogos.js'
import { cerrarMongo } from '../server/datos/mongo.js'
import { almacen } from '../server/grafo/almacen.js'
import { type MotorGrafo, cerrarNeo4j } from '../server/grafo/cliente.js'

async function main() {
  const arg = process.argv[2]
  const motor = arg === 'neo4j' || arg === 'mongo' ? (arg as MotorGrafo) : undefined
  const a = almacen(motor)
  const preparaciones = [...preparacionesCatalogo().values()]
  const alimentos = [...alimentosCatalogo().values()]
  if (!alimentos.length) {
    console.warn('Ojo: todavía no está data/alimentos.json (A3). Los ingredientes quedan sin APORTA: volvé a correr el seed cuando esté.')
  }
  await a.asegurarEsquema()
  await a.sembrar(preparaciones, alimentos)
  console.log(`Grafo sembrado en ${a.motor}: ${preparaciones.length} preparaciones y ${alimentos.length} alimentos.`)
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
