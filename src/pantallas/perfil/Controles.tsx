// Controles del formulario del perfil: campo con etiqueta y error conectados, chips de alternar (aria-pressed) y
// opciones únicas (radios: dos opciones son una fila con una pastilla que se desliza; más, chips que se marcan).
// Lo que falta se marca en Zapallo, con calma: nunca en rojo.
import { cn } from 'cn'
import { Check } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useId, type InputHTMLAttributes, type ReactNode, type Ref } from 'react'
import { Input } from '../../componentes/ui/input'
import { Falta, RESORTE } from './Piezas'

/** El campo de texto del perfil: alto para el pulgar, blanco, y con un halo Zapallo si falta algo. */
export const CLASE_INPUT = cn(
  'h-12 rounded-xl bg-background px-4 text-base md:text-base',
  'aria-invalid:border-zapallo aria-invalid:ring-[3px] aria-invalid:ring-zapallo/35',
)

/** Un chip que se marca: un botón con aria-pressed o un <label> con el radio escondido adentro. */
const CHIP = cn(
  'group relative inline-flex min-h-12 cursor-pointer items-center gap-2.5 rounded-full border border-border bg-background py-2 pr-4 pl-2.5',
  'text-left text-base text-pino transition-[background-color,border-color,color,scale] duration-150 select-none',
  'active:scale-[0.97] motion-reduce:active:scale-100',
  'aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:font-bold aria-pressed:text-primary-foreground',
  'has-checked:border-primary has-checked:bg-primary has-checked:font-bold has-checked:text-primary-foreground',
  'has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-verde',
)

/** El círculo del chip: vacío, o blanco con el tilde que aparece con un resorte al tocarlo. */
function Tilde({ activo }: { activo: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid size-6 shrink-0 place-items-center rounded-full border-2 transition-colors duration-150',
        activo ? 'border-primary-foreground bg-primary-foreground text-primary' : 'border-musgo/45 bg-background',
      )}
    >
      <AnimatePresence initial={false}>
        {activo && (
          <motion.span className="grid" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={RESORTE}>
            <Check className="size-3.5" strokeWidth={3.25} />
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  )
}

interface CampoProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'onChange'> {
  etiqueta: ReactNode
  ayuda?: ReactNode
  error?: string
  valor: string
  alCambiar: (v: string) => void
  ref?: Ref<HTMLInputElement>
  /** Debajo del campo: en "Esto entendí", la cita de lo que dijo el padre. */
  pie?: ReactNode
}

export function Campo({ etiqueta, ayuda, error, valor, alCambiar, ref, pie, className, ...resto }: CampoProps) {
  const id = useId()
  const describe = [ayuda ? `${id}-ayuda` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="font-bold text-pino">{etiqueta}</label>
      {ayuda && <p id={`${id}-ayuda`} className="-mt-0.5 text-sm text-musgo text-pretty">{ayuda}</p>}
      <Input
        ref={ref} id={id} value={valor} onChange={(e) => alCambiar(e.target.value)}
        aria-invalid={error ? true : undefined} aria-describedby={describe} className={cn(CLASE_INPUT, className)} {...resto}
      />
      {error && <Falta id={`${id}-error`}>{error}</Falta>}
      {pie}
    </div>
  )
}

interface ChipProps {
  activo: boolean
  alTocar: () => void
  children: ReactNode
  /** 'sugerida': lo mencionó el padre y espera que lo confirme tocándolo (alergias, §5.2). Borde Zapallo punteado. */
  variante?: 'sugerida'
  describe?: string
  ref?: Ref<HTMLButtonElement>
  className?: string
}

export function ChipAlternar({ activo, alTocar, children, variante, describe, ref, className }: ChipProps) {
  return (
    <button
      ref={ref} type="button" aria-pressed={activo} aria-describedby={describe} onClick={alTocar}
      className={cn(CHIP, variante === 'sugerida' && 'border-2 border-dashed border-zapallo aria-pressed:border-solid', className)}
    >
      <Tilde activo={activo} />
      {children}
    </button>
  )
}

interface OpcionesProps<T extends string> {
  leyenda: ReactNode
  nombre: string
  opciones: readonly T[]
  etiquetas: Record<T, string>
  valor: T | ''
  alCambiar: (v: T) => void
  error?: string
  ayuda?: ReactNode
  refPrimera?: Ref<HTMLInputElement>
  pie?: ReactNode
}

export function OpcionUnica<T extends string>({ leyenda, nombre, opciones, etiquetas, valor, alCambiar, error, ayuda, refPrimera, pie }: OpcionesProps<T>) {
  const id = useId()
  const describe = [ayuda ? `${id}-ayuda` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined
  const segmentos = opciones.length <= 2
  return (
    <fieldset className="flex min-w-0 flex-col gap-1.5" aria-describedby={describe}>
      <legend className="mb-1.5 font-bold text-pino">{leyenda}</legend>
      {ayuda && <p id={`${id}-ayuda`} className="-mt-0.5 mb-0.5 text-sm text-musgo text-pretty">{ayuda}</p>}
      {segmentos ? (
        <div className={cn('grid grid-cols-2 gap-1 rounded-full bg-muted p-1', error && 'ring-[3px] ring-zapallo/35')}>
          {opciones.map((o, i) => {
            const activa = valor === o
            return (
              <label
                key={o}
                className="relative flex min-h-12 cursor-pointer items-center justify-center rounded-full px-3 text-center select-none has-focus-visible:outline-3 has-focus-visible:outline-verde"
              >
                <input
                  ref={i === 0 ? refPrimera : undefined} type="radio" className="sr-only" name={nombre} value={o}
                  checked={activa} onChange={() => alCambiar(o)}
                />
                {activa && (
                  <motion.span
                    layoutId={`${id}-pastilla`}
                    className="absolute inset-0 rounded-full border border-primary bg-background"
                    transition={RESORTE}
                  />
                )}
                <span className={cn('relative', activa ? 'font-bold text-pino' : 'text-musgo')}>{etiquetas[o]}</span>
              </label>
            )
          })}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {opciones.map((o, i) => (
            <label key={o} className={CHIP}>
              <input
                ref={i === 0 ? refPrimera : undefined} type="radio" className="sr-only" name={nombre} value={o}
                checked={valor === o} onChange={() => alCambiar(o)}
              />
              <Tilde activo={valor === o} />
              {etiquetas[o]}
            </label>
          ))}
        </div>
      )}
      {error && <Falta id={`${id}-error`}>{error}</Falta>}
      {pie}
    </fieldset>
  )
}
