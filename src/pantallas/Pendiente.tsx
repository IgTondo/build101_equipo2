import { Link, useLocation } from 'react-router-dom'
import { Vacio } from '../componentes/Estados'
import { Button } from '../componentes/ui/button'

export function Pendiente({ titulo, tarea }: { titulo: string; tarea?: string }) {
  const { search } = useLocation()
  return (
    <Vacio titulo={titulo}>
      <p className="text-musgo">{tarea ? `Esta pantalla llega con la tarea ${tarea}.` : 'Volvé al inicio para seguir.'}</p>
      <Button asChild variant="secondary" className="mt-1">
        <Link to={{ pathname: '/', search }}>Ir al inicio</Link>
      </Button>
    </Vacio>
  )
}
