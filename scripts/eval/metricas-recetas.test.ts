import { describe, expect, it } from 'vitest'
import type { ProblemasPorTipo } from '../../server/validacion/receta.js'
import {
  CUBRE_MINIMO, USD_POR_LLAMADA, desglosar, fraseRecetas, resumirRecetas, sinProblemas, type ResultadoCasoReceta,
} from './metricas-recetas.js'

const vacio = (): ProblemasPorTipo => ({ cambio: [], reglas: [], mezclas: [], alergias: [], ingredientes: [], textos: [], lenguaje: [], aporte: [] })
const con = (p: Partial<ProblemasPorTipo>): ProblemasPorTipo => ({ ...vacio(), ...p })

function caso(intentos: ProblemasPorTipo[], final: ResultadoCasoReceta['final'], extra: Partial<ResultadoCasoReceta> = {}): ResultadoCasoReceta {
  return {
    id: 'x', ninoId: 'tomas', nutriente: 'calcio_mg', intentos, final,
    revalidacion: final === 'ok' ? vacio() : null, cobertura: final === 'ok' ? 0.4 : null, ms: final === 'error' ? null : 12_000, ...extra,
  }
}

describe('desglosar', () => {
  it('alergias, un solo cambio y lenguaje aparte; reglas, mezclas, gramos y textos van a "otros"', () => {
    const p = con({ alergias: ['a'], cambio: ['c'], lenguaje: ['l', 'l2'], ingredientes: ['g'], mezclas: ['m'] })
    expect(desglosar(p)).toEqual({ alergias: 1, cambio: 1, lenguaje: 2, otros: 2 })
    expect(sinProblemas(p)).toBe(false)
    expect(sinProblemas(vacio())).toBe(true)
  })
})

describe('resumirRecetas', () => {
  const casos = [
    caso([vacio()], 'ok'),                                                       // bien a la primera
    caso([con({ alergias: ['huevo'] }), vacio()], 'ok', { cobertura: 0.1 }),     // la validación atrapó el huevo
    caso([con({ lenguaje: ['premio'] }), con({ lenguaje: ['premio'] }), vacio()], 'ok'), // siguiente candidato
    caso([], 'sin_candidatos'),                                                  // B no tenía candidatos: no llama al LLM
    caso([con({ cambio: ['principal'] })], 'error', { error: 'timeout' }),
  ]
  const r = resumirRecetas(casos)

  it('el LLM solo: la primera salida de cada caso que llamó al LLM, con el desglose', () => {
    expect(r.llmSolo).toMatchObject({ ok: 1, total: 4 })
    expect(r.llmSolo.porTipo).toEqual({
      alergias: { ok: 3, total: 4 }, cambio: { ok: 3, total: 4 }, lenguaje: { ok: 3, total: 4 }, otros: { ok: 4, total: 4 },
    })
  })

  it('después de la validación: válidas, sin candidatos, errores e inválidas (tiene que dar 0)', () => {
    expect(r.final).toMatchObject({ ok: 3, sinCandidatos: 1, errores: 1, invalidas: 0 })
    expect(r.final.porTipo.alergias).toEqual({ ok: 3, total: 3 })
  })

  it('todas las salidas del LLM: cuántas tenían problemas y de qué tipo', () => {
    expect(r.salidas).toEqual({ total: 7, conProblemas: 4, porTipo: { alergias: 1, cambio: 1, lenguaje: 2, otros: 0 } })
    expect(r.llamadas).toBe(7)
    expect(r.costoUsd).toBe(Math.round(7 * USD_POR_LLAMADA * 100) / 100)
  })

  it(`cubre al menos el ${CUBRE_MINIMO * 100}% de lo que falta, sobre las válidas`, () => {
    expect(r.cubre).toEqual({ ok: 2, total: 3 })
  })

  it('latencia: el error cuenta fuera del límite y no entra en la media', () => {
    expect(r.latencia).toEqual({ media: 12_000, p95: 12_000, bajoLimite: 4 / 5 })
  })

  it('una receta final que no pasa la revalidación cuenta como inválida, no como válida', () => {
    const mala = resumirRecetas([caso([vacio()], 'ok', { revalidacion: con({ alergias: ['huevo'] }) })])
    expect(mala.final).toMatchObject({ ok: 0, invalidas: 1 })
    expect(mala.final.porTipo.alergias).toEqual({ ok: 0, total: 1 })
    expect(resumirRecetas([caso([vacio()], 'ok', { revalidacion: null })]).final.invalidas).toBe(1)
  })
})

describe('fraseRecetas', () => {
  it('la del pitch, cuando el código atrapó todo', () => {
    const r = resumirRecetas([caso([con({ alergias: ['huevo'] }), vacio()], 'ok')])
    expect(fraseRecetas(r)).toBe('El LLM se equivocó en 1 de sus 2 salidas; el código lo atrapó siempre: ninguna receta inválida llegó a la familia.')
  })

  it('si pasó una inválida, lo dice', () => {
    const r = resumirRecetas([caso([vacio()], 'ok', { revalidacion: con({ cambio: ['x'] }) })])
    expect(fraseRecetas(r)).toBe('El LLM se equivocó en 0 de sus 1 salidas, y 1 receta inválida pasó la validación: hay que revisarla.')
  })

  it('sin salidas del modelo', () => {
    expect(fraseRecetas(resumirRecetas([caso([], 'sin_candidatos')]))).toBe('No hubo salidas del modelo para medir.')
  })
})
