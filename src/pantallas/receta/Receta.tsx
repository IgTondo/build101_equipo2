// C7 · Receta con food chaining (PLAN.md §9). Ruta: /receta?nino=&nutriente=&preparacionId=&momento=&nueva=1
// v5.1: `momento` es la comida para la que es (la próxima comida del inicio): viaja en RecetaReq y titula la pantalla.
// Con preparacionId (la tarjeta de la próxima comida o de sugerencia): la receta de ese candidato se pide sola; si ya
// vio recetas de esa preparación, van sus nombres en `anteriores` y el LLM escribe otra versión.
// v5.4 · Sin preparacionId, la RECETA CREATIVA: el LLM inventa un plato nuevo con lo que sabe el grafo, a un cambio de
// un alimento seguro. Con nueva=1 ("Generar receta") se pide sola; "Otra opción" y "Probar otra idea" también son
// creativas. Cada receta se anota por comida en este celular y viaja en `anteriores`, para no repetir. El nutriente
// solo se manda si lo eligió el padre: si no, el servidor lo rota.
import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { MOMENTO, NUTRIENTE } from '../../../shared/contratos'
import type { Momento, Nutriente, Receta as RecetaT, Regla } from '../../../shared/contratos'
import { Cargando, ErrorConReintento, Vacio } from '../../componentes/Estados'
import { api, type ErrorDeApi } from '../../lib/api'
import { useNinoActivo } from '../../lib/nino'
import { anotarNombreDeReceta, anotarRecetaDeLaComida, leerNombresDeRecetas, leerRecetasDeLaComida, ultimosSinRepetir } from '../../lib/proximaComida'
import { aErrorDeApi, useApi } from '../../lib/useApi'
import { nutrienteEnFrase } from './legible'
import { SelectorNutriente } from './SelectorNutriente'
import { TarjetaReceta } from './TarjetaReceta'
import './receta.css'

type Pedido =
  | { tipo: 'eligiendo' }
  | { tipo: 'pidiendo'; etapa: number }
  | { tipo: 'ok'; receta: RecetaT }
  | { tipo: 'error'; error: ErrorDeApi; preparacionId?: string; para?: Nutriente }

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
  const nuevaInicial = useRef(!preparacionInicial.current && params.get('nueva') === '1')

  const progreso = useApi((s) => api.progreso(ninoId, { dias: 7, momento }, s), [ninoId, momento])
  const perfil = useApi((s) => api.perfil(ninoId, s), [ninoId])
  const nombre = perfil.tipo === 'ok' ? perfil.datos.datos.nombre : null
  const reglas = perfil.tipo === 'ok' ? perfil.datos.reglas : perfil.tipo === 'error' ? SIN_REGLAS : null

  const [elegido, setElegido] = useState<Nutriente | undefined>(esNutriente(nutrienteUrl) ? nutrienteUrl : undefined)
  // El que eligió el padre en el selector: el único que se manda en las creativas (`elegido` también sigue a la receta).
  const elegidoPorElPadre = useRef<Nutriente | undefined>(undefined)
  const nutriente = elegido ?? (progreso.tipo === 'ok' ? progreso.datos.semana.faltan.find((n) => n !== 'energia_kcal') : undefined)

  const [pedido, setPedido] = useState<Pedido>(() => (preparacionInicial.current || nuevaInicial.current ? { tipo: 'pidiendo', etapa: 0 } : { tipo: 'eligiendo' }))
  const control = useRef<AbortController | null>(null)
  const relojes = useRef<number[]>([])
  const vistasEnLaSesion = useRef<string[]>([])  // por si no hay storage

  function cancelar() {
    control.current?.abort()
    relojes.current.forEach((r) => window.clearTimeout(r))
    relojes.current = []
  }

  /** Sin preparacionId, la receta creativa (v5.4). */
  function pedir(preparacionId: string | undefined, para: Nutriente | undefined) {
    cancelar()
    const c = new AbortController()
    control.current = c
    setPedido({ tipo: 'pidiendo', etapa: 0 })
    const mios = ETAPAS_MS.map((ms, i) => window.setTimeout(() => {
      setPedido((p) => (p.tipo === 'pidiendo' ? { tipo: 'pidiendo', etapa: i + 1 } : p))
    }, ms))
    relojes.current = mios
    const anteriores = preparacionId
      ? leerNombresDeRecetas(ninoId, preparacionId)
      : ultimosSinRepetir([...leerRecetasDeLaComida(ninoId, momento), ...vistasEnLaSesion.current])
    api.receta({ ninoId, nutriente: para, preparacionId, ...(momento ? { momento } : {}), ...(anteriores.length ? { anteriores } : {}) }, undefined, c.signal)
      .then((receta) => {
        if (c.signal.aborted) return
        vistasEnLaSesion.current = ultimosSinRepetir([...vistasEnLaSesion.current, receta.nombre])
        anotarRecetaDeLaComida(ninoId, momento, receta.nombre)
        anotarNombreDeReceta(ninoId, receta.preparacionBaseId, receta.nombre)
        setElegido(receta.evidencia.nutriente)
        setPedido({ tipo: 'ok', receta })
        window.scrollTo({ top: 0 })
      })
      .catch((e: unknown) => { if (!c.signal.aborted) setPedido({ tipo: 'error', error: aErrorDeApi(e), preparacionId, para }) })
      .finally(() => mios.forEach((r) => window.clearTimeout(r)))
  }

  // Si vino de una tarjeta de sugerencia, se pide sola (con el nutriente de la URL o el que elija el servidor). Con
  // nueva=1 ("Generar receta"), la creativa; nueva sale de la URL para que recargar no la vuelva a pedir.
  useEffect(() => {
    if (preparacionInicial.current) pedir(preparacionInicial.current, esNutriente(nutrienteUrl) ? nutrienteUrl : undefined)
    else if (nuevaInicial.current) { pedir(undefined, undefined); sacarPreparacionDeLaUrl() }
    return cancelar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function sacarPreparacionDeLaUrl() {
    if (!params.has('preparacionId') && !params.has('nueva')) return
    setParams((p) => { p.delete('preparacionId'); p.delete('nueva'); return p }, { replace: true })
  }

  /** Otra opción (y "Probar otra idea"): otra receta creativa, sin repetir las que ya vio para esta comida. */
  function otraOpcion() {
    sacarPreparacionDeLaUrl()
    pedir(undefined, elegidoPorElPadre.current)
  }

  function elegirOtroNutriente() {
    cancelar()
    sacarPreparacionDeLaUrl()
    setPedido({ tipo: 'eligiendo' })
  }

  function elegirNutriente(n: Nutriente) {
    elegidoPorElPadre.current = n
    setElegido(n)
  }

  /** "Pedir receta" desde el selector: el que se ve en el selector cuenta como elegido por el padre. */
  function pedirConElElegido() {
    elegidoPorElPadre.current = nutriente
    pedir(undefined, nutriente)
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
        <TarjetaReceta receta={pedido.receta} reglas={reglas} para={para} />
        <div className="rc-acciones">
          <button type="button" className="nb-boton" onClick={otraOpcion}>Otra opción</button>
          <button type="button" className="nb-boton nb-boton-secundario" onClick={elegirOtroNutriente}>Elegir otro nutriente</button>
          {alTablero}
        </div>
      </>
    )
  }

  if (pedido.tipo === 'error' && pedido.error.codigo === 'sin_candidatos') {
    // En la creativa sin nutriente elegido, lo eligió el servidor: no se nombra uno que quizás no fue
    const n = pedido.para ?? (pedido.preparacionId ? nutriente : undefined)
    return (
      <>
        <Vacio titulo={`Todavía no encontramos un paso chico para ${n ? nutrienteEnFrase(n) : 'lo que le falta'}`}>
          <p className="nb-suave">Registrá algunas comidas más y aparecen nuevas ideas.</p>
          <Link className="nb-boton nb-boton-secundario" to={{ pathname: '/registrar', search: volverA.search }}>Registrar una comida</Link>
        </Vacio>
        <div className="rc-acciones">
          <button type="button" className="nb-boton" onClick={otraOpcion}>Probar otra idea</button>
          <button type="button" className="nb-boton nb-boton-secundario" onClick={elegirOtroNutriente}>Elegir otro nutriente</button>
          {alTablero}
        </div>
      </>
    )
  }

  // Eligiendo (o error reintentable): el selector de nutriente y el botón para pedir.
  const sinNutrienteTodavia = !elegido && progreso.tipo === 'cargando'
  return (
    <>
      <section className="nb-tarjeta rc-elegir" aria-labelledby="rc-elegir-titulo">
        <h1 id="rc-elegir-titulo">{para ? `Una receta ${para}` : 'Una receta para dar un pasito'}</h1>
        {sinNutrienteTodavia
          ? <Cargando texto="Mirando qué le falta esta semana…" />
          : <SelectorNutriente semana={progreso.tipo === 'ok' ? progreso.datos.semana : null} valor={nutriente} onCambiar={elegirNutriente} />}
        <button type="button" className="nb-boton" disabled={sinNutrienteTodavia} onClick={pedirConElElegido}>
          Pedir receta
        </button>
      </section>
      {pedido.tipo === 'error' && (
        <ErrorConReintento error={pedido.error} reintentar={() => pedir(pedido.preparacionId, pedido.para)} />
      )}
      <div className="rc-acciones">{alTablero}</div>
    </>
  )
}
