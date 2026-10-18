// Cobertura semanal por nutriente (§1, el indicador principal). Para el padre, un estado por nutriente (Cubierto /
// Casi / Le falta, src/lib/cobertura.ts) y una barra que se llena hasta lo recomendado y no pasa. Al tocar, el detalle:
// cuánto comió el último día y, si no llega, qué porcentaje de lo recomendado lleva la semana (nunca más de 100%).
import { useId, useState } from 'react'
import type { CoberturaDia, Nutriente, Progreso } from '../../../shared/contratos'
import { BarraEstado, EtiquetaEstado } from '../../componentes/EstadoNutriente'
import { contarEstados, estadoCobertura, fraccionBarra, porcentajeTope, resumenEstados } from '../../lib/cobertura'
import { diaUruguay } from '../../lib/nino'
import { formatoNutriente, NOMBRE_NUTRIENTE } from '../../lib/vocabulario'
import { etiquetaDia, ordenarNutrientes, textoEnergia } from './calculos'

interface Props { semana: Progreso['semana']; dia: CoberturaDia | null }

export function Cobertura({ semana, dia }: Props) {
  const [abierto, setAbierto] = useState<Nutriente | null>(null)
  const idBase = useId()
  const orden = ordenarNutrientes(semana.faltan)
  const cuenta = contarEstados(semana.cobertura, orden)

  return (
    <section className="nb-tarjeta tb-seccion" aria-labelledby={`${idBase}-t`}>
      <h2 id={`${idBase}-t`}>Nutrientes de la semana</h2>
      <p className="tb-resumen-estados nb-numero">{resumenEstados(cuenta)}</p>
      <ul className="tb-barras">
        {orden.map((n) => {
          const cobertura = semana.cobertura[n] ?? 0
          const estado = estadoCobertura(cobertura)
          const estaAbierto = abierto === n
          const idDetalle = `${idBase}-${n}`
          return (
            <li key={n}>
              <button
                type="button"
                className="tb-barra"
                aria-expanded={estaAbierto}
                aria-controls={idDetalle}
                onClick={() => setAbierto(estaAbierto ? null : n)}
              >
                <span className="tb-barra-cab">
                  <span className="tb-barra-nombre">{NOMBRE_NUTRIENTE[n]}</span>
                  <EtiquetaEstado estado={estado} />
                  <Chevron abierto={estaAbierto} />
                </span>
                <BarraEstado estado={estado} fraccion={fraccionBarra(cobertura)} gruesa />
              </button>
              <div id={idDetalle} className="tb-detalle" hidden={!estaAbierto}>
                {estaAbierto && <Detalle nutriente={n} cobertura={cobertura} dia={dia} />}
              </div>
            </li>
          )
        })}
      </ul>
      <p className="tb-leyenda">Barra llena: lo recomendado para su edad.</p>

      <p className="tb-energia">
        <span>Energía aproximada</span>
        <strong className="nb-numero">{textoEnergia(semana.energiaPromedioKcal)}</strong>
      </p>
    </section>
  )
}

/** "Semana: 40% de lo recomendado · Hoy: 12 mg de 600 mg." El porcentaje solo si no llega (si llega, ya dice Cubierto). */
function Detalle({ nutriente: n, cobertura, dia }: { nutriente: Nutriente; cobertura: number; dia: CoberturaDia | null }) {
  const objetivo = dia?.objetivo[n] ?? 0
  return (
    <p>
      {cobertura < 1 && <>Semana: <span className="nb-numero">{porcentajeTope(cobertura)}</span> de lo recomendado. </>}
      {dia && objetivo > 0
        ? <>{etiquetaDia(dia.dia, diaUruguay())}: <span className="nb-numero">{formatoNutriente(n, dia.consumido.valor[n] ?? 0)}</span> de <span className="nb-numero">{formatoNutriente(n, objetivo)}</span> por día.</>
        : null}
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
