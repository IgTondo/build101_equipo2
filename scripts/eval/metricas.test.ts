import { describe, expect, it } from 'vitest'
import type { Atributos, ItemDetectado, RelatoComida } from '../../shared/contratos.js'
import { deTotal, fechaUY, mensajeError, porcentaje, segundos, tabla } from './markdown.js'
import {
  alimentoPrincipal, citaValida, compararFoto, compararRelato, latencia, percentil, recomendarModelo, relatoFallido,
  resumirVision, resumirVoz, type AlimentoEtiquetado, type EsperadoRelato, type ResultadoFoto,
} from './metricas.js'

const PAPAS: Atributos = {
  textura: 'crocante', forma: 'baston', color: 'amarillo', sabor: 'salado', temperatura: 'caliente',
  presentacion: 'separado', grupo: 'cereal_almidon', coccion: 'frito',
}

function item(ingredientes: [string, number][], atributos: Partial<Atributos> = {}): ItemDetectado {
  return {
    idTmp: 'i', preparacion: 'x', preparacionId: null, porcion: 'mediana', caja: null, confianza: 0.9,
    ingredientes: ingredientes.map(([alimentoId, gramosEst]) => ({ alimentoId, gramosEst })),
    atributos: { ...PAPAS, ...atributos },
  }
}

const papa: AlimentoEtiquetado = { alimentoId: 'papa', textura: 'crocante', forma: 'baston', color: 'amarillo', coccion: 'frito' }
const milanesa: AlimentoEtiquetado = { alimentoId: 'carne_vacuna', textura: 'crocante', forma: 'plano', color: 'marron' }

describe('visión', () => {
  it('el alimento principal es el ingrediente de más gramos', () => {
    expect(alimentoPrincipal(item([['pan_rallado', 20], ['carne_vacuna', 90], ['aceite_girasol', 5]]))).toBe('carne_vacuna')
    expect(alimentoPrincipal(item([]))).toBeNull()
  })

  it('cuenta aciertos, faltantes, de más y atributos solo en los acertados', () => {
    const c = compararFoto([papa, milanesa], [
      item([['papa', 120], ['aceite_girasol', 10]], { color: 'beige' }),
      item([['pollo', 100]]),
    ])
    expect(c).toMatchObject({ etiquetados: 2, aciertos: 1, predichos: 2, genericos: 0, faltaron: ['carne_vacuna'], deMas: ['pollo'] })
    expect(c.atributos.textura).toEqual({ ok: 1, total: 1 })
    expect(c.atributos.color).toEqual({ ok: 0, total: 1 })
    expect(c.atributos.coccion).toEqual({ ok: 1, total: 1 })
  })

  it('la cocción cuenta solo si está etiquetada', () => {
    const c = compararFoto([milanesa], [item([['carne_vacuna', 90]], { forma: 'plano', color: 'marron', coccion: 'horno' })])
    expect(c.atributos.coccion).toEqual({ ok: 0, total: 0 })
    expect(c.atributos.forma).toEqual({ ok: 1, total: 1 })
  })

  it('otro_<grupo> es "no reconocido": no suma a la precisión, salvo con etiqueta genérica', () => {
    const c = compararFoto([milanesa], [item([['otro_proteina', 90]])])
    expect(c).toMatchObject({ aciertos: 0, predichos: 0, genericos: 1, deMas: [], faltaron: ['carne_vacuna'] })
    const generica = compararFoto([{ ...milanesa, alimentoId: 'otro_proteina' }], [item([['otro_proteina', 90]])])
    expect(generica).toMatchObject({ aciertos: 1, predichos: 1, genericos: 0 })
  })

  it('con el mismo alimento dos veces, empareja cada etiqueta con el ítem que más atributos acierta', () => {
    const pure: AlimentoEtiquetado = { alimentoId: 'papa', textura: 'cremoso', forma: 'pure', color: 'amarillo' }
    const c = compararFoto([pure, papa], [item([['papa', 100]]), item([['papa', 150]], { textura: 'cremoso', forma: 'pure' })])
    expect(c.aciertos).toBe(2)
    expect(c.atributos.textura).toEqual({ ok: 2, total: 2 })
    expect(compararFoto([papa, papa], [item([['papa', 100]])])).toMatchObject({ aciertos: 1, faltaron: ['papa'] })
  })

  it('resume micro-promedios, latencia y aciertos en menos de 8 s', () => {
    const fotos: ResultadoFoto[] = [
      { archivo: 'a.jpg', ms: 3000, comparacion: compararFoto([papa, milanesa], [item([['papa', 100]])]) },
      { archivo: 'b.jpg', ms: 9000, comparacion: compararFoto([papa], [item([['papa', 100]]), item([['arroz', 80]])]) },
      { archivo: 'c.jpg', ms: null, error: 'timeout', comparacion: compararFoto([milanesa], []) },
    ]
    const r = resumirVision(fotos)
    expect(r).toMatchObject({ fotos: 3, errores: 1, etiquetados: 4, aciertos: 2, predichos: 3, aciertosRapidos: 1 })
    expect(r.recall).toBe(0.5)
    expect(r.precision).toBeCloseTo(2 / 3)
    expect(r.latencia).toEqual({ media: 6000, p95: 9000, bajoLimite: 1 / 3 })
  })

  it('recomienda el que más acierta en menos de 8 s, aunque otro tenga más recall', () => {
    const rapido = resumirVision([{ archivo: 'a', ms: 2000, comparacion: compararFoto([papa, milanesa], [item([['papa', 1]])]) }])
    const lento = resumirVision([{ archivo: 'a', ms: 12000, comparacion: compararFoto([papa, milanesa], [item([['papa', 1]]), item([['carne_vacuna', 1]])]) }])
    expect(recomendarModelo([{ modelo: 'sonnet', resumen: lento }, { modelo: 'haiku', resumen: rapido }])?.modelo).toBe('haiku')
    expect(recomendarModelo([])).toBeNull()
  })
})

describe('latencia', () => {
  it('p95 por rango más cercano y errores fuera del límite', () => {
    expect(percentil([5, 1, 3, 2, 4], 95)).toBe(5)
    expect(percentil(Array.from({ length: 20 }, (_, i) => i + 1), 95)).toBe(19)
    expect(percentil([], 95)).toBeNull()
    expect(latencia([1000, null])).toEqual({ media: 1000, p95: 1000, bajoLimite: 0.5 })
    expect(latencia([])).toEqual({ media: null, p95: null, bajoLimite: null })
  })
})

describe('voz', () => {
  const transcripcion = 'Las papas fritas: se las comió todas. La milanesa la sacó del plato. Estuvo tranquilo.'
  const esperado: EsperadoRelato = {
    respuestas: [{ itemIdTmp: 'i1', cuanto: 'todo' }, { itemIdTmp: 'i2', cuanto: 'aparto' }],
    sinMencion: ['i3'],
    conducta: ['tranquilo'],
  }
  const relato = (respuestas: RelatoComida['respuestas'], conducta: RelatoComida['conducta'] = ['tranquilo']): RelatoComida => ({
    transcripcion, respuestas, respuestasPreguntas: [], conducta, comentario: '', sinMencion: [], ms: 0,
  })

  it('la cita tiene que estar en la transcripción (sin importar tildes, mayúsculas ni puntuación)', () => {
    expect(citaValida('las papas fritas, se las comio todas', transcripcion)).toBe(true)
    expect(citaValida('La milanesa la sacó del plato.', transcripcion)).toBe(true)
    expect(citaValida('se comió la milanesa', transcripcion)).toBe(false)
    expect(citaValida('las', 'Lasaña')).toBe(false)
    expect(citaValida('', transcripcion)).toBe(false)
    expect(citaValida(undefined, transcripcion)).toBe(false)
  })

  it('cuenta cuanto correcto, faltantes, inventados, citas y conducta', () => {
    const c = compararRelato(esperado, relato([
      { itemIdTmp: 'i1', cuanto: 'todo', confianza: 0.9, cita: 'se las comió todas' },
      { itemIdTmp: 'i3', cuanto: 'nada', confianza: 0.5, cita: 'el brócoli ni lo tocó' },
      { itemIdTmp: 'i9', cuanto: 'poco', confianza: 0.5 },
    ], ['tranquilo', 'angustia']), ['i1', 'i2', 'i3'])
    expect(c).toMatchObject({
      cuantoOk: 1, cuantoTotal: 2, cuantoMal: [], faltantes: ['i2'], inventados: ['i3', 'i9'], sinMencion: 1,
      citasValidas: 1, citasTotal: 3, conductaOk: false, conductaDeMas: ['angustia'], conductaFaltante: [],
    })
  })

  it('un cuanto distinto queda anotado con lo esperado y lo obtenido', () => {
    const c = compararRelato(esperado, relato([
      { itemIdTmp: 'i1', cuanto: 'mitad', confianza: 0.9, cita: 'se las comió todas' },
      { itemIdTmp: 'i2', cuanto: 'aparto', confianza: 0.9, cita: 'la sacó del plato' },
    ]), ['i1', 'i2', 'i3'])
    expect(c).toMatchObject({ cuantoOk: 1, inventados: [], conductaOk: true, citasValidas: 2 })
    expect(c.cuantoMal).toEqual([{ itemIdTmp: 'i1', esperado: 'todo', obtenido: 'mitad' }])
  })

  it('una llamada fallida cuenta el caso entero como mal y resume por casos', () => {
    const ok = compararRelato(esperado, relato([
      { itemIdTmp: 'i1', cuanto: 'todo', confianza: 0.9, cita: 'se las comió todas' },
      { itemIdTmp: 'i2', cuanto: 'aparto', confianza: 0.9, cita: 'la sacó del plato' },
    ]), ['i1', 'i2', 'i3'])
    const r = resumirVoz([
      { id: 'a', canal: 'texto', ms: 2000, comparacion: ok },
      { id: 'b', canal: 'texto', ms: null, error: 'timeout', comparacion: relatoFallido(esperado) },
    ])
    expect(r).toMatchObject({
      casos: 2, errores: 1, cuanto: { ok: 2, total: 4 }, conducta: { ok: 1, total: 2 },
      inventados: 0, sinMencion: 2, citas: { ok: 2, total: 2 },
    })
    expect(r.latencia.bajoLimite).toBe(0.5)
  })
})

describe('markdown', () => {
  it('arma tablas y formatea números con coma', () => {
    expect(tabla(['A', 'B'], [[1, 'x|y']])).toBe('| A | B |\n|---|---|\n| 1 | x\\|y |')
    expect(porcentaje(0.8333)).toBe('83%')
    expect(porcentaje(null)).toBe('—')
    expect(deTotal(5, 6)).toBe('5/6 (83%)')
    expect(deTotal(0, 0)).toBe('—')
    expect(segundos(3249)).toBe('3,2 s')
    expect(segundos(null)).toBe('—')
  })

  it('fecha en hora de Uruguay y errores con su detalle', () => {
    expect(fechaUY(new Date('2026-10-18T00:30:00Z'))).toBe('17/10/2026 21:30')
    expect(mensajeError(Object.assign(new Error('Tardó'), { detalle: { motivo: 'timeout' } }))).toBe('Tardó {"motivo":"timeout"}')
    expect(mensajeError('roto')).toBe('roto')
  })
})
