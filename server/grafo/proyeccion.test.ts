// proyeccion.ts: lo que no es del catálogo es de cada chico (`${ninoId}|${id}`), con sus atributos e ingredientes.
import { describe, expect, it } from 'vitest'
import type { Atributos, PerfilBorrador } from '../../shared/contratos.js'
import { calcularEstado } from '../aprendizaje/estado.js'
import { catalogoPrueba, comidasSinteticas, sintetico } from '../datos/prueba/catalogos.js'
import { paresAfinidad } from '../ia/afinidades.js'
import { alimentos } from '../ia/catalogo.js'
import { idPreparacion, proyectarCatalogo, proyectarComida, proyectarConocimiento } from './proyeccion.js'

const catalogo = catalogoPrueba()
const ids = new Set(catalogo.keys())
const SUSHI: Atributos = { textura: 'blando', forma: 'redondo', color: 'blanco', sabor: 'salado', temperatura: 'frio', presentacion: 'separado', grupo: 'cereal_almidon', coccion: 'hervido' }
const borrador: PerfilBorrador = {
  acepta: [
    { nombre: 'Sushi', preparacionId: null, atributos: SUSHI, ingredientes: [{ alimentoId: 'arroz', gramos: 80 }], momentos: ['almuerzo', 'cena'] },
    { nombre: 'Papas fritas', preparacionId: 'papas_fritas_baston', atributos: {} },
  ],
  rechaza: [{ nombre: 'Repollo', preparacionId: null, motivo: 'sabor_olor', atributos: { grupo: 'verdura' } }],
  reglas: [],
}

describe('proyectarConocimiento: preparaciones propias de cada chico', () => {
  const p = proyectarConocimiento('rosario', calcularEstado({ borrador }, [], catalogo), ids)

  it('lo que no es del catálogo va con id `${ninoId}|${id}` y ninoId; lo del catálogo es compartido', () => {
    expect(idPreparacion('rosario', 'sushi', ids)).toBe('rosario|sushi')
    expect(idPreparacion('rosario', 'papas_fritas_baston', ids)).toBe('papas_fritas_baston')
    const sushi = p.nodos.find((n) => n.label === 'Preparacion' && n.id === 'rosario|sushi')
    expect(sushi?.ninoId).toBe('rosario')
    expect(sushi?.props).toMatchObject({ nombre: 'Sushi', catalogo: false, ninoId: 'rosario', prepId: 'sushi', momentos: ['almuerzo', 'cena'] })
    expect(p.nodos.some((n) => n.label === 'Preparacion' && n.id === 'sushi')).toBe(false)
    const papas = p.nodos.find((n) => n.id === 'papas_fritas_baston')
    expect(papas?.ninoId).toBeNull()
  })

  it('ACEPTA y RECHAZA apuntan al nodo propio', () => {
    const estado = (id: string) => p.aristas.find((a) => a.hasta.id === id && (a.tipo === 'ACEPTA' || a.tipo === 'RECHAZA'))?.tipo
    expect(estado('rosario|sushi')).toBe('ACEPTA')
    expect(estado('rosario|repollo')).toBe('RECHAZA')
    expect(estado('papas_fritas_baston')).toBe('ACEPTA')
  })

  it('las propias llevan sus atributos (TIENE) e ingredientes (CONTIENE), con el ninoId (se borran y reescriben con el chico)', () => {
    const tiene = p.aristas.filter((a) => a.tipo === 'TIENE' && a.desde.id === 'rosario|sushi')
    expect(tiene.map((a) => a.hasta.id).sort()).toEqual(Object.entries(SUSHI).map(([k, v]) => `${k}:${v}`).sort())
    expect(tiene.every((a) => a.ninoId === 'rosario')).toBe(true)
    const contiene = p.aristas.filter((a) => a.tipo === 'CONTIENE' && a.desde.id === 'rosario|sushi')
    expect(contiene).toEqual([expect.objectContaining({ hasta: { label: 'Ingrediente', id: 'arroz' }, props: { gramos: 80 }, ninoId: 'rosario' })])
    expect(p.aristas.filter((a) => a.tipo === 'TIENE' && a.desde.id === 'rosario|repollo').map((a) => a.hasta.id)).toEqual(['grupo:verdura'])
    // El catálogo no se reescribe por chico (sus TIENE los pone el seed)
    expect(p.aristas.some((a) => a.tipo === 'TIENE' && a.desde.id === 'papas_fritas_baston')).toBe(false)
  })

  it('dos chicos con el mismo nombre no comparten el nodo', () => {
    const otro = proyectarConocimiento('lucia', calcularEstado({ borrador }, [], catalogo), ids)
    expect(otro.nodos.some((n) => n.id === 'lucia|sushi')).toBe(true)
    expect(otro.nodos.some((n) => n.id === 'rosario|sushi')).toBe(false)
  })
})

describe('proyectarComida', () => {
  it('el ítem fuera del catálogo apunta (ES) al nodo propio del chico y la comida no escribe TIENE compartidos', () => {
    const s = sintetico('tomas')
    const [c] = comidasSinteticas(s)
    if (!c) throw new Error('Falta la primera comida')
    const it0 = c.items[0]
    if (!it0) throw new Error('Falta el primer ítem')
    const comida = { ...c, items: [{ ...it0, preparacionId: 'sushi', nombre: 'Sushi' }] }
    const p = proyectarComida(comida, ids)
    const es = p.aristas.find((a) => a.tipo === 'ES')
    expect(es?.hasta.id).toBe(`${c.ninoId}|sushi`)
    expect(p.nodos.find((n) => n.id === `${c.ninoId}|sushi`)?.ninoId).toBe(c.ninoId)
    expect(p.aristas.some((a) => a.tipo === 'TIENE')).toBe(false)
    // Lo del catálogo sigue apuntando al compartido
    const cat = proyectarComida(c, ids).aristas.find((a) => a.tipo === 'ES')
    expect(cat?.hasta.id).toBe(it0.preparacionId)
  })
})

// v5.10
describe('proyectarCatalogo: COMBINA entre ingredientes (data/afinidades.json)', () => {
  const combina = (p: ReturnType<typeof proyectarCatalogo>) => p.aristas.filter((a) => a.tipo === 'COMBINA')

  it('una arista por par, de a hacia b con a < b, solo entre alimentos del catálogo y sin un alimento consigo mismo', () => {
    const p = proyectarCatalogo([], alimentos(), [
      { a: 'zanahoria', b: 'papa', n: 700, afinidad: 0.3 },
      { a: 'papa', b: 'zanahoria', n: 700, afinidad: 0.3 },
      { a: 'papa', b: 'no_existe', n: 9, afinidad: 0.5 },
      { a: 'papa', b: 'papa', n: 9, afinidad: 1 },
    ])
    expect(combina(p)).toEqual([
      { tipo: 'COMBINA', desde: { label: 'Ingrediente', id: 'papa' }, hasta: { label: 'Ingrediente', id: 'zanahoria' }, props: { afinidad: 0.3, n: 700 }, ninoId: null },
    ])
  })

  it('sin afinidades no hay COMBINA; con las reales, la mitad de los pares (vienen en las dos direcciones)', () => {
    expect(combina(proyectarCatalogo([], alimentos()))).toEqual([])
    expect(combina(proyectarCatalogo([], alimentos(), paresAfinidad()))).toHaveLength(paresAfinidad().length / 2)
  })
})
