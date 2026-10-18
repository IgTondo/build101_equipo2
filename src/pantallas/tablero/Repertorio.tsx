// Repertorio, grupos y exposiciones en curso (§1). Tono: cada escalón cuenta; nunca se premia "comer todo".
import { useId, useState } from 'react'
import type { Cuanto, Progreso } from '../../../shared/contratos'
import { CUANTO } from '../../../shared/contratos'
import { ESCALON, NIVEL_CUANTO, NOMBRE_GRUPO } from '../../lib/vocabulario'
import { GRUPOS_VISIBLES, mayuscula, textoDiasSinComer, textoTendencia } from './calculos'

type Props = Pick<Progreso, 'aceptadas' | 'enProceso' | 'repertorioTendencia' | 'grupos' | 'exposiciones'>

const EXPOSICIONES_A_LA_VISTA = 3
/** La escalera de §5.1, de abajo (lo apartó) hacia arriba. */
const ESCALERA: Cuanto[] = [...CUANTO].sort((a, b) => NIVEL_CUANTO[a] - NIVEL_CUANTO[b])

export function Repertorio({ aceptadas, enProceso, repertorioTendencia, grupos, exposiciones }: Props) {
  const id = useId()
  const [todas, setTodas] = useState(false)
  // Solo los grupos que manda B (§1: fruta, verdura, lácteo y proteína), en un orden fijo: un grupo que no viene
  // no es "nunca lo registramos", es un dato que no se calcula.
  const visibles = GRUPOS_VISIBLES.flatMap((g) => grupos.filter((x) => x.grupo === g))
  const listaExp = todas ? exposiciones : exposiciones.slice(0, EXPOSICIONES_A_LA_VISTA)

  return (
    <>
      <section className="nb-tarjeta tb-seccion" aria-labelledby={`${id}-r`}>
        <h2 id={`${id}-r`}>Lo que come</h2>
        <div className="tb-repertorio">
          <p className="tb-cifra">
            <strong>{aceptadas}</strong>
            <span>{aceptadas === 1 ? 'preparación que acepta' : 'preparaciones que acepta'}</span>
          </p>
          <p className="tb-tendencia">
            <TendenciaIcono diferencia={repertorioTendencia} />
            {textoTendencia(repertorioTendencia)}
          </p>
          {enProceso > 0 && <p className="nb-suave tb-nota">Y {enProceso} en camino.</p>}
        </div>

        {visibles.length > 0 && (
          <>
            <h3 className="tb-subtitulo">Última vez por grupo</h3>
            <ul className="tb-grupos">
              {visibles.map((g) => (
                <li key={g.grupo} className={g.diasSinComer !== null && g.diasSinComer >= 7 ? 'tb-grupo-lejos' : undefined}>
                  <span>{NOMBRE_GRUPO[g.grupo]}</span>
                  <span className="tb-grupo-cuando nb-numero">{textoDiasSinComer(g.diasSinComer)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="nb-tarjeta tb-seccion" aria-labelledby={`${id}-e`}>
        <h2 id={`${id}-e`}>Alimentos nuevos en camino</h2>
        {exposiciones.length === 0 ? (
          <p className="tb-vacio-chico">Cuando le ofrezcas algo nuevo, acá vas a ver cómo avanza.</p>
        ) : (
          <>
            <p className="tb-nota nb-suave">Suelen hacer falta de 8 a 15 veces.</p>
            <ul className="tb-exposiciones">
              {listaExp.map((e) => (
                <li key={e.preparacionId}>
                  <p className="tb-exp-nombre">{e.nombre}</p>
                  <Escalera paso={e.mejorPaso} />
                  <p className="tb-exp-dato">
                    <span>{mayuscula(ESCALON[e.mejorPaso])}</span>
                    <span className="nb-suave nb-numero">{e.veces} {e.veces === 1 ? 'vez' : 'veces'}</span>
                  </p>
                </li>
              ))}
            </ul>
            {exposiciones.length > EXPOSICIONES_A_LA_VISTA && (
              <button type="button" className="nb-boton nb-boton-secundario tb-boton-chico" onClick={() => setTodas((t) => !t)} aria-expanded={todas}>
                {todas ? 'Ver menos' : `Ver los ${exposiciones.length}`}
              </button>
            )}
          </>
        )}
      </section>
    </>
  )
}

function Escalera({ paso }: { paso: Cuanto }) {
  const nivel = NIVEL_CUANTO[paso]
  return (
    <span className="tb-escalera" role="img" aria-label={`Escalón ${nivel + 1} de ${ESCALERA.length}: ${ESCALON[paso]}`}>
      {ESCALERA.map((c) => (
        <span key={c} className={NIVEL_CUANTO[c] <= nivel ? 'tb-escalon tb-escalon-lleno' : 'tb-escalon'} />
      ))}
    </span>
  )
}

function TendenciaIcono({ diferencia }: { diferencia: number }) {
  const d = diferencia > 0 ? 'M3 11l5-5 5 5' : diferencia < 0 ? 'M3 5l5 5 5-5' : 'M3 8h10'
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
