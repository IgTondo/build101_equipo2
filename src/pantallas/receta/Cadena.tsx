// La cadena del food chaining, en un vistazo: lo que ya come → el paso nuevo, cada uno con su ícono y el color de su
// grupo, unidos por un puente de bocaditos con lo único que cambia en el medio. Abajo, lo que se mantiene igual.
// El puente se arma una vez al aparecer (es el momento de la pantalla); con movimiento reducido aparece quieto.
import { cn } from 'cn'
import type { LucideIcon } from 'lucide-react'
import { ArrowLeftRight, Check, Citrus, Flame, Shapes, Sprout, Thermometer, Waves } from 'lucide-react'
import { motion } from 'motion/react'
import type { Cambio, Grupo } from '../../../shared/contratos'
import { IconoAlimento } from '../../componentes/IconoAlimento'
import { COLOR_GRUPO } from '../../lib/colores'
import { NOMBRE_CAMBIO } from '../../lib/vocabulario'
import { aceptacionLegible, valorLegible } from './legible'

const ICONO_CAMBIO: Record<Cambio, LucideIcon> = {
  fortificar: Sprout, coccion: Flame, forma: Shapes, sabor: Citrus, ingrediente: ArrowLeftRight, temperatura: Thermometer, textura: Waves,
}

const RESORTE = { type: 'spring', stiffness: 420, damping: 26 } as const

interface Punta { nombre: string; grupo: Grupo | null }

interface Props {
  desde: Punta
  hacia: Punta
  cambio: Cambio
  seMantiene: string[]
  /** "2/2": cuántas veces aceptó lo que ya come. */
  aceptacion?: string
}

/** Un bocadito del puente: aparece con un saltito, de izquierda a derecha. `extra`: se esconde en pantallas angostas. */
function Bocado({ color, orden, extra = false }: { color: string; orden: number; extra?: boolean }) {
  return (
    <motion.span
      className={cn('size-2 rounded-full', extra && 'max-[379px]:hidden')}
      style={{ background: color }}
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ ...RESORTE, delay: 0.15 + orden * 0.09 }}
    />
  )
}

export function Cadena({ desde, hacia, cambio, seMantiene, aceptacion }: Props) {
  const colorDesde = desde.grupo ? COLOR_GRUPO[desde.grupo].color : 'var(--nb-hoja)'
  const colorHacia = hacia.grupo ? COLOR_GRUPO[hacia.grupo].color : 'var(--nb-verde)'
  const Icono = ICONO_CAMBIO[cambio]
  const mantiene = seMantiene.map(valorLegible)

  return (
    <section aria-labelledby="rc-cadena" className="flex flex-col gap-5">
      <h2 id="rc-cadena" className="sr-only">Un paso desde lo que ya come</h2>

      <div className="grid grid-cols-2 gap-x-3 gap-y-3">
        <p className="col-span-2 text-center text-musgo">
          Cambia <strong className="text-pino">{NOMBRE_CAMBIO[cambio]}</strong>
        </p>

        {/* Los dos íconos y el puente entre sus centros (el ícono xl mide 80 px). */}
        <div className="relative col-span-2 grid grid-cols-2" aria-hidden="true">
          <IconoAlimento nombre={desde.nombre} grupo={desde.grupo} tamano="xl" className="justify-self-center" />
          <motion.span
            className="justify-self-center"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ ...RESORTE, delay: 0.62 }}
          >
            <IconoAlimento nombre={hacia.nombre} grupo={hacia.grupo} tamano="xl" />
          </motion.span>
          <div className="absolute inset-y-0 right-[calc(25%+45px)] left-[calc(25%+45px)] flex items-center justify-between">
            <Bocado color={colorDesde} orden={0} extra />
            <Bocado color={colorDesde} orden={1} />
            <motion.span
              className="grid size-10 shrink-0 place-items-center rounded-full border-2 border-hoja bg-background text-verde-noche"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ ...RESORTE, delay: 0.33 }}
            >
              <Icono className="size-5" strokeWidth={2.25} />
            </motion.span>
            <Bocado color={colorHacia} orden={3} />
            <Bocado color={colorHacia} orden={4} extra />
          </div>
        </div>

        <div className="flex flex-col items-center gap-0.5 text-center">
          <p className="font-bold text-pretty">{desde.nombre}</p>
          <p className="text-sm text-musgo">Lo que ya come</p>
          {aceptacion && <p className="text-sm text-musgo">({aceptacionLegible(aceptacion)})</p>}
        </div>
        <div className="flex flex-col items-center gap-0.5 text-center">
          <p className="font-bold text-pretty">{hacia.nombre}</p>
          <p className="text-sm text-musgo">El paso nuevo</p>
        </div>
      </div>

      {mantiene.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          <span className="mr-1 text-sm text-musgo">Se mantiene</span>
          <ul className="contents">
            {mantiene.map((m) => (
              <li key={m} className="inline-flex h-8 items-center gap-1 rounded-full bg-brote px-3 text-sm font-bold text-verde-noche">
                <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
                {m}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
