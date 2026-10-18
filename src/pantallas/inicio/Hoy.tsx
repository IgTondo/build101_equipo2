// "Hoy" (PLAN v5.1, §9 "La pantalla principal"): cómo viene en nutrientes en el día, con cada comida registrada, y una
// línea de la semana. Sin porcentajes: cada nutriente tiene un estado (Cubierto / Casi / Le falta, src/lib/cobertura.ts).
// El día es un plato visto desde arriba: los 8 nutrientes son anillos alrededor del borde, con el ícono y el color de su
// estado, que se llenan hasta lo recomendado por día y no pasan. Abajo, los mismos agrupados por estado en tres líneas
// que se leen de un vistazo (el detalle, barras y cantidades, está en la semana). La energía va en el centro, como dato,
// sin meta. Sin comidas hoy, el plato vacío.
import { cn } from 'cn'
import { useInView } from 'motion/react'
import { useId, useRef } from 'react'
import type { CoberturaDia, Momento, Nutriente, Progreso } from '../../../shared/contratos'
import { Anillo } from '../../componentes/Anillo'
import { EtiquetaEstado } from '../../componentes/EstadoNutriente'
import { PlatoVacio } from '../../componentes/Ilustraciones'
import { NumeroAnimado } from '../../componentes/NumeroAnimado'
import { contarEstados, ESTADOS, estadoCobertura, fraccionBarra, type EstadoCobertura } from '../../lib/cobertura'
import { VISUAL_MOMENTO } from '../../lib/colores'
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

/** El color de cada anillo según su estado, como las barras de la semana: verde, Hoja y Zapallo (con su pista teñida). */
const ANILLO: Record<EstadoCobertura, { color: string; pista: string }> = {
  cubierto: { color: 'var(--nb-verde)', pista: 'var(--nb-blanco)' },
  casi: { color: 'var(--nb-hoja)', pista: 'var(--nb-blanco)' },
  falta: { color: 'var(--nb-zapallo)', pista: 'var(--nb-zapallo-claro)' },
}

function PlatoDelDia({ dia, faltan }: { dia: CoberturaDia; faltan: readonly Nutriente[] }) {
  const grupos = porEstado(dia.cobertura, ordenarNutrientes(faltan))
  // En el plato, en el mismo orden que las líneas de abajo: lo cubierto, lo que casi y lo que le falta, juntos.
  const anillos = grupos.flatMap((g) => g.nutrientes.map((n) => ({ n, estado: g.estado })))
  const kcal = dia.consumido.valor.energia_kcal ?? 0
  // El plato se llena una sola vez, cuando aparece (queda abajo de la primera pantalla), igual que sus números.
  const ref = useRef<HTMLDivElement>(null)
  const visto = useInView(ref, { once: true, amount: 0.3 })

  return (
    <div className="flex flex-col items-center gap-4">
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

        {/* Lo mismo que dicen las líneas de abajo, dibujado: para los lectores de pantalla quedan las líneas. */}
        <ul aria-hidden="true">
          {anillos.map(({ n, estado }, i) => {
            const angulo = (i / anillos.length) * 2 * Math.PI
            return (
              <li
                key={n}
                className="absolute flex w-24 -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
                style={{ left: `${50 + RADIO * Math.sin(angulo)}%`, top: `${50 - RADIO * Math.cos(angulo)}%` }}
              >
                <Anillo
                  valor={visto ? fraccionBarra(dia.cobertura[n] ?? 0) : 0}
                  tamano={54}
                  grosor={6}
                  color={ANILLO[estado].color}
                  pista={ANILLO[estado].pista}
                  retraso={0.15 + i * 0.07}
                  className="rounded-full bg-white"
                >
                  <IconoEstado estado={estado} />
                </Anillo>
                <span className="text-xs leading-tight">{NOMBRE_NUTRIENTE[n]}</span>
              </li>
            )
          })}
        </ul>
      </div>

      <p className="flex items-center gap-1.5 text-xs text-musgo" aria-hidden="true">
        <span className="size-3 rounded-full border-[2.5px] border-verde" />
        Anillo lleno: lo recomendado del día
      </p>

      <p className="sr-only">Nutrientes de hoy, contra lo recomendado por día:</p>
      <dl className="grid w-full grid-cols-[max-content_minmax(0,1fr)] items-baseline gap-x-3 gap-y-2.5 px-1">
        {grupos.map((g) => (
          <div key={g.estado} className="contents">
            <dt><EtiquetaEstado estado={g.estado} /></dt>
            <dd className="leading-snug text-pretty">{listaNutrientes(g.nutrientes)}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/**
 * El ícono del estado en el centro del anillo, el mismo de EtiquetaEstado para que las líneas de abajo sirvan de
 * leyenda: lleno con un check (Cubierto), por la mitad (Casi) o un aro vacío (Le falta).
 */
function IconoEstado({ estado }: { estado: EstadoCobertura }) {
  return (
    <svg className="size-5" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      {estado === 'cubierto' && (
        <>
          <circle cx="8" cy="8" r="8" className="fill-verde" />
          <path d="M4.75 8.25 7 10.5l4.25-4.5" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {estado === 'casi' && (
        <>
          <circle cx="8" cy="8" r="6.75" fill="none" strokeWidth="2.5" className="stroke-verde" />
          <path d="M8 1.25a6.75 6.75 0 0 1 0 13.5z" className="fill-verde" />
        </>
      )}
      {estado === 'falta' && <circle cx="8" cy="8" r="6.75" fill="none" strokeWidth="2.5" className="stroke-zapallo" />}
    </svg>
  )
}

const TRAMO: Record<EstadoCobertura, string> = { cubierto: 'bg-verde', casi: 'bg-hoja', falta: 'bg-zapallo' }

/** La semana en 8 tramos, uno por nutriente con el color de su estado (la misma cuenta que la semana), y su línea. */
function LineaSemana({ semana }: { semana: Progreso['semana'] }) {
  const cuenta = contarEstados(semana.cobertura)
  const tramos = ESTADOS.flatMap((estado) => Array.from({ length: cuenta[estado] }, () => estado))
  return (
    <div className="flex flex-col gap-2.5 px-1">
      <span className="flex gap-1" aria-hidden="true">
        {tramos.map((estado, i) => (
          <span key={i} className={cn('h-2 flex-1 rounded-full', TRAMO[estado])} />
        ))}
      </span>
      <p className="text-sm text-pretty">{lineaSemana(semana)}</p>
    </div>
  )
}

const redondeo = (kcal: number) => (Math.round(kcal / 10) * 10).toLocaleString('es-UY')
