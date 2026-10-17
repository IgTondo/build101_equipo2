// Estados compartidos de las pantallas (C9). Tono calmo: nunca alarmar al padre.
import type { ReactNode } from 'react'
import type { ErrorDeApi } from '../lib/api'

export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <p className="nb-cargando" role="status" aria-live="polite">
      <span className="nb-puntos" aria-hidden="true"><span /><span /><span /></span>
      {texto}
    </p>
  )
}

export function ErrorConReintento({ error, reintentar }: { error: ErrorDeApi; reintentar?: () => void }) {
  return (
    <div className="nb-tarjeta nb-aviso" role="alert">
      <p>{error.message}</p>
      {error.reintentable && reintentar && (
        <button type="button" className="nb-boton nb-boton-secundario" onClick={reintentar}>Reintentar</button>
      )}
    </div>
  )
}

export function Vacio({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <div className="nb-tarjeta nb-vacio">
      <h2>{titulo}</h2>
      {children}
    </div>
  )
}
