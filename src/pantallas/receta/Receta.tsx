// C7 · Receta con food chaining (PLAN.md §9). Ruta: /receta?nino=&nutriente=&preparacionId=&momento=
// v5.1: `momento` es la comida para la que es (la próxima comida del inicio): viaja en RecetaReq y titula la pantalla.
// Sin preparacionId: el padre elige el nutriente (por defecto, el primero de semana.faltan) y pide la receta.
// Con preparacionId (viene de una tarjeta de sugerencia del tablero): la receta se pide sola.
// v5.3: si la receta es la del pasito del plato de esa comida (Progreso.plato, el mismo que vio el padre en el inicio:
// sale de la caché en memoria, o se vuelve a pedir con el mismo ?momento= si se recargó), la imagen dibuja el plato
// completo. Con ?ver=plato ("Ver cómo servirlo" en el inicio), al llegar la receta se baja hasta esa imagen.
import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { MOMENTO, NUTRIENTE } from '../../../shared/contratos'
import type { Momento, Nutriente, Receta as RecetaT, Regla } from '../../../shared/contratos'
import { Cargando, ErrorConReintento, Vacio } from '../../componentes/Estados'
import { api, type ErrorDeApi } from '../../lib/api'
import { useNinoActivo } from '../../lib/nino'
import { platoDe, platoParaImagen } from '../../lib/platoComida'
import { useProgresoComida } from '../../lib/progresoComida'
import { aErrorDeApi, useApi } from '../../lib/useApi'
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

  const verPlato = useRef(params.get('ver') === 'plato')
  const progreso = useProgresoComida(ninoId, momento)
  const datosProgreso = progreso.datos
  const plato = momento && datosProgreso ? platoDe(datosProgreso, momento) : null
  // La imagen espera al progreso (si es para una comida), para pedirla una sola vez y con el plato si lo hay.
  const progresoListo = !momento || datosProgreso !== null || progreso.error !== null
  const perfil = useApi((s) => api.perfil(ninoId, s), [ninoId])
  const nombre = perfil.tipo === 'ok' ? perfil.datos.datos.nombre : null
  const reglas = perfil.tipo === 'ok' ? perfil.datos.reglas : perfil.tipo === 'error' ? SIN_REGLAS : null

  const [elegido, setElegido] = useState<Nutriente | undefined>(esNutriente(nutrienteUrl) ? nutrienteUrl : undefined)
  const nutriente = elegido ?? datosProgreso?.semana.faltan.find((n) => n !== 'energia_kcal')

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
        if (!verPlato.current) window.scrollTo({ top: 0 })
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

  // "Ver cómo servirlo": con la primera receta, a la imagen del plato (una sola vez).
  useEffect(() => {
    if (pedido.tipo !== 'ok' || !verPlato.current) return
    verPlato.current = false
    const servir = document.getElementById('rc-servir')
    servir?.scrollIntoView({ block: 'start' })
    servir?.focus({ preventScroll: true })
  }, [pedido])

  function sacarPreparacionDeLaUrl() {
    verPlato.current = false
    if (!params.has('preparacionId') && !params.has('ver')) return
    setParams((p) => { p.delete('preparacionId'); p.delete('ver'); return p }, { replace: true })
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
  const alTablero = <Link className="nb-boton nb-boton-secundario" to={volverA}>{momento ? 'Volver al inicio' : 'Volver a la semana'}</Link>

  if (pedido.tipo === 'pidiendo') {
    const etapas = [nombre ? `Mirando lo que ya come ${nombre}…` : 'Mirando lo que ya come…', 'Escribiendo la receta…', 'Revisando alergias…']
    return (
      <section className="nb-tarjeta rc-progreso" aria-labelledby="rc-progreso-titulo">
        <h1 id="rc-progreso-titulo">Preparando una receta{para ? ` ${para}` : ''}</h1>
        <Cargando texto={etapas[pedido.etapa]} />
        <ol className="rc-etapas" aria-hidden="true">
          {etapas.map((t, i) => (
            <li key={t} data-estado={i < pedido.etapa ? 'hecha' : i === pedido.etapa ? 'actual' : 'pendiente'}>{t.replace('…', '')}</li>
          ))}
        </ol>
      </section>
    )
  }

  if (pedido.tipo === 'ok') {
    return (
      <>
        <TarjetaReceta
          receta={pedido.receta}
          reglas={progresoListo ? reglas : null}
          para={para}
          plato={platoParaImagen(plato, pedido.receta)}
        />
        <div className="rc-acciones">
          <button type="button" className="nb-boton" onClick={() => otraOpcion(pedido.receta)}>Otra opción</button>
          <button type="button" className="nb-boton nb-boton-secundario" onClick={elegirOtroNutriente}>Elegir otro nutriente</button>
          {alTablero}
        </div>
      </>
    )
  }

  if (pedido.tipo === 'error' && pedido.error.codigo === 'sin_candidatos') {
    return (
      <>
        <Vacio titulo={`Todavía no encontramos un paso chico para ${nutriente ? nutrienteEnFrase(nutriente) : 'lo que le falta'}`}>
          <p className="nb-suave">Registrá algunas comidas más y aparecen nuevas ideas.</p>
          <Link className="nb-boton" to={{ pathname: '/registrar', search: volverA.search }}>Registrar una comida</Link>
        </Vacio>
        <div className="rc-acciones">
          <button type="button" className="nb-boton nb-boton-secundario" onClick={elegirOtroNutriente}>Elegir otro nutriente</button>
          {alTablero}
        </div>
      </>
    )
  }

  // Eligiendo (o error reintentable): el selector de nutriente y el botón para pedir.
  const sinNutrienteTodavia = !elegido && !datosProgreso && !progreso.error
  return (
    <>
      <section className="nb-tarjeta rc-elegir" aria-labelledby="rc-elegir-titulo">
        <h1 id="rc-elegir-titulo">{para ? `Una receta ${para}` : 'Una receta para dar un pasito'}</h1>
        {sinNutrienteTodavia
          ? <Cargando texto="Mirando qué le falta esta semana…" />
          : <SelectorNutriente semana={datosProgreso?.semana ?? null} valor={nutriente} onCambiar={setElegido} />}
        <button type="button" className="nb-boton" disabled={sinNutrienteTodavia} onClick={() => pedir(undefined)}>
          Pedir receta
        </button>
      </section>
      {pedido.tipo === 'error' && (
        <ErrorConReintento error={pedido.error} reintentar={() => pedir(pedido.preparacionId)} />
      )}
      <div className="rc-acciones">{alTablero}</div>
    </>
  )
}
