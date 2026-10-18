// v5.6 · La receta creativa y su foto, pedidas por adelantado (unos 3 s la receta y 15 s la foto). El inicio precarga la
// de la próxima comida y la receta precarga la siguiente para "Otra opción": cuando el padre toca, ya está (o ya viene).
// Vive en memoria: una por chico y comida, se usa una sola vez y se pierde al recargar la página. Las fotos se guardan
// por receta: ImagenPlato las pide por acá, así la precargada no se vuelve a pedir (ni dos veces con StrictMode).
import type { ImagenPlatoRes, Momento, Receta, Regla } from '../../shared/contratos'
import { api } from './api'
import { leerRecetasDeLaComida, ultimosSinRepetir } from './proximaComida'

interface Previa { promesa: Promise<Receta>; usada: boolean }
const recetas = new Map<string, Previa>()
const imagenes = new Map<string, Promise<ImagenPlatoRes>>()

const claveReceta = (ninoId: string, momento: Momento) => `${ninoId}:${momento}`
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
export function precargarReceta(ninoId: string, momento: Momento, reglas: Regla[]): void {
  const k = claveReceta(ninoId, momento)
  if (recetas.get(k)?.usada === false) return
  const anteriores = ultimosSinRepetir(leerRecetasDeLaComida(ninoId, momento))
  const promesa = api.receta({ ninoId, momento, ...(anteriores.length ? { anteriores } : {}) })
  const previa: Previa = { promesa, usada: false }
  recetas.set(k, previa)
  promesa
    .then((r) => { void imagenDe(r, reglas).catch(() => {}) })
    .catch(() => { if (recetas.get(k) === previa) recetas.delete(k) })
}

/** La precargada para esa comida, si hay una sin usar. Se marca usada con usarRecetaPrevia() cuando se muestra. */
export function recetaPrevia(ninoId: string, momento: Momento): Promise<Receta> | null {
  const p = recetas.get(claveReceta(ninoId, momento))
  return p && !p.usada ? p.promesa : null
}

export function usarRecetaPrevia(ninoId: string, momento: Momento, promesa: Promise<Receta>): void {
  const p = recetas.get(claveReceta(ninoId, momento))
  if (p?.promesa === promesa) p.usada = true
}
