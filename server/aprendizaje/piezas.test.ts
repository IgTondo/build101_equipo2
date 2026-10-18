// Las piezas del motor por separado: aceptación, textos, cadena (un solo cambio), alergias y propagación.
import { describe, expect, it } from 'vitest'
import { alimentosPrueba, catalogoPrueba } from '../datos/prueba/catalogos.js'
import { resolverComida } from '../datos/resolver.js'
import { estadoDe, procesarHistorial } from './aceptacion.js'
import { type PrepConocida, cambios, esSegura, reglaQueViola } from './cadena.js'
import { propagar } from './propagacion.js'
import { textoBorrado } from './aprendi.js'
import { textoPatron } from './textos.js'

const catalogo = catalogoPrueba()
const alimentos = alimentosPrueba()
const prep = (id: string): PrepConocida => {
  const p = catalogo.get(id)
  if (!p) throw new Error(`No está en el catálogo: ${id}`)
  return p
}

describe('aceptación por preparación (§8)', () => {
  it('"rechaza" recién después de 10 exposiciones; antes queda en proceso', () => {
    expect(estadoDe(0.05, 9, null)).toBe('en_proceso')
    expect(estadoDe(0.05, 10, null)).toBe('rechaza')
    expect(estadoDe(0.7, 1, null)).toBe('en_proceso')
    expect(estadoDe(0.7, 2, null)).toBe('acepta')
  })

  it('lo que contó el padre: lo que come cuenta desde el principio; lo que rechaza, hasta que se ofrece', () => {
    expect(estadoDe(0.8, 0, 'acepta')).toBe('acepta')
    expect(estadoDe(0.1, 0, 'rechaza')).toBe('rechaza')
    expect(estadoDe(0.07, 1, 'rechaza')).toBe('en_proceso')
  })

  it('p ← p + 0,3·(o − p), ítem por ítem, y "junto a un seguro" se mira con el estado de antes de la comida', () => {
    const req = (dia: string, items: [string, 'todo' | 'nada'][]) => ({
      ninoId: 'x', dia, fechaISO: `${dia}T12:30:00-03:00`, momento: 'almuerzo' as const,
      analisis: {
        analisisId: dia, sinComida: false, preguntas: [], modelo: 'test', ms: 0,
        distribucion: { estado: 'separados' as const, cantidadItems: items.length, plato: 'playo' as const },
        items: items.map(([id], i) => ({
          idTmp: `i${i}`, preparacion: id, preparacionId: id, porcion: 'mediana' as const, caja: null, confianza: 1,
          atributos: prep(id).atributos as Required<PrepConocida['atributos']>,
          ingredientes: prep(id).ingredientes.map((g) => ({ alimentoId: g.alimentoId, gramosEst: g.gramos })),
        })),
      },
      respuestas: items.map(([, cuanto], i) => ({ itemIdTmp: `i${i}`, cuanto, porcion: 'mediana' as const })),
      respuestasPreguntas: [], conducta: [],
    })
    const comidas = [
      req('2026-10-01', [['bastones_queso_horno', 'nada'], ['papas_fritas_baston', 'todo']]),
      req('2026-10-02', [['bastones_queso_horno', 'todo']]),
    ].map((r, i) => resolverComida(r, { id: `c${i}`, creadoISO: r.fechaISO, alimentos, catalogo }))
    const borrador = { acepta: [{ nombre: 'Papas fritas', preparacionId: 'papas_fritas_baston', atributos: {} }], rechaza: [], reglas: [] }
    const { estados, observaciones } = procesarHistorial(comidas, borrador)
    const queso = estados.get('bastones_queso_horno')
    expect(queso?.p).toBeCloseTo(0.5 + 0.3 * (0.05 - 0.5) + 0.3 * (1 - (0.5 + 0.3 * (0.05 - 0.5))))
    expect(queso?.pasos).toEqual(['nada', 'todo'])
    expect(observaciones.map((o) => o.contexto.juntoASeguro)).toEqual([true, false, false])
  })
})

describe('textos de los patrones (sin LLM)', () => {
  it('arma frases legibles con el pronombre correcto', () => {
    expect(textoPatron([{ tipo: 'textura', valor: 'crocante' }, { tipo: 'presentacion', valor: 'separado' }], 'acepta', 5, 5)).toBe(
      'Lo crocante servido separado lo acepta (5 de 5)',
    )
    expect(textoPatron([{ tipo: 'forma', valor: 'pure' }, { tipo: 'color', valor: 'verde' }], 'acepta', 3, 3)).toBe('Lo verde en puré lo acepta (3 de 3)')
    expect(textoPatron([{ tipo: 'presentacion', valor: 'mezclado' }], 'rechaza', 3, 3)).toBe('Lo mezclado todavía no lo acepta (3 de 3)')
    expect(textoPatron([{ tipo: 'grupo', valor: 'verdura' }], 'rechaza')).toBe('Las verduras todavía no las acepta')
  })

  it('nunca dice "rechaza" (§9) y concuerda con los sujetos en plural', () => {
    expect(textoPatron([{ tipo: 'grupo', valor: 'cereal_almidon' }, { tipo: 'presentacion', valor: 'separado' }], 'acepta', 17, 20)).toBe(
      'Los cereales, panes y papas servidos separados los acepta (17 de 20)',
    )
    expect(textoPatron([{ tipo: 'grupo', valor: 'verdura' }, { tipo: 'coccion', valor: 'hervido' }], 'rechaza', 4, 4)).toBe(
      'Las verduras hervidas todavía no las acepta (4 de 4)',
    )
    expect(textoPatron([{ tipo: 'grupo', valor: 'fruta' }, { tipo: 'forma', valor: 'entero' }], 'rechaza')).toBe('Las frutas enteras todavía no las acepta')
    expect(textoPatron([{ tipo: 'grupo', valor: 'lacteo' }, { tipo: 'coccion', valor: 'listo' }], 'acepta')).toBe('Los lácteos como vienen los acepta')
    // Con un adjetivo el sujeto es "lo …": singular, aunque el grupo vaya después
    expect(textoPatron([{ tipo: 'textura', valor: 'crocante' }, { tipo: 'grupo', valor: 'cereal_almidon' }, { tipo: 'presentacion', valor: 'separado' }], 'acepta'))
      .toBe('Lo crocante servido separado entre los cereales, panes y papas lo acepta')
    expect(textoPatron([{ tipo: 'distribucion', valor: 'tocandose' }], 'rechaza')).toBe('Lo que se sirve cuando los alimentos se tocan todavía no lo acepta')
    expect(textoPatron([{ tipo: 'textura', valor: 'blando' }], 'rechaza', 6, 6)).not.toMatch(/rechaz/)
  })

  it('un "todavía no lo acepta" que se borra se cuenta en positivo y sin ambigüedad', () => {
    expect(textoBorrado([{ tipo: 'presentacion', valor: 'mezclado' }], 'Arroz con pollo', false)).toBe(
      'Lo mezclado ya no parece costarle tanto (esta vez comió arroz con pollo).',
    )
    expect(textoBorrado([{ tipo: 'grupo', valor: 'verdura' }], 'Brócoli hervido', false)).toBe(
      'Las verduras ya no parecen costarle tanto (esta vez comió brócoli hervido).',
    )
    expect(textoBorrado([{ tipo: 'distribucion', valor: 'tocandose' }], 'Milanesa de carne al horno (rebozada sin huevo)', true)).toBe(
      'Lo que se sirve cuando los alimentos se tocan no parece costarle, aunque a muchos chicos les cuesta (esta vez comió milanesa de carne al horno).',
    )
  })
})

describe('food chaining: un solo cambio (§8, cadena.ts)', () => {
  it('la cocción es una dimensión (v4): papas fritas → al horno en bastones es un cambio', () => {
    expect(cambios(prep('papas_fritas_baston'), prep('papas_horno_baston'))).toEqual(['coccion'])
  })

  it('bastones de queso horneados: dos cambios desde las fritas, uno desde las papas al horno', () => {
    expect(cambios(prep('papas_fritas_baston'), prep('bastones_queso_horno')).sort()).toEqual(['coccion', 'ingrediente'])
    expect(cambios(prep('papas_horno_baston'), prep('bastones_queso_horno'))).toEqual(['ingrediente'])
  })

  it('el color no cuenta aparte, y cambiar la textura (papas en cubos blandas) es un cambio de textura y forma', () => {
    expect(cambios(prep('papas_horno_baston'), prep('papas_horno_cubos')).sort()).toEqual(['forma', 'textura'])
    expect(cambios(prep('milanesa_carne_horno'), prep('milanesa_merluza_horno'))).toEqual(['ingrediente'])
  })

  it('alergias por código: la milanesa con huevo no es segura para Tomás, y lo que no está en la tabla tampoco', () => {
    expect(esSegura(prep('milanesa_carne_con_huevo'), ['huevo'], alimentos)).toBe(false)
    expect(esSegura(prep('milanesa_carne_horno'), ['huevo'], alimentos)).toBe(true)
    expect(esSegura({ ingredientes: [{ alimentoId: 'algo_raro', gramos: 10 }] }, ['huevo'], alimentos)).toBe(false)
    expect(esSegura({ ingredientes: [{ alimentoId: 'algo_raro', gramos: 10 }] }, [], alimentos)).toBe(true)
  })

  it('las reglas del padre filtran: "no come nada verde" saca el puré de arvejas', () => {
    const reglas = [{ texto: 'No come nada verde', condiciones: [{ tipo: 'color' as const, valor: 'verde' }], efecto: 'rechaza' as const }]
    expect(reglaQueViola(prep('pure_arvejas'), reglas)?.texto).toBe('No come nada verde')
    expect(reglaQueViola(prep('pure_zapallo'), reglas)).toBeNull()
  })
})

describe('propagación (PageRank personalizado)', () => {
  it('lo que comparte atributos con lo que acepta sube; lo que se parece a lo que rechaza baja', () => {
    const preps = ['papas_fritas_baston', 'tostadas', 'papa_hervida', 'bastones_queso_horno', 'pollo_desmenuzado'].map(prep)
    const puntajes = new Map([
      ['papas_fritas_baston', 0.95],
      ['tostadas', 0.9],
      ['papa_hervida', 0.05],
    ])
    const r = propagar(preps, puntajes)
    // Los bastones de queso comparten bastón, crocante y salado con las papas; el pollo desmenuzado, blando,
    // trozos y hervido con la papa hervida que rechazó
    expect(r.get('bastones_queso_horno') ?? 0).toBeGreaterThan(r.get('pollo_desmenuzado') ?? 0)
    expect(r.get('papa_hervida') ?? 0).toBeLessThan(0)
    const sinRechazo = propagar(preps, new Map([...puntajes].filter(([id]) => id !== 'papa_hervida')))
    expect(r.get('pollo_desmenuzado') ?? 0).toBeLessThan(sinRechazo.get('pollo_desmenuzado') ?? 0)
    // Normalizado sobre las que no son semilla positiva (las candidatas); lo que ya acepta puede pasar de 1
    for (const id of ['bastones_queso_horno', 'pollo_desmenuzado', 'papa_hervida']) expect(Math.abs(r.get(id) ?? 0)).toBeLessThanOrEqual(1 + 1e-9)
  })
})
