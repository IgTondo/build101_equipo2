// Métricas de las evals de visión y de voz (PLAN.md §11.1 y §11.2). Funciones puras: no leen archivos ni llaman a la IA;
// los scripts eval-vision.ts y eval-voz.ts les pasan lo que devolvió el modelo y lo que dicen las etiquetas.
import type { Coccion, Color, Conducta, Cuanto, Forma, ItemDetectado, RelatoComida, Textura } from '../../shared/contratos.js'
import { esGenerico } from '../../server/ia/catalogo.js'

export const LIMITE_MS = 8000 // §7: foto → JSON y nota de voz → botones, en menos de 8 s

// ---------- Comunes ----------
export function media(valores: number[]): number | null {
  return valores.length ? valores.reduce((a, b) => a + b, 0) / valores.length : null
}

/** Percentil por rango más cercano: con pocas muestras, el p95 es el peor caso. */
export function percentil(valores: number[], p: number): number | null {
  if (!valores.length) return null
  const orden = [...valores].sort((a, b) => a - b)
  return orden[Math.min(orden.length, Math.max(1, Math.ceil((p / 100) * orden.length))) - 1]
}

export function fraccion(parte: number, total: number): number | null {
  return total ? parte / total : null
}

export interface Latencia { media: number | null; p95: number | null; bajoLimite: number | null }

/** `ms` null = la llamada falló: cuenta como fuera del límite y no entra en la media ni en el p95. */
export function latencia(ms: (number | null)[]): Latencia {
  const ok = ms.filter((x): x is number => x !== null)
  return { media: media(ok), p95: percentil(ok, 95), bajoLimite: fraccion(ok.filter((x) => x < LIMITE_MS).length, ms.length) }
}

export type Conteo = { ok: number; total: number }

// ---------- Visión (§11.1) ----------
export interface AlimentoEtiquetado { alimentoId: string; textura: Textura; forma: Forma; color: Color; coccion?: Coccion }

export const ATRIBUTOS_EVAL = ['textura', 'forma', 'color', 'coccion'] as const
export type AtributoEval = (typeof ATRIBUTOS_EVAL)[number]

export interface ComparacionFoto {
  etiquetados: number
  aciertos: number
  predichos: number          // los que entran en la precisión: aciertos + deMas (los otro_* que no aciertan, no)
  genericos: number          // ítems en otro_<grupo> sin etiqueta genérica: "no reconocidos", no errores
  faltaron: string[]         // alimentoId etiquetados que el modelo no reconoció
  deMas: string[]            // alimentoId que dijo y no estaban
  atributos: Record<AtributoEval, Conteo>
}

/** El ingrediente de más gramos (§5): es el alimento con el que se compara el ítem. */
export function alimentoPrincipal(item: ItemDetectado): string | null {
  let mejor: { alimentoId: string; gramosEst: number } | null = null
  for (const ing of item.ingredientes) if (!mejor || ing.gramosEst > mejor.gramosEst) mejor = ing
  return mejor?.alimentoId ?? null
}

function atributosIguales(etiqueta: AlimentoEtiquetado, item: ItemDetectado): Record<AtributoEval, boolean | null> {
  const a = item.atributos
  return {
    textura: a.textura === etiqueta.textura,
    forma: a.forma === etiqueta.forma,
    color: a.color === etiqueta.color,
    coccion: etiqueta.coccion === undefined ? null : a.coccion === etiqueta.coccion, // solo si está etiquetada
  }
}

const puntos = (r: Record<AtributoEval, boolean | null>) => ATRIBUTOS_EVAL.filter((k) => r[k] === true).length

/**
 * Empareja cada alimento etiquetado con un ítem cuyo alimento principal sea el mismo (si hay varios, el que más
 * atributos acierta). Un ítem en otro_<grupo> solo acierta si la etiqueta es ese mismo genérico.
 */
export function compararFoto(etiquetas: AlimentoEtiquetado[], items: ItemDetectado[]): ComparacionFoto {
  const libres = items.flatMap((item) => {
    const id = alimentoPrincipal(item)
    return id === null ? [] : [{ item, id }]
  })
  const atributos = Object.fromEntries(ATRIBUTOS_EVAL.map((k) => [k, { ok: 0, total: 0 }])) as Record<AtributoEval, Conteo>
  const faltaron: string[] = []
  let aciertos = 0

  for (const etiqueta of etiquetas) {
    let elegido = -1
    let mejor = -1
    libres.forEach((x, i) => {
      if (x.id !== etiqueta.alimentoId) return
      const p = puntos(atributosIguales(etiqueta, x.item))
      if (p > mejor) [elegido, mejor] = [i, p]
    })
    if (elegido < 0) {
      faltaron.push(etiqueta.alimentoId)
      continue
    }
    aciertos++
    const r = atributosIguales(etiqueta, libres[elegido].item)
    for (const k of ATRIBUTOS_EVAL) {
      if (r[k] === null) continue
      atributos[k].total++
      if (r[k]) atributos[k].ok++
    }
    libres.splice(elegido, 1)
  }

  const deMas = libres.filter((x) => !esGenerico(x.id)).map((x) => x.id)
  return {
    etiquetados: etiquetas.length, aciertos, predichos: aciertos + deMas.length,
    genericos: libres.length - deMas.length, faltaron, deMas, atributos,
  }
}

export interface ResultadoFoto {
  archivo: string
  ms: number | null          // null si la llamada falló
  comparacion: ComparacionFoto
  error?: string
}

export interface ResumenVision {
  fotos: number; errores: number
  etiquetados: number; aciertos: number; predichos: number; genericos: number
  recall: number | null; precision: number | null
  atributos: Conteo & { porAtributo: Record<AtributoEval, Conteo> }
  latencia: Latencia
  aciertosRapidos: number    // alimentos reconocidos en fotos que tardaron menos de 8 s: el criterio para elegir modelo
}

export function resumirVision(fotos: ResultadoFoto[]): ResumenVision {
  const suma = (f: (c: ComparacionFoto) => number) => fotos.reduce((s, x) => s + f(x.comparacion), 0)
  const porAtributo = Object.fromEntries(ATRIBUTOS_EVAL.map((k) => [k, {
    ok: suma((c) => c.atributos[k].ok), total: suma((c) => c.atributos[k].total),
  }])) as Record<AtributoEval, Conteo>
  const etiquetados = suma((c) => c.etiquetados)
  const aciertos = suma((c) => c.aciertos)
  const predichos = suma((c) => c.predichos)
  return {
    fotos: fotos.length, errores: fotos.filter((x) => x.error !== undefined).length,
    etiquetados, aciertos, predichos, genericos: suma((c) => c.genericos),
    recall: fraccion(aciertos, etiquetados), precision: fraccion(aciertos, predichos),
    atributos: {
      ok: ATRIBUTOS_EVAL.reduce((s, k) => s + porAtributo[k].ok, 0),
      total: ATRIBUTOS_EVAL.reduce((s, k) => s + porAtributo[k].total, 0),
      porAtributo,
    },
    latencia: latencia(fotos.map((x) => x.ms)),
    aciertosRapidos: fotos.filter((x) => x.ms !== null && x.ms < LIMITE_MS).reduce((s, x) => s + x.comparacion.aciertos, 0),
  }
}

/** §7, A11: se queda el que acierte más en menos de 8 s. Desempata el recall y después la latencia media. */
export function recomendarModelo(pasadas: { modelo: string; resumen: ResumenVision }[]): { modelo: string; motivo: string } | null {
  const orden = [...pasadas].sort((a, b) =>
    b.resumen.aciertosRapidos - a.resumen.aciertosRapidos
    || (b.resumen.recall ?? 0) - (a.resumen.recall ?? 0)
    || (a.resumen.latencia.media ?? Infinity) - (b.resumen.latencia.media ?? Infinity))
  const mejor = orden[0]
  if (!mejor) return null
  const r = mejor.resumen
  return { modelo: mejor.modelo, motivo: `reconoce ${r.aciertosRapidos} de ${r.etiquetados} alimentos en fotos analizadas en menos de 8 s` }
}

// ---------- Voz (§11.2) ----------
export interface EsperadoRelato {
  respuestas: { itemIdTmp: string; cuanto: Cuanto }[]
  sinMencion: string[]
  conducta: Conducta[]
}

export interface ComparacionRelato {
  cuantoOk: number; cuantoTotal: number
  cuantoMal: { itemIdTmp: string; esperado: Cuanto; obtenido: Cuanto }[]
  faltantes: string[]        // ítems que el padre nombró y el modelo dejó sin respuesta
  inventados: string[]       // respuestas para ítems que debían ir a sinMencion (o que no existen): tiene que dar 0
  sinMencion: number         // ítems que debían quedar sin marcar
  citasValidas: number; citasTotal: number
  conductaOk: boolean
  conductaDeMas: Conducta[]; conductaFaltante: Conducta[]
}

const normalizar = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

/** La cita tiene que estar en la transcripción (§7). Ignora mayúsculas, tildes, puntuación y espacios. */
export function citaValida(cita: string | undefined, transcripcion: string): boolean {
  const c = normalizar(cita ?? '')
  return c.length > 0 && ` ${normalizar(transcripcion)} `.includes(` ${c} `)
}

export function compararRelato(esperado: EsperadoRelato, obtenido: RelatoComida, idsItems: string[]): ComparacionRelato {
  const sinMencion = new Set(esperado.sinMencion)
  const existentes = new Set(idsItems)
  const inventados = obtenido.respuestas
    .filter((r) => sinMencion.has(r.itemIdTmp) || !existentes.has(r.itemIdTmp))
    .map((r) => r.itemIdTmp)
  const citasValidas = obtenido.respuestas.filter((r) => citaValida(r.cita, obtenido.transcripcion)).length

  const cuantoMal: ComparacionRelato['cuantoMal'] = []
  const faltantes: string[] = []
  let cuantoOk = 0
  for (const e of esperado.respuestas) {
    const r = obtenido.respuestas.find((x) => x.itemIdTmp === e.itemIdTmp)
    if (!r) faltantes.push(e.itemIdTmp)
    else if (r.cuanto === e.cuanto) cuantoOk++
    else cuantoMal.push({ itemIdTmp: e.itemIdTmp, esperado: e.cuanto, obtenido: r.cuanto })
  }

  const dijo = new Set(obtenido.conducta)
  const habia = new Set(esperado.conducta)
  const conductaDeMas = [...dijo].filter((c) => !habia.has(c))
  const conductaFaltante = [...habia].filter((c) => !dijo.has(c))
  return {
    cuantoOk, cuantoTotal: esperado.respuestas.length, cuantoMal, faltantes, inventados, sinMencion: sinMencion.size,
    citasValidas, citasTotal: obtenido.respuestas.length,
    conductaOk: !conductaDeMas.length && !conductaFaltante.length, conductaDeMas, conductaFaltante,
  }
}

/** Si la llamada falló, el caso cuenta entero como mal (sin inventados: no respondió nada). */
export function relatoFallido(esperado: EsperadoRelato): ComparacionRelato {
  return {
    cuantoOk: 0, cuantoTotal: esperado.respuestas.length, cuantoMal: [], faltantes: esperado.respuestas.map((r) => r.itemIdTmp),
    inventados: [], sinMencion: esperado.sinMencion.length, citasValidas: 0, citasTotal: 0,
    conductaOk: false, conductaDeMas: [], conductaFaltante: [...esperado.conducta],
  }
}

export interface ResultadoRelato {
  id: string
  canal: string              // 'texto', 'iphone', 'android' o 'audio' (si el caso no dice el dispositivo)
  ms: number | null
  comparacion: ComparacionRelato
  error?: string
}

export interface ResumenVoz {
  casos: number; errores: number
  cuanto: Conteo; conducta: Conteo
  inventados: number; sinMencion: number
  citas: Conteo
  latencia: Latencia
}

export function resumirVoz(casos: ResultadoRelato[]): ResumenVoz {
  const suma = (f: (c: ComparacionRelato) => number) => casos.reduce((s, x) => s + f(x.comparacion), 0)
  return {
    casos: casos.length, errores: casos.filter((x) => x.error !== undefined).length,
    cuanto: { ok: suma((c) => c.cuantoOk), total: suma((c) => c.cuantoTotal) },
    conducta: { ok: casos.filter((x) => x.comparacion.conductaOk).length, total: casos.length },
    inventados: suma((c) => c.inventados.length), sinMencion: suma((c) => c.sinMencion),
    citas: { ok: suma((c) => c.citasValidas), total: suma((c) => c.citasTotal) },
    latencia: latencia(casos.map((x) => x.ms)),
  }
}
