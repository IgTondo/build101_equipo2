// Foto del plato (C2): todo pasa por canvas → JPEG. Eso resuelve HEIC y la orientación del iPhone (§13)
// y deja la foto en 1024 px, que es lo que necesita la visión (y entra holgada en los 4,5 MB de Vercel).

export const LADO_MAX = 1024
export const LADO_MINI = 200
export const LADO_NITIDEZ = 256
export const CALIDAD_JPEG = 0.8

/**
 * Varianza del laplaciano (sobre 256 px, en grises 0–255) por debajo de la cual decimos "la foto salió movida".
 * OJO: es un valor de partida. Hay que calibrarlo con fotos reales de platos sacadas con los celulares del equipo
 * (nítidas y movidas) y quedarse con un umbral que no moleste con fotos buenas: preferimos dejar pasar una
 * foto algo borrosa a frenar al padre sin motivo (igual tiene "Usar igual").
 */
export const UMBRAL_MOVIDA = 60

/** Escala para que el lado largo no pase de `max` (nunca agranda). */
export function medidas(ancho: number, alto: number, max: number): { ancho: number; alto: number } {
  const f = Math.min(1, max / Math.max(ancho, alto, 1))
  return { ancho: Math.max(1, Math.round(ancho * f)), alto: Math.max(1, Math.round(alto * f)) }
}

/** RGBA → luminancia (BT.601), un valor por píxel. */
export function aGrises(rgba: ArrayLike<number>, pixeles: number): Float32Array {
  const g = new Float32Array(pixeles)
  for (let i = 0; i < pixeles; i++) g[i] = 0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2]
  return g
}

/** Varianza del laplaciano de 4 vecinos: alta en fotos con bordes nítidos, baja en fotos movidas o fuera de foco. */
export function varianzaLaplaciano(gris: ArrayLike<number>, ancho: number, alto: number): number {
  if (ancho < 3 || alto < 3) return 0
  let suma = 0
  let suma2 = 0
  let n = 0
  for (let y = 1; y < alto - 1; y++) {
    for (let x = 1; x < ancho - 1; x++) {
      const i = y * ancho + x
      const l = gris[i - ancho] + gris[i + ancho] + gris[i - 1] + gris[i + 1] - 4 * gris[i]
      suma += l
      suma2 += l * l
      n++
    }
  }
  const media = suma / n
  return suma2 / n - media * media
}

export const estaMovida = (varianza: number) => varianza < UMBRAL_MOVIDA

export const sinPrefijo = (dataUrl: string) => dataUrl.slice(dataUrl.indexOf(',') + 1)

// ---------- Navegador ----------
interface Decodificada { fuente: CanvasImageSource; ancho: number; alto: number; cerrar: () => void }

async function decodificar(archivo: Blob): Promise<Decodificada> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(archivo, { imageOrientation: 'from-image' })
      return { fuente: bmp, ancho: bmp.width, alto: bmp.height, cerrar: () => bmp.close() }
    } catch { /* Safari viejo o HEIC que no decodifica así: probamos con <img> */ }
  }
  const url = URL.createObjectURL(archivo)
  const img = new Image()
  img.decoding = 'async'
  img.src = url
  try {
    await img.decode()
  } catch {
    URL.revokeObjectURL(url)
    throw new Error('No pudimos abrir la foto')
  }
  return { fuente: img, ancho: img.naturalWidth, alto: img.naturalHeight, cerrar: () => URL.revokeObjectURL(url) }
}

function lienzo(d: Decodificada, max: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const m = medidas(d.ancho, d.alto, max)
  const canvas = document.createElement('canvas')
  canvas.width = m.ancho
  canvas.height = m.alto
  const ctx = canvas.getContext('2d', { willReadFrequently: max === LADO_NITIDEZ })
  if (!ctx) throw new Error('Sin canvas 2D')
  ctx.fillStyle = '#fff' // un PNG con transparencia no queda negro al pasarlo a JPEG
  ctx.fillRect(0, 0, m.ancho, m.alto)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(d.fuente, 0, 0, m.ancho, m.alto)
  return { canvas, ctx }
}

export interface FotoLista {
  base64: string                         // JPEG 0,8 de 1024 px, sin el prefijo data:
  dataUrl: string                        // la misma, para mostrarla
  thumbBase64: string                    // JPEG de 200 px, para el registro
  ancho: number; alto: number
  nitidez: number                        // varianza del laplaciano a 256 px
}

export async function prepararFoto(archivo: Blob): Promise<FotoLista> {
  const d = await decodificar(archivo)
  try {
    const grande = lienzo(d, LADO_MAX)
    const dataUrl = grande.canvas.toDataURL('image/jpeg', CALIDAD_JPEG)
    const mini = lienzo(d, LADO_MINI).canvas.toDataURL('image/jpeg', CALIDAD_JPEG)
    const chica = lienzo(d, LADO_NITIDEZ)
    const { width, height } = chica.canvas
    const px = chica.ctx.getImageData(0, 0, width, height).data
    const nitidez = varianzaLaplaciano(aGrises(px, width * height), width, height)
    return {
      base64: sinPrefijo(dataUrl), dataUrl, thumbBase64: sinPrefijo(mini),
      ancho: grande.canvas.width, alto: grande.canvas.height, nitidez,
    }
  } finally {
    d.cerrar()
  }
}
