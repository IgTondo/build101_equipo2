// "Contame cómo le fue" (C5): nota de voz → /api/relato-comida → la IA pre-marca los botones.
// Sin micrófono (o si el padre prefiere), un campo de texto que va al mismo endpoint.
import { useEffect, useId, useRef, useState } from 'react'
import type { AnalisisComida, RelatoComida, RelatoComidaReq } from '../../../shared/contratos'
import { Cargando, ErrorConReintento } from '../../componentes/Estados'
import { api, type ErrorDeApi } from '../../lib/api'
import { MAX_SEGUNDOS, useGrabador, type Audio } from '../../lib/grabador'
import { aErrorDeApi } from '../../lib/useApi'

type Fase = 'inicio' | 'escuchando' | 'listo' | 'no_entendido' | 'error'

interface Props {
  ninoId: string
  analisis: AnalisisComida               // ya corregido por el padre
  alRelato: (relato: RelatoComida, fuente: 'voz' | 'texto') => void
  transcripcion?: string                 // la del último relato aplicado
}

function IconoMicro() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" focusable="false">
      <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function NotaDeVoz({ ninoId, analisis, alRelato, transcripcion }: Props) {
  const id = useId()
  const [fase, setFase] = useState<Fase>('inicio')
  const [error, setError] = useState<ErrorDeApi | null>(null)
  const [conTexto, setConTexto] = useState(false)
  const [texto, setTexto] = useState('')
  const ultimo = useRef<{ req: RelatoComidaReq; fuente: 'voz' | 'texto' } | null>(null)
  const control = useRef<AbortController | null>(null)
  const textoRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => () => control.current?.abort(), [])

  async function enviar(req: RelatoComidaReq, fuente: 'voz' | 'texto') {
    control.current?.abort()
    const c = new AbortController()
    control.current = c
    ultimo.current = { req, fuente }
    setFase('escuchando')
    setError(null)
    try {
      const relato = await api.relatoComida(req, c.signal)
      if (c.signal.aborted) return
      if (!relato.transcripcion.trim() && relato.respuestas.length === 0) { setFase('no_entendido'); return }
      alRelato(relato, fuente)
      setFase('listo')
      if (fuente === 'texto') setConTexto(false)
    } catch (e) {
      if (c.signal.aborted) return
      const err = aErrorDeApi(e)
      setError(err)
      setFase(err.codigo === 'audio_no_entendido' ? 'no_entendido' : 'error')
    }
  }

  const grabador = useGrabador((audio: Audio) => {
    void enviar({ ninoId, analisis, audioBase64: audio.base64, mime: audio.mime }, 'voz')
  })
  const sinMicro = grabador.estado === 'sin_permiso' || grabador.estado === 'no_soportado'
  const mostrarTexto = conTexto || sinMicro

  // Al elegir "Prefiero escribirlo", el foco va al campo (no cuando aparece solo por falta de micrófono).
  useEffect(() => { if (conTexto) textoRef.current?.focus() }, [conTexto])
  const escribir = () => setConTexto(true)

  const grabando = grabador.estado === 'grabando'
  const restantes = Math.max(0, grabador.restantes)

  return (
    <section className="nb-tarjeta rg-voz" aria-label="Nota de voz">

      {grabando ? (
        <div className="rg-grabando">
          <p className="rg-grabando-estado" role="status">
            <span className="rg-punto-grabando" aria-hidden="true" /> Grabando. Contá qué hizo con cada cosa del plato.
          </p>
          <p className="rg-contador nb-numero" role="timer" aria-label={`Quedan ${restantes} segundos`}>
            {Math.floor(restantes / 60)}:{String(restantes % 60).padStart(2, '0')}
          </p>
          <div
            className="rg-barra-tiempo"
            role="progressbar"
            aria-label="Tiempo de grabación"
            aria-valuemin={0}
            aria-valuemax={MAX_SEGUNDOS}
            aria-valuenow={grabador.segundos}
          >
            <span style={{ transform: `scaleX(${Math.min(1, grabador.segundos / MAX_SEGUNDOS)})` }} />
          </div>
          <div className="rg-fila-botones">
            <button type="button" className="nb-boton" onClick={grabador.detener}>Listo, terminé</button>
            <button type="button" className="nb-boton nb-boton-secundario" onClick={grabador.cancelar}>Cancelar</button>
          </div>
        </div>
      ) : fase === 'escuchando' ? (
        <Cargando texto={ultimo.current?.fuente === 'texto' ? 'Leyendo lo que contaste…' : 'Escuchando tu nota…'} />
      ) : (
        <>
          {!sinMicro && (
            <>
              <button
                type="button"
                className="nb-boton rg-boton-voz"
                onClick={grabador.iniciar}
                disabled={grabador.estado === 'pidiendo'}
                aria-describedby={`${id}-ayuda`}
              >
                <IconoMicro />
                {fase === 'listo' || fase === 'no_entendido' ? 'Grabar otra nota' : 'Contame cómo le fue'}
              </button>
              <p id={`${id}-ayuda`} className="rg-pista">
                {grabador.estado === 'pidiendo'
                  ? 'Pidiendo permiso para usar el micrófono…'
                  : `Hasta ${MAX_SEGUNDOS} segundos. Ej.: «el puré lo dejó, la milanesa la probó».`}
              </p>
            </>
          )}

          {sinMicro && (
            <p className="rg-pista" role="status">
              {grabador.estado === 'sin_permiso'
                ? 'No tenemos permiso para usar el micrófono. Podés contarlo por escrito, o marcar los botones de abajo.'
                : 'Este navegador no deja grabar audio. Podés contarlo por escrito, o marcar los botones de abajo.'}
            </p>
          )}

          {fase === 'no_entendido' && (
            <div className="nb-tarjeta nb-aviso" role="alert">
              <p>No llegamos a entender la nota. Puede pasar con ruido de fondo o si quedó muy cortita.</p>
              <p className="nb-suave">Podés grabarla de nuevo, escribirlo o marcar los botones de abajo.</p>
            </div>
          )}
          {fase === 'error' && error && (
            <ErrorConReintento error={error} reintentar={() => ultimo.current && void enviar(ultimo.current.req, ultimo.current.fuente)} />
          )}

          {mostrarTexto ? (
            <form
              className="rg-texto"
              onSubmit={(e) => {
                e.preventDefault()
                if (texto.trim()) void enviar({ ninoId, analisis, texto: texto.trim() }, 'texto')
              }}
            >
              <label htmlFor={`${id}-texto`}>Contalo con tus palabras</label>
              <p id={`${id}-texto-ayuda`} className="rg-pista">Podés dictarlo con el teclado: tocá el micrófono del teclado del celular.</p>
              <textarea
                id={`${id}-texto`}
                ref={textoRef}
                className="rg-input rg-textarea"
                rows={4}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                aria-describedby={`${id}-texto-ayuda`}
                placeholder="El puré ni lo tocó, la milanesa se comió la mitad…"
              />
              <button type="submit" className="nb-boton nb-boton-secundario" disabled={!texto.trim()}>
                Marcar con lo que conté
              </button>
            </form>
          ) : (
            <button type="button" className="rg-boton-texto" onClick={escribir}>Prefiero escribirlo</button>
          )}

          {fase === 'listo' && (
            <p className="rg-listo" role="status">
              Listo: marcamos lo que contaste. Revisalo abajo.
            </p>
          )}
          {transcripcion && fase === 'listo' && (
            <details className="rg-transcripcion">
              <summary>Lo que entendimos</summary>
              <p>{transcripcion}</p>
            </details>
          )}
        </>
      )}
    </section>
  )
}
