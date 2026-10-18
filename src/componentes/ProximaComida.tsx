// La tarjeta "Próxima comida" (PLAN v5.1, §9): la protagonista del inicio y el cierre del registro. "Para el almuerzo"
// + la sugerencia con su porqué en una línea (el completo está en la receta), sin LLM, sobre el cielo de esa comida
// (VISUAL_MOMENTO: el tinte y un disco, el sol o la luna, con el alimento encima). Al tocarla se abre la receta para esa
// comida. Es una sugerencia: el padre puede servir otra cosa. Una sugerencia "segura" (algo que ya come) no abre
// receta: se muestra sin enlace.
import { cn } from 'cn'
import { ChefHat } from 'lucide-react'
import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { Nutriente, Progreso } from '../../shared/contratos'
import { VISUAL_MOMENTO } from '../lib/colores'
import { elegirSugerencia, lineaPorQue, rutaRecetaComida, type Principal, type ProximaComida } from '../lib/proximaComida'
import { Bocaditos } from './Estados'
import { IconoAlimento } from './IconoAlimento'

interface Props {
  ninoId: string
  proxima: ProximaComida
  /** null mientras carga. */
  progreso: Pick<Progreso, 'sugerencias' | 'proximoPaso' | 'semana' | 'momento'> | null
}

const RESORTE = { type: 'spring', stiffness: 420, damping: 34 } as const

/** El cielo de cada comida. La cena es la única oscura: texto claro y la acción en Hoja. */
const CIELO: Record<Principal, { fondo: string; disco: string; suave: string; accion: string }> = {
  desayuno: { fondo: 'bg-momento-desayuno-claro text-pino', disco: 'bg-momento-desayuno', suave: 'text-musgo', accion: 'bg-primary text-primary-foreground' },
  almuerzo: { fondo: 'bg-momento-almuerzo-claro text-pino', disco: 'bg-momento-almuerzo', suave: 'text-musgo', accion: 'bg-primary text-primary-foreground' },
  cena: { fondo: 'bg-momento-cena text-white', disco: 'bg-momento-cena-claro', suave: 'text-white/85', accion: 'bg-hoja text-pino' },
}

export function TarjetaProximaComida({ ninoId, proxima, progreso }: Props) {
  const titulo = <h2 className="sr-only">Próxima comida</h2>
  const cielo = CIELO[proxima.momento]

  if (!progreso) {
    return (
      <section aria-busy="true">
        {titulo}
        <Flota>
          <Cielo proxima={proxima} disco={<span className="grid size-20 place-items-center rounded-full bg-brote"><Bocaditos /></span>}>
            <p role="status" aria-live="polite" className={cn('mt-3 font-titulo text-2xl font-extrabold', cielo.suave)}>
              Buscando una idea…
            </p>
            <span aria-hidden="true" className="mt-4 block h-3 w-1/2 animate-pulse rounded-full bg-white/60 motion-reduce:animate-none" />
            <span aria-hidden="true" className="mt-2.5 block h-3 w-1/3 animate-pulse rounded-full bg-white/60 motion-reduce:animate-none" />
          </Cielo>
        </Flota>
      </section>
    )
  }

  const s = elegirSugerencia(progreso, proxima.momento)
  if (!s) {
    const Momento = VISUAL_MOMENTO[proxima.momento].icono
    return (
      <section>
        {titulo}
        <Flota>
          <Cielo
            proxima={proxima}
            disco={
              <span className="grid size-20 place-items-center rounded-full bg-brote text-pino">
                <Momento className="size-9" strokeWidth={2} />
              </span>
            }
          >
            {/* Una sola frase (C9), en dos renglones: lo que pasa y qué hacer. */}
            <p className="mt-3 text-pretty">
              <span className="block font-titulo text-2xl font-extrabold">Todavía sin idea:</span>{' '}
              <span className={cn('mt-1 block', cielo.suave)}>registrá algunas comidas más.</span>
            </p>
          </Cielo>
        </Flota>
      </section>
    )
  }

  const icono = (
    <motion.span initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={RESORTE} className="grid">
      <IconoAlimento nombre={s.nombre} grupo={s.grupo} tamano="xl" />
    </motion.span>
  )
  const nombre = <span className="mt-3 block font-titulo text-[2rem] leading-[1.06] font-black">{s.nombre}</span>
  // El porqué en una sola línea (C9): la primera oración hasta los dos puntos y, si igual no entra, con "…".
  const porQue = s.porQue ? <span className="mt-3 block truncate">{lineaPorQue(s.porQue)}</span> : null

  if (s.tipo === 'segura') {
    return (
      <section>
        {titulo}
        <Flota>
          <Cielo proxima={proxima} disco={icono}>{nombre}{porQue}</Cielo>
        </Flota>
      </section>
    )
  }

  const nutriente: Nutriente | undefined = progreso.semana.faltan.find((n) => n !== 'energia_kcal')
  return (
    <section>
      {titulo}
      <Flota tocable>
        <Link to={rutaRecetaComida(ninoId, s, proxima.momento, nutriente)} className="block rounded-3xl focus-visible:outline-none">
          <Cielo proxima={proxima} disco={icono}>
            {nombre}
            {porQue}
            <span className={cn('clear-right mt-5 flex h-12 w-fit items-center gap-2 rounded-full pr-6 pl-5 font-bold', cielo.accion)}>
              <ChefHat className="size-5" strokeWidth={2.25} aria-hidden="true" />
              Ver la receta
            </span>
          </Cielo>
        </Link>
      </Flota>
    </section>
  )
}

/** La única sombra de la pantalla va afuera: el mordisco la recortaría. Si se toca, responde con un resorte. */
function Flota({ tocable, children }: { tocable?: boolean; children: ReactNode }) {
  const clase = 'rounded-3xl shadow-flotante'
  if (!tocable) return <div className={clase}>{children}</div>
  return (
    <motion.div
      whileTap={{ scale: 0.97 }}
      transition={RESORTE}
      className={cn(clase, 'has-[a:focus-visible]:outline-3 has-[a:focus-visible]:outline-offset-3 has-[a:focus-visible]:outline-verde')}
    >
      {children}
    </motion.div>
  )
}

/** La superficie: el tinte de la comida, el mordisco y el disco a la derecha, que el texto rodea. */
function Cielo({ proxima, disco, children }: { proxima: ProximaComida; disco: ReactNode; children: ReactNode }) {
  const cielo = CIELO[proxima.momento]
  const Icono = VISUAL_MOMENTO[proxima.momento].icono
  return (
    <div className={cn('mordisco relative overflow-hidden rounded-3xl px-5 pt-5 pb-6', cielo.fondo)}>
      {proxima.momento === 'cena' && <Estrellas />}
      <span
        aria-hidden="true"
        className={cn(
          'relative float-right -mt-9 -mr-12 mb-2 ml-3 grid size-36 place-items-center rounded-full [shape-margin:6px] [shape-outside:circle(50%)]',
          cielo.disco,
        )}
      >
        <span className="-translate-x-3 translate-y-2.5">{disco}</span>
      </span>
      {/* En línea (no flex), para que rodee el disco por su forma y no por su caja. */}
      <span className="relative block font-bold">
        <Icono className="mr-2 inline size-5 align-[-0.2em]" strokeWidth={2.25} aria-hidden="true" />
        {proxima.etiqueta}
      </span>
      <div className="relative">{children}</div>
    </div>
  )
}

/** Tres puntitos de luz abajo a la derecha, donde no hay texto: el cielo de la cena. */
function Estrellas() {
  return (
    <span aria-hidden="true">
      <span className="absolute right-[12%] bottom-[16%] size-1.5 rounded-full bg-white/60" />
      <span className="absolute right-[26%] bottom-[9%] size-1 rounded-full bg-white/70" />
      <span className="absolute right-[7%] bottom-[30%] size-1 rounded-full bg-white/50" />
    </span>
  )
}
