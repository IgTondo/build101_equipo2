// Próximo paso (§8 "explotar o explorar"): tres tarjetas, cada una con su porqué; las dos que exploran abren la receta.
import { useId } from 'react'
import { Link } from 'react-router-dom'
import type { Candidato, Motor, Nutriente, Sugerencia } from '../../../shared/contratos'
import { sugerenciasDe } from '../../lib/proximaComida'
import { NOMBRE_CAMBIO } from '../../lib/vocabulario'
import { rutaReceta, valorAtributo } from './calculos'
import { SwitchMotor } from './SwitchMotor'

const TITULO: Record<Sugerencia['tipo'], string> = { segura: 'Va a gustarle', un_paso: 'Un pasito', mas_nutritiva: 'Más nutritiva' }

interface Props {
  ninoId: string
  sugerencias?: Sugerencia[]
  proximoPaso?: Candidato
  nutriente?: Nutriente
  motor: Motor
  onMotor: (m: Motor) => void
  recargando: boolean
}

export function ProximoPaso({ ninoId, sugerencias, proximoPaso, nutriente, motor, onMotor, recargando }: Props) {
  const id = useId()
  const tarjetas = sugerenciasDe({ sugerencias, proximoPaso })

  return (
    <section className="nb-tarjeta tb-seccion" aria-labelledby={`${id}-t`} aria-busy={recargando}>
      <div className="tb-cab-seccion">
        <h2 id={`${id}-t`}>Próximo paso</h2>
        <SwitchMotor motor={motor} onCambio={onMotor} />
      </div>

      {tarjetas.length === 0 ? (
        <p className="tb-vacio-chico">Todavía no tenemos una sugerencia. Con algunas comidas más registradas, vamos a poder proponerte una.</p>
      ) : (
        <ul className={`tb-sugerencias${recargando ? ' tb-recargando' : ''}`}>
          {tarjetas.map((s) => (
            <li key={`${s.tipo}-${s.preparacionId}`} className={`tb-sugerencia tb-sugerencia-${s.tipo}`}>
              <p className="tb-eyebrow">{TITULO[s.tipo]}</p>
              <h3>{s.nombre}</h3>
              <p className="tb-porque">{s.porQue}</p>
              {s.tipo === 'un_paso' && s.candidato && <Cadena candidato={s.candidato} />}
              {s.tipo !== 'segura' && (
                <Link
                  className={`nb-boton${s.tipo === 'un_paso' ? '' : ' nb-boton-secundario'}`}
                  to={rutaReceta(ninoId, s.candidato?.preparacionId ?? s.preparacionId, nutriente, motor)}
                  aria-label={`Ver la receta: ${s.nombre}`}
                >
                  Ver la receta
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function Cadena({ candidato: c }: { candidato: Candidato }) {
  return (
    <dl className="tb-cadena">
      <div><dt>Parte de</dt><dd>{c.camino.desde}</dd></div>
      <div><dt>Cambia</dt><dd>{NOMBRE_CAMBIO[c.cambio]}</dd></div>
      {c.seMantiene.length > 0 && <div><dt>Se mantiene</dt><dd>{c.seMantiene.map(valorAtributo).join(', ')}</dd></div>}
    </dl>
  )
}
