// Elegir para qué nutriente es la receta: primero lo que le falta esta semana (con su %), después el resto.
import type { Nutriente, Progreso } from '../../../shared/contratos'
import { NOMBRE_NUTRIENTE, NUTRIENTES_CON_META, porcentaje } from '../../lib/vocabulario'

interface Props {
  semana: Progreso['semana'] | null     // null = no se pudo cargar el progreso: se muestran todos, sin %
  valor: Nutriente | undefined
  onCambiar: (n: Nutriente) => void
}

export function SelectorNutriente({ semana, valor, onCambiar }: Props) {
  const faltan: Nutriente[] = semana?.faltan.filter((n) => n !== 'energia_kcal') ?? []
  const resto = NUTRIENTES_CON_META.filter((n) => !faltan.includes(n))

  const opcion = (n: Nutriente) => (
    <label key={n} className="rc-opcion">
      <input type="radio" name="nutriente" value={n} checked={valor === n} onChange={() => onCambiar(n)} />
      <span>{NOMBRE_NUTRIENTE[n]}</span>
      {semana && <span className="rc-opcion-pct nb-numero">{porcentaje(semana.cobertura[n])}</span>}
    </label>
  )

  return (
    <fieldset className="rc-selector">
      <legend>¿Qué le querés sumar?</legend>
      {faltan.length > 0 && (
        <>
          <p className="rc-selector-grupo">Le falta esta semana</p>
          <div className="rc-opciones">{faltan.map(opcion)}</div>
          <p className="rc-selector-grupo">Los demás</p>
        </>
      )}
      <div className="rc-opciones">{resto.map(opcion)}</div>
      {semana && <p className="rc-nota">El % es cuánto cubrió esta semana de la referencia para su edad (aproximado).</p>}
    </fieldset>
  )
}
