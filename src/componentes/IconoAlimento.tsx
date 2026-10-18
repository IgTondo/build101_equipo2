// El alimento como un bocado: su dibujo (vectorial, componentes/IconosAlimento) sobre un círculo del color de su grupo.
// Es decorativo (aria-hidden): el nombre del alimento siempre va escrito al lado.
import { cn } from 'cn'
import type { Grupo } from '../../shared/contratos'
import { iconoAlimento } from '../lib/alimentos'
import { COLOR_GRUPO } from '../lib/colores'
import { DibujoAlimento } from './IconosAlimento'

const TAMANO = {
  sm: 'size-8',
  md: 'size-11',
  lg: 'size-14',
  xl: 'size-20',
} as const

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
      className={cn('inline-grid shrink-0 place-items-center rounded-full text-pino select-none', TAMANO[tamano], className)}
      style={{ background: grupo ? COLOR_GRUPO[grupo].claro : 'var(--nb-brote)' }}
    >
      {/* El dibujo ocupa dos tercios del círculo, en cualquier tamaño (también el que pisa className). */}
      <DibujoAlimento id={iconoAlimento(nombre, grupo)} className="size-[66%]" />
    </span>
  )
}
