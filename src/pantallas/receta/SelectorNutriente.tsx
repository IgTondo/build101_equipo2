// Elegir para qué nutriente es la receta: primero lo que le falta esta semana, después el resto. Sin porcentajes.
// Son radios de verdad (flechas del teclado, lectores de pantalla) con forma de chip; la pastilla verde se desliza
// hasta el elegido. Lo que le falta va en filas, cada una con su punto Zapallo; los demás, en chips.
import { cn } from 'cn'
import { LayoutGroup, motion } from 'motion/react'
import type { Nutriente, Progreso } from '../../../shared/contratos'
import { NOMBRE_NUTRIENTE, NUTRIENTES_CON_META } from '../../lib/vocabulario'

interface Props {
  semana: Progreso['semana'] | null     // null = no se pudo cargar el progreso: se muestran todos juntos
  valor: Nutriente | undefined
  onCambiar: (n: Nutriente) => void
}

export function SelectorNutriente({ semana, valor, onCambiar }: Props) {
  const faltan: Nutriente[] = semana?.faltan.filter((n) => n !== 'energia_kcal') ?? []
  const resto = NUTRIENTES_CON_META.filter((n) => !faltan.includes(n))

  const opcion = (n: Nutriente, falta: boolean) => {
    const elegido = valor === n
    return (
      <label
        key={n}
        className={cn(
          'group relative inline-flex cursor-pointer items-center gap-3 rounded-full border bg-background text-pino transition-colors duration-200 has-checked:border-transparent has-checked:text-primary-foreground has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-verde',
          falta ? 'h-14 w-full px-5' : 'h-12 px-4',
        )}
      >
        <input
          type="radio" name="nutriente" value={n} checked={elegido} onChange={() => onCambiar(n)}
          className="absolute inset-0 m-0 cursor-pointer opacity-0"
        />
        {elegido && (
          <motion.span
            layoutId="rc-nutriente-elegido"
            className="absolute inset-0 rounded-full bg-primary"
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
          />
        )}
        {/* El punto es el color de lo que le falta; en palabras lo dice el rótulo del grupo. */}
        {falta && <span className="pointer-events-none relative size-2.5 shrink-0 rounded-full bg-zapallo" aria-hidden="true" />}
        <span className="pointer-events-none relative font-bold">{NOMBRE_NUTRIENTE[n]}</span>
      </label>
    )
  }

  return (
    <fieldset className="m-0 min-w-0 border-0 p-0">
      <legend className="mb-1 p-0 font-titulo text-xl font-extrabold">¿Qué le querés sumar?</legend>
      <LayoutGroup id="rc-nutrientes">
        {faltan.length > 0 && (
          <>
            <p className="mt-4 mb-2.5 text-sm font-bold text-musgo">Le falta esta semana</p>
            <div className="flex flex-col gap-2">{faltan.map((n) => opcion(n, true))}</div>
            <p className="mt-6 mb-2.5 text-sm font-bold text-musgo">Los demás</p>
          </>
        )}
        <div className="flex flex-wrap gap-2">{resto.map((n) => opcion(n, false))}</div>
      </LayoutGroup>
    </fieldset>
  )
}
