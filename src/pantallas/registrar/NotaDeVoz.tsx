// "Contame cómo le fue" (C5): nota de voz → /api/relato-comida → la IA pre-marca los botones.
// Sin micrófono (o si el padre prefiere), un campo de texto que va al mismo endpoint.
// Es la protagonista del paso: un micrófono grande que, mientras graba, late con anillos (quietos con movimiento
// reducido), el tiempo que queda y, al terminar, lo que entendimos.
import { cn } from 'cn'
import { CircleCheck, Keyboard, Mic, MicOff, Quote, Square } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import type { AnalisisComida, RelatoComida, RelatoComidaReq } from '../../../shared/contratos'
import { Bocaditos, ErrorConReintento } from '../../componentes/Estados'
import { Button } from '../../componentes/ui/button'
import { Textarea } from '../../componentes/ui/textarea'
import { api, type ErrorDeApi } from '../../lib/api'
import { MAX_SEGUNDOS, useGrabador, type Audio } from '../../lib/grabador'
import { aErrorDeApi } from '../../lib/useApi'
import { Aviso } from './Piezas'

type Fase = 'inicio' | 'escuchando' | 'listo' | 'no_entendido' | 'error'

interface Props {
  ninoId: string
  analisis: AnalisisComida               // ya corregido por el padre
  alRelato: (relato: RelatoComida, fuente: 'voz' | 'texto') => void
  transcripcion?: string                 // la del último relato aplicado
}

/** Tres anillos que salen del micrófono mientras graba. Con movimiento reducido quedan quietos. */
function Anillos() {
  const reducir = useReducedMotion()
  return (
    <span aria-hidden="true" className="absolute inset-0">
      {[0, 1, 2].map((i) =>
        reducir ? (
          <span
            key={i}
            className="absolute inset-0 rounded-full border-2 border-verde/35"
            style={{ transform: `scale(${1.16 + i * 0.16})` }}
          />
        ) : (
          <motion.span
            key={i}
            className="absolute inset-0 rounded-full bg-verde/30"
            initial={{ scale: 1, opacity: 0.6 }}
            animate={{ scale: 1.7, opacity: 0 }}
            transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.8, ease: 'easeOut' }}
          />
        ),
      )}
    </span>
  )
}

/** El botón redondo: micrófono para empezar, cuadrado para terminar. El texto de abajo es parte del botón. */
function BotonMicro({ grabando = false, onClick, disabled, describedBy, children }: {
  grabando?: boolean
  onClick: () => void
  disabled?: boolean
  describedBy?: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-describedby={describedBy}
      className="group flex flex-col items-center gap-3 rounded-3xl px-4 pt-2 pb-1 outline-none select-none focus-visible:ring-3 focus-visible:ring-verde disabled:opacity-60"
    >
      <span className="relative grid size-24 place-items-center">
        {grabando && <Anillos />}
        <span className="relative grid size-24 place-items-center rounded-full bg-primary text-primary-foreground shadow-flotante transition-[background-color,scale] duration-150 group-hover:bg-verde-noche group-active:scale-95 motion-reduce:group-active:scale-100">
          {grabando
            ? <Square className="size-8 fill-current" aria-hidden="true" />
            : <Mic className="size-10" strokeWidth={2.25} aria-hidden="true" />}
        </span>
      </span>
      <span className="font-titulo text-xl font-extrabold text-pino">{children}</span>
    </button>
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
  const listo = fase === 'listo'
  // El micrófono grande va al centro; con lo que entendimos (o sin micrófono) se lee de izquierda a derecha.
  const centrado = grabando || fase === 'escuchando' || (fase === 'inicio' && !sinMicro && !mostrarTexto)

  return (
    <section
      aria-label="Nota de voz"
      className={cn(
        'flex flex-col gap-4 rounded-3xl bg-brote px-5 py-6 mordisco [--mordisco:26px]',
        centrado ? 'items-center text-center' : 'items-stretch',
      )}
    >
      {grabando ? (
        <>
          <BotonMicro grabando onClick={grabador.detener}>Listo, terminé</BotonMicro>
          <p className="font-titulo text-5xl font-extrabold text-pino tabular-nums" role="timer" aria-label={`Quedan ${restantes} segundos`}>
            {Math.floor(restantes / 60)}:{String(restantes % 60).padStart(2, '0')}
          </p>
          <div
            className="h-2 w-full max-w-64 overflow-hidden rounded-full bg-background"
            role="progressbar"
            aria-label="Tiempo de grabación"
            aria-valuemin={0}
            aria-valuemax={MAX_SEGUNDOS}
            aria-valuenow={grabador.segundos}
          >
            <span
              className="block h-full origin-left rounded-full bg-verde transition-transform duration-300 ease-linear"
              style={{ transform: `scaleX(${Math.min(1, grabador.segundos / MAX_SEGUNDOS)})` }}
            />
          </div>
          <p className="font-bold text-balance text-pino" role="status">
            <span className="mr-2 inline-block size-2.5 animate-pulse rounded-full bg-verde align-[0.08em] motion-reduce:animate-none" aria-hidden="true" />
            Grabando. Contá qué hizo con cada cosa del plato.
          </p>
          <Button variant="ghost" className="text-musgo" onClick={grabador.cancelar}>Cancelar</Button>
        </>
      ) : fase === 'escuchando' ? (
        <div className="flex flex-col items-center gap-3 py-2" role="status" aria-live="polite">
          <span className="grid size-24 place-items-center rounded-full bg-background" aria-hidden="true">
            <Bocaditos />
          </span>
          <p className="font-bold text-pino">
            {ultimo.current?.fuente === 'texto' ? 'Leyendo lo que contaste…' : 'Escuchando tu nota…'}
          </p>
        </div>
      ) : (
        <>
          {listo && (
            <p className="flex items-start gap-2.5 font-bold text-pino" role="status">
              <CircleCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
              Listo: marcamos lo que contaste. Revisalo abajo.
            </p>
          )}
          {transcripcion && listo && (
            <figure className="m-0 flex flex-col gap-1.5 rounded-2xl bg-background p-4">
              <figcaption className="flex items-center gap-1.5 text-sm font-bold text-musgo">
                <Quote className="size-4" aria-hidden="true" /> Lo que entendimos
              </figcaption>
              <blockquote className="text-pino italic">{transcripcion}</blockquote>
            </figure>
          )}

          {fase === 'no_entendido' && (
            <Aviso icono={MicOff}>
              <p>No llegamos a entender la nota. Puede pasar con ruido de fondo o si quedó muy cortita.</p>
              <p className="text-sm text-musgo">Podés grabarla de nuevo, escribirlo o marcar los botones de abajo.</p>
            </Aviso>
          )}
          {fase === 'error' && error && (
            <ErrorConReintento error={error} reintentar={() => ultimo.current && void enviar(ultimo.current.req, ultimo.current.fuente)} />
          )}

          {!sinMicro && (listo || fase === 'no_entendido' ? (
            <Button
              variant="outline"
              size="lg"
              className="self-start bg-background"
              onClick={grabador.iniciar}
              disabled={grabador.estado === 'pidiendo'}
              aria-describedby={`${id}-ayuda`}
            >
              <Mic aria-hidden="true" /> Grabar otra nota
            </Button>
          ) : (
            <BotonMicro onClick={grabador.iniciar} disabled={grabador.estado === 'pidiendo'} describedBy={`${id}-ayuda`}>
              Contame cómo le fue
            </BotonMicro>
          ))}
          {!sinMicro && (
            <p id={`${id}-ayuda`} className={cn('text-sm text-musgo', centrado && 'max-w-72')}>
              {grabador.estado === 'pidiendo'
                ? 'Pidiendo permiso para usar el micrófono…'
                : `Hasta ${MAX_SEGUNDOS} segundos. Ej.: «el puré lo dejó, la milanesa la probó».`}
            </p>
          )}

          {sinMicro && (
            <p className="flex items-start gap-2.5 text-pino" role="status">
              <MicOff className="mt-0.5 size-5 shrink-0 text-musgo" aria-hidden="true" />
              {grabador.estado === 'sin_permiso'
                ? 'No tenemos permiso para usar el micrófono. Podés contarlo por escrito, o marcar los botones de abajo.'
                : 'Este navegador no deja grabar audio. Podés contarlo por escrito, o marcar los botones de abajo.'}
            </p>
          )}

          {mostrarTexto ? (
            <form
              className="flex flex-col gap-2 text-left"
              onSubmit={(e) => {
                e.preventDefault()
                if (texto.trim()) void enviar({ ninoId, analisis, texto: texto.trim() }, 'texto')
              }}
            >
              <label htmlFor={`${id}-texto`} className="font-bold text-pino">Contalo con tus palabras</label>
              <p id={`${id}-texto-ayuda`} className="text-sm text-musgo">Podés dictarlo con el teclado: tocá el micrófono del teclado del celular.</p>
              <Textarea
                id={`${id}-texto`}
                ref={textoRef}
                className="min-h-28 bg-background text-base leading-normal"
                rows={4}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                aria-describedby={`${id}-texto-ayuda`}
                placeholder="El puré ni lo tocó, la milanesa se comió la mitad…"
              />
              <Button type="submit" className="self-start" disabled={!texto.trim()}>
                Marcar con lo que conté
              </Button>
            </form>
          ) : (
            <Button variant="ghost" className={cn('text-primary', !centrado && 'self-start')} onClick={escribir}>
              <Keyboard aria-hidden="true" /> Prefiero escribirlo
            </Button>
          )}
        </>
      )}
    </section>
  )
}
