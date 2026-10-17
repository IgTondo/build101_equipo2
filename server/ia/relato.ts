// Relato de la comida (PLAN.md §7, A7): nota de voz o texto → RelatoComida.
// Si no vino texto, transcribir() con los nombres del plato como pista → Claude Haiku 5.5 (tarea 'relato') con los ítems,
// las preguntas, la escalera de §5.1 y la transcripción → depurarRelato().
// Qué respuestas quedan lo decide el código, nunca el LLM: la cita tiene que estar en la transcripción y el ítem en el
// plato; las respuestas a preguntas con opciones tienen que ser una de ellas. Lo que no pasa va a sinMencion.
import { z } from 'zod'
import {
  CONDUCTA, CUANTO, MOTIVO, PORCION,
  type ItemDetectado, type Pregunta, type RelatoComida, type RelatoComidaReq,
} from '../../shared/contratos.js'
import { ErrorNibble } from '../http.js'
import { generarJSON } from './modelo.js'
import { mensajeRelato, SISTEMA_RELATO } from './prompts/relato.js'
import { transcribir, type OpcionesTranscribir, type Transcripcion } from './voz.js'

// ---------- Entrada ----------
// Se valida lo que usa el relato; el resto del análisis no se mira (lo armó /api/analizar-comida).
export const esquemaRelatoReq = z.object({
  ninoId: z.string().min(1),
  analisis: z.object({
    items: z.array(z.object({ idTmp: z.string().min(1), preparacion: z.string() })),
    preguntas: z.array(z.object({ id: z.string().min(1), texto: z.string(), opciones: z.array(z.string()) })),
  }),
  audioBase64: z.string().optional(),
  mime: z.string().optional(),
  texto: z.string().optional(),
})

export const esquemaTranscribirReq = z.object({
  audioBase64: z.string().min(1),
  mime: z.string().min(1),
  pista: z.string().optional(),
})

// ---------- Salida del modelo ----------
export const esquemaSalidaRelato = z.object({
  respuestas: z.array(z.object({
    itemIdTmp: z.string(),
    cuanto: z.enum(CUANTO),
    porcion: z.enum(PORCION).nullable(),
    motivo: z.enum(MOTIVO).nullable(),
    confianza: z.number(),
    cita: z.string(),
  })),
  respuestasPreguntas: z.array(z.object({ preguntaId: z.string(), respuesta: z.string() })),
  conducta: z.array(z.enum(CONDUCTA)),
  comentario: z.string(),
})
export type SalidaRelato = z.infer<typeof esquemaSalidaRelato>

type Respuesta = RelatoComida['respuestas'][number]

/** Por qué el código descartó una respuesta del modelo (va al log, sin el texto del padre). */
export interface Descarte { itemIdTmp: string; motivo: 'item_inexistente' | 'sin_cita' | 'cita_no_esta' }

// ---------- Citas ----------
/** Minúsculas, sin tildes, sin puntuación y con los espacios colapsados: "¡Lo SACÓ del plato!" → "lo saco del plato". */
export function normalizar(texto: string): string {
  return texto.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

/** ¿La cita está en la transcripción? Comparación normalizada y por palabras completas. Una cita vacía nunca está. */
export function citaEnTranscripcion(cita: string, transcripcion: string): boolean {
  const c = normalizar(cita)
  return c !== '' && ` ${normalizar(transcripcion)} `.includes(` ${c} `)
}

// ---------- Transcripción ----------
const MAX_PISTA = 400 // Whisper usa como mucho 224 tokens de prompt

/**
 * Los nombres del plato, sin repetir, como pista para Whisper ("dambo", "milanesa", "boniato").
 * TODO(A7): sumar los nombres del perfil del chico cuando B exponga su lectura (obtenerContexto() o GET /api/perfil).
 */
export function pistaTranscripcion(items: Pick<ItemDetectado, 'preparacion'>[]): string | undefined {
  const nombres = [...new Set(items.map((i) => i.preparacion.trim()).filter(Boolean))]
  let pista = ''
  for (const n of nombres) {
    const siguiente = pista ? `${pista}, ${n}` : n
    if (siguiente.length > MAX_PISTA) break
    pista = siguiente
  }
  return pista || undefined
}

/** transcribir() y la garantía de que el texto no viene vacío (voz.ts ya la da; esto cubre a cualquier proveedor). */
export async function transcribirAudio(opciones: OpcionesTranscribir): Promise<Transcripcion> {
  const t = await transcribir(opciones)
  const texto = t.texto.trim()
  if (!texto) throw new ErrorNibble('audio_no_entendido', 'No llegamos a entender la nota. ¿Probás grabarla de nuevo o escribirlo?')
  return { ...t, texto }
}

async function transcripcionDe(req: RelatoComidaReq): Promise<string> {
  const texto = req.texto?.trim()
  if (texto) return texto
  if (!req.audioBase64) {
    throw new ErrorNibble('entrada_invalida', 'Contanos cómo le fue con una nota de voz o escribiéndolo.', { campo: 'audioBase64 | texto' })
  }
  if (!req.mime) throw new ErrorNibble('entrada_invalida', 'Falta el formato del audio.', { campo: 'mime' })
  const pista = pistaTranscripcion(req.analisis.items)
  return (await transcribirAudio({ audioBase64: req.audioBase64, mime: req.mime, pista })).texto
}

// ---------- Depuración (código, nunca IA) ----------
/**
 * Lo que el código no le deja al modelo (§7, v4). Pura: la usan interpretarRelato(), los tests y la eval de voz.
 * - Respuesta sin cita, con una cita que no está en la transcripción o de un ítem que no está en el plato → descartada.
 * - Dos respuestas para el mismo ítem → la de mayor confianza. Porción igual a la servida → no es una corrección.
 * - sinMencion = todos los ítems sin respuesta válida.
 * - Preguntas: solo ids existentes y, si tienen opciones, una de ellas (se devuelve la opción tal cual está escrita).
 */
export function depurarRelato(
  salida: SalidaRelato,
  entrada: {
    items: Pick<ItemDetectado, 'idTmp' | 'porcion'>[]
    preguntas: Pick<Pregunta, 'id' | 'opciones'>[]
    transcripcion: string
  },
): { relato: Omit<RelatoComida, 'transcripcion' | 'ms'>; descartes: Descarte[] } {
  const { items, preguntas, transcripcion } = entrada
  const servida = new Map(items.map((i) => [i.idTmp, i.porcion]))
  const elegidas = new Map<string, Respuesta>()
  const descartes: Descarte[] = []

  for (const r of salida.respuestas) {
    const motivo = !servida.has(r.itemIdTmp) ? 'item_inexistente'
      : !r.cita?.trim() ? 'sin_cita'
      : !citaEnTranscripcion(r.cita, transcripcion) ? 'cita_no_esta'
      : null
    if (motivo) { descartes.push({ itemIdTmp: r.itemIdTmp, motivo }); continue }
    const confianza = Math.min(1, Math.max(0, r.confianza))
    const previa = elegidas.get(r.itemIdTmp)
    if (previa && previa.confianza >= confianza) continue
    elegidas.set(r.itemIdTmp, {
      itemIdTmp: r.itemIdTmp,
      cuanto: r.cuanto,
      ...(r.porcion && r.porcion !== servida.get(r.itemIdTmp) ? { porcion: r.porcion } : {}),
      ...(r.motivo ? { motivo: r.motivo } : {}),
      confianza,
      cita: r.cita.trim(),
    })
  }

  const ids = [...servida.keys()]
  const porId = new Map(preguntas.map((p) => [p.id, p]))
  const respuestasPreguntas: RelatoComida['respuestasPreguntas'] = []
  for (const rp of salida.respuestasPreguntas) {
    const p = porId.get(rp.preguntaId)
    if (!p || respuestasPreguntas.some((x) => x.preguntaId === p.id)) continue
    const respuesta = p.opciones.length
      ? p.opciones.find((o) => normalizar(o) === normalizar(rp.respuesta))
      : rp.respuesta.trim()
    if (respuesta) respuestasPreguntas.push({ preguntaId: p.id, respuesta })
  }

  return {
    relato: {
      respuestas: ids.flatMap((id) => elegidas.get(id) ?? []),   // en el orden del plato
      respuestasPreguntas,
      conducta: CONDUCTA.filter((c) => salida.conducta.includes(c)),
      comentario: salida.comentario.replace(/\s+/g, ' ').trim(),
      sinMencion: ids.filter((id) => !elegidas.has(id)),
    },
    descartes,
  }
}

// ---------- El relato ----------
export async function interpretarRelato(req: RelatoComidaReq): Promise<RelatoComida> {
  const t0 = Date.now()
  const transcripcion = await transcripcionDe(req)
  const { items, preguntas } = req.analisis
  const { datos } = await generarJSON({
    tarea: 'relato',
    sistema: SISTEMA_RELATO,
    partes: [{ tipo: 'texto', texto: mensajeRelato({ items, preguntas, transcripcion }) }],
    schema: esquemaSalidaRelato,
  })
  const { relato, descartes } = depurarRelato(datos, { items, preguntas, transcripcion })
  if (descartes.length) console.warn(JSON.stringify({ evento: 'relato', aviso: 'respuestas_descartadas', descartes }))
  return { transcripcion, ...relato, ms: Date.now() - t0 }
}
