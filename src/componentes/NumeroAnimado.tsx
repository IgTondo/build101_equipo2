// Un número que sube hasta su valor la primera vez que se ve, y que se mueve al nuevo valor si cambia. Los lectores de
// pantalla leen solo el valor final. Con movimiento reducido, el número aparece quieto.
import { cn } from 'cn'
import { animate, useInView, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'

const entero = (n: number) => Math.round(n).toLocaleString('es-UY')

interface Props {
  valor: number
  /** Cómo se escribe ("62 %", "1.240 kcal"). Por defecto, entero con separador de miles. */
  formato?: (n: number) => string
  /** Segundos. */
  duracion?: number
  className?: string
}

export function NumeroAnimado({ valor, formato = entero, duracion = 0.8, className }: Props) {
  const ref = useRef<HTMLSpanElement>(null)
  const visto = useInView(ref, { once: true })
  const reducir = useReducedMotion()
  const [mostrado, setMostrado] = useState(reducir ? valor : 0)
  const actual = useRef(mostrado)

  useEffect(() => {
    if (reducir) {
      actual.current = valor
      setMostrado(valor)
      return
    }
    if (!visto) return
    const control = animate(actual.current, valor, {
      duration: duracion,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        actual.current = v
        setMostrado(v)
      },
    })
    return () => control.stop()
  }, [valor, visto, reducir, duracion])

  return (
    <span ref={ref} className={cn('tabular-nums', className)}>
      <span aria-hidden="true">{formato(mostrado)}</span>
      <span className="sr-only">{formato(valor)}</span>
    </span>
  )
}
