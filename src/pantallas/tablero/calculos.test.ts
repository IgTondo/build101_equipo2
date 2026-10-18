import { describe, expect, it } from 'vitest'
import type { CoberturaDia, Nutrientes } from '../../../shared/contratos'
import progreso from '../../../fixtures/progreso.json'
import {
  coberturaPromedio, escalaBarra, etiquetaDia, fechaCorta, fraseGrupoAusente, hayComidas, MARCA_100,
  ordenarNutrientes, rutaReceta, srcMiniatura, textoDiasSinComer, textoEnergia,
  diasEntre, gruposDesdeHoy, sumarDias, textoEvolucion, textoTendencia, textoVeces, ultimasComidas, ultimoDia, ultimoDiaConComidas, valorAtributo,
} from './calculos'

const dias = progreso.dias as CoberturaDia[]

describe('ordenarNutrientes', () => {
  it('pone primero los que faltan, en su orden de prioridad, y después el resto en el orden fijo', () => {
    expect(ordenarNutrientes(['calcio_mg', 'vitamina_d_ug', 'fibra_g', 'omega3_g'])).toEqual([
      'calcio_mg', 'vitamina_d_ug', 'fibra_g', 'omega3_g', 'hierro_mg', 'vitamina_c_mg', 'b12_ug', 'proteina_g',
    ])
  })
  it('respeta el orden de faltan aunque no sea el fijo, y nunca incluye la energía', () => {
    const r = ordenarNutrientes(['vitamina_c_mg', 'energia_kcal', 'calcio_mg'])
    expect(r.slice(0, 2)).toEqual(['vitamina_c_mg', 'calcio_mg'])
    expect(r).toHaveLength(8)
    expect(r).not.toContain('energia_kcal')
  })
})

describe('escalaBarra', () => {
  it('el 100% cae en la marca y lo que pasa del 120% se recorta', () => {
    expect(escalaBarra(1).fraccion).toBeCloseTo(MARCA_100)
    expect(escalaBarra(0.4)).toEqual({ fraccion: 0.4 / 1.2, recortada: false })
    expect(escalaBarra(2.01)).toEqual({ fraccion: 1, recortada: true })
    expect(escalaBarra(-1).fraccion).toBe(0)
    expect(escalaBarra(Number.NaN).fraccion).toBe(0)
  })
})

describe('coberturaPromedio', () => {
  it('promedia los 8 con meta topeando cada uno en 100%', () => {
    const c = { energia_kcal: 0, proteina_g: 2, calcio_mg: 0.5, vitamina_d_ug: 0, hierro_mg: 1, fibra_g: 0.5, omega3_g: 0, b12_ug: 3, vitamina_c_mg: 1 } satisfies Nutrientes
    expect(coberturaPromedio(c)).toBeCloseTo((1 + 0.5 + 0 + 1 + 0.5 + 0 + 1 + 1) / 8)
  })
})

describe('textos', () => {
  it('energía redondeada a la decena, sin meta', () => {
    expect(textoEnergia(762)).toBe('≈ 760 kcal por día')
    expect(textoEnergia(1004)).toMatch(/^≈ 1.000 kcal por día$/)
  })
  it('tendencia del repertorio', () => {
    expect(textoTendencia(1)).toBe('1 más que la semana pasada')
    expect(textoTendencia(2)).toBe('2 más que la semana pasada')
    expect(textoTendencia(0)).toBe('Igual que la semana pasada')
    expect(textoTendencia(-1)).toBe('1 menos que la semana pasada')
  })
  it('días sin comer un grupo', () => {
    expect(textoDiasSinComer(null)).toBe('Todavía no lo registramos')
    expect(textoDiasSinComer(0)).toBe('Hoy')
    expect(textoDiasSinComer(1)).toBe('Ayer')
    expect(textoDiasSinComer(5)).toBe('Hace 5 días')
  })
  it('la frase del grupo que hace más que no come', () => {
    expect(fraseGrupoAusente(progreso.grupos as Parameters<typeof fraseGrupoAusente>[0])).toBe('Hace 10 días que no come verdura')
    expect(fraseGrupoAusente([{ grupo: 'fruta', diasSinComer: 1 }, { grupo: 'otro', diasSinComer: 40 }])).toBeNull()
    expect(fraseGrupoAusente([{ grupo: 'lacteo', diasSinComer: null }])).toBeNull()
  })
  it('exposiciones', () => {
    expect(textoVeces(1)).toBe('Ofrecido 1 vez de 8 a 15')
    expect(textoVeces(5)).toBe('Ofrecido 5 veces de 8 a 15')
  })
  it('evolución en texto', () => {
    expect(textoEvolucion(0.32, 0.4)).toBe('Subió de 32% a 40%')
    expect(textoEvolucion(0.4, 0.35)).toBe('Bajó de 40% a 35%')
    expect(textoEvolucion(0.091, 0.089)).toBe('Se mantuvo en 9%')
  })
  it('atributos que se mantienen, legibles', () => {
    expect(['forma=baston', 'textura=crocante', 'coccion=horno', 'presentacion=con_salsa'].map(valorAtributo))
      .toEqual(['bastón', 'crocante', 'al horno', 'con salsa'])
  })
})

describe('fechas', () => {
  it('etiqueta relativa al día de hoy', () => {
    expect(etiquetaDia('2026-10-17', '2026-10-17')).toBe('Hoy')
    expect(etiquetaDia('2026-10-16', '2026-10-17')).toBe('Ayer')
    expect(etiquetaDia('2026-10-14', '2026-10-17')).toMatch(/miércoles 14/)
    expect(fechaCorta('2026-09-19')).toBe('19/9')
  })
})

describe('comidas', () => {
  it('detecta si hay comidas y ordena las últimas de la más nueva a la más vieja', () => {
    expect(hayComidas(dias)).toBe(true)
    expect(hayComidas(dias.map((d) => ({ ...d, comidas: [] })))).toBe(false)
    const u = ultimasComidas(dias, 4)
    expect(u).toHaveLength(4)
    expect(u.slice(0, 3).map((c) => c.id)).toEqual(['tomas-2026-10-16-merienda', 'tomas-2026-10-16-almuerzo', 'tomas-2026-10-16-desayuno'])
    for (let i = 1; i < u.length; i++) expect(Date.parse(u[i - 1].fechaISO)).toBeGreaterThanOrEqual(Date.parse(u[i].fechaISO))
    expect(u[0].dia).toBe('2026-10-16')
  })
  it('el último día es el más reciente aunque vengan desordenados', () => {
    expect(ultimoDia([...dias].reverse())?.dia).toBe('2026-10-16')
    expect(ultimoDia([])).toBeNull()
  })
  it('miniatura con o sin prefijo data:', () => {
    expect(srcMiniatura('abc')).toBe('data:image/jpeg;base64,abc')
    expect(srcMiniatura('data:image/png;base64,abc')).toBe('data:image/png;base64,abc')
  })
})

describe('receta', () => {
  it('arma la ruta de la receta', () => {
    expect(rutaReceta('tomas', 'bastones_queso_horno', 'calcio_mg'))
      .toBe('/receta?nino=tomas&preparacionId=bastones_queso_horno&nutriente=calcio_mg')
    expect(rutaReceta('tomas', 'yogur')).toBe('/receta?nino=tomas&preparacionId=yogur')
  })
})

describe('ultimoDiaConComidas (semana de hoy vacía, pero con historial)', () => {
  const cero = { calcio_mg: 0 } as Nutrientes
  it('suma días sin perder el mes', () => {
    expect(sumarDias('2026-10-01', -1)).toBe('2026-09-30')
    expect(sumarDias('2026-10-16', 7)).toBe('2026-10-23')
  })
  it('toma el más reciente entre grupos, exposiciones y semanas con datos', () => {
    expect(ultimoDiaConComidas({
      grupos: [{ grupo: 'fruta', diasSinComer: 14 }, { grupo: 'verdura', diasSinComer: null }],
      exposiciones: [{ preparacionId: 'x', nombre: 'X', veces: 1, mejorPaso: 'nada', ultimaISO: '2026-10-12T20:30:00-03:00' }],
      semanas: [{ desde: '2026-10-03', cobertura: { ...cero, calcio_mg: 0.2 } }, { desde: '2026-10-24', cobertura: cero }],
    }, '2026-10-30')).toBe('2026-10-16')
  })
  it('prefiere el día exacto de grupos y exposiciones a la semana de la evolución', () => {
    expect(ultimoDiaConComidas({
      grupos: [{ grupo: 'lacteo', diasSinComer: 16 }], exposiciones: [],
      semanas: [{ desde: '2026-09-27', cobertura: { ...cero, calcio_mg: 0.1 } }],
    }, '2026-10-17')).toBe('2026-10-01')
    expect(ultimoDiaConComidas({ grupos: [], exposiciones: [], semanas: [{ desde: '2026-09-27', cobertura: { ...cero, calcio_mg: 0.1 } }] }, '2026-10-17'))
      .toBe('2026-10-03')
  })
  it('los días sin comer de cada grupo se cuentan desde hoy, no desde `hasta`', () => {
    expect(diasEntre('2026-10-01', '2026-10-17')).toBe(16)
    expect(gruposDesdeHoy([{ grupo: 'lacteo', diasSinComer: 0 }, { grupo: 'fruta', diasSinComer: null }], '2026-10-01', '2026-10-17'))
      .toEqual([{ grupo: 'lacteo', diasSinComer: 16 }, { grupo: 'fruta', diasSinComer: null }])
  })
  it('null si nunca se registró nada (perfil recién creado)', () => {
    expect(ultimoDiaConComidas({ grupos: [{ grupo: 'fruta', diasSinComer: null }], exposiciones: [], semanas: [] }, '2026-10-17')).toBeNull()
  })
})
