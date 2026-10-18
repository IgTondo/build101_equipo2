// "Tus hijos" (src/lib/familia.ts): el nombre de arriba del inicio es un botón que abre una hoja con los chicos de
// este celular. Tocar otro cambia de chico (misma pantalla con su ?nino=, que también queda guardado como activo);
// "Agregar otro hijo" va al alta por voz. Los nombres que faltan (chicos que llegaron por ?nino= y nunca se abrieron
// acá) se piden a /api/perfil al abrir la hoja; si uno ya no existe, se ofrece quitarlo de la lista.
// Ventana con <dialog> nativo, como "Generar receta": el foco, Escape y el fondo inerte los resuelve el navegador.
import { cn } from 'cn'
import { Check, ChevronDown, Plus } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button } from '../../componentes/ui/button'
import { api } from '../../lib/api'
import { recordarHijo, rutaAlCambiar, useMisHijos, useQuitarHijo } from '../../lib/familia'
import { RUTA_ALTA } from '../../lib/nino'
import { aErrorDeApi } from '../../lib/useApi'
import { Inicial } from '../perfil/Piezas'

type Busqueda = 'cargando' | 'no_encontrado' | 'error'

/** El nombre del chico activo como título del inicio. Sin nombre todavía (ni guardado), el título es "Inicio". */
export function SelectorHijo({ ninoId, nombre }: { ninoId: string; nombre: string | null }) {
  const hijos = useMisHijos()
  const dialogo = useRef<HTMLDialogElement>(null)
  const [abierto, setAbierto] = useState(false)
  const id = useId()
  const titulo = `${id}-titulo`

  // El nombre que trajo el perfil queda guardado: la próxima vez el título aparece sin esperar y la hoja lo muestra.
  useEffect(() => { if (nombre) recordarHijo(ninoId, nombre) }, [ninoId, nombre])
  const visible = nombre ?? hijos.find((h) => h.id === ninoId)?.nombre ?? null

  if (!visible) return <h1 className="min-h-[2.2rem] text-3xl font-black"><span className="sr-only">Inicio</span></h1>

  return (
    <>
      <h1 className="min-h-[2.2rem] text-3xl font-black">
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={() => { dialogo.current?.showModal(); setAbierto(true) }}
          className="-mx-2 inline-flex min-h-11 max-w-full cursor-pointer items-center gap-2 rounded-2xl px-2 text-left transition-colors duration-150 hover:bg-brote"
        >
          <span className="min-w-0 [overflow-wrap:anywhere]">{visible}</span>
          <span className="sr-only">, cambiar de hijo</span>
          <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-full bg-brote text-verde-hondo">
            <ChevronDown className="size-4.5" strokeWidth={2.75} />
          </span>
        </button>
      </h1>

      <dialog
        ref={dialogo}
        aria-labelledby={titulo}
        onClose={() => setAbierto(false)}
        className={cn(
          'm-auto mb-[max(1rem,env(safe-area-inset-bottom))] max-h-[calc(100dvh_-_2rem)] w-[min(100%_-_2rem,26rem)] max-w-none overflow-y-auto',
          'rounded-3xl bg-background px-4 pt-6 pb-2 text-foreground backdrop:bg-pino/45',
          'open:animate-in open:fade-in open:slide-in-from-bottom-4 open:duration-200 open:ease-salida backdrop:animate-in backdrop:fade-in',
          'motion-reduce:open:animate-none motion-reduce:backdrop:animate-none',
        )}
      >
        <h2 id={titulo} className="text-center text-xl">Tus hijos</h2>
        {abierto && <ListaHijos activo={ninoId} nombreActivo={visible} cerrar={() => dialogo.current?.close()} />}
        <Button type="button" variant="ghost" className="mt-2 w-full text-musgo" onClick={() => dialogo.current?.close()}>Cerrar</Button>
      </dialog>
    </>
  )
}

/** Se monta al abrir la hoja y se desmonta al cerrarla. */
function ListaHijos({ activo, nombreActivo, cerrar }: { activo: string; nombreActivo: string; cerrar: () => void }) {
  const hijos = useMisHijos()
  const navegar = useNavigate()
  const { pathname } = useLocation()
  const quitar = useQuitarHijo()
  const [busquedas, setBusquedas] = useState<Record<string, Busqueda>>({})

  // Al abrir la hoja se piden los nombres que faltan (una vez); al cerrarla, se cancela lo que quede.
  useEffect(() => {
    const control = new AbortController()
    for (const h of hijos) {
      if (h.nombre || h.id === activo) continue
      setBusquedas((b) => ({ ...b, [h.id]: 'cargando' }))
      api.perfil(h.id, control.signal)
        .then((p) => recordarHijo(h.id, p.datos.nombre))
        .catch((e) => {
          if (control.signal.aborted) return
          const codigo = aErrorDeApi(e).codigo
          setBusquedas((b) => ({ ...b, [h.id]: codigo === 'no_encontrado' ? 'no_encontrado' : 'error' }))
        })
    }
    return () => control.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function elegir(hijo: string) {
    cerrar()
    if (hijo !== activo) navegar(rutaAlCambiar(pathname, hijo))
  }

  return (
    <ul className="mt-5 flex flex-col gap-2">
      {hijos.map((h) => {
        const esActivo = h.id === activo
        const nombre = esActivo ? nombreActivo : h.nombre
        const busqueda = busquedas[h.id]
        if (!nombre && busqueda === 'no_encontrado') {
          return (
            <li key={h.id} className="flex min-h-16 items-center gap-3 rounded-2xl bg-muted py-2 pr-2 pl-2">
              <Inicial nombre="" className="size-12 bg-background text-musgo" />
              <span className="min-w-0 flex-1 text-sm text-musgo text-pretty">No encontramos este perfil. Puede que se haya borrado.</span>
              <Button type="button" variant="ghost" size="sm" className="text-pino" onClick={() => quitar(h.id)}>Quitar</Button>
            </li>
          )
        }
        return (
          <li key={h.id}>
            <button
              type="button"
              aria-current={esActivo ? 'true' : undefined}
              onClick={() => elegir(h.id)}
              className={cn(
                'flex min-h-16 w-full cursor-pointer items-center gap-3 rounded-2xl py-2 pr-4 pl-2 text-left',
                'transition-[background-color,scale] duration-150 ease-salida active:scale-[0.98] motion-reduce:active:scale-100',
                esActivo ? 'bg-brote' : 'border bg-card hover:bg-brote',
              )}
            >
              <Inicial nombre={nombre ?? ''} className="size-12 text-xl" />
              <span className="flex min-w-0 flex-1 flex-col">
                {nombre
                  ? <span className="font-titulo text-lg font-extrabold text-pino [overflow-wrap:anywhere]">{nombre}</span>
                  : <span className="text-musgo">{busqueda === 'cargando' ? 'Buscando su nombre…' : 'Perfil sin abrir'}</span>}
                {esActivo && <span className="text-sm text-musgo">Lo estás viendo</span>}
              </span>
              {esActivo && (
                <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                  <Check className="size-4" strokeWidth={3} />
                </span>
              )}
            </button>
          </li>
        )
      })}
      <li>
        <button
          type="button"
          onClick={() => { cerrar(); navegar(RUTA_ALTA) }}
          className="flex min-h-16 w-full cursor-pointer items-center gap-3 rounded-2xl py-2 pr-4 pl-2 text-left font-bold text-primary transition-colors duration-150 hover:bg-brote"
        >
          <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-full border-2 border-dashed border-hoja">
            <Plus className="size-5" strokeWidth={2.5} />
          </span>
          Agregar otro hijo
        </button>
      </li>
    </ul>
  )
}
