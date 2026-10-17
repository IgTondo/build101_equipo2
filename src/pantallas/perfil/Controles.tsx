// Controles del formulario del perfil: campo con etiqueta y error conectados, chips de alternar (aria-pressed)
// y opciones únicas (radios con forma de chip).
import { useId, type InputHTMLAttributes, type ReactNode, type Ref } from 'react'
import { IconoCheck } from './Iconos'

interface CampoProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'onChange'> {
  etiqueta: ReactNode
  ayuda?: ReactNode
  error?: string
  valor: string
  alCambiar: (v: string) => void
  ref?: Ref<HTMLInputElement>
}

export function Campo({ etiqueta, ayuda, error, valor, alCambiar, ref, ...resto }: CampoProps) {
  const id = useId()
  const describe = [ayuda ? `${id}-ayuda` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined
  return (
    <div className="pf-campo">
      <label htmlFor={id}>{etiqueta}</label>
      {ayuda && <p id={`${id}-ayuda`} className="pf-ayuda">{ayuda}</p>}
      <input
        ref={ref} id={id} className="pf-input" value={valor} onChange={(e) => alCambiar(e.target.value)}
        aria-invalid={error ? true : undefined} aria-describedby={describe} {...resto}
      />
      {error && <p id={`${id}-error`} className="pf-error">{error}</p>}
    </div>
  )
}

export function ChipAlternar({ activo, alTocar, children }: { activo: boolean; alTocar: () => void; children: ReactNode }) {
  return (
    <button type="button" className="pf-chip" aria-pressed={activo} onClick={alTocar}>
      <span className="pf-chip-check" aria-hidden="true">{activo && <IconoCheck />}</span>
      {children}
    </button>
  )
}

interface OpcionesProps<T extends string> {
  leyenda: ReactNode
  nombre: string
  opciones: readonly T[]
  etiquetas: Record<T, string>
  valor: T | ''
  alCambiar: (v: T) => void
  error?: string
  ayuda?: ReactNode
  refPrimera?: Ref<HTMLInputElement>
}

export function OpcionUnica<T extends string>({ leyenda, nombre, opciones, etiquetas, valor, alCambiar, error, ayuda, refPrimera }: OpcionesProps<T>) {
  const id = useId()
  const describe = [ayuda ? `${id}-ayuda` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined
  return (
    <fieldset className="pf-grupo" aria-describedby={describe}>
      <legend>{leyenda}</legend>
      {ayuda && <p id={`${id}-ayuda`} className="pf-ayuda">{ayuda}</p>}
      <div className="pf-chips">
        {opciones.map((o, i) => (
          <label key={o} className="pf-chip pf-radio">
            <input
              ref={i === 0 ? refPrimera : undefined} type="radio" name={nombre} value={o}
              checked={valor === o} onChange={() => alCambiar(o)}
            />
            <span className="pf-chip-check" aria-hidden="true">{valor === o && <IconoCheck />}</span>
            {etiquetas[o]}
          </label>
        ))}
      </div>
      {error && <p id={`${id}-error`} className="pf-error">{error}</p>}
    </fieldset>
  )
}
