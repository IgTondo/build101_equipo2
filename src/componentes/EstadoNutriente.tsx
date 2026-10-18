// El estado de un nutriente para el padre (src/lib/cobertura.ts): una etiqueta con ícono (nunca solo color) y una
// barra que se llena hasta lo recomendado y no pasa. Lo usan "Hoy" en el inicio y la semana.
import { ETIQUETA_ESTADO, type EstadoCobertura } from '../lib/cobertura'
import './estado-nutriente.css'

function Icono({ estado }: { estado: EstadoCobertura }) {
  return (
    <svg className="ne-icono" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" focusable="false">
      {estado === 'cubierto' && (
        <>
          <circle cx="7" cy="7" r="7" className="ne-icono-lleno" />
          <path d="M4 7.2l2 2 4-4.2" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {estado === 'casi' && (
        <>
          <circle cx="7" cy="7" r="6" className="ne-icono-aro" />
          <path d="M7 1a6 6 0 0 1 0 12z" className="ne-icono-lleno" />
        </>
      )}
      {estado === 'falta' && <circle cx="7" cy="7" r="6" className="ne-icono-aro" />}
    </svg>
  )
}

/** "✓ Cubierto" · "◐ Casi" · "○ Le falta". */
export function EtiquetaEstado({ estado }: { estado: EstadoCobertura }) {
  return (
    <span className={`ne-estado ne-${estado}`}>
      <Icono estado={estado} />
      {ETIQUETA_ESTADO[estado]}
    </span>
  )
}

/** Barra de 0 a lo recomendado (`fraccion` de 0 a 1, ya topeada). Decorativa: el estado va en la etiqueta. */
export function BarraEstado({ estado, fraccion, gruesa = false }: { estado: EstadoCobertura; fraccion: number; gruesa?: boolean }) {
  return (
    <span className={`ne-pista ne-${estado}${gruesa ? ' ne-pista-gruesa' : ''}`} aria-hidden="true">
      <span className="ne-relleno" style={{ width: `${Math.round(fraccion * 100)}%` }} />
    </span>
  )
}
