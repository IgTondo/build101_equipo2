// Lo que aprendimos (patrones del grafo y de la investigación) y las últimas comidas registradas.
import { useId } from 'react'
import type { CoberturaDia, PatronVista } from '../../../shared/contratos'
import { diaUruguay } from '../../lib/nino'
import { ESCALON, NOMBRE_MOMENTO, textoParaPadres } from '../../lib/vocabulario'
import { etiquetaDia, mayuscula, nivelConfianza, ordenarPatrones, srcMiniatura, ultimasComidas } from './calculos'

export function Aprendimos({ patrones }: { patrones: PatronVista[] }) {
  const id = useId()
  return (
    <section className="nb-tarjeta tb-seccion" aria-labelledby={`${id}-t`}>
      <h2 id={`${id}-t`}>Lo que aprendimos</h2>
      {patrones.length === 0 ? (
        <p className="tb-vacio-chico">Con cada comida que registres vamos a ir encontrando qué le gusta y qué no.</p>
      ) : (
        <ul className="tb-patrones">
          {ordenarPatrones(patrones).map((p) => (
            <li key={p.texto}>
              <p className="tb-patron-texto">{textoParaPadres(p.texto)}</p>
              <p className="tb-patron-meta nb-suave">
                <span className="nb-chip">{p.fuente === 'aprendido' ? 'De sus comidas' : 'De la investigación'}</span>
                <span>
                  {p.fuente === 'aprendido' && <>Visto {p.apoyo} {p.apoyo === 1 ? 'vez' : 'veces'} · </>}
                  Confianza {nivelConfianza(p.confianza)} <span className="nb-numero">({Math.round(p.confianza * 100)}%)</span>
                </span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function UltimasComidas({ dias }: { dias: CoberturaDia[] }) {
  const id = useId()
  const comidas = ultimasComidas(dias, 5)
  const hoy = diaUruguay()
  if (!comidas.length) return null
  return (
    <section className="nb-tarjeta tb-seccion" aria-labelledby={`${id}-t`}>
      <h2 id={`${id}-t`}>Últimas comidas</h2>
      <ul className="tb-comidas">
        {comidas.map((c) => (
          <li key={c.id}>
            {c.thumbBase64 && <img className="tb-miniatura" src={srcMiniatura(c.thumbBase64)} alt="" width={56} height={56} />}
            <div>
              <p className="tb-comida-cuando">{mayuscula(etiquetaDia(c.dia, hoy))} · {NOMBRE_MOMENTO[c.momento]}</p>
              <ul className="tb-comida-items">
                {c.items.map((it, i) => (
                  <li key={`${it.nombre}-${i}`}>{it.nombre}: <span className="nb-suave">{ESCALON[it.cuanto]}</span></li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
