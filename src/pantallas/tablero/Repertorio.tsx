// Repertorio, grupos y exposiciones en curso (§1). Tono: cada escalón cuenta; nunca se premia "comer todo".
// Lo que come se ve: una grilla de sus preparaciones, cada una con su ícono del color de su grupo, ordenadas por grupo.
// La lista sale del perfil; si todavía no llegó (o no se pudo traer), queda el número solo.
import { Minus, TrendingDown, TrendingUp } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useId, useState } from 'react'
import type { Cuanto, Progreso } from '../../../shared/contratos'
import { CUANTO } from '../../../shared/contratos'
import { IconoAlimento } from '../../componentes/IconoAlimento'
import { NumeroAnimado } from '../../componentes/NumeroAnimado'
import { Button } from '../../componentes/ui/button'
import { Skeleton } from '../../componentes/ui/skeleton'
import { ESCALON, NIVEL_CUANTO, NOMBRE_GRUPO } from '../../lib/vocabulario'
import { fraseGrupoAusente, GRUPOS_VISIBLES, textoDiasSinComer, textoTendencia, textoVeces } from './calculos'
import { grupoDe, type Comestible } from './visual'

type Props = Pick<Progreso, 'aceptadas' | 'enProceso' | 'repertorioTendencia' | 'grupos' | 'exposiciones'> & {
  /** Lo que acepta, ya ordenado por grupo. undefined = cargando; null = no se pudo traer. */
  loQueCome?: Comestible[] | null
}

const EXPOSICIONES_A_LA_VISTA = 4
/** La escalera de §5.1, de abajo (lo apartó) hacia arriba. */
const ESCALERA: Cuanto[] = [...CUANTO].sort((a, b) => NIVEL_CUANTO[a] - NIVEL_CUANTO[b])
/** Desde cuántos días sin comer un grupo se marca en Zapallo (lo mismo que ya marcaba el tablero). */
const DIAS_LEJOS = 7

export function Repertorio({ aceptadas, enProceso, repertorioTendencia, grupos, exposiciones, loQueCome }: Props) {
  const id = useId()
  const [todas, setTodas] = useState(false)
  // Solo los grupos que manda B (§1: fruta, verdura, lácteo y proteína), en un orden fijo: un grupo que no viene
  // no es "nunca lo registramos", es un dato que no se calcula.
  const visibles = GRUPOS_VISIBLES.flatMap((g) => grupos.filter((x) => x.grupo === g))
  const frase = fraseGrupoAusente(grupos)
  const listaExp = todas ? exposiciones : exposiciones.slice(0, EXPOSICIONES_A_LA_VISTA)
  const Tendencia = repertorioTendencia > 0 ? TrendingUp : repertorioTendencia < 0 ? TrendingDown : Minus

  return (
    <>
      <section className="flex flex-col gap-4" aria-labelledby={`${id}-r`}>
        <h2 id={`${id}-r`} className="text-xl">Lo que come</h2>

        <div className="flex flex-col gap-2">
          <p className="flex items-end gap-3">
            <NumeroAnimado valor={aceptadas} className="font-titulo text-5xl leading-[0.85] font-black text-pino" />
            <span className="text-lg leading-tight">{aceptadas === 1 ? 'preparación que acepta' : 'preparaciones que acepta'}</span>
          </p>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold ${repertorioTendencia > 0 ? 'bg-brote text-verde-noche' : 'bg-muted text-pino'}`}>
              <Tendencia className="size-4" strokeWidth={2.5} aria-hidden="true" />
              {textoTendencia(repertorioTendencia)}
            </span>
            {enProceso > 0 && <span className="text-sm text-musgo">Y {enProceso} en camino.</span>}
          </p>
        </div>

        {loQueCome === undefined && aceptadas > 0 && (
          <div className="grid grid-cols-3 gap-x-2 gap-y-4" aria-hidden="true">
            {Array.from({ length: Math.min(aceptadas, 3) }, (_, i) => (
              <span key={i} className="flex flex-col items-center gap-2">
                <Skeleton className="size-14 rounded-full" />
                <Skeleton className="h-3.5 w-20 rounded-full" />
              </span>
            ))}
          </div>
        )}
        {loQueCome && loQueCome.length > 0 && (
          <ul className="grid grid-cols-3 gap-x-2 gap-y-4" aria-label="Lo que acepta">
            {loQueCome.map((p) => (
              <li key={p.id} className="flex flex-col items-center gap-1.5 text-center">
                <IconoAlimento nombre={p.nombre} grupo={p.grupo} tamano="lg" />
                <span className="line-clamp-2 text-sm leading-snug text-pretty">{p.nombre}</span>
              </li>
            ))}
          </ul>
        )}

        {visibles.length > 0 && (
          <div className="mt-2 flex flex-col gap-2">
            <h3 className="text-lg">Última vez que comió de cada grupo</h3>
            {frase && <p className="font-bold text-pretty">{frase}.</p>}
            <ul className="flex flex-col">
              {visibles.map((g) => {
                const lejos = g.diasSinComer !== null && g.diasSinComer >= DIAS_LEJOS
                return (
                  <li
                    key={g.grupo}
                    className={`flex min-h-13 items-center gap-3 rounded-xl px-2.5 py-1.5 ${lejos ? 'bg-zapallo-claro' : ''}`}
                  >
                    <IconoAlimento nombre={NOMBRE_GRUPO[g.grupo]} grupo={g.grupo} tamano="sm" className={lejos ? 'bg-background!' : undefined} />
                    <span className="flex-1">{NOMBRE_GRUPO[g.grupo]}</span>
                    <span className={`text-right tabular-nums ${lejos ? 'font-bold text-pino' : 'text-musgo'}`}>
                      {textoDiasSinComer(g.diasSinComer)}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4" aria-labelledby={`${id}-e`}>
        <h2 id={`${id}-e`} className="text-xl">Alimentos nuevos en camino</h2>
        {exposiciones.length === 0 ? (
          <p className="text-musgo text-pretty">Todavía no hay alimentos nuevos en camino. Cuando le ofrezcas uno, acá vas a ver cómo avanza.</p>
        ) : (
          <>
            <ul className="flex flex-col divide-y">
              <AnimatePresence initial={false}>
                {listaExp.map((e) => (
                  <motion.li
                    key={e.preparacionId}
                    className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 overflow-hidden py-3 first:pt-1"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  >
                    <IconoAlimento nombre={e.nombre} grupo={grupoDe(e.preparacionId, e.nombre)} tamano="md" />
                    <div className="flex min-w-0 flex-col leading-snug">
                      <p className="font-bold text-pretty">{e.nombre}</p>
                      <p className="text-sm">Hasta ahora: {ESCALON[e.mejorPaso]}</p>
                      <p className="text-sm text-musgo tabular-nums">{textoVeces(e.veces)}</p>
                    </div>
                    <Escalera paso={e.mejorPaso} />
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
            {exposiciones.length > EXPOSICIONES_A_LA_VISTA && (
              <Button variant="secondary" className="w-full" onClick={() => setTodas((t) => !t)} aria-expanded={todas}>
                {todas ? 'Ver menos' : `Ver los ${exposiciones.length}`}
              </Button>
            )}
          </>
        )}
      </section>
    </>
  )
}

/** Los 7 escalones de §5.1 como una escalerita que sube: llenos hasta el mejor paso que dio. */
function Escalera({ paso }: { paso: Cuanto }) {
  const nivel = NIVEL_CUANTO[paso]
  return (
    <span className="flex h-9 items-end gap-[3px]" role="img" aria-label={`Escalón ${nivel + 1} de ${ESCALERA.length}: ${ESCALON[paso]}`}>
      {ESCALERA.map((c, i) => (
        <span
          key={c}
          className={`w-[7px] rounded-t-[3px] rounded-b-[1px] ${NIVEL_CUANTO[c] <= nivel ? 'bg-verde' : 'bg-border'}`}
          style={{ height: `${28 + i * 12}%` }}
        />
      ))}
    </span>
  )
}
