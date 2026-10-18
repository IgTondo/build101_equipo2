// "Generar receta" (PLAN v5.3 · v5.4): el padre elige la comida (desayuno, almuerzo, merienda o cena) y va directo a
// /receta?momento=&nueva=1, que pide la receta creativa: el LLM inventa un plato nuevo con lo que sabe el grafo; no
// repite lo que ya vio para esa comida (los nombres se guardan en este celular y viajan en RecetaReq.anteriores).
// Ventana con <dialog> nativo: el foco, Escape y el fondo inerte los resuelve el navegador. Se abre como una hoja desde
// abajo, con cada comida como una opción grande con su ícono y su color (VISUAL_MOMENTO).
import { cn } from 'cn'
import { CookingPot } from 'lucide-react'
import { motion } from 'motion/react'
import { useId, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Momento } from '../../shared/contratos'
import { VISUAL_MOMENTO } from '../lib/colores'
import { rutaRecetaNueva } from '../lib/proximaComida'
import { NOMBRE_MOMENTO } from '../lib/vocabulario'
import { Button } from './ui/button'

const COMIDAS: Momento[] = ['desayuno', 'almuerzo', 'merienda', 'cena']

const RESORTE = { type: 'spring', stiffness: 420, damping: 34 } as const

export function GenerarReceta({ ninoId }: { ninoId: string }) {
  const dialogo = useRef<HTMLDialogElement>(null)
  const navegar = useNavigate()
  const id = useId()
  const titulo = `${id}-titulo`

  function elegir(momento: Momento) {
    dialogo.current?.close()
    navegar(rutaRecetaNueva(ninoId, momento))
  }

  return (
    <>
      {/* Del mismo estilo suave que "Registrar comida", un escalón más callado: la acción central es registrar. */}
      <motion.div whileTap={{ scale: 0.97 }} transition={RESORTE} className="rounded-full">
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={() => dialogo.current?.showModal()}
          className="flex min-h-16 w-full cursor-pointer items-center gap-3.5 rounded-full border bg-card py-2 pr-6 pl-2 text-left transition-colors duration-150 hover:bg-brote"
        >
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-brote text-verde-hondo">
            <CookingPot className="size-6" strokeWidth={2.25} aria-hidden="true" />
          </span>
          <span className="font-titulo text-lg font-extrabold">Generar receta</span>
        </button>
      </motion.div>

      <dialog
        ref={dialogo}
        aria-labelledby={titulo}
        className={cn(
          // Abajo y centrada, como una hoja: el pulgar llega a las cuatro opciones.
          'm-auto mb-[max(1rem,env(safe-area-inset-bottom))] max-h-[calc(100dvh_-_2rem)] w-[min(100%_-_2rem,26rem)] max-w-none overflow-y-auto',
          'rounded-3xl bg-background px-4 pt-6 pb-2 text-foreground backdrop:bg-pino/45',
          'open:animate-in open:fade-in open:slide-in-from-bottom-4 open:duration-200 open:ease-salida backdrop:animate-in backdrop:fade-in',
          'motion-reduce:open:animate-none motion-reduce:backdrop:animate-none',
        )}
      >
        <h2 id={titulo} className="text-center text-xl">¿Para qué comida?</h2>

        <div className="mt-5 grid grid-cols-2 gap-3" role="group" aria-labelledby={titulo}>
          {COMIDAS.map((m) => {
            const visual = VISUAL_MOMENTO[m]
            const Icono = visual.icono
            return (
              <button
                key={m}
                type="button"
                onClick={() => elegir(m)}
                className={cn(
                  'flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl px-3 py-4 text-lg font-bold text-pino',
                  'transition-[scale,opacity,box-shadow] duration-150 ease-salida active:scale-[0.97] motion-reduce:active:scale-100',
                  visual.claseClaro,
                )}
              >
                <span className="grid size-12 place-items-center rounded-full" style={{ background: visual.color }}>
                  <Icono className={cn('size-6', m === 'cena' ? 'text-white' : 'text-pino')} strokeWidth={2.25} aria-hidden="true" />
                </span>
                {NOMBRE_MOMENTO[m]}
              </button>
            )
          })}
        </div>

        <Button type="button" variant="ghost" className="mt-4 w-full text-musgo" onClick={() => dialogo.current?.close()}>Cancelar</Button>
      </dialog>
    </>
  )
}
