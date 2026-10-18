// Desayuno · Almuerzo · Merienda · Cena (PLAN v5.3): un control segmentado hecho con radios nativos, así el teclado
// (flechas) y el lector de pantalla funcionan solos. Cada opción es un objetivo de 48 px. No guarda nada.
import { useId } from 'react'
import type { ComidaPlan } from '../lib/proximaComida'
import { NOMBRE_MOMENTO } from '../lib/vocabulario'

export const COMIDAS_PLAN: readonly ComidaPlan[] = ['desayuno', 'almuerzo', 'merienda', 'cena']

export function SelectorComida({ valor, onCambiar }: { valor: ComidaPlan; onCambiar: (m: ComidaPlan) => void }) {
  const nombre = useId()
  return (
    <fieldset className="sc">
      <legend className="nb-oculto">¿Para qué comida?</legend>
      {COMIDAS_PLAN.map((m) => (
        <label key={m} className="sc-opcion">
          <input type="radio" name={nombre} value={m} checked={valor === m} onChange={() => onCambiar(m)} />
          <span>{NOMBRE_MOMENTO[m]}</span>
        </label>
      ))}
    </fieldset>
  )
}
