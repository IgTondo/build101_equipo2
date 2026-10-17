// Funciones puras de la pantalla Registrar (C2/C5): foto movida, relato → botones y armado del RegistrarComidaReq.
import { describe, expect, it } from 'vitest'
import type { AnalisisComida, RelatoComida } from '../../../shared/contratos'
import analisisFixture from '../../../fixtures/analizar-comida.json'
import relatoFixture from '../../../fixtures/relato-comida.json'
import { aGrises, estaMovida, medidas, UMBRAL_MOVIDA, varianzaLaplaciano } from './imagen'
import {
  analisisEditado, aplicarRelato, armarRegistro, borradorInicial, esDeIA, faltanMarcar, horaUruguay,
  marcarCuanto, marcarMotivo, momentoPorHora, preguntasVivas, puedeGuardar, rangoLegible, type Borrador,
} from './modelo'

const analisis = analisisFixture as AnalisisComida
const relato = relatoFixture as RelatoComida
const ctx = { ninoId: 'tomas', momento: 'almuerzo' as const, thumbBase64: 'mini', ahora: new Date('2026-10-16T15:30:00Z'), dia: '2026-10-16' }

// ---------- Foto ----------
function tablero(lado: number, celda: number): Float32Array {
  const g = new Float32Array(lado * lado)
  for (let y = 0; y < lado; y++) for (let x = 0; x < lado; x++) g[y * lado + x] = (Math.floor(x / celda) + Math.floor(y / celda)) % 2 ? 230 : 25
  return g
}
function desenfocar(g: Float32Array, lado: number, radio: number, pasadas: number): Float32Array {
  let a = g
  for (let p = 0; p < pasadas; p++) {
    const b = new Float32Array(a.length)
    for (let y = 0; y < lado; y++) for (let x = 0; x < lado; x++) {
      let s = 0; let n = 0
      for (let dy = -radio; dy <= radio; dy++) for (let dx = -radio; dx <= radio; dx++) {
        const yy = y + dy; const xx = x + dx
        if (yy >= 0 && yy < lado && xx >= 0 && xx < lado) { s += a[yy * lado + xx]; n++ }
      }
      b[y * lado + x] = s / n
    }
    a = b
  }
  return a
}

describe('foto movida (varianza del laplaciano)', () => {
  it('una imagen lisa da 0', () => {
    expect(varianzaLaplaciano(new Float32Array(64 * 64).fill(128), 64, 64)).toBe(0)
  })
  it('una imagen nítida pasa el umbral y la misma desenfocada no', () => {
    const nitida = tablero(128, 8)
    const movida = desenfocar(nitida, 128, 3, 3)
    expect(estaMovida(varianzaLaplaciano(nitida, 128, 128))).toBe(false)
    expect(varianzaLaplaciano(movida, 128, 128)).toBeLessThan(UMBRAL_MOVIDA)
    expect(estaMovida(varianzaLaplaciano(movida, 128, 128))).toBe(true)
  })
  it('imágenes demasiado chicas no rompen', () => {
    expect(varianzaLaplaciano([1, 2, 3, 4], 2, 2)).toBe(0)
  })
  it('pasa RGBA a grises y escala sin agrandar', () => {
    expect(Array.from(aGrises([255, 255, 255, 255, 0, 0, 0, 255], 2)).map(Math.round)).toEqual([255, 0])
    expect(medidas(4032, 3024, 1024)).toEqual({ ancho: 1024, alto: 768 })
    expect(medidas(3024, 4032, 200)).toEqual({ ancho: 150, alto: 200 })
    expect(medidas(800, 600, 1024)).toEqual({ ancho: 800, alto: 600 })
  })
})

// ---------- Momento ----------
describe('momento por hora de Uruguay', () => {
  it('desayuno < 10, almuerzo < 15, merienda < 19, cena después', () => {
    expect([7, 9, 10, 14, 15, 18, 19, 23, 0].map(momentoPorHora)).toEqual(
      ['desayuno', 'desayuno', 'almuerzo', 'almuerzo', 'merienda', 'merienda', 'cena', 'cena', 'desayuno'])
  })
  it('usa la hora de Montevideo (UTC−3), no la del dispositivo', () => {
    expect(horaUruguay(new Date('2026-10-16T15:30:00Z'))).toBe(12)
    expect(horaUruguay(new Date('2026-10-17T01:00:00Z'))).toBe(22)
  })
})

// ---------- Relato → botones ----------
describe('aplicarRelato', () => {
  const b = aplicarRelato(borradorInicial(analisis), relato, 'voz')

  it('pre-marca lo mencionado con su cita y deja sin marcar lo de sinMencion', () => {
    expect(b.respuestas.i1).toMatchObject({ cuanto: 'aparto', motivo: 'textura' })
    expect(esDeIA(b.respuestas.i1)).toBe(true)
    expect(b.respuestas.i3?.cuanto).toBe('mitad')
    expect(b.respuestas.i2).toBeUndefined()
    expect(b.sinMencion).toEqual(['i2'])
    expect(b.conducta).toEqual(['tranquilo'])
    expect(b.preguntas).toEqual({ q1: 'Sí, de queso', q2: 'Sí' })
    expect(faltanMarcar(b).map((i) => i.idTmp)).toEqual(['i2'])
    expect(puedeGuardar(b)).toBe(false)
  })

  it('no inventa: una respuesta sin cita queda sin marcar', () => {
    const sinCita: RelatoComida = { ...relato, respuestas: relato.respuestas.map((r) => ({ ...r, cita: undefined })), sinMencion: [] }
    const x = aplicarRelato(borradorInicial(analisis), sinCita, 'voz')
    expect(x.respuestas).toEqual({})
    expect(x.sinMencion).toEqual(['i1', 'i2', 'i3'])
  })

  it('ignora ítems borrados y opciones que no existen', () => {
    const base = borradorInicial(analisis)
    const sinI1: Borrador = { ...base, items: base.items.map((i) => (i.idTmp === 'i1' ? { ...i, borrado: true } : i)) }
    const raro: RelatoComida = { ...relato, respuestasPreguntas: [{ preguntaId: 'q2', respuesta: 'Tal vez' }] }
    const x = aplicarRelato(sinI1, raro, 'texto')
    expect(x.respuestas.i1).toBeUndefined()
    expect(x.preguntas).toEqual({})
  })

  it('al corregir deja de ser de la IA; al volver al mismo escalón, recupera el motivo', () => {
    const corregido = marcarCuanto(b, 'i1', 'toco')
    expect(esDeIA(corregido.respuestas.i1)).toBe(false)
    expect(corregido.respuestas.i1.motivo).toBeUndefined()
    const vuelto = marcarCuanto(corregido, 'i1', 'aparto')
    expect(vuelto.respuestas.i1).toMatchObject({ cuanto: 'aparto', motivo: 'textura' })
    expect(esDeIA(vuelto.respuestas.i1)).toBe(true)
    expect(esDeIA(marcarMotivo(vuelto, 'i1', 'color').respuestas.i1)).toBe(false)
  })
})

// ---------- RegistrarComidaReq ----------
describe('armarRegistro', () => {
  const conVoz = marcarCuanto(aplicarRelato(borradorInicial(analisis), relato, 'voz'), 'i2', 'todo')

  it('arma el pedido con porción, cita solo si no se cambió y el relato', () => {
    const req = armarRegistro(conVoz, ctx)
    expect(req).toMatchObject({ ninoId: 'tomas', dia: '2026-10-16', fechaISO: '2026-10-16T15:30:00.000Z', momento: 'almuerzo', thumbBase64: 'mini' })
    expect(req.respuestas).toEqual([
      { itemIdTmp: 'i1', cuanto: 'aparto', porcion: 'mediana', motivo: 'textura', cita: relato.respuestas[0].cita },
      { itemIdTmp: 'i2', cuanto: 'todo', porcion: 'mediana' },
      { itemIdTmp: 'i3', cuanto: 'mitad', porcion: 'chica', cita: relato.respuestas[1].cita },
    ])
    expect(req.respuestasPreguntas).toEqual([{ preguntaId: 'q1', respuesta: 'Sí, de queso' }, { preguntaId: 'q2', respuesta: 'Sí' }])
    expect(req.conducta).toEqual(['tranquilo'])
    expect(req.relato).toEqual({ transcripcion: relato.transcripcion, fuente: 'voz' })
    expect(req.comentario).toBe(relato.comentario)
  })

  it('si el padre corrige a la IA, no manda la cita ni el comentario del relato', () => {
    const req = armarRegistro(marcarCuanto(conVoz, 'i3', 'poco'), ctx)
    expect(req.respuestas.find((r) => r.itemIdTmp === 'i3')).toEqual({ itemIdTmp: 'i3', cuanto: 'poco', porcion: 'chica' })
    expect(req.comentario).toBeUndefined()
  })

  it('aplica las correcciones del padre al análisis: borrar, renombrar y porción', () => {
    let b = borradorInicial(analisis)
    b = { ...b, items: b.items.map((i) =>
      i.idTmp === 'i3' ? { ...i, borrado: true }
        : i.idTmp === 'i2' ? { ...i, preparacion: 'milanesa de pollo', porcion: 'grande' } : i) }
    b = marcarCuanto(marcarCuanto(b, 'i1', 'nada'), 'i2', 'probo')
    b = { ...b, preguntas: { q1: 'Sí, de queso', q2: 'No' } }
    expect(preguntasVivas(b).map((p) => p.id)).toEqual(['q2'])
    const req = armarRegistro(b, { ...ctx, thumbBase64: undefined })
    expect(req.analisis.items.map((i) => i.idTmp)).toEqual(['i1', 'i2'])
    expect(req.analisis.items[1]).toMatchObject({ preparacion: 'milanesa de pollo', preparacionId: null, porcion: 'grande' })
    expect(req.analisis.items[0].preparacionId).toBe('pure_papa')
    expect(req.analisis.distribucion.cantidadItems).toBe(2)
    expect(req.analisis.preguntas.map((p) => p.id)).toEqual(['q2'])
    expect(req.respuestasPreguntas).toEqual([{ preguntaId: 'q2', respuesta: 'No' }])
    expect(req.respuestas[1]).toEqual({ itemIdTmp: 'i2', cuanto: 'probo', porcion: 'grande' })
    expect(req.relato).toBeUndefined()
    expect(req.thumbBase64).toBeUndefined()
    expect(analisisEditado(b).items).toHaveLength(2)
  })

  it('no arma nada si falta marcar un ítem', () => {
    expect(() => armarRegistro(borradorInicial(analisis), ctx)).toThrow()
  })
})

describe('rangoLegible', () => {
  it('muestra min–max con la unidad y colapsa si es igual', () => {
    expect(rangoLegible('calcio_mg', 63, 131)).toBe('63–131 mg')
    expect(rangoLegible('vitamina_c_mg', 0, 0)).toBe('0 mg')
  })
})
