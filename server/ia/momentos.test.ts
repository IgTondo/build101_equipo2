// v5.10 · En qué comidas va cada alimento y qué es un plato principal (server/ia/momentos.ts), con los catálogos reales:
// nunca ravioles en el desayuno, nunca la pizza de pan del desayuno ni al lado de otro principal.
import { describe, expect, it } from 'vitest'
import type { PreparacionCatalogo } from '../../shared/contratos.js'
import { preparacionesCatalogo } from '../datos/catalogos.js'
import { esCerealOPan, esPlatoPrincipal, momentosDeAlimento, momentosPorGrupo, vaEnLaComida } from './momentos.js'

const catalogo = preparacionesCatalogo()
const prep = (id: string) => catalogo.get(id)!
const plato = (nombre: string, grupo: PreparacionCatalogo['atributos']['grupo'], ingredientes: [string, number][], sabor: PreparacionCatalogo['atributos']['sabor'] = 'salado'): PreparacionCatalogo => ({
  id: 'nuevo_x', nombre,
  atributos: { textura: 'blando', forma: 'trozos', color: 'amarillo', sabor, temperatura: 'caliente', presentacion: 'separado', grupo },
  ingredientes: ingredientes.map(([alimentoId, gramos]) => ({ alimentoId, gramos })),
})

describe('momentosDeAlimento', () => {
  it('lo que es el principal de alguna preparación va en las comidas de esas preparaciones', () => {
    expect(momentosDeAlimento('leche')).toEqual(['desayuno', 'merienda', 'colacion'])
    expect(momentosDeAlimento('pan_blanco')).toEqual(['desayuno', 'merienda'])
    expect(momentosDeAlimento('papa')).toEqual(['almuerzo', 'cena'])
    expect(momentosDeAlimento('prepizza')).toEqual(['almuerzo', 'cena'])
    expect(momentosDeAlimento('fideos')).toEqual(['almuerzo', 'cena'])
  })

  it('lo demás, por grupo y familia: frutas y lácteos a toda hora; panes y cereales también; pastas, carnes y verduras, almuerzo y cena', () => {
    expect(momentosDeAlimento('ravioles')).toEqual(['almuerzo', 'cena'])
    expect(momentosDeAlimento('noquis')).toEqual(['almuerzo', 'cena'])
    expect(momentosDeAlimento('pera')).toEqual(['desayuno', 'almuerzo', 'merienda', 'cena', 'colacion'])
    expect(momentosDeAlimento('ricota')).toHaveLength(5)
    expect(momentosDeAlimento('avena')).toHaveLength(5)
    expect(momentosDeAlimento('pan_arabe')).toHaveLength(5)
    expect(momentosDeAlimento('huevo')).toHaveLength(5)
    expect(momentosDeAlimento('carne_cerdo')).toEqual(['almuerzo', 'cena'])
    expect(momentosDeAlimento('garbanzos')).toEqual(['almuerzo', 'cena'])
    expect(momentosDeAlimento('espinaca')).toEqual(['almuerzo', 'cena'])
    expect(momentosDeAlimento('arroz_integral')).toEqual(['almuerzo', 'cena'])
    expect(momentosPorGrupo('aceite_oliva')).toHaveLength(5)
  })

  it('sumado a otro plato vale también su grupo: queso en sus tostadas sí, lentejas en su yogur no', () => {
    expect(vaEnLaComida('queso_muzzarella', 'desayuno')).toBe(false) // el principal de los bastones de queso
    expect(vaEnLaComida('queso_muzzarella', 'desayuno', 'sumado')).toBe(true)
    expect(vaEnLaComida('lentejas', 'desayuno', 'sumado')).toBe(false)
    expect(vaEnLaComida('ravioles', 'desayuno', 'sumado')).toBe(false)
    expect(vaEnLaComida('ravioles', 'cena')).toBe(true)
    expect(vaEnLaComida('ravioles', undefined)).toBe(true)
  })
})

describe('esPlatoPrincipal y esCerealOPan', () => {
  it('del catálogo: pastas, pizza, milanesas, nuggets, hamburguesas, guisos y carnes sí; papas, purés, bastones de queso y tostadas no', () => {
    for (const id of ['fideos_con_salsa', 'fideos_manteca_queso', 'pizza_muzzarella', 'milanesa_carne_horno', 'milanesa_lentejas_horno', 'nuggets_pollo_horno', 'hamburguesa_casera', 'lentejas_guisadas', 'pollo_plancha', 'arroz_con_pollo', 'croquetas_atun_fritas']) {
      expect(esPlatoPrincipal(prep(id)), id).toBe(true)
    }
    for (const id of ['papas_fritas_baston', 'pure_papa', 'pure_zapallo', 'bastones_queso_horno', 'tostadas_queso', 'galletitas_agua', 'copos_maiz', 'yogur_vainilla', 'banana_pisada', 'brocoli_hervido']) {
      expect(esPlatoPrincipal(prep(id)), id).toBe(false)
    }
  })

  it('un plato nuevo, por lo que pesa más o por su nombre; un dulce no', () => {
    expect(esPlatoPrincipal(plato('Ravioles de ricota con salsa', 'cereal_almidon', [['ravioles', 150], ['salsa_tomate', 50]]))).toBe(true)
    expect(esPlatoPrincipal(plato('Milanesas de berenjena al horno', 'verdura', [['berenjena', 120], ['pan_rallado', 20]]))).toBe(true)
    expect(esPlatoPrincipal(plato('Tarta de zapallito', 'verdura', [['zapallito', 120], ['harina_trigo', 40], ['queso_rallado', 15]]))).toBe(true)
    expect(esPlatoPrincipal(plato('Medallones de ricota dorados', 'lacteo', [['ricota', 100], ['pan_rallado', 20]]))).toBe(true)
    expect(esPlatoPrincipal(plato('Ñoquis de papa con manteca', 'cereal_almidon', [['papa', 150], ['harina_trigo', 40]]))).toBe(true)
    expect(esPlatoPrincipal(plato('Tortilla de papas al horno', 'cereal_almidon', [['papa', 150], ['huevo', 60]]))).toBe(true)
    expect(esPlatoPrincipal(plato('Tarta de manzana', 'fruta', [['manzana', 120], ['harina_trigo', 40]], 'dulce'))).toBe(false)
    expect(esPlatoPrincipal(plato('Tortillas de trigo con queso', 'cereal_almidon', [['tortilla_trigo', 60], ['queso_muzzarella', 30]]))).toBe(false)
    expect(esPlatoPrincipal(plato('Bastones de boniato al horno', 'cereal_almidon', [['boniato', 120], ['aceite_girasol', 5]]))).toBe(false)
  })

  it('el cereal o pan del desayuno: pan, tostadas, galletitas o un cereal; nunca pizza ni pasta', () => {
    for (const id of ['tostadas', 'tostadas_queso', 'tostadas_pan_integral', 'galletitas_agua', 'galletitas_integrales', 'copos_maiz']) expect(esCerealOPan(prep(id)), id).toBe(true)
    for (const id of ['pizza_muzzarella', 'fideos_con_salsa', 'papas_fritas_baston', 'arroz_con_pollo', 'yogur_vainilla']) expect(esCerealOPan(prep(id)), id).toBe(false)
  })
})
