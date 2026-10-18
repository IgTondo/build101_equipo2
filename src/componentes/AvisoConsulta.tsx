// Las señales de alerta (§10.4), cortas y calmas: una línea a la vista ("Consultá a su pediatra" + lo principal de la
// primera) y el resto en "Ver más". Derivan al profesional, sin alarmar: un aviso tibio (Zapallo claro, nunca rojo) con
// el estetoscopio. La usan el inicio, la semana y el resultado.
import { Stethoscope } from 'lucide-react'
import type { Alerta } from '../../shared/contratos'
import { primeraFrase } from '../lib/proximaComida'

export function AvisoConsulta({ alertas }: { alertas: Alerta[] }) {
  if (!alertas.length) return null
  const principal = primeraFrase(alertas[0].texto)
  const hayMas = alertas.length > 1 || principal !== alertas[0].texto.trim()
  return (
    <section className="flex items-start gap-3 rounded-2xl bg-zapallo-claro p-4 pr-5 text-sm" aria-label="Para consultar con su pediatra">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-background text-pino">
        <Stethoscope className="size-5" strokeWidth={2.25} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1 pt-2.5">
        <p className="text-pretty"><strong>Consultá a su pediatra.</strong> {principal}</p>
        {hayMas && (
          // "Ver más" compartido (.nb-ver-mas, src/index.css), en Verde noche: sobre Zapallo claro el Verde hondo no llega a AA.
          <details className="nb-ver-mas -mb-2.5 open:mb-0 [&>summary]:text-verde-noche">
            <summary>Ver más{alertas.length > 1 ? ` (${alertas.length})` : ''}</summary>
            <ul className="flex list-disc flex-col gap-1 pl-[1.1em]">
              {alertas.map((a, i) => <li key={`${a.tipo}-${i}`}>{a.texto}</li>)}
            </ul>
            <p className="mt-1.5 text-xs text-musgo">No es un diagnóstico.</p>
          </details>
        )}
      </div>
    </section>
  )
}
