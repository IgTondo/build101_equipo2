// "Tus hijos" en este celular: la lista de chicos que el padre abrió acá, para cambiar de uno a otro sin saberse el
// ?nino=. Vive solo en localStorage (`nibble:ninos`), sin cuentas: no hay un endpoint que liste todos los chicos (sin
// login sería mostrarle a cualquiera los hijos de otros). Cada entrada es { id, nombre, agregadoISO }; el nombre se
// guarda cuando el perfil carga (puede faltar si el chico llegó por ?nino= y todavía no se abrió).
// Un chico entra a la lista al crearlo en el alta por voz o al abrirlo con ?nino= (App se asegura de que el activo
// esté). Quitarlo ("Quitar de este celular") no borra nada del servidor.
// La lógica es pura (se prueba con un storage de mentira, vitest corre sin localStorage); abajo, el store que usan
// las pantallas, con try/catch en cada acceso como el resto de los helpers de storage.
import { useSyncExternalStore } from 'react'
import { useNavigate } from 'react-router-dom'
import { olvidarNino, RUTA_ALTA, useNino } from './nino'

export interface ChicoGuardado {
  id: string
  /** null mientras no se cargó su perfil en este celular. */
  nombre: string | null
  agregadoISO: string
}

/** Lo que se usa de localStorage: así los tests pasan un objeto cualquiera. */
export interface Almacen {
  getItem(clave: string): string | null
  setItem(clave: string, valor: string): void
}

export const CLAVE_LISTA = 'nibble:ninos'
/** El chico activo (la misma clave que src/lib/nino.ts): de acá sale la migración. */
export const CLAVE_ACTIVO = 'nibble:nino'

function valido(x: unknown): x is ChicoGuardado {
  if (!x || typeof x !== 'object') return false
  const c = x as Record<string, unknown>
  return typeof c.id === 'string' && c.id.length > 0
    && (c.nombre === null || typeof c.nombre === 'string')
    && typeof c.agregadoISO === 'string'
}

/**
 * La lista guardada. Si no hay lista pero sí un chico activo (los celulares de antes de la lista), arranca con él.
 * Un JSON roto o entradas raras no tiran: se descartan.
 */
export function leerLista(almacen: Almacen, ahoraISO = new Date().toISOString()): ChicoGuardado[] {
  const crudo = almacen.getItem(CLAVE_LISTA)
  if (crudo === null) {
    const activo = almacen.getItem(CLAVE_ACTIVO)
    return activo ? [{ id: activo, nombre: null, agregadoISO: ahoraISO }] : []
  }
  let json: unknown
  try { json = JSON.parse(crudo) } catch { return [] }
  if (!Array.isArray(json)) return []
  const vistos = new Set<string>()
  return json.filter((c): c is ChicoGuardado => {
    if (!valido(c) || vistos.has(c.id)) return false
    vistos.add(c.id)
    return true
  }).map(({ id, nombre, agregadoISO }) => ({ id, nombre: nombre?.trim() || null, agregadoISO }))
}

/** Suma un chico al final (o le pone el nombre si ya estaba). Devuelve la misma lista si no cambia nada. */
export function agregar(lista: ChicoGuardado[], id: string, nombre: string | null = null, ahoraISO = new Date().toISOString()): ChicoGuardado[] {
  const limpio = nombre?.trim() || null
  const i = lista.findIndex((c) => c.id === id)
  if (i === -1) return [...lista, { id, nombre: limpio, agregadoISO: ahoraISO }]
  if (!limpio || lista[i].nombre === limpio) return lista
  return lista.map((c, j) => (j === i ? { ...c, nombre: limpio } : c))
}

export function quitar(lista: ChicoGuardado[], id: string): ChicoGuardado[] {
  return lista.some((c) => c.id === id) ? lista.filter((c) => c.id !== id) : lista
}

/** A quién pasar después de quitar al activo: el primero que queda, o null (entonces, al alta por voz). */
export function siguienteActivo(lista: ChicoGuardado[], quitado: string): string | null {
  return lista.find((c) => c.id !== quitado)?.id ?? null
}

/**
 * Adónde ir al cambiar de chico. El inicio, la semana y el perfil se quedan en la misma pantalla con el otro chico;
 * registrar, la receta y el resumen vuelven al inicio: sus parámetros (?momento=, ?preparacionId=…) son del anterior.
 */
export function rutaAlCambiar(pathname: string, ninoId: string): string {
  const quedarse = pathname === '/tablero' || pathname === '/perfil'
  return `${quedarse ? pathname : '/'}?${new URLSearchParams({ nino: ninoId })}`
}

// ---- El store de la app (localStorage del navegador) ----

const oyentes = new Set<() => void>()
let cache: ChicoGuardado[] | null = null
const SIN_HIJOS: ChicoGuardado[] = []

function almacen(): Almacen | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage } catch { return null }
}

function actual(): ChicoGuardado[] {
  if (cache) return cache
  const a = almacen()
  try { cache = a ? leerLista(a) : [] } catch { cache = [] }
  return cache
}

function escribir(lista: ChicoGuardado[]): void {
  if (lista === actual()) return
  cache = lista
  try { almacen()?.setItem(CLAVE_LISTA, JSON.stringify(lista)) } catch { /* sin storage: queda en memoria */ }
  oyentes.forEach((f) => f())
}

function suscribir(f: () => void): () => void {
  oyentes.add(f)
  // Otra pestaña cambió la lista: se relee.
  const alCambiar = (e: StorageEvent) => { if (e.key === CLAVE_LISTA) { cache = null; f() } }
  window.addEventListener('storage', alCambiar)
  return () => { oyentes.delete(f); window.removeEventListener('storage', alCambiar) }
}

/** Los chicos guardados en este celular, en el orden en que se agregaron. */
export function useMisHijos(): ChicoGuardado[] {
  return useSyncExternalStore(suscribir, actual, () => SIN_HIJOS)
}

/** Se asegura de que el chico esté en la lista; con nombre, lo guarda o lo actualiza. */
export function recordarHijo(id: string, nombre: string | null = null): void {
  escribir(agregar(actual(), id, nombre))
}

/** "Quitar de este celular": sale de la lista. Sus datos siguen en el servidor. */
export function quitarHijo(id: string): void {
  escribir(quitar(actual(), id))
}

/**
 * Quitar un chico de este celular y seguir: si era el activo, se pasa al primero que queda (a su inicio) o, si no
 * queda ninguno, al alta por voz. Si no era el activo, solo sale de la lista.
 */
export function useQuitarHijo(): (id: string) => void {
  const navegar = useNavigate()
  const activo = useNino()
  return (id) => {
    const siguiente = siguienteActivo(actual(), id)
    quitarHijo(id)
    if (id !== activo) return
    if (siguiente) {
      navegar(rutaAlCambiar('/', siguiente), { replace: true })
    } else {
      olvidarNino()
      navegar(RUTA_ALTA, { replace: true })
    }
  }
}
