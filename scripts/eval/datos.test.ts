// Guardas de los datos de eval/: que las etiquetas y los relatos validen, que las fotos y los audios existan y pesen
// poco, y que los relatos sintéticos estén al día con su generador. No llaman a ningún modelo.
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { idsAlimentos } from '../../server/ia/catalogo.js'
import { DIR_FOTOS, DIR_VOZ, analisisMinimo, leerEtiquetas, leerRelatos } from './datos.js'
import { casosSinteticos, leerSinteticos } from './relatos-sinteticos.js'

/** Ancho y alto de un JPEG, leyendo el marcador SOF (sin dependencias). */
function medidasJpeg(buf: Buffer): { ancho: number; alto: number } | null {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return null
  let i = 2
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) return null
    const marca = buf[i + 1]
    if (marca >= 0xc0 && marca <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marca)) {
      return { alto: buf.readUInt16BE(i + 5), ancho: buf.readUInt16BE(i + 7) }
    }
    i += 2 + buf.readUInt16BE(i + 2)
  }
  return null
}

describe('eval/etiquetas.json', () => {
  const etiquetas = leerEtiquetas()
  const ids = new Set(idsAlimentos())

  it('valida, sin archivos repetidos y con al menos un alimento por foto', () => {
    expect(etiquetas.length).toBeGreaterThan(0)
    expect(new Set(etiquetas.map((e) => e.archivo)).size).toBe(etiquetas.length)
    for (const e of etiquetas) expect(e.alimentos.length, e.archivo).toBeGreaterThan(0)
  })

  it('cada alimentoId existe en data/alimentos.json', () => {
    const faltan = etiquetas.flatMap((e) => e.alimentos.filter((a) => !ids.has(a.alimentoId)).map((a) => `${e.archivo}: ${a.alimentoId}`))
    expect(faltan).toEqual([])
  })

  it('cada foto es un JPEG de 1024 px como máximo, y entre todas pesan menos de 2 MB', () => {
    let total = 0
    for (const e of etiquetas) {
      const ruta = join(DIR_FOTOS, e.archivo)
      expect(existsSync(ruta), e.archivo).toBe(true)
      const medidas = medidasJpeg(readFileSync(ruta))
      expect(medidas, `${e.archivo} no es un JPEG`).not.toBeNull()
      expect(Math.max(medidas!.ancho, medidas!.alto), e.archivo).toBeLessThanOrEqual(1024)
      total += statSync(ruta).size
    }
    expect(total).toBeLessThan(2 * 1024 * 1024)
  })
})

describe('eval/voz/relatos.json', () => {
  const relatos = leerRelatos()

  it('valida, sin ids repetidos, y los audios existen', () => {
    expect(new Set(relatos.map((c) => c.id)).size).toBe(relatos.length)
    for (const c of relatos.filter((x) => x.audio)) expect(existsSync(join(DIR_VOZ, c.audio!)), c.id).toBe(true)
  })

  it('los sintéticos están al día con scripts/eval/relatos-sinteticos.ts', () => {
    expect(relatos.filter((c) => c.fuente === 'sintetico')).toEqual(casosSinteticos(leerSinteticos()))
  })

  it('los sintéticos traen casos con ítems sin mencionar (para medir los inventados)', () => {
    expect(relatos.filter((c) => c.fuente === 'sintetico' && c.esperado.sinMencion.length).length).toBeGreaterThan(0)
  })

  it('el análisis mínimo lleva los ítems y las preguntas del caso', () => {
    const caso = relatos[0]
    const a = analisisMinimo(caso)
    expect(a.items.map((i) => [i.idTmp, i.preparacion])).toEqual(caso.items.map((i) => [i.idTmp, i.preparacion]))
    expect(a.distribucion.cantidadItems).toBe(caso.items.length)
    expect(a.preguntas).toEqual(caso.preguntas ?? [])
  })
})
