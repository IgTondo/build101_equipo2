// v5.10 · Métricas de la eval de variedad (scripts/eval-variedad.ts): cuánto cambian las recetas creativas cuando la
// familia pide una tras otra para la misma comida. Funciones puras: no leen archivos ni llaman a la IA; el script les
// pasa, por cada receta pedida, la que salió (o por qué no), el foco que sorteó el código, el uso que reportó la API y
// la latencia.
import type { Momento } from '../../shared/contratos.js'
import { principal } from '../../server/aprendizaje/cadena.js'
import { slug } from '../../server/aprendizaje/textos.js'
import { media, percentil, type Conteo } from './metricas.js'

// Claude Sonnet 5.5: USD 2 por millón de tokens de entrada y 10 por millón de salida (el razonamiento cuenta como salida)
export const USD_MILLON_ENTRADA = 2
export const USD_MILLON_SALIDA = 10
// Sin el uso de la API: una receta (una llamada de ~5 k tokens de entrada y ~3 k de salida, a veces un reintento) ≈ USD 0,04
export const USD_POR_RECETA_ESTIMADO = 0.04
export const MAX_ANTERIORES = 10 // como src/lib/proximaComida.ts

export const FALLAS = ['sin_candidatos', 'timeout', 'error'] as const
export type Falla = (typeof FALLAS)[number]

export interface Uso { entrada: number; salida: number } // tokens

/** El foco que sorteó el código (Foco de server/grafo/conocimiento.ts; `ingrediente` desde v5.10). */
export interface FocoVisto { desdeId: string; modo: string; nutriente?: string; grupo?: string; ingrediente?: string }

export interface RecetaVista {
  nombre: string
  desde: { id: string; nombre: string; ingredientes: string[] } // los alimentoIds del alimento de partida
  cambio: string
  objetivo: string // el nutriente ("calcio") o la variedad ("variedad: verdura")
  ingredientes: { alimentoId: string; gramos: number }[]
}

export interface PedidoVariedad {
  momento: Momento
  ms: number | null    // null: falló por un error (no entra en la latencia)
  llamadas: number     // salidas del LLM que llegaron a validarse (alIntentar)
  uso: Uso | null      // los tokens que reportó la API en este pedido; null si no se pudo saber
  foco?: FocoVisto
  receta?: RecetaVista // si salió
  falla?: Falla        // si no
  error?: string
}

/** El primer tramo del id: queso_muzzarella → queso, carne_vacuna → carne. */
export const familia = (alimentoId: string): string => alimentoId.split('_')[0] || alimentoId

/** Los quesos del catálogo (queso_*) y la ricota. */
export const esQueso = (alimentoId: string): boolean => familia(alimentoId) === 'queso' || alimentoId === 'ricota'

export const principalDe = (r: RecetaVista): string | null => principal(r.ingredientes)

/** Los ingredientes de la receta que no están en su alimento de partida, sin repetir. */
export function nuevosDe(r: RecetaVista): string[] {
  const deSuPlato = new Set(r.desde.ingredientes)
  return [...new Set(r.ingredientes.map((i) => i.alimentoId))].filter((id) => !deSuPlato.has(id))
}

/**
 * ¿La receta hizo lo que pidió el foco? Partió del alimento sorteado y, si el foco trae un ingrediente, lo usó: como
 * principal (el de más gramos) al cambiar el principal, entre los ingredientes al sumar uno. null si no hubo foco.
 */
export function sigueElFoco(r: RecetaVista, foco: FocoVisto | undefined): boolean | null {
  if (!foco?.desdeId) return null
  if (r.desde.id !== foco.desdeId) return false
  if (!foco.ingrediente) return true
  return foco.modo === 'cambiar_principal' ? principalDe(r) === foco.ingrediente : r.ingredientes.some((i) => i.alimentoId === foco.ingrediente)
}

/** Lo que guarda la app después de mostrar una receta (anotarRecetaDeLaComida): sin repetir, la más nueva al final. */
export function anotar(anteriores: readonly string[], nombre: string, max = MAX_ANTERIORES): string[] {
  return [...anteriores.filter((n) => n !== nombre), nombre].slice(-max)
}

export const costoUsd = (u: Uso): number => (u.entrada * USD_MILLON_ENTRADA + u.salida * USD_MILLON_SALIDA) / 1_000_000

/** Con el uso que reportó la API; si llamó al LLM y no se sabe el uso, la estimación por receta. */
export function costoPedido(p: Pick<PedidoVariedad, 'uso' | 'llamadas'>): { usd: number; estimado: boolean } {
  if (p.uso) return { usd: costoUsd(p.uso), estimado: false }
  return p.llamadas > 0 ? { usd: USD_POR_RECETA_ESTIMADO, estimado: true } : { usd: 0, estimado: false }
}

/** Cuántas veces sale cada valor, de más a menos (a igualdad, en el orden en que aparecieron). */
export function frecuencias(xs: readonly string[]): { valor: string; veces: number }[] {
  const n = new Map<string, number>()
  for (const x of xs) n.set(x, (n.get(x) ?? 0) + 1)
  return [...n].map(([valor, veces]) => ({ valor, veces })).sort((a, b) => b.veces - a.veces)
}

/** "pollo ×3, avena, queso_muzzarella ×2" → para leer de un vistazo qué se repite. */
export function conVeces(xs: readonly string[]): string {
  return frecuencias(xs).map((f) => (f.veces > 1 ? `${f.valor} ×${f.veces}` : f.valor)).join(', ') || '—'
}

/** Los nombres que salieron más de una vez, comparados como los compara la validación (sin tildes ni mayúsculas). */
export function repetidos(nombres: readonly string[]): { nombre: string; veces: number }[] {
  const grupos = new Map<string, string[]>()
  for (const nombre of nombres) {
    const k = slug(nombre)
    grupos.set(k, [...(grupos.get(k) ?? []), nombre])
  }
  return [...grupos.values()].filter((g) => g.length > 1).map((g) => ({ nombre: g[0]!, veces: g.length }))
}

export interface ResumenVariedad {
  pedidos: number
  recetas: number
  principales: string[] // distintos, en el orden en que aparecieron
  familias: string[]
  partidas: string[]    // alimentos de partida distintos
  conQueso: Conteo      // de las recetas que salieron
  repetidos: { nombre: string; veces: number }[]
  siguenFoco: Conteo    // de las recetas con foco
  fallas: Record<Falla, number>
  latencia: { media: number | null; p95: number | null }
  tokens: Uso
  costo: { usd: number; estimado: boolean } // estimado: algún pedido llamó al LLM y no trae su uso
}

const distintos = (xs: (string | null)[]): string[] => [...new Set(xs.filter((x): x is string => x !== null))]

export function resumirVariedad(pedidos: readonly PedidoVariedad[]): ResumenVariedad {
  const salieron = pedidos.flatMap((p) => (p.receta ? [{ r: p.receta, foco: p.foco }] : []))
  const principales = distintos(salieron.map((x) => principalDe(x.r)))
  const focos = salieron.map((x) => sigueElFoco(x.r, x.foco)).filter((x) => x !== null)
  const ms = pedidos.flatMap((p) => (p.ms === null ? [] : [p.ms]))
  const costos = pedidos.map(costoPedido)
  return {
    pedidos: pedidos.length,
    recetas: salieron.length,
    principales,
    familias: distintos(principales.map(familia)),
    partidas: distintos(salieron.map((x) => x.r.desde.id)),
    conQueso: { ok: salieron.filter((x) => x.r.ingredientes.some((i) => esQueso(i.alimentoId))).length, total: salieron.length },
    repetidos: repetidos(salieron.map((x) => x.r.nombre)),
    siguenFoco: { ok: focos.filter(Boolean).length, total: focos.length },
    fallas: Object.fromEntries(FALLAS.map((f) => [f, pedidos.filter((p) => p.falla === f).length])) as Record<Falla, number>,
    latencia: { media: media(ms), p95: percentil(ms, 95) },
    tokens: pedidos.reduce((t, p) => ({ entrada: t.entrada + (p.uso?.entrada ?? 0), salida: t.salida + (p.uso?.salida ?? 0) }), { entrada: 0, salida: 0 }),
    costo: { usd: costos.reduce((s, c) => s + c.usd, 0), estimado: costos.some((c) => c.estimado) },
  }
}

/** La frase para leer el resultado de un vistazo. */
export function fraseVariedad(r: ResumenVariedad): string {
  if (r.recetas === 0) return r.pedidos === 1 ? 'No salió la receta pedida.' : `No salió ninguna de las ${r.pedidos} recetas pedidas.`
  const queso = r.conQueso.ok === 0 ? 'ninguna lleva queso' : `${r.conQueso.ok} de ${r.recetas} llevan queso`
  const rep = r.repetidos.length ? `; ${r.repetidos.length === 1 ? 'un nombre se repite' : `${r.repetidos.length} nombres se repiten`}` : ''
  return `De ${r.recetas} recetas, ${r.principales.length} ingredientes principales distintos (${r.familias.length} familias) ` +
    `y ${r.partidas.length} alimentos de partida distintos; ${queso}${rep}.`
}
