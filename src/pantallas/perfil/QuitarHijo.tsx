// "Quitar de este celular" (src/lib/familia.ts): al pie del perfil, callado. Pide confirmación en una hoja como la de
// "Generar receta" (<dialog> nativo). No borra nada del servidor: el chico solo deja de estar en "Tus hijos" de este
// celular. Después se pasa al siguiente chico o, si era el último, al alta por voz.
import { cn } from 'cn'
import { useEffect, useId, useRef } from 'react'
import { Button } from '../../componentes/ui/button'
import { recordarHijo, useQuitarHijo } from '../../lib/familia'

export function QuitarHijo({ ninoId, nombre }: { ninoId: string; nombre: string }) {
  const dialogo = useRef<HTMLDialogElement>(null)
  const quitar = useQuitarHijo()
  const id = useId()

  // El perfil cargó: su nombre queda en "Tus hijos" (o se actualiza si cambió).
  useEffect(() => recordarHijo(ninoId, nombre), [ninoId, nombre])

  return (
    <>
      <Button
        type="button" variant="ghost" aria-haspopup="dialog"
        className="self-center text-musgo" onClick={() => dialogo.current?.showModal()}
      >
        Quitar de este celular
      </Button>

      <dialog
        ref={dialogo}
        aria-labelledby={`${id}-titulo`}
        aria-describedby={`${id}-texto`}
        className={cn(
          'm-auto mb-[max(1rem,env(safe-area-inset-bottom))] max-h-[calc(100dvh_-_2rem)] w-[min(100%_-_2rem,26rem)] max-w-none overflow-y-auto',
          'rounded-3xl bg-background px-5 pt-6 pb-2 text-foreground backdrop:bg-pino/45',
          'open:animate-in open:fade-in open:slide-in-from-bottom-4 open:duration-200 open:ease-salida backdrop:animate-in backdrop:fade-in',
          'motion-reduce:open:animate-none motion-reduce:backdrop:animate-none',
        )}
      >
        <h2 id={`${id}-titulo`} className="text-center text-xl text-balance">¿Quitar a {nombre} de este celular?</h2>
        <p id={`${id}-texto`} className="mt-2 text-center text-musgo text-pretty">
          No se borra nada: su perfil y sus comidas siguen guardados. Solo deja de aparecer en este celular.
        </p>
        <div className="mt-5 flex flex-col gap-1">
          <Button type="button" className="w-full" onClick={() => { dialogo.current?.close(); quitar(ninoId) }}>
            Quitar de este celular
          </Button>
          <Button type="button" variant="ghost" className="w-full text-musgo" onClick={() => dialogo.current?.close()}>Cancelar</Button>
        </div>
      </dialog>
    </>
  )
}
