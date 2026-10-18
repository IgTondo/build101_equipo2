// Evolución de las últimas 4 semanas (§1): un gráfico con la misma escala (0 a lo recomendado) para el promedio de los
// 8 nutrientes (área verde) y el que más falta (línea Zapallo). Cada serie con su resumen en texto, y una tabla.
// El gráfico se dibuja una vez, cuando se ve; con movimiento reducido aparece quieto.
import { ChevronDown } from 'lucide-react'
import { useInView, useReducedMotion } from 'motion/react'
import { useId, useRef } from 'react'
import { Area, CartesianGrid, ComposedChart, LabelList, Line, ReferenceLine, XAxis, YAxis } from 'recharts'
import type { Nutriente, Progreso } from '../../../shared/contratos'
import { ChartContainer, ChartTooltip, type ChartConfig } from '../../componentes/ui/chart'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../../componentes/ui/collapsible'
import { NOMBRE_NUTRIENTE, porcentaje } from '../../lib/vocabulario'
import { coberturaPromedio, fechaCorta, textoEvolucion } from './calculos'

interface Serie { clave: 'promedio' | 'falta'; titulo: string; valores: number[] }
type Punto = { semana: string } & Partial<Record<Serie['clave'], number>>

export function Evolucion({ semanas, nutriente }: { semanas: Progreso['semanas']; nutriente?: Nutriente }) {
  const id = useId()
  const ref = useRef<HTMLDivElement>(null)
  const visto = useInView(ref, { once: true, amount: 0.5 })
  const reducir = useReducedMotion()
  const orden = [...semanas].sort((a, b) => a.desde.localeCompare(b.desde)).slice(-4)

  if (orden.length < 2) {
    return (
      <section className="flex flex-col gap-2" aria-labelledby={`${id}-t`}>
        <h2 id={`${id}-t`} className="text-xl">Cómo viene</h2>
        <p className="text-musgo text-pretty">Con dos semanas de registros vas a ver acá si mejora.</p>
      </section>
    )
  }

  const etiquetas = orden.map((s) => fechaCorta(s.desde))
  const series: Serie[] = [
    { clave: 'promedio', titulo: 'Promedio de los 8 nutrientes', valores: orden.map((s) => coberturaPromedio(s.cobertura)) },
  ]
  if (nutriente) {
    series.push({ clave: 'falta', titulo: `${NOMBRE_NUTRIENTE[nutriente]}, lo que más le falta`, valores: orden.map((s) => s.cobertura[nutriente] ?? 0) })
  }
  const datos: Punto[] = etiquetas.map((semana, i) => Object.assign({ semana }, ...series.map((s) => ({ [s.clave]: s.valores[i] }))))
  const tope = Math.max(1, ...series.flatMap((s) => s.valores))
  const config = {
    promedio: { label: 'Promedio de los 8 nutrientes', color: 'var(--nb-verde)' },
    falta: { label: nutriente ? NOMBRE_NUTRIENTE[nutriente] : '', color: 'var(--nb-zapallo)' },
  } satisfies ChartConfig
  const ultimo = datos.length - 1
  // Solo el último valor de cada serie va escrito en el gráfico: el de arriba, encima de su punto; el otro, debajo.
  const alFinal = (clave: Serie['clave']) => datos[ultimo][clave] ?? 0
  const otra = (clave: Serie['clave']) => (clave === 'promedio' ? 'falta' : 'promedio')
  const etiquetaFinal = (clave: Serie['clave']) => (props: { index?: number; value?: unknown; x?: unknown; y?: unknown }) => {
    const { index, value, x, y } = props
    if (index !== ultimo || typeof value !== 'number' || typeof x !== 'number' || typeof y !== 'number') return null
    const arriba = !series.some((s) => s.clave === otra(clave)) || alFinal(clave) >= alFinal(otra(clave))
    return (
      <text x={x} y={arriba ? y - 13 : y + 24} textAnchor="end" dx={6} className="fill-pino text-[13px] font-bold tabular-nums">
        {porcentaje(value)}
      </text>
    )
  }

  return (
    <section className="flex flex-col gap-3" aria-labelledby={`${id}-t`}>
      <h2 id={`${id}-t`} className="text-xl">Cómo viene</h2>

      <ul className="flex flex-col gap-2">
        {series.map((s) => (
          <li key={s.clave} className="flex items-start gap-2.5">
            <span
              className={s.clave === 'promedio' ? 'mt-1.5 size-3 shrink-0 rounded-[4px] bg-verde' : 'mt-2.5 h-[3px] w-3 shrink-0 rounded-full bg-zapallo'}
              aria-hidden="true"
            />
            <span className="flex flex-col leading-snug">
              <span className="font-bold">{s.titulo}</span>
              <span className="text-sm text-musgo">{textoEvolucion(s.valores[0], s.valores[s.valores.length - 1])} en {s.valores.length} semanas</span>
            </span>
          </li>
        ))}
      </ul>

      {/* El gráfico se arma recién cuando se ve, para que se dibuje delante del padre y no fuera de la pantalla. */}
      <div ref={ref} className="h-52">
        {visto && (
          <ChartContainer
            config={config}
            className="aspect-auto h-full w-full text-[13px]"
            role="img"
            aria-label={series.map((s) => `${s.titulo}: ${s.valores.map((v, i) => `semana del ${etiquetas[i]}, ${porcentaje(v)}`).join('; ')}`).join('. ')}
          >
            {/* Sin capa de teclado de Recharts: el gráfico es una imagen con su texto, y la tabla es la vista accesible. */}
            <ComposedChart data={datos} margin={{ top: 24, right: 14, bottom: 0, left: 0 }} accessibilityLayer={false}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <ReferenceLine
                y={1}
                stroke="var(--nb-pino)"
                strokeOpacity={0.45}
                strokeDasharray="4 4"
                label={{ value: 'Lo recomendado', position: 'insideTopRight', dy: -17, className: 'fill-musgo text-xs' }}
              />
              <XAxis dataKey="semana" tickLine={false} axisLine={false} tickMargin={10} padding={{ left: 14, right: 22 }} />
              <YAxis
                domain={[0, tope]}
                ticks={[0, 0.5, 1]}
                tickFormatter={(v: number) => porcentaje(v)}
                tickLine={false}
                axisLine={false}
                width={44}
              />
              <ChartTooltip cursor={{ stroke: 'var(--nb-pino)', strokeOpacity: 0.25, strokeWidth: 1.5 }} content={<Detalle series={series} />} />
              <Area
                dataKey="promedio"
                type="monotone"
                stroke="var(--color-promedio)"
                strokeWidth={2.5}
                fill="var(--color-promedio)"
                fillOpacity={0.14}
                dot={{ r: 4, fill: 'var(--color-promedio)', stroke: 'var(--card)', strokeWidth: 2 }}
                activeDot={{ r: 6, stroke: 'var(--card)', strokeWidth: 2 }}
                isAnimationActive={!reducir}
                animationDuration={900}
              >
                <LabelList dataKey="promedio" content={etiquetaFinal('promedio')} />
              </Area>
              {nutriente && (
                <Line
                  dataKey="falta"
                  type="monotone"
                  stroke="var(--color-falta)"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: 'var(--color-falta)', stroke: 'var(--card)', strokeWidth: 2 }}
                  activeDot={{ r: 6, stroke: 'var(--card)', strokeWidth: 2 }}
                  isAnimationActive={!reducir}
                  animationBegin={250}
                  animationDuration={900}
                >
                  <LabelList dataKey="falta" content={etiquetaFinal('falta')} />
                </Line>
              )}
            </ComposedChart>
          </ChartContainer>
        )}
      </div>

      <Collapsible>
        <CollapsibleTrigger className="group flex min-h-12 items-center gap-1.5 rounded-xl font-bold text-primary">
          Ver como tabla
          <ChevronDown className="size-4.5 transition-transform duration-200 group-data-[state=open]:rotate-180 motion-reduce:transition-none" strokeWidth={2.25} aria-hidden="true" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <table className="w-full text-left text-sm">
            <thead className="text-musgo">
              <tr className="border-b">
                <th scope="col" className="py-2 pr-3 font-bold">Semana desde</th>
                {series.map((s) => <th key={s.titulo} scope="col" className="py-2 pr-3 font-bold">{s.titulo.split(',')[0]}</th>)}
              </tr>
            </thead>
            <tbody>
              {etiquetas.map((e, i) => (
                <tr key={e} className="border-b last:border-0">
                  <th scope="row" className="py-2 pr-3 font-normal tabular-nums">{e}</th>
                  {series.map((s) => <td key={s.titulo} className="py-2 pr-3 font-bold tabular-nums">{porcentaje(s.valores[i])}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </CollapsibleContent>
      </Collapsible>
    </section>
  )
}

/** El tooltip: la semana y el valor de cada serie, en texto legible (no el color solo). */
function Detalle({ series, active, label, payload }: { series: Serie[]; active?: boolean; label?: unknown; payload?: readonly { dataKey?: unknown; value?: unknown }[] }) {
  if (!active || !payload?.length) return null
  return (
    <div className="flex min-w-36 flex-col gap-1 rounded-xl border bg-background px-3 py-2 text-sm text-pino">
      <p className="font-bold">Semana del {String(label)}</p>
      {series.map((s) => {
        const v = payload.find((p) => p.dataKey === s.clave)?.value
        if (typeof v !== 'number') return null
        return (
          <p key={s.clave} className="flex items-center gap-2">
            <span className={s.clave === 'promedio' ? 'size-2.5 rounded-[3px] bg-verde' : 'h-[3px] w-2.5 rounded-full bg-zapallo'} aria-hidden="true" />
            <span className="flex-1">{s.clave === 'promedio' ? 'Promedio' : s.titulo.split(',')[0]}</span>
            <strong className="tabular-nums">{porcentaje(v)}</strong>
          </p>
        )
      })}
    </div>
  )
}
