// C14 · Control de demo: elige el recomendador (?motor=grafo|base, §4.3) para comparar en vivo. Discreto a propósito.
import { useId } from 'react'
import type { Motor } from '../../../shared/contratos'

const OPCIONES: { valor: Motor; texto: string }[] = [
  { valor: 'grafo', texto: 'Grafo' },
  { valor: 'base', texto: 'Base' },
]

export function SwitchMotor({ motor, onCambio }: { motor: Motor; onCambio: (m: Motor) => void }) {
  const nombre = useId()
  return (
    <fieldset className="tb-motor">
      <legend>Recomendador <span className="tb-motor-nota">(para comparar)</span></legend>
      <div className="tb-motor-opciones">
        {OPCIONES.map((o) => (
          <label key={o.valor} className="tb-motor-opcion">
            <input
              type="radio"
              name={nombre}
              value={o.valor}
              checked={motor === o.valor}
              onChange={() => onCambio(o.valor)}
            />
            <span>{o.texto}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
