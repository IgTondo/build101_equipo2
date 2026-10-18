// Grabador de notas de voz (C5), compartido por Registrar y Perfil. MediaRecorder con el formato que el navegador
// soporte: audio/mp4 en Safari (iPhone), audio/webm en Chrome (Android). Whisper acepta los dos.
// Máximo 90 s por defecto (§4.2, la nota de una comida); el alta por voz pide 180 (§5.2). Al llegar al máximo se
// detiene solo y entrega lo grabado.
import { useCallback, useEffect, useRef, useState } from 'react'

export const MAX_SEGUNDOS = 90
const FORMATOS = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus']

export type EstadoGrabador = 'inactivo' | 'pidiendo' | 'grabando' | 'sin_permiso' | 'no_soportado'
export interface Audio { base64: string; mime: string; segundos: number }

export function grabadorSoportado(): boolean {
  return typeof window !== 'undefined' && 'MediaRecorder' in window && !!navigator.mediaDevices?.getUserMedia
}

function formatoSoportado(): string | undefined {
  return FORMATOS.find((f) => MediaRecorder.isTypeSupported?.(f))
}

export async function blobABase64(blob: Blob): Promise<string> {
  const url: string = await new Promise((ok, mal) => {
    const lector = new FileReader()
    lector.onload = () => ok(lector.result as string)
    lector.onerror = () => mal(lector.error)
    lector.readAsDataURL(blob)
  })
  return url.slice(url.indexOf(',') + 1)
}

/**
 * const g = useGrabador(audio => enviar(audio))            // hasta 90 s
 * const g = useGrabador(audio => enviar(audio), { maxSegundos: 180 })
 * g.iniciar() pide el micrófono y graba; g.detener() termina y llama a alTerminar; g.cancelar() descarta.
 */
export function useGrabador(alTerminar: (audio: Audio) => void, { maxSegundos = MAX_SEGUNDOS }: { maxSegundos?: number } = {}) {
  const [estado, setEstado] = useState<EstadoGrabador>(() => (grabadorSoportado() ? 'inactivo' : 'no_soportado'))
  const [segundos, setSegundos] = useState(0)
  const rec = useRef<MediaRecorder | null>(null)
  const partes = useRef<Blob[]>([])
  const descartar = useRef(false)
  const inicio = useRef(0)
  const reloj = useRef<number | undefined>(undefined)
  const callback = useRef(alTerminar)
  callback.current = alTerminar
  const maximo = useRef(maxSegundos)
  maximo.current = maxSegundos

  const limpiar = useCallback(() => {
    window.clearInterval(reloj.current)
    rec.current?.stream.getTracks().forEach((t) => t.stop())
    rec.current = null
  }, [])

  const detener = useCallback(() => {
    if (rec.current?.state === 'recording') rec.current.stop()
  }, [])

  const cancelar = useCallback(() => {
    descartar.current = true
    detener()
  }, [detener])

  const iniciar = useCallback(async () => {
    if (!grabadorSoportado()) return setEstado('no_soportado')
    setEstado('pidiendo')
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
    } catch {
      return setEstado('sin_permiso')
    }
    const mime = formatoSoportado()
    const r = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 64_000 } : undefined)
    partes.current = []
    descartar.current = false
    r.ondataavailable = (e) => { if (e.data.size) partes.current.push(e.data) }
    r.onstop = async () => {
      const seg = Math.round((performance.now() - inicio.current) / 1000)
      const tipo = (r.mimeType || mime || 'audio/webm').split(';')[0]
      limpiar()
      setEstado('inactivo')
      setSegundos(0)
      if (descartar.current || !partes.current.length) return
      const blob = new Blob(partes.current, { type: tipo })
      callback.current({ base64: await blobABase64(blob), mime: tipo, segundos: seg })
    }
    rec.current = r
    inicio.current = performance.now()
    r.start(1000)
    setSegundos(0)
    setEstado('grabando')
    reloj.current = window.setInterval(() => {
      const s = Math.floor((performance.now() - inicio.current) / 1000)
      setSegundos(s)
      if (s >= maximo.current) r.state === 'recording' && r.stop()
    }, 250)
  }, [limpiar])

  // Si el componente se desmonta grabando, se descarta y se libera el micrófono.
  useEffect(() => () => { descartar.current = true; if (rec.current?.state === 'recording') rec.current.stop(); limpiar() }, [limpiar])

  return { estado, segundos, maxSegundos, restantes: maxSegundos - segundos, iniciar, detener, cancelar }
}
