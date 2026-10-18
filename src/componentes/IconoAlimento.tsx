// El alimento como un bocado: su glifo sobre un círculo del color de su grupo. Es decorativo (aria-hidden):
// el nombre del alimento siempre va escrito al lado.
import { cn } from 'cn'
import type { Grupo } from '../../shared/contratos'
import { glifoAlimento } from '../lib/alimentos'
import { COLOR_GRUPO } from '../lib/colores'

// El glifo ocupa cerca de la mitad del círculo: algunos emoji (el queso) dibujan ~1,3 veces su tamaño de fuente.
const TAMANO = {
  sm: 'size-8 text-base',
  md: 'size-11 text-xl',
  lg: 'size-14 text-[1.75rem]',
  xl: 'size-20 text-[2.5rem]',
} as const

const EMOJI = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif'

interface Props {
  nombre: string
  grupo?: Grupo | null
  tamano?: keyof typeof TAMANO
  className?: string
}

export function IconoAlimento({ nombre, grupo, tamano = 'md', className }: Props) {
  return (
    <span
      aria-hidden="true"
      className={cn('inline-grid shrink-0 place-items-center rounded-full leading-none select-none', TAMANO[tamano], className)}
      style={{ background: grupo ? COLOR_GRUPO[grupo].claro : 'var(--nb-brote)', fontFamily: EMOJI }}
    >
      {glifoAlimento(nombre, grupo)}
    </span>
  )
}
