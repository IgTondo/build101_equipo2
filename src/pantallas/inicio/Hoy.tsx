// "Hoy" (PLAN v5.1, §9 "La pantalla principal"): cómo viene en nutrientes en el día, con cada comida registrada, y una
// línea de la semana. Barras compactas contra lo recomendado por día (no se tocan: el detalle está en la semana).
// Se resalta lo que más le falta en la semana (`semana.faltan`, §1). La energía va como dato, sin meta.
import { useId } from 'react'
import type { CoberturaDia, Nutriente, Progreso } from '../../../shared/contratos'
import { NOMBRE_MOMENTO, NOMBRE_NUTRIENTE, NUTRIENTES_CON_META, porcentaje } from '../../lib/vocabulario'
import { nutrienteEnFrase } from '../receta/legible'
import { escalaBarra, MARCA_100, ordenarNutrientes } from '../tablero/calculos'

interface Props {
  /** El CoberturaDia de hoy, o null si hoy no hay comidas. */
  dia: CoberturaDia | null
  semana: Progreso['semana']
  /** ¿Hay alguna comida en la semana? Sin ninguna, la línea de la semana no dice nada. */
  hayComidasSemana: boolean
}

/** "Semana: 4 de 8 nutrientes cubiertos. Le falta más: calcio y vitamina D." */
export function lineaSemana(semana: Progreso['semana']): string {
  const faltan = semana.faltan.filter((n) => NUTRIENTES_CON_META.includes(n))
  const cubiertos = NUTRIENTES_CON_META.length - faltan.length
  const base = `Semana: ${cubiertos} de ${NUTRIENTES_CON_META.length} nutrientes cubiertos.`
  if (!faltan.length) return base
  const dos = faltan.slice(0, 2).map(nutrienteEnFrase)
  return `${base} Le falta más: ${dos.join(' y ')}.`
}

/** "Desayuno y almuerzo": las comidas del día, en el orden en que se registraron. */
export function comidasRegistradas(dia: CoberturaDia): string {
  const nombres = [...dia.comidas]
    .sort((a, b) => Date.parse(a.fechaISO) - Date.parse(b.fechaISO))
    .map((c, i) => (i === 0 ? NOMBRE_MOMENTO[c.momento] : NOMBRE_MOMENTO[c.momento].toLowerCase()))
  return nombres.length <= 1 ? nombres.join('') : `${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)}`
}

export function Hoy({ dia, semana, hayComidasSemana }: Props) {
  const id = useId()
  const hoy = dia && dia.comidas.length > 0 ? dia : null
  const orden = ordenarNutrientes(semana.faltan)
  const prioridad = (n: Nutriente) => semana.faltan.includes(n)
  const hayPrioridad = orden.some(prioridad)

  return (
    <section className="nb-tarjeta in-hoy" aria-labelledby={`${id}-t`}>
      <div className="in-hoy-cab">
        <h2 id={`${id}-t`}>Hoy</h2>
        {hoy && <p className="in-comidas">{comidasRegistradas(hoy)}</p>}
      </div>

      {hoy ? (
        <>
          <ul className="in-barras" aria-label="Nutrientes de hoy, de lo recomendado por día">
            {orden.map((n) => {
              const cobertura = hoy.cobertura[n] ?? 0
              const { fraccion } = escalaBarra(cobertura)
              const destacado = prioridad(n)
              return (
                <li key={n} className={destacado ? 'in-prioridad' : undefined}>
                  <span className="in-barra-cab">
                    <span className="in-barra-nombre">
                      {NOMBRE_NUTRIENTE[n]}
                      {destacado && <span className="nb-oculto"> (le falta en la semana)</span>}
                    </span>
                    <span className="in-valor nb-numero">{porcentaje(cobertura)}</span>
                  </span>
                  <span className="in-pista" aria-hidden="true">
                    <span className="in-relleno" style={{ width: `${fraccion * 100}%` }} />
                    <span className="in-marca" style={{ left: `${MARCA_100 * 100}%` }} />
                  </span>
                </li>
              )
            })}
          </ul>
          <p className="in-pie">
            <span className="in-leyendas" aria-hidden="true">
              {hayPrioridad && <span className="in-leyenda in-leyenda-falta">Le falta en la semana</span>}
              <span className="in-leyenda in-leyenda-marca">Lo recomendado</span>
            </span>
            <span className="in-energia">Energía <strong className="nb-numero">≈ {redondeo(hoy.consumido.valor.energia_kcal ?? 0)} kcal</strong></span>
          </p>
        </>
      ) : (
        <p className="in-vacio">Todavía no registraste comidas hoy.</p>
      )}

      {hayComidasSemana && <p className="in-semana">{lineaSemana(semana)}</p>}
    </section>
  )
}

const redondeo = (kcal: number) => (Math.round(kcal / 10) * 10).toLocaleString('es-UY')
