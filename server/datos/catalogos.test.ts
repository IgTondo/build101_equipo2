// El catálogo de preparaciones (B11) tiene que estar alineado con el de alimentos (A3) y con el vocabulario de §5.
import { describe, expect, it } from 'vitest'
import { MOMENTO, type Alimento, type Momento, type PreparacionCatalogo } from '../../shared/contratos.js'
import { leerJSON } from './archivos.js'
import { ATRIBUTOS_VOCABULARIO } from './validar.js'

const preparaciones = leerJSON<PreparacionCatalogo[]>('data/preparaciones.json') ?? []
const alimentos = leerJSON<Alimento[]>('data/alimentos.json')

describe('data/preparaciones.json (B11)', () => {
  it('tiene entre 50 y 60 preparaciones con ids únicos', () => {
    expect(preparaciones.length).toBeGreaterThanOrEqual(50)
    expect(preparaciones.length).toBeLessThanOrEqual(60)
    expect(new Set(preparaciones.map((p) => p.id)).size).toBe(preparaciones.length)
  })

  it('los atributos (con la cocción) son del vocabulario cerrado', () => {
    for (const p of preparaciones) {
      for (const [tipo, valores] of Object.entries(ATRIBUTOS_VOCABULARIO)) {
        expect(valores as readonly string[], `${p.id}.${tipo}`).toContain(p.atributos[tipo as keyof typeof ATRIBUTOS_VOCABULARIO])
      }
    }
  })

  it('cada versión fortificada apunta a una preparación que existe y tiene sus mismos atributos', () => {
    const porId = new Map(preparaciones.map((p) => [p.id, p]))
    for (const p of preparaciones.filter((x) => x.fortificadaDe)) {
      const original = porId.get(p.fortificadaDe ?? '')
      expect(original, p.id).toBeDefined()
      expect(p.atributos, p.id).toEqual(original?.atributos)
    }
  })

  it('(v5.2) cada preparación dice para qué comidas va, y la fortificada va a las mismas que la original', () => {
    const porId = new Map(preparaciones.map((p) => [p.id, p]))
    for (const p of preparaciones) {
      expect(p.momentos?.length, p.id).toBeGreaterThan(0)
      for (const m of p.momentos ?? []) expect(MOMENTO as readonly string[], p.id).toContain(m)
      if (p.fortificadaDe) expect(p.momentos, p.id).toEqual(porId.get(p.fortificadaDe)?.momentos)
    }
    const para = (m: Momento) => preparaciones.filter((p) => p.momentos?.includes(m)).map((p) => p.id)
    // Lo de plato no va al desayuno; lo dulce y bebible no va a la cena
    for (const id of ['milanesa_carne_horno', 'papas_fritas_baston', 'bastones_queso_horno', 'nuggets_pollo_horno', 'pure_papa']) expect(para('desayuno'), id).not.toContain(id)
    for (const id of ['leche_chocolatada', 'yogur_vainilla', 'yogur_bebible', 'licuado_banana_leche', 'arroz_con_leche']) expect(para('cena'), id).not.toContain(id)
  })

  it.skipIf(!alimentos)('cada alimentoId existe en data/alimentos.json (A3)', () => {
    const ids = new Set((alimentos ?? []).map((a) => a.id))
    const faltan = [...new Set(preparaciones.flatMap((p) => p.ingredientes.map((i) => i.alimentoId)))].filter((id) => !ids.has(id))
    expect(faltan).toEqual([])
  })
})
