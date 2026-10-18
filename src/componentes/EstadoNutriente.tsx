// El estado de un nutriente para el padre (src/lib/cobertura.ts): una etiqueta con ícono (nunca solo color) y una
// barra que se llena hasta lo recomendado y no pasa. Lo usan "Hoy" en el inicio y la semana.
// El ícono dice el estado con la forma, como un plato: lleno con un check (Cubierto), por la mitad (Casi) o vacío, un
// aro (Le falta). El color acompaña (verde, verde y Zapallo) y el texto va siempre en Pino: Zapallo nunca es texto.
import { cn } from 'cn'
import { motion, useReducedMotion } from 'motion/react'
import { ETIQUETA_ESTADO, type EstadoCobertura } from '../lib/cobertura'

function Icono({ estado }: { estado: EstadoCobertura }) {
  return (
    <svg className="size-4 shrink-0" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      {estado === 'cubierto' && (
        <>
          <circle cx="8" cy="8" r="8" className="fill-verde" />
          <path d="M4.75 8.25 7 10.5l4.25-4.5" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {estado === 'casi' && (
        <>
          <circle cx="8" cy="8" r="6.75" fill="none" strokeWidth="2.5" className="stroke-verde" />
          <path d="M8 1.25a6.75 6.75 0 0 1 0 13.5z" className="fill-verde" />
        </>
      )}
      {estado === 'falta' && <circle cx="8" cy="8" r="6.75" fill="none" strokeWidth="2.5" className="stroke-zapallo" />}
    </svg>
  )
}

/** "✓ Cubierto" · "◐ Casi" · "○ Le falta". */
export function EtiquetaEstado({ estado }: { estado: EstadoCobertura }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 text-sm leading-tight font-bold whitespace-nowrap text-pino">
      <Icono estado={estado} />
      {ETIQUETA_ESTADO[estado]}
    </span>
  )
}

/** La pista se tiñe solo cuando le falta; el relleno lleva el color del estado (Hoja con un filo, para que se vea). */
const PISTA: Record<EstadoCobertura, string> = { cubierto: 'bg-brote', casi: 'bg-brote', falta: 'bg-zapallo-claro' }
const RELLENO: Record<EstadoCobertura, string> = {
  cubierto: 'bg-verde',
  casi: 'bg-hoja shadow-[inset_0_0_0_1px_rgb(46_125_82/0.35)]',
  falta: 'bg-zapallo',
}

/**
 * Barra de 0 a lo recomendado (`fraccion` de 0 a 1, ya topeada). Decorativa: el estado va en la etiqueta.
 * Se llena una vez, cuando se ve; con movimiento reducido aparece llena.
 */
export function BarraEstado({ estado, fraccion, gruesa = false }: { estado: EstadoCobertura; fraccion: number; gruesa?: boolean }) {
  const reducir = useReducedMotion()
  const ancho = `${Math.round((Number.isFinite(fraccion) ? Math.min(Math.max(fraccion, 0), 1) : 0) * 100)}%`
  return (
    <span className={cn('relative block overflow-hidden rounded-full', gruesa ? 'h-3' : 'h-2', PISTA[estado])} aria-hidden="true">
      <motion.span
        className={cn('absolute inset-y-0 left-0 block rounded-full', gruesa ? 'min-w-3' : 'min-w-2', RELLENO[estado])}
        initial={reducir ? false : { width: 0 }}
        whileInView={{ width: ancho }}
        style={reducir ? { width: ancho } : undefined}
        viewport={{ once: true, amount: 0.8 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      />
    </span>
  )
}
