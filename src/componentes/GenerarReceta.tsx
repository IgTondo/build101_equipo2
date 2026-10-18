// "Generar receta" (PLAN v5.3): el padre elige la comida (desayuno, almuerzo, merienda o cena) y sigue el flujo de
// siempre: la sugerencia del grafo para esa comida (/api/progreso?momento=) → la receta (/receta, que la genera con su
// imagen). Ventana con <dialog> nativo: el foco, Escape y el fondo inerte los resuelve el navegador. Se abre como una
// hoja desde abajo, con cada comida como una opción grande con su ícono y su color (VISUAL_MOMENTO).
import { cn } from 'cn'
import { CookingPot } from 'lucide-react'
import { motion } from 'motion/react'
import { useId, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Momento, Nutriente } from '../../shared/contratos'
import { api, type ErrorDeApi } from '../lib/api'
import { VISUAL_MOMENTO } from '../lib/colores'
import { elegirParaReceta, rutaRecetaComida } from '../lib/proximaComida'
import { aErrorDeApi } from '../lib/useApi'
import { NOMBRE_MOMENTO } from '../lib/vocabulario'
import { Cargando, ErrorConReintento } from './Estados'
import { Button } from './ui/button'

const COMIDAS: Momento[] = ['desayuno', 'almuerzo', 'merienda', 'cena']
const PARA: Record<Momento, string> = {
  desayuno: 'el desayuno', almuerzo: 'el almuerzo', merienda: 'la merienda', cena: 'la cena', colacion: 'la colación',
}

const RESORTE = { type: 'spring', stiffness: 420, damping: 34 } as const

type Estado =
  | { tipo: 'eligiendo' }
  | { tipo: 'buscando'; momento: Momento }
  | { tipo: 'sin_idea'; momento: Momento }
  | { tipo: 'error'; momento: Momento; error: ErrorDeApi }

export function GenerarReceta({ ninoId }: { ninoId: string }) {
  const dialogo = useRef<HTMLDialogElement>(null)
  const control = useRef<AbortController | null>(null)
  const [estado, setEstado] = useState<Estado>({ tipo: 'eligiendo' })
  const navegar = useNavigate()
  const id = useId()
  const titulo = `${id}-titulo`

  function abrir() {
    setEstado({ tipo: 'eligiendo' })
    dialogo.current?.showModal()
  }

  function cerrar() {
    control.current?.abort()
    dialogo.current?.close()
  }

  async function elegir(momento: Momento) {
    control.current?.abort()
    const c = new AbortController()
    control.current = c
    setEstado({ tipo: 'buscando', momento })
    try {
      const progreso = await api.progreso(ninoId, { dias: 7, momento }, c.signal)
      if (c.signal.aborted) return
      const s = elegirParaReceta(progreso, momento)
      if (!s) return setEstado({ tipo: 'sin_idea', momento })
      const nutriente: Nutriente | undefined = progreso.semana.faltan.find((n) => n !== 'energia_kcal')
      dialogo.current?.close()
      navegar(rutaRecetaComida(ninoId, s, momento, nutriente))
    } catch (e) {
      if (!c.signal.aborted) setEstado({ tipo: 'error', momento, error: aErrorDeApi(e) })
    }
  }

  const buscando = estado.tipo === 'buscando'

  return (
    <>
      {/* Del mismo estilo suave que "Registrar comida", un escalón más callado: la acción central es registrar. */}
      <motion.div whileTap={{ scale: 0.97 }} transition={RESORTE} className="rounded-full">
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={abrir}
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
        onClose={() => control.current?.abort()}
        className={cn(
          // Abajo y centrada, como una hoja: el pulgar llega a las cuatro opciones.
          'm-auto mb-[max(1rem,env(safe-area-inset-bottom))] max-h-[calc(100dvh_-_2rem)] w-[min(100%_-_2rem,26rem)] max-w-none overflow-y-auto',
          'rounded-3xl bg-background px-4 pt-6 pb-2 text-foreground backdrop:bg-pino/45',
          'open:animate-in open:fade-in open:slide-in-from-bottom-4 open:duration-200 open:ease-salida backdrop:animate-in backdrop:fade-in',
          'motion-reduce:open:animate-none motion-reduce:backdrop:animate-none',
        )}
      >
        <h2 id={titulo} className="text-center text-xl">¿Para qué comida?</h2>

        <div className="mt-5 grid grid-cols-2 gap-3" role="group" aria-labelledby={titulo} aria-busy={buscando}>
          {COMIDAS.map((m) => {
            const visual = VISUAL_MOMENTO[m]
            const Icono = visual.icono
            return (
              <button
                key={m}
                type="button"
                aria-pressed={estado.tipo !== 'eligiendo' && 'momento' in estado && estado.momento === m}
                disabled={buscando}
                onClick={() => elegir(m)}
                className={cn(
                  'flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl px-3 py-4 text-lg font-bold text-pino',
                  'transition-[scale,opacity,box-shadow] duration-150 ease-salida active:scale-[0.97] motion-reduce:active:scale-100',
                  'aria-pressed:ring-3 aria-pressed:ring-primary disabled:cursor-default disabled:not-aria-pressed:opacity-50',
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

        <div className="mt-4 min-h-2 empty:mt-0" aria-live="polite">
          {estado.tipo === 'buscando' && (
            <Cargando className="justify-center text-center" texto={`Buscando una receta para ${PARA[estado.momento]}…`} />
          )}
          {estado.tipo === 'sin_idea' && (
            <p className="text-center text-musgo text-pretty">
              Todavía no tenemos una receta para {PARA[estado.momento]}. Probá otra comida o registrá algunas más.
            </p>
          )}
          {estado.tipo === 'error' && (
            <ErrorConReintento error={estado.error} reintentar={() => elegir(estado.momento)} />
          )}
        </div>

        <Button type="button" variant="ghost" className="mt-2 w-full text-musgo" onClick={cerrar}>Cancelar</Button>
      </dialog>
    </>
  )
}
