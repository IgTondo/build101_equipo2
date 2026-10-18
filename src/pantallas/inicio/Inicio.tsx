import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import type { Progreso } from '../../shared/contratos'
import { PerfilNoEncontrado } from '../componentes/PerfilNoEncontrado'
import { ErrorDeApi, pedirConMeta } from '../lib/api'
import { useNinoActivo } from '../lib/nino'

export function Inicio() {
  const ninoId = useNinoActivo()
  const { search } = useLocation()
  const [progreso, setProgreso] = useState<{ datos: Progreso; stub: boolean } | null>(null)
  const [error, setError] = useState<ErrorDeApi | string | null>(null)

  useEffect(() => {
    const control = new AbortController()
    setProgreso(null)
    setError(null)
    pedirConMeta<Progreso>(`/api/progreso?ninoId=${encodeURIComponent(ninoId)}&dias=28`, { senal: control.signal })
      .then(setProgreso)
      .catch((e) => { if (!control.signal.aborted) setError(e instanceof ErrorDeApi ? e : String(e)) })
    return () => control.abort()
  }, [ninoId])

  if (error instanceof ErrorDeApi && error.codigo === 'no_encontrado') return <PerfilNoEncontrado />

  return (
    <>
      <section className="nb-tarjeta">
        <h1>¿Está comiendo bien?</h1>
        {progreso && <p className="nb-frase">{progreso.datos.frase}</p>}
        {progreso?.stub && <p className="nb-chip">Datos de ejemplo</p>}
        {error && <p role="alert">{error instanceof ErrorDeApi ? error.message : 'Algo falló de nuestro lado. ¿Probás de nuevo?'}</p>}
        {!progreso && !error && <p className="nb-suave">Cargando…</p>}
      </section>
      <Link className="nb-boton" to={{ pathname: '/registrar', search }}>Registrar una comida</Link>
      <Link className="nb-boton nb-boton-secundario" to={{ pathname: '/tablero', search }}>Ver cómo viene</Link>
    </>
  )
}
