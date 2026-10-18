// C14 · Control de demo: elige el recomendador (?motor=grafo|base, §4.3) para comparar en vivo. Discreto a propósito:
// texto chico y gris, sin color de acción. La pastilla blanca se desliza a la opción elegida.
import { motion } from 'motion/react'
import { useId } from 'react'
import type { Motor } from '../../../shared/contratos'

const OPCIONES: { valor: Motor; texto: string }[] = [
  { valor: 'grafo', texto: 'Grafo' },
  { valor: 'base', texto: 'Base' },
]

export function SwitchMotor({ motor, onCambio }: { motor: Motor; onCambio: (m: Motor) => void }) {
  const nombre = useId()
  return (
    <fieldset className="flex min-w-0 items-center justify-end gap-3">
      <legend className="float-left text-xs text-musgo">
        Recomendador <span className="whitespace-nowrap">(para comparar)</span>
      </legend>
      <div className="inline-flex rounded-full bg-muted p-1">
        {OPCIONES.map((o) => (
          // El label mide 48 px de alto (objetivo táctil); la pastilla visible, 40.
          <label key={o.valor} className="relative -my-1 inline-flex cursor-pointer py-1">
            <input
              type="radio"
              name={nombre}
              value={o.valor}
              checked={motor === o.valor}
              onChange={() => onCambio(o.valor)}
              className="peer absolute inset-0 m-0 cursor-pointer opacity-0"
            />
            {motor === o.valor && (
              <motion.span
                layoutId={`${nombre}-activo`}
                className="absolute inset-x-0 inset-y-1 rounded-full bg-background ring-1 ring-border"
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              />
            )}
            <span className="relative flex h-10 min-w-16 items-center justify-center rounded-full px-3 text-sm font-bold text-musgo transition-colors peer-checked:text-pino peer-focus-visible:outline-3 peer-focus-visible:outline-offset-1 peer-focus-visible:outline-verde">
              {o.texto}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
