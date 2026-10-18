// "Hoy" (PLAN v5.1, §9 "La pantalla principal"): cómo viene en nutrientes en el día, con cada comida registrada, y una
// línea de la semana. Sin porcentajes: los nutrientes agrupados por estado (Cubierto / Casi / Le falta, src/lib/cobertura.ts),
// tres líneas que se leen de un vistazo. El detalle (barras y cantidades) está en la semana. La energía va como dato, sin meta.
import { useId } from 'react'
import type { CoberturaDia, Nutriente, Progreso } from '../../../shared/contratos'
import { EtiquetaEstado } from '../../componentes/EstadoNutriente'
import { ESTADOS, estadoCobertura, type EstadoCobertura } from '../../lib/cobertura'
import { NOMBRE_MOMENTO, NOMBRE_NUTRIENTE, NUTRIENTES_CON_META } from '../../lib/vocabulario'
import { nutrienteEnFrase } from '../receta/legible'
import { ordenarNutrientes } from '../tablero/calculos'

interface Props {
  /** El CoberturaDia de hoy, o null si hoy no hay comidas. */
  dia: CoberturaDia | null
  semana: Progreso['semana']
  /** ¿Hay alguna comida en la semana? Sin ninguna, la línea de la semana no dice nada. */
  hayComidasSemana: boolean
}

/** "Semana: le falta más calcio y vitamina D." (los dos primeros de `semana.faltan`, por debajo del 70%, §1). */
export function lineaSemana(semana: Progreso['semana']): string {
  const faltan = semana.faltan.filter((n) => NUTRIENTES_CON_META.includes(n))
  if (!faltan.length) return 'Semana: no le falta ninguno.'
  return `Semana: le falta más ${faltan.slice(0, 2).map(nutrienteEnFrase).join(' y ')}.`
}

/** Los nutrientes con meta agrupados por estado, en el orden de prioridad de la semana. Sin grupos vacíos. */
export function porEstado(cobertura: CoberturaDia['cobertura'], orden: readonly Nutriente[]): { estado: EstadoCobertura; nutrientes: Nutriente[] }[] {
  return ESTADOS
    .map((estado) => ({ estado, nutrientes: orden.filter((n) => estadoCobertura(cobertura[n] ?? 0) === estado) }))
    .filter((g) => g.nutrientes.length > 0)
}

/** "Calcio, vitamina D y fibra". */
function listaNutrientes(ns: readonly Nutriente[]): string {
  const xs = ns.map((n, i) => (i === 0 ? NOMBRE_NUTRIENTE[n] : nutrienteEnFrase(n)))
  return xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs.at(-1)}`
}

const PLURAL_MOMENTO: Record<string, string> = {
  desayuno: 'desayunos', almuerzo: 'almuerzos', merienda: 'meriendas', cena: 'cenas', colacion: 'colaciones',
}

/** "Desayuno y almuerzo": las comidas del día, en el orden en que se registraron ("2 cenas" si se repite una). */
export function comidasRegistradas(dia: CoberturaDia): string {
  const veces = new Map<string, number>()
  for (const c of [...dia.comidas].sort((a, b) => Date.parse(a.fechaISO) - Date.parse(b.fechaISO))) {
    veces.set(c.momento, (veces.get(c.momento) ?? 0) + 1)
  }
  const nombres = [...veces].map(([m, n], i) => {
    const nombre = n > 1 ? `${n} ${PLURAL_MOMENTO[m]}` : NOMBRE_MOMENTO[m as keyof typeof NOMBRE_MOMENTO].toLowerCase()
    return i === 0 ? nombre[0].toUpperCase() + nombre.slice(1) : nombre
  })
  return nombres.length <= 1 ? nombres.join('') : `${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)}`
}

export function Hoy({ dia, semana, hayComidasSemana }: Props) {
  const id = useId()
  const hoy = dia && dia.comidas.length > 0 ? dia : null
  const grupos = hoy ? porEstado(hoy.cobertura, ordenarNutrientes(semana.faltan)) : []

  return (
    <section className="nb-tarjeta in-hoy" aria-labelledby={`${id}-t`}>
      <div className="in-hoy-cab">
        <h2 id={`${id}-t`}>Hoy</h2>
        {hoy && <p className="in-comidas">{comidasRegistradas(hoy)}</p>}
      </div>

      {hoy ? (
        <>
          <p className="nb-oculto">Nutrientes de hoy, contra lo recomendado por día:</p>
          <dl className="in-estados">
            {grupos.map((g) => (
              <div key={g.estado} className="in-estado">
                <dt><EtiquetaEstado estado={g.estado} /></dt>
                <dd>{listaNutrientes(g.nutrientes)}</dd>
              </div>
            ))}
          </dl>
          <p className="in-energia">Energía <strong className="nb-numero">≈ {redondeo(hoy.consumido.valor.energia_kcal ?? 0)} kcal</strong></p>
        </>
      ) : (
        <p className="in-vacio">Todavía no registraste comidas hoy.</p>
      )}

      {hayComidasSemana && <p className="in-semana">{lineaSemana(semana)}</p>}
    </section>
  )
}

const redondeo = (kcal: number) => (Math.round(kcal / 10) * 10).toLocaleString('es-UY')
