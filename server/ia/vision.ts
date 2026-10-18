// Visión (PLAN.md §7, A5 y A6): foto del plato + contexto del chico → AnalisisComida.
// El modelo propone (prompts/vision.ts) y el código corrige: ids que no existen, gramos y cajas fuera de rango,
// preguntas que faltan o que sobran. Lo que sale de acá cumple el contrato aunque el modelo se equivoque.
import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  GRUPO, type AnalisisComida, type AnalizarComidaReq, type Caja, type Distribucion, type ItemDetectado, type Plato,
  type Porcion, type PreparacionCatalogo, type Pregunta, type Regla,
} from '../../shared/contratos.js'
import { alimentoPorId, alimentos, esGenerico, idGenerico, idsAlimentos } from './catalogo.js'
import { verificarId } from './mismo-alimento.js'
import { generarJSON } from './modelo.js'
import { normalizar } from './relato.js'
import {
  MAX_PREGUNTAS, ORIGENES, schemaVision, sistemaVision, textoVision, UMBRAL_CONFIANZA,
  type ItemSalida, type SalidaVision,
} from './prompts/vision.js'

export interface ContextoVision { preparaciones: { id: string; nombre: string }[]; reglas: Regla[] }

export const CONTEXTO_VACIO: ContextoVision = { preparaciones: [], reglas: [] }

const MAX_TOKENS = 4096
const MAX_ITEMS = 8                     // un plato de un chico selectivo tiene de 1 a 5; más es ruido del modelo
const FACTOR_PORCION: Record<Porcion, number> = { chica: 0.6, mediana: 1, grande: 1.5 } // §5.1

// ---------- Contexto del chico (enganche con B) ----------
// B lo arma con obtenerContexto(ninoId) (§6), que todavía no existe: hasta que el integrador lo conecte acá
// (o con fijarFuenteContexto), la visión anda sin catálogo personal ni reglas. Si tarda o falla, vacío (A5).
type FuenteContexto = (ninoId: string) => Promise<ContextoVision>
const sinContexto: FuenteContexto = async () => CONTEXTO_VACIO
let fuenteContexto = sinContexto
const TIMEOUT_CONTEXTO_MS = 2500

export function fijarFuenteContexto(fuente: FuenteContexto | null): void {
  fuenteContexto = fuente ?? sinContexto
}

export async function contextoVision(ninoId: string): Promise<ContextoVision> {
  let reloj: ReturnType<typeof setTimeout> | undefined
  try {
    const limite = new Promise<never>((_, rechazar) => {
      reloj = setTimeout(() => rechazar(new Error(`tardó más de ${TIMEOUT_CONTEXTO_MS} ms`)), TIMEOUT_CONTEXTO_MS)
    })
    const c = await Promise.race([fuenteContexto(ninoId), limite])
    return { preparaciones: c.preparaciones ?? [], reglas: c.reglas ?? [] }
  } catch (e) {
    console.warn(JSON.stringify({ evento: 'vision', aviso: 'sin_contexto', ninoId, error: e instanceof Error ? e.message : String(e) }))
    return CONTEXTO_VACIO
  } finally {
    clearTimeout(reloj)
  }
}

// ---------- Catálogo semilla de preparaciones ----------
// El de B (data/preparaciones.json); mientras no exista, el del dataset sintético. Solo hacen falta id y nombre.
const RUTAS_SEMILLA = [['data', 'preparaciones.json'], ['data', 'sinteticos', 'preparaciones.json']]
type PreparacionSemilla = Pick<PreparacionCatalogo, 'id' | 'nombre'> & { ingredientes?: PreparacionCatalogo['ingredientes'] }
let semilla: { id: string; nombre: string }[] | null = null
let completas: Map<string, PreparacionSemilla> | null = null // v5.8 · con ingredientes, para verificarId

function cargarSemilla(lista: PreparacionSemilla[]): void {
  semilla = lista.map(({ id, nombre }) => ({ id, nombre }))
  completas = new Map(lista.map((p) => [p.id, p]))
}

export function preparacionesSemilla(): { id: string; nombre: string }[] {
  if (semilla) return semilla
  const ruta = RUTAS_SEMILLA.map((r) => join(process.cwd(), ...r)).find((r) => existsSync(r)) // vercel.json → includeFiles
  cargarSemilla(ruta ? (JSON.parse(readFileSync(ruta, 'utf8')) as PreparacionCatalogo[]) : [])
  return semilla!
}

/** La preparación del catálogo semilla con sus ingredientes (para verificar un id), si está. */
function preparacionSemilla(id: string): PreparacionSemilla | undefined {
  preparacionesSemilla()
  return completas?.get(id)
}

/** Solo para tests: reemplaza el catálogo semilla (null vuelve a leer el archivo). */
export function fijarSemilla(nuevas: PreparacionSemilla[] | null): void {
  if (nuevas) cargarSemilla(nuevas)
  else {
    semilla = null
    completas = null
  }
}

// ---------- Análisis ----------
/** Sin `contexto`, analiza sin catálogo personal ni reglas (el handler lo pide con contextoVision). */
export async function analizarComida(req: AnalizarComidaReq, contexto: ContextoVision = CONTEXTO_VACIO): Promise<AnalisisComida> {
  const inicio = Date.now()
  const catalogo = preparacionesSemilla()
  const { datos, modelo } = await generarJSON({
    tarea: 'vision',
    sistema: sistemaVision(alimentos()),
    partes: [
      { tipo: 'imagen', base64: req.imagenBase64, mime: req.mime },
      { tipo: 'texto', texto: textoVision({ personal: contexto.preparaciones, semilla: catalogo, reglas: contexto.reglas, comentario: req.comentario }) },
    ],
    schema: schemaVision(idsValidos()),
    maxTokens: MAX_TOKENS,
  })
  const conocidas = new Map([...catalogo, ...contexto.preparaciones].map((p) => [p.id, p.nombre]))
  return { analisisId: randomUUID(), ...postprocesar(datos, { conocidas, reglas: contexto.reglas }), modelo, ms: Date.now() - inicio }
}

/** Los alimentoId que acepta el contrato: el catálogo curado y los genéricos otro_<grupo>. */
function idsValidos(): string[] {
  return [...new Set([...idsAlimentos(), ...GRUPO.map(idGenerico)])]
}

export interface OpcionesPostproceso {
  conocidas: Map<string, string>        // id → nombre de las preparaciones del chico y del catálogo semilla
  reglas: Regla[]
}

/** La salida del modelo → la parte del AnalisisComida que no son ids ni tiempos. Exportada para los tests (A6). */
export function postprocesar(salida: SalidaVision, { conocidas, reglas }: OpcionesPostproceso): Pick<AnalisisComida, 'sinComida' | 'items' | 'distribucion' | 'preguntas'> {
  const plato = salida.distribucion.plato
  if (salida.sinComida || salida.items.length === 0) {
    return { sinComida: true, items: [], distribucion: { estado: 'separados', cantidadItems: 0, plato }, preguntas: [] }
  }
  const validos = new Set(idsValidos())
  const crudos = salida.items.slice(0, MAX_ITEMS)
  const items = crudos.map((it, i) => item(it, `i${i + 1}`, conocidas, validos))
  // Un solo ítem no se puede tocar con otro (sí puede ser una preparación mezclada).
  const estado = items.length < 2 && salida.distribucion.estado === 'tocandose' ? 'separados' : salida.distribucion.estado
  const distribucion = { estado, cantidadItems: items.length, plato }
  return { sinComida: false, items, distribucion, preguntas: preguntas(salida, crudos, items, reglas, distribucion) }
}

function item(it: ItemSalida, idTmp: string, conocidas: Map<string, string>, validos: Set<string>): ItemDetectado {
  const ingredientes = ingredientesValidos(it, validos)
  const preparacionId = idVerificado(it, conocidas, ingredientes)
  const conteo = conteoValido(it.conteo)
  const nombreIngles = it.nombreIngles?.trim()
  const conGenerico = ingredientes.some((g) => esGenerico(g.alimentoId))
  return {
    idTmp,
    preparacion: it.preparacion.trim() || (preparacionId && conocidas.get(preparacionId)) || 'Alimento sin identificar',
    preparacionId,
    ingredientes,
    ...(conteo ? { conteo } : {}),
    porcion: it.porcion,
    atributos: { ...it.atributos },
    caja: aCaja(it.caja),
    confianza: Number.isFinite(it.confianza) ? recortar(it.confianza, 0, 1) : 0,
    ...(conGenerico && nombreIngles ? { nombreIngles } : {}),
  }
}

/**
 * v5.8 · El id tiene que existir (en el catálogo del chico o en el semilla) y ser la misma preparación que describe el
 * modelo, con lo que vio en la foto (verificarId: una milanesa de pollo no es la de carne). Si no, null: se queda con
 * los atributos y los ingredientes que vio.
 */
function idVerificado(it: ItemSalida, conocidas: Map<string, string>, ingredientes: ItemDetectado['ingredientes']): string | null {
  const id = it.preparacionId
  if (!id || !conocidas.has(id)) return null
  const descripcion = it.preparacion.trim()
  if (!descripcion) return id
  const prep = preparacionSemilla(id) ?? { nombre: conocidas.get(id)!, ingredientes: [] }
  const motivo = verificarId(descripcion, prep, [], [], ingredientes.map((g) => g.alimentoId))
  if (!motivo) return id
  console.warn(JSON.stringify({ evento: 'vision', aviso: 'id_descartado', id, preparacion: descripcion, motivo }))
  return null
}

/** Fuera del catálogo → otro_<grupo del ítem>; repetidos se suman; gramos de 1 a 1000 (sin dato, la porción típica). */
function ingredientesValidos(it: ItemSalida, validos: Set<string>): ItemDetectado['ingredientes'] {
  const gramos = new Map<string, number>()
  for (const g of it.ingredientes) {
    const id = validos.has(g.alimentoId) ? g.alimentoId : idGenerico(it.atributos.grupo)
    const est = Number.isFinite(g.gramosEst) && g.gramosEst > 0 ? g.gramosEst : gramosTipicos(id, it.porcion)
    gramos.set(id, (gramos.get(id) ?? 0) + est)
  }
  if (gramos.size === 0) {
    const id = idGenerico(it.atributos.grupo)
    gramos.set(id, gramosTipicos(id, it.porcion))
  }
  return [...gramos].map(([alimentoId, g]) => ({ alimentoId, gramosEst: Math.round(recortar(g, 1, 1000)) }))
}

function gramosTipicos(alimentoId: string, porcion: Porcion): number {
  return (alimentoPorId(alimentoId)?.porcionMedianaG ?? 100) * FACTOR_PORCION[porcion]
}

function conteoValido(c: ItemSalida['conteo']): ItemDetectado['conteo'] | undefined {
  const unidad = c?.unidad.trim()
  if (!c || !unidad || !Number.isFinite(c.cantidad)) return undefined
  const cantidad = Math.round(c.cantidad)
  return cantidad >= 1 && cantidad <= 100 ? { cantidad, unidad } : undefined
}

const MARGEN_CAJA = 50                  // hasta 5% afuera se recorta; más lejos es otra escala (píxeles) y no hay cómo saberlo
const LADO_MIN_CAJA = 10

/** { ymin, xmin, ymax, xmax } de 0 a 1000 → Caja. Si viene de 0 a 1 la escala; si viene invertida la ordena; si es absurda, null. */
export function aCaja(c: ItemSalida['caja']): Caja | null {
  if (!c) return null
  let v = [c.ymin, c.xmin, c.ymax, c.xmax]
  if (!v.every(Number.isFinite)) return null
  if (v.every((x) => x >= 0 && x <= 1)) v = v.map((x) => x * 1000)
  if (v.some((x) => x < -MARGEN_CAJA || x > 1000 + MARGEN_CAJA)) return null
  const [ymin, xmin, ymax, xmax] = v.map((x) => Math.round(recortar(x, 0, 1000)))
  const caja: Caja = [Math.min(ymin, ymax), Math.min(xmin, xmax), Math.max(ymin, ymax), Math.max(xmin, xmax)]
  return caja[2] - caja[0] >= LADO_MIN_CAJA && caja[3] - caja[1] >= LADO_MIN_CAJA ? caja : null
}

// ---------- Preguntas ----------
type Candidata = Omit<Pregunta, 'id' | 'caja'>

/**
 * Las del modelo que sirven, más las que tenía que hacer y no hizo (regla del plato rota, ítem dudoso o fuera del
 * catálogo); sin repetidas, hasta MAX_PREGUNTAS por prioridad (regla, duda, contexto) y con ids q1, q2…
 */
function preguntas(salida: SalidaVision, crudos: ItemSalida[], items: ItemDetectado[], reglas: Regla[], d: { estado: Distribucion; plato: Plato }): Pregunta[] {
  const candidatas: Candidata[] = []
  for (const p of salida.preguntas) {
    const texto = p.texto.trim()
    const opciones = opcionesValidas(p.opciones)
    if (!texto || opciones.length < 2) continue
    const deItem = p.item === null || !Number.isFinite(p.item) ? undefined : items[Math.round(p.item) - 1]
    candidatas.push({ texto, opciones, ...(deItem ? { itemIdTmp: deItem.idTmp } : {}), origen: p.origen })
  }

  // v5.8 · Lo empanado o formado (milanesa, nuggets, hamburguesa…) por fuera es igual: si no está seguro, de qué es
  // va primero (le gana a otra duda sobre el mismo ítem). Es lo que más cambia el aporte y lo que aprende el grafo.
  candidatas.unshift(...items.flatMap((it) => preguntaProteina(it) ?? []))

  const regla = preguntaRegla(reglas, d)
  if (regla && !candidatas.some((c) => c.origen === 'regla')) candidatas.push(regla)
  items.forEach((it, i) => {
    const dudoso = it.confianza < UMBRAL_CONFIANZA || it.ingredientes.some((g) => esGenerico(g.alimentoId))
    if (dudoso && !candidatas.some((c) => c.origen === 'duda' && c.itemIdTmp === it.idTmp)) {
      candidatas.push(preguntaDuda(it, crudos[i].alternativas))
    }
  })

  const textos = new Set<string>()
  const conDuda = new Set<string>()
  const unicas = candidatas.filter((c) => {
    const clave = c.texto.toLocaleLowerCase('es')
    if (textos.has(clave) || (c.origen === 'duda' && c.itemIdTmp && conDuda.has(c.itemIdTmp))) return false
    textos.add(clave)
    if (c.origen === 'duda' && c.itemIdTmp) conDuda.add(c.itemIdTmp)
    return true
  })

  const cajas = new Map(items.map((it) => [it.idTmp, it.caja]))
  return unicas
    .toSorted((a, b) => ORIGENES.indexOf(a.origen) - ORIGENES.indexOf(b.origen)) // estable: dentro de cada origen, el orden de llegada
    .slice(0, MAX_PREGUNTAS)
    .map((c, i) => {
      const caja = c.itemIdTmp ? cajas.get(c.itemIdTmp) : null
      return { id: `q${i + 1}`, texto: c.texto, opciones: c.opciones, ...(c.itemIdTmp ? { itemIdTmp: c.itemIdTmp } : {}), ...(caja ? { caja } : {}), origen: c.origen }
    })
}

function opcionesValidas(opciones: string[]): string[] {
  const vistas = new Set<string>()
  return opciones.map((o) => o.trim()).filter((o) => {
    const clave = o.toLocaleLowerCase('es')
    if (!o || vistas.has(clave)) return false
    vistas.add(clave)
    return true
  }).slice(0, 4)
}

/** "¿Son papas fritas o es otra cosa?" con lo que vio el modelo, hasta 2 alternativas suyas y "Otra cosa". */
function preguntaDuda(it: ItemDetectado, alternativas: string[]): Candidata {
  const nombre = it.preparacion
  const verbo = nombre.split(' ')[0].endsWith('s') ? 'Son' : 'Es'
  const opciones = opcionesValidas([mayuscula(nombre), ...alternativas.slice(0, 2).map(mayuscula), 'Otra cosa'])
  return { texto: `¿${verbo} ${minuscula(nombre)} o es otra cosa?`, opciones, itemIdTmp: it.idTmp, origen: 'duda' }
}

// Empanados y formados: por fuera no se ve de qué son. [prefijo de palabra, cómo se nombra en la pregunta]
const FORMADOS: [string, string][] = [
  ['milanesa', 'la milanesa'], ['nugget', 'los nuggets'], ['patita', 'las patitas'], ['empanada', 'la empanada'],
  ['hamburguesa', 'la hamburguesa'], ['croqueta', 'las croquetas'], ['medallon', 'el medallón'], ['suprema', 'la suprema'],
]
export const UMBRAL_PROTEINA = 0.9
export const OPCIONES_PROTEINA = ['Carne', 'Pollo', 'Pescado', 'Soja']

/** "¿De qué es la milanesa?" si el ítem es empanado o formado y la confianza no llega a UMBRAL_PROTEINA. */
function preguntaProteina(it: ItemDetectado): Candidata | null {
  if (it.confianza >= UMBRAL_PROTEINA) return null
  const palabras = normalizar(it.preparacion).split(' ')
  const formado = FORMADOS.find(([prefijo]) => palabras.some((w) => w.startsWith(prefijo)))
  if (!formado) return null
  const [, nombre] = formado
  const verbo = nombre.startsWith('los ') || nombre.startsWith('las ') ? 'son' : 'es'
  return { texto: `¿De qué ${verbo} ${nombre}?`, opciones: OPCIONES_PROTEINA, itemIdTmp: it.idTmp, origen: 'duda' }
}

const SE_VE: { distribucion: Record<Distribucion, string>; plato: Record<Plato, string> } = {
  distribucion: { separados: 'la comida está separada', tocandose: 'la comida se toca', mezclados: 'la comida está mezclada' },
  plato: { hondo: 'el plato es hondo', playo: 'el plato es playo', con_divisiones: 'el plato tiene divisiones', otro: 'no se ve su plato de siempre' },
}

/**
 * Solo las reglas sobre todo el plato (distribución y tipo de plato), que el código puede comprobar sin el modelo.
 * Las de atributos de un alimento ("nada con salsa") dependen de reconocer el ítem: esas las pregunta el modelo.
 */
function preguntaRegla(reglas: Regla[], d: { estado: Distribucion; plato: Plato }): Candidata | null {
  const actual = { distribucion: d.estado, plato: d.plato }
  for (const r of reglas) {
    const delPlato = r.condiciones.filter((c): c is { tipo: 'distribucion' | 'plato'; valor: string } => c.tipo === 'distribucion' || c.tipo === 'plato')
    if (delPlato.length === 0 || delPlato.length < r.condiciones.length) continue
    const rota = r.efecto === 'rechaza'
      ? delPlato.every((c) => actual[c.tipo] === c.valor)
      : delPlato.some((c) => actual[c.tipo] !== c.valor)
    if (!rota) continue
    const que = delPlato.some((c) => c.tipo === 'distribucion') ? SE_VE.distribucion[d.estado] : SE_VE.plato[d.plato]
    return { texto: `En la foto ${que}. ¿Le molestó?`, opciones: ['Sí, le molestó', 'No, estuvo bien'], origen: 'regla' }
  }
  return null
}

function recortar(x: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, x))
}

const mayuscula = (s: string) => s.charAt(0).toLocaleUpperCase('es') + s.slice(1)
const minuscula = (s: string) => s.charAt(0).toLocaleLowerCase('es') + s.slice(1)
