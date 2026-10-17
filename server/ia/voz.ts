// Transcripción (PLAN.md §7, A4 y A7): Whisper large-v3-turbo en Groq; respaldo en Workers AI.
// Idioma 'es'. `pista` va como prompt de Whisper: los nombres de los alimentos del plato y del perfil.
import { ErrorIA } from './errores.js'

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

export async function transcribir(opciones: OpcionesTranscribir): Promise<Transcripcion> {
  throw new ErrorIA('no_implementado', `transcribir(${opciones.mime}) todavía no está implementado`)
}
