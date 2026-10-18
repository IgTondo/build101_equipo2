// Elegir para qué nutriente es la receta: primero lo que le falta esta semana (con su %), después el resto.
// Son radios de verdad (flechas del teclado, lectores de pantalla) con forma de chip; la pastilla verde se desliza
// hasta el elegido. Lo que le falta va en filas, cada una con su anillito Zapallo (cuánto cubrió de la referencia);
// los demás, en chips.
import { cn } from 'cn'
import { LayoutGroup, motion } from 'motion/react'
import type { Nutriente, Progreso } from '../../../shared/contratos'
import { Anillo } from '../../componentes/Anillo'
import { NOMBRE_NUTRIENTE, NUTRIENTES_CON_META, porcentaje } from '../../lib/vocabulario'

interface Props {
  semana: Progreso['semana'] | null     // null = no se pudo cargar el progreso: se muestran todos, sin %
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
          'group relative inline-flex cursor-pointer items-center gap-2.5 rounded-full border bg-background text-pino transition-colors duration-200 has-checked:border-transparent has-checked:text-primary-foreground has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-verde',
          falta ? 'h-14 w-full pr-5 pl-3' : 'h-12 px-4',
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
        {falta && semana && (
          <span className="pointer-events-none relative" aria-hidden="true">
            <Anillo valor={semana.cobertura[n]} tamano={32} grosor={5} color="var(--nb-zapallo)" pista="var(--nb-zapallo-claro)" />
          </span>
        )}
        <span className="pointer-events-none relative font-bold">{NOMBRE_NUTRIENTE[n]}</span>
        {semana && (
          <span className={cn(
            'pointer-events-none relative text-sm text-musgo tabular-nums transition-colors duration-200 group-has-checked:text-primary-foreground/85',
            falta && 'ml-auto',
          )}>
            {porcentaje(semana.cobertura[n])}
          </span>
        )}
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
      {semana && <p className="mt-5 text-xs text-musgo text-pretty">El % es cuánto cubrió esta semana de la referencia para su edad (aproximado).</p>}
    </fieldset>
  )
}
