// El catálogo de preparaciones (B11) tiene que estar alineado con el de alimentos (A3) y con el vocabulario de §5.
import { describe, expect, it } from 'vitest'
import type { Alimento, PreparacionCatalogo } from '../../shared/contratos.js'
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

  it.skipIf(!alimentos)('cada alimentoId existe en data/alimentos.json (A3)', () => {
    const ids = new Set((alimentos ?? []).map((a) => a.id))
    const faltan = [...new Set(preparaciones.flatMap((p) => p.ingredientes.map((i) => i.alimentoId)))].filter((id) => !ids.has(id))
    expect(faltan).toEqual([])
  })
})
