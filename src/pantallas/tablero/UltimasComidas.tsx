// Las últimas comidas registradas. Lo que aprendimos del chico se muestra, simple, en el Perfil ("Lo que sabemos de…").
import { useId } from 'react'
import type { CoberturaDia } from '../../../shared/contratos'
import { diaUruguay } from '../../lib/nino'
import { ESCALON, NOMBRE_MOMENTO } from '../../lib/vocabulario'
import { etiquetaDia, mayuscula, srcMiniatura, ultimasComidas } from './calculos'

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
