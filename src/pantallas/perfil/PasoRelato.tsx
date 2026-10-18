// Alta por voz (§5.2) · "Contanos de tu hijo": un solo audio de hasta 3 minutos con la guía de lo vital a la vista
// (useGrabador → /api/transcribir → texto editable). Sin micrófono queda el campo de texto, donde también funciona
// el dictado del teclado (§13).
// Es la protagonista del alta: un micrófono grande que, mientras graba, late con anillos (quietos con movimiento
// reducido) y muestra el tiempo que lleva; debajo, la guía como un globo de recordatorios, no como un formulario.
import { cn } from 'cn'
import { CircleCheck, Mic, MicOff, Square } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Bocaditos, ErrorConReintento } from '../../componentes/Estados'
import { Button } from '../../componentes/ui/button'
import { Textarea } from '../../componentes/ui/textarea'
import { api, type ErrorDeApi } from '../../lib/api'
import { useGrabador, type Audio } from '../../lib/grabador'
import { aErrorDeApi } from '../../lib/useApi'
import { sumarNota } from './borrador'
import { Aviso, Falta, ICONO } from './Piezas'
import { GUIA_ALTA } from './textos'

/** El alta pide más que la nota de una comida (90 s): 3 minutos (§5.2). */
export const MAX_SEGUNDOS_ALTA = 180
const MINIMO_RELATO = 15
/** Pista para Whisper: nombres de alimentos y palabras que en el alta aparecen seguido (§5.2). */
const PISTA_ALTA = 'Milanesa, papas fritas, puré, fideos, tostadas, galletitas de agua, chocolatada, yogur, banana, arroz, ' +
  'pollo, huevo, maní, gluten, caseína, alérgico, suplementos, arcadas, nutricionista.'

const reloj = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

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
            style={{ transform: `scale(${1.14 + i * 0.14})` }}
          />
        ) : (
          <motion.span
            key={i}
            className="absolute inset-0 rounded-full bg-verde/30"
            initial={{ scale: 1, opacity: 0.6 }}
            animate={{ scale: 1.65, opacity: 0 }}
            transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.8, ease: 'easeOut' }}
          />
        ),
      )}
    </span>
  )
}

/** El botón redondo, sobre un plato blanco: micrófono para empezar, cuadrado para terminar. El texto es parte del botón. */
function BotonMicro({ grabando = false, onClick, disabled, describe, children }: {
  grabando?: boolean
  onClick: () => void
  disabled?: boolean
  describe?: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-describedby={describe}
      className="group flex flex-col items-center gap-3 rounded-3xl px-4 pt-1 pb-1 outline-none select-none focus-visible:ring-3 focus-visible:ring-verde disabled:opacity-60"
    >
      <span className="relative grid size-36 place-items-center rounded-full bg-background">
        <span className="relative grid size-28 place-items-center">
          {grabando && <Anillos />}
          <span className="relative grid size-28 place-items-center rounded-full bg-primary text-primary-foreground shadow-flotante transition-[background-color,scale] duration-150 group-hover:bg-verde-noche group-active:scale-95 motion-reduce:group-active:scale-100">
            {grabando
              ? <Square className="size-9 fill-current" aria-hidden="true" />
              : <Mic className="size-12" strokeWidth={2.25} aria-hidden="true" />}
          </span>
        </span>
      </span>
      <span className="font-titulo text-2xl font-extrabold text-pino">{children}</span>
    </button>
  )
}

/**
 * Lo que nos sirve saber, como un globo que sale del micrófono: sobre el chico, recordatorios cortos; sobre la comida,
 * cada tema con su ejemplo y el mismo ícono que tiene después en "Esto entendimos". `suelta`: sin micrófono, sin globo.
 */
function Guia({ id, suelta = false }: { id: string; suelta?: boolean }) {
  const comida = GUIA_ALTA.comida
  return (
    <section
      aria-labelledby={id}
      className={cn(
        'relative flex w-full flex-col gap-3 rounded-2xl bg-background p-4 text-left',
        suelta
          ? 'border'
          : 'mt-1 before:absolute before:-top-1.5 before:left-1/2 before:size-4 before:-translate-x-1/2 before:rotate-45 before:rounded-[3px] before:bg-background',
      )}
    >
      <div className="flex flex-col">
        <h2 id={id} className="text-lg">Lo que nos sirve saber</h2>
        <p className="text-sm text-musgo">En cualquier orden.</p>
      </div>
      <ul className="flex flex-wrap gap-1.5">
        {GUIA_ALTA.chico.map((t) => (
          <li key={t} className="rounded-full bg-brote px-3 py-1 text-sm text-pino">{t}</li>
        ))}
      </ul>
      <ul className="flex flex-col gap-3 border-t pt-3.5">
        {(['acepta', 'rechaza', 'reglas'] as const).map((k) => {
          const Icono = ICONO[k]
          return (
            <li key={k} className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brote text-verde-hondo" aria-hidden="true">
                <Icono className="size-[1.15rem]" strokeWidth={2.25} />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="font-bold text-pino">{comida[k].tema}</span>
                <span className="text-sm text-musgo text-pretty">{comida[k].ejemplo}</span>
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

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
  const pidiendo = g.estado === 'pidiendo'
  const sinMicrofono = g.estado === 'sin_permiso' || g.estado === 'no_soportado'
  const noEntendido = error?.codigo === 'audio_no_entendido'
  const hayTexto = texto.trim().length > 0
  // Con texto (o si no se entendió el audio), el micrófono grande deja lugar al texto: queda "Grabar otro audio".
  const otroAudio = hayTexto || noEntendido
  const ayuda = pidiendo
    ? 'Pidiendo permiso para usar el micrófono…'
    : `Hasta ${MAX_SEGUNDOS_ALTA / 60} minutos.${hayTexto ? ' Lo que grabes se suma al texto.' : ''}`

  const seguir = () => {
    if (texto.trim().length < MINIMO_RELATO) {
      setFaltaTexto(true)
      refTexto.current?.focus()
      return
    }
    alSeguir()
  }

  return (
    <div className="flex flex-col gap-5">
      {sinMicrofono ? (
        <>
          <Aviso icono={MicOff} rol="status">
            <p>No pudimos usar el micrófono. Escribilo acá abajo; si querés, tocá el micrófono del teclado para dictarlo.</p>
          </Aviso>
          <Guia id={`${id}-guia`} suelta />
        </>
      ) : (
        <section
          aria-label="Audio"
          className="mordisco flex flex-col items-center gap-4 rounded-3xl bg-brote px-4 pt-6 pb-4 text-center [--mordisco:26px]"
        >
          {grabando ? (
            <>
              <BotonMicro grabando onClick={g.detener}>Listo, terminé</BotonMicro>
              <p className="-mt-1 flex items-baseline gap-2 text-pino" aria-hidden="true">
                <span className="font-titulo text-5xl font-extrabold tabular-nums">{reloj(g.segundos)}</span>
                <span className="text-musgo tabular-nums">de {reloj(g.maxSegundos)}</span>
              </p>
              <div
                className="h-2 w-full max-w-64 overflow-hidden rounded-full bg-background"
                role="progressbar"
                aria-label="Tiempo de grabación"
                aria-valuemin={0}
                aria-valuemax={g.maxSegundos}
                aria-valuenow={g.segundos}
                aria-valuetext={`${reloj(g.segundos)} de ${reloj(g.maxSegundos)}`}
              >
                <span
                  className="block h-full origin-left rounded-full bg-verde transition-transform duration-300 ease-linear motion-reduce:transition-none"
                  style={{ transform: `scaleX(${Math.min(1, g.segundos / g.maxSegundos)})` }}
                />
              </div>
              <p className="font-bold text-pino" role="status">
                <span className="mr-2 inline-block size-2.5 animate-pulse rounded-full bg-verde align-[0.08em] motion-reduce:animate-none" aria-hidden="true" />
                Escuchando…
              </p>
              <Button variant="ghost" className="-my-2 text-musgo" onClick={g.cancelar}>Cancelar</Button>
            </>
          ) : transcribiendo ? (
            <div className="flex flex-col items-center gap-3 py-2">
              <span className="grid size-36 place-items-center rounded-full bg-background" aria-hidden="true">
                <Bocaditos />
              </span>
              <p className="font-titulo text-xl font-extrabold text-pino" role="status" aria-live="polite">Pasando tu audio a texto…</p>
            </div>
          ) : otroAudio ? (
            <div className="flex w-full flex-col items-center gap-2.5 pt-1">
              {aviso && (
                <p className="flex items-start gap-2.5 self-stretch px-1 text-left font-bold text-pino" aria-hidden="true">
                  <CircleCheck className="mt-0.5 size-5 shrink-0 text-primary" strokeWidth={2.25} />
                  {aviso}
                </p>
              )}
              <Button
                variant="outline" size="lg" className="bg-background" onClick={() => void g.iniciar()}
                disabled={pidiendo} aria-describedby={`${id}-ayuda`}
              >
                <Mic aria-hidden="true" /> Grabar otro audio
              </Button>
              <p id={`${id}-ayuda`} className="text-sm text-musgo" aria-live="polite">{ayuda}</p>
            </div>
          ) : (
            <>
              <BotonMicro onClick={() => void g.iniciar()} disabled={pidiendo} describe={`${id}-ayuda`}>
                Contalo con tu voz
              </BotonMicro>
              <p id={`${id}-ayuda`} className="-mt-2 text-sm text-musgo" aria-live="polite">{ayuda}</p>
            </>
          )}
          <Guia id={`${id}-guia`} />
        </section>
      )}

      {noEntendido && (
        <Aviso icono={MicOff} rol="alert">
          <p>No llegamos a entender el audio. ¿Lo grabás de nuevo o lo escribís acá abajo?</p>
        </Aviso>
      )}
      {error && !noEntendido && (
        <ErrorConReintento error={error} reintentar={ultimoAudio.current ? () => void transcribir(ultimoAudio.current!) : undefined} />
      )}
      <p className="sr-only" role="status">{aviso}</p>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${id}-texto`} className="font-titulo text-lg font-extrabold text-pino">
          {sinMicrofono ? 'Contanos de tu hijo' : hayTexto ? 'Lo que contaste' : 'O escribilo acá'}
        </label>
        <Textarea
          ref={refTexto} id={`${id}-texto`} rows={8} value={texto}
          className="min-h-44 rounded-2xl bg-background px-4 py-3.5 text-base leading-relaxed md:text-base aria-invalid:border-zapallo aria-invalid:ring-zapallo/35"
          onChange={(e) => { setTexto(e.target.value); if (faltaTexto) setFaltaTexto(false) }}
          aria-describedby={faltaTexto ? `${id}-error` : undefined} aria-invalid={faltaTexto || undefined}
          placeholder="Por ejemplo: Se llama Ana, tiene 7 años. Come fideos con manteca…"
        />
        {faltaTexto && <Falta id={`${id}-error`}>Contanos un poco más para poder armar su perfil.</Falta>}
      </div>

      <div className="flex flex-col gap-2">
        <Button size="lg" className="w-full" onClick={seguir} disabled={transcribiendo || grabando}>
          Ver qué entendimos
        </Button>
        <Button variant="ghost" className="self-center text-musgo" onClick={alVolver} disabled={grabando}>Volver</Button>
      </div>
    </div>
  )
}
