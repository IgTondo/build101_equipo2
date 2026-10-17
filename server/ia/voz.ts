// Transcripción (PLAN.md §7, A4 y A7): Whisper large-v3-turbo en Groq; respaldo en Workers AI.
// Idioma 'es'. `pista` va como prompt de Whisper: los nombres de los alimentos del plato y del perfil.
// El respaldo entra si Groq no tiene key o falla por cupo (limite) o por error del proveedor.
// Se sacan las frases que Whisper inventa con silencio o ruido ("Subtítulos… Amara.org", "Gracias por ver"…);
// si no queda nada, es audio_vacio.
import { toFile } from 'groq-sdk'
import { ErrorIA } from './errores.js'
import { correrWorkersAI, credencialesCloudflare } from './proveedores/cloudflare.js'
import { clienteGroq, errorGroq, tieneClaveGroq } from './proveedores/groq.js'

export interface OpcionesTranscribir {
  audioBase64: string
  mime: string           // 'audio/mp4' (iPhone) o 'audio/webm' (Android)
  pista?: string
}

export interface Transcripcion {
  texto: string
  ms: number
  modelo: string
}

const MODELO_GROQ = 'whisper-large-v3-turbo'
const MODELO_CLOUDFLARE = '@cf/openai/whisper-large-v3-turbo'
const MAX_PISTA = 600 // caracteres: Whisper usa hasta 224 tokens de prompt

// Groq elige el decodificador por la extensión del archivo.
const EXTENSION: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
}

// Cierres de video de YouTube que Whisper en español alucina con silencio o ruido, ya normalizados. Se comparan
// oraciones enteras (una o varias de estas frases y nada más), para no tocar un relato que use esas palabras.
const FRASE_INVENTADA = [
  'subtitul(os|ado)( (realizados|hechos|creados))? por la comunidad de amara org',
  '(muchas )?gracias por (ver|mirar)( el video)?',
  'suscrib(ete|ite|anse)( al canal)?',
].join('|')
const SOLO_INVENTADAS = new RegExp(`^(?:${FRASE_INVENTADA})(?:(?: y)? (?:${FRASE_INVENTADA}))*$`)

/** Sin tildes, mayúsculas ni puntuación: '¡Suscríbete!' → 'suscribete'. */
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

/** Saca las oraciones que son solo frases inventadas por Whisper; el resto queda tal cual. */
export function sinFrasesInventadas(texto: string): string {
  return texto
    .split(/(?<=[.!?…])\s+|\n+/)
    .filter((oracion) => !SOLO_INVENTADAS.test(normalizar(oracion)))
    .join(' ')
    .trim()
}

/** 'audio/webm;codecs=opus' → { mime: 'audio/webm', ext: 'webm' }. */
function formato(mime: string): { mime: string; ext: string } {
  const base = mime.split(';')[0].trim().toLowerCase()
  const ext = EXTENSION[base]
  if (!ext) throw new ErrorIA('entrada_invalida', `formato de audio no soportado: ${base || '(vacío)'}`)
  return { mime: base, ext }
}

async function conGroq(audio: Buffer, f: { mime: string; ext: string }, pista?: string) {
  try {
    const r = await clienteGroq().audio.transcriptions.create({
      file: await toFile(audio, `nota.${f.ext}`, { type: f.mime }),
      model: MODELO_GROQ,
      language: 'es',
      ...(pista ? { prompt: pista } : {}),
      response_format: 'json',
    })
    return { texto: r.text, modelo: MODELO_GROQ }
  } catch (e) {
    throw errorGroq(e)
  }
}

async function conCloudflare(audioBase64: string, pista?: string) {
  const r = await correrWorkersAI<{ text?: string }>(MODELO_CLOUDFLARE, {
    audio: audioBase64,
    task: 'transcribe',
    language: 'es',
    ...(pista ? { initial_prompt: pista } : {}),
  })
  return { texto: r.text ?? '', modelo: MODELO_CLOUDFLARE }
}

async function conRespaldo(audio: Buffer, audioBase64: string, f: { mime: string; ext: string }, pista?: string) {
  const hayCloudflare = credencialesCloudflare() !== null
  if (!tieneClaveGroq()) {
    if (!hayCloudflare) throw new ErrorIA('sin_clave', 'faltan GROQ_API_KEY y las credenciales de Cloudflare')
    return conCloudflare(audioBase64, pista)
  }
  try {
    return await conGroq(audio, f, pista)
  } catch (e) {
    if (!hayCloudflare || !(e instanceof ErrorIA) || (e.motivo !== 'limite' && e.motivo !== 'proveedor')) throw e
    return conCloudflare(audioBase64, pista)
  }
}

export async function transcribir(opciones: OpcionesTranscribir): Promise<Transcripcion> {
  const inicio = Date.now()
  const f = formato(opciones.mime)
  const audio = Buffer.from(opciones.audioBase64, 'base64')
  if (audio.length === 0) throw new ErrorIA('audio_vacio', 'el audio vino vacío')
  const pista = opciones.pista?.trim().slice(0, MAX_PISTA) || undefined
  const r = await conRespaldo(audio, opciones.audioBase64, f, pista)
  const crudo = r.texto.trim()
  const texto = sinFrasesInventadas(crudo)
  if (!normalizar(texto)) {
    const que = crudo ? 'solo trajo frases que Whisper inventa con silencio o ruido' : 'devolvió una transcripción vacía'
    throw new ErrorIA('audio_vacio', `${r.modelo} ${que}`)
  }
  return { texto, ms: Date.now() - inicio, modelo: r.modelo }
}
