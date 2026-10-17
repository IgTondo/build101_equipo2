import { describe, expect, it } from 'vitest'
import type { Nutrientes } from '../../shared/contratos.js'
import { type EntradaAlertas, alertas } from './alertas.js'
import { cero } from './calcular.js'

const sinSeñales: EntradaAlertas = {
  nombre: 'Tomás',
  datos: { alertas: [], dieta: 'ninguna' },
  aceptadas: 14,
  segurasPerdidas: [],
  grupos: [
    { grupo: 'fruta', diasSinComer: 1 },
    { grupo: 'verdura', diasSinComer: 2 },
    { grupo: 'lacteo', diasSinComer: 0 },
    { grupo: 'proteina', diasSinComer: 0 },
  ],
  diasDeHistorial: 20,
  coberturaSemana: { ...cero(), vitamina_c_mg: 0.8 } as Nutrientes,
  diasRegistradosSemana: 7,
  conductasSemana: [['tranquilo'], ['se_levanto']],
  atragantamientos: 0,
}
const tipos = (e: Partial<EntradaAlertas>) => alertas({ ...sinSeñales, ...e }).map((a) => a.tipo)

describe('señales de alerta (§10.4)', () => {
  it('sin señales, no hay alertas', () => {
    expect(tipos({})).toEqual([])
  })

  it('tos o atragantamiento: desde la primera vez, derivando a fonoaudiología', () => {
    const [a] = alertas({ ...sinSeñales, atragantamientos: 1 })
    expect(a?.tipo).toBe('atragantamiento')
    expect(a?.texto).toContain('fonoaudiología')
  })

  it('arcadas o vómitos: en 2 o más comidas de la semana', () => {
    expect(tipos({ conductasSemana: [['arcadas']] })).toEqual([])
    expect(tipos({ conductasSemana: [['arcadas'], ['tranquilo'], ['arcadas', 'angustia']] })).toEqual(['arcadas'])
  })

  it('repertorio chico: menos de 10 preparaciones, o "menos de 15 alimentos" declarado', () => {
    expect(tipos({ aceptadas: 6 })).toEqual(['repertorio_chico'])
    expect(alertas({ ...sinSeñales, aceptadas: 6 })[0]?.texto).toBe(
      'Tomás come pocos alimentos distintos. Vale la pena comentarlo con su pediatra o nutricionista.',
    )
    expect(tipos({ datos: { alertas: ['menos_15_alimentos'], dieta: 'ninguna' } })).toEqual(['repertorio_chico', 'declarada'])
  })

  it('grupo ausente: ni frutas ni verduras en 7 días, pero no con menos de 7 días de historial', () => {
    const grupos: EntradaAlertas['grupos'] = [
      { grupo: 'fruta', diasSinComer: 9 },
      { grupo: 'verdura', diasSinComer: null },
      { grupo: 'lacteo', diasSinComer: 0 },
      { grupo: 'proteina', diasSinComer: 8 },
    ]
    expect(tipos({ grupos })).toEqual(['grupo_ausente', 'grupo_ausente'])
    expect(tipos({ grupos, diasDeHistorial: 5 })).toEqual([])
  })

  it('sin vitamina C: cobertura semanal < 30%, con al menos 3 días registrados', () => {
    const baja = { ...cero(), vitamina_c_mg: 0.2 } as Nutrientes
    expect(tipos({ coberturaSemana: baja })).toEqual(['sin_vitamina_c'])
    expect(tipos({ coberturaSemana: baja, diasRegistradosSemana: 2 })).toEqual([])
  })

  it('repertorio que baja, dieta de eliminación y señales declaradas', () => {
    expect(alertas({ ...sinSeñales, segurasPerdidas: ['Papas fritas'] })[0]?.texto).toContain('Dejó de comer papas fritas')
    expect(tipos({ datos: { alertas: [], dieta: 'sin_gluten_caseina' } })).toEqual(['dieta_eliminacion'])
    expect(alertas({ ...sinSeñales, datos: { alertas: ['bajo_peso', 'arcadas_vomitos'], dieta: 'ninguna' } })[0]?.texto).toBe(
      'En el perfil marcaste bajo peso y arcadas o vómitos frecuentes. Recomendamos consultar a un profesional.',
    )
  })
})
