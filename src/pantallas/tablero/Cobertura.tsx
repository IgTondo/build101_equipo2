// Cobertura semanal por nutriente (§1, el indicador principal): barras contra lo recomendado; al tocar, el último día.
import { useId, useState } from 'react'
import type { CoberturaDia, Nutriente, Progreso } from '../../../shared/contratos'
import { diaUruguay } from '../../lib/nino'
import { formatoNutriente, NOMBRE_NUTRIENTE, porcentaje } from '../../lib/vocabulario'
import { escalaBarra, etiquetaDia, MARCA_100, ordenarNutrientes, textoEnergia } from './calculos'

interface Props { semana: Progreso['semana']; dia: CoberturaDia | null }

export function Cobertura({ semana, dia }: Props) {
  const [abierto, setAbierto] = useState<Nutriente | null>(null)
  const idBase = useId()
  const orden = ordenarNutrientes(semana.faltan)
  const cubiertos = orden.filter((n) => !semana.faltan.includes(n)).length

  return (
    <section className="nb-tarjeta tb-seccion" aria-labelledby={`${idBase}-t`}>
      <h2 id={`${idBase}-t`}>Nutrientes de la semana</h2>

      <div className="tb-escala" aria-hidden="true">
        <span style={{ left: `${MARCA_100 * 100}%` }}>Lo recomendado</span>
      </div>
      <ul className="tb-barras" aria-label={`Cobertura semanal: ${cubiertos} de ${orden.length} nutrientes por encima del 70%`}>
        {orden.map((n) => {
          const cobertura = semana.cobertura[n] ?? 0
          const falta = semana.faltan.includes(n)
          const { fraccion, recortada } = escalaBarra(cobertura)
          const estaAbierto = abierto === n
          const idDetalle = `${idBase}-${n}`
          return (
            <li key={n} className={falta ? 'tb-falta' : undefined}>
              <button
                type="button"
                className="tb-barra"
                aria-expanded={estaAbierto}
                aria-controls={idDetalle}
                onClick={() => setAbierto(estaAbierto ? null : n)}
              >
                <span className="tb-barra-cab">
                  <span className="tb-barra-nombre">{NOMBRE_NUTRIENTE[n]}</span>
                  {falta && <span className="tb-etiqueta-falta">Le falta</span>}
                  <span className="tb-barra-valor nb-numero">{porcentaje(cobertura)}<span className="tb-oculto"> de lo recomendado</span></span>
                  <Chevron abierto={estaAbierto} />
                </span>
                <span className="tb-pista" aria-hidden="true">
                  <span
                    className={`tb-relleno${recortada ? ' tb-recortada' : ''}`}
                    style={{ width: `${fraccion * 100}%` }}
                  />
                  <span className="tb-marca" style={{ left: `${MARCA_100 * 100}%` }} />
                </span>
              </button>
              <div id={idDetalle} className="tb-detalle" hidden={!estaAbierto}>
                {estaAbierto && <DetalleDia nutriente={n} dia={dia} />}
              </div>
            </li>
          )
        })}
      </ul>

      <div className="tb-energia">
        <p className="tb-energia-dato">
          <span className="tb-energia-nombre">Energía aproximada</span>
          <strong>{textoEnergia(semana.energiaPromedioKcal)}</strong>
        </p>
      </div>
    </section>
  )
}

function DetalleDia({ nutriente: n, dia }: { nutriente: Nutriente; dia: CoberturaDia | null }) {
  if (!dia) return <p className="nb-suave">Todavía no hay un día registrado.</p>
  const valor = dia.consumido.valor[n] ?? 0
  const objetivo = dia.objetivo[n] ?? 0
  return (
    <p>
      <strong>{etiquetaDia(dia.dia, diaUruguay())}</strong>
      {': '}
      <span className="nb-numero">{formatoNutriente(n, valor)}</span>
      <span className="nb-suave"> (entre {formatoNutriente(n, dia.consumido.min[n] ?? 0)} y {formatoNutriente(n, dia.consumido.max[n] ?? 0)})</span>
      {objetivo > 0 && <>, el <span className="nb-numero">{porcentaje(dia.cobertura[n] ?? 0)}</span> de {formatoNutriente(n, objetivo)} por día.</>}
    </p>
  )
}

function Chevron({ abierto }: { abierto: boolean }) {
  return (
    <svg className={`tb-chevron${abierto ? ' tb-chevron-abierto' : ''}`} width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
