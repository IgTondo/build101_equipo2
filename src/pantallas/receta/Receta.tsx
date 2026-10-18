// C7 · Receta con food chaining (PLAN.md §9). Ruta: /receta?nino=&nutriente=&preparacionId=&momento=
// v5.1: `momento` es la comida para la que es (la próxima comida del inicio): viaja en RecetaReq y titula la pantalla.
// Sin preparacionId: el padre elige el nutriente (por defecto, el primero de semana.faltan) y pide la receta.
// Con preparacionId (viene de una tarjeta de sugerencia del tablero): la receta se pide sola.
import { ArrowLeft, CookingPot, RefreshCw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { MOMENTO, NUTRIENTE } from '../../../shared/contratos'
import type { Momento, Nutriente, Receta as RecetaT, Regla } from '../../../shared/contratos'
import { Cargando, ErrorConReintento, Vacio } from '../../componentes/Estados'
import { Button } from '../../componentes/ui/button'
import { api, type ErrorDeApi } from '../../lib/api'
import { useNinoActivo } from '../../lib/nino'
import { aErrorDeApi, useApi } from '../../lib/useApi'
import { EsperaReceta } from './EsperaReceta'
import { nutrienteEnFrase } from './legible'
import { SelectorNutriente } from './SelectorNutriente'
import { TarjetaReceta } from './TarjetaReceta'
import './receta.css'

type Pedido =
  | { tipo: 'eligiendo' }
  | { tipo: 'pidiendo'; etapa: number }
  | { tipo: 'ok'; receta: RecetaT }
  | { tipo: 'error'; error: ErrorDeApi; preparacionId?: string }

/** Cuándo avanza el texto de progreso mientras se espera la receta (ms desde que se pidió). */
const ETAPAS_MS = [2500, 6500]
const SIN_REGLAS: Regla[] = []

const esNutriente = (x: string | null): x is Nutriente => x !== null && x !== 'energia_kcal' && (NUTRIENTE as readonly string[]).includes(x)
const esMomento = (x: string | null): x is Momento => x !== null && (MOMENTO as readonly string[]).includes(x)

/** "para el almuerzo" · "para la cena" · "para la merienda" (la comida de ?momento=). */
export const PARA_LA_COMIDA: Record<Momento, string> = {
  desayuno: 'para el desayuno', almuerzo: 'para el almuerzo', merienda: 'para la merienda', cena: 'para la cena', colacion: 'para la colación',
}

export function Receta() {
  const ninoId = useNinoActivo()
  const [params, setParams] = useSearchParams()
  const nutrienteUrl = params.get('nutriente')
  const momentoUrl = params.get('momento')
  const momento = esMomento(momentoUrl) ? momentoUrl : undefined
  const para = momento ? PARA_LA_COMIDA[momento] : null
  const preparacionInicial = useRef(params.get('preparacionId') ?? undefined)

  const progreso = useApi((s) => api.progreso(ninoId, { dias: 7, momento }, s), [ninoId, momento])
  const perfil = useApi((s) => api.perfil(ninoId, s), [ninoId])
  const nombre = perfil.tipo === 'ok' ? perfil.datos.datos.nombre : null
  const reglas = perfil.tipo === 'ok' ? perfil.datos.reglas : perfil.tipo === 'error' ? SIN_REGLAS : null

  const [elegido, setElegido] = useState<Nutriente | undefined>(esNutriente(nutrienteUrl) ? nutrienteUrl : undefined)
  const nutriente = elegido ?? (progreso.tipo === 'ok' ? progreso.datos.semana.faltan.find((n) => n !== 'energia_kcal') : undefined)

  const [pedido, setPedido] = useState<Pedido>(() => (preparacionInicial.current ? { tipo: 'pidiendo', etapa: 0 } : { tipo: 'eligiendo' }))
  const control = useRef<AbortController | null>(null)
  const relojes = useRef<number[]>([])
  const mostradas = useRef(new Set<string>())

  function cancelar() {
    control.current?.abort()
    relojes.current.forEach((r) => window.clearTimeout(r))
    relojes.current = []
  }

  function pedir(preparacionId: string | undefined, para: Nutriente | undefined = nutriente) {
    cancelar()
    const c = new AbortController()
    control.current = c
    setPedido({ tipo: 'pidiendo', etapa: 0 })
    const mios = ETAPAS_MS.map((ms, i) => window.setTimeout(() => {
      setPedido((p) => (p.tipo === 'pidiendo' ? { tipo: 'pidiendo', etapa: i + 1 } : p))
    }, ms))
    relojes.current = mios
    api.receta({ ninoId, nutriente: para, preparacionId, ...(momento ? { momento } : {}) }, undefined, c.signal)
      .then((receta) => {
        if (c.signal.aborted) return
        mostradas.current.add(receta.preparacionBaseId)
        setElegido(receta.evidencia.nutriente)
        setPedido({ tipo: 'ok', receta })
        window.scrollTo({ top: 0 })
      })
      .catch((e: unknown) => { if (!c.signal.aborted) setPedido({ tipo: 'error', error: aErrorDeApi(e), preparacionId }) })
      .finally(() => mios.forEach((r) => window.clearTimeout(r)))
  }

  // Si vino de una tarjeta de sugerencia, se pide sola (con el nutriente de la URL o el que elija el servidor).
  useEffect(() => {
    if (preparacionInicial.current) pedir(preparacionInicial.current, esNutriente(nutrienteUrl) ? nutrienteUrl : undefined)
    return cancelar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function sacarPreparacionDeLaUrl() {
    if (!params.has('preparacionId')) return
    setParams((p) => { p.delete('preparacionId'); return p }, { replace: true })
  }

  /** Otra opción: el siguiente candidato de la evidencia que todavía no vio; si no queda ninguno, el mejor del servidor. */
  function otraOpcion(receta: RecetaT) {
    sacarPreparacionDeLaUrl()
    const siguiente = receta.evidencia.candidatos.find((c) => !mostradas.current.has(c.preparacionId))
    pedir(siguiente?.preparacionId, receta.evidencia.nutriente)
  }

  function elegirOtroNutriente() {
    cancelar()
    sacarPreparacionDeLaUrl()
    mostradas.current.clear()
    setPedido({ tipo: 'eligiendo' })
  }

  // Desde el inicio (con ?momento=) se vuelve al inicio; desde el tablero, a la semana.
  const volverA = { pathname: momento ? '/' : '/tablero', search: `?${new URLSearchParams({ nino: ninoId })}` }
  const alTablero = (
    <Button asChild variant="ghost" className="self-center text-musgo">
      <Link to={volverA}><ArrowLeft aria-hidden="true" />{momento ? 'Volver al inicio' : 'Volver a la semana'}</Link>
    </Button>
  )

  if (pedido.tipo === 'pidiendo') {
    const etapas = [nombre ? `Mirando lo que ya come ${nombre}…` : 'Mirando lo que ya come…', 'Escribiendo la receta…', 'Revisando alergias…']
    return <EsperaReceta titulo={`Preparando una receta${para ? ` ${para}` : ''}`} etapas={etapas} etapa={pedido.etapa} />
  }

  if (pedido.tipo === 'ok') {
    return (
      <>
        <TarjetaReceta receta={pedido.receta} reglas={reglas} para={para} momento={momento} />
        <div className="mt-4 flex flex-col gap-2.5">
          <Button size="lg" onClick={() => otraOpcion(pedido.receta)}><RefreshCw aria-hidden="true" />Otra opción</Button>
          <Button size="lg" variant="outline" onClick={elegirOtroNutriente}>Elegir otro nutriente</Button>
          {alTablero}
        </div>
      </>
    )
  }

  if (pedido.tipo === 'error' && pedido.error.codigo === 'sin_candidatos') {
    return (
      <>
        <Vacio titulo={`Todavía no encontramos un paso chico para ${nutriente ? nutrienteEnFrase(nutriente) : 'lo que le falta'}`}>
          <p className="text-musgo">Registrá algunas comidas más y aparecen nuevas ideas.</p>
          <Button asChild className="mt-1">
            <Link to={{ pathname: '/registrar', search: volverA.search }}>Registrar una comida</Link>
          </Button>
        </Vacio>
        <div className="flex flex-col gap-2.5">
          <Button size="lg" variant="outline" onClick={elegirOtroNutriente}>Elegir otro nutriente</Button>
          {alTablero}
        </div>
      </>
    )
  }

  // Eligiendo (o error reintentable): el selector de nutriente y el botón para pedir.
  const sinNutrienteTodavia = !elegido && progreso.tipo === 'cargando'
  return (
    <>
      <section className="flex flex-col gap-5" aria-labelledby="rc-elegir-titulo">
        <h1 id="rc-elegir-titulo" className="text-3xl font-black">{para ? `Una receta ${para}` : 'Una receta para dar un pasito'}</h1>
        {/* El error va arriba: si la receta se pidió sola y falló, es lo primero que tiene que ver. */}
        {pedido.tipo === 'error' && (
          <ErrorConReintento error={pedido.error} reintentar={() => pedir(pedido.preparacionId)} />
        )}
        <div className="mordisco rounded-3xl bg-brote px-5 pt-5 pb-6 [--mordisco:30px]">
          {sinNutrienteTodavia
            ? <Cargando texto="Mirando qué le falta esta semana…" className="min-h-24" />
            : <SelectorNutriente semana={progreso.tipo === 'ok' ? progreso.datos.semana : null} valor={nutriente} onCambiar={setElegido} />}
        </div>
        {/* Queda a mano arriba de la barra de navegación mientras se elige (ya viene elegido lo que más le falta).
            El halo blanco lo separa de lo que pasa por debajo, sin otra sombra. */}
        <Button
          size="lg"
          disabled={sinNutrienteTodavia}
          onClick={() => pedir(undefined)}
          className="sticky bottom-[calc(max(14px,env(safe-area-inset-bottom))+76px)] z-30 shadow-[0_0_0_8px_var(--background)]"
        >
          <CookingPot aria-hidden="true" />Pedir receta
        </Button>
      </section>
      {alTablero}
    </>
  )
}
