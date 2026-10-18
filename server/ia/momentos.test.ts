// v5.10 · En qué comidas va cada alimento y qué es un plato principal (server/ia/momentos.ts), con los catálogos reales:
// nunca ravioles en el desayuno, nunca la pizza de pan del desayuno ni al lado de otro principal. v5.10 · Por franja:
// desayuno y merienda (y colación) o almuerzo y cena, que no se mezclan; la fruta entera de postre va en las dos.
import { describe, expect, it } from 'vitest'
import type { PreparacionCatalogo } from '../../shared/contratos.js'
import { preparacionesCatalogo } from '../datos/catalogos.js'
import { MOMENTO } from '../../shared/contratos.js'
import { esCerealOPan, esFrutaEntera, esPlatoPrincipal, franjaDe, franjaDePreparacion, franjaPorTipo, franjasPorGrupo, momentosDeAlimento, vaEnLaComida } from './momentos.js'

const catalogo = preparacionesCatalogo()
const prep = (id: string) => catalogo.get(id)!
const plato = (nombre: string, grupo: PreparacionCatalogo['atributos']['grupo'], ingredientes: [string, number][], sabor: PreparacionCatalogo['atributos']['sabor'] = 'salado'): PreparacionCatalogo => ({
  id: 'nuevo_x', nombre,
  atributos: { textura: 'blando', forma: 'trozos', color: 'amarillo', sabor, temperatura: 'caliente', presentacion: 'separado', grupo },
  ingredientes: ingredientes.map(([alimentoId, gramos]) => ({ alimentoId, gramos })),
})

const DM = ['desayuno', 'merienda', 'colacion']
const AC = ['almuerzo', 'cena']

describe('momentosDeAlimento (por franja)', () => {
  it('la colación va con el desayuno y la merienda', () => {
    expect(MOMENTO.map(franjaDe)).toEqual(['desayuno_merienda', 'almuerzo_cena', 'desayuno_merienda', 'almuerzo_cena', 'desayuno_merienda'])
  })

  it('lo que es el principal de alguna preparación va en la franja de esas preparaciones', () => {
    expect(momentosDeAlimento('leche')).toEqual(DM)
    expect(momentosDeAlimento('pan_blanco')).toEqual(DM)
    expect(momentosDeAlimento('papa')).toEqual(AC)
    expect(momentosDeAlimento('prepizza')).toEqual(AC)
    expect(momentosDeAlimento('fideos')).toEqual(AC)
  })

  it('lo demás, por grupo y familia y sin "a toda hora": panes, cereales, leche, yogur y frutas, desayuno y merienda; lo demás, almuerzo y cena', () => {
    for (const id of ['pan_arabe', 'avena', 'galletas_arroz', 'yogur_griego', 'leche_descremada', 'pera', 'mango']) expect(momentosDeAlimento(id), id).toEqual(DM)
    for (const id of ['ravioles', 'noquis', 'arroz_integral', 'carne_cerdo', 'garbanzos', 'espinaca', 'huevo', 'jamon', 'ricota']) expect(momentosDeAlimento(id), id).toEqual(AC)
    expect(franjasPorGrupo('aceite_oliva')).toHaveLength(2) // el grupo otro acompaña: nunca es el plato
  })

  it('sumados: el queso, el huevo y el jamón en las dos (el tostado de jamón y queso de la merienda); lo demás, en su franja', () => {
    for (const id of ['queso_muzzarella', 'ricota', 'huevo', 'jamon']) {
      expect(vaEnLaComida(id, 'merienda', 'sumado'), id).toBe(true)
      expect(vaEnLaComida(id, 'cena', 'sumado'), id).toBe(true)
    }
    expect(vaEnLaComida('queso_muzzarella', 'desayuno')).toBe(false) // como el principal, el de los bastones de queso
    expect(vaEnLaComida('lentejas', 'desayuno', 'sumado')).toBe(false)
    expect(vaEnLaComida('ravioles', 'desayuno', 'sumado')).toBe(false)
    for (const id of ['leche', 'yogur', 'pan_blanco']) expect(vaEnLaComida(id, 'cena', 'sumado'), id).toBe(false)
    expect(vaEnLaComida('ravioles', 'cena')).toBe(true)
    expect(vaEnLaComida('ravioles', undefined)).toBe(true)
  })

  it('la única excepción: la fruta entera de postre o al lado (rol verdura_fruta) va en las dos; un jugo, no', () => {
    expect(vaEnLaComida('banana', 'cena')).toBe(false)
    expect(vaEnLaComida('banana', 'cena', 'principal', undefined, 'verdura_fruta')).toBe(true)
    expect(vaEnLaComida('pera', 'almuerzo', 'principal', undefined, 'verdura_fruta')).toBe(true)
    expect(vaEnLaComida('jugo_naranja', 'cena', 'principal', undefined, 'verdura_fruta')).toBe(false)
    expect(vaEnLaComida('banana', 'cena', 'principal', undefined, 'principal')).toBe(false)
    expect([...catalogo.values()].filter(esFrutaEntera).map((p) => p.id).sort()).toEqual(['banana_pisada', 'frutilla_pisada', 'manzana_bastones'])
  })
})

describe('franjaDePreparacion: cada preparación es de una sola franja', () => {
  it('en el catálogo entero, cada preparación es de una sola franja, y su tipo dice la misma', () => {
    const porFranja = { desayuno_merienda: 0, almuerzo_cena: 0 }
    for (const p of catalogo.values()) {
      const franjas = new Set((p.momentos ?? []).map(franjaDe))
      expect(franjas.size, p.id).toBe(1)
      expect(franjaDePreparacion(p), p.id).toBe([...franjas][0])
      expect(franjaPorTipo(p), p.id).toBe([...franjas][0])
      porFranja[franjaDePreparacion(p)]++
    }
    expect(porFranja).toEqual({ desayuno_merienda: 19, almuerzo_cena: 38 })
  })

  it('lo que no es del catálogo, por su tipo y no por la hora: su pizza de la merienda sigue siendo de almuerzo y cena', () => {
    const pizzaDeLaMerienda = { ...prep('pizza_muzzarella'), id: 'pizza_de_la_esquina', nombre: 'Pizza de la esquina', momentos: ['merienda' as const] }
    expect(franjaDePreparacion(pizzaDeLaMerienda)).toBe('almuerzo_cena')
    expect(franjaDePreparacion(plato('Milanesa de pollo al horno', 'proteina', [['pollo', 110], ['pan_rallado', 25]]))).toBe('almuerzo_cena')
    expect(franjaDePreparacion(plato('Puré de calabaza', 'verdura', [['zapallo', 150], ['manteca', 5]]))).toBe('almuerzo_cena')
    expect(franjaDePreparacion(plato('Licuado de mango y leche', 'lacteo', [['leche', 150], ['mango', 80]]))).toBe('desayuno_merienda')
    expect(franjaDePreparacion(plato('Tostadas de pan árabe con queso', 'cereal_almidon', [['pan_arabe', 50], ['queso_muzzarella', 20]]))).toBe('desayuno_merienda')
    expect(franjaDePreparacion(plato('Yogur griego con pera', 'lacteo', [['yogur_griego', 120], ['pera', 60]]))).toBe('desayuno_merienda')
    expect(franjaDePreparacion(plato('Bastones de pera', 'fruta', [['pera', 120]]))).toBe('desayuno_merienda')
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
