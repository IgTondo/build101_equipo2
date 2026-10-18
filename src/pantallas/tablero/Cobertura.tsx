// Cobertura semanal por nutriente (§1, el indicador principal): barras contra lo recomendado; al tocar, el último día.
// Las barras se llenan una vez, cuando se ven. Lo que falta va en Zapallo (con el texto "Le falta", nunca solo el color).
import { ChevronDown, Flame } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useId } from 'react'
import type { CoberturaDia, Nutriente, Progreso } from '../../../shared/contratos'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../../componentes/ui/accordion'
import { diaUruguay } from '../../lib/nino'
import { formatoNutriente, NOMBRE_NUTRIENTE, porcentaje } from '../../lib/vocabulario'
import { escalaBarra, etiquetaDia, MARCA_100, mayuscula, ordenarNutrientes, textoEnergia } from './calculos'
import { EASE_DATOS } from './visual'

interface Props { semana: Progreso['semana']; dia: CoberturaDia | null }

export function Cobertura({ semana, dia }: Props) {
  const idBase = useId()
  const orden = ordenarNutrientes(semana.faltan)
  const cubiertos = orden.filter((n) => !semana.faltan.includes(n)).length

  return (
    <section className="rounded-2xl border bg-card px-4 pt-4 pb-1" aria-labelledby={`${idBase}-t`}>
      <h2 id={`${idBase}-t`} className="text-xl">Nutrientes de la semana</h2>

      <div className="relative mt-3 h-5 text-xs text-musgo" aria-hidden="true">
        <span className="absolute bottom-0 -translate-x-1/2 whitespace-nowrap" style={{ left: `${MARCA_100 * 100}%` }}>
          Lo recomendado
        </span>
      </div>

      <Accordion
        type="single"
        collapsible
        asChild
        className="rounded-none border-0 motion-reduce:**:data-[slot=accordion-content]:animate-none"
      >
        <ul aria-label={`Cobertura semanal: ${cubiertos} de ${orden.length} nutrientes por encima del 70%`}>
          {orden.map((n, i) => (
            <AccordionItem key={n} value={n} asChild className="data-open:bg-transparent">
              <li>
                <Barra nutriente={n} cobertura={semana.cobertura[n] ?? 0} falta={semana.faltan.includes(n)} orden={i} />
                <AccordionContent className="h-auto pb-3.5 text-base text-pino">
                  <DetalleDia nutriente={n} dia={dia} />
                </AccordionContent>
              </li>
            </AccordionItem>
          ))}
        </ul>
      </Accordion>

      <p className="flex items-center gap-3 border-t py-3.5">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-muted text-musgo" aria-hidden="true">
          <Flame className="size-5" strokeWidth={2.25} />
        </span>
        <span className="flex flex-col leading-snug">
          <span className="text-sm text-musgo">Energía aproximada</span>
          <strong className="tabular-nums">{textoEnergia(semana.energiaPromedioKcal)}</strong>
        </span>
      </p>
    </section>
  )
}

function Barra({ nutriente: n, cobertura, falta, orden }: { nutriente: Nutriente; cobertura: number; falta: boolean; orden: number }) {
  const reducir = useReducedMotion()
  const { fraccion, recortada } = escalaBarra(cobertura)
  const ancho = `${fraccion * 100}%`
  return (
    <AccordionTrigger className="flex-col items-stretch gap-2.5 rounded-xl px-0 py-3.5 text-base font-normal hover:no-underline focus-visible:ring-[3px] focus-visible:ring-ring/50 [&>svg[data-slot=accordion-trigger-icon]]:hidden">
      <span className="flex items-center gap-2 leading-tight">
        <span className="font-bold">{NOMBRE_NUTRIENTE[n]}</span>
        {falta && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-zapallo-claro px-2 py-0.5 text-xs font-bold text-pino">
            <span className="size-2 rounded-full bg-zapallo" aria-hidden="true" />
            Le falta
          </span>
        )}
        <span className="ml-auto font-bold tabular-nums">
          {porcentaje(cobertura)}<span className="sr-only"> de lo recomendado</span>
        </span>
        <ChevronDown
          className="size-4.5 shrink-0 text-musgo transition-transform duration-200 ease-salida group-aria-expanded/accordion-trigger:rotate-180 motion-reduce:transition-none"
          strokeWidth={2.25}
          aria-hidden="true"
        />
      </span>
      <span className={`relative block h-3 rounded-full ${falta ? 'bg-zapallo-claro' : 'bg-brote'}`} aria-hidden="true">
        <motion.span
          className={`absolute inset-y-0 left-0 block min-w-1.5 overflow-hidden rounded-full ${falta ? 'bg-zapallo' : 'bg-verde'}`}
          initial={reducir ? false : { width: 0 }}
          whileInView={{ width: ancho }}
          style={reducir ? { width: ancho } : undefined}
          viewport={{ once: true, amount: 0.8 }}
          transition={{ duration: 0.8, delay: orden * 0.05, ease: EASE_DATOS }}
        >
          {/* Más del 120%: la barra se corta con un quiebre (como un eje partido); el número dice el valor real. */}
          {recortada && <span className="absolute inset-y-0 right-3 w-1 -skew-x-[20deg] bg-card" />}
        </motion.span>
        <span className="absolute -inset-y-1 -ml-px w-0.5 rounded-full bg-pino/55" style={{ left: `${MARCA_100 * 100}%` }} />
      </span>
    </AccordionTrigger>
  )
}

function DetalleDia({ nutriente: n, dia }: { nutriente: Nutriente; dia: CoberturaDia | null }) {
  if (!dia) return <p className="text-musgo">Todavía no hay un día registrado.</p>
  const valor = dia.consumido.valor[n] ?? 0
  const objetivo = dia.objetivo[n] ?? 0
  return (
    <p className="rounded-xl bg-muted px-3.5 py-3 text-pretty">
      <strong>{mayuscula(etiquetaDia(dia.dia, diaUruguay()))}</strong>
      {': '}
      <span className="tabular-nums">{formatoNutriente(n, valor)}</span>
      <span className="text-musgo"> (entre {formatoNutriente(n, dia.consumido.min[n] ?? 0)} y {formatoNutriente(n, dia.consumido.max[n] ?? 0)})</span>
      {objetivo > 0 && <>, el <span className="tabular-nums">{porcentaje(dia.cobertura[n] ?? 0)}</span> de {formatoNutriente(n, objetivo)} por día.</>}
    </p>
  )
}
