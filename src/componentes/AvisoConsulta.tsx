// Las señales de alerta (§10.4), cortas y calmas: una línea a la vista ("Consultá a su pediatra" + lo principal de la
// primera) y el resto en "Ver más". Derivan al profesional, sin alarmar. La usan el inicio, la semana y el resultado.
import type { Alerta } from '../../shared/contratos'
import { primeraFrase } from '../lib/proximaComida'
import './aviso-consulta.css'

export function AvisoConsulta({ alertas }: { alertas: Alerta[] }) {
  if (!alertas.length) return null
  const principal = primeraFrase(alertas[0].texto)
  const hayMas = alertas.length > 1 || principal !== alertas[0].texto.trim()
  return (
    <section className="ac" aria-label="Para consultar con su pediatra">
      <svg className="ac-icono" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M12 7v6M12 16.5v.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
      <div className="ac-cuerpo">
        <p className="ac-linea"><strong>Consultá a su pediatra.</strong> {principal}</p>
        {hayMas && (
          <details className="nb-ver-mas ac-mas">
            <summary>Ver más{alertas.length > 1 ? ` (${alertas.length})` : ''}</summary>
            <ul>
              {alertas.map((a, i) => <li key={`${a.tipo}-${i}`}>{a.texto}</li>)}
            </ul>
            <p className="ac-nota">No es un diagnóstico.</p>
          </details>
        )}
      </div>
    </section>
  )
}
