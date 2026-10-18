// v5.6 · La receta creativa y su foto, pedidas por adelantado (unos 3 s la receta y 15 s la foto). El inicio precarga la
// de la próxima comida y la receta precarga la siguiente para "Otra opción": cuando el padre toca, ya está (o ya viene).
// Vive en memoria: una por chico y comida, se usa una sola vez y se pierde al recargar la página. Las fotos se guardan
// por receta: ImagenPlato las pide por acá, así la precargada no se vuelve a pedir (ni dos veces con StrictMode).
// v5.7 · La tarjeta de la próxima comida muestra la precargada (la comida completa): useRecetaPrevia() la pide si no hay
// una esperando y se vuelve a dibujar cuando llega. Lo que muestra es lo que abre "Ver la receta" (la misma promesa).
import { useCallback, useEffect, useSyncExternalStore } from 'react'
import type { ImagenPlatoRes, Momento, Receta, Regla } from '../../shared/contratos'
import { api, type ErrorDeApi } from './api'
import { leerRecetasDeLaComida, ultimosSinRepetir } from './proximaComida'
import { aErrorDeApi } from './useApi'

export type EstadoPrevia =
  | { tipo: 'cargando' }
  | { tipo: 'ok'; receta: Receta }
  | { tipo: 'error'; error: ErrorDeApi }

interface Previa { promesa: Promise<Receta>; usada: boolean; estado: EstadoPrevia }
const recetas = new Map<string, Previa>()
const imagenes = new Map<string, Promise<ImagenPlatoRes>>()
// Para mostrar: la última que llegó (sigue a la vista después de usada) y el último error, por chico y comida.
const ultimas = new Map<string, EstadoPrevia>()
const errores = new Map<string, EstadoPrevia>()
const oyentes = new Map<string, Set<() => void>>()
const CARGANDO: EstadoPrevia = { tipo: 'cargando' }

const avisar = (k: string) => oyentes.get(k)?.forEach((f) => f())

// v5.9 · Dos ranuras por chico y comida: '' la de la tarjeta de la próxima comida, 'otra' la de "Otra opción" en la receta
// (así volver de la receta no cambia el plato de la tarjeta).
export type Ranura = '' | 'otra'
const claveReceta = (ninoId: string, momento: Momento, ranura: Ranura = '') => `${ninoId}:${momento}${ranura ? `:${ranura}` : ''}`
const claveImagen = (receta: Receta, reglas: readonly Regla[]) => `${receta.preparacionBaseId}|${receta.nombre}|${JSON.stringify(reglas)}`

/** La foto de una receta: la misma promesa para el mismo plato. Si falla, se olvida (así "Probar de nuevo" la vuelve a pedir). */
export function imagenDe(receta: Receta, reglas: Regla[]): Promise<ImagenPlatoRes> {
  const k = claveImagen(receta, reglas)
  const ya = imagenes.get(k)
  if (ya) return ya
  const promesa = api.imagenPlato({ receta, reglas })
  promesa.catch(() => imagenes.delete(k))
  imagenes.set(k, promesa)
  return promesa
}

/**
 * Pide por adelantado una receta creativa para esa comida (y su foto, cuando llegan las reglas), sin repetir las que ya
 * vio. Si ya hay una esperando sin usar, no hace nada. Los errores no se muestran: al tocar, se pide de nuevo.
 */
export function precargarReceta(ninoId: string, momento: Momento, reglas: Regla[], ranura: Ranura = ''): void {
  const k = claveReceta(ninoId, momento, ranura)
  if (recetas.get(k)?.usada === false) return
  const anteriores = ultimosSinRepetir(leerRecetasDeLaComida(ninoId, momento))
  const promesa = api.receta({ ninoId, momento, ...(anteriores.length ? { anteriores } : {}) })
  const previa: Previa = { promesa, usada: false, estado: CARGANDO }
  recetas.set(k, previa)
  errores.delete(k)
  avisar(k)
  promesa
    .then((receta) => {
      previa.estado = { tipo: 'ok', receta }
      if (recetas.get(k) === previa) { ultimas.set(k, previa.estado); avisar(k) }
      void imagenDe(receta, reglas).catch(() => {})
    })
    .catch((e: unknown) => {
      if (recetas.get(k) !== previa) return
      recetas.delete(k)
      errores.set(k, { tipo: 'error', error: aErrorDeApi(e) })
      avisar(k)
    })
}

/** La precargada para esa comida, si hay una sin usar. Se marca usada con usarRecetaPrevia() cuando se muestra. */
export function recetaPrevia(ninoId: string, momento: Momento, ranura: Ranura = ''): Promise<Receta> | null {
  const p = recetas.get(claveReceta(ninoId, momento, ranura))
  return p && !p.usada ? p.promesa : null
}

export function usarRecetaPrevia(ninoId: string, momento: Momento, promesa: Promise<Receta>, ranura: Ranura = ''): void {
  const k = claveReceta(ninoId, momento, ranura)
  const p = recetas.get(k)
  if (p?.promesa === promesa) { p.usada = true; avisar(k) }
}

/** Qué hay para mostrar de esa comida: la que espera sin usar; si no, la última que llegó; si no, el último error. */
export function estadoRecetaPrevia(ninoId: string, momento: Momento): EstadoPrevia {
  const k = claveReceta(ninoId, momento)
  const p = recetas.get(k)
  if (p && !p.usada) return p.estado
  return ultimas.get(k) ?? errores.get(k) ?? CARGANDO
}

/**
 * La receta creativa precargada de esa comida, para mostrarla: al montar (o al cambiar de chico o de comida) la pide si
 * no hay una esperando sin usar. Sin reglas todavía (el perfil no llegó), no pide nada: muestra lo que ya haya (o
 * 'cargando'). `reintentar` la pide de nuevo (después de un error).
 */
export function useRecetaPrevia(ninoId: string, momento: Momento, reglas: Regla[] | null): EstadoPrevia & { reintentar: () => void } {
  const k = claveReceta(ninoId, momento)
  const suscribir = useCallback((f: () => void) => {
    const set = oyentes.get(k) ?? new Set()
    set.add(f)
    oyentes.set(k, set)
    return () => { set.delete(f) }
  }, [k])
  const estado = useSyncExternalStore(suscribir, () => estadoRecetaPrevia(ninoId, momento))
  // La tarjeta sigue mostrando la que ya mostró (y abre esa): no pide otra por volver a la pantalla
  useEffect(() => {
    if (reglas && !ultimas.has(k)) precargarReceta(ninoId, momento, reglas)
  }, [ninoId, momento, reglas, k])
  const reintentar = useCallback(() => { if (reglas) precargarReceta(ninoId, momento, reglas) }, [ninoId, momento, reglas])
  return { ...estado, reintentar }
}
