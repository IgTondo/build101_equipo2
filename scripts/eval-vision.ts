// Eval de visión (PLAN.md §11.1, A11): cada foto de eval/etiquetas.json pasa por analizarComida(), la misma función que
// usa /api/analizar-comida, con Claude Haiku 5.5 y con Sonnet 5.5. Mide recall y precisión por alimentoId, atributos en
// los acertados y latencia, y recomienda el que acierte más en menos de 8 s. Salida: Markdown por stdout (progreso por stderr).
// Uso: npx tsx scripts/eval-vision.ts [--modelo haiku|sonnet|ambos] > eval-vision.md   (por defecto, ambos)
// Llama a la API real: necesita ANTHROPIC_API_KEY (.env.local o secretos de Actions, ver eval/README.md).
import './eval/entorno.js'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { idsAlimentos } from '../server/ia/catalogo.js'
import { analizarComida } from '../server/ia/vision.js'
import { DIR_FOTOS, NINO_EVAL, leerEtiquetas } from './eval/datos.js'
import { deTotal, fechaUY, lista, mensajeError, porcentaje, segundos, tabla } from './eval/markdown.js'
import { ATRIBUTOS_EVAL, compararFoto, recomendarModelo, resumirVision, type ResultadoFoto, type ResumenVision } from './eval/metricas.js'

const MODELOS = { haiku: 'claude-haiku-5-5', sonnet: 'claude-sonnet-5-5' } as const
type Alias = keyof typeof MODELOS

const { values } = parseArgs({ options: { modelo: { type: 'string', default: 'ambos' } } })
const elegidos = values.modelo === 'ambos' ? (['haiku', 'sonnet'] as Alias[]) : [values.modelo as Alias]
if (elegidos.some((a) => !(a in MODELOS))) {
  console.error(`--modelo ${values.modelo}: tiene que ser haiku, sonnet o ambos`)
  process.exit(2)
}

const etiquetas = leerEtiquetas()

interface Pasada { modelo: string; fotos: ResultadoFoto[]; respondio: Set<string>; resumen: ResumenVision }

async function pasada(modelo: string): Promise<Pasada> {
  process.env.MODELO_VISION = modelo // generarJSON lo lee en cada llamada y pisa el modelo de la tarea 'vision'
  const fotos: ResultadoFoto[] = []
  const respondio = new Set<string>()
  for (const e of etiquetas) {
    const imagenBase64 = readFileSync(join(DIR_FOTOS, e.archivo)).toString('base64')
    const t0 = performance.now()
    try {
      const analisis = await analizarComida({ ninoId: NINO_EVAL, imagenBase64, mime: 'image/jpeg' })
      const ms = performance.now() - t0
      respondio.add(analisis.modelo)
      fotos.push({ archivo: e.archivo, ms, comparacion: compararFoto(e.alimentos, analisis.items) })
      console.error(`· ${modelo} ${e.archivo}: ${segundos(ms)}`)
    } catch (err) {
      fotos.push({ archivo: e.archivo, ms: null, error: mensajeError(err), comparacion: compararFoto(e.alimentos, []) })
      console.error(`× ${modelo} ${e.archivo}: ${mensajeError(err)}`)
    }
  }
  return { modelo, fotos, respondio, resumen: resumirVision(fotos) }
}

const antes = process.env.MODELO_VISION
const pasadas: Pasada[] = []
for (const a of elegidos) pasadas.push(await pasada(MODELOS[a]))
if (antes === undefined) delete process.env.MODELO_VISION
else process.env.MODELO_VISION = antes

// ---------- Salida ----------
const deInternet = etiquetas.filter((e) => e.fuente === 'internet').length
const salida: string[] = [
  '# Eval de visión (§11.1)',
  '',
  `${fechaUY()} · ${etiquetas.length} fotos (${etiquetas.length - deInternet} del equipo, ${deInternet} de internet, declaradas) · ` +
    `${etiquetas.reduce((s, e) => s + e.alimentos.length, 0)} alimentos etiquetados · sin perfil del chico: solo el catálogo semilla`,
  '',
  tabla(
    ['Modelo', 'Recall', 'Precisión', 'Atributos', 'Latencia media', 'p95', 'Fotos < 8 s', 'Errores'],
    pasadas.map(({ modelo, resumen: r }) => [
      modelo, deTotal(r.aciertos, r.etiquetados), deTotal(r.aciertos, r.predichos), deTotal(r.atributos.ok, r.atributos.total),
      segundos(r.latencia.media), segundos(r.latencia.p95), porcentaje(r.latencia.bajoLimite), r.errores,
    ]),
  ),
  '',
]
const recomendado = recomendarModelo(pasadas)
if (recomendado && pasadas.length > 1) salida.push(`**Recomendación: ${recomendado.modelo}**: ${recomendado.motivo}.`, '')
salida.push(
  'Recall: alimentos etiquetados que reconoció (el ingrediente de más gramos de un ítem). Precisión: de los que dijo, cuántos estaban; ' +
    'los `otro_<grupo>` cuentan como "no reconocido", no como error. Atributos: textura, forma, color y cocción (si está etiquetada), ' +
    'solo en los reconocidos. Una foto con error cuenta como no reconocida y fuera de los 8 s.',
  '',
  '## Atributos de los alimentos reconocidos',
  '',
  tabla(['Modelo', 'Textura', 'Forma', 'Color', 'Cocción'], pasadas.map(({ modelo, resumen: r }) =>
    [modelo, ...ATRIBUTOS_EVAL.map((k) => deTotal(r.atributos.porAtributo[k].ok, r.atributos.porAtributo[k].total))])),
  '',
  '## Por foto',
)
for (const { modelo, fotos } of pasadas) {
  salida.push('', `### ${modelo}`, '', tabla(
    ['Foto', 'Reconocidos', 'Faltaron', 'De más', 'otro_*', 'Atributos', 'Tiempo'],
    fotos.map(({ archivo, ms, error, comparacion: c }) => {
      const ok = ATRIBUTOS_EVAL.reduce((s, k) => s + c.atributos[k].ok, 0)
      const total = ATRIBUTOS_EVAL.reduce((s, k) => s + c.atributos[k].total, 0)
      return [archivo, deTotal(c.aciertos, c.etiquetados), lista(c.faltaron), lista(c.deMas), c.genericos, deTotal(ok, total), error ? `error: ${error}` : segundos(ms)]
    }),
  ))
}

const avisos: string[] = []
const catalogo = new Set(idsAlimentos())
const fueraDelCatalogo = [...new Set(etiquetas.flatMap((e) => e.alimentos.map((a) => a.alimentoId)))].filter((id) => !catalogo.has(id))
if (fueraDelCatalogo.length) avisos.push(`Etiquetas con alimentoId que no están en data/alimentos.json (nunca pueden acertar): ${fueraDelCatalogo.join(', ')}`)
for (const p of pasadas) {
  const otros = [...p.respondio].filter((m) => m !== p.modelo)
  if (otros.length) avisos.push(`Se pidió ${p.modelo} y respondió ${otros.join(', ')} (¿respaldo de PROVEEDOR_IA, o MODELO_VISION no llegó a generarJSON?)`)
}
if (avisos.length) salida.push('', '## Avisos', '', ...avisos.map((a) => `- ${a}`))

console.log(salida.join('\n'))
if (pasadas.every((p) => p.resumen.errores === p.resumen.fotos)) process.exitCode = 1 // ninguna llamada anduvo: falta la key o la visión
