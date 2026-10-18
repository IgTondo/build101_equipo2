// "Generar receta" (PLAN v5.3 · v5.4): el padre elige la comida (desayuno, almuerzo, merienda o cena) y va directo a
// /receta?momento=&nueva=1, que pide la receta creativa: el LLM inventa un plato nuevo con lo que sabe el grafo; no
// repite lo que ya vio para esa comida (los nombres se guardan en este celular y viajan en RecetaReq.anteriores).
// Ventana con <dialog> nativo: el foco, Escape y el fondo inerte los resuelve el navegador.
import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Momento } from '../../shared/contratos'
import { rutaRecetaNueva } from '../lib/proximaComida'
import { NOMBRE_MOMENTO } from '../lib/vocabulario'
import './generar-receta.css'

const COMIDAS: Momento[] = ['desayuno', 'almuerzo', 'merienda', 'cena']

export function GenerarReceta({ ninoId }: { ninoId: string }) {
  const dialogo = useRef<HTMLDialogElement>(null)
  const navegar = useNavigate()

  function elegir(momento: Momento) {
    dialogo.current?.close()
    navegar(rutaRecetaNueva(ninoId, momento))
  }

  return (
    <>
      <button type="button" className="nb-boton nb-boton-secundario gr-abrir" onClick={() => dialogo.current?.showModal()}>
        <IconoOlla /> Generar receta
      </button>

      <dialog ref={dialogo} className="gr-dialogo" aria-labelledby="gr-titulo">
        <h2 id="gr-titulo">¿Para qué comida?</h2>

        <div className="gr-opciones" role="group" aria-labelledby="gr-titulo">
          {COMIDAS.map((m) => (
            <button key={m} type="button" className="gr-opcion" onClick={() => elegir(m)}>
              {NOMBRE_MOMENTO[m]}
            </button>
          ))}
        </div>

        <button type="button" className="gr-cancelar" onClick={() => dialogo.current?.close()}>Cancelar</button>
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
