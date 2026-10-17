import { Link, useLocation } from 'react-router-dom'

export function Pendiente({ titulo, tarea }: { titulo: string; tarea?: string }) {
  const { search } = useLocation()
  return (
    <section className="nb-tarjeta">
      <h1>{titulo}</h1>
      <p className="nb-suave">{tarea ? `Esta pantalla llega con la tarea ${tarea}.` : 'Volvé al inicio para seguir.'}</p>
      <Link className="nb-boton nb-boton-secundario" to={{ pathname: '/', search }}>Ir al inicio</Link>
    </section>
  )
}
