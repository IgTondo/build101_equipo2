// Próximo paso (§8 "explotar o explorar"): tres tarjetas cortas (qué, por qué en una línea); las dos que exploran abren
// la receta, que tiene el porqué completo y la cadena "Parte de / Cambia".
import { useId } from 'react'
import { Link } from 'react-router-dom'
import type { Candidato, Nutriente, Sugerencia } from '../../../shared/contratos'
import { lineaPorQue, sugerenciasDe } from '../../lib/proximaComida'
import { rutaReceta } from './calculos'

const TITULO: Record<Sugerencia['tipo'], string> = { segura: 'Va a gustarle', un_paso: 'Un pasito', mas_nutritiva: 'Más nutritiva' }

interface Props {
  ninoId: string
  sugerencias?: Sugerencia[]
  proximoPaso?: Candidato
  nutriente?: Nutriente
  recargando: boolean
}

export function ProximoPaso({ ninoId, sugerencias, proximoPaso, nutriente, recargando }: Props) {
  const id = useId()
  const tarjetas = sugerenciasDe({ sugerencias, proximoPaso })

  return (
    <section className="nb-tarjeta tb-seccion" aria-labelledby={`${id}-t`} aria-busy={recargando}>
      <h2 id={`${id}-t`}>Próximo paso</h2>

      {tarjetas.length === 0 ? (
        <p className="tb-vacio-chico">Todavía sin ideas: registrá algunas comidas más.</p>
      ) : (
        <ul className={`tb-sugerencias${recargando ? ' tb-recargando' : ''}`}>
          {tarjetas.map((s) => (
            <li key={`${s.tipo}-${s.preparacionId}`} className={`tb-sugerencia tb-sugerencia-${s.tipo}`}>
              <p className="tb-eyebrow">{TITULO[s.tipo]}</p>
              <h3>{s.nombre}</h3>
              {s.porQue && <p className="tb-porque">{lineaPorQue(s.porQue)}</p>}
              {s.tipo !== 'segura' && (
                <Link
                  className={`nb-boton${s.tipo === 'un_paso' ? '' : ' nb-boton-secundario'}`}
                  to={rutaReceta(ninoId, s.candidato?.preparacionId ?? s.preparacionId, nutriente)}
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
