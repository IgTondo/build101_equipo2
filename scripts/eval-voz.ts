// Eval de voz (PLAN.md §11.2, A11): cada caso de eval/voz/relatos.json pasa por interpretarRelato(), la misma función
// que usa /api/relato-comida, con un AnalisisComida mínimo armado desde sus ítems. Mide el % de ítems con el `cuanto`
// correcto, el % de conducta correcta, los ítems inventados (tiene que dar 0), las citas válidas y la latencia.
// Salida: Markdown por stdout, separada por dispositivo cuando hay audios (progreso por stderr).
// Uso: npx tsx scripts/eval-voz.ts [--texto] > eval-voz.md
//   --texto   manda relatoEscrito como texto (sin Whisper: evalúa solo la extracción)
//   sin flag  los casos con audio van por Whisper + extracción; los que no tienen audio, como texto
// Llama a la API real: necesita ANTHROPIC_API_KEY y, para los audios, GROQ_API_KEY (ver eval/README.md).
import './eval/entorno.js'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import type { RelatoComidaReq } from '../shared/contratos.js'
import { interpretarRelato } from '../server/ia/relato.js'
import { DIR_VOZ, NINO_EVAL, analisisMinimo, leerRelatos } from './eval/datos.js'
import { deTotal, fechaUY, lista, mensajeError, porcentaje, segundos, tabla } from './eval/markdown.js'
import { compararRelato, relatoFallido, resumirVoz, type ResultadoRelato, type ResumenVoz } from './eval/metricas.js'

const imprimir = console.log.bind(console)
console.log = console.error // lo que loguee server/ia/ va a stderr: stdout queda solo para la tabla

const { values } = parseArgs({ options: { texto: { type: 'boolean', default: false } } })
const casos = leerRelatos()

const resultados: ResultadoRelato[] = []
for (const caso of casos) {
  const analisis = analisisMinimo(caso)
  const audio = !values.texto && caso.audio ? caso.audio : null
  const canal = audio ? (caso.dispositivo ?? 'audio') : 'texto'
  const req: RelatoComidaReq = audio
    ? { ninoId: NINO_EVAL, analisis, audioBase64: readFileSync(join(DIR_VOZ, audio)).toString('base64'), mime: caso.mime }
    : { ninoId: NINO_EVAL, analisis, texto: caso.relatoEscrito }
  const ids = caso.items.map((i) => i.idTmp)
  const t0 = performance.now()
  try {
    const relato = await interpretarRelato(req)
    const ms = performance.now() - t0
    resultados.push({ id: caso.id, canal, ms, comparacion: compararRelato(caso.esperado, relato, ids) })
    console.error(`· ${canal} ${caso.id}: ${segundos(ms)}`)
  } catch (err) {
    resultados.push({ id: caso.id, canal, ms: null, error: mensajeError(err), comparacion: relatoFallido(caso.esperado) })
    console.error(`× ${canal} ${caso.id}: ${mensajeError(err)}`)
  }
}

// ---------- Salida ----------
const CANALES = ['iphone', 'android', 'audio', 'texto']
const grupos = CANALES.map((canal) => ({ canal, casos: resultados.filter((r) => r.canal === canal) })).filter((g) => g.casos.length)
const filas: [string, ResumenVoz][] = grupos.map((g) => [g.canal, resumirVoz(g.casos)])
const total = resumirVoz(resultados)
if (grupos.length > 1) filas.push(['**Total**', total])

const sinteticos = casos.filter((c) => c.fuente === 'sintetico').length
const salida: string[] = [
  '# Eval de voz (§11.2)',
  '',
  `${fechaUY()} · ${values.texto ? 'solo texto (sin Whisper: evalúa la extracción)' : 'audio cuando el caso lo tiene, si no texto'} · ` +
    `${casos.length} casos (${casos.length - sinteticos} del equipo, ${sinteticos} sintéticos, declarados)`,
  '',
  tabla(
    ['Canal', 'Casos', '`cuanto` correcto', 'Conducta correcta', 'Ítems inventados', 'Citas válidas', 'Latencia media', 'p95', '< 8 s', 'Errores'],
    filas.map(([canal, r]) => [
      canal, r.casos, deTotal(r.cuanto.ok, r.cuanto.total), deTotal(r.conducta.ok, r.conducta.total),
      `${r.inventados} (de ${r.sinMencion} sin mencionar)`, deTotal(r.citas.ok, r.citas.total),
      segundos(r.latencia.media), segundos(r.latencia.p95), porcentaje(r.latencia.bajoLimite), r.errores,
    ]),
  ),
  '',
  `**Ítems inventados: ${total.inventados}** (tiene que dar 0): respuestas para ítems que el padre no nombró. ` +
    '`cuanto`: sobre los ítems que sí nombró. Conducta: casos con exactamente los mismos chips. ' +
    'Un caso con error cuenta entero como mal y fuera de los 8 s.',
]

const fallos = resultados.filter(({ error, comparacion: c }) =>
  error || c.cuantoMal.length || c.faltantes.length || c.inventados.length || !c.conductaOk)
if (fallos.length) {
  salida.push('', '## Casos con diferencias', '', tabla(
    ['Caso', 'Canal', '`cuanto` distinto', 'Sin respuesta', 'Inventados', 'Conducta', 'Error'],
    fallos.map(({ id, canal, error, comparacion: c }) => [
      id, canal,
      lista(c.cuantoMal.map((m) => `${m.itemIdTmp}: ${m.obtenido} en vez de ${m.esperado}`)),
      lista(c.faltantes), lista(c.inventados),
      c.conductaOk ? 'ok' : [...c.conductaDeMas.map((x) => `+${x}`), ...c.conductaFaltante.map((x) => `−${x}`)].join(' ') || '—',
      error ?? '',
    ]),
  ))
}

imprimir(salida.join('\n'))
if (total.errores === total.casos) process.exitCode = 1 // ninguna llamada anduvo: falta la key o el relato
