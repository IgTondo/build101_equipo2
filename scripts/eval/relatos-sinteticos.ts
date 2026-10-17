// Set de texto de la eval de voz (PLAN.md §11.2), armado desde las 40 comidas de data/sinteticos/ (§10.5): relato,
// respuestas con su cita y conducta. Es una simulación y se declara (`fuente: 'sintetico'`).
// Uso: npx tsx scripts/eval/relatos-sinteticos.ts → reescribe los casos sintéticos de eval/voz/relatos.json y deja
// como están los del equipo. No editar los sintéticos a mano: cambiar este archivo y volver a correrlo.
//
// En los relatos sintéticos el padre nombra todos los ítems. Para medir los ítems inventados (§11.2: tiene que dar 0),
// en las comidas de 3 ítems se borra del relato la frase de uno (rotando cuál) y ese ítem pasa a esperado.sinMencion.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { RegistrarComidaReq } from '../../shared/contratos.js'
import { DIR_VOZ, RAIZ, leerRelatos, type CasoRelato } from './datos.js'

export interface NinoSintetico { ninoId: string; comidas: RegistrarComidaReq[] }

export function casosSinteticos(ninos: NinoSintetico[]): CasoRelato[] {
  return ninos.flatMap(({ comidas }) => comidas.map((comida, n) => {
    const { analisis, respuestas, conducta } = comida
    const id = analisis.analisisId
    let relato = comida.relato?.transcripcion
    if (!relato) throw new Error(`${id}: la comida no trae relato`)

    const omitido = analisis.items.length >= 3 ? analisis.items[n % analisis.items.length].idTmp : null
    if (omitido) {
      const cita = respuestas.find((r) => r.itemIdTmp === omitido)?.cita
      if (!cita || !relato.includes(cita)) throw new Error(`${id}: la cita de ${omitido} no está en el relato`)
      relato = relato.replace(cita, '').replace(/\s+/g, ' ').trim()
    }
    const quedan = respuestas.filter((r) => r.itemIdTmp !== omitido)
    for (const r of quedan) {
      if (!r.cita || !relato.includes(r.cita)) throw new Error(`${id}: la cita de ${r.itemIdTmp} no está en el relato`)
    }

    return {
      id: omitido ? `${id}-sin-${omitido}` : id,
      fuente: 'sintetico' as const,
      relatoEscrito: relato,
      items: analisis.items.map(({ idTmp, preparacion }) => ({ idTmp, preparacion })),
      ...(analisis.preguntas.length ? { preguntas: analisis.preguntas } : {}),
      esperado: {
        respuestas: quedan.map(({ itemIdTmp, cuanto }) => ({ itemIdTmp, cuanto })),
        sinMencion: omitido ? [omitido] : [],
        conducta,
      },
    }
  }))
}

export function leerSinteticos(): NinoSintetico[] {
  return ['tomas', 'lucia'].map((n) => JSON.parse(readFileSync(join(RAIZ, 'data', 'sinteticos', `${n}.json`), 'utf8')) as NinoSintetico)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const ruta = join(DIR_VOZ, 'relatos.json')
  const delEquipo = existsSync(ruta) ? leerRelatos(ruta).filter((c) => c.fuente !== 'sintetico') : []
  const sinteticos = casosSinteticos(leerSinteticos())
  writeFileSync(ruta, `${JSON.stringify([...delEquipo, ...sinteticos], null, 2)}\n`)
  const conOmision = sinteticos.filter((c) => c.esperado.sinMencion.length).length
  console.log(`eval/voz/relatos.json: ${delEquipo.length} del equipo + ${sinteticos.length} sintéticos (${conOmision} con un ítem sin mencionar)`)
}
