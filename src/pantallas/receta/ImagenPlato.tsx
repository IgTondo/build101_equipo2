// La imagen de cómo servirlo: se pide aparte, después de la receta, con un esqueleto mientras llega.
// v5.3: con `plato` (la receta es el pasito de ese plato), se dibuja el plato completo: lo seguro + el pasito al costado.
import { useEffect, useState } from 'react'
import type { PlatoComida, Receta, Regla } from '../../../shared/contratos'
import { api } from '../../lib/api'
import { altPlato } from '../../lib/platoComida'

type Estado = { tipo: 'cargando' } | { tipo: 'ok'; src: string } | { tipo: 'error' }

/** `reglas` en null = el perfil todavía no llegó: se espera para no dibujar algo que el chico rechaza. */
export function ImagenPlato({ receta, reglas, plato }: { receta: Receta; reglas: Regla[] | null; plato?: PlatoComida }) {
  const [estado, setEstado] = useState<Estado>({ tipo: 'cargando' })
  const [cargada, setCargada] = useState(false)
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    if (reglas === null) return
    const control = new AbortController()
    setEstado({ tipo: 'cargando' })
    setCargada(false)
    api.imagenPlato({ receta, reglas, ...(plato ? { plato } : {}) }, control.signal)
      .then((r) => { if (!control.signal.aborted) setEstado({ tipo: 'ok', src: `data:${r.mime};base64,${r.imagenBase64}` }) })
      .catch(() => { if (!control.signal.aborted) setEstado({ tipo: 'error' }) })
    return () => control.abort()
  }, [receta, reglas, plato, intento])

  if (estado.tipo === 'error') {
    return (
      <div className="rc-imagen-error">
        <p>No pudimos preparar la imagen. La receta sirve igual.</p>
        <button type="button" className="nb-boton nb-boton-secundario rc-boton-chico" onClick={() => setIntento((i) => i + 1)}>
          Probar de nuevo
        </button>
      </div>
    )
  }

  const lista = estado.tipo === 'ok' && cargada
  return (
    <figure className="rc-figura">
      <div className="rc-imagen-marco" data-lista={lista}>
        {!lista && <div className="rc-esqueleto" aria-hidden="true" />}
        {estado.tipo === 'ok' && (
          <img src={estado.src} alt={plato ? altPlato(plato, receta.nombre) : `Cómo servirlo: ${receta.presentacion}`} onLoad={() => setCargada(true)} onError={() => setEstado({ tipo: 'error' })} />
        )}
      </div>
      <figcaption>
        <span role="status" aria-live="polite">{lista ? (plato ? 'Todo el plato · imagen ilustrativa' : 'Imagen ilustrativa') : 'Preparando la imagen ilustrativa…'}</span>
      </figcaption>
    </figure>
  )
}
