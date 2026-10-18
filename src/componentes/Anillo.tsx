// Un anillo de progreso (lo cubierto de lo recomendado). Se llena una vez al aparecer; con movimiento reducido,
// aparece lleno. Lo del centro (children) es lo que se lee: el anillo solo lo acompaña.
import { cn } from 'cn'
import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'

interface Props {
  /** Fracción de lo recomendado: 1 = 100 %. Lo que pasa de 1 se dibuja lleno. */
  valor: number
  /** Lado en px. */
  tamano?: number
  grosor?: number
  /** Color del trazo (var(--nb-…) o cualquier color CSS). */
  color?: string
  pista?: string
  /** Segundos, para escalonar varios anillos. */
  retraso?: number
  children?: ReactNode
  className?: string
}

export function Anillo({
  valor, tamano = 72, grosor = 8, color = 'var(--nb-verde)', pista = 'var(--nb-brote)', retraso = 0, children, className,
}: Props) {
  const reducir = useReducedMotion()
  const centro = tamano / 2
  const radio = (tamano - grosor) / 2
  const lleno = Math.max(0, Math.min(1, valor))
  return (
    <span className={cn('relative inline-grid shrink-0 place-items-center', className)} style={{ width: tamano, height: tamano }}>
      <svg width={tamano} height={tamano} viewBox={`0 0 ${tamano} ${tamano}`} className="absolute inset-0 -rotate-90" aria-hidden="true">
        <circle cx={centro} cy={centro} r={radio} fill="none" stroke={pista} strokeWidth={grosor} />
        {lleno > 0 && (
          <motion.circle
            cx={centro} cy={centro} r={radio} fill="none" stroke={color} strokeWidth={grosor} strokeLinecap="round"
            initial={{ pathLength: reducir ? lleno : 0 }}
            animate={{ pathLength: lleno }}
            transition={{ duration: 0.9, delay: retraso, ease: [0.22, 1, 0.36, 1] }}
          />
        )}
      </svg>
      {children !== undefined && <span className="relative grid place-items-center text-center">{children}</span>}
    </span>
  )
}
