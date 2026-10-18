// Alta por voz (§5.2) · "Contanos de tu hijo": un solo audio de hasta 3 minutos con la guía de lo vital a la vista
// (useGrabador → /api/transcribir → texto editable). Sin micrófono queda el campo de texto, donde también funciona
// el dictado del teclado (§13).
import { useEffect, useId, useRef, useState } from 'react'
import { Cargando, ErrorConReintento } from '../../componentes/Estados'
import { api, type ErrorDeApi } from '../../lib/api'
import { useGrabador, type Audio } from '../../lib/grabador'
import { aErrorDeApi } from '../../lib/useApi'
import { sumarNota } from './borrador'
import { IconoMicrofono } from './Iconos'
import { GUIA_ALTA } from './textos'

/** El alta pide más que la nota de una comida (90 s): 3 minutos (§5.2). */
export const MAX_SEGUNDOS_ALTA = 180
const MINIMO_RELATO = 15
/** Pista para Whisper: nombres de alimentos y palabras que en el alta aparecen seguido (§5.2). */
const PISTA_ALTA = 'Milanesa, papas fritas, puré, fideos, tostadas, galletitas de agua, chocolatada, yogur, banana, arroz, ' +
  'pollo, huevo, maní, gluten, caseína, alérgico, suplementos, arcadas, nutricionista.'

const reloj = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

interface Props {
  texto: string
  setTexto: (t: string | ((previo: string) => string)) => void
  alSeguir: () => void
  alVolver: () => void
}

export function PasoRelato({ texto, setTexto, alSeguir, alVolver }: Props) {
  const id = useId()
  const [transcribiendo, setTranscribiendo] = useState(false)
  const [error, setError] = useState<ErrorDeApi | null>(null)
  const [aviso, setAviso] = useState('')
  const [faltaTexto, setFaltaTexto] = useState(false)
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
      const r = await api.transcribir({ audioBase64: audio.base64, mime: audio.mime, pista: PISTA_ALTA }, c.signal)
      if (c.signal.aborted) return
      setTexto((previo) => sumarNota(previo, r.texto.trim()))
      setFaltaTexto(false)
      setAviso('Listo. Revisá el texto y corregí lo que haga falta.')
      refTexto.current?.focus()
    } catch (e) {
      if (!c.signal.aborted) setError(aErrorDeApi(e))
    } finally {
      if (!c.signal.aborted) setTranscribiendo(false)
    }
  }

  const g = useGrabador((audio) => { void transcribir(audio) }, { maxSegundos: MAX_SEGUNDOS_ALTA })
  const grabando = g.estado === 'grabando'
  const sinMicrofono = g.estado === 'sin_permiso' || g.estado === 'no_soportado'
  const noEntendido = error?.codigo === 'audio_no_entendido'
  const hayTexto = texto.trim().length > 0

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
      <section className="pf-guia" data-grabando={grabando || undefined} aria-labelledby={`${id}-guia`}>
        <h2 id={`${id}-guia`} className="pf-guia-titulo">Lo que nos sirve saber</h2>
        <p className="pf-ayuda">En el orden que te salga. Lo que no cuentes te lo preguntamos después.</p>
        <ul className="pf-guia-lista">
          {GUIA_ALTA.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </section>

      {!sinMicrofono && (
        <section className="pf-voz" aria-label="Audio">
          {grabando ? (
            <>
              <p className="pf-grabando" role="status">
                <span className="pf-punto-rojo" aria-hidden="true" /> Escuchando…
                <span className="pf-reloj nb-numero" aria-hidden="true">{reloj(g.segundos)} / {reloj(g.maxSegundos)}</span>
              </p>
              <div className="pf-tiempo" aria-hidden="true">
                <span style={{ transform: `scaleX(${Math.min(1, g.segundos / g.maxSegundos)})` }} />
              </div>
              <div className="pf-botones">
                <button type="button" className="nb-boton" onClick={g.detener}>Listo, terminé</button>
                <button type="button" className="nb-boton nb-boton-secundario" onClick={g.cancelar}>Cancelar</button>
              </div>
            </>
          ) : transcribiendo ? (
            <Cargando texto="Pasando tu audio a texto…" />
          ) : g.estado === 'pidiendo' ? (
            <Cargando texto="Pidiendo permiso para usar el micrófono…" />
          ) : (
            <>
              <button type="button" className="nb-boton pf-boton-voz" onClick={() => void g.iniciar()}>
                <IconoMicrofono /> {hayTexto || noEntendido ? 'Grabar otro audio' : 'Contalo con tu voz'}
              </button>
              <p className="pf-ayuda">
                Hasta {MAX_SEGUNDOS_ALTA / 60} minutos. {hayTexto ? 'Lo que grabes se suma al texto.' : 'Después podés corregir el texto.'}
              </p>
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
        <p className="pf-aviso-suave" role="alert">No llegamos a entender el audio. ¿Lo grabás de nuevo o lo escribís acá abajo?</p>
      )}
      {error && !noEntendido && (
        <ErrorConReintento error={error} reintentar={ultimoAudio.current ? () => void transcribir(ultimoAudio.current!) : undefined} />
      )}
      <p className="pf-oculto" role="status">{aviso}</p>

      <div className="pf-campo">
        <label htmlFor={`${id}-texto`}>{sinMicrofono ? 'Contanos de tu hijo' : hayTexto ? 'Lo que contaste' : 'O escribilo acá'}</label>
        <p id={`${id}-ayuda`} className="pf-ayuda">También funciona el dictado del teclado.</p>
        <textarea
          ref={refTexto} id={`${id}-texto`} className="pf-input pf-textarea" rows={8} value={texto}
          onChange={(e) => { setTexto(e.target.value); if (faltaTexto) setFaltaTexto(false) }}
          aria-describedby={`${id}-ayuda${faltaTexto ? ` ${id}-error` : ''}`} aria-invalid={faltaTexto || undefined}
          placeholder="Por ejemplo: Se llama Ana, tiene 7 años. Come fideos con manteca…"
        />
        {faltaTexto && <p id={`${id}-error`} className="pf-error">Contanos un poco más para poder armar su perfil.</p>}
      </div>

      <div className="pf-botones">
        <button type="button" className="nb-boton" onClick={seguir} disabled={transcribiendo || grabando}>
          Ver qué entendimos
        </button>
        <button type="button" className="nb-boton nb-boton-secundario" onClick={alVolver} disabled={grabando}>Volver</button>
      </div>
    </div>
  )
}
