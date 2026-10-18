// A9 · generarReceta() con generarJSON mockeado (ningún test llama a un modelo real) y la evidencia de fixtures/receta.json.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Evidencia, Perfil } from '../../shared/contratos.js'
import { ErrorNibble } from '../http.js'
import {
  ALIMENTOS, CANDIDATO_PAPAS, CANDIDATO_QUESO, EVIDENCIA, PERFIL_TOMAS, SALIDA_PAPAS, SALIDA_QUESO, prep, preparacion,
} from '../validacion/ejemplos.js'
import { calcularAporte } from '../validacion/receta.js'
import { fijarAlimentos } from './catalogo.js'
import { generarJSON } from './modelo.js'
import { coberturaDeLoQueFalta, esquemaRecetaReq, generarReceta, type DepsReceta, type IntentoReceta } from './receta.js'

vi.mock('./modelo.js', () => ({ generarJSON: vi.fn() }))
const llm = vi.mocked(generarJSON)

type Salida = typeof SALIDA_QUESO
const responde = (...salidas: Salida[]) => {
  for (const datos of salidas) llm.mockResolvedValueOnce({ datos, modelo: 'claude-sonnet-5-5', ms: 10, reintentos: 0 })
}
const promptDe = (llamada: number) => {
  const parte = llm.mock.calls[llamada][0].partes[0]
  return parte.tipo === 'texto' ? parte.texto : ''
}

const deps = (extra: Partial<DepsReceta> = {}): DepsReceta => ({
  armarEvidencia: async () => EVIDENCIA,
  perfil: async () => PERFIL_TOMAS,
  preparacion,
  ...extra,
})
const pedir = (extra: Partial<DepsReceta> = {}, preparacionId?: string) => generarReceta({ ninoId: 'tomas', preparacionId }, deps(extra))
const errorDe = async (p: Promise<unknown>) => {
  const e = await p.then(() => null, (x: unknown) => x)
  expect(e).toBeInstanceOf(ErrorNibble)
  return e as ErrorNibble
}

const conEscondido: Salida = { ...SALIDA_QUESO, transparencia: 'Escondé el queso entre las papas.' }
const conPresion: Salida = { ...SALIDA_QUESO, comoOfrecer: 'Si come todo, dale un premio.' }
const conHuevo: Salida = { ...SALIDA_QUESO, ingredientes: [...SALIDA_QUESO.ingredientes, { alimentoId: 'huevo', gramos: 20 }] }

beforeAll(() => fijarAlimentos(ALIMENTOS))
afterAll(() => fijarAlimentos(null))
beforeEach(() => {
  llm.mockReset()
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('generarReceta', () => {
  it('válida a la primera: una llamada, y el código completa la cadena, el aporte y la validación', async () => {
    responde(SALIDA_QUESO)
    const r = await pedir()
    expect(llm).toHaveBeenCalledTimes(1)
    expect(llm.mock.calls[0][0].tarea).toBe('receta')

    expect(r.preparacionBaseId).toBe('bastones_queso_horno')
    expect(r.desde).toEqual({ preparacionId: 'papas_horno_baston', nombre: 'Papas al horno en bastones, crocantes' })
    expect(r.cambio).toBe('ingrediente')
    expect(r.seMantiene).toEqual(CANDIDATO_QUESO.seMantiene)
    expect(r.ingredientes.map((i) => i.nombre)).toEqual(['Queso muzzarella', 'Pan rallado', 'Leche', 'Aceite de girasol'])
    expect(r.aporte).toEqual(calcularAporte(SALIDA_QUESO.ingredientes))
    expect(r.coberturaDeLoQueFalta).toBe(Math.round((r.aporte.calcio_mg / EVIDENCIA.faltaHoy) * 100) / 100)
    expect(r.validacion).toEqual({ ok: true, problemas: [], reintentos: 0 })
    expect(r.evidencia).toBe(EVIDENCIA)
    expect(r.transparencia).toBeNull()
  })

  it('el aporte que invente el LLM se ignora: sale de la tabla', async () => {
    responde({ ...SALIDA_QUESO, aporte: { calcio_mg: 9999 } } as Salida)
    const r = await pedir()
    expect(r.aporte.calcio_mg).toBe(calcularAporte(SALIDA_QUESO.ingredientes).calcio_mg)
  })

  it('el prompt lleva evidencia.texto y el candidato elegido, con lo que cambia y lo que se mantiene', async () => {
    responde(SALIDA_QUESO)
    await pedir()
    const p = promptDe(0)
    expect(p).toContain(EVIDENCIA.texto)
    expect(p).toContain('- Preparación: Bastones de queso horneados')
    expect(p).toContain('- Cambia solo: el ingrediente principal')
    expect(p).toContain('- Se mantiene: forma=baston, textura=crocante, sabor=salado, temperatura=caliente, coccion=horno')
    expect(p).toContain('- queso_muzzarella: Queso muzzarella')
    expect(p).not.toContain('- huevo:')
    expect(p).not.toContain('Tu respuesta anterior')
  })

  it('el schema no deja elegir alimentos con alérgenos del chico ni genéricos', async () => {
    responde(SALIDA_QUESO)
    await pedir()
    const { schema } = llm.mock.calls[0][0]
    expect(schema.safeParse(SALIDA_QUESO).success).toBe(true)
    expect(schema.safeParse(conHuevo).success).toBe(false)
    const generico = { ...SALIDA_QUESO, ingredientes: [{ alimentoId: 'otro_lacteo', gramos: 40 }] }
    expect(schema.safeParse(generico).success).toBe(false)
  })

  it('inválida → reintento con los problemas → válida', async () => {
    responde(conEscondido, SALIDA_QUESO)
    const r = await pedir()
    expect(llm).toHaveBeenCalledTimes(2)
    const p = promptDe(1)
    expect(p).toContain('Tu respuesta anterior no pasó la validación')
    expect(p).toContain('En la transparencia aparece «Escondé»')
    expect(p).toContain(JSON.stringify(conEscondido))
    expect(r.preparacionBaseId).toBe('bastones_queso_horno')
    expect(r.validacion).toEqual({ ok: true, problemas: [], reintentos: 1 })
  })

  it('inválida dos veces → siguiente candidato (el yogur se saltea sin llamar al LLM: son 2 cambios)', async () => {
    responde(conEscondido, conPresion, SALIDA_PAPAS)
    const r = await pedir()
    expect(llm).toHaveBeenCalledTimes(3)
    expect(promptDe(2)).toContain('- Preparación: Papas al horno en bastones, crocantes')
    expect(promptDe(2)).not.toContain('Tu respuesta anterior')
    expect(r.preparacionBaseId).toBe('papas_horno_baston')
    expect(r.desde).toEqual({ preparacionId: 'papas_fritas_baston', nombre: 'Papas fritas en bastones' })
    expect(r.cambio).toBe('coccion')
    expect(r.validacion.reintentos).toBe(2)
  })

  it('alergia de Tomás (huevo): si el LLM la mete en la lista, se atrapa y se pide de nuevo', async () => {
    responde(conHuevo, SALIDA_QUESO)
    const r = await pedir()
    expect(promptDe(1)).toContain('«Huevo» tiene huevo, y tiene alergia declarada')
    expect(r.ingredientes.some((i) => i.alimentoId === 'huevo')).toBe(false)
  })

  it('alergia de Tomás (huevo): también si la mete en un paso', async () => {
    responde({ ...SALIDA_QUESO, pasos: ['Pasá los bastones por huevo batido.', ...SALIDA_QUESO.pasos] }, SALIDA_QUESO)
    await pedir()
    expect(promptDe(1)).toContain('En el paso 1 aparece «huevo» y tiene alergia declarada a huevo')
  })

  it('lenguaje prohibido: se atrapa y se pide de nuevo', async () => {
    responde(conPresion, SALIDA_QUESO)
    const r = await pedir()
    expect(promptDe(1)).toContain('En cómo ofrecerlo aparece «Si come»')
    expect(promptDe(1)).toContain('aparece «premio»')
    expect(r.comoOfrecer).toBe(SALIDA_QUESO.comoOfrecer)
  })

  it('las alergias del perfil cuentan aunque la evidencia no las traiga (el queso se saltea sin llamar al LLM)', async () => {
    const conLeche: Perfil = { ...PERFIL_TOMAS, datos: { ...PERFIL_TOMAS.datos, alergias: ['huevo', 'leche'] } }
    responde(SALIDA_PAPAS)
    const r = await pedir({ perfil: async () => conLeche })
    expect(llm).toHaveBeenCalledTimes(1)
    expect(r.preparacionBaseId).toBe('papas_horno_baston')
  })

  it('(v5.8) sus otras alergias: fuera del schema y de la lista, en el prompt, y el candidato cuyo principal alcanzan se saltea', async () => {
    const conOtras: Perfil = { ...PERFIL_TOMAS, datos: { ...PERFIL_TOMAS.datos, alergiasOtras: ['leche de vaca', 'colorante rojo'] } }
    responde(SALIDA_QUESO)
    await pedir({ perfil: async () => conOtras }).catch(() => null) // la leche no pasa la validación: acá importa el pedido
    const { schema } = llm.mock.calls[0][0]
    expect(schema.safeParse(SALIDA_QUESO).success).toBe(false) // lleva leche
    expect(promptDe(0)).toContain('- Alergias: huevo, leche de vaca, colorante rojo. Ningún ingrediente ni paso puede llevarlas.')
    expect(promptDe(0)).not.toContain('- leche:')

    llm.mockReset()
    const conMuzza: Perfil = { ...PERFIL_TOMAS, datos: { ...PERFIL_TOMAS.datos, alergiasOtras: ['muzzarella'] } }
    responde(SALIDA_PAPAS)
    const r = await pedir({ perfil: async () => conMuzza })
    expect(llm).toHaveBeenCalledTimes(1)
    expect(r.preparacionBaseId).toBe('papas_horno_baston')
  })

  it('(v5.8) una otra alergia nombrada en un paso se atrapa y se pide de nuevo', async () => {
    const conOtras: Perfil = { ...PERFIL_TOMAS, datos: { ...PERFIL_TOMAS.datos, alergiasOtras: ['colorante rojo'] } }
    responde({ ...SALIDA_QUESO, pasos: [...SALIDA_QUESO.pasos, 'Decoralos con colorante rojo.'] }, SALIDA_QUESO)
    const r = await pedir({ perfil: async () => conOtras })
    expect(promptDe(1)).toContain('aparece «colorante rojo» y tiene alergia declarada a colorante rojo')
    expect(r.validacion.reintentos).toBe(1)
  })

  it('preparacionId pedido: la receta se arma sobre ese candidato', async () => {
    responde(SALIDA_PAPAS)
    const r = await pedir({}, 'papas_horno_baston')
    expect(llm).toHaveBeenCalledTimes(1)
    expect(promptDe(0)).toContain('- Preparación: Papas al horno en bastones, crocantes')
    expect(r.preparacionBaseId).toBe('papas_horno_baston')
  })

  it('(v5.4) anteriores: solo le llegan al LLM para el preparacionId pedido', async () => {
    responde(SALIDA_PAPAS)
    await generarReceta({ ninoId: 'tomas', preparacionId: 'papas_horno_baston', anteriores: ['Papas al horno de siempre'] }, deps())
    expect(promptDe(0)).toContain('ya vio estas recetas de esta misma preparación:\n- Papas al horno de siempre')
    llm.mockReset()
    responde(SALIDA_PAPAS)
    await generarReceta({ ninoId: 'tomas', preparacionId: 'yogur_vainilla', anteriores: ['Yogur de siempre'] }, deps())
    expect(promptDe(0)).not.toContain('ya vio estas recetas')
  })

  it('preparacionId pedido que no pasa: sigue con los que venían después, y después con los de antes', async () => {
    responde(SALIDA_PAPAS)
    const r = await pedir({}, 'yogur_vainilla')
    expect(r.preparacionBaseId).toBe('papas_horno_baston')
  })

  it('preparacionId fuera de los 3 de la evidencia: lo trae deps.candidato, va primero y suma sus líneas al texto', async () => {
    const soloQueso: Evidencia = { ...EVIDENCIA, candidatos: [CANDIDATO_QUESO] }
    const buscados: unknown[][] = []
    responde(SALIDA_PAPAS)
    const r = await pedir({
      armarEvidencia: async () => soloQueso,
      candidato: async (...args) => { buscados.push(args); return CANDIDATO_PAPAS },
    }, 'papas_horno_baston')
    expect(buscados).toEqual([['tomas', 'papas_horno_baston', 'calcio_mg']])
    expect(r.preparacionBaseId).toBe('papas_horno_baston')
    expect(r.evidencia.candidatos.map((c) => c.preparacionId)).toEqual(['papas_horno_baston', 'bastones_queso_horno'])
    expect(r.evidencia.texto.startsWith(EVIDENCIA.texto)).toBe(true)
    expect(r.evidencia.texto).toContain('Candidato 2 (el que eligió la familia en el tablero): Papas al horno en bastones, crocantes (puntaje 0,35)')
    expect(r.evidencia.texto).toContain('  Camino: Papas fritas en bastones (comió 8/8) ─forma=baston, textura=crocante, sabor=salado, temperatura=caliente─▶ Papas al horno en bastones, crocantes')
    expect(r.evidencia.texto).toContain('  Cambia solo: la cocción. Se mantiene: forma=baston, textura=crocante, sabor=salado, temperatura=caliente')
    expect(r.evidencia.texto).toContain('  Aporta: ~14,0 mg de calcio por porción')
    expect(promptDe(0)).toContain('Candidato 2 (el que eligió la familia en el tablero)')
  })

  it('deps.candidato no se llama si el pedido ya está en la evidencia', async () => {
    let llamado = false
    responde(SALIDA_PAPAS)
    await pedir({ candidato: async () => { llamado = true; return undefined } }, 'papas_horno_baston')
    expect(llamado).toBe(false)
  })

  it('si deps.candidato tampoco lo encuentra → entrada_invalida, como antes', async () => {
    const e = await errorDe(pedir({ candidato: async () => undefined }, 'milanesa_napolitana'))
    expect(e.codigo).toBe('entrada_invalida')
    expect(llm).not.toHaveBeenCalled()
  })

  it('preparacionId que no está en la evidencia → entrada_invalida, sin llamar al LLM', async () => {
    const e = await errorDe(pedir({}, 'milanesa_napolitana'))
    expect(e.codigo).toBe('entrada_invalida')
    expect(llm).not.toHaveBeenCalled()
  })

  it('sin candidatos en la evidencia → sin_candidatos, sin llamar al LLM', async () => {
    const vacia: Evidencia = { ...EVIDENCIA, candidatos: [] }
    const e = await errorDe(pedir({ armarEvidencia: async () => vacia }))
    expect(e.codigo).toBe('sin_candidatos')
    expect(llm).not.toHaveBeenCalled()
  })

  it('ningún candidato pasa → sin_candidatos con el porqué de cada uno', async () => {
    responde(conEscondido, conEscondido, conPresion, conPresion)
    const e = await errorDe(pedir())
    expect(e.codigo).toBe('sin_candidatos')
    expect(llm).toHaveBeenCalledTimes(4)
    const { descartes } = e.detalle as { descartes: { preparacionId: string; problemas: string[] }[] }
    expect(descartes.map((d) => d.preparacionId)).toEqual(['bastones_queso_horno', 'yogur_vainilla', 'papas_horno_baston'])
    expect(descartes[1].problemas[0]).toContain('cambian 2 cosas')
  })

  it('un candidato que no está en el catálogo de preparaciones se saltea', async () => {
    const raro = { ...CANDIDATO_PAPAS, preparacionId: 'no_existe' }
    responde(SALIDA_QUESO)
    const r = await pedir({ armarEvidencia: async () => ({ ...EVIDENCIA, candidatos: [raro, CANDIDATO_QUESO] }) })
    expect(r.preparacionBaseId).toBe('bastones_queso_horno')
    expect(llm).toHaveBeenCalledTimes(1)
  })

  it('sin `preparacion`, usa las del chico (deps.preparaciones): un alimento seguro observado fuera del catálogo sirve', async () => {
    const caseras = { ...CANDIDATO_PAPAS, desdeId: 'papas_fritas_caseras', camino: { ...CANDIDATO_PAPAS.camino, desde: 'Papas fritas caseras' } }
    const pedidas: string[] = []
    responde(SALIDA_PAPAS)
    const r = await pedir({
      preparacion: undefined,
      armarEvidencia: async () => ({ ...EVIDENCIA, candidatos: [caseras] }),
      preparaciones: async (ninoId) => {
        pedidas.push(ninoId)
        return (id) => (id === 'papas_fritas_caseras' ? { ...prep('papas_fritas_baston'), id, nombre: 'Papas fritas caseras' } : preparacion(id))
      },
    })
    expect(pedidas).toEqual(['tomas'])
    expect(r.desde).toEqual({ preparacionId: 'papas_fritas_caseras', nombre: 'Papas fritas caseras' })
    expect(r.validacion.ok).toBe(true)
  })

  it('si las del chico no lo tienen completo, el candidato se descarta como antes, sin llamar al LLM', async () => {
    const caseras = { ...CANDIDATO_PAPAS, desdeId: 'papas_fritas_caseras' }
    const e = await errorDe(pedir({
      preparacion: undefined,
      armarEvidencia: async () => ({ ...EVIDENCIA, candidatos: [caseras] }),
      preparaciones: async () => preparacion,
    }))
    expect(e.codigo).toBe('sin_candidatos')
    expect((e.detalle as { descartes: { problemas: string[] }[] }).descartes[0].problemas[0]).toContain('su alimento de partida (papas_fritas_caseras)')
    expect(llm).not.toHaveBeenCalled()
  })

  it('con `preparacion`, deps.preparaciones no se llama', async () => {
    let llamada = false
    responde(SALIDA_QUESO)
    await pedir({ preparaciones: async () => { llamada = true; return preparacion } })
    expect(llamada).toBe(false)
  })

  it('pasados 30 s no arranca otra llamada: timeout', async () => {
    let t = 0
    llm.mockImplementationOnce(async () => {
      t = 31_000
      return { datos: conEscondido, modelo: 'claude-sonnet-5-5', ms: 31_000, reintentos: 0 }
    })
    const e = await errorDe(pedir({ ahora: () => t }))
    expect(e.codigo).toBe('timeout')
    expect(llm).toHaveBeenCalledTimes(1)
  })

  it('alIntentar recibe cada salida del LLM con sus problemas por tipo, antes de cualquier reintento', async () => {
    responde(conHuevo, SALIDA_QUESO)
    const intentos: IntentoReceta[] = []
    await pedir({ alIntentar: (i) => intentos.push(i) })
    expect(intentos.map((i) => [i.llamada, i.preparacionId, i.reintento])).toEqual([[1, 'bastones_queso_horno', false], [2, 'bastones_queso_horno', true]])
    expect(intentos[0].salida).toBe(conHuevo)
    expect(intentos[0].problemas.alergias).toEqual([expect.stringContaining('«Huevo» tiene huevo')])
    expect(intentos[0].problemas.lenguaje).toEqual([])
    expect(Object.values(intentos[1].problemas).flat()).toEqual([])
  })

  it('cada llamada lleva el presupuesto que queda hasta los 55 s (limiteMs)', async () => {
    let t = 1_000
    llm.mockImplementationOnce(async () => {
      t = 21_000
      return { datos: conEscondido, modelo: 'claude-sonnet-5-5', ms: 20_000, reintentos: 0 }
    })
    responde(SALIDA_QUESO)
    await pedir({ ahora: () => t })
    expect(llm.mock.calls.map((c) => c[0].limiteMs)).toEqual([55_000, 35_000])
  })

  it('los errores del modelo (ErrorIA) suben tal cual: manejar() los convierte', async () => {
    llm.mockRejectedValueOnce(new ErrorNibble('limite_proveedor', 'Hay muchos pedidos a la vez.'))
    expect((await errorDe(pedir())).codigo).toBe('limite_proveedor')
  })
})

describe('coberturaDeLoQueFalta', () => {
  const aporte = () => calcularAporte(SALIDA_QUESO.ingredientes)

  it('aporte del nutriente ÷ lo que falta hoy, con dos decimales', () => {
    expect(coberturaDeLoQueFalta({ ...aporte(), calcio_mg: 223 }, EVIDENCIA)).toBe(0.44) // 223 / 507
  })

  it('con tope 1', () => {
    expect(coberturaDeLoQueFalta({ ...aporte(), calcio_mg: 900 }, EVIDENCIA)).toBe(1)
  })

  it('si hoy no falta nada, ya está cubierto', () => {
    expect(coberturaDeLoQueFalta(aporte(), { ...EVIDENCIA, faltaHoy: 0 })).toBe(1)
  })
})

describe('esquemaRecetaReq (el body de /api/receta)', () => {
  it('pide ninoId', () => {
    expect(esquemaRecetaReq.safeParse({}).success).toBe(false)
    expect(esquemaRecetaReq.safeParse({ ninoId: '  ' }).success).toBe(false)
  })

  it('acepta nutriente y preparacionId opcionales', () => {
    expect(esquemaRecetaReq.parse({ ninoId: 'tomas', nutriente: 'calcio_mg', preparacionId: 'bastones_queso_horno' }))
      .toEqual({ ninoId: 'tomas', nutriente: 'calcio_mg', preparacionId: 'bastones_queso_horno' })
  })

  it('(v5.2) conserva el momento y rechaza uno que no existe', () => {
    expect(esquemaRecetaReq.parse({ ninoId: 'tomas', momento: 'desayuno' })).toEqual({ ninoId: 'tomas', momento: 'desayuno' })
    expect(esquemaRecetaReq.safeParse({ ninoId: 'tomas', momento: 'once' }).success).toBe(false)
  })

  it('no hay receta para la energía: sin meta de calorías', () => {
    expect(esquemaRecetaReq.safeParse({ ninoId: 'tomas', nutriente: 'energia_kcal' }).success).toBe(false)
  })
})
