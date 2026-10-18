// Cobertura semanal por nutriente (§1, el indicador principal). Para el padre, un estado por nutriente (Cubierto /
// Casi / Le falta, src/lib/cobertura.ts) y una barra que se llena hasta lo recomendado y no pasa. Al tocar, el detalle:
// cuánto comió el último día y, si no llega, qué porcentaje de lo recomendado lleva la semana (nunca más de 100%).
// Un acordeón (se abre uno por vez); las barras se llenan una vez, cuando se ven.
import { ChevronDown, Flame } from 'lucide-react'
import { useId } from 'react'
import type { CoberturaDia, Nutriente, Progreso } from '../../../shared/contratos'
import { BarraEstado, EtiquetaEstado } from '../../componentes/EstadoNutriente'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../../componentes/ui/accordion'
import { contarEstados, estadoCobertura, fraccionBarra, porcentajeTope, resumenEstados } from '../../lib/cobertura'
import { diaUruguay } from '../../lib/nino'
import { formatoNutriente, NOMBRE_NUTRIENTE } from '../../lib/vocabulario'
import { etiquetaDia, mayuscula, ordenarNutrientes, textoEnergia } from './calculos'

interface Props { semana: Progreso['semana']; dia: CoberturaDia | null }

export function Cobertura({ semana, dia }: Props) {
  const idBase = useId()
  const orden = ordenarNutrientes(semana.faltan)
  const cuenta = contarEstados(semana.cobertura, orden)

  return (
    <section className="rounded-2xl border bg-card px-4 pt-4 pb-1" aria-labelledby={`${idBase}-t`}>
      <h2 id={`${idBase}-t`} className="text-xl">Nutrientes de la semana</h2>
      <p className="mt-1 text-sm text-musgo tabular-nums">{resumenEstados(cuenta)}</p>

      <Accordion
        type="single"
        collapsible
        asChild
        className="mt-1 rounded-none border-0 motion-reduce:**:data-[slot=accordion-content]:animate-none"
      >
        <ul>
          {orden.map((n) => {
            const cobertura = semana.cobertura[n] ?? 0
            const estado = estadoCobertura(cobertura)
            return (
              <AccordionItem key={n} value={n} asChild className="data-open:bg-transparent">
                <li>
                  <AccordionTrigger className="flex-col items-stretch gap-2.5 rounded-xl px-0 py-3.5 text-base font-normal hover:no-underline focus-visible:ring-[3px] focus-visible:ring-ring/50 [&>svg[data-slot=accordion-trigger-icon]]:hidden">
                    <span className="flex items-center gap-2.5 leading-tight">
                      <span className="mr-auto font-bold">{NOMBRE_NUTRIENTE[n]}</span>
                      <EtiquetaEstado estado={estado} />
                      <ChevronDown
                        className="size-4.5 shrink-0 text-musgo transition-transform duration-200 ease-salida group-aria-expanded/accordion-trigger:rotate-180 motion-reduce:transition-none"
                        strokeWidth={2.25}
                        aria-hidden="true"
                      />
                    </span>
                    <BarraEstado estado={estado} fraccion={fraccionBarra(cobertura)} gruesa />
                  </AccordionTrigger>
                  <AccordionContent className="h-auto pb-3.5 text-base text-pino">
                    <Detalle nutriente={n} cobertura={cobertura} dia={dia} />
                  </AccordionContent>
                </li>
              </AccordionItem>
            )
          })}
        </ul>
      </Accordion>
      <p className="pt-1 pb-3.5 text-xs text-musgo">Barra llena: lo recomendado para su edad.</p>

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

/** "Semana: 40% de lo recomendado. Hoy: 12 mg de 600 mg por día." El porcentaje solo si no llega (si llega, ya dice Cubierto). */
function Detalle({ nutriente: n, cobertura, dia }: { nutriente: Nutriente; cobertura: number; dia: CoberturaDia | null }) {
  const objetivo = dia?.objetivo[n] ?? 0
  if (cobertura >= 1 && !(dia && objetivo > 0)) return null
  return (
    <p className="flex flex-col gap-1 rounded-xl bg-muted px-3.5 py-3 text-pretty">
      {cobertura < 1 && (
        <span>Semana: <strong className="tabular-nums">{porcentajeTope(cobertura)}</strong> de lo recomendado.</span>
      )}
      {dia && objetivo > 0 ? (
        <span>
          {mayuscula(etiquetaDia(dia.dia, diaUruguay()))}:{' '}
          <strong className="tabular-nums">{formatoNutriente(n, dia.consumido.valor[n] ?? 0)}</strong> de{' '}
          <span className="tabular-nums">{formatoNutriente(n, objetivo)}</span> por día.
        </span>
      ) : null}
    </p>
  )
}
