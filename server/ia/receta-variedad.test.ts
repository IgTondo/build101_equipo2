// v5.5 · Modo variedad: si no le falta ningún nutriente clave esta semana (todos ≥ 70%), el objetivo pasa a ser sumar
// variedad con el grupo que menos come. Tomás y Lucía (dataset sintético, §10.5) con el objetivo diario al 1%: todo
// cubierto. Tomás nunca comió verdura; Lucía come de todos los grupos. generarJSON mockeado (ningún test llama a un modelo).
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { grupoSinComer, sinComer } from '../aprendizaje/textos.js'
import { alimentosPrueba, catalogoPrueba, comidasSinteticas, ninoDoc, sintetico, type SinteticoId } from '../datos/prueba/catalogos.js'
import { progresoDe } from '../datos/tablero.js'
import { conocimientoDe, type Conocimiento, type Foco } from '../grafo/conocimiento.js'
import { escalar } from '../nutricion/calcular.js'
import { CON_META, objetivosPara } from '../nutricion/objetivos.js'
import { grupoParaVariedad, variedadDe } from '../nutricion/progreso.js'
import { fijarAlimentos } from './catalogo.js'
import { generarJSON } from './modelo.js'
import type { SalidaCreativa } from './prompts/receta-creativa.js'
import { generarRecetaCreativa, type ConocimientoReceta } from './receta-creativa.js'

vi.mock('./modelo.js', () => ({ generarJSON: vi.fn() }))
const llm = vi.mocked(generarJSON)

const HOY = '2026-10-16'
const catalogo = catalogoPrueba()
const alimentos = alimentosPrueba()
/** El chico sintético con el objetivo diario al 1% (o el real): con 0,01 cubre todo y no falta ningún nutriente. */
const cargadoDe = (id: SinteticoId, factor = 0.01) => {
  const s = sintetico(id)
  return { nino: ninoDoc(s), comidas: comidasSinteticas(s, alimentos, catalogo), catalogo, alimentos, objetivo: escalar(objetivosPara(s.datos.edad, s.datos.sexo), factor) }
}
const tomas = cargadoDe('tomas')
const conocimiento = (op: Parameters<typeof conocimientoDe>[1] = {}, c = tomas): Conocimiento =>
  conocimientoDe(c, { hoy: HOY, momento: 'cena', azar: () => 0.4, ...op })

const papasFritas = catalogo.get('papas_fritas_baston')!
// De sus papas fritas a bastones de zanahoria fritos: cambia solo el ingrediente principal, y es verdura
const ZANAHORIA_FRITA: SalidaCreativa = {
  desdeId: 'papas_fritas_baston',
  nutriente: null,
  nombre: 'Bastones de zanahoria fritos',
  atributos: { ...papasFritas.atributos, color: 'naranja', grupo: 'verdura', coccion: 'frito' },
  imagen: { uno: 'carrot fry', varios: 'carrot fries', aspecto: 'carrot cut into long thin sticks shaped exactly like French fries, fried until crispy' },
  rol: 'verdura_fruta',
  acompanamientos: [{ preparacionId: 'milanesa_carne_horno', rol: 'principal', gramos: 130 }, { preparacionId: 'papas_horno_baston', rol: 'guarnicion', gramos: 100 }],
  ingredientes: [{ alimentoId: 'zanahoria', gramos: 100 }, { alimentoId: 'pan_rallado', gramos: 15 }, { alimentoId: 'aceite_girasol', gramos: 8 }],
  pasos: ['Pelá la zanahoria y cortala en bastones finos como sus papas.', 'Hervilos 3 minutos y secalos bien.', 'Pasalos por pan rallado.', 'Freílos hasta que estén crocantes.', 'Escurrilos en papel y salalos apenas.'],
  porQue: 'Parte de sus papas fritas en bastones, que come siempre; cambia solo el ingrediente: zanahoria, para sumar verdura, que todavía no come.',
  presentacion: 'Separado, dos bastones de zanahoria al lado de sus papas fritas, sin tocarse.',
  comoOfrecer: 'Ofrecelo sin pedirle que lo coma; que esté en el plato ya es un avance. Cada paso cuenta. Conviene servirlo igual de 8 a 15 veces antes de cambiar algo.',
  transparencia: null,
}
// Sus papas al horno con queso: un cambio y válida, pero es de cereales y papas, no de verdura
const PAPAS_CON_QUESO: SalidaCreativa = {
  ...ZANAHORIA_FRITA,
  desdeId: 'papas_horno_baston',
  nombre: 'Papas al horno con queso gratinado',
  atributos: { ...catalogo.get('papas_horno_baston')!.atributos, coccion: 'horno' },
  imagen: { uno: 'cheesy oven fry', varios: 'cheesy oven fries', aspecto: 'oven-baked potato sticks with golden melted mozzarella on top' },
  ingredientes: [{ alimentoId: 'papa', gramos: 120 }, { alimentoId: 'queso_muzzarella', gramos: 35 }, { alimentoId: 'aceite_girasol', gramos: 5 }],
  pasos: ['Cortá las papas en bastones.', 'Pincelalas con aceite.', 'Horneá 25 minutos hasta que estén crocantes.', 'Poné una feta de muzzarella arriba y gratiná 3 minutos.'],
  porQue: 'Parte de sus papas al horno en bastones; cambia solo el ingrediente: se suma muzzarella.',
  presentacion: 'Separado, dos bastones con queso al lado de sus papas fritas, sin tocarse.',
}

// v5.10 · El primer intento solo acepta el alimento de partida y el ingrediente del foco: los tests de la receta lo fijan
// (el de ZANAHORIA_FRITA en modo variedad, el de PAPAS_CON_QUESO en modo nutriente) y no dependen del sorteo
const FOCO_ZANAHORIA: Foco = { desdeId: 'papas_fritas_baston', modo: 'cambiar_principal', grupo: 'verdura', ingrediente: 'zanahoria' }
const FOCO_PAPAS: Foco = { desdeId: 'papas_horno_baston', modo: 'sumar_ingrediente', nutriente: 'calcio_mg', ingrediente: 'queso_muzzarella' }
const conFoco = (k: Conocimiento, foco: Foco = FOCO_ZANAHORIA, recientes: string[] = []): ConocimientoReceta => ({ ...k, foco, recientes })

const responde = (...salidas: SalidaCreativa[]) => {
  for (const datos of salidas) llm.mockResolvedValueOnce({ datos, modelo: 'claude-sonnet-5-5', ms: 10, reintentos: 0 })
}
const promptDe = (llamada: number) => {
  const parte = llm.mock.calls[llamada]![0].partes[0]!
  return parte.tipo === 'texto' ? parte.texto : ''
}
const pedir = (k: ConocimientoReceta = conFoco(conocimiento())) => generarRecetaCreativa({ ninoId: 'tomas', momento: 'cena' }, { conocimiento: async () => k })

beforeAll(() => fijarAlimentos([...alimentos.values()]))
afterAll(() => fijarAlimentos(null))
beforeEach(() => {
  llm.mockReset()
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('el grupo que menos come (grupoParaVariedad, variedadDe)', () => {
  it('el que nunca registramos gana; si no, el de más días sin comer, desde 3 días; si come de todos, ninguno', () => {
    expect(grupoParaVariedad([{ grupo: 'fruta', diasSinComer: 6 }, { grupo: 'verdura', diasSinComer: null }, { grupo: 'lacteo', diasSinComer: 0 }]))
      .toEqual({ grupo: 'verdura', diasSinComer: null })
    expect(grupoParaVariedad([{ grupo: 'fruta', diasSinComer: 6 }, { grupo: 'verdura', diasSinComer: 4 }, { grupo: 'lacteo', diasSinComer: 0 }]))
      .toEqual({ grupo: 'fruta', diasSinComer: 6 })
    expect(grupoParaVariedad([{ grupo: 'fruta', diasSinComer: 2 }, { grupo: 'verdura', diasSinComer: 1 }])).toEqual({})
  })

  it('solo hay modo variedad si hay comidas esta semana y no falta ningún nutriente', () => {
    const grupos = [{ grupo: 'fruta' as const, diasSinComer: 6 }]
    expect(variedadDe(3, [], grupos)).toEqual({ grupo: 'fruta', diasSinComer: 6 })
    expect(variedadDe(0, [], grupos)).toBeNull()
    expect(variedadDe(3, ['calcio_mg'], grupos)).toBeNull()
  })

  it('en palabras', () => {
    expect(grupoSinComer('fruta', 6)).toBe('fruta: hace 6 días que no come')
    expect(grupoSinComer('verdura', null)).toBe('verdura: no registramos que haya comido')
    expect(sinComer('proteina', 1)).toBe('hace 1 día que no come carne, huevo o legumbres')
  })
})

describe('conocimientoDe en modo variedad', () => {
  it('Tomás con todo cubierto: sin nutrientes que cumplir, el objetivo es sumar verdura (nunca la comió)', () => {
    const k = conocimiento()
    expect(k.nutrientes).toEqual([])
    expect(k.variedad).toEqual({ grupo: 'verdura', diasSinComer: null })
    expect(k.foco).toMatchObject({ modo: 'cambiar_principal', grupo: 'verdura' })
    expect(k.foco.nutriente).toBeUndefined()
    expect(k.texto).toContain('No le falta ningún nutriente clave esta semana (todos por encima del 70%). El objetivo es sumar variedad: verdura: no registramos que haya comido.')
    expect(k.texto).toMatch(/El plato nuevo tiene que ser de verdura \(atributos\.grupo = verdura\).*zanahoria/)
    expect(k.texto).not.toContain('Le falta (elegí uno)')
    for (const n of CON_META) expect(k.coberturas[n].coberturaSemana).toBeGreaterThanOrEqual(0.7)
  })

  it('cualquier azar en modo variedad con grupo cambia el ingrediente principal', () => {
    for (const a of [0, 0.3, 0.6, 0.95]) expect(conocimiento({ azar: () => a }).foco.modo).toBe('cambiar_principal')
  })

  it('si se pide un nutriente, es modo nutriente aunque esté cubierto', () => {
    const k = conocimiento({ nutriente: 'calcio_mg' })
    expect(k.variedad).toBeUndefined()
    expect(k.nutrientes.map((x) => x.nutriente)).toEqual(['calcio_mg'])
    expect(k.foco.nutriente).toBe('calcio_mg')
  })

  it('Lucía come de todos los grupos: variedad sin grupo, algo nuevo a un cambio', () => {
    const k = conocimiento({}, cargadoDe('lucia'))
    expect(k.variedad).toEqual({})
    expect(k.foco.grupo).toBeUndefined()
    expect(k.texto).toContain('El objetivo es sumar variedad: come de todos los grupos')
  })

  it('con el objetivo real, Tomás sigue en modo nutriente (le falta calcio)', () => {
    const k = conocimiento({}, cargadoDe('tomas', 1))
    expect(k.variedad).toBeUndefined()
    expect(k.nutrientes[0]?.nutriente).toBe('calcio_mg')
  })
})

describe('generarRecetaCreativa en modo variedad', () => {
  it('un plato de verdura a un cambio pasa sin mínimo de nutriente, con nutriente: null y objetivo variedad', async () => {
    responde(ZANAHORIA_FRITA)
    const r = await pedir()
    expect(llm).toHaveBeenCalledTimes(1)
    expect(r.validacion).toEqual({ ok: true, problemas: [], reintentos: 0 })
    expect(r.cambio).toBe('ingrediente')
    expect(r.objetivo).toEqual({ tipo: 'variedad', grupo: 'verdura', diasSinComer: null })
    expect(CON_META).toContain(r.evidencia.nutriente) // el que más aporta, solo para mostrar
    const schema = llm.mock.calls[0]![0].schema as { safeParse: (x: unknown) => { success: boolean } }
    expect(schema.safeParse(ZANAHORIA_FRITA).success).toBe(true)
    expect(schema.safeParse({ ...ZANAHORIA_FRITA, nutriente: 'calcio_mg' }).success).toBe(false)
    const p = promptDe(0)
    expect(p).toContain('para sumar variedad: el plato tiene que ser del grupo verdura')
    expect(p).toContain('devolvé nutriente: null')
  })

  it('un plato de otro grupo no pasa: reintenta con el problema en castellano', async () => {
    responde(PAPAS_CON_QUESO, ZANAHORIA_FRITA)
    const r = await pedir()
    expect(llm).toHaveBeenCalledTimes(2)
    expect(promptDe(1)).toContain('El objetivo es sumar variedad con verdura: el plato tiene que ser de ese grupo (atributos.grupo = verdura)')
    expect(promptDe(1)).toContain('es de cereales, panes o papas')
    expect(r.nombre).toBe('Bastones de zanahoria fritos')
    expect(r.validacion.reintentos).toBe(1)
  })

  it('declarar el grupo no alcanza: el ingrediente principal tiene que ser de ese grupo', async () => {
    const disfrazado = { ...PAPAS_CON_QUESO, atributos: { ...PAPAS_CON_QUESO.atributos, grupo: 'verdura' as const } }
    responde(disfrazado, ZANAHORIA_FRITA)
    await pedir()
    expect(promptDe(1)).toMatch(/sumar variedad con verdura.*ingrediente principal/)
  })

  it('en modo nutriente el objetivo es el nutriente', async () => {
    const k = conFoco(conocimiento({}, cargadoDe('tomas', 1)), FOCO_PAPAS)
    responde({ ...PAPAS_CON_QUESO, nutriente: 'calcio_mg', rol: 'principal', acompanamientos: [{ preparacionId: 'milanesa_carne_horno', rol: 'guarnicion', gramos: 110 }, { preparacionId: 'papas_fritas_baston', rol: 'guarnicion', gramos: 50 }] })
    const r = await pedir(k)
    expect(r.objetivo).toEqual({ tipo: 'nutriente', nutriente: 'calcio_mg' })
    expect(r.evidencia.nutriente).toBe('calcio_mg')
  })

  it('(v5.10) el ingrediente del foco es el de ese grupo: el prompt lo nombra y otro solo pasa en el reintento', async () => {
    responde(ZANAHORIA_FRITA)
    await pedir()
    expect(promptDe(0)).toContain('cambiá el ingrediente principal: el ingrediente principal (el de más gramos) es «Zanahoria» (zanahoria); mantené la forma, la textura, el sabor, la temperatura y la cocción, para sumar variedad: el plato tiene que ser del grupo verdura.')
    expect(promptDe(0)).toContain('Es lo que pide la app: no partas de otro alimento seguro ni cambies de ingrediente.')

    responde(ZANAHORIA_FRITA, ZANAHORIA_FRITA)
    const r = await pedir(conFoco(conocimiento(), { ...FOCO_ZANAHORIA, ingrediente: 'zapallo' }))
    expect(promptDe(2)).toContain('tiene que ser Zapallo cocido (zapallo), y en «Bastones de zanahoria fritos» es Zanahoria')
    expect(promptDe(2)).toContain('Si así no se puede cumplir alguna regla, elegí otro alimento seguro u otro ingrediente de verdura.')
    expect(r.validacion.reintentos).toBe(1)
  })
})

describe('el tablero en modo variedad', () => {
  it('la "más nutritiva" suma el grupo que menos come, con el porqué; el orden y los tipos no cambian', () => {
    const p = progresoDe(tomas, { hasta: HOY, momento: 'cena' })
    expect(p.semana.faltan).toEqual([])
    expect(p.variedad).toEqual({ grupo: 'verdura', diasSinComer: null })
    expect(p.sugerencias?.map((s) => s.tipo)).toEqual(['segura', 'un_paso', 'mas_nutritiva'])
    const mas = p.sugerencias![2]!
    expect(mas.grupo).toBe('verdura')
    expect(mas.porQue).toMatch(/^No le falta ningún nutriente clave esta semana: esta suma variedad, porque no registramos que coma verdura\. Se parece a/)
    expect(mas.objetivo).toEqual({ tipo: 'variedad', grupo: 'verdura', diasSinComer: null })
    expect(p.frase).toContain('Ningún nutriente clave está por debajo del 70%. ¡Viene muy bien! Lo próximo es sumar variedad: no registramos que coma verdura.')
  })

  it('si come de todos los grupos, algo nuevo a un cambio y la frase de siempre', () => {
    const p = progresoDe(cargadoDe('lucia'), { hasta: HOY, momento: 'cena' })
    expect(p.variedad).toEqual({})
    const mas = p.sugerencias?.find((s) => s.tipo === 'mas_nutritiva')
    expect(mas?.porQue).toMatch(/esta suma variedad, algo nuevo a un solo cambio/)
    expect(mas?.objetivo).toEqual({ tipo: 'variedad' })
    expect(p.frase).not.toContain('sumar variedad')
  })

  it('con el objetivo real (le falta calcio), todo como antes: sin variedad ni objetivo', () => {
    const p = progresoDe(cargadoDe('tomas', 1), { hasta: HOY, momento: 'cena' })
    expect(p.variedad).toBeUndefined()
    const mas = p.sugerencias?.find((s) => s.tipo === 'mas_nutritiva')
    expect(mas?.porQue).toMatch(/^Es la que más calcio aporta/)
    expect(mas?.objetivo).toBeUndefined()
  })
})
