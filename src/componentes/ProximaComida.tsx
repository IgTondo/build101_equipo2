// La tarjeta "Próxima comida" (PLAN v5.1, §9): "Para el almuerzo" + la sugerencia con su porqué, sin LLM. Al tocarla
// se abre la receta para esa comida. La usan el inicio y el resultado del registro. Es una sugerencia: el padre puede
// servir otra cosa. Una sugerencia "segura" (algo que ya come) no abre receta: se muestra sin enlace.
import { Link } from 'react-router-dom'
import type { Nutriente, Progreso } from '../../shared/contratos'
import { elegirSugerencia, primeraFrase, rutaRecetaComida, type ProximaComida } from '../lib/proximaComida'
import { Cargando } from './Estados'
import './proxima-comida.css'

interface Props {
  ninoId: string
  proxima: ProximaComida
  /** null mientras carga. */
  progreso: Pick<Progreso, 'sugerencias' | 'proximoPaso' | 'semana' | 'momento'> | null
}

export function TarjetaProximaComida({ ninoId, proxima, progreso }: Props) {
  const titulo = <h2 className="nb-oculto">Próxima comida</h2>
  const cuando = <span className="pc-cuando">{proxima.etiqueta}</span>

  if (!progreso) {
    return (
      <section className="pc pc-quieta" aria-busy="true">
        {titulo}{cuando}
        <Cargando texto="Buscando una idea…" />
      </section>
    )
  }

  const s = elegirSugerencia(progreso, proxima.momento)
  if (!s) {
    return (
      <section className="pc pc-quieta">
        {titulo}{cuando}
        <p className="pc-porque">Todavía no tenemos una sugerencia. Con algunas comidas más registradas vamos a poder proponerte una.</p>
      </section>
    )
  }

  const porQue = s.porQue ? <span className="pc-porque">{primeraFrase(s.porQue)}</span> : null
  if (s.tipo === 'segura') {
    return (
      <section className="pc pc-quieta">
        {titulo}{cuando}
        <span className="pc-nombre">{s.nombre}</span>
        {porQue}
      </section>
    )
  }

  const nutriente: Nutriente | undefined = progreso.semana.faltan.find((n) => n !== 'energia_kcal')
  return (
    <section>
      {titulo}
      <Link className="pc pc-enlace" to={rutaRecetaComida(ninoId, s, proxima.momento, nutriente)}>
        {cuando}
        <span className="pc-nombre">{s.nombre}</span>
        {porQue}
        <span className="pc-accion">
          Ver la receta
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
            <path d="M7.5 4.5L13 10l-5.5 5.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </Link>
    </section>
  )
}
