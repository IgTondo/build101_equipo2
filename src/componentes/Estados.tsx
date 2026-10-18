// Estados compartidos de las pantallas (C9). Tono calmo: nunca alarmar al padre. Un error no es rojo: es un aviso
// tibio con salida.
import { cn } from 'cn'
import { CloudOff, RotateCw } from 'lucide-react'
import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import type { ErrorDeApi } from '../lib/api'
import { PlatoVacio } from './Ilustraciones'
import { Button } from './ui/button'

const BOCADITOS = ['var(--nb-verde)', 'var(--nb-zapallo)', 'var(--nb-hoja)']

/** Tres bocaditos que saltan en fila (el "estoy pensando" de Nibble). Con movimiento reducido quedan quietos. */
export function Bocaditos({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={cn('inline-flex h-4 items-end gap-1.5', className)}>
      {BOCADITOS.map((color, i) => (
        <motion.span
          key={color}
          className="size-2.5 rounded-full"
          style={{ background: color }}
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.14, ease: 'easeInOut' }}
        />
      ))}
    </span>
  )
}

export function Cargando({ texto = 'Cargando…', className }: { texto?: string; className?: string }) {
  return (
    <p className={cn('flex items-center gap-3 text-musgo', className)} role="status" aria-live="polite">
      <Bocaditos />
      {texto}
    </p>
  )
}

export function ErrorConReintento({ error, reintentar }: { error: ErrorDeApi; reintentar?: () => void }) {
  return (
    <div className="flex flex-col gap-4 rounded-3xl bg-zapallo-claro p-5" role="alert">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-background text-pino">
          <CloudOff className="size-5" aria-hidden="true" />
        </span>
        <p className="pt-1.5 text-pino text-pretty">{error.message}</p>
      </div>
      {error.reintentable && reintentar && (
        <Button variant="outline" className="self-start bg-background" onClick={reintentar}>
          <RotateCw aria-hidden="true" /> Reintentar
        </Button>
      )}
    </div>
  )
}

export function Vacio({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl bg-muted px-6 py-8 text-center text-pretty">
      <PlatoVacio className="size-24" />
      <h2 className="text-xl">{titulo}</h2>
      {children}
    </div>
  )
}
