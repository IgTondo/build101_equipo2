// La tarjeta "Próxima comida" (PLAN v5.1, §9): la protagonista del inicio y el cierre del registro, sobre el cielo de
// esa comida (VISUAL_MOMENTO: el tinte y un disco, el sol o la luna, con el alimento encima).
// v5.7 · Muestra la COMIDA COMPLETA: la receta creativa precargada (src/lib/recetaPrevia.ts), con el plato nuevo de
// título y lo que ya come que la completa debajo ("con puré de papa y bastones de zanahoria"). "Ver la receta" abre esa
// misma receta (la pantalla usa la precargada: sale al instante). La primera vez tarda (15–30 s): la tarjeta lo dice con
// calma mientras arma. Es una sugerencia: el padre puede servir otra cosa.
import { cn } from 'cn'
import { ChefHat, RotateCw } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { Regla } from '../../shared/contratos'
import type { ErrorDeApi } from '../lib/api'
import { VISUAL_MOMENTO } from '../lib/colores'
import {
  componenteNuevo, enDosRenglones, restoDelPlato, rutaRecetaNueva, textoArmando, type Principal, type ProximaComida,
} from '../lib/proximaComida'
import { useRecetaPrevia } from '../lib/recetaPrevia'
import { Bocaditos } from './Estados'
import { IconoAlimento } from './IconoAlimento'

interface Props {
  ninoId: string
  proxima: ProximaComida
  /** Las reglas del perfil (para la foto de la receta). null mientras no están: la tarjeta espera sin pedir. */
  reglas: Regla[] | null
  /** El nombre del chico, para "Armando la cena de Valentina…". */
  nombre?: string | null
}

const RESORTE = { type: 'spring', stiffness: 420, damping: 34 } as const
/** Si la receta tarda más que esto, una segunda línea tranquiliza: es una comida entera. */
const TARDA_MS = 9000

/** El cielo de cada comida. La cena es la única oscura: texto claro y la acción en Hoja. */
const CIELO: Record<Principal, { fondo: string; disco: string; suave: string; accion: string }> = {
  desayuno: { fondo: 'bg-momento-desayuno-claro text-pino', disco: 'bg-momento-desayuno', suave: 'text-musgo', accion: 'bg-primary text-primary-foreground' },
  almuerzo: { fondo: 'bg-momento-almuerzo-claro text-pino', disco: 'bg-momento-almuerzo', suave: 'text-musgo', accion: 'bg-primary text-primary-foreground' },
  cena: { fondo: 'bg-momento-cena text-white', disco: 'bg-momento-cena-claro', suave: 'text-white/85', accion: 'bg-hoja text-pino' },
}

/** sin_candidatos sin problemas de validación: todavía no sabemos qué come en esta comida (pedir de nuevo no cambia nada). */
function sinSeguros(error: ErrorDeApi): boolean {
  const detalle = error.cuerpo.error.detalle
  return error.codigo === 'sin_candidatos' && !(detalle && typeof detalle === 'object' && 'problemas' in detalle)
}

export function TarjetaProximaComida({ ninoId, proxima, reglas, nombre }: Props) {
  const titulo = <h2 className="sr-only">Próxima comida</h2>
  const cielo = CIELO[proxima.momento]
  const estado = useRecetaPrevia(ninoId, proxima.momento, reglas)

  if (estado.tipo === 'cargando') {
    return (
      <section aria-busy="true">
        {titulo}
        <Flota>
          <Cielo proxima={proxima} disco={<span className="grid size-20 place-items-center rounded-full bg-brote"><Bocaditos /></span>}>
            <p role="status" aria-live="polite" className={cn('mt-3 font-titulo text-2xl font-extrabold text-pretty', cielo.suave)}>
              {textoArmando(proxima.momento, nombre)}
            </p>
            <Paciencia suave={cielo.suave} />
          </Cielo>
        </Flota>
      </section>
    )
  }

  if (estado.tipo === 'error') {
    const Momento = VISUAL_MOMENTO[proxima.momento].icono
    const calmo = sinSeguros(estado.error)
    // Una sola frase (C9), en dos renglones: lo que pasa y qué hacer (si se puede reintentar, lo dice el botón).
    const [arriba, abajo] = calmo ? enDosRenglones(estado.error.message) : ['No pudimos armar la comida.', reglas ? null : '¿Probás de nuevo en un rato?']
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
            <p className="mt-3 text-pretty" role={calmo ? undefined : 'alert'}>
              <span className="block font-titulo text-2xl font-extrabold">{arriba}</span>{' '}
              {abajo && <span className={cn('mt-1 block', cielo.suave)}>{abajo}</span>}
            </p>
            {!calmo && reglas && (
              <motion.button
                type="button"
                onClick={estado.reintentar}
                whileTap={{ scale: 0.96 }}
                transition={RESORTE}
                className={cn('clear-right mt-5 flex h-12 w-fit items-center gap-2 rounded-full pr-6 pl-5 font-bold focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-verde', cielo.accion)}
              >
                <RotateCw className="size-5" strokeWidth={2.25} aria-hidden="true" />
                ¿Probás de nuevo?
              </motion.button>
            )}
          </Cielo>
        </Flota>
      </section>
    )
  }

  const { receta } = estado
  const nuevo = componenteNuevo(receta)
  const resto = restoDelPlato(receta)
  return (
    <section>
      {titulo}
      <Flota tocable>
        {/* Abre la receta que muestra (v5.9): la pantalla de la receta la toma del state, sin pedir otra */}
        <Link to={rutaRecetaNueva(ninoId, proxima.momento)} state={{ receta }} className="block rounded-3xl focus-visible:outline-none">
          <Cielo
            proxima={proxima}
            disco={
              <motion.span key={receta.nombre} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={RESORTE} className="grid">
                <IconoAlimento nombre={nuevo?.nombre ?? receta.nombre} grupo={nuevo?.grupo} tamano="xl" />
              </motion.span>
            }
          >
            <span className="mt-3 block font-titulo text-[2rem] leading-[1.06] font-black text-balance">{receta.nombre}</span>
            {resto && <span className="mt-3 line-clamp-3 block text-pretty">{resto}</span>}
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

/** Mientras arma: dos renglones que respiran y, si tarda, una línea tranquila (no es un error). */
function Paciencia({ suave }: { suave: string }) {
  const [tarda, setTarda] = useState(false)
  useEffect(() => {
    const t = window.setTimeout(() => setTarda(true), TARDA_MS)
    return () => window.clearTimeout(t)
  }, [])
  if (tarda) {
    return (
      <motion.p initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={RESORTE} className={cn('mt-3 text-pretty', suave)}>
        Puede tardar unos segundos: es una comida entera, con lo que ya come.
      </motion.p>
    )
  }
  return (
    <>
      <span aria-hidden="true" className="mt-4 block h-3 w-1/2 animate-pulse rounded-full bg-white/60 motion-reduce:animate-none" />
      <span aria-hidden="true" className="mt-2.5 block h-3 w-1/3 animate-pulse rounded-full bg-white/60 motion-reduce:animate-none" />
    </>
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
