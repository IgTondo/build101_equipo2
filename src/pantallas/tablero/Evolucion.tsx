// Evolución de las últimas 4 semanas (§1): dos gráficos chicos con la misma escala (0 a lo recomendado):
// el promedio de los 8 nutrientes y el que más falta. Cada uno con su resumen en texto y una tabla.
import { useId } from 'react'
import type { Nutriente, Progreso } from '../../../shared/contratos'
import { NOMBRE_NUTRIENTE, porcentaje } from '../../lib/vocabulario'
import { coberturaPromedio, fechaCorta, textoEvolucion } from './calculos'

interface Serie { titulo: string; valores: number[]; tono: 'verde' | 'zapallo' }

export function Evolucion({ semanas, nutriente }: { semanas: Progreso['semanas']; nutriente?: Nutriente }) {
  const id = useId()
  const orden = [...semanas].sort((a, b) => a.desde.localeCompare(b.desde)).slice(-4)
  if (orden.length < 2) {
    return (
      <section className="nb-tarjeta tb-seccion" aria-labelledby={`${id}-t`}>
        <h2 id={`${id}-t`}>Cómo viene</h2>
        <p className="nb-suave">Con dos semanas de registros vas a ver acá si mejora.</p>
      </section>
    )
  }
  const etiquetas = orden.map((s) => fechaCorta(s.desde))
  const series: Serie[] = [
    { titulo: 'Promedio de los 8 nutrientes', valores: orden.map((s) => coberturaPromedio(s.cobertura)), tono: 'verde' },
  ]
  if (nutriente) {
    series.push({ titulo: `${NOMBRE_NUTRIENTE[nutriente]}, lo que más le falta`, valores: orden.map((s) => s.cobertura[nutriente] ?? 0), tono: 'zapallo' })
  }

  return (
    <section className="nb-tarjeta tb-seccion" aria-labelledby={`${id}-t`}>
      <h2 id={`${id}-t`}>Cómo viene</h2>
      <p className="nb-suave tb-bajada">Cobertura de cada semana, de lo recomendado. El promedio cuenta cada nutriente hasta el 100%.</p>
      <div className="tb-multiples">
        {series.map((s) => <Columnas key={s.titulo} serie={s} etiquetas={etiquetas} />)}
      </div>
      <details className="tb-tabla-vista">
        <summary>Ver como tabla</summary>
        <table className="nb-tabla">
          <thead>
            <tr><th scope="col">Semana desde</th>{series.map((s) => <th key={s.titulo} scope="col">{s.titulo.split(',')[0]}</th>)}</tr>
          </thead>
          <tbody>
            {etiquetas.map((e, i) => (
              <tr key={e}><th scope="row">{e}</th>{series.map((s) => <td key={s.titulo} className="nb-numero">{porcentaje(s.valores[i])}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  )
}

// Geometría en unidades del viewBox; el SVG se estira al ancho de la tarjeta (el texto escala con él).
const ANCHO = 300, ALTO = 128, IZQ = 40, DER = 8, ARRIBA = 18, BASE = 100
const COLUMNA = 24

function Columnas({ serie, etiquetas }: { serie: Serie; etiquetas: string[] }) {
  const n = serie.valores.length
  const paso = (ANCHO - IZQ - DER) / n
  const y = (v: number) => BASE - Math.min(Math.max(v, 0), 1) * (BASE - ARRIBA)
  const primero = serie.valores[0]
  const ultimo = serie.valores[n - 1]
  const resumen = textoEvolucion(primero, ultimo)

  return (
    <figure className="tb-multiple">
      <figcaption>
        <span className="tb-multiple-titulo">{serie.titulo}</span>
        <span className="nb-suave">{resumen} en {n} semanas</span>
      </figcaption>
      <svg
        viewBox={`0 0 ${ANCHO} ${ALTO}`}
        className={`tb-columnas tb-tono-${serie.tono}`}
        role="img"
        aria-label={`${serie.titulo}: ${serie.valores.map((v, i) => `semana del ${etiquetas[i]}, ${porcentaje(v)}`).join('; ')}`}
      >
        <line className="tb-grilla" x1={IZQ} x2={ANCHO - DER} y1={ARRIBA} y2={ARRIBA} />
        <text className="tb-eje" x={IZQ - 6} y={ARRIBA + 4} textAnchor="end">100%</text>
        <line className="tb-base" x1={IZQ} x2={ANCHO - DER} y1={BASE} y2={BASE} />
        <text className="tb-eje" x={IZQ - 6} y={BASE + 4} textAnchor="end">0</text>
        {serie.valores.map((v, i) => {
          const cx = IZQ + paso * i + paso / 2
          const top = y(v)
          const alto = BASE - top
          const x = cx - COLUMNA / 2
          const r = Math.min(4, alto)
          const d = alto <= 0 ? '' :
            `M${x},${BASE} V${top + r} Q${x},${top} ${x + r},${top} H${x + COLUMNA - r} Q${x + COLUMNA},${top} ${x + COLUMNA},${top + r} V${BASE} Z`
          const esUltima = i === n - 1
          return (
            <g key={etiquetas[i]} className="tb-col">
              <title>{`Semana del ${etiquetas[i]}: ${porcentaje(v)}`}</title>
              <rect className="tb-col-hit" x={cx - paso / 2} y={ARRIBA - 14} width={paso} height={BASE - ARRIBA + 14} />
              {d && <path className={esUltima ? 'tb-col-marca tb-col-actual' : 'tb-col-marca'} d={d} />}
              {esUltima && <text className="tb-valor" x={cx} y={top - 5} textAnchor="middle">{porcentaje(v)}</text>}
              <text className="tb-eje" x={cx} y={BASE + 18} textAnchor="middle">{etiquetas[i]}</text>
            </g>
          )
        })}
      </svg>
    </figure>
  )
}
