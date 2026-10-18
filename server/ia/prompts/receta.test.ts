// Prompt de la receta (§7, "Reglas de la receta"): que cada regla esté en el system prompt y que el mensaje lleve solo el
// paquete de evidencia y el candidato elegido.
import { describe, expect, it } from 'vitest'
import { CANDIDATO_QUESO, EVIDENCIA, SALIDA_QUESO, prep } from '../../validacion/ejemplos.js'
import { esquemaSalidaReceta, promptReceta, SISTEMA_RECETA, type DatosPromptReceta } from './receta.js'

const datos = (extra: Partial<DatosPromptReceta> = {}): DatosPromptReceta => ({
  evidencia: EVIDENCIA,
  candidato: CANDIDATO_QUESO,
  base: prep('bastones_queso_horno'),
  ingredientes: [{ alimentoId: 'queso_muzzarella', nombre: 'Queso muzzarella' }, { alimentoId: 'pan_rallado', nombre: 'Pan rallado' }],
  alergias: ['huevo'],
  ...extra,
})

describe('SISTEMA_RECETA: las reglas de la receta', () => {
  it.each([
    ['parte de su alimento seguro y cambia una sola cosa', 'cambia solo lo que dice "Cambia solo"'],
    ['dice qué se mantiene', 'qué se mantiene'],
    ['primero fortificar, de la misma marca', 'de la misma marca si existe'],
    ['presentación separada', 'presentacion: separado'],
    ['plato con divisiones si lo piden sus reglas', 'plato con divisiones'],
    ['porción mínima', 'porción mínima (del tamaño de una arveja o de un bastón)'],
    ['al lado de su alimento seguro', 'al lado de su alimento seguro y sin tocarse'],
    ['salsas aparte', 'va aparte, para mojar'],
    ['un solo alimento nuevo', 'Un solo alimento nuevo en el plato'],
    ['sin mezclas', 'nada de guisos, rellenos ni salsa por encima'],
    ['transparencia', 'proponé ofrecerlo también a la vista'],
    ['comoOfrecer sin presión', 'Ofrecelo sin pedirle que lo coma; que esté en el plato ya es un avance.'],
    ['de 8 a 15 veces', 'de 8 a 15 veces antes de cambiar algo'],
    ['nunca suplementos ni dietas', 'Nunca sugieras suplementos, dosis ni dietas de eliminación'],
    ['vitamina D al pediatra', 'conviene consultarlo con su pediatra o nutricionista'],
    ['nunca sacar ni juzgar un alimento seguro', 'Nunca sugieras sacarle un alimento seguro'],
    ['alergias, también en los pasos', 'ningún ingrediente ni paso puede llevar un alérgeno del chico'],
    ['gramos razonables', 'entre 5 y 300 g cada uno'],
    ['las frases prohibidas', '"que termine", "una probadita más", "premio"'],
  ])('%s', (_regla, texto) => {
    expect(SISTEMA_RECETA).toContain(texto)
  })
})

describe('promptReceta', () => {
  it('lleva evidencia.texto, el candidato y los ingredientes, y nada de un reintento', () => {
    const p = promptReceta(datos())
    expect(p.startsWith(`Paquete de evidencia (lo único que sabés del chico):\n${EVIDENCIA.texto}\n`)).toBe(true)
    expect(p).toContain('- Parte de: Papas al horno en bastones, crocantes (la comió 2/2)')
    expect(p).toContain('- Patrones que aplican: Lo crocante servido separado lo acepta')
    expect(p).toContain('- Apunta a: calcio (esta semana cubrió el 40%)')
    expect(p).toContain('- Ingredientes de la preparación, por porción: Queso muzzarella (queso_muzzarella) 40 g, Pan rallado (pan_rallado) 10 g')
    expect(p).toContain('- Alergias: huevo. Ningún ingrediente ni paso puede llevarlas.')
    expect(p).toContain('- pan_rallado: Pan rallado')
    expect(p).not.toContain('vitamina D casi no está')
    expect(p).not.toContain('Tu respuesta anterior')
  })

  it('sin alergias lo dice', () => {
    expect(promptReceta(datos({ alergias: [] }))).toContain('- Alergias: ninguna declarada.')
  })

  it('con vitamina D, pide derivar al pediatra o nutricionista', () => {
    expect(promptReceta(datos({ evidencia: { ...EVIDENCIA, nutriente: 'vitamina_d_ug' } }))).toContain('consultarlo con su pediatra o nutricionista')
  })

  it('en el reintento lleva los problemas y la respuesta anterior', () => {
    const p = promptReceta(datos({ anterior: { salida: SALIDA_QUESO, problemas: ['El aceite va en 2 g.'] } }))
    expect(p).toContain('no pasó la validación de la app por estos motivos:\n- El aceite va en 2 g.\nCorregí eso')
    expect(p.endsWith(JSON.stringify(SALIDA_QUESO))).toBe(true)
  })

  it('(v5.4) con recetas ya vistas, pide otra versión que no se parezca', () => {
    expect(promptReceta(datos())).not.toContain('ya vio estas recetas')
    const p = promptReceta(datos({ yaVistas: ['Bastones de queso al horno, crocantes como sus papas'] }))
    expect(p).toContain('ya vio estas recetas de esta misma preparación:\n- Bastones de queso al horno, crocantes como sus papas\nEscribí otra versión')
    expect(p).toContain('Lo que dice "Se mantiene" y todas las reglas siguen igual.')
  })
})

describe('esquemaSalidaReceta', () => {
  it('con ids, solo deja esos alimentoId', () => {
    const s = esquemaSalidaReceta(['queso_muzzarella', 'pan_rallado', 'leche', 'aceite_girasol'])
    expect(s.safeParse(SALIDA_QUESO).success).toBe(true)
    expect(s.safeParse({ ...SALIDA_QUESO, ingredientes: [{ alimentoId: 'huevo', gramos: 10 }] }).success).toBe(false)
  })

  it('transparencia es string o null', () => {
    const s = esquemaSalidaReceta([])
    expect(s.safeParse({ ...SALIDA_QUESO, transparencia: 'El queso va adentro.' }).success).toBe(true)
    expect(s.safeParse({ ...SALIDA_QUESO, transparencia: undefined }).success).toBe(false)
  })
})
