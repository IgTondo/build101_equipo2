// Grafo del chico (C13): lo que Nibble aprendió, dibujado. Para el padre y para la diapositiva "¿por qué un grafo?".
// Datos: GET /api/perfil?ninoId&vista=grafo (pista B). Hacia el padre nunca se dice "rechaza": es "Todavía no".
import { Component, type ReactNode, type RefObject, Suspense, lazy, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Cargando, ErrorConReintento, Vacio } from '../../componentes/Estados'
import { PerfilNoEncontrado } from '../../componentes/PerfilNoEncontrado'
import { ErrorDeApi, pedirConMeta } from '../../lib/api'
import { useNinoActivo } from '../../lib/nino'
import { useApi } from '../../lib/useApi'
import {
  type GrafoVista, type Modelo, type Nodo, NOMBRE_ESTADO, armarModelo, atributosDe, contar, esGrafoVista,
  ordenarPreps, patronesDePrep, prepsDe, prepsDePatron,
} from './modelo'
import './grafo.css'

const Lienzo = lazy(() => import('./Lienzo'))

async function pedirGrafo(ninoId: string, senal: AbortSignal): Promise<GrafoVista> {
  const { datos } = await pedirConMeta<unknown>(`/api/perfil?${new URLSearchParams({ ninoId, vista: 'grafo' })}`, { senal })
  if (!esGrafoVista(datos)) {
    throw new ErrorDeApi(200, { error: { codigo: 'interno', mensaje: 'No pudimos leer el grafo. ¿Probás de nuevo?', reintentable: true } })
  }
  return datos
}

export function Grafo() {
  const ninoId = useNinoActivo()
  const estado = useApi((s) => pedirGrafo(ninoId, s), [ninoId])
  const conNino = `?nino=${encodeURIComponent(ninoId)}`

  if (estado.tipo === 'cargando') return <Cargando texto="Armando el grafo…" />
  if (estado.tipo === 'error') {
    if (estado.error.codigo === 'no_encontrado') return <PerfilNoEncontrado />
    return <ErrorConReintento error={estado.error} reintentar={estado.reintentar} />
  }
  const modelo = armarModelo(estado.datos)
  if (!modelo.nodos.some((n) => n.clase === 'prep')) {
    return (
      <Vacio titulo="Todavía no hay líneas">
        <p className="nb-suave">Cuando registres su primera comida, acá vas a ver qué le gusta y por qué.</p>
        <Link className="nb-boton" to={`/registrar${conNino}`}>Registrar una comida</Link>
      </Vacio>
    )
  }
  return <VistaGrafo modelo={modelo} conNino={conNino} />
}

function useReducido(): boolean {
  const consulta = '(prefers-reduced-motion: reduce)'
  const [reducido, setReducido] = useState(() => typeof matchMedia === 'function' && matchMedia(consulta).matches)
  useEffect(() => {
    if (typeof matchMedia !== 'function') return
    const mq = matchMedia(consulta)
    const cambio = () => setReducido(mq.matches)
    mq.addEventListener('change', cambio)
    return () => mq.removeEventListener('change', cambio)
  }, [])
  return reducido
}

function useAncho<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T>(null)
  const [ancho, setAncho] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const medir = () => setAncho(Math.floor(el.clientWidth))
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, ancho]
}

/** Si el chunk del grafo no carga (sin conexión), queda la lista: el contenido es el mismo. */
class SiFalla extends Component<{ children: ReactNode }, { fallo: boolean }> {
  state = { fallo: false }
  static getDerivedStateFromError() { return { fallo: true } }
  render() {
    if (this.state.fallo) return <p className="gf-fallo">No pudimos dibujar el grafo. Abajo está el mismo contenido como lista.</p>
    return this.props.children
  }
}

function VistaGrafo({ modelo, conNino }: { modelo: Modelo; conNino: string }) {
  const [seleccion, setSeleccion] = useState<string | null>(null)
  const [explorar, setExplorar] = useState(false)
  const [centrar, setCentrar] = useState(0)
  const reducido = useReducido()
  const [caja, ancho] = useAncho<HTMLDivElement>()
  const detalle = useRef<HTMLElement>(null)
  const tituloDetalle = useRef<HTMLHeadingElement>(null)
  const cuenta = contar(modelo)
  const nombre = modelo.nino?.nombre ?? 'tu hijo'
  const alto = Math.round(Math.min(580, Math.max(380, ancho * 1.3)))
  const elegido = seleccion ? modelo.porId.get(seleccion) ?? null : null

  const resumen = `Grafo de lo que Nibble aprendió de ${nombre}: acepta ${cuenta.acepta} preparaciones, ${cuenta.enProceso} están en proceso` +
    `${cuenta.todaviaNo ? ` y ${cuenta.todaviaNo} todavía no` : ''}, con ${cuenta.patrones} patrones. La lista de abajo tiene el mismo contenido.`

  function elegirDesdeLienzo(id: string | null) {
    setSeleccion(id)
    if (id) requestAnimationFrame(() => detalle.current?.scrollIntoView({ block: 'nearest', behavior: reducido ? 'auto' : 'smooth' }))
  }
  function elegirDesdeLista(id: string) {
    setSeleccion(id)
    requestAnimationFrame(() => {
      tituloDetalle.current?.focus({ preventScroll: true })
      detalle.current?.scrollIntoView({ block: 'nearest', behavior: reducido ? 'auto' : 'smooth' })
    })
  }

  return (
    <div className="gf">
      <header className="gf-encabezado">
        <h1>Cómo lo aprendimos</h1>
      </header>

      <section className="nb-tarjeta gf-tarjeta-lienzo" aria-label={`El grafo de ${nombre}`}>
        <Leyenda />
        <div ref={caja} className="gf-lienzo" data-explorar={explorar || undefined} role="img" aria-label={resumen} style={{ height: alto }}>
          {ancho > 0 && (
            <SiFalla>
              <Suspense fallback={<div className="gf-cargando-lienzo"><Cargando texto="Dibujando el grafo…" /></div>}>
                <Lienzo
                  modelo={modelo} seleccion={seleccion} onSeleccionar={elegirDesdeLienzo}
                  ancho={ancho} alto={alto} reducido={reducido} explorar={explorar} centrar={centrar}
                />
              </Suspense>
            </SiFalla>
          )}
        </div>
        <div className="gf-controles">
          <button type="button" className="gf-control" aria-pressed={explorar} onClick={() => setExplorar((e) => !e)}>
            {explorar ? 'Listo, dejar de mover' : 'Acercar y mover'}
          </button>
          <button type="button" className="gf-control" onClick={() => { setSeleccion(null); setCentrar((c) => c + 1) }}>Ver todo</button>
        </div>
      </section>

      <section ref={detalle} className="nb-tarjeta gf-detalle" aria-live="polite" aria-labelledby="gf-t-detalle">
        {elegido ? (
          <Detalle modelo={modelo} nodo={elegido} tituloRef={tituloDetalle} elegir={elegirDesdeLista} />
        ) : (
          <>
            <h2 id="gf-t-detalle" ref={tituloDetalle} tabIndex={-1}>{nombre}</h2>
            <p className="gf-numeros">
              <span><strong className="nb-numero">{cuenta.acepta}</strong> acepta</span>
              <span><strong className="nb-numero">{cuenta.enProceso}</strong> en proceso</span>
              {cuenta.todaviaNo > 0 && <span><strong className="nb-numero">{cuenta.todaviaNo}</strong> todavía no</span>}
              <span><strong className="nb-numero">{cuenta.patrones}</strong> {cuenta.patrones === 1 ? 'patrón' : 'patrones'}</span>
            </p>
            <p className="nb-suave gf-ayuda">Tocá un punto para ver el detalle.</p>
          </>
        )}
      </section>

      <ListaAccesible modelo={modelo} elegir={elegirDesdeLista} />

      <Link className="nb-boton nb-boton-secundario" to={`/perfil${conNino}`}>Volver al perfil</Link>
    </div>
  )
}

function Leyenda() {
  return (
    <ul className="gf-leyenda" aria-label="Referencias">
      <li><span className="gf-muestra gf-m-acepta" aria-hidden="true" />Acepta</li>
      <li><span className="gf-muestra gf-m-proceso" aria-hidden="true" />En proceso</li>
      <li><span className="gf-muestra gf-m-todavia" aria-hidden="true" />Todavía no</li>
      <li><span className="gf-muestra gf-m-atributo" aria-hidden="true" />Característica</li>
      <li><span className="gf-muestra gf-m-patron" aria-hidden="true" />Patrón</li>
      <li><span className="gf-muestra gf-m-linea" aria-hidden="true" />Más gruesa, más segura</li>
    </ul>
  )
}

const veces = (n = 0) => (n === 1 ? '1 vez' : `${n} veces`)
const pct = (x = 0) => `${Math.round(x * 100)}%`

function Chips({ lista, elegir }: { lista: Nodo[]; elegir: (id: string) => void }) {
  if (!lista.length) return null
  return (
    <ul className="gf-chips">
      {lista.map((n) => (
        <li key={n.id}>
          <button type="button" className="gf-chip" data-estado={n.estado} onClick={() => elegir(n.id)}>{n.nombre}</button>
        </li>
      ))}
    </ul>
  )
}

function Detalle({ modelo, nodo, tituloRef, elegir }: { modelo: Modelo; nodo: Nodo; tituloRef: RefObject<HTMLHeadingElement | null>; elegir: (id: string) => void }) {
  const titulo = <h2 id="gf-t-detalle" ref={tituloRef} tabIndex={-1}>{nodo.nombre}</h2>
  if (nodo.clase === 'prep') {
    const atributos = atributosDe(modelo, nodo.id)
    const porQue = patronesDePrep(modelo, nodo.id)
    return (
      <>
        <p className="gf-tipo"><span className="gf-estado" data-estado={nodo.estado}>{NOMBRE_ESTADO[nodo.estado ?? 'en_proceso']}</span></p>
        {titulo}
        <dl className="gf-dl">
          <dt>En el plato</dt><dd className="nb-numero">{veces(nodo.veces)}</dd>
          {nodo.puntaje !== undefined && (
            <>
              <dt>Aceptación</dt>
              <dd>
                <span className="gf-barra" aria-hidden="true"><span style={{ width: pct(nodo.puntaje) }} /></span>
                <span className="nb-numero">{pct(nodo.puntaje)}</span>
              </dd>
            </>
          )}
        </dl>
        {atributos.length > 0 && (<><h3>Cómo es</h3><Chips lista={atributos} elegir={elegir} /></>)}
        {porQue.length > 0 && (
          <>
            <h3>Lo que tiene que ver</h3>
            <ul className="gf-lista-simple">
              {porQue.slice(0, 4).map((p) => (
                <li key={p.id}>
                  <button type="button" className="gf-enlace" onClick={() => elegir(p.id)}>{p.nombre}</button>
                  {p.apoyo && <span className="gf-meta nb-numero"> · {p.apoyo.n} de {p.apoyo.de}</span>}
                </li>
              ))}
            </ul>
          </>
        )}
      </>
    )
  }
  if (nodo.clase === 'patron') {
    const preps = prepsDePatron(modelo, nodo.id)
    return (
      <>
        <p className="gf-tipo">{nodo.investigacion ? 'De la investigación' : 'Patrón que encontramos'}</p>
        {titulo}
        {nodo.apoyo && (
          <p>Se cumplió en <strong className="nb-numero">{nodo.apoyo.n} de {nodo.apoyo.de}</strong> comidas en las que estuvo.</p>
        )}
        <h3>Se fija en</h3>
        <Chips lista={atributosDe(modelo, nodo.id)} elegir={elegir} />
        {preps.length > 0 && (<><h3>Sus comidas que lo cumplen</h3><Chips lista={preps} elegir={elegir} /></>)}
      </>
    )
  }
  if (nodo.clase === 'atributo') {
    const preps = prepsDe(modelo, nodo.id)
    const patrones = [...(modelo.vecinos.get(nodo.id) ?? [])].map((id) => modelo.porId.get(id)!).filter((n) => n.clase === 'patron')
    return (
      <>
        <p className="gf-tipo">Característica{nodo.categoria ? ` · ${nodo.categoria}` : ''}</p>
        {titulo}
        <p>La comparten <strong className="nb-numero">{preps.length}</strong> {preps.length === 1 ? 'comida' : 'comidas'} de su grafo.</p>
        <Chips lista={preps} elegir={elegir} />
        {patrones.length > 0 && (
          <>
            <h3>Patrones que la usan</h3>
            <ul className="gf-lista-simple">
              {patrones.map((p) => (
                <li key={p.id}><button type="button" className="gf-enlace" onClick={() => elegir(p.id)}>{p.nombre}</button></li>
              ))}
            </ul>
          </>
        )}
      </>
    )
  }
  const cuenta = contar(modelo)
  return (
    <>
      {titulo}
      <p>Acepta <strong className="nb-numero">{cuenta.acepta}</strong>, está explorando <strong className="nb-numero">{cuenta.enProceso}</strong> y encontramos <strong className="nb-numero">{cuenta.patrones}</strong> patrones.</p>
    </>
  )
}

function ListaAccesible({ modelo, elegir }: { modelo: Modelo; elegir: (id: string) => void }) {
  const id = useId()
  const grupos = useMemo(() => {
    const preps = ordenarPreps(modelo.nodos.filter((n) => n.clase === 'prep'))
    return [
      { titulo: 'Acepta', lista: preps.filter((n) => n.estado === 'acepta') },
      { titulo: 'En proceso', lista: preps.filter((n) => n.estado === 'en_proceso') },
      { titulo: 'Todavía no', lista: preps.filter((n) => n.estado === 'todavia_no') },
      { titulo: 'Patrones', lista: modelo.nodos.filter((n) => n.clase === 'patron') },
      { titulo: 'Características', lista: modelo.nodos.filter((n) => n.clase === 'atributo').sort((a, b) => b.grado - a.grado) },
    ].filter((g) => g.lista.length)
  }, [modelo])

  const conexiones = (n: Nodo) => {
    if (n.clase === 'prep') {
      const partes = [`${veces(n.veces)} en el plato`, ...(n.puntaje !== undefined ? [`aceptación ${pct(n.puntaje)}`] : [])]
      const atr = atributosDe(modelo, n.id).map((a) => a.nombre)
      return `${partes.join(', ')}. ${atr.length ? `Es: ${atr.join(', ')}.` : ''}`
    }
    if (n.clase === 'patron') {
      const base = n.apoyo ? `En ${n.apoyo.n} de ${n.apoyo.de} comidas.` : 'De la investigación.'
      return `${base} Se fija en: ${atributosDe(modelo, n.id).map((a) => a.nombre).join(', ')}.`
    }
    const preps = prepsDe(modelo, n.id).map((p) => p.nombre)
    return `${n.categoria ? `${n.categoria}. ` : ''}${preps.length ? `La tienen: ${preps.join(', ')}.` : 'La usa un patrón.'}`
  }

  return (
    <details className="nb-tarjeta gf-lista">
      <summary>Ver el grafo como lista</summary>
      {grupos.map((g, i) => (
        <section key={g.titulo} aria-labelledby={`${id}-${i}`}>
          <h3 id={`${id}-${i}`}>{g.titulo} <span className="gf-meta nb-numero">{g.lista.length}</span></h3>
          <ul>
            {g.lista.map((n) => (
              <li key={n.id}>
                <button type="button" className="gf-enlace" onClick={() => elegir(n.id)}>{n.nombre}</button>
                <span className="gf-conexiones">{conexiones(n)}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </details>
  )
}
