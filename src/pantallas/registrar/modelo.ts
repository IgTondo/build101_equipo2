// Estado puro de la pantalla Registrar (C2/C5): lo que el padre corrige sobre el análisis y el relato,
// y cómo se arma el RegistrarComidaReq. Sin React ni DOM, para poder testearlo (registrar.test.ts).
import type {
  AnalisisComida, Conducta, Cuanto, Momento, Motivo, Nutriente, Porcion, RegistrarComidaReq, RelatoComida,
} from '../../../shared/contratos'
import { DECIMALES, formatoNutriente } from '../../lib/vocabulario'

export interface ItemEdit {
  idTmp: string
  preparacion: string                    // el nombre que ve (y puede cambiar) el padre
  porcion: Porcion
  borrado: boolean                       // se puede deshacer hasta guardar
}

/** Lo que dijo la IA a partir del relato, para resaltarlo y para saber si el padre lo cambió. */
export interface MarcaIA { cuanto: Cuanto; motivo?: Motivo; cita?: string }
export interface RespuestaEdit { cuanto?: Cuanto; motivo?: Motivo; ia?: MarcaIA }

export interface Borrador {
  analisis: AnalisisComida               // el original de la visión, sin tocar
  items: ItemEdit[]
  respuestas: Record<string, RespuestaEdit>
  sinMencion: string[]                   // del relato: ítems que el padre no nombró (quedan sin marcar)
  preguntas: Record<string, string>      // preguntaId → opción elegida
  preguntasIA: Record<string, string>
  conducta: Conducta[]
  conductaIA: Conducta[]
  relato?: { transcripcion: string; fuente: 'voz' | 'texto'; comentario: string }
}

/** Escalones en los que tiene sentido preguntar el motivo (opcional). */
export const CON_MOTIVO: Cuanto[] = ['nada', 'aparto']

export function borradorInicial(analisis: AnalisisComida): Borrador {
  return {
    analisis,
    items: analisis.items.map((i) => ({ idTmp: i.idTmp, preparacion: i.preparacion, porcion: i.porcion, borrado: false })),
    respuestas: {}, sinMencion: [], preguntas: {}, preguntasIA: {}, conducta: [], conductaIA: [],
  }
}

export const itemsVivos = (b: Borrador) => b.items.filter((i) => !i.borrado)

/** Preguntas de la IA que siguen teniendo sentido (no apuntan a un ítem que el padre sacó). */
export function preguntasVivas(b: Borrador) {
  const vivos = new Set(itemsVivos(b).map((i) => i.idTmp))
  return b.analisis.preguntas.slice(0, 3).filter((p) => !p.itemIdTmp || vivos.has(p.itemIdTmp))
}

/** El análisis con las correcciones del padre: sin los ítems borrados, con el nombre y la porción nuevos. */
export function analisisEditado(b: Borrador): AnalisisComida {
  const porId = new Map(itemsVivos(b).map((i) => [i.idTmp, i]))
  const items = b.analisis.items.flatMap((orig) => {
    const e = porId.get(orig.idTmp)
    if (!e) return []
    const nombre = e.preparacion.trim() || orig.preparacion
    const renombrado = nombre !== orig.preparacion
    // Si el padre lo renombró, el id de la visión ya no es confiable: B lo vuelve a buscar por nombre.
    return [{ ...orig, preparacion: nombre, porcion: e.porcion, preparacionId: renombrado ? null : orig.preparacionId }]
  })
  const preguntas = preguntasVivas(b)
  return { ...b.analisis, items, preguntas, distribucion: { ...b.analisis.distribucion, cantidadItems: items.length } }
}

/** Pre-marca lo que entendió la IA. Lo no mencionado queda como estaba (sin marcar) y con aviso. */
export function aplicarRelato(b: Borrador, relato: RelatoComida, fuente: 'voz' | 'texto'): Borrador {
  const vivos = new Set(itemsVivos(b).map((i) => i.idTmp))
  const respuestas = { ...b.respuestas }
  const porcionDe = new Map<string, Porcion>()
  const mencionados = new Set<string>()
  for (const r of relato.respuestas) {
    if (!vivos.has(r.itemIdTmp) || relato.sinMencion.includes(r.itemIdTmp)) continue
    // Sin cita la IA no tiene de dónde sacarlo (§5, v4): se trata como no mencionado y no se inventa.
    if (!r.cita?.trim()) continue
    mencionados.add(r.itemIdTmp)
    respuestas[r.itemIdTmp] = { cuanto: r.cuanto, motivo: r.motivo, ia: { cuanto: r.cuanto, motivo: r.motivo, cita: r.cita } }
    if (r.porcion) porcionDe.set(r.itemIdTmp, r.porcion)
  }
  const sinMencion = [...vivos].filter((id) => !mencionados.has(id))
  const idsPreguntas = new Set(preguntasVivas(b).map((p) => p.id))
  const preguntasIA: Record<string, string> = {}
  for (const rp of relato.respuestasPreguntas) {
    const p = b.analisis.preguntas.find((q) => q.id === rp.preguntaId)
    if (p && idsPreguntas.has(p.id) && p.opciones.includes(rp.respuesta)) preguntasIA[p.id] = rp.respuesta
  }
  return {
    ...b,
    items: b.items.map((i) => (porcionDe.has(i.idTmp) ? { ...i, porcion: porcionDe.get(i.idTmp)! } : i)),
    respuestas,
    sinMencion,
    preguntas: { ...b.preguntas, ...preguntasIA },
    preguntasIA,
    conducta: [...new Set([...b.conducta, ...relato.conducta])],
    conductaIA: relato.conducta,
    relato: { transcripcion: relato.transcripcion, fuente, comentario: relato.comentario },
  }
}

/** El padre toca un escalón: deja de ser "de la IA" si no coincide; el motivo se borra si ya no aplica. */
export function marcarCuanto(b: Borrador, idTmp: string, cuanto: Cuanto): Borrador {
  const prev = b.respuestas[idTmp] ?? {}
  if (prev.cuanto === cuanto) return b
  const motivo = prev.ia?.cuanto === cuanto ? prev.ia.motivo                       // vuelve a lo que dijo la nota
    : CON_MOTIVO.includes(cuanto) && prev.cuanto && CON_MOTIVO.includes(prev.cuanto) ? prev.motivo
    : undefined
  return { ...b, respuestas: { ...b.respuestas, [idTmp]: { ...prev, cuanto, motivo } } }
}

export function marcarMotivo(b: Borrador, idTmp: string, motivo: Motivo | undefined): Borrador {
  const prev = b.respuestas[idTmp] ?? {}
  return { ...b, respuestas: { ...b.respuestas, [idTmp]: { ...prev, motivo } } }
}

/** La respuesta sigue siendo exactamente la que marcó la IA (para resaltarla y para mandar la cita). */
export const esDeIA = (r: RespuestaEdit | undefined): boolean =>
  !!r?.ia && r.cuanto === r.ia.cuanto && r.motivo === r.ia.motivo

export const faltanMarcar = (b: Borrador) => itemsVivos(b).filter((i) => !b.respuestas[i.idTmp]?.cuanto)
export const puedeGuardar = (b: Borrador) => itemsVivos(b).length > 0 && faltanMarcar(b).length === 0

/** ¿El padre cambió algo de lo que marcó la IA? Si lo cambió, el comentario del relato ya no lo describe. */
function corrigioIA(b: Borrador): boolean {
  const vivos = itemsVivos(b)
  const respuestaCambiada = vivos.some((i) => b.respuestas[i.idTmp]?.ia && !esDeIA(b.respuestas[i.idTmp]))
  const preguntaCambiada = Object.entries(b.preguntasIA).some(([id, r]) => b.preguntas[id] !== r)
  const conductaCambiada = b.conductaIA.some((c) => !b.conducta.includes(c))
  return respuestaCambiada || preguntaCambiada || conductaCambiada
}

export interface Contexto { ninoId: string; momento: Momento; thumbBase64?: string; ahora: Date; dia: string }

export function armarRegistro(b: Borrador, ctx: Contexto): RegistrarComidaReq {
  const analisis = analisisEditado(b)
  const porcion = new Map(analisis.items.map((i) => [i.idTmp, i.porcion]))
  const respuestas = analisis.items.map((i) => {
    const r = b.respuestas[i.idTmp]
    if (!r?.cuanto) throw new Error(`Falta marcar ${i.preparacion}`)
    return {
      itemIdTmp: i.idTmp, cuanto: r.cuanto, porcion: porcion.get(i.idTmp)!,
      ...(r.motivo ? { motivo: r.motivo } : {}),
      ...(esDeIA(r) && r.ia?.cita ? { cita: r.ia.cita } : {}),
    }
  })
  const preguntasOk = new Set(analisis.preguntas.map((p) => p.id))
  const respuestasPreguntas = Object.entries(b.preguntas)
    .filter(([id]) => preguntasOk.has(id))
    .map(([preguntaId, respuesta]) => ({ preguntaId, respuesta }))
  const comentario = b.relato && !corrigioIA(b) ? b.relato.comentario.trim() : ''
  return {
    ninoId: ctx.ninoId,
    dia: ctx.dia,
    fechaISO: ctx.ahora.toISOString(),
    momento: ctx.momento,
    ...(ctx.thumbBase64 ? { thumbBase64: ctx.thumbBase64 } : {}),
    ...(comentario ? { comentario } : {}),
    analisis,
    respuestas,
    respuestasPreguntas,
    conducta: b.conducta,
    ...(b.relato?.transcripcion.trim() ? { relato: { transcripcion: b.relato.transcripcion, fuente: b.relato.fuente } } : {}),
  }
}

// ---------- Momento por defecto (hora de Uruguay) ----------
export function horaUruguay(fecha = new Date()): number {
  const h = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Montevideo', hour: 'numeric', hourCycle: 'h23' }).format(fecha)
  return Number(h) % 24
}

export function momentoPorHora(hora: number): Momento {
  if (hora < 10) return 'desayuno'
  if (hora < 15) return 'almuerzo'
  if (hora < 19) return 'merienda'
  return 'cena'
}

/** "63–131 mg" (o un solo valor si el rango colapsa al redondear). */
export function rangoLegible(n: Nutriente, min: number, max: number): string {
  const num = (v: number) => v.toLocaleString('es-UY', { maximumFractionDigits: DECIMALES[n] })
  return num(min) === num(max) ? formatoNutriente(n, max) : `${num(min)}–${formatoNutriente(n, max)}`
}
