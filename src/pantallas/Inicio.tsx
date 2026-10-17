import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import type { Progreso } from '../../shared/contratos'
import { ErrorDeApi, pedirConMeta } from '../lib/api'
import { useNino } from '../lib/nino'

export function Inicio() {
  const ninoId = useNino()
  const { search } = useLocation()
  const [progreso, setProgreso] = useState<{ datos: Progreso; stub: boolean } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const control = new AbortController()
    pedirConMeta<Progreso>(`/api/progreso?ninoId=${encodeURIComponent(ninoId)}&dias=28`, { senal: control.signal })
      .then(setProgreso)
      .catch((e) => { if (!control.signal.aborted) setError(e instanceof ErrorDeApi ? e.message : String(e)) })
    return () => control.abort()
  }, [ninoId])

  return (
    <>
      <section className="nb-tarjeta">
        <h1>¿Está comiendo bien?</h1>
        {progreso && <p className="nb-frase">{progreso.datos.frase}</p>}
        {progreso?.stub && <p className="nb-chip">Datos de ejemplo</p>}
        {error && <p role="alert">{error}</p>}
        {!progreso && !error && <p className="nb-suave">Cargando…</p>}
      </section>
      <Link className="nb-boton" to={{ pathname: '/registrar', search }}>Registrar una comida</Link>
      <Link className="nb-boton nb-boton-secundario" to={{ pathname: '/tablero', search }}>Ver cómo viene</Link>
    </>
  )
}
