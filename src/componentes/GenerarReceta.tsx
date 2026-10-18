// "Generar receta" (PLAN v5.3): el padre elige la comida (desayuno, almuerzo, merienda o cena) y sigue el flujo de
// siempre: la sugerencia del grafo para esa comida (/api/progreso?momento=) → la receta (/receta, que la genera con su
// imagen). Ventana con <dialog> nativo: el foco, Escape y el fondo inerte los resuelve el navegador.
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Momento, Nutriente } from '../../shared/contratos'
import { api, type ErrorDeApi } from '../lib/api'
import { elegirParaReceta, rutaRecetaComida } from '../lib/proximaComida'
import { aErrorDeApi } from '../lib/useApi'
import { NOMBRE_MOMENTO } from '../lib/vocabulario'
import { Cargando, ErrorConReintento } from './Estados'
import './generar-receta.css'

const COMIDAS: Momento[] = ['desayuno', 'almuerzo', 'merienda', 'cena']
const PARA: Record<Momento, string> = {
  desayuno: 'el desayuno', almuerzo: 'el almuerzo', merienda: 'la merienda', cena: 'la cena', colacion: 'la colación',
}

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
      <button type="button" className="nb-boton nb-boton-secundario gr-abrir" onClick={abrir}>
        <IconoOlla /> Generar receta
      </button>

      <dialog ref={dialogo} className="gr-dialogo" aria-labelledby="gr-titulo" onClose={() => control.current?.abort()}>
        <h2 id="gr-titulo">¿Para qué comida?</h2>

        <div className="gr-opciones" role="group" aria-labelledby="gr-titulo" aria-busy={buscando}>
          {COMIDAS.map((m) => (
            <button
              key={m}
              type="button"
              className="gr-opcion"
              aria-pressed={estado.tipo !== 'eligiendo' && 'momento' in estado && estado.momento === m}
              disabled={buscando}
              onClick={() => elegir(m)}
            >
              {NOMBRE_MOMENTO[m]}
            </button>
          ))}
        </div>

        <div className="gr-estado" aria-live="polite">
          {estado.tipo === 'buscando' && <Cargando texto={`Buscando una receta para ${PARA[estado.momento]}…`} />}
          {estado.tipo === 'sin_idea' && (
            <p>Todavía no tenemos una receta para {PARA[estado.momento]}. Probá otra comida o registrá algunas más.</p>
          )}
          {estado.tipo === 'error' && (
            <ErrorConReintento error={estado.error} reintentar={() => elegir(estado.momento)} />
          )}
        </div>

        <button type="button" className="gr-cancelar" onClick={cerrar}>Cancelar</button>
      </dialog>
    </>
  )
}

function IconoOlla() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
      <path d="M4 11h16v3.5A5.5 5.5 0 0 1 14.5 20h-5A5.5 5.5 0 0 1 4 14.5z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M2.5 11h19M9 7.5c0-1 1-1.5 1-2.5M13.5 7.5c0-1 1-1.5 1-2.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
