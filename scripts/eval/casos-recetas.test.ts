// Los casos de la eval de recetas (§11.3): 3 perfiles × 4 nutrientes, y cada candidato pasa la validación de la receta
// (el conteo de cambios, la presentación, las reglas y el alérgeno del ingrediente principal).
import { describe, expect, it } from 'vitest'
import { preparacionCatalogo } from '../../server/ia/receta.js'
import { validarCandidato } from '../../server/validacion/receta.js'
import { NUTRIENTES_EVAL, leerCasosRecetas } from './casos-recetas.js'

const { casos, perfiles, preparaciones } = leerCasosRecetas()
const puente = new Map(preparaciones.map((p) => [p.id, p]))
const prep = (id: string) => preparacionCatalogo(id) ?? puente.get(id)

describe('eval/recetas/casos.json', () => {
  it('3 perfiles con sus alergias × 4 nutrientes = 12 casos', () => {
    expect(perfiles.map((p) => [p.ninoId, p.datos.alergias])).toEqual([['tomas', ['huevo']], ['lucia', []], ['bruno', ['leche', 'gluten']]])
    expect(casos.map((c) => c.id)).toEqual(perfiles.flatMap((p) => NUTRIENTES_EVAL.map((n) => `${p.ninoId}-${n}`)))
    expect(casos.every((c) => c.evidencia.nutriente === c.nutriente)).toBe(true)
  })

  it('Tomás y Lucía salen de evidenciaDe() de B; Bruno, armado', () => {
    expect(casos.filter((c) => c.fuente === 'evidenciaDe').map((c) => c.ninoId)).toEqual([...Array(4).fill('tomas'), ...Array(4).fill('lucia')])
    expect(casos.filter((c) => c.fuente === 'armada').every((c) => c.ninoId === 'bruno' && c.evidencia.candidatos.length > 0)).toBe(true)
  })

  it.each(casos.flatMap((c) => c.evidencia.candidatos.map((x) => [c.id, x.preparacionId, c, x] as const)))(
    '%s · %s pasa validarCandidato()', (_id, _prep, caso, x) => {
      const perfil = perfiles.find((p) => p.ninoId === caso.ninoId)
      const desde = prep(x.desdeId)
      const base = prep(x.preparacionId)
      expect(perfil && desde && base).toBeTruthy()
      if (!perfil || !desde || !base) return
      const presentacionesAceptadas = perfil.preparaciones.flatMap((p) => {
        const pr = p.estado === 'acepta' ? prep(p.id)?.atributos.presentacion : undefined
        return pr && pr !== 'separado' ? [pr] : []
      })
      const v = validarCandidato({ alergias: [...caso.evidencia.alergias, ...perfil.datos.alergias], reglas: perfil.reglas, desde, base, presentacionesAceptadas }, x)
      expect(v.problemas).toEqual([])
    },
  )
})
