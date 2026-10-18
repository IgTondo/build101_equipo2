// Rehace el grafo (silver) desde Mongo (bronze) (PLAN.md §4.3 y §13): si Neo4j se cayó, si cambió el motor o si
// cambiaron las reglas del aprendizaje. El bronze nunca se reescribe. Lo usa scripts/reconstruir-grafo.ts.
import { calcularEstado } from '../aprendizaje/estado.js'
import { alimentosCatalogo, preparacionesCatalogo } from '../datos/catalogos.js'
import { objetivoDe } from '../datos/cargar.js'
import { col } from '../datos/mongo.js'
import { almacen } from './almacen.js'
import type { MotorGrafo } from './cliente.js'

export async function reconstruirGrafo(op: { ninoId?: string; motor?: MotorGrafo; sembrar?: boolean } = {}): Promise<{ motor: MotorGrafo; ninos: number; comidas: number; huerfanas: number }> {
  const a = almacen(op.motor)
  const catalogo = preparacionesCatalogo()
  await a.asegurarEsquema()
  if (op.sembrar !== false) await a.sembrar([...catalogo.values()], [...alimentosCatalogo().values()])
  const ninos = await col.ninos().find(op.ninoId ? { _id: op.ninoId } : {}).toArray()
  let comidasTotal = 0
  for (const nino of ninos) {
    const comidas = await col.comidas().find({ ninoId: nino._id }).sort({ fechaISO: 1 }).toArray()
    const estado = calcularEstado(nino, comidas, catalogo)
    await a.borrarNino(nino._id)
    await a.escribirNino(nino, objetivoDe(nino), estado)
    for (const c of comidas) await a.escribirComida(c, estado)
    comidasTotal += comidas.length
  }
  // Con todos los chicos rehechos, lo que no es del catálogo y quedó compartido (de antes) ya no lo usa nadie
  const huerfanas = op.ninoId ? 0 : await a.borrarHuerfanas()
  return { motor: a.motor, ninos: ninos.length, comidas: comidasTotal, huerfanas }
}
