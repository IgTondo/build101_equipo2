// Resultado del registro (C2, PLAN v5.1): alertas si hay, "Qué aprendí", lo que aportó la comida (con rangos) y, al
// final, la próxima comida calculada con la que se acaba de registrar. Se vuelve a pedir el progreso después de
// guardar, así la sugerencia y el "Hoy" del inicio ya la cuentan. La energía va como dato, sin meta (§1). Las alertas
// derivan al profesional, sin alarmar.
// Arriba, el festejo: la foto como un plato mordido y un tilde que se dibuja.
import { cn } from 'cn'
import {
  Camera, Eraser, Footprints, Lightbulb, Repeat2, Shuffle, Sprout, Stethoscope, type LucideIcon,
} from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { Aprendizaje, Nutrientes, Rango, RegistrarComidaReq, RegistrarComidaRes } from '../../../shared/contratos'
import { Celebracion } from '../../componentes/Celebracion'
import { ErrorConReintento } from '../../componentes/Estados'
import { NumeroAnimado } from '../../componentes/NumeroAnimado'
import { TarjetaProximaComida } from '../../componentes/ProximaComida'
import { Button } from '../../componentes/ui/button'
import { api } from '../../lib/api'
import { VISUAL_MOMENTO } from '../../lib/colores'
import { comidasDelDia, horaUruguay, proximaComida } from '../../lib/proximaComida'
import { useApi } from '../../lib/useApi'
import { NOMBRE_MOMENTO, NOMBRE_NUTRIENTE, NUTRIENTES_CON_META, textoParaPadres } from '../../lib/vocabulario'
import { leerMotor } from '../tablero/calculos'
import { rangoLegible } from './modelo'
import { SALIDA, SIN_ANILLO } from './Piezas'

/** "Qué aprendí" corto: lo más nuevo primero, como mucho tres líneas. */
const MAX_APRENDI = 3

const ICONO_APRENDI: Record<Aprendizaje['tipo'], LucideIcon> = {
  aceptacion: Sprout, exposicion: Footprints, patron_nuevo: Lightbulb,
  patron_reforzado: Repeat2, patron_borrado: Eraser, contradiccion: Shuffle,
}

/** El tilde de "guardado": aparece con un resorte y se dibuja. Con movimiento reducido, ya dibujado. */
function TildeGuardado() {
  const reducir = useReducedMotion()
  return (
    <motion.span
      aria-hidden="true"
      className="absolute -right-1 -bottom-1 grid size-14 place-items-center rounded-full bg-primary ring-4 ring-background"
      initial={{ scale: reducir ? 1 : 0.4 }}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', stiffness: 420, damping: 18, delay: 0.1 }}
    >
      <svg viewBox="0 0 24 24" className="size-8">
        <motion.path
          d="M5.5 12.5l4.2 4.2L18.5 7.5"
          fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
          initial={{ pathLength: reducir ? 1 : 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.45, delay: 0.3, ease: SALIDA }}
        />
      </svg>
    </motion.span>
  )
}

/**
 * Lo que aportó la comida como parte de lo que necesita en el día: lleno hasta el mínimo del rango, más suave hasta
 * el máximo (el rango es la duda de la porción). Se llena una vez al aparecer.
 */
function BarraRango({ min, max, objetivo, retraso }: { min: number; max: number; objetivo: number; retraso: number }) {
  if (!(objetivo > 0)) return null
  const parte = (v: number) => `${Math.min(1, Math.max(0, v / objetivo)) * 100}%`
  const barra = (ancho: string, clase: string) => (
    <motion.span
      className={`absolute inset-y-0 left-0 origin-left rounded-full ${clase}`}
      style={{ width: ancho, minWidth: max > 0 ? 4 : 0 }}
      initial={{ scaleX: 0 }}
      whileInView={{ scaleX: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.9, delay: retraso, ease: SALIDA }}
    />
  )
  return (
    <span aria-hidden="true" className="relative mt-1.5 block h-2 overflow-hidden rounded-full bg-muted">
      {barra(parte(max), 'bg-hoja')}
      {min > 0 && barra(parte(min), 'bg-verde')}
    </span>
  )
}

function LoQueAporto({ rango, objetivo }: { rango: Rango; objetivo?: Nutrientes }) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border bg-card p-5" aria-labelledby="rg-nutrientes">
      <h2 id="rg-nutrientes" className="text-xl">Lo que aportó esta comida</h2>
      <dl className="grid grid-cols-2 gap-x-5 gap-y-4">
        {NUTRIENTES_CON_META.map((n, k) => (
          <div key={n} className="flex min-w-0 flex-col gap-0.5">
            <dt className="text-sm text-musgo">{NOMBRE_NUTRIENTE[n]}</dt>
            <dd className="font-bold text-pino">
              <NumeroAnimado valor={1} formato={(t) => rangoLegible(n, rango.min[n] * t, rango.max[n] * t)} />
              {objetivo && <BarraRango min={rango.min[n]} max={rango.max[n]} objetivo={objetivo[n]} retraso={0.1 + k * 0.05} />}
            </dd>
          </div>
        ))}
      </dl>
      <p className="border-t pt-3 text-pino">
        Energía: <span className="font-bold tabular-nums">{rangoLegible('energia_kcal', rango.min.energia_kcal, rango.max.energia_kcal)}</span>
      </p>
      <p className="-mt-2 text-sm text-musgo">
        Valores aproximados.{objetivo && ' La barra muestra qué parte de lo del día cubrió esta comida.'}
      </p>
    </section>
  )
}

interface Props {
  ninoId: string
  res: RegistrarComidaRes
  /** Lo que se mandó a guardar: la comida y el día, para calcular la próxima. */
  req: RegistrarComidaReq
  /** La foto que sacó el padre (dataUrl), para el festejo. */
  foto?: string
  alOtra: () => void
}

export function Resultado({ ninoId, res, req, foto, alOtra }: Props) {
  const [params] = useSearchParams()
  const motor = leerMotor(params.get('motor'))
  const registrada = { id: res.comidaId, momento: req.momento, fechaISO: req.fechaISO }
  // Las comidas del día que devolvió el registro, más la recién guardada si no venía (B puede mandar el día sin ella).
  const delDia = comidasDelDia(res.dia.dia === req.dia ? [res.dia] : [], req.dia, [registrada])
  const [hora] = useState(horaUruguay)
  const proxima = proximaComida(delDia, hora)
  const progreso = useApi(
    (s) => api.progreso(ninoId, { dias: 7, motor, momento: proxima.momento }, s),
    [ninoId, motor, res.comidaId],
  )

  const conNino = new URLSearchParams({ nino: ninoId, ...(motor !== 'grafo' ? { motor } : {}) })
  const momento = VISUAL_MOMENTO[req.momento]
  const IconoMomento = momento.icono

  return (
    <section className="flex flex-col gap-6" aria-labelledby="rg-guardado">
      <header className="flex flex-col items-center gap-3 pt-2 text-center">
        <div className="relative mb-1">
          <Celebracion activo />
          {foto ? (
            <img
              src={foto}
              alt=""
              className="size-36 rounded-full object-cover mordisco [--mordisco:30px]"
            />
          ) : (
            <span className="block size-36 rounded-full mordisco [--mordisco:30px]" style={{ background: momento.claro }} />
          )}
          <TildeGuardado />
        </div>
        <h1 id="rg-guardado" tabIndex={-1} data-foco className={cn('text-3xl', SIN_ANILLO)}>Comida guardada</h1>
        <span className="inline-flex items-center gap-2 rounded-full py-1 pr-3.5 pl-2.5 text-sm font-bold text-pino" style={{ background: momento.claro }}>
          <IconoMomento className="size-4" style={{ color: momento.color }} strokeWidth={2.25} aria-hidden="true" />
          {NOMBRE_MOMENTO[req.momento]}
        </span>
      </header>

      {res.alertas.length > 0 && (
        <section className="flex flex-col gap-3 rounded-2xl bg-zapallo-claro p-5" aria-labelledby="rg-alertas">
          <div className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-background text-pino">
              <Stethoscope className="size-5" aria-hidden="true" />
            </span>
            <h2 id="rg-alertas" className="text-xl">Algo para comentar con su pediatra</h2>
          </div>
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-pino marker:text-zapallo">
            {res.alertas.map((a, i) => <li key={`${a.tipo}-${i}`}>{a.texto}</li>)}
          </ul>
          <p className="text-sm text-musgo">No es un diagnóstico: conviene consultarlo con su pediatra o nutricionista.</p>
        </section>
      )}

      {res.aprendi.length > 0 && (
        <section className="flex flex-col gap-3" aria-labelledby="rg-aprendi">
          <h2 id="rg-aprendi" className="text-xl">Qué aprendí</h2>
          <ul className="flex flex-col gap-2">
            {res.aprendi.slice(0, MAX_APRENDI).map((a, i) => {
              const Icono = ICONO_APRENDI[a.tipo] ?? Lightbulb
              return (
                <li key={`${a.tipo}-${i}`} className="flex items-start gap-3 rounded-2xl bg-brote p-4">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-background text-verde-hondo">
                    <Icono className="size-5" aria-hidden="true" />
                  </span>
                  <p className="pt-2 text-pino">{textoParaPadres(a.texto)}</p>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <LoQueAporto rango={res.nutrientesComida} objetivo={res.dia.objetivo} />

      <div className="flex flex-col gap-3">
        {progreso.tipo === 'error'
          ? <ErrorConReintento error={progreso.error} reintentar={progreso.reintentar} />
          : <TarjetaProximaComida ninoId={ninoId} proxima={proxima} progreso={progreso.tipo === 'ok' ? progreso.datos : null} motor={motor} />}
        <Button asChild variant="outline" size="lg" className="w-full">
          <Link to={{ pathname: '/', search: `?${conNino}` }}>Volver al inicio</Link>
        </Button>
        <Button variant="ghost" className="self-center text-primary" onClick={alOtra}>
          <Camera aria-hidden="true" /> Registrar otra comida
        </Button>
      </div>
    </section>
  )
}
