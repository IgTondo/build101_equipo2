// Eval de recetas (PLAN.md §11.3, A12): cada caso de eval/recetas/casos.json pasa por generarReceta(), la misma función
// que usa /api/receta, con su Evidencia y su perfil (sin Mongo). Mide cuántas respetó el LLM por sí solo (la primera
// salida del modelo, validada antes de cualquier reintento, con alIntentar) y cuántas quedan bien después de la
// validación y los reintentos (tienen que ser todas, o sin_candidatos: nunca una inválida; la eval vuelve a validar la
// receta final por su cuenta), desglosado en alergias, un solo cambio y lenguaje; el % que cubre al menos el 20% de lo
// que falta, y la latencia.
// Uso: npx tsx scripts/eval-recetas.ts > eval-recetas.md   (Markdown por stdout, progreso por stderr)
// Llama a la API real (Claude Sonnet 5.5): necesita ANTHROPIC_API_KEY. Costo estimado: ~USD 0,3 a 0,6 (de 10 a 20
// llamadas de ~3 k tokens de entrada y ~2 k de salida); con 4 llamadas en cada caso, el tope es ~USD 1,3.
// Los casos son sintéticos y se declaran (ver scripts/eval/casos-recetas.ts).
import './eval/entorno.js'
import type { Perfil, PreparacionCatalogo, Presentacion, Receta } from '../shared/contratos.js'
import { ErrorNibble } from '../server/http.js'
import { modeloPara } from '../server/ia/modelo.js'
import { generarReceta, preparacionCatalogo } from '../server/ia/receta.js'
import { problemasPorTipo, type ContextoValidacion, type ProblemasPorTipo } from '../server/validacion/receta.js'
import { leerCasosRecetas } from './eval/casos-recetas.js'
import { deTotal, fechaUY, lista, mensajeError, porcentaje, segundos, tabla } from './eval/markdown.js'
import {
  DESGLOSE, desglosar, fraseRecetas, resumirRecetas, sinProblemas, type Desglose, type ResultadoCasoReceta,
} from './eval/metricas-recetas.js'

const imprimir = console.log.bind(console)
console.log = console.error // lo que loguee server/ia/ va a stderr: stdout queda solo para la tabla
console.info = console.error

const { casos, perfiles, preparaciones: puentes } = leerCasosRecetas()
const perfil = new Map(perfiles.map((p) => [p.ninoId, p]))
const extra = new Map(puentes.map((p) => [p.id, p]))
const preparacion = (id: string): PreparacionCatalogo | undefined => preparacionCatalogo(id) ?? extra.get(id)

/** El contexto para volver a validar la receta final, armado por la eval con los datos del caso. */
function contexto(receta: Receta, p: Perfil, alergiasCaso: Perfil['datos']['alergias']): ContextoValidacion | null {
  const desde = preparacion(receta.desde.preparacionId)
  const base = preparacion(receta.preparacionBaseId)
  if (!desde || !base) return null
  const presentacionesAceptadas = [...new Set(p.preparaciones.filter((x) => x.estado === 'acepta').flatMap((x): Presentacion[] => {
    const pr = preparacion(x.id)?.atributos.presentacion
    return pr && pr !== 'separado' ? [pr] : []
  }))]
  return { alergias: [...new Set([...alergiasCaso, ...p.datos.alergias])], reglas: p.reglas, desde, base, presentacionesAceptadas }
}

const NOMBRE_DESGLOSE: Record<Desglose, string> = { alergias: 'Alergias', cambio: 'Un solo cambio', lenguaje: 'Lenguaje', otros: 'Otros' }
const queTiene = (p: ProblemasPorTipo) => {
  const d = desglosar(p)
  return sinProblemas(p) ? 'bien' : DESGLOSE.filter((t) => d[t] > 0).map((t) => `${NOMBRE_DESGLOSE[t].toLowerCase()} (${d[t]})`).join(', ')
}

const resultados: ResultadoCasoReceta[] = []
for (const caso of casos) {
  const p = perfil.get(caso.ninoId)
  if (!p) throw new Error(`${caso.id}: no está el perfil ${caso.ninoId} en eval/recetas/casos.json`)
  const intentos: ProblemasPorTipo[] = []
  const base = { id: caso.id, ninoId: caso.ninoId, nutriente: caso.nutriente, intentos }
  const t0 = performance.now()
  try {
    const receta = await generarReceta({ ninoId: caso.ninoId, nutriente: caso.nutriente }, {
      armarEvidencia: async () => caso.evidencia,
      perfil: async () => p,
      preparacion,
      alIntentar: (i) => {
        intentos.push(i.problemas)
        console.error(`  ${caso.id} · llamada ${i.llamada} (${i.preparacionId}${i.reintento ? ', reintento' : ''}): ${queTiene(i.problemas)} · ${segundos(i.ms)}`)
      },
    })
    const ms = performance.now() - t0
    const ctx = contexto(receta, p, caso.evidencia.alergias)
    const revalidacion = ctx ? problemasPorTipo(receta, ctx) : null
    resultados.push({ ...base, final: 'ok', revalidacion, cobertura: receta.coberturaDeLoQueFalta, preparacionBaseId: receta.preparacionBaseId, ms })
    console.error(`· ${caso.id}: ${receta.preparacionBaseId} en ${segundos(ms)}${revalidacion && sinProblemas(revalidacion) ? '' : ' · ¡NO PASA LA REVALIDACIÓN!'}`)
  } catch (err) {
    const sinCandidatos = err instanceof ErrorNibble && err.codigo === 'sin_candidatos'
    const ms = sinCandidatos ? performance.now() - t0 : null
    resultados.push({ ...base, final: sinCandidatos ? 'sin_candidatos' : 'error', revalidacion: null, cobertura: null, ms, ...(sinCandidatos ? {} : { error: mensajeError(err) }) })
    console.error(`${sinCandidatos ? '·' : '×'} ${caso.id}: ${sinCandidatos ? 'sin candidatos' : mensajeError(err)}`)
  }
}

// ---------- Salida ----------
const r = resumirRecetas(resultados)
const deB = casos.filter((c) => c.fuente === 'evidenciaDe').length
const salida: string[] = [
  '# Eval de recetas (§11.3)',
  '',
  `${fechaUY()} · ${modeloPara('receta')} · ${casos.length} casos sintéticos, declarados: ${deB} con evidenciaDe() de B sobre Tomás y Lucía ` +
    `(data/sinteticos/) y ${casos.length - deB} armados para Bruno (leche y gluten, perfil inventado)`,
  '',
  `**${fraseRecetas(r)}**`,
  '',
  tabla(
    ['', 'Casos', 'Sin ningún problema', ...DESGLOSE.map((t) => NOMBRE_DESGLOSE[t])],
    [
      ['El LLM solo (su primera salida)', r.llmSolo.total, deTotal(r.llmSolo.ok, r.llmSolo.total),
        ...DESGLOSE.map((t) => deTotal(r.llmSolo.porTipo[t].ok, r.llmSolo.porTipo[t].total))],
      ['Con la validación y los reintentos', r.final.ok + r.final.invalidas, deTotal(r.final.ok, r.final.ok + r.final.invalidas),
        ...DESGLOSE.map((t) => deTotal(r.final.porTipo[t].ok, r.final.porTipo[t].total))],
    ],
  ),
  '',
  tabla(
    ['Recetas válidas', 'Sin candidatos', 'Errores', 'Inválidas', 'Cubren ≥ 20% de lo que falta', 'Llamadas al LLM', 'Costo estimado', 'Latencia media', 'p95', '< 60 s'],
    [[r.final.ok, r.final.sinCandidatos, r.final.errores, `**${r.final.invalidas}**`, deTotal(r.cubre.ok, r.cubre.total), r.llamadas,
      `USD ${r.costoUsd.toFixed(2).replace('.', ',')}`, segundos(r.latencia.media), segundos(r.latencia.p95), porcentaje(r.latencia.bajoLimite)]],
  ),
  '',
  '"El LLM solo": cada caso con su primera salida del modelo, validada por código antes de cualquier reintento. ' +
    '"Con la validación": la receta que devuelve generarReceta(), validada otra vez por la eval. **Inválidas tiene que dar 0.** ' +
    '"Sin candidatos" es una respuesta correcta: no hay un paso de un solo cambio y la app lo dice. ' +
    'Un caso con error cuenta fuera de los 60 s.',
  '',
  '## Por caso',
  '',
  tabla(
    ['Caso', 'Evidencia', '1.ª salida', 'Resultado', 'Receta sobre', 'Llamadas', 'Cubre', 'Latencia', 'Error'],
    resultados.map((x) => [
      x.id, casos.find((c) => c.id === x.id)?.fuente === 'evidenciaDe' ? 'B' : 'armada',
      x.intentos[0] ? queTiene(x.intentos[0]) : '—',
      x.final === 'ok' ? (x.revalidacion && sinProblemas(x.revalidacion) ? 'válida' : '**inválida**') : x.final === 'sin_candidatos' ? 'sin candidatos' : 'error',
      x.preparacionBaseId ?? '—', x.intentos.length, x.cobertura === null ? '—' : porcentaje(x.cobertura), segundos(x.ms), x.error ?? '',
    ]),
  ),
]
const sinCandidatos = resultados.filter((x) => x.final === 'sin_candidatos').map((x) => x.id)
if (sinCandidatos.length) salida.push('', `Sin candidatos a un solo cambio: ${lista(sinCandidatos)}.`)

imprimir(salida.join('\n'))
if (r.final.errores > 0 && r.salidas.total === 0) process.exitCode = 1 // ninguna llamada al modelo anduvo: falta la key
