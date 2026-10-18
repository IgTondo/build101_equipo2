// Piezas chicas del registro: el título de cada paso, el marco de la foto (la protagonista), el aviso tibio (foto
// movida, sin micrófono, nota no entendida) y la marca "De tu nota" (lo que completó la IA con lo que contó el padre).
import { cn } from 'cn'
import { Mic, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

/** Resorte de la interfaz (notas/ui-rediseno.md) y la curva para revelar datos. */
export const RESORTE = { type: 'spring', stiffness: 420, damping: 34 } as const
export const SALIDA = [0.22, 1, 0.36, 1] as const

/** Un chip que se marca: radio o checkbox nativo escondido adentro de un <label>, o un botón con aria-pressed. */
export const CHIP = cn(
  'relative inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-full border border-border bg-background px-4',
  'text-base text-pino transition-colors duration-150 select-none',
  'has-checked:border-primary has-checked:bg-primary has-checked:font-bold has-checked:text-primary-foreground',
  'aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:font-bold aria-pressed:text-primary-foreground',
  'has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-verde',
)

/** Los títulos reciben foco por código al cambiar de paso (lectores de pantalla): no son controles, sin anillo. */
export const SIN_ANILLO = 'focus:outline-none focus-visible:outline-none'

/** El título de un paso: recibe el foco al cambiar de paso (lectores de pantalla). */
export function TituloPaso({ id, children, className }: { id: string; children: ReactNode; className?: string }) {
  return (
    <h1 id={id} tabIndex={-1} data-foco className={cn('text-3xl', SIN_ANILLO, className)}>
      {children}
    </h1>
  )
}

/**
 * La foto del plato, grande y con el mordisco de la marca. La máscara del mordisco recorta también la sombra, por eso
 * la sombra va en el envoltorio. Lo que va encima (cajas, la banda de luz) se ubica en % sobre la foto.
 */
export function MarcoFoto({ src, alt, children, className, chica = false }: {
  src: string
  alt: string
  children?: ReactNode
  className?: string
  /** Más baja, para cuando la foto acompaña a un aviso. */
  chica?: boolean
}) {
  return (
    <div className={cn('flex justify-center drop-shadow-[0_14px_18px_rgb(35_97_64/0.2)]', className)}>
      <div className="relative w-fit max-w-full overflow-hidden rounded-3xl bg-brote mordisco [--mordisco:34px]">
        <img
          src={src}
          alt={alt}
          className={cn('block h-auto w-auto max-w-full', chica ? 'max-h-[34dvh]' : 'max-h-[58dvh]')}
        />
        {children}
      </div>
    </div>
  )
}

/** Un aviso tibio con salida. Para los errores de la API está ErrorConReintento (mismo tono). */
export function Aviso({ icono: Icono, children, acciones, rol = 'alert' }: {
  icono: LucideIcon
  children: ReactNode
  acciones?: ReactNode
  rol?: 'alert' | 'status'
}) {
  return (
    <div role={rol} className="flex flex-col gap-4 rounded-3xl bg-zapallo-claro p-5 text-left">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-background text-pino">
          <Icono className="size-5" aria-hidden="true" />
        </span>
        <div className="flex flex-col gap-1 pt-1.5 text-pino text-pretty">{children}</div>
      </div>
      {acciones && <div className="flex flex-wrap gap-2">{acciones}</div>}
    </div>
  )
}

/** "De tu nota": lo que la IA marcó con lo que contó el padre. El micrófono es la marca en toda la pantalla. */
export function MarcaNota({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex w-fit items-center gap-1 rounded-full bg-background px-2 py-0.5 text-xs font-bold text-verde-noche not-italic', className)}>
      <Mic className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
      De tu nota
    </span>
  )
}
