// v5.4 · La receta creativa: la base de conocimiento de Tomás (dataset sintético, §10.5) y generarRecetaCreativa() con
// generarJSON mockeado (ningún test llama a un modelo real).
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { alimentosPrueba, catalogoPrueba, comidasSinteticas, ninoDoc, sintetico } from '../datos/prueba/catalogos.js'
import { conocimientoDe, type Conocimiento } from '../grafo/conocimiento.js'
import { ErrorNibble } from '../http.js'
import { objetivosPara } from '../nutricion/objetivos.js'
import { fijarAlimentos } from './catalogo.js'
import { generarJSON } from './modelo.js'
import type { SalidaCreativa } from './prompts/receta-creativa.js'
import { generarRecetaCreativa } from './receta-creativa.js'

vi.mock('./modelo.js', () => ({ generarJSON: vi.fn() }))
const llm = vi.mocked(generarJSON)

const catalogo = catalogoPrueba()
const alimentos = alimentosPrueba()
const s = sintetico('tomas')
const cargado = { nino: ninoDoc(s), comidas: comidasSinteticas(s, alimentos, catalogo), catalogo, alimentos, objetivo: objetivosPara(s.datos.edad, s.datos.sexo) }
const conocimiento = (op: Parameters<typeof conocimientoDe>[1] = {}): Conocimiento =>
  conocimientoDe(cargado, { hoy: '2026-10-16', momento: 'cena', azar: () => 0.4, ...op })

const papasHorno = catalogo.get('papas_horno_baston')!
// Sus papas al horno con queso gratinado: mismo plato, un ingrediente sumado (cuenta como cambio de ingrediente)
const PAPAS_CON_QUESO: SalidaCreativa = {
  desdeId: 'papas_horno_baston',
  nutriente: 'calcio_mg',
  nombre: 'Papas al horno con queso gratinado',
  atributos: { ...papasHorno.atributos, coccion: 'horno' },
  imagen: { uno: 'cheesy oven fry', varios: 'cheesy oven fries', aspecto: 'oven-baked potato sticks with golden melted mozzarella on top' },
  ingredientes: [{ alimentoId: 'papa', gramos: 120 }, { alimentoId: 'queso_muzzarella', gramos: 35 }, { alimentoId: 'aceite_girasol', gramos: 5 }],
  pasos: ['Cortá las papas en bastones.', 'Horneá 25 minutos hasta que estén crocantes.', 'Poné una feta de muzzarella arriba y gratiná 3 minutos.'],
  porQue: 'Parte de sus papas al horno en bastones, que come siempre; cambia solo el ingrediente: se suma muzzarella, que aporta calcio.',
  presentacion: 'Separado, dos bastones con queso al lado de sus papas fritas, sin tocarse.',
  comoOfrecer: 'Ofrecelo sin pedirle que lo coma; que esté en el plato ya es un avance. Cada paso cuenta. Conviene servirlo igual de 8 a 15 veces antes de cambiar algo.',
  transparencia: null,
}
// Un puré de papa con queso: cambia la textura y la forma (dos cambios), y además lo rechaza
const PURE_CON_QUESO: SalidaCreativa = {
  ...PAPAS_CON_QUESO,
  nombre: 'Puré de papa con queso',
  atributos: { ...PAPAS_CON_QUESO.atributos, textura: 'cremoso', forma: 'pure' },
}

const responde = (...salidas: SalidaCreativa[]) => {
  for (const datos of salidas) llm.mockResolvedValueOnce({ datos, modelo: 'claude-sonnet-5-5', ms: 10, reintentos: 0 })
}
const promptDe = (llamada: number) => {
  const parte = llm.mock.calls[llamada]![0].partes[0]!
  return parte.tipo === 'texto' ? parte.texto : ''
}
const pedir = (anteriores?: string[], k = conocimiento()) =>
  generarRecetaCreativa({ ninoId: 'tomas', momento: 'cena', ...(anteriores ? { anteriores } : {}) }, { conocimiento: async () => k })

beforeAll(() => fijarAlimentos([...alimentos.values()]))
afterAll(() => fijarAlimentos(null))
beforeEach(() => {
  llm.mockReset()
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('conocimientoDe (la base de conocimiento que arma el grafo)', () => {
  it('Tomás, cena: lo que come seguro (primero lo de la cena), lo que rechaza, la exposición, los patrones y las reglas', () => {
    const k = conocimiento()
    expect(k.seguros.slice(0, 3).map((p) => p.id).sort()).toEqual(['milanesa_carne_horno', 'papas_fritas_baston', 'papas_horno_baston'])
    expect(k.texto).toContain('- papas_fritas_baston: Papas fritas en bastones · crocante, baston, salado, caliente, frito, separado · papa · comió 8 de 8')
    expect(k.texto).toMatch(/Lo que rechaza o todavía le cuesta: Puré de papa \(textura\)/)
    expect(k.texto).toMatch(/En exposición .*Bastones de queso horneados \(5 veces\)/)
    expect(k.texto).toContain('Reglas de la familia: No come nada mezclado.')
    expect(k.texto).toContain('Lo crocante')
  })

  it('hasta 3 nutrientes, sin vitamina D salvo que se pida, con su mínimo y lo que es rico en él (sin alérgenos)', () => {
    const k = conocimiento()
    expect(k.nutrientes.map((x) => x.nutriente)).toEqual(['calcio_mg', 'hierro_mg', 'fibra_g'])
    expect(k.nutrientes[0]!.minimo).toBeGreaterThan(0)
    for (const x of k.nutrientes) expect(x.ricos.map((r) => r.alimentoId)).not.toContain('huevo')
    expect(conocimiento({ nutriente: 'vitamina_d_ug' }).nutrientes.map((x) => x.nutriente)).toEqual(['vitamina_d_ug'])
  })

  it('el foco sale al azar entre lo que va en la cena: distintos azares, distintos focos', () => {
    const focos = [0, 0.3, 0.6, 0.95].map((a) => conocimiento({ azar: () => a }).foco)
    for (const f of focos) expect(catalogo.get(f.desdeId)?.momentos).toContain('cena')
    expect(new Set(focos.map((f) => `${f.desdeId}:${f.modo}:${f.nutriente}`)).size).toBeGreaterThan(1)
  })
})

describe('generarRecetaCreativa', () => {
  it('un plato nuevo a un cambio: el código cuenta el cambio y lo que se mantiene, y trae el plato para la imagen', async () => {
    responde(PAPAS_CON_QUESO)
    const r = await pedir()
    expect(r.preparacionBaseId).toBe('nuevo_papas_al_horno_con_queso_gratinado')
    expect(r.desde).toEqual({ preparacionId: 'papas_horno_baston', nombre: papasHorno.nombre })
    expect(r.cambio).toBe('ingrediente')
    expect(r.seMantiene).toEqual(expect.arrayContaining(['forma=baston', 'textura=crocante', 'coccion=horno']))
    expect(r.plato?.imagen.varios).toBe('cheesy oven fries')
    expect(r.evidencia.nutriente).toBe('calcio_mg')
    expect(r.aporte.calcio_mg).toBeGreaterThan(150)
    expect(r.validacion).toEqual({ ok: true, problemas: [], reintentos: 0 })
  })

  it('el prompt lleva la base de conocimiento, el foco, lo que ya vio y los ingredientes sin sus alérgenos', async () => {
    responde(PAPAS_CON_QUESO)
    await pedir(['Bastones de polenta con queso'])
    const p = promptDe(0)
    expect(p).toContain('Base de conocimiento del chico')
    expect(p).toContain('Esta vez: partí de «')
    expect(p).toContain('La familia ya vio estas recetas: proponé un plato distinto a todas (otro ingrediente principal u otra idea):\n- Bastones de polenta con queso')
    expect(p).toContain('- queso_muzzarella:')
    expect(p).not.toContain('- huevo:')
  })

  it('dos cambios (y una textura que rechaza) no pasan: reintenta con los problemas', async () => {
    responde(PURE_CON_QUESO, PAPAS_CON_QUESO)
    const r = await pedir()
    expect(llm).toHaveBeenCalledTimes(2)
    expect(promptDe(1)).toMatch(/cambian 2 cosas/)
    expect(r.validacion.reintentos).toBe(1)
  })

  it('no repite una receta que ya vio la familia', async () => {
    responde(PAPAS_CON_QUESO, { ...PAPAS_CON_QUESO, nombre: 'Bastones de papa con muzzarella gratinada' })
    const r = await pedir(['Papas al horno con queso gratinado'])
    expect(promptDe(1)).toContain('ya lo vio la familia')
    expect(r.nombre).toBe('Bastones de papa con muzzarella gratinada')
  })

  it('si no llega al mínimo del nutriente, lo dice con los ingredientes que ayudan', async () => {
    const poquito = { ...PAPAS_CON_QUESO, ingredientes: [{ alimentoId: 'papa', gramos: 120 }, { alimentoId: 'queso_muzzarella', gramos: 5 }] }
    responde(poquito, PAPAS_CON_QUESO)
    await pedir()
    expect(promptDe(1)).toMatch(/La porción aporta [\d,]+ de calcio y el mínimo es [\d,]+: subí los gramos/)
  })

  it('un alérgeno o algo que ya come tampoco pasa; si sigue mal, sin_candidatos (otro pedido sortea otro foco)', async () => {
    const conHuevo = { ...PAPAS_CON_QUESO, ingredientes: [...PAPAS_CON_QUESO.ingredientes, { alimentoId: 'huevo', gramos: 20 }] }
    const loMismo = { ...PAPAS_CON_QUESO, nombre: 'Papas al horno', ingredientes: [{ alimentoId: 'papa', gramos: 120 }] }
    responde(conHuevo, loMismo)
    const e = await pedir().then(() => null, (x: unknown) => x)
    expect(e).toBeInstanceOf(ErrorNibble)
    expect((e as ErrorNibble).codigo).toBe('sin_candidatos')
    expect(promptDe(1)).toMatch(/huevo/i)
  })
})
