// Resultado del registro (C2, PLAN v5.1): alertas si hay (una línea), "Qué aprendí" (dos líneas cortas, el resto en
// "Ver más"), lo que aportó la comida (plegado, con rangos) y, al final, la próxima comida calculada con la que se acaba
// de registrar: v5.7, la comida completa (la receta creativa de esa comida, que se empieza a armar apenas aparece este
// resultado, si no estaba ya precargada). La energía va como dato, sin meta (§1). Las alertas derivan
// al profesional, sin alarmar.
// Arriba, el festejo: la foto como un plato mordido y un tilde que se dibuja.
import { cn } from 'cn'
import { Camera, Eraser, Footprints, Lightbulb, Repeat2, Shuffle, Sprout, type LucideIcon } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Aprendizaje, Rango, Regla, RegistrarComidaReq, RegistrarComidaRes } from '../../../shared/contratos'
import { AvisoConsulta } from '../../componentes/AvisoConsulta'
import { Celebracion } from '../../componentes/Celebracion'
import { NumeroAnimado } from '../../componentes/NumeroAnimado'
import { TarjetaProximaComida } from '../../componentes/ProximaComida'
import { Button } from '../../componentes/ui/button'
import { api } from '../../lib/api'
import { VISUAL_MOMENTO } from '../../lib/colores'
import { comidasDelDia, horaUruguay, proximaComida } from '../../lib/proximaComida'
import { useApi } from '../../lib/useApi'
import { NOMBRE_MOMENTO, NOMBRE_NUTRIENTE, NUTRIENTES_CON_META, textoParaPadres } from '../../lib/vocabulario'
import { aprendiCorto, rangoLegible } from './modelo'
import { SALIDA, SIN_ANILLO } from './Piezas'

const SIN_REGLAS: Regla[] = []

/** "Qué aprendí" corto: lo más nuevo primero, dos líneas a la vista. */
const MAX_APRENDI = 2

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
 * Plegado: es un dato para quien lo quiera ver (la cobertura del día está en el inicio). Los números suben al abrirlo.
 * Sin barras: el verde y el hoja dicen "Cubierto" y "Casi" (src/lib/cobertura.ts) y una comida sola no tiene estado.
 */
function LoQueAporto({ rango }: { rango: Rango }) {
  return (
    <details className="nb-ver-mas rounded-2xl border bg-card px-5 open:pb-5">
      <summary className="min-h-14 w-full justify-between rounded-xl font-titulo text-xl font-extrabold text-foreground">
        Lo que aportó esta comida
      </summary>
      <div className="flex flex-col gap-4 pt-1">
        <dl className="grid grid-cols-2 gap-x-5 gap-y-4">
          {NUTRIENTES_CON_META.map((n) => (
            <div key={n} className="flex min-w-0 flex-col gap-0.5">
              <dt className="text-sm text-musgo">{NOMBRE_NUTRIENTE[n]}</dt>
              <dd className="font-bold text-pino">
                <NumeroAnimado valor={1} formato={(t) => rangoLegible(n, rango.min[n] * t, rango.max[n] * t)} />
              </dd>
            </div>
          ))}
        </dl>
        <p className="border-t pt-3 text-pino">
          Energía: <span className="font-bold tabular-nums">{rangoLegible('energia_kcal', rango.min.energia_kcal, rango.max.energia_kcal)}</span>
        </p>
        <p className="-mt-2 text-sm text-musgo">Valores aproximados.</p>
      </div>
    </details>
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
  const registrada = { id: res.comidaId, momento: req.momento, fechaISO: req.fechaISO }
  // Las comidas del día que devolvió el registro, más la recién guardada si no venía (B puede mandar el día sin ella).
  const delDia = comidasDelDia(res.dia.dia === req.dia ? [res.dia] : [], req.dia, [registrada])
  const [hora] = useState(horaUruguay)
  const proxima = proximaComida(delDia, hora)
  // El perfil, por el nombre y las reglas (la foto de la receta): con él, la tarjeta pide la comida completa.
  const perfil = useApi((s) => api.perfil(ninoId, s), [ninoId])
  const nombre = perfil.tipo === 'ok' ? perfil.datos.datos.nombre : null
  const reglas = perfil.tipo === 'ok' ? perfil.datos.reglas : perfil.tipo === 'error' ? SIN_REGLAS : null

  const conNino = new URLSearchParams({ nino: ninoId })
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

      <AvisoConsulta alertas={res.alertas} />

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
                  <p className="pt-2 text-pino">{aprendiCorto(textoParaPadres(a.texto))}</p>
                </li>
              )
            })}
          </ul>
          {res.aprendi.some((a, i) => i >= MAX_APRENDI || aprendiCorto(textoParaPadres(a.texto)) !== textoParaPadres(a.texto)) && (
            <details className="nb-ver-mas -mt-1.5">
              <summary className="min-h-12">Ver más</summary>
              <ul className="flex list-disc flex-col gap-1.5 pt-1 pl-6 text-sm text-musgo">
                {res.aprendi.map((a, i) => <li key={`${a.tipo}-${i}`}>{textoParaPadres(a.texto)}</li>)}
              </ul>
            </details>
          )}
        </section>
      )}

      <LoQueAporto rango={res.nutrientesComida} />

      <div className="flex flex-col gap-3">
        <TarjetaProximaComida ninoId={ninoId} proxima={proxima} reglas={reglas} nombre={nombre} />
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
