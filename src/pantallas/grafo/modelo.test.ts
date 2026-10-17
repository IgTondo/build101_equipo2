import { describe, expect, it } from 'vitest'
import vista from '../../../fixtures/perfil-grafo.json'
import {
  type GrafoVista, armarModelo, contar, esGrafoVista, leerApoyo, lineasCortas, patronesDePrep, posicionesIniciales, prepsDePatron, suavizar,
} from './modelo'

const g = vista as GrafoVista

describe('modelo del grafo (C13)', () => {
  it('nunca dice "rechaza"', () => {
    expect(suavizar('Lo hervido lo rechaza (8 de 8)')).toBe('Lo hervido todavía no lo acepta (8 de 8)')
    expect(suavizar('Las verduras las rechaza')).toBe('Las verduras todavía no las acepta')
    expect(suavizar('Las texturas mixtas suelen rechazarse')).toBe('Las texturas mixtas suelen costar')
    const m = armarModelo(g)
    for (const n of m.nodos) expect(n.nombre + n.lineas.join(' ')).not.toMatch(/rechaz/i)
  })

  it('lee el apoyo del patrón y deja sin apoyo a los de la investigación', () => {
    expect(leerApoyo('Lo crocante lo acepta (26 de 31)')).toEqual({ n: 26, de: 31 })
    expect(leerApoyo('Lo que se toca lo rechaza (según la investigación)')).toBeNull()
  })

  it('parte los nombres en dos líneas cortas', () => {
    expect(lineasCortas('Papas al horno en bastones, crocantes')).toEqual(['Papas al horno', 'en bastones'])
    expect(lineasCortas('Milanesa de carne al horno (rebozada sin huevo)')).toEqual(['Milanesa de', 'carne al horno'])
    expect(lineasCortas('Una preparación con un nombre larguísimo de verdad')).toHaveLength(2)
    expect(lineasCortas('Una preparación con un nombre larguísimo de verdad')[1]).toMatch(/…$/)
  })

  it('arma el grafo de la muestra (sint-tomas)', () => {
    expect(esGrafoVista(g)).toBe(true)
    expect(esGrafoVista({ ninoId: 'tomas' })).toBe(false)
    const m = armarModelo(g)
    expect(m.nino?.nombre).toBe('Tomás')
    expect(contar(m)).toMatchObject({ acepta: 6, enProceso: 13, todaviaNo: 0, patrones: 15 })
    expect(m.aristas.every((a) => a.fuerza >= 0 && a.fuerza <= 1)).toBe(true)
    const crocante = m.porId.get('atr:textura:crocante')!
    expect(crocante.nombre).toBe('crocante')
    expect(crocante.categoria).toBe('textura')
  })

  it('RECHAZA se muestra como "todavía no"', () => {
    const m = armarModelo({
      motor: 'mongo',
      nodos: [{ id: 'nino:x', tipo: 'Nino', nombre: 'X', props: {} }, { id: 'prep:b', tipo: 'Preparacion', nombre: 'Brócoli', props: { estado: 'RECHAZA', veces: 11, puntaje: 0.1 } }],
      aristas: [{ desde: 'nino:x', hasta: 'prep:b', tipo: 'RECHAZA', props: { puntaje: 0.1 } }],
    })
    expect(m.porId.get('prep:b')!.estado).toBe('todavia_no')
    expect(m.aristas[0]).toMatchObject({ tipo: 'estado', fuerza: 0.1 })
  })

  it('explica una preparación con sus patrones y un patrón con sus comidas', () => {
    const m = armarModelo(g)
    expect(patronesDePrep(m, 'prep:papas_fritas_baston').map((p) => p.nombre)).toContain('Lo crocante lo acepta')
    const hervido = m.nodos.find((n) => n.nombre === 'Lo hervido todavía no lo acepta')!
    expect(hervido.apoyo).toEqual({ n: 8, de: 8 })
    expect(prepsDePatron(m, hervido.id).map((p) => p.id)).toContain('prep:brocoli_hervido')
  })

  it('da posiciones de partida finitas para todos', () => {
    const m = armarModelo(g)
    const pos = posicionesIniciales(m)
    expect(pos.size).toBe(m.nodos.length)
    for (const p of pos.values()) expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true)
  })
})
