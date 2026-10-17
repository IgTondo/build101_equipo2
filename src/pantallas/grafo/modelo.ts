// Grafo del chico (C13): de la vista que arma B (GET /api/perfil?vista=grafo) a lo que se dibuja y se lista.
// Funciones puras, sin React ni canvas. Hacia el padre nunca se dice "rechaza": el estado es "Todavía no".
import { NOMBRE_GRUPO } from '../../lib/vocabulario'

/** Espejo de GrafoVista (server/grafo/almacen.ts): ese módulo importa el driver, así que no se importa desde el front. */
export interface GrafoVista {
  motor: 'neo4j' | 'mongo'
  nodos: { id: string; tipo: string; nombre: string; props: Record<string, unknown> }[]
  aristas: { desde: string; hasta: string; tipo: string; props: Record<string, unknown> }[]
}

export type Clase = 'nino' | 'prep' | 'atributo' | 'patron'
export type EstadoPrep = 'acepta' | 'en_proceso' | 'todavia_no'

export interface Nodo {
  id: string
  clase: Clase
  /** Para la tarjeta y la lista: completo y ya sin "rechaza". */
  nombre: string
  /** Para el lienzo: una o dos líneas cortas. */
  lineas: string[]
  estado?: EstadoPrep
  puntaje?: number
  veces?: number
  /** Atributo: "textura", "forma"… (o el contexto: "cómo se sirve"). */
  categoria?: string
  /** Patrón: a favor o en contra, y en cuántas comidas se vio (null si viene de la investigación). */
  resultado?: 'acepta' | 'rechaza'
  apoyo?: { n: number; de: number } | null
  investigacion?: boolean
  grado: number
}

export interface Arista {
  id: string
  desde: string
  hasta: string
  tipo: 'estado' | 'tiene' | 'patron' | 'condicion'
  /** 0 a 1: puntaje de aceptación o confianza del patrón. Da el grosor de la línea. */
  fuerza: number
}

export interface Modelo {
  nino: Nodo | null
  nodos: Nodo[]
  aristas: Arista[]
  porId: Map<string, Nodo>
  vecinos: Map<string, Set<string>>
}

export const NOMBRE_ESTADO: Record<EstadoPrep, string> = { acepta: 'Acepta', en_proceso: 'En proceso', todavia_no: 'Todavía no' }

const ESTADO: Record<string, EstadoPrep> = {
  ACEPTA: 'acepta', EN_PROCESO: 'en_proceso', RECHAZA: 'todavia_no', acepta: 'acepta', en_proceso: 'en_proceso', rechaza: 'todavia_no',
}

const CATEGORIA: Record<string, string> = {
  textura: 'textura', forma: 'forma', sabor: 'sabor', temperatura: 'temperatura', coccion: 'cocción', presentacion: 'presentación',
  color: 'color', grupo: 'grupo', distribucion: 'cómo se sirve', plato: 'plato', momento: 'momento', juntoASeguro: 'junto a algo seguro',
}

// Solo los valores que pierden la tilde o se leen raros con el guion bajo.
const VALOR: Record<string, string> = {
  baston: 'bastón', pure: 'puré', frio: 'frío', marron: 'marrón', listo: 'listo para comer', tocandose: 'se tocan',
  con_salsa: 'con salsa',
}

const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : typeof x === 'string' && x.trim() !== '' && Number.isFinite(Number(x)) ? Number(x) : undefined)
const entre01 = (x: number) => Math.max(0, Math.min(1, x))

/** "Lo hervido lo rechaza (8 de 8)" → "Lo hervido todavía no lo acepta (8 de 8)". */
export function suavizar(texto: string): string {
  return texto
    .replace(/\b(lo|la|los|las) rechaza\b/gi, (_, pron: string) => `todavía no ${pron.toLowerCase()} acepta`)
    .replace(/\bsuelen rechazarse\b/gi, 'suelen costar')
    .replace(/\brechaza\w*\b/gi, 'todavía no acepta')
}

/** El "(26 de 31)" del final del texto del patrón; null si no está (los de la investigación). */
export function leerApoyo(texto: string): { n: number; de: number } | null {
  const m = /\((\d+) de (\d+)\)\s*$/.exec(texto)
  if (!m) return null
  const n = Number(m[1])
  const de = Number(m[2])
  return de > 0 && n <= de ? { n, de } : null
}

const sinParentesisFinal = (texto: string) => texto.replace(/\s*\([^)]*\)\s*$/, '').trim()

/** Parte el nombre en hasta `maxLineas` líneas de unos `ancho` caracteres; corta con "…" si no entra. */
export function lineasCortas(texto: string, ancho = 14, maxLineas = 2): string[] {
  const limpio = texto.replace(/\s*\(.*$/, '').replace(/,.*$/, '').trim() || texto.trim()
  const palabras = limpio.split(/\s+/)
  const lineas: string[] = []
  let actual = ''
  for (const p of palabras) {
    const prueba = actual ? `${actual} ${p}` : p
    if (prueba.length <= ancho || !actual) actual = prueba
    else {
      lineas.push(actual)
      actual = p
    }
  }
  if (actual) lineas.push(actual)
  if (lineas.length <= maxLineas) return lineas
  const corte = lineas.slice(0, maxLineas)
  corte[maxLineas - 1] = `${corte[maxLineas - 1].replace(/[\s,.;:]+$/, '')}…`
  return corte
}

function valorLegible(clave: string, valor: string): string {
  if (clave === 'grupo' && valor in NOMBRE_GRUPO) return NOMBRE_GRUPO[valor as keyof typeof NOMBRE_GRUPO].toLowerCase()
  return VALOR[valor] ?? valor.replace(/_/g, ' ')
}

/** "atr:textura:crocante" (o el nombre "textura=crocante") → { clave: 'textura', valor: 'crocante' }. */
function partirAtributo(id: string, nombre: string): { clave: string; valor: string } {
  const crudo = id.startsWith('atr:') ? id.slice(4) : nombre
  const i = crudo.search(/[:=]/)
  return i < 0 ? { clave: '', valor: crudo } : { clave: crudo.slice(0, i), valor: crudo.slice(i + 1) }
}

const CLASE: Record<string, Clase> = { Nino: 'nino', Preparacion: 'prep', Atributo: 'atributo', Patron: 'patron' }

export function esGrafoVista(x: unknown): x is GrafoVista {
  const g = x as GrafoVista | null
  return Boolean(g && Array.isArray(g.nodos) && Array.isArray(g.aristas))
}

export function armarModelo(vista: GrafoVista): Modelo {
  const porId = new Map<string, Nodo>()
  for (const n of vista.nodos) {
    const clase = CLASE[n.tipo]
    if (!clase || porId.has(n.id)) continue
    const nombre = String(n.nombre ?? n.id)
    if (clase === 'prep') {
      const estado = ESTADO[String(n.props.estado ?? '')] ?? 'en_proceso'
      porId.set(n.id, {
        id: n.id, clase, nombre, lineas: lineasCortas(nombre), estado, grado: 0,
        puntaje: num(n.props.puntaje), veces: num(n.props.veces),
      })
    } else if (clase === 'atributo') {
      const { clave, valor } = partirAtributo(n.id, nombre)
      const legible = valorLegible(clave, valor)
      porId.set(n.id, { id: n.id, clase, nombre: legible, lineas: [legible], categoria: CATEGORIA[clave] ?? clave, grado: 0 })
    } else if (clase === 'patron') {
      const texto = suavizar(nombre)
      const apoyo = leerApoyo(nombre)
      const resultado = n.props.resultado === 'rechaza' ? 'rechaza' : 'acepta'
      porId.set(n.id, {
        id: n.id, clase, nombre: sinParentesisFinal(texto), lineas: lineasCortas(sinParentesisFinal(texto), 18, 2),
        resultado, apoyo, investigacion: !apoyo && /investigaci/i.test(nombre), grado: 0,
      })
    } else {
      porId.set(n.id, { id: n.id, clase, nombre, lineas: [nombre], grado: 0 })
    }
  }

  const aristas: Arista[] = []
  const vecinos = new Map<string, Set<string>>([...porId.keys()].map((id) => [id, new Set<string>()]))
  const vistas = new Set<string>()
  for (const a of vista.aristas) {
    const de = porId.get(a.desde)
    const a2 = porId.get(a.hasta)
    if (!de || !a2 || de.id === a2.id) continue
    const id = `${a.desde}>${a.hasta}`
    if (vistas.has(id)) continue
    vistas.add(id)
    let tipo: Arista['tipo']
    let fuerza: number
    if (a.tipo === 'TIENE') {
      tipo = 'tiene'
      fuerza = 0.15
    } else if (a.tipo === 'TIENE_PATRON' || a.tipo === 'CONDICION') {
      const p = de.clase === 'patron' ? de : a2
      tipo = a.tipo === 'CONDICION' ? 'condicion' : 'patron'
      fuerza = p.apoyo ? p.apoyo.n / p.apoyo.de : 0.35
    } else if (a2.clase === 'prep') {
      tipo = 'estado'
      fuerza = entre01(num(a.props.puntaje) ?? a2.puntaje ?? 0.5)
    } else continue
    aristas.push({ id, desde: a.desde, hasta: a.hasta, tipo, fuerza })
    vecinos.get(a.desde)!.add(a.hasta)
    vecinos.get(a.hasta)!.add(a.desde)
  }
  for (const n of porId.values()) n.grado = vecinos.get(n.id)!.size

  const nodos = [...porId.values()]
  return { nino: nodos.find((n) => n.clase === 'nino') ?? null, nodos, aristas, porId, vecinos }
}

/** Lo que se cuenta del chico: cuántas preparaciones por estado y cuántos patrones. */
export function contar(m: Modelo) {
  const preps = m.nodos.filter((n) => n.clase === 'prep')
  return {
    acepta: preps.filter((n) => n.estado === 'acepta').length,
    enProceso: preps.filter((n) => n.estado === 'en_proceso').length,
    todaviaNo: preps.filter((n) => n.estado === 'todavia_no').length,
    preparaciones: preps.length,
    patrones: m.nodos.filter((n) => n.clase === 'patron').length,
    atributos: m.nodos.filter((n) => n.clase === 'atributo').length,
  }
}

const ORDEN_ESTADO: Record<EstadoPrep, number> = { acepta: 0, en_proceso: 1, todavia_no: 2 }

/** Preparaciones por estado y, dentro, por puntaje (o veces). */
export function ordenarPreps(lista: Nodo[]): Nodo[] {
  return [...lista].sort(
    (a, b) => ORDEN_ESTADO[a.estado ?? 'en_proceso'] - ORDEN_ESTADO[b.estado ?? 'en_proceso'] || (b.puntaje ?? 0) - (a.puntaje ?? 0) || (b.veces ?? 0) - (a.veces ?? 0),
  )
}

const vecinosDe = (m: Modelo, id: string, clase: Clase) =>
  [...(m.vecinos.get(id) ?? [])].map((v) => m.porId.get(v)!).filter((n) => n.clase === clase)

export const atributosDe = (m: Modelo, id: string) => vecinosDe(m, id, 'atributo')
export const prepsDe = (m: Modelo, id: string) => ordenarPreps(vecinosDe(m, id, 'prep'))

/** Los patrones cuyas condiciones cumple la preparación (el "por qué" de su estado). */
export function patronesDePrep(m: Modelo, prepId: string): Nodo[] {
  const propios = new Set(atributosDe(m, prepId).map((a) => a.id))
  return m.nodos
    .filter((p) => p.clase === 'patron')
    .filter((p) => {
      const cond = atributosDe(m, p.id)
      return cond.length > 0 && cond.every((c) => propios.has(c.id))
    })
    .sort((a, b) => confianza(b) - confianza(a))
}

/** Las preparaciones del chico que cumplen todas las condiciones del patrón. */
export function prepsDePatron(m: Modelo, patronId: string): Nodo[] {
  const cond = atributosDe(m, patronId)
  if (!cond.length) return []
  const conTodas = cond.map((c) => new Set(prepsDe(m, c.id).map((p) => p.id)))
  return ordenarPreps(m.nodos.filter((n) => n.clase === 'prep' && conTodas.every((s) => s.has(n.id))))
}

export const confianza = (p: Nodo) => (p.apoyo ? p.apoyo.n / p.apoyo.de : 0)

/**
 * Posiciones de partida en anillos (lo que acepta, más cerca del chico; después lo que está en proceso, las
 * características y los patrones). Así el dibujo sale igual cada vez y la simulación solo acomoda.
 */
export const RADIO: Record<EstadoPrep | 'atributo' | 'patron', number> = {
  acepta: 64, en_proceso: 118, todavia_no: 142, atributo: 172, patron: 215,
}
/** Los anillos son elipses: alto = ancho × ALARGADO (el celular está parado). */
export const ALARGADO = 1.3

export function radioDe(n: Nodo): number {
  if (n.clase === 'nino') return 0
  if (n.clase === 'prep') return RADIO[n.estado ?? 'en_proceso']
  return RADIO[n.clase === 'atributo' ? 'atributo' : 'patron']
}

export function posicionesIniciales(m: Modelo): Map<string, { x: number; y: number }> {
  const pos = new Map<string, { x: number; y: number }>()
  const angulo = new Map<string, number>()
  // Cada anillo de preparaciones da la vuelta entera, corrido un poco del anterior para que no queden en fila.
  const preps = ordenarPreps(m.nodos.filter((n) => n.clase === 'prep'))
  ;(['acepta', 'en_proceso', 'todavia_no'] as const).forEach((estado, anillo) => {
    const lista = preps.filter((p) => p.estado === estado)
    lista.forEach((p, i) => angulo.set(p.id, -Math.PI / 2 + anillo * 0.45 + (2 * Math.PI * i) / lista.length))
  })
  // Cada característica y cada patrón, en el ángulo medio de lo que tocan (promedio de vectores, para no cruzar el 0).
  const medio = (ids: string[], si: number) => {
    let x = 0
    let y = 0
    for (const id of ids) {
      const a = angulo.get(id)
      if (a !== undefined) { x += Math.cos(a); y += Math.sin(a) }
    }
    return x === 0 && y === 0 ? si : Math.atan2(y, x)
  }
  const resto = (clase: Clase) => m.nodos.filter((n) => n.clase === clase)
  resto('atributo').forEach((a, i, todos) => angulo.set(a.id, medio(prepsDe(m, a.id).map((p) => p.id), (2 * Math.PI * i) / todos.length)))
  resto('patron').forEach((p, i, todos) => angulo.set(p.id, medio(atributosDe(m, p.id).map((a) => a.id), (2 * Math.PI * i) / todos.length)))
  for (const n of m.nodos) {
    const r = radioDe(n)
    const a = angulo.get(n.id) ?? 0
    pos.set(n.id, { x: r * Math.cos(a), y: r * Math.sin(a) * ALARGADO })
  }
  return pos
}
