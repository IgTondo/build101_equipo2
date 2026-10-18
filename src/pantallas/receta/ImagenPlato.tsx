// La imagen de cómo servirlo: se pide aparte, después de la receta. Mientras llega (unos 3 s), un plato que respira;
// cuando carga, aparece con un fundido suave. Va a sangre arriba de la tarjeta protagonista.
import { cn } from 'cn'
import { RotateCw } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import type { Receta, Regla } from '../../../shared/contratos'
import { Bocaditos } from '../../componentes/Estados'
import { PlatoVacio } from '../../componentes/Ilustraciones'
import { Button } from '../../componentes/ui/button'
import { api } from '../../lib/api'

type Estado = { tipo: 'cargando' } | { tipo: 'ok'; src: string } | { tipo: 'error' }

const SALIDA = [0.22, 1, 0.36, 1] as const

/** El esqueleto: un plato visto desde arriba que respira despacio. */
function PlatoQueRespira() {
  return (
    <motion.svg
      viewBox="0 0 120 120"
      className="w-[58%] max-w-56"
      aria-hidden="true"
      animate={{ scale: [0.97, 1, 0.97], opacity: [0.55, 0.9, 0.55] }}
      transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
    >
      <circle cx="60" cy="60" r="56" fill="#fff" />
      <circle cx="60" cy="60" r="40" fill="none" stroke="var(--nb-hoja)" strokeWidth="2" />
    </motion.svg>
  )
}

/** `reglas` en null = el perfil todavía no llegó: se espera para no dibujar algo que el chico rechaza. */
export function ImagenPlato({ receta, reglas, className }: { receta: Receta; reglas: Regla[] | null; className?: string }) {
  const [estado, setEstado] = useState<Estado>({ tipo: 'cargando' })
  const [cargada, setCargada] = useState(false)
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    if (reglas === null) return
    const control = new AbortController()
    setEstado({ tipo: 'cargando' })
    setCargada(false)
    api.imagenPlato({ receta, reglas }, control.signal)
      .then((r) => { if (!control.signal.aborted) setEstado({ tipo: 'ok', src: `data:${r.mime};base64,${r.imagenBase64}` }) })
      .catch(() => { if (!control.signal.aborted) setEstado({ tipo: 'error' }) })
    return () => control.abort()
  }, [receta, reglas, intento])

  if (estado.tipo === 'error') {
    return (
      <div className={cn('flex items-center gap-4 pt-6 pr-12 pl-5', className)}>
        <PlatoVacio className="size-16 shrink-0" />
        <div className="flex flex-col items-start gap-2.5">
          <p className="text-sm text-pino text-pretty">No pudimos preparar la imagen. La receta sirve igual.</p>
          <Button variant="outline" size="sm" className="bg-background" onClick={() => setIntento((i) => i + 1)}>
            <RotateCw aria-hidden="true" /> Probar de nuevo
          </Button>
        </div>
      </div>
    )
  }

  const lista = estado.tipo === 'ok' && cargada
  return (
    <figure className={cn('relative m-0 aspect-[5/4] overflow-hidden', className)}>
      <AnimatePresence>
        {!lista && (
          <motion.div
            key="esqueleto"
            className="absolute inset-0 grid place-items-center"
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <PlatoQueRespira />
          </motion.div>
        )}
      </AnimatePresence>
      {estado.tipo === 'ok' && (
        <motion.img
          src={estado.src}
          alt={`Cómo servirlo: ${receta.presentacion}`}
          className="absolute inset-0 size-full object-cover"
          initial={{ opacity: 0, scale: 1.04 }}
          animate={lista ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 1.04 }}
          transition={{ duration: 0.6, ease: SALIDA }}
          onLoad={() => setCargada(true)}
          onError={() => setEstado({ tipo: 'error' })}
        />
      )}
      <figcaption className="absolute bottom-3 left-3 flex h-8 items-center gap-2 rounded-full bg-background/90 px-3 text-xs font-bold text-pino">
        {!lista && <Bocaditos className="h-3 [&>span]:size-1.5" />}
        <span role="status" aria-live="polite">{lista ? 'Imagen ilustrativa' : 'Preparando la imagen ilustrativa…'}</span>
      </figcaption>
    </figure>
  )
}
