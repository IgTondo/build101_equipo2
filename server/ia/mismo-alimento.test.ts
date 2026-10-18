// verificarId() (v5.8) contra el catálogo real (data/preparaciones.json y data/alimentos.json): las trampas que el
// modelo cayó en la eval del 18/10 y los casos legítimos que no se pueden perder.
import { describe, expect, it } from 'vitest'
import type { Alergeno } from '../../shared/contratos.js'
import { alergiaQueChoca, verificarId } from './mismo-alimento.js'
import { preparaciones } from './perfil.js'

const prep = (id: string) => {
  const p = preparaciones().find((x) => x.id === id)
  if (!p) throw new Error(`no está ${id}`)
  return p
}
const pasa = (dicho: string, id: string, alergias: Alergeno[] = [], otras: string[] = []) => verificarId(dicho, prep(id), alergias, otras)

describe('verificarId', () => {
  it.each([
    ['milanesa de pollo al horno', 'milanesa_carne_horno', /pollo/],
    ['milanesas de soja', 'milanesa_lentejas_horno', /soja/],
    ['yogur bebible de frutilla', 'yogur_bebible', /frutilla/],
    ['galletitas María', 'galletitas_agua', /maria/],
    ['pizza de jamón', 'pizza_muzzarella', /jamon/],
    ['hamburguesas del súper a la plancha', 'hamburguesa_casera', /origen/],
    ['papas al horno en cubitos', 'papas_horno_baston', /forma/],
    ['papas fritas', 'papas_horno_baston', /coccion/],
    ['arroz blanco solo', 'arroz_con_pollo', /agrega pollo/],
    ['fideos solo con manteca', 'fideos_manteca_queso', /queso/],
    ['milanesa de carne al horno', 'milanesa_carne_con_huevo', /huevo/],
    ['nuggets caseros sin huevo', 'nuggets_pollo_fritos', /origen|pollo/],
    ['la milanesa clásica, la de huevo', 'milanesa_carne_horno', /huevo/],
    ['tostadas', 'tostadas_pan_integral', /integral/],
    ['leche chocolatada', 'leche_chocolatada_fortificada', /fortificada/],
    ['milanesa', 'milanesa_napolitana', /queso|tomate/],
    ['nuggets de salmón', 'nuggets_merluza_fritos', /salmon/],
  ])('"%s" no es %s', (dicho, id, motivo) => {
    expect(pasa(dicho, id)).toMatch(motivo)
  })

  it.each([
    ['papas fritas', 'papas_fritas_baston'],
    ['papas al horno pero cortadas en cubitos, blanditas', 'papas_horno_cubos'],
    ['nuggets del súper al horno', 'nuggets_pollo_horno'],
    ['chocolatada fría', 'leche_chocolatada'],
    ['puré de papa, el casero con leche', 'pure_papa'],
    ['palitos de pescado congelados, fritos', 'palitos_merluza_fritos'],
    ['milanesa clásica de carne, la de huevo, al horno', 'milanesa_carne_con_huevo'],
    ['milanesa a la napolitana', 'milanesa_napolitana'],
    ['fideos con tuco', 'fideos_con_salsa'],
    ['copos de maíz', 'copos_maiz'],
  ])('"%s" es %s', (dicho, id) => {
    expect(pasa(dicho, id)).toBeNull()
  })

  it('las alergias: de ALERGENO por los alérgenos de los ingredientes, y las otras por nombre y alias', () => {
    expect(pasa('milanesa de carne al horno que le hago sin huevo', 'milanesa_carne_horno', ['huevo'])).toBeNull()
    expect(pasa('leche chocolatada', 'leche_chocolatada', ['leche'])).toMatch(/alergia .*leche/)
    expect(pasa('licuado de banana con leche', 'licuado_banana_leche', [], ['banana'])).toMatch(/alergia .*banana/)
    expect(pasa('licuado de banana con leche', 'licuado_banana_leche', [], ['kiwi'])).toBeNull()
    expect(alergiaQueChoca('salmon', ['pescado'])).toBe('pescado')
    expect(alergiaQueChoca('frutilla', [], ['Frutillas'])).toBe('Frutillas') // por el alias
    expect(alergiaQueChoca('frutilla', [], ['frutilla'])).toBe('frutilla')
  })

  it('en la visión, lo que vio en la foto cuenta como dicho y no se exige lo que no se ve (el huevo del rebozado)', () => {
    const m = prep('milanesa_carne_con_huevo')
    expect(verificarId('milanesa de carne', m)).toMatch(/huevo/)
    expect(verificarId('milanesa de carne', m, [], [], ['carne_vacuna', 'pan_rallado'])).toBeNull()
    expect(verificarId('milanesa de pollo', m, [], [], ['pollo', 'pan_rallado'])).toMatch(/pollo/)
    expect(verificarId('fideos con salsa', prep('fideos_con_salsa'), [], [], ['fideos', 'salsa_tomate'])).toBeNull()
    expect(verificarId('fideos con salsa de tomate y carne picada', prep('fideos_con_salsa'), [], [], ['fideos', 'salsa_tomate', 'carne_picada'])).toMatch(/vaca/)
  })
})
