// Completa lo declarado en los perfiles ya creados (v5.8): lo que acepta y lo que rechaza que no es del catálogo y quedó
// incompleto (menos de 8 atributos, sin ingredientes o sin momentos) se completa con lo típico (server/ia/completar.ts).
// Antes, un "Sushi" guardado solo con {temperatura, grupo, cocción} y sin ingredientes terminaba "parecido" a la chocolatada.
// Por defecto NO escribe nada: muestra el antes y el después de cada chico. Con --escribir guarda el borrador completo
// ($set) y rehace el grafo de ese chico. Lo que dijo el padre (nombre, sus palabras, los atributos que traía) no se toca.
// Uso: npx tsx --env-file=.env.local scripts/completar-perfiles.ts [ninoId] [--escribir]
import type { PerfilBorrador } from '../shared/contratos.js'
import { cerrarMongo, col } from '../server/datos/mongo.js'
import { completarBorrador, declaradoIncompleto } from '../server/datos/perfiles.js'
import { cerrarNeo4j } from '../server/grafo/cliente.js'
import { reconstruirGrafo } from '../server/grafo/reconstruir.js'

type Declarado = PerfilBorrador['acepta'][number] | PerfilBorrador['rechaza'][number]

function describir(a: Declarado): string {
  const atr = Object.entries(a.atributos ?? {}).filter(([, v]) => v).map(([k, v]) => `${k}=${String(v)}`)
  const ing = (a.ingredientes ?? []).map((i) => `${i.alimentoId} ${i.gramos} g`)
  return [
    `id: ${a.preparacionId ?? '(sin catálogo)'}`,
    `atributos (${atr.length}/8): ${atr.join(', ') || '—'}`,
    `ingredientes: ${ing.join(', ') || '—'}`,
    `momentos: ${(a.momentos ?? []).join(', ') || '—'}`,
    ...(a.inferido ? ['inferido: sí'] : []),
    ...(a.duda ? [`duda: ${a.duda}`] : []),
  ].join('\n      ')
}

async function main() {
  const args = process.argv.slice(2)
  const escribirlo = args.includes('--escribir')
  const ninoId = args.find((a) => !a.startsWith('--'))
  const ninos = await col.ninos().find(ninoId ? { _id: ninoId } : {}).toArray()
  console.log(`${escribirlo ? 'ESCRIBE' : 'Prueba (no escribe nada; --escribir para guardar)'} · ${ninos.length} chico(s)\n`)
  let cambiados = 0
  for (const nino of ninos) {
    const b = nino.borrador
    const incompletos = [...(b.acepta ?? []), ...(b.rechaza ?? [])].filter((a) => a.preparacionId === null && declaradoIncompleto(a))
    if (!incompletos.length) {
      console.log(`== ${nino.datos.nombre} (${nino._id}): nada incompleto`)
      continue
    }
    console.log(`== ${nino.datos.nombre} (${nino._id}) · alergias: ${[...nino.datos.alergias, ...(nino.datos.alergiasOtras ?? [])].join(', ') || 'ninguna'}`)
    const nuevo = await completarBorrador(b, nino.datos, { limiteMs: 60_000 })
    const pares = [
      ...(b.acepta ?? []).map((a, i) => ['acepta', a, nuevo.acepta[i]] as const),
      ...(b.rechaza ?? []).map((r, i) => ['rechaza', r, nuevo.rechaza[i]] as const),
    ]
    for (const [lista, antes, despues] of pares) {
      if (!despues || JSON.stringify(antes) === JSON.stringify(despues)) continue
      console.log(`  ${lista} · ${antes.nombre}${antes.dicho ? ` ("${antes.dicho}")` : ''}`)
      console.log(`    antes:\n      ${describir(antes)}`)
      console.log(`    después:\n      ${describir(despues)}`)
    }
    if (JSON.stringify(b) === JSON.stringify(nuevo)) {
      console.log('  (el modelo no devolvió nada nuevo: queda como estaba)\n')
      continue
    }
    cambiados++
    if (escribirlo) {
      await col.ninos().updateOne({ _id: nino._id }, { $set: { borrador: nuevo, actualizadoISO: new Date().toISOString() } })
      const r = await reconstruirGrafo({ ninoId: nino._id, sembrar: false })
      console.log(`  guardado; grafo rehecho en ${r.motor} (${r.comidas} comidas)`)
    }
    console.log('')
  }
  console.log(`${cambiados} chico(s) con cambios${escribirlo ? ' guardados' : ' (sin guardar)'}.`)
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
