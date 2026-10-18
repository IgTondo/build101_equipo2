// Piezas chicas del perfil y del alta por voz: el resorte de la interfaz, el aviso tibio (avisos de salud, lo que
// falta), lo que falta en un campo, la cita de lo que dijo el padre, la inicial del chico, el tilde del festejo y la
// ilustración de la bienvenida (un plato con el micrófono y bocados alrededor).
import { cn } from 'cn'
import { CircleAlert, Heart, Hourglass, Lightbulb, ListChecks, Mic, Quote, Sprout, UserRound, type LucideIcon } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode, Ref } from 'react'
import type { Grupo } from '../../../shared/contratos'
import { IconoAlimento } from '../../componentes/IconoAlimento'

/** Resorte de la interfaz (notas/ui-rediseno.md) y la curva para revelar datos. */
export const RESORTE = { type: 'spring', stiffness: 420, damping: 34 } as const
export const SALIDA = [0.22, 1, 0.36, 1] as const

/** Los títulos reciben foco por código al cambiar de paso (lectores de pantalla): no son controles, sin anillo. */
export const SIN_ANILLO = 'focus:outline-none focus-visible:outline-none'

/**
 * Lo que come, lo que todavía no, sus reglas y lo que aprendimos: los mismos íconos en la guía del audio, en "Esto
 * entendimos" y en el perfil, para que el padre reconozca cada cosa. "Todavía no" es un reloj de arena: es por ahora.
 */
export const ICONO = {
  acepta: Heart, rechaza: Hourglass, reglas: ListChecks, probando: Sprout, notamos: Lightbulb,
} satisfies Record<string, LucideIcon>

/** El título de una sección con su ícono en un círculo: teñido sobre blanco, blanco sobre la protagonista (Brote). */
export function TituloSeccion({ id, icono: Icono, children, className, ref, enBrote = false, nivel: H = 'h2' }: {
  id: string
  icono: LucideIcon
  children: ReactNode
  className?: string
  ref?: Ref<HTMLHeadingElement>
  enBrote?: boolean
  nivel?: 'h2' | 'h3'
}) {
  return (
    <H id={id} ref={ref} tabIndex={ref ? -1 : undefined} className={cn('flex items-center gap-2.5 text-xl', SIN_ANILLO, className)}>
      <span className={cn('grid size-9 shrink-0 place-items-center rounded-full text-verde-hondo', enBrote ? 'bg-background' : 'bg-brote')} aria-hidden="true">
        <Icono className="size-[1.15rem]" strokeWidth={2.25} />
      </span>
      {children}
    </H>
  )
}

/** Un aviso tibio, sin alarmar: derivar al profesional (§10.4) o pedir lo que falta. Para la API está ErrorConReintento. */
export function Aviso({ icono: Icono, children, rol, className }: {
  icono: LucideIcon
  children: ReactNode
  rol?: 'alert' | 'status'
  className?: string
}) {
  return (
    <div role={rol} className={cn('flex items-start gap-3 rounded-2xl bg-zapallo-claro p-4 pr-5 text-pino', className)}>
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-background">
        <Icono className="size-5" strokeWidth={2.25} aria-hidden="true" />
      </span>
      <div className="flex min-w-0 flex-col gap-1 pt-2 text-pretty">{children}</div>
    </div>
  )
}

/** Lo que falta en un campo (o para crear el perfil): en el Zapallo de lo que falta, nunca en rojo. */
export function Falta({ id, rol, children }: { id?: string; rol?: 'alert' | 'status'; children: ReactNode }) {
  return (
    <p id={id} role={rol} className="flex items-start gap-2 rounded-xl bg-zapallo-claro px-3 py-2 text-sm font-bold text-pino text-pretty">
      <CircleAlert className="mt-px size-4 shrink-0" strokeWidth={2.25} aria-hidden="true" />
      {children}
    </p>
  )
}

/** "Dijiste: «…»": lo que dijo el padre en el audio, como un globo de diálogo. */
export function Cita({ cita, id, className }: { cita: string; id?: string; className?: string }) {
  return (
    <p id={id} className={cn('flex w-fit max-w-full gap-2 rounded-2xl rounded-tl-md bg-brote px-3.5 py-2.5 text-sm text-pino', className)}>
      <Quote className="mt-0.5 size-4 shrink-0 text-verde-hondo" strokeWidth={2.25} aria-hidden="true" />
      <span className="min-w-0 [overflow-wrap:anywhere]">
        <span className="font-bold">Dijiste:</span> <span className="italic">«{cita}»</span>
      </span>
    </p>
  )
}

/** La inicial del chico en un círculo de Hoja (sin nombre todavía, una silueta). Decorativa: el nombre va al lado. */
export function Inicial({ nombre, className }: { nombre: string; className?: string }) {
  const letra = nombre.trim().charAt(0).toLocaleUpperCase('es')
  return (
    <span
      aria-hidden="true"
      className={cn('grid shrink-0 place-items-center rounded-full bg-hoja font-titulo font-black text-verde-noche select-none', className)}
    >
      {letra || <UserRound className="size-1/2" strokeWidth={2.25} />}
    </span>
  )
}

/** El tilde del festejo: aparece con un resorte y se dibuja. Con movimiento reducido, ya dibujado. */
export function TildeListo({ className }: { className?: string }) {
  const reducir = useReducedMotion()
  return (
    <motion.span
      aria-hidden="true"
      className={cn('absolute -right-1 -bottom-1 grid size-14 place-items-center rounded-full bg-primary ring-4 ring-background', className)}
      initial={{ scale: reducir ? 1 : 0.4 }}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', stiffness: 420, damping: 18, delay: 0.1 }}
    >
      <svg viewBox="0 0 24 24" className="size-8">
        <motion.path
          d="M5.5 12.5l4.2 4.2L18.5 7.5"
          fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
          initial={{ pathLength: reducir ? 1 : 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.45, delay: 0.3, ease: SALIDA }}
        />
      </svg>
    </motion.span>
  )
}

/** Lo que suele comer un chico que come poco, con un brote de verdura: cada uno con el color de su grupo. */
const BOCADOS: { nombre: string; grupo: Grupo }[] = [
  { nombre: 'papas fritas', grupo: 'cereal_almidon' },
  { nombre: 'banana', grupo: 'fruta' },
  { nombre: 'yogur', grupo: 'lacteo' },
  { nombre: 'galletitas', grupo: 'cereal_almidon' },
  { nombre: 'brocoli', grupo: 'verdura' },
  { nombre: 'milanesa', grupo: 'proteina' },
]
const RADIO_BOCADOS = 90

/**
 * La bienvenida: un plato blanco visto desde arriba con el micrófono en el medio y los bocados alrededor, en el borde.
 * Los bocados se sirven uno por uno, una sola vez (el único movimiento que no responde a un toque); con movimiento
 * reducido ya están servidos. Decorativa.
 */
export function PlatoBienvenida() {
  const reducir = useReducedMotion()
  return (
    <span aria-hidden="true" className="relative block size-56 shrink-0">
      <span className="absolute inset-5 rounded-full bg-background ring-1 ring-black/5" />
      <span className="absolute inset-10 rounded-full border-2 border-muted" />
      <span className="absolute inset-0 grid place-items-center">
        <span className="grid size-16 place-items-center rounded-full bg-primary text-primary-foreground">
          <Mic className="size-8" strokeWidth={2.25} />
        </span>
      </span>
      {BOCADOS.map((b, i) => {
        const angulo = ((-90 + i * 60) * Math.PI) / 180
        return (
          <span
            key={b.nombre}
            className="absolute -translate-1/2"
            style={{ left: `calc(50% + ${Math.cos(angulo) * RADIO_BOCADOS}px)`, top: `calc(50% + ${Math.sin(angulo) * RADIO_BOCADOS}px)` }}
          >
            <motion.span
              className="grid rounded-full ring-4 ring-brote"
              initial={reducir ? false : { scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ ...RESORTE, delay: 0.2 + i * 0.09 }}
            >
              <IconoAlimento nombre={b.nombre} grupo={b.grupo} tamano="md" />
            </motion.span>
          </span>
        )
      })}
    </span>
  )
}
