// El dibujo del grafo (C13). Se carga con React.lazy: react-force-graph queda en su propio chunk.
// Canvas no entiende var(): los colores se leen de los tokens con getComputedStyle al montar.
import { useEffect, useMemo, useRef, useState } from 'react'
import ForceGraph2D, { type ForceGraphMethods, type LinkObject, type NodeObject } from 'react-force-graph-2d'
import { ALARGADO, type Arista, type Modelo, type Nodo, atributosDe, posicionesIniciales, prepsDePatron, radioDe } from './modelo'

type N = NodeObject<Nodo & { x?: number; y?: number; vx?: number; vy?: number; fx?: number; fy?: number }>
type L = LinkObject<Nodo, Arista>

export interface PropsLienzo {
  modelo: Modelo
  seleccion: string | null
  onSeleccionar: (id: string | null) => void
  ancho: number
  alto: number
  reducido: boolean
  explorar: boolean
  /** Cambia cuando el padre pide volver a centrar. */
  centrar: number
}

interface Paleta {
  acepta: string; enProceso: string; todaviaNo: string; bordeProceso: string; texto: string; suave: string
  superficie: string; borde: string; marca: string; fuente: string
}

function leerPaleta(): Paleta {
  const css = getComputedStyle(document.documentElement)
  const v = (nombre: string, si: string) => css.getPropertyValue(nombre).trim() || si
  return {
    acepta: v('--nb-verde', '#3E9A68'),
    enProceso: v('--nb-hoja', '#A6DDB9'),
    todaviaNo: v('--nb-musgo', '#5A6E64'),
    bordeProceso: v('--nb-verde-hondo', '#2E7D52'),
    texto: v('--nb-texto', '#2F5C4B'),
    suave: v('--nb-texto-suave', '#5A6E64'),
    superficie: v('--nb-superficie', '#FFFFFF'),
    borde: v('--nb-borde', '#DCE8E0'),
    marca: v('--nb-marca', '#3E9A68'),
    fuente: v('--nb-font-texto', 'system-ui, sans-serif'),
  }
}

/** Tamaño de cada nodo, en unidades del mundo (escala con el zoom). */
function radio(n: Nodo): number {
  if (n.clase === 'nino') return 13
  if (n.clase === 'prep') return 6 + 4 * Math.min(n.veces ?? 0, 10) / 10
  if (n.clase === 'patron') return 4.5
  return 3
}

const color = (p: Paleta, n: Nodo) => (n.estado === 'acepta' ? p.acepta : n.estado === 'todavia_no' ? p.todaviaNo : p.enProceso)

/**
 * Fuerza propia que lleva cada nodo a su anillo (no dependemos de d3-force directamente). Los anillos son elipses
 * más altas que anchas (ALARGADO), porque el celular está parado.
 */
function fuerzaAnillos(fuerza = 0.7) {
  let nodos: N[] = []
  const f = (alpha: number) => {
    for (const n of nodos) {
      if (n.clase === 'nino' || n.x === undefined || n.y === undefined) continue
      const y = n.y / ALARGADO
      const d = Math.hypot(n.x, y) || 1e-6
      const k = ((radioDe(n) - d) / d) * fuerza * alpha
      n.vx = (n.vx ?? 0) + n.x * k
      n.vy = (n.vy ?? 0) + y * k * ALARGADO
    }
  }
  f.initialize = (ns: N[]) => { nodos = ns }
  return f
}

/** Que no se pisen (n chico: alcanza con todos contra todos). */
function fuerzaChoque(extra = 5) {
  let nodos: N[] = []
  const f = () => {
    for (let i = 0; i < nodos.length; i++) {
      const a = nodos[i]
      for (let j = i + 1; j < nodos.length; j++) {
        const b = nodos[j]
        if (a.x === undefined || a.y === undefined || b.x === undefined || b.y === undefined) continue
        const dx = b.x - a.x
        const dy = b.y - a.y
        const min = radio(a) + radio(b) + extra
        const d = Math.hypot(dx, dy) || 1e-6
        if (d >= min) continue
        const empuje = ((min - d) / d) * 0.5
        const fa = a.clase === 'nino' ? 0 : b.clase === 'nino' ? 1 : 0.5
        a.vx = (a.vx ?? 0) - dx * empuje * fa
        a.vy = (a.vy ?? 0) - dy * empuje * fa
        b.vx = (b.vx ?? 0) + dx * empuje * (1 - fa)
        b.vy = (b.vy ?? 0) + dy * empuje * (1 - fa)
      }
    }
  }
  f.initialize = (ns: N[]) => { nodos = ns }
  return f
}

/** Orden para poner etiquetas: primero lo elegido y sus vecinos, después el chico, lo que acepta, etc. */
function prioridad(n: Nodo, seleccion: string | null, cerca: Set<string>): number {
  if (n.id === seleccion) return 0
  if (cerca.has(n.id)) return 1 + (n.clase === 'prep' ? 0 : 0.5)
  if (n.clase === 'nino') return 2
  if (n.clase === 'prep') return (n.estado === 'acepta' ? 3 : n.estado === 'en_proceso' ? 4 : 5) - (n.veces ?? 0) / 100
  if (n.clase === 'atributo') return n.grado >= 4 ? 6 - n.grado / 100 : 99
  return 99 // los patrones se nombran al elegirlos
}

const VACIO = { nodes: [] as N[], links: [] as L[] }

export default function Lienzo({ modelo, seleccion, onSeleccionar, ancho, alto, reducido, explorar, centrar }: PropsLienzo) {
  const ref = useRef<ForceGraphMethods<N, L> | undefined>(undefined)
  const paleta = useMemo(leerPaleta, [])
  const [listo, setListo] = useState(false)
  const centrado = useRef(false)
  const datos = useMemo(() => {
    const pos = posicionesIniciales(modelo)
    const nodes: N[] = modelo.nodos.map((n) => {
      const p = pos.get(n.id)!
      return n.clase === 'nino' ? { ...n, x: 0, y: 0, fx: 0, fy: 0 } : { ...n, x: p.x, y: p.y }
    })
    const links: L[] = modelo.aristas.map((a) => ({ ...a, source: a.desde, target: a.hasta }))
    return { nodes, links }
  }, [modelo])

  // Lo que se resalta con la selección: sus vecinos y, si es un patrón, también las comidas que lo cumplen.
  const elegido = seleccion ? modelo.porId.get(seleccion) : undefined
  const cerca = useMemo(() => {
    if (!seleccion) return new Set<string>()
    if (elegido?.clase === 'patron') return new Set([...atributosDe(modelo, seleccion), ...prepsDePatron(modelo, seleccion)].map((n) => n.id))
    return new Set(modelo.vecinos.get(seleccion) ?? [])
  }, [modelo, seleccion, elegido])

  // Las fuerzas se configuran antes de pasarle los datos: así el precalentamiento ya usa los anillos.
  useEffect(() => {
    const g = ref.current
    if (!g) return
    g.d3Force('center', null)
    g.d3Force('charge')?.strength(-35).distanceMax(110)
    // Los anillos mandan y el ángulo sale de las posiciones de partida; solo los patrones se acercan a lo que miran.
    g.d3Force('link')
      ?.distance((l: L) => (l.tipo === 'condicion' ? 40 : 60))
      .strength((l: L) => (l.tipo === 'condicion' ? 0.05 : 0))
    g.d3Force('anillos', fuerzaAnillos())
    g.d3Force('choque', fuerzaChoque())
    setListo(true)
  }, [])

  const ajustar = (ms: number) => ref.current?.zoomToFit(ms, 18)
  useEffect(() => {
    if (listo && centrar > 0) ajustar(reducido ? 0 : 300)
  }, [centrar]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (listo) ajustar(0)
  }, [ancho, alto]) // eslint-disable-line react-hooks/exhaustive-deps

  const atenuado = (id: string) => seleccion !== null && id !== seleccion && !cerca.has(id)

  function dibujarNodo(n: N, ctx: CanvasRenderingContext2D, k: number) {
    if (n.x === undefined || n.y === undefined) return
    const r = radio(n)
    ctx.globalAlpha = atenuado(n.id) ? 0.25 : 1
    ctx.lineWidth = 1.5 / k
    if (n.clase === 'patron') {
      const lado = r * 2
      ctx.beginPath()
      ctx.roundRect(n.x - r, n.y - r, lado, lado, r * 0.45)
      ctx.fillStyle = paleta.superficie
      ctx.fill()
      ctx.strokeStyle = n.resultado === 'rechaza' ? paleta.todaviaNo : paleta.bordeProceso
      ctx.lineWidth = 1.75 / k
      ctx.stroke()
    } else {
      ctx.beginPath()
      ctx.arc(n.x, n.y, r, 0, 2 * Math.PI)
      if (n.clase === 'atributo') {
        ctx.fillStyle = paleta.superficie
        ctx.fill()
        ctx.strokeStyle = paleta.suave
        ctx.lineWidth = 1.1 / k
        ctx.stroke()
      } else {
        ctx.fillStyle = n.clase === 'nino' ? paleta.texto : color(paleta, n)
        ctx.fill()
        // Aro: separa del fondo y de las líneas. "En proceso" (Hoja) lleva el verde hondo para que se vea sobre blanco.
        ctx.strokeStyle = n.estado === 'en_proceso' ? paleta.bordeProceso : paleta.superficie
        ctx.stroke()
      }
      if (n.clase === 'nino') {
        ctx.fillStyle = paleta.superficie
        ctx.font = `700 ${r * 1.1}px ${paleta.fuente}`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(n.nombre.slice(0, 1).toUpperCase(), n.x, n.y + r * 0.05)
      }
    }
    if (n.id === seleccion) {
      ctx.globalAlpha = 1
      ctx.beginPath()
      ctx.arc(n.x, n.y, r + 4 / k, 0, 2 * Math.PI)
      ctx.strokeStyle = paleta.marca
      ctx.lineWidth = 2.5 / k
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  }

  function dibujarArista(l: L, ctx: CanvasRenderingContext2D, k: number) {
    const a = l.source as N
    const b = l.target as N
    if (a.x === undefined || a.y === undefined || b.x === undefined || b.y === undefined) return
    const toca = seleccion !== null && (a.id === seleccion || b.id === seleccion ||
      (elegido?.clase === 'patron' && l.tipo === 'tiene' && cerca.has(a.id) && cerca.has(b.id)))
    if (l.tipo === 'patron' && !toca) return // chico → patrón: se ve solo al elegir uno de los dos
    const fuera = seleccion !== null && !toca
    let ancho = 0.7
    let trazo = paleta.borde
    let alfa = 1
    let guiones: number[] = []
    if (l.tipo === 'estado') {
      const prep = b.clase === 'prep' ? b : a
      ancho = 0.8 + 4.2 * l.fuerza
      trazo = prep.estado === 'en_proceso' ? paleta.bordeProceso : color(paleta, prep)
      alfa = prep.estado === 'en_proceso' ? 0.45 : 0.7
    } else if (l.tipo === 'condicion' || l.tipo === 'patron') {
      const p = a.clase === 'patron' ? a : b
      ancho = 0.6 + 1.6 * l.fuerza
      trazo = p.resultado === 'rechaza' ? paleta.todaviaNo : paleta.bordeProceso
      alfa = 0.5
      if (p.investigacion || l.tipo === 'patron') guiones = [3, 3]
    } else if (toca) {
      trazo = paleta.suave
      ancho = 1.1
    }
    ctx.globalAlpha = fuera ? 0.08 : toca ? Math.max(alfa, 0.85) : alfa
    ctx.strokeStyle = trazo
    ctx.lineWidth = ancho / k
    ctx.setLineDash(guiones.map((g) => g / k))
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.globalAlpha = 1
  }

  // Etiquetas al final, con tamaño fijo en pantalla y sin pisarse: se ponen por prioridad, se prueba abajo, arriba,
  // a la derecha y a la izquierda del punto, y si ninguna entra sin tapar otra etiqueta o un punto grande, se saltea.
  function dibujarEtiquetas(ctx: CanvasRenderingContext2D, k: number) {
    type Caja = { x0: number; y0: number; x1: number; y1: number; de?: string }
    const nodos = datos.nodes as N[]
    const choca = (c: Caja, o: Caja) => c.x0 < o.x1 && c.x1 > o.x0 && c.y0 < o.y1 && c.y1 > o.y0
    const puntos: Caja[] = nodos
      .filter((n) => (n.clase === 'nino' || n.clase === 'prep') && n.x !== undefined && n.y !== undefined)
      .map((n) => ({ x0: n.x! - radio(n), y0: n.y! - radio(n), x1: n.x! + radio(n), y1: n.y! + radio(n), de: n.id }))
    const puestas: Caja[] = []
    // Los patrones tienen texto largo: se nombran solo si se eligió el patrón o una característica que usa.
    const nombrarPatrones = elegido?.clase === 'atributo'
    const candidatos = nodos
      .map((n) => ({ n, p: prioridad(n, seleccion, cerca) }))
      .filter((c) => c.n.id === seleccion || (c.n.clase === 'patron' ? nombrarPatrones && cerca.has(c.n.id) : c.p < 99 || cerca.has(c.n.id)))
      .sort((a, b) => a.p - b.p)
    // Lo que se ve del mundo: las etiquetas se corren hacia adentro para no quedar cortadas en el borde.
    const inv = ctx.getTransform().inverse()
    const ini = inv.transformPoint({ x: 0, y: 0 })
    const fin = inv.transformPoint({ x: ctx.canvas.width, y: ctx.canvas.height })
    const adentro = (c: Caja): Caja => {
      const dx = c.x0 < ini.x ? ini.x - c.x0 : c.x1 > fin.x ? fin.x - c.x1 : 0
      const dy = c.y0 < ini.y ? ini.y - c.y0 : c.y1 > fin.y ? fin.y - c.y1 : 0
      return { x0: c.x0 + dx, x1: c.x1 + dx, y0: c.y0 + dy, y1: c.y1 + dy }
    }
    ctx.textBaseline = 'top'
    ctx.lineJoin = 'round'
    for (const { n } of candidatos) {
      if (n.x === undefined || n.y === undefined) continue
      const x = n.x
      const y = n.y
      const px = n.clase === 'nino' ? 13 : n.clase === 'atributo' ? 10.5 : 11.5
      ctx.font = `${n.clase === 'atributo' ? 400 : 700} ${px / k}px ${paleta.fuente}`
      const lineas = n.lineas
      const alto = (px * 1.15) / k
      const w = Math.max(...lineas.map((t) => ctx.measureText(t).width)) + 4 / k
      const h = alto * lineas.length
      const sep = radio(n) + 3 / k
      const opciones: Caja[] = [
        { x0: x - w / 2, y0: y + sep, x1: x + w / 2, y1: y + sep + h },
        { x0: x - w / 2, y0: y - sep - h, x1: x + w / 2, y1: y - sep },
        { x0: x + sep, y0: y - h / 2, x1: x + sep + w, y1: y + h / 2 },
        { x0: x - sep - w, y0: y - h / 2, x1: x - sep, y1: y + h / 2 },
      ].map(adentro)
      const libre = (c: Caja) => !puestas.some((o) => choca(c, o)) && !puntos.some((o) => o.de !== n.id && choca(c, o))
      const caja = opciones.find(libre) ?? (n.id === seleccion || n.clase === 'nino' ? opciones[0] : null)
      if (!caja) continue
      puestas.push(caja)
      ctx.globalAlpha = atenuado(n.id) ? 0.3 : 1
      ctx.textAlign = 'center'
      ctx.lineWidth = 3.5 / k
      ctx.strokeStyle = paleta.superficie
      ctx.fillStyle = n.clase === 'atributo' ? paleta.suave : paleta.texto
      const cx = (caja.x0 + caja.x1) / 2
      lineas.forEach((t, i) => {
        ctx.strokeText(t, cx, caja.y0 + i * alto)
        ctx.fillText(t, cx, caja.y0 + i * alto)
      })
    }
    ctx.globalAlpha = 1
  }

  return (
    <ForceGraph2D<N, L>
      ref={ref}
      graphData={listo ? datos : VACIO}
      width={ancho}
      height={alto}
      backgroundColor={paleta.superficie}
      nodeId="id"
      nodeLabel={() => ''}
      linkLabel={() => ''}
      nodeCanvasObject={dibujarNodo}
      nodePointerAreaPaint={(n, c, ctx, k) => {
        if (n.x === undefined || n.y === undefined) return
        ctx.fillStyle = c
        ctx.beginPath()
        ctx.arc(n.x, n.y, Math.max(radio(n) + 2, 13 / k), 0, 2 * Math.PI)
        ctx.fill()
      }}
      linkCanvasObject={dibujarArista}
      linkCanvasObjectMode={() => 'replace'}
      onRenderFramePost={dibujarEtiquetas}
      warmupTicks={reducido ? 300 : 80}
      cooldownTicks={reducido ? 0 : 120}
      d3VelocityDecay={0.45}
      onEngineStop={() => {
        // Solo la primera vez: si después el padre arrastra un nodo, no le movemos la cámara.
        if (centrado.current) return
        centrado.current = true
        ajustar(reducido ? 0 : 250)
      }}
      onNodeClick={(n) => onSeleccionar(n.id === seleccion ? null : n.id)}
      onBackgroundClick={() => onSeleccionar(null)}
      enableNodeDrag={explorar}
      enableZoomInteraction={explorar}
      enablePanInteraction={explorar}
      minZoom={0.3}
      maxZoom={6}
      autoPauseRedraw
    />
  )
}
