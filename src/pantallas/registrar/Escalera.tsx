// Los botones de "¿cómo le fue?" (§5.1): la escalera por ítem, el motivo opcional, la conducta y las preguntas de la IA.
// Lo que marcó la IA con la nota lleva el micrófono y muestra la cita; el padre siempre puede corregir.
// La escalera se dibuja como escalones de verdad (de "lo apartó" a "comió todo"): el alimento salta al elegido.
// Los escalones son todos del mismo tono: cada paso cuenta, ninguno es "mejor" por color.
import { cn } from 'cn'
import { Check, Mic, MicOff } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useId } from 'react'
import {
  CONDUCTA, CUANTO, MOTIVO, type Conducta, type Cuanto, type Grupo, type Motivo, type Pregunta,
} from '../../../shared/contratos'
import { IconoAlimento } from '../../componentes/IconoAlimento'
import { BOTON_CUANTO, CHIP_CONDUCTA, ESCALON, NIVEL_CUANTO, NOMBRE_MOTIVO } from '../../lib/vocabulario'
import { CON_MOTIVO, esDeIA, type ItemEdit, type RespuestaEdit } from './modelo'
import { CHIP, MarcaNota } from './Piezas'

const mayuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** De abajo hacia arriba: lo apartó → comió todo. */
const SUBIDA = [...CUANTO].sort((a, b) => NIVEL_CUANTO[a] - NIVEL_CUANTO[b])
const ALTO_ESCALON = (nivel: number) => 14 + nivel * 11

/** Una línea de aliento según el escalón: cada paso cuenta, nunca se premia "comer todo". */
function aliento(c: Cuanto): string | null {
  if (c === 'nada') return 'Que esté en el plato ya es un avance.'
  if (c === 'toco' || c === 'probo') return `${mayuscula(ESCALON[c])}: cada paso cuenta.`
  if (c === 'aparto') return 'Está bien, queda anotado. Se puede volver a ofrecer otro día, sin presión.'
  return null
}

interface EscaleraProps {
  item: ItemEdit
  grupo?: Grupo
  respuesta?: RespuestaEdit
  sinMencion: boolean
  alCuanto: (c: Cuanto) => void
  alMotivo: (m: Motivo | undefined) => void
}

export function EscaleraItem({ item, grupo, respuesta, sinMencion, alCuanto, alMotivo }: EscaleraProps) {
  const id = useId()
  const deIA = esDeIA(respuesta)
  const cuanto = respuesta?.cuanto
  const verMotivo = !!cuanto && (CON_MOTIVO.includes(cuanto) || !!respuesta?.motivo)
  const frase = cuanto ? aliento(cuanto) : null
  const ayudaId = `${id}-ayuda`

  return (
    <div className="rounded-2xl border bg-card p-4">
      <fieldset className="flex min-w-0 flex-col gap-3" aria-describedby={ayudaId}>
        <legend className="mb-3 flex items-center gap-3">
          <IconoAlimento nombre={item.preparacion} grupo={grupo} tamano="md" />
          <span className="font-titulo text-xl leading-tight font-extrabold first-letter:uppercase">{item.preparacion}</span>
        </legend>
        <div id={ayudaId} className="empty:hidden">
          {deIA && respuesta?.ia?.cita && (
            <p className="flex flex-col gap-1.5 rounded-2xl rounded-tl-md bg-brote px-3.5 py-3 text-pino">
              <MarcaNota />
              <span>Dijiste: «{respuesta.ia.cita}»</span>
            </p>
          )}
          {!cuanto && sinMencion && (
            <p className="flex items-center gap-2 text-sm text-musgo">
              <MicOff className="size-4 shrink-0" aria-hidden="true" />
              No lo nombraste en la nota: marcalo vos.
            </p>
          )}
        </div>

        <div className="-mx-1.5 grid grid-cols-7 gap-0.5">
          {SUBIDA.map((c) => {
            const activo = cuanto === c
            return (
              <label
                key={c}
                className="group relative flex cursor-pointer flex-col items-center gap-2 rounded-xl px-px pb-1 select-none has-focus-visible:outline-3 has-focus-visible:outline-verde"
              >
                <input type="radio" className="sr-only" name={`${id}-cuanto`} value={c} checked={activo} onChange={() => alCuanto(c)} />
                <span className="flex h-[118px] w-full flex-col items-center justify-end gap-1" aria-hidden="true">
                  {activo && (
                    <motion.span
                      layoutId={`${id}-bocado`}
                      className="relative"
                      transition={{ type: 'spring', stiffness: 480, damping: 26 }}
                    >
                      <IconoAlimento nombre={item.preparacion} grupo={grupo} tamano="sm" className="ring-2 ring-background" />
                      {deIA && (
                        <span className="absolute -right-1.5 -bottom-1 grid size-[18px] place-items-center rounded-full bg-primary text-primary-foreground ring-2 ring-background">
                          <Mic className="size-2.5" strokeWidth={3} />
                        </span>
                      )}
                    </motion.span>
                  )}
                  <span
                    className={cn(
                      'w-full rounded-t-[7px] rounded-b-[3px] transition-colors duration-200',
                      activo ? 'bg-primary' : 'bg-input group-hover:bg-hoja',
                    )}
                    style={{ height: ALTO_ESCALON(NIVEL_CUANTO[c]) }}
                  />
                </span>
                <span className={cn('text-center text-xs leading-[1.15] text-balance', activo ? 'font-bold text-pino' : 'text-musgo')}>
                  {BOTON_CUANTO[c]}
                </span>
              </label>
            )
          })}
        </div>

        <div aria-live="polite" className="empty:hidden">
          {frase && <p key={frase} className="text-sm font-bold text-primary animate-in fade-in-0 duration-300 motion-reduce:animate-none">{frase}</p>}
        </div>

        <AnimatePresence initial={false}>
          {verMotivo && (
            <motion.div
              key="motivo"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="-mx-1 overflow-hidden px-1"
            >
              <div className="flex flex-col gap-2 pt-1 pb-1" role="group" aria-labelledby={`${id}-motivo`}>
                <p id={`${id}-motivo`} className="text-sm font-bold text-pino">
                  ¿Te parece que fue por algo? <span className="font-normal text-musgo">(opcional)</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {MOTIVO.map((m) => (
                    <button
                      key={m}
                      type="button"
                      className={cn(CHIP, 'text-sm focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-verde')}
                      aria-pressed={respuesta?.motivo === m}
                      onClick={() => alMotivo(respuesta?.motivo === m ? undefined : m)}
                    >
                      {mayuscula(NOMBRE_MOTIVO[m])}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </fieldset>
    </div>
  )
}

/** El ícono adentro de un chip marcado: el micrófono si salió de la nota, un tilde si lo marcó el padre. */
function MarcaChip({ deNota }: { deNota: boolean }) {
  const Icono = deNota ? Mic : Check
  return <Icono className="-ml-1 size-4 shrink-0" strokeWidth={2.5} aria-hidden="true" />
}

export function ChipsConducta({ marcadas, deIA, alCambiar }: {
  marcadas: Conducta[]
  deIA: Conducta[]
  alCambiar: (c: Conducta[]) => void
}) {
  const id = useId()
  return (
    <div className="rounded-2xl border bg-card p-4">
      <fieldset className="flex min-w-0 flex-col gap-3">
        <legend className="mb-1 font-titulo text-xl font-extrabold">¿Cómo estuvo en la mesa?</legend>
        <p className="-mt-1 text-sm text-musgo">Podés marcar varias, o ninguna.</p>
        <div className="flex flex-wrap gap-2">
          {CONDUCTA.map((c) => {
            const on = marcadas.includes(c)
            return (
              <label key={c} className={CHIP}>
                <input
                  type="checkbox"
                  className="sr-only"
                  name={`${id}-conducta`}
                  checked={on}
                  onChange={() => alCambiar(on ? marcadas.filter((x) => x !== c) : [...marcadas, c])}
                />
                {on && <MarcaChip deNota={deIA.includes(c)} />}
                <span>{CHIP_CONDUCTA[c]}</span>
              </label>
            )
          })}
        </div>
        {deIA.length > 0 && (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-musgo">
            <MarcaNota className="bg-brote" /> lo que tiene el micrófono salió de lo que contaste.
          </p>
        )}
      </fieldset>
    </div>
  )
}

export function PreguntaIA({ pregunta, respuesta, deIA, alResponder }: {
  pregunta: Pregunta
  respuesta?: string
  deIA: boolean
  alResponder: (r: string) => void
}) {
  const id = useId()
  return (
    <fieldset className="flex min-w-0 flex-col">
      <legend className="mb-2 font-bold text-pino">{pregunta.texto}</legend>
      <div className="flex flex-wrap gap-2">
        {pregunta.opciones.map((o) => {
          const elegida = respuesta === o
          return (
            <label key={o} className={CHIP}>
              <input type="radio" className="sr-only" name={`${id}-pregunta`} value={o} checked={elegida} onChange={() => alResponder(o)} />
              {elegida && deIA && <MarcaChip deNota />}
              <span>{o}</span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
