// Los números de la semana en tablas, para el nutricionista: los mismos que cuenta el texto, tomados del progreso que
// vino con el resumen (acá no se calcula nada nuevo). La cobertura va en barras finas que no pasan de lo recomendado
// (como los porcentajes, con tope en 100%); lo que le falta, en Zapallo.
import { cn } from 'cn'
import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import type { Progreso } from '../../../shared/contratos'
import { fraccionBarra } from '../../lib/cobertura'
import { COLOR_GRUPO } from '../../lib/colores'
import { ESCALON, NOMBRE_GRUPO, NOMBRE_NUTRIENTE, NUTRIENTES_CON_META, porcentaje } from '../../lib/vocabulario'

const mayuscula = (s: string) => s[0].toLocaleUpperCase('es') + s.slice(1)
const ultimaVez = (d: number | null) => (d === null ? 'Sin registros' : d === 0 ? 'Hoy' : d === 1 ? 'Ayer' : `Hace ${d} días`)

function Tabla({ titulo, columnas, children }: { titulo: string; columnas: { texto: string; derecha?: boolean }[]; children: ReactNode }) {
  return (
    <table className="w-full border-collapse text-sm">
      <caption className="mb-1.5 text-left font-titulo text-base font-extrabold text-pino">{titulo}</caption>
      <thead>
        <tr className="border-b text-xs text-musgo">
          {columnas.map((c) => (
            <th key={c.texto} scope="col" className={cn('py-2 font-bold', c.derecha ? 'text-right' : 'text-left')}>{c.texto}</th>
          ))}
        </tr>
      </thead>
      <tbody className="[&>tr]:border-b [&>tr:last-child]:border-0">{children}</tbody>
    </table>
  )
}

export function NumerosDeLaSemana({ progreso }: { progreso: Progreso }) {
  const { semana } = progreso
  const grupos = progreso.grupos.filter((g) => g.grupo !== 'otro')

  return (
    <section aria-labelledby="rs-numeros" className="flex flex-col gap-7">
      <h2 id="rs-numeros" className="sr-only">Los números de la semana</h2>

      <div className="flex flex-col gap-2">
        <Tabla titulo="Cobertura semanal de nutrientes" columnas={[{ texto: 'Nutriente' }, { texto: 'De la referencia', derecha: true }]}>
          {NUTRIENTES_CON_META.map((n, i) => {
            const falta = semana.faltan.includes(n)
            const c = semana.cobertura[n]
            return (
              <tr key={n}>
                <th scope="row" className="py-2.5 pr-3 text-left font-normal">
                  {NOMBRE_NUTRIENTE[n]}
                  {falta && <span className="sr-only"> (le falta esta semana)</span>}
                </th>
                <td className="py-2.5">
                  <span className="flex items-center justify-end gap-3">
                    <span aria-hidden="true" className="rs-imprimir-color h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                      <motion.span
                        className={cn('block h-full origin-left rounded-full', falta ? 'bg-zapallo' : 'bg-hoja')}
                        style={{ width: `${fraccionBarra(c) * 100}%` }}
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ duration: 0.7, delay: 0.1 + i * 0.03, ease: [0.22, 1, 0.36, 1] }}
                      />
                    </span>
                    <span className="w-12 text-right font-bold tabular-nums">{porcentaje(c)}</span>
                  </span>
                </td>
              </tr>
            )
          })}
        </Tabla>
        <div className="flex flex-col gap-1 text-xs text-musgo">
          {semana.faltan.length > 0 && (
            <p className="flex items-center gap-2">
              <span aria-hidden="true" className="rs-imprimir-color size-2.5 shrink-0 rounded-full bg-zapallo" />
              <span>Le falta esta semana</span>
            </p>
          )}
          <p>Energía: <span className="tabular-nums">{semana.energiaPromedioKcal}</span> kcal por día en promedio, sin meta.</p>
        </div>
      </div>

      {grupos.length > 0 && (
        <Tabla titulo="Última vez de cada grupo" columnas={[{ texto: 'Grupo' }, { texto: 'Última vez', derecha: true }]}>
          {grupos.map((g) => (
            <tr key={g.grupo}>
              <th scope="row" className="py-2.5 pr-3 text-left font-normal">
                <span className="flex items-center gap-2.5">
                  <span aria-hidden="true" className="rs-imprimir-color size-2.5 shrink-0 rounded-full" style={{ background: COLOR_GRUPO[g.grupo].color }} />
                  {NOMBRE_GRUPO[g.grupo]}
                </span>
              </th>
              <td className="py-2.5 text-right tabular-nums">{ultimaVez(g.diasSinComer)}</td>
            </tr>
          ))}
        </Tabla>
      )}

      {progreso.exposiciones.length > 0 && (
        <Tabla
          titulo={`Exposiciones en curso (${progreso.exposiciones.length})`}
          columnas={[{ texto: 'Preparación y mejor escalón' }, { texto: 'Veces', derecha: true }]}
        >
          {/* En el celular no entran tres columnas: el mejor escalón va abajo del nombre. */}
          {progreso.exposiciones.map((e) => (
            <tr key={e.preparacionId}>
              <th scope="row" className="py-2.5 pr-3 text-left font-normal">
                <span className="block text-pretty">{e.nombre}</span>
                <span className="block text-xs text-musgo">{mayuscula(ESCALON[e.mejorPaso])}</span>
              </th>
              <td className="py-2.5 text-right align-top tabular-nums">{e.veces}</td>
            </tr>
          ))}
        </Tabla>
      )}
    </section>
  )
}
