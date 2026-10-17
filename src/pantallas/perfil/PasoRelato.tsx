// Paso 2 · "Contanos cómo come": nota de voz (useGrabador → /api/transcribir → texto editable) o texto escrito.
// Sin micrófono queda el campo de texto, donde también funciona el dictado del teclado (C9).
import { useEffect, useId, useRef, useState } from 'react'
import { ErrorConReintento, Cargando } from '../../componentes/Estados'
import { api, type ErrorDeApi } from '../../lib/api'
import { MAX_SEGUNDOS, useGrabador, type Audio } from '../../lib/grabador'
import { aErrorDeApi } from '../../lib/useApi'
import { sumarNota } from './borrador'
import { IconoMicrofono } from './Iconos'

const MINIMO_RELATO = 15

const reloj = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

interface Props {
  nombre: string
  texto: string
  setTexto: (t: string | ((previo: string) => string)) => void
  /** Modo jurado: si el relato sigue siendo el de ejemplo, la nota de voz lo reemplaza en vez de sumarse. */
  textoEjemplo?: string
  alSeguir: () => void
  alVolver: () => void
}

export function PasoRelato({ nombre, texto, setTexto, textoEjemplo, alSeguir, alVolver }: Props) {
  const id = useId()
  const [transcribiendo, setTranscribiendo] = useState(false)
  const [error, setError] = useState<ErrorDeApi | null>(null)
  const [aviso, setAviso] = useState('')
  const [faltaTexto, setFaltaTexto] = useState(false)
  const [huboNota, setHuboNota] = useState(false)
  const ultimoAudio = useRef<Audio | null>(null)
  const control = useRef<AbortController | null>(null)
  const refTexto = useRef<HTMLTextAreaElement>(null)

  useEffect(() => () => control.current?.abort(), [])

  async function transcribir(audio: Audio) {
    ultimoAudio.current = audio
    control.current?.abort()
    const c = new AbortController()
    control.current = c
    setError(null)
    setAviso('')
    setTranscribiendo(true)
    try {
      const r = await api.transcribir({ audioBase64: audio.base64, mime: audio.mime, pista: nombre }, c.signal)
      if (c.signal.aborted) return
      const nuevo = r.texto.trim()
      setTexto((previo) => sumarNota(previo, nuevo, textoEjemplo))
      setHuboNota(true)
      setFaltaTexto(false)
      setAviso('Listo. Revisá el texto y corregí lo que haga falta.')
      refTexto.current?.focus()
    } catch (e) {
      if (!c.signal.aborted) setError(aErrorDeApi(e))
    } finally {
      if (!c.signal.aborted) setTranscribiendo(false)
    }
  }

  const g = useGrabador((audio) => { void transcribir(audio) })
  const sinMicrofono = g.estado === 'sin_permiso' || g.estado === 'no_soportado'
  const noEntendido = error?.codigo === 'audio_no_entendido'

  const seguir = () => {
    if (texto.trim().length < MINIMO_RELATO) {
      setFaltaTexto(true)
      refTexto.current?.focus()
      return
    }
    alSeguir()
  }

  return (
    <div className="pf-form">
      <div className="pf-ideas">
        <p>Contalo con tus palabras, como se lo contarías a alguien de confianza. Algunas ideas:</p>
        <ul>
          <li>Qué come seguro, y de qué marca.</li>
          <li>Qué no come y por qué: la textura, el color, el olor…</li>
          <li>Sus reglas: “que no se toquen”, “nada verde”, “siempre en su plato”.</li>
        </ul>
      </div>

      {!sinMicrofono && (
        <section className="pf-voz" aria-label="Nota de voz">
          {g.estado === 'grabando' ? (
            <>
              <p className="pf-grabando" role="status">
                <span className="pf-punto-rojo" aria-hidden="true" /> Escuchando…
                <span className="pf-reloj nb-numero" aria-hidden="true">{reloj(g.segundos)} / {reloj(MAX_SEGUNDOS)}</span>
              </p>
              <div className="pf-botones">
                <button type="button" className="nb-boton" onClick={g.detener}>Listo, terminé</button>
                <button type="button" className="nb-boton nb-boton-secundario" onClick={g.cancelar}>Cancelar</button>
              </div>
            </>
          ) : transcribiendo ? (
            <Cargando texto="Pasando tu nota a texto…" />
          ) : g.estado === 'pidiendo' ? (
            <Cargando texto="Pidiendo permiso para usar el micrófono…" />
          ) : (
            <>
              <button type="button" className="nb-boton pf-boton-voz" onClick={() => void g.iniciar()}>
                <IconoMicrofono /> {huboNota || noEntendido ? 'Grabar otra nota' : 'Contalo con tu voz'}
              </button>
              <p className="pf-ayuda">Hasta {MAX_SEGUNDOS} segundos. Después podés corregir el texto.</p>
            </>
          )}
        </section>
      )}

      {sinMicrofono && (
        <p className="pf-aviso-suave" role="status">
          No pudimos usar el micrófono. Escribilo acá abajo; si querés, tocá el micrófono del teclado para dictarlo.
        </p>
      )}
      {noEntendido && (
        <p className="pf-aviso-suave" role="alert">No llegamos a entender la nota. ¿La grabás de nuevo o lo escribís acá abajo?</p>
      )}
      {error && !noEntendido && (
        <ErrorConReintento error={error} reintentar={ultimoAudio.current ? () => void transcribir(ultimoAudio.current!) : undefined} />
      )}
      <p className="pf-oculto" role="status">{aviso}</p>

      <div className="pf-campo">
        <label htmlFor={`${id}-texto`}>{sinMicrofono ? 'Contanos cómo come' : 'O escribilo acá'}</label>
        <p id={`${id}-ayuda`} className="pf-ayuda">También funciona el dictado del teclado.</p>
        <textarea
          ref={refTexto} id={`${id}-texto`} className="pf-input pf-textarea" rows={8} value={texto}
          onChange={(e) => { setTexto(e.target.value); if (faltaTexto) setFaltaTexto(false) }}
          aria-describedby={`${id}-ayuda${faltaTexto ? ` ${id}-error` : ''}`} aria-invalid={faltaTexto || undefined}
          placeholder={`Por ejemplo: ${nombre} come fideos con manteca…`}
        />
        {faltaTexto && <p id={`${id}-error`} className="pf-error">Contanos un poco más para entender cómo come {nombre}.</p>}
      </div>

      <div className="pf-botones">
        <button type="button" className="nb-boton" onClick={seguir} disabled={transcribiendo || g.estado === 'grabando'}>
          Ver qué entendimos
        </button>
        <button type="button" className="nb-boton nb-boton-secundario" onClick={alVolver}>Volver a los datos</button>
      </div>
    </div>
  )
}
