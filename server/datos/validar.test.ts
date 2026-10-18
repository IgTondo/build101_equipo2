import { describe, expect, it } from 'vitest'
import type { RegistrarComidaReq } from '../../shared/contratos.js'
import { sintetico } from './prueba/catalogos.js'
import { validarRegistrarComida } from './validar.js'

const comida = (): RegistrarComidaReq => structuredClone(sintetico('tomas').comidas[0] as RegistrarComidaReq)

describe('validarRegistrarComida: los ítems', () => {
  it('conserva nombreIngles (para buscar en alimentos_fdc lo que cayó en otro_<grupo>), sin espacios de más', () => {
    const req = comida()
    const [primero] = req.analisis.items
    if (!primero) throw new Error('Falta el primer ítem')
    primero.nombreIngles = '  sweet potato, baked '
    expect(validarRegistrarComida(req).analisis.items[0]?.nombreIngles).toBe('sweet potato, baked')
  })

  it('sin nombreIngles (o vacío, o null como lo deja la visión), el ítem no lo lleva', () => {
    expect(validarRegistrarComida(comida()).analisis.items[0]).not.toHaveProperty('nombreIngles')
    const req = comida() as unknown as { analisis: { items: Record<string, unknown>[] } }
    if (req.analisis.items[0]) req.analisis.items[0].nombreIngles = null
    if (req.analisis.items[1]) req.analisis.items[1].nombreIngles = '   '
    const items = validarRegistrarComida(req).analisis.items
    expect(items[0]).not.toHaveProperty('nombreIngles')
    expect(items[1]).not.toHaveProperty('nombreIngles')
  })
})
