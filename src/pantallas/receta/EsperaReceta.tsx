// La espera de la receta (unos 10 s): un plato que recibe un bocadito por etapa y las etapas en fila, la actual con los
// bocaditos que saltan y las hechas con su tilde. Lo que se lee (role=status) es solo el texto de la etapa actual.
import { cn } from 'cn'
import { Check } from 'lucide-react'
import { motion } from 'motion/react'
import { Bocaditos } from '../../componentes/Estados'

const RESORTE = { type: 'spring', stiffness: 420, damping: 22 } as const

// Dónde cae cada bocadito en el plato (viewBox 120 × 120), con los colores de los Bocaditos.
const BOCADOS = [
  { cx: 49, cy: 55, r: 8, color: 'var(--nb-verde)' },
  { cx: 71, cy: 51, r: 7, color: 'var(--nb-zapallo)' },
  { cx: 61, cy: 72, r: 7.5, color: 'var(--nb-grupo-cereal)' },
]

function PlatoQueSeLlena({ etapa }: { etapa: number }) {
  return (
    <svg viewBox="0 0 120 120" className="size-36" aria-hidden="true">
      <circle cx="60" cy="60" r="56" fill="#fff" />
      <circle cx="60" cy="60" r="40" fill="none" stroke="var(--nb-hoja)" strokeWidth="2" />
      {BOCADOS.map((b, i) => i <= etapa && (
        <motion.circle
          key={i} cx={b.cx} cy={b.cy} r={b.r} fill={b.color}
          initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ ...RESORTE, delay: 0.1 }}
        />
      ))}
    </svg>
  )
}

export function EsperaReceta({ titulo, etapas, etapa }: { titulo: string; etapas: string[]; etapa: number }) {
  return (
    <section aria-labelledby="rc-progreso-titulo" className="flex flex-col gap-6">
      <h1 id="rc-progreso-titulo" className="text-3xl font-black">{titulo}</h1>
      <p role="status" aria-live="polite" className="sr-only">{etapas[etapa]}</p>
      <div className="flex flex-col items-center gap-7 rounded-3xl bg-brote px-6 pt-8 pb-7">
        <PlatoQueSeLlena etapa={etapa} />
        <ol aria-hidden="true" className="flex w-full max-w-xs flex-col gap-3.5">
          {etapas.map((t, i) => {
            const hecha = i < etapa
            const actual = i === etapa
            return (
              <li key={t} className="flex min-h-8 items-center gap-3">
                {/* La marca: tilde si está hecha, los bocaditos saltando si es la actual, un aro si falta. */}
                <span className="grid w-11 shrink-0 place-items-center">
                  {actual ? <Bocaditos /> : (
                    <span className={cn(
                      'grid size-7 place-items-center rounded-full',
                      hecha ? 'bg-verde text-primary-foreground' : 'border-2 border-hoja bg-background',
                    )}>
                      {hecha && (
                        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={RESORTE}>
                          <Check className="size-4" strokeWidth={3} />
                        </motion.span>
                      )}
                    </span>
                  )}
                </span>
                <span className={cn('transition-colors duration-300', actual ? 'text-pino' : 'text-musgo')}>
                  {t.replace('…', '')}
                </span>
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}
