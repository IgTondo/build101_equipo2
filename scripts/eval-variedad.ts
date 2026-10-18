// v5.10 · Eval de variedad de las recetas creativas: ¿salen distintas cuando la familia pide una tras otra? Carga un
// chico sintético sin Mongo (como server/ia/candidato.test.ts: los catálogos reales y su historial, con `hoy` = el último
// día que registró) y llama a generarRecetaCreativa(), la misma función que /api/receta sin preparacionId. Por cada
// comida pide N recetas seguidas y, como la app (src/lib/recetaPrevia.ts), manda en `anteriores` los nombres de las que
// ya salieron. Mide ingredientes principales, familias y alimentos de partida distintos, cuántas llevan queso, nombres
// repetidos, si la receta siguió el foco que sorteó el código, las fallas, la latencia y el costo.
// Uso: npx tsx scripts/eval-variedad.ts [--nino valentina|tomas|lucia] [--momentos cena,desayuno] [--n 6] > eval-variedad.md
// (Markdown por stdout, progreso por stderr; por defecto Valentina, cena y desayuno, 6 recetas por comida).
// Llama a la API real (Claude Sonnet 5.5): necesita ANTHROPIC_API_KEY. Costo: ≈ USD 0,04 por receta (~USD 0,5 con lo de
// por defecto); al final dice el real, con el uso que reporta la API.
import './eval/entorno.js'
import { parseArgs } from 'node:util'
import { MOMENTO, type Momento, type Nutriente, type Receta } from '../shared/contratos.js'
import { limpiarOtras } from '../server/alergias.js'
import { NOMBRE_GRUPO, NOMBRE_NUTRIENTE } from '../server/aprendizaje/textos.js'
import { alimentosCatalogo, preparacionesCatalogo } from '../server/datos/catalogos.js'
import { type Cargado, objetivoDe } from '../server/datos/cargar.js'
import { type SinteticoId, comidasSinteticas, ninoDoc, sintetico } from '../server/datos/prueba/catalogos.js'
import { conocimientoDe } from '../server/grafo/conocimiento.js'
import { ErrorNibble } from '../server/http.js'
import { modeloPara } from '../server/ia/modelo.js'
import { clienteClaude } from '../server/ia/proveedores/claude.js'
import { generarRecetaCreativa, type ConocimientoReceta, type DepsRecetaCreativa } from '../server/ia/receta-creativa.js'
import { deTotal, fechaUY, lista, mensajeError, segundos, tabla } from './eval/markdown.js'
import {
  USD_POR_RECETA_ESTIMADO, anotar, conVeces, fraseVariedad, nuevosDe, principalDe, resumirVariedad, sigueElFoco,
  type Falla, type PedidoVariedad, type RecetaVista, type ResumenVariedad, type Uso,
} from './eval/metricas-variedad.js'

const imprimir = console.log.bind(console)
console.log = console.error // lo que loguee server/ia/ va a stderr: stdout queda solo para la tabla
console.info = console.error

// ---------- Argumentos ----------
const NINOS: SinteticoId[] = ['valentina', 'tomas', 'lucia']
const MAX_N = 20
const { values } = parseArgs({
  options: { nino: { type: 'string', default: 'valentina' }, momentos: { type: 'string', default: 'cena,desayuno' }, n: { type: 'string', default: '6' } },
})
const ninoId = values.nino as SinteticoId
const momentos = values.momentos.split(',').map((m) => m.trim()).filter(Boolean) as Momento[]
const n = Number(values.n)
const errores = [
  ...(NINOS.includes(ninoId) ? [] : [`--nino ${values.nino}: tiene que ser ${NINOS.join(', ')}`]),
  ...(momentos.length && momentos.every((m) => (MOMENTO as readonly string[]).includes(m)) ? [] : [`--momentos ${values.momentos}: separados por comas, de ${MOMENTO.join(', ')}`]),
  ...(Number.isInteger(n) && n >= 1 && n <= MAX_N ? [] : [`--n ${values.n}: un entero de 1 a ${MAX_N}`]),
]
if (errores.length) {
  console.error(errores.join('\n'))
  process.exit(2)
}

// ---------- El chico, sin Mongo (como lo cargaría cargarNino) ----------
const s = sintetico(ninoId)
const catalogo = new Map(preparacionesCatalogo())
const alimentos = new Map(alimentosCatalogo())
const nino = ninoDoc(s)
const c: Cargado = { nino, comidas: comidasSinteticas(s, alimentos, catalogo), catalogo, alimentos, objetivo: objetivoDe(nino) }
const hoy = s.comidas.map((x) => x.dia).sort().at(-1) ?? ''
const otras = limpiarOtras(nino.datos.alergiasOtras) // como armarConocimientoReceta

/**
 * La base de conocimiento de cada pedido, como la arma armarConocimientoReceta pero con `hoy` fijo. Las anteriores van
 * también a conocimientoDe (v5.10, Conocimiento.recientes): si generarRecetaCreativa ya las manda en `op`, valen esas;
 * el código de antes las ignora. Guarda la que armó en `visto`, para leer el foco que sorteó.
 */
function conocimientoPara(anteriores: string[], visto: { k?: ConocimientoReceta }): DepsRecetaCreativa['conocimiento'] {
  return async (_ninoId, op) => {
    const opciones = { anteriores, ...op, hoy }
    visto.k = { ...conocimientoDe(c, opciones), ...(otras.length ? { alergiasOtras: otras } : {}) }
    return visto.k
  }
}

// ---------- Uso de tokens ----------
// generarJSON() no devuelve el uso: se envuelve messages.parse del cliente de Claude (el mismo objeto que usa
// server/ia/proveedores/claude.ts) para sumar el que reporta cada respuesta. Sin key no hay cliente y el costo se estima.
const usoTotal = { respuestas: 0, entrada: 0, salida: 0 }
const mensajes = (() => {
  try { return clienteClaude().messages } catch { return null }
})()
if (mensajes) {
  const parse = mensajes.parse.bind(mensajes)
  mensajes.parse = (async (...args: Parameters<typeof parse>) => {
    const r = await parse(...args)
    usoTotal.respuestas++
    usoTotal.entrada += r.usage.input_tokens + (r.usage.cache_creation_input_tokens ?? 0) + (r.usage.cache_read_input_tokens ?? 0)
    usoTotal.salida += r.usage.output_tokens
    return r
  }) as unknown as typeof mensajes.parse
} else {
  console.error('Sin ANTHROPIC_API_KEY (en .env.local o en el entorno): las recetas van a fallar.')
}

const usoDesde = (antes: typeof usoTotal): Uso | null =>
  usoTotal.respuestas > antes.respuestas ? { entrada: usoTotal.entrada - antes.entrada, salida: usoTotal.salida - antes.salida } : null

// ---------- Cada receta ----------
function fallaDe(e: unknown): Falla {
  if (!(e instanceof ErrorNibble)) return 'error'
  return e.codigo === 'sin_candidatos' ? 'sin_candidatos' : e.codigo === 'timeout' ? 'timeout' : 'error'
}

/** Lo que mide la eval de una receta; los ingredientes del alimento de partida salen de la base de conocimiento. */
function vista(r: Receta, k: ConocimientoReceta | undefined): RecetaVista {
  const desde = [...(k?.seguros ?? []), ...(k?.aceptadas ?? [])].find((p) => p.id === r.desde.preparacionId) ?? catalogo.get(r.desde.preparacionId)
  const o = r.objetivo
  return {
    nombre: r.nombre,
    desde: { id: r.desde.preparacionId, nombre: r.desde.nombre, ingredientes: desde?.ingredientes.map((i) => i.alimentoId) ?? [] },
    cambio: r.cambio,
    objetivo: o?.tipo === 'variedad' ? `variedad${o.grupo ? `: ${NOMBRE_GRUPO[o.grupo]}` : ''}` : NOMBRE_NUTRIENTE[o?.nutriente ?? r.evidencia.nutriente],
    ingredientes: r.ingredientes.map(({ alimentoId, gramos }) => ({ alimentoId, gramos })),
  }
}

const pedidos: PedidoVariedad[] = []
console.error(`${s.datos.nombre} · hoy = ${hoy} · ${momentos.join(', ')} · ${n} recetas por comida`)
for (const momento of momentos) {
  let anteriores: string[] = []
  for (let i = 1; i <= n; i++) {
    const visto: { k?: ConocimientoReceta } = {}
    const antes = { ...usoTotal }
    let llamadas = 0
    const t0 = performance.now()
    const etiqueta = `${momento} ${i}/${n}`
    try {
      const receta = await generarRecetaCreativa({ ninoId: s.ninoId, momento, anteriores }, {
        conocimiento: conocimientoPara(anteriores, visto),
        alIntentar: (x) => {
          llamadas++
          console.error(`  ${etiqueta} · llamada ${x.llamada}: ${x.problemas.length ? `${x.problemas.length} problemas` : 'bien'} · ${segundos(x.ms)}`)
        },
      })
      const ms = performance.now() - t0
      pedidos.push({ momento, ms, llamadas, uso: usoDesde(antes), ...(visto.k ? { foco: visto.k.foco } : {}), receta: vista(receta, visto.k) })
      anteriores = anotar(anteriores, receta.nombre)
      console.error(`· ${etiqueta}: ${receta.nombre} (desde ${receta.desde.preparacionId}) en ${segundos(ms)}`)
    } catch (err) {
      const falla = fallaDe(err)
      pedidos.push({
        momento, ms: falla === 'error' ? null : performance.now() - t0, llamadas, uso: usoDesde(antes),
        ...(visto.k ? { foco: visto.k.foco } : {}), falla, error: mensajeError(err),
      })
      console.error(`${falla === 'error' ? '×' : '·'} ${etiqueta}: ${falla} · ${mensajeError(err)}`)
    }
  }
}

// ---------- Salida ----------
const NOMBRE_MOMENTO: Record<Momento, string> = { desayuno: 'Desayuno', almuerzo: 'Almuerzo', merienda: 'Merienda', cena: 'Cena', colacion: 'Colación' }
const NOMBRE_FALLA: Record<Falla, string> = { sin_candidatos: 'sin candidatos', timeout: 'timeout', error: 'error' }
const usd = (x: number) => `USD ${x.toFixed(2).replace('.', ',')}`
const corto = (texto: string, max = 300) => (texto.length > max ? `${texto.slice(0, max - 1)}…` : texto)

function textoFoco(p: PedidoVariedad): string {
  const f = p.foco
  if (!f) return '—'
  const sigue = p.receta ? sigueElFoco(p.receta, f) : null
  const modo = f.modo === 'sumar_ingrediente' ? 'sumar' : 'cambiar el principal'
  const para = f.nutriente ? NOMBRE_NUTRIENTE[f.nutriente as Nutriente] ?? f.nutriente : f.grupo ? `variedad: ${f.grupo}` : 'variedad'
  return `${sigue === null ? '' : sigue ? 'sí · ' : 'no · '}${f.desdeId}, ${modo}${f.ingrediente ? ` (${f.ingrediente})` : ''}, ${para}`
}

const filaResumen = (nombre: string, r: ResumenVariedad): (string | number)[] => [
  nombre, deTotal(r.recetas, r.pedidos), `${r.principales.length}/${r.pedidos}`, r.familias.length, `${r.partidas.length}/${r.pedidos}`,
  deTotal(r.conQueso.ok, r.conQueso.total), r.repetidos.length ? r.repetidos.map((x) => `${x.nombre} ×${x.veces}`).join('; ') : 0,
  deTotal(r.siguenFoco.ok, r.siguenFoco.total), r.fallas.sin_candidatos, r.fallas.timeout, r.fallas.error,
  segundos(r.latencia.media), segundos(r.latencia.p95), `${usd(r.costo.usd)}${r.costo.estimado ? ' (estimado)' : ''}`,
]

function seccion(momento: Momento, ps: PedidoVariedad[]): string[] {
  const recetas = ps.flatMap((p) => (p.receta ? [p.receta] : []))
  const fallas = ps.flatMap((p, i) => (p.falla ? [`- ${i + 1}. ${NOMBRE_FALLA[p.falla]}: ${corto(p.error ?? '')}`] : []))
  return [
    `## ${NOMBRE_MOMENTO[momento]}`,
    '',
    tabla(
      ['#', 'Receta', 'Parte de', 'Cambio', 'Nutriente', 'Principal', 'Nuevos (respecto de su alimento)', 'Foco (¿lo siguió?)', 'Llamadas', 'Latencia'],
      ps.map((p, i) => p.receta
        ? [i + 1, p.receta.nombre, p.receta.desde.nombre, p.receta.cambio, p.receta.objetivo, principalDe(p.receta) ?? '—', lista(nuevosDe(p.receta)), textoFoco(p), p.llamadas, segundos(p.ms)]
        : [i + 1, `*${NOMBRE_FALLA[p.falla ?? 'error']}*`, '—', '—', '—', '—', '—', textoFoco(p), p.llamadas, segundos(p.ms)]),
    ),
    '',
    `Principales: ${conVeces(recetas.flatMap((r) => principalDe(r) ?? []))} · Partidas: ${conVeces(recetas.map((r) => r.desde.id))} · ` +
      `Nutrientes: ${conVeces(recetas.map((r) => r.objetivo))}`,
    ...(fallas.length ? ['', 'Fallas:', ...fallas] : []),
  ]
}

const total = resumirVariedad(pedidos)
const porMomento = momentos.map((m) => ({ m, ps: pedidos.filter((p) => p.momento === m) }))
const salida: string[] = [
  '# Eval de variedad de las recetas creativas',
  '',
  `${fechaUY()} · ${modeloPara('receta')} · ${s.datos.nombre} (data/sinteticos/${ninoId}.json, sin Mongo), hoy = ${hoy} · ` +
    `${n} recetas seguidas por comida, cada una con las anteriores en \`anteriores\`, como la app`,
  '',
  `**${fraseVariedad(total)}**`,
  '',
  tabla(
    ['Comida', 'Salieron', 'Principales distintos', 'Familias', 'Partidas distintas', 'Con queso', 'Nombres repetidos', 'Siguieron el foco', 'Sin candidatos', 'Timeouts', 'Errores', 'Latencia media', 'p95', 'Costo'],
    [...porMomento.map(({ m, ps }) => filaResumen(NOMBRE_MOMENTO[m], resumirVariedad(ps))), filaResumen('**Total**', total)],
  ),
  '',
  'Principal: el ingrediente de más gramos de la receta; familia: el primer tramo de su id (`queso_muzzarella` → `queso`). ' +
    'Partidas: los alimentos seguros de los que parte. Con queso: algún `queso_*` o ricota entre los ingredientes. ' +
    'Siguió el foco: partió del alimento que sorteó el código y, si el foco trae un ingrediente, lo usó (de principal al cambiar ' +
    'el principal; entre los ingredientes al sumar uno). Las distintas se cuentan sobre las pedidas: 6/6 es una distinta por receta.',
  '',
  total.costo.estimado
    ? `Costo estimado: la API no reportó el uso de algún pedido y se contaron ${usd(USD_POR_RECETA_ESTIMADO)} por receta` +
      `${total.tokens.entrada ? ` (en los demás, ${total.tokens.entrada} tokens de entrada y ${total.tokens.salida} de salida)` : ''}.`
    : total.tokens.entrada
      ? `Costo con el uso que reportó la API: ${total.tokens.entrada} tokens de entrada y ${total.tokens.salida} de salida, a USD 2 y 10 por millón (Sonnet 5.5).`
      : 'No llegó a responder el modelo: no hubo costo.',
  ...porMomento.flatMap(({ m, ps }) => ['', ...seccion(m, ps)]),
]

imprimir(salida.join('\n'))
if (pedidos.every((p) => p.falla === 'error')) process.exitCode = 1 // no anduvo ninguna llamada: falta la key
