// preparacionesConocidas (server/aprendizaje/estado.ts): catálogo → lo declarado (acepta Y rechaza) → lo observado,
// con atributos, ingredientes y momentos. Lo que razona el recomendador sale de acá (nunca de Neo4j).
import { describe, expect, it } from 'vitest'
import type { Atributos, PerfilBorrador } from '../../shared/contratos.js'
import { calcularEstado, preparacionesConocidas } from '../aprendizaje/estado.js'
import { catalogoPrueba } from './prueba/catalogos.js'
import type { ComidaDoc, ItemComida } from './tipos.js'

const catalogo = catalogoPrueba()
const SUSHI: Atributos = { textura: 'blando', forma: 'redondo', color: 'blanco', sabor: 'salado', temperatura: 'frio', presentacion: 'separado', grupo: 'cereal_almidon', coccion: 'hervido' }
const momentos = (m: Map<string, unknown>, id: string) => (m.get(id) as { momentos?: string[] } | undefined)?.momentos

const borrador = (b: Partial<PerfilBorrador>): PerfilBorrador => ({ acepta: [], rechaza: [], reglas: [], ...b })

function comida(id: string, momento: ComidaDoc['momento'], item: Partial<ItemComida>): ComidaDoc {
  return {
    _id: id, ninoId: 'n', dia: '2026-10-10', fechaISO: `2026-10-10T${id === 'c1' ? '12' : '20'}:00:00-03:00`, momento,
    analisis: { analisisId: id, sinComida: false, items: [], distribucion: { estado: 'separados', cantidadItems: 1, plato: 'playo' }, preguntas: [], modelo: '', ms: 0 },
    respuestas: [], respuestasPreguntas: [], conducta: [], distribucion: 'separados', plato: 'playo',
    items: [{
      idTmp: 'i1', preparacionId: 'sushi', nombre: 'Sushi', atributos: SUSHI, ingredientes: [{ alimentoId: 'arroz_blanco_cocido', gramos: 60 }],
      gramos: 60, porcion: 'mediana', cuanto: 'todo', fraccion: 1, o: 1, confianza: 0.9, nutrientes: {} as ItemComida['nutrientes'], sinDatos: [], ...item,
    }],
    nutrientes: {} as ComidaDoc['nutrientes'], creadoISO: '2026-10-10T00:00:00Z',
  }
}

describe('preparacionesConocidas: lo declarado', () => {
  it('lo que acepta fuera del catálogo, completo: con sus 8 atributos, ingredientes y momentos', () => {
    const b = borrador({
      acepta: [{ nombre: 'Sushi', preparacionId: null, atributos: SUSHI, ingredientes: [{ alimentoId: 'arroz_blanco_cocido', gramos: 80 }], momentos: ['cena', 'almuerzo'] }],
    })
    const sushi = preparacionesConocidas(b, [], catalogo).get('sushi')
    expect(sushi).toMatchObject({ id: 'sushi', nombre: 'Sushi', atributos: SUSHI, ingredientes: [{ alimentoId: 'arroz_blanco_cocido', gramos: 80 }] })
    expect(momentos(preparacionesConocidas(b, [], catalogo), 'sushi')).toEqual(['almuerzo', 'cena']) // en el orden de MOMENTO
  })

  it('incompleto (un documento viejo, sin ingredientes ni momentos): entra igual, sin inventar nada', () => {
    const b = borrador({ acepta: [{ nombre: 'Sushi', preparacionId: null, atributos: { temperatura: 'frio', grupo: 'proteina', coccion: 'crudo' } }] })
    const m = preparacionesConocidas(b, [], catalogo)
    expect(m.get('sushi')).toEqual({ id: 'sushi', nombre: 'Sushi', atributos: { temperatura: 'frio', grupo: 'proteina', coccion: 'crudo' }, ingredientes: [] })
  })

  it('lo que RECHAZA también entra (antes se perdía la señal negativa), con sus atributos', () => {
    const b = borrador({
      rechaza: [
        { nombre: 'Repollo', preparacionId: null, motivo: 'sabor_olor', atributos: { grupo: 'verdura', color: 'verde' }, ingredientes: [{ alimentoId: 'repollo', gramos: 50 }], momentos: ['almuerzo'] },
        { nombre: 'Sopa', preparacionId: null, motivo: 'textura' }, // viejo: sin atributos
      ],
    })
    const m = preparacionesConocidas(b, [], catalogo)
    expect(m.get('repollo')).toMatchObject({ atributos: { grupo: 'verdura', color: 'verde' }, ingredientes: [{ alimentoId: 'repollo', gramos: 50 }] })
    expect(m.get('sopa')).toEqual({ id: 'sopa', nombre: 'Sopa', atributos: {}, ingredientes: [] })
    // Y el estado inicial lo tiene como rechazado (la cadena lo ve como algo que conoce)
    expect(calcularEstado({ borrador: b }, [], catalogo).estados.get('repollo')?.estado).toBe('rechaza')
  })

  it('lo del catálogo conserva los atributos del catálogo (la convención), aunque el padre traiga otros', () => {
    const p = catalogo.get('papas_fritas_baston')
    if (!p) throw new Error('Falta papas_fritas_baston en el catálogo')
    const b = borrador({ acepta: [{ nombre: 'Papitas', preparacionId: p.id, atributos: { color: 'rojo' } }] })
    const m = preparacionesConocidas(b, [], catalogo)
    expect(m.get(p.id)).toMatchObject({ nombre: p.nombre, atributos: p.atributos, ingredientes: p.ingredientes })
    expect(momentos(m, p.id)).toEqual(p.momentos)
  })
})

describe('preparacionesConocidas: lo observado', () => {
  it('manda sobre lo declarado y sus momentos son las comidas en las que se vio, sumadas a las declaradas', () => {
    const b = borrador({ acepta: [{ nombre: 'Sushi', preparacionId: null, atributos: { temperatura: 'frio' }, momentos: ['cena'] }] })
    const m = preparacionesConocidas(b, [comida('c1', 'almuerzo', {}), comida('c2', 'merienda', {})], catalogo)
    expect(m.get('sushi')).toMatchObject({ atributos: SUSHI, ingredientes: [{ alimentoId: 'arroz_blanco_cocido', gramos: 60 }] })
    expect(momentos(m, 'sushi')).toEqual(['almuerzo', 'merienda', 'cena'])
  })

  it('lo observado sin ingredientes no borra los declarados', () => {
    const b = borrador({ acepta: [{ nombre: 'Sushi', preparacionId: null, atributos: SUSHI, ingredientes: [{ alimentoId: 'arroz_blanco_cocido', gramos: 80 }] }] })
    const m = preparacionesConocidas(b, [comida('c1', 'cena', { ingredientes: [] })], catalogo)
    expect(m.get('sushi')?.ingredientes).toEqual([{ alimentoId: 'arroz_blanco_cocido', gramos: 80 }])
    expect(momentos(m, 'sushi')).toEqual(['cena'])
  })

  it('lo del catálogo observado no cambia: siguen sus atributos y sus momentos', () => {
    const p = catalogo.get('papas_fritas_baston')
    if (!p) throw new Error('Falta papas_fritas_baston en el catálogo')
    const m = preparacionesConocidas(borrador({}), [comida('c1', 'desayuno', { preparacionId: p.id, atributos: { ...p.atributos, color: 'rojo' } })], catalogo)
    expect(m.get(p.id)?.atributos).toEqual(p.atributos)
    expect(momentos(m, p.id)).toEqual(p.momentos)
  })
})
