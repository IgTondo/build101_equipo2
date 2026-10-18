// Un festejo chico para un logro del padre (guardar una comida, terminar el alta): una ráfaga de bocaditos de colores
// que sale del centro del padre (que tiene que ser `relative`). Una vez y breve; con movimiento reducido no se muestra.
import { cn } from 'cn'
import { motion, useReducedMotion } from 'motion/react'

const COLORES = [
  'var(--nb-verde)', 'var(--nb-zapallo)', 'var(--nb-hoja)', 'var(--nb-grupo-cereal)',
  'var(--nb-grupo-lacteo)', 'var(--nb-grupo-proteina)',
]

// Repartidos con el ángulo áureo: parejos alrededor, sin azar (el render queda puro).
const PIEZAS = Array.from({ length: 16 }, (_, i) => {
  const angulo = i * 2.39996
  const distancia = 64 + ((i * 37) % 52)
  return {
    x: Math.cos(angulo) * distancia,
    y: Math.sin(angulo) * distancia,
    lado: 7 + (i % 3) * 3,
    color: COLORES[i % COLORES.length],
    redonda: i % 4 !== 0,
  }
})

export function Celebracion({ activo, className }: { activo: boolean; className?: string }) {
  const reducir = useReducedMotion()
  if (!activo || reducir) return null
  return (
    <span aria-hidden="true" className={cn('pointer-events-none absolute inset-0 grid place-items-center', className)}>
      {PIEZAS.map((p, i) => (
        <motion.span
          key={i}
          className={cn('absolute', p.redonda ? 'rounded-full' : 'rounded-[3px]')}
          style={{ width: p.lado, height: p.lado, background: p.color }}
          initial={{ x: 0, y: 0, scale: 0, opacity: 1, rotate: 0 }}
          animate={{ x: p.x, y: p.y, scale: [0, 1.15, 0.9], opacity: [1, 1, 0], rotate: p.redonda ? 0 : 140 }}
          transition={{ duration: 0.95, delay: (i % 5) * 0.015, ease: [0.22, 1, 0.36, 1] }}
        />
      ))}
    </span>
  )
}
