// "Hoy" (PLAN v5.1, §9 "La pantalla principal"): cómo viene en nutrientes en el día, con cada comida registrada, y una
// línea de la semana. El día es un plato visto desde arriba: los 8 nutrientes son anillos alrededor del borde (lleno =
// lo recomendado por día; no se tocan, el detalle está en la semana) y la energía va en el centro, como dato, sin meta.
// Lo que más le falta en la semana (`semana.faltan`, §1) va en Zapallo. Sin comidas hoy, el plato vacío.
import { cn } from 'cn'
import { useInView } from 'motion/react'
import { useId, useRef } from 'react'
import type { CoberturaDia, Momento, Nutriente, Progreso } from '../../../shared/contratos'
import { Anillo } from '../../componentes/Anillo'
import { PlatoVacio } from '../../componentes/Ilustraciones'
import { NumeroAnimado } from '../../componentes/NumeroAnimado'
import { VISUAL_MOMENTO } from '../../lib/colores'
import { NOMBRE_MOMENTO, NOMBRE_NUTRIENTE, NUTRIENTES_CON_META, porcentaje } from '../../lib/vocabulario'
import { nutrienteEnFrase } from '../receta/legible'
import { ordenarNutrientes } from '../tablero/calculos'

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

const PLURAL_MOMENTO: Record<string, string> = {
  desayuno: 'desayunos', almuerzo: 'almuerzos', merienda: 'meriendas', cena: 'cenas', colacion: 'colaciones',
}

/** Cada comida del día una vez, en el orden en que se registraron, con las veces que se repitió. */
function vecesPorComida(dia: CoberturaDia): [Momento, number][] {
  const veces = new Map<Momento, number>()
  for (const c of [...dia.comidas].sort((a, b) => Date.parse(a.fechaISO) - Date.parse(b.fechaISO))) {
    veces.set(c.momento, (veces.get(c.momento) ?? 0) + 1)
  }
  return [...veces]
}

/** "Desayuno y almuerzo": las comidas del día, en el orden en que se registraron ("2 cenas" si se repite una). */
export function comidasRegistradas(dia: CoberturaDia): string {
  const nombres = vecesPorComida(dia).map(([m, n], i) => {
    const nombre = n > 1 ? `${n} ${PLURAL_MOMENTO[m]}` : NOMBRE_MOMENTO[m].toLowerCase()
    return i === 0 ? nombre[0].toUpperCase() + nombre.slice(1) : nombre
  })
  return nombres.length <= 1 ? nombres.join('') : `${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)}`
}

export function Hoy({ dia, semana, hayComidasSemana }: Props) {
  const id = useId()
  const hoy = dia && dia.comidas.length > 0 ? dia : null

  return (
    <section className="flex flex-col gap-4" aria-labelledby={`${id}-t`}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-1">
        <h2 id={`${id}-t`} className="text-2xl">Hoy</h2>
        {hoy && <ComidasDeHoy dia={hoy} />}
      </div>

      {hoy ? (
        <PlatoDelDia dia={hoy} faltan={semana.faltan} />
      ) : (
        <div className="flex items-center gap-4 rounded-2xl border bg-card p-4 pr-5">
          <PlatoVacio className="size-20 shrink-0" />
          <div className="flex flex-col gap-1">
            <p className="text-lg leading-snug font-bold text-pretty">Todavía no registraste comidas hoy.</p>
            <p className="text-sm text-musgo text-pretty">Con cada comida, el plato se va llenando.</p>
          </div>
        </div>
      )}

      {hayComidasSemana && <LineaSemana semana={semana} />}
    </section>
  )
}

/** Las comidas registradas hoy como chips con el ícono y el color de su momento. */
function ComidasDeHoy({ dia }: { dia: CoberturaDia }) {
  return (
    <ul className="flex max-w-full shrink-0 flex-wrap gap-1" aria-label={`Comidas de hoy: ${comidasRegistradas(dia)}`}>
      {vecesPorComida(dia).map(([m, n]) => {
        const visual = VISUAL_MOMENTO[m]
        const Icono = visual.icono
        const nombre = n > 1 ? `${n} ${PLURAL_MOMENTO[m]}` : NOMBRE_MOMENTO[m]
        return (
          <li key={m} className={cn('inline-flex h-8 items-center gap-1.5 rounded-full pr-2.5 pl-1 text-sm font-bold', visual.claseClaro)}>
            <span className="grid size-6 place-items-center rounded-full" style={{ background: visual.color }}>
              <Icono className={cn('size-3.5', m === 'cena' ? 'text-white' : 'text-pino')} strokeWidth={2.5} aria-hidden="true" />
            </span>
            {nombre[0].toUpperCase() + nombre.slice(1)}
          </li>
        )
      })}
    </ul>
  )
}

// Los anillos van sobre el ala del plato, a esta distancia del centro (en % del lado), desde las 12 y en sentido horario.
const RADIO = 35.5

function PlatoDelDia({ dia, faltan }: { dia: CoberturaDia; faltan: readonly Nutriente[] }) {
  const orden = ordenarNutrientes(faltan)
  const prioridad = (n: Nutriente) => faltan.includes(n)
  const hayPrioridad = orden.some(prioridad)
  const kcal = dia.consumido.valor.energia_kcal ?? 0
  // El plato se llena una sola vez, cuando aparece (queda abajo de la primera pantalla), igual que sus números.
  const ref = useRef<HTMLDivElement>(null)
  const visto = useInView(ref, { once: true, amount: 0.3 })

  return (
    <div className="flex flex-col items-center gap-3">
      <div ref={ref} className="relative aspect-square w-full max-w-[332px]">
        <svg viewBox="0 0 100 100" className="absolute inset-0 size-full" aria-hidden="true" focusable="false">
          <circle cx="50" cy="50" r="49.4" fill="var(--nb-brote)" stroke="var(--nb-hoja)" strokeWidth="0.7" />
          <circle cx="50" cy="50" r="21.5" fill="#fff" stroke="var(--nb-hoja)" strokeWidth="0.8" />
        </svg>

        <p className="absolute inset-0 m-auto flex size-[40%] flex-col items-center justify-center text-center">
          <span className="text-xs text-musgo">Energía</span>
          <span className="font-titulo text-3xl leading-none font-black">
            <span aria-hidden="true">≈ </span>
            <span className="sr-only">aproximadamente </span>
            <NumeroAnimado valor={kcal} formato={redondeo} />
          </span>
          <span className="text-xs text-musgo">kcal</span>
        </p>

        <ul aria-label="Nutrientes de hoy, de lo recomendado por día">
          {orden.map((n, i) => {
            const cobertura = Math.max(0, dia.cobertura[n] ?? 0)
            const destacado = prioridad(n)
            const angulo = (i / orden.length) * 2 * Math.PI
            return (
              <li
                key={n}
                className="absolute flex w-24 -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
                style={{ left: `${50 + RADIO * Math.sin(angulo)}%`, top: `${50 - RADIO * Math.cos(angulo)}%` }}
              >
                <Anillo
                  valor={visto ? cobertura : 0}
                  tamano={54}
                  grosor={6}
                  color={destacado ? 'var(--nb-zapallo)' : 'var(--nb-verde)'}
                  pista={destacado ? 'var(--nb-zapallo-claro)' : 'var(--nb-blanco)'}
                  retraso={0.15 + i * 0.07}
                  className="rounded-full bg-white"
                >
                  <NumeroAnimado valor={cobertura} formato={porcentaje} className="text-[0.75rem] font-bold tracking-tight" />
                </Anillo>
                <span className={cn('text-xs leading-tight', destacado && 'font-bold')}>
                  {NOMBRE_NUTRIENTE[n]}
                  {destacado && <span className="sr-only"> (le falta en la semana)</span>}
                </span>
              </li>
            )
          })}
        </ul>
      </div>

      <p className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-musgo" aria-hidden="true">
        {hayPrioridad && (
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-zapallo" />
            Le falta en la semana
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded-full border-[2.5px] border-verde" />
          Anillo lleno: lo recomendado del día
        </span>
      </p>
    </div>
  )
}

/** La semana en 8 tramos (cubiertos en verde, lo que falta en Zapallo) y su línea. */
function LineaSemana({ semana }: { semana: Progreso['semana'] }) {
  const faltan = semana.faltan.filter((n) => NUTRIENTES_CON_META.includes(n)).length
  return (
    <div className="flex flex-col gap-2.5 px-1">
      <span className="flex gap-1" aria-hidden="true">
        {NUTRIENTES_CON_META.map((n, i) => (
          <span key={n} className={cn('h-2 flex-1 rounded-full', i < NUTRIENTES_CON_META.length - faltan ? 'bg-verde' : 'bg-zapallo')} />
        ))}
      </span>
      <p className="text-sm text-pretty">{lineaSemana(semana)}</p>
    </div>
  )
}

const redondeo = (kcal: number) => (Math.round(kcal / 10) * 10).toLocaleString('es-UY')
