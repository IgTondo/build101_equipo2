// v5.4 · La receta creativa: la base de conocimiento de Tomás (dataset sintético, §10.5) y generarRecetaCreativa() con
// generarJSON mockeado (ningún test llama a un modelo real).
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PreparacionCatalogo } from '../../shared/contratos.js'
import { cargarNino } from '../datos/cargar.js'
import { alimentosPrueba, catalogoPrueba, comidasSinteticas, ninoDoc, sintetico } from '../datos/prueba/catalogos.js'
import { conocimientoDe, type Conocimiento, type Foco } from '../grafo/conocimiento.js'
import { ErrorNibble } from '../http.js'
import { objetivosPara } from '../nutricion/objetivos.js'
import { fijarAlimentos } from './catalogo.js'
import { generarJSON } from './modelo.js'
import { SISTEMA_RECETA_CREATIVA, type SalidaCreativa } from './prompts/receta-creativa.js'
import { calcularAporte } from '../validacion/receta.js'
import { minimoComponentes } from './plato-completo.js'
import { armarConocimientoReceta, completarCreativa, generarRecetaCreativa, limpiarNombre, problemasCreativa, problemasDeCalidad, problemasDelMomento, textoSinSeguros, type ConocimientoReceta, type DepsRecetaCreativa } from './receta-creativa.js'
import { alimentosCatalogo } from '../datos/catalogos.js'
import { esPlatoPrincipal } from './momentos.js'
import { CORTE_MS, TOPE_NUEVA_LLAMADA_MS } from './receta.js'

vi.mock('./modelo.js', () => ({ generarJSON: vi.fn() }))
const llm = vi.mocked(generarJSON)
// v5.10 · Para ver que las recetas que ya vio llegan hasta conocimientoDe (el real, espiado), sin Mongo
vi.mock('../datos/cargar.js', async (original) => ({ ...(await original<typeof import('../datos/cargar.js')>()), cargarNino: vi.fn() }))
vi.mock('../grafo/conocimiento.js', async (original) => {
  const m = await original<typeof import('../grafo/conocimiento.js')>()
  return { ...m, conocimientoDe: vi.fn(m.conocimientoDe) }
})

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
  rol: 'principal',
  acompanamientos: [{ preparacionId: 'papas_fritas_baston', rol: 'guarnicion', gramos: 60 }, { preparacionId: 'bastones_zanahoria_horno', rol: 'verdura_fruta', gramos: 60 }],
  ingredientes: [{ alimentoId: 'papa', gramos: 120 }, { alimentoId: 'queso_muzzarella', gramos: 35 }, { alimentoId: 'aceite_girasol', gramos: 5 }],
  pasos: ['Cortá las papas en bastones.', 'Pincelalas con aceite.', 'Horneá 25 minutos hasta que estén crocantes.', 'Poné una feta de muzzarella arriba y gratiná 3 minutos.'],
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

// v5.10 · El foco de PAPAS_CON_QUESO: sus papas al horno con muzzarella sumada. El primer intento solo acepta el alimento
// de partida y el ingrediente del foco, así que los tests que no son del foco lo fijan (y no dependen del sorteo).
const FOCO_PAPAS: Foco = { desdeId: 'papas_horno_baston', modo: 'sumar_ingrediente', nutriente: 'calcio_mg', ingrediente: 'queso_muzzarella' }
// v5.10 · Y con una verdura que ya come: la cena de PAPAS_CON_QUESO es lo nuevo + sus papas fritas + su zanahoria, sin su
// milanesa (un solo plato principal por comida: antes pasaba con la milanesa "de guarnición")
const zanahoria = catalogo.get('bastones_zanahoria_horno')!
const conFoco = (k: Conocimiento, foco: Foco = FOCO_PAPAS, recientes: string[] = []): ConocimientoReceta =>
  ({ ...k, seguros: [...k.seguros.filter((x) => x.id !== zanahoria.id), zanahoria], foco, recientes })
const kPapas = () => conFoco(conocimiento())

const responde = (...salidas: SalidaCreativa[]) => {
  for (const datos of salidas) llm.mockResolvedValueOnce({ datos, modelo: 'claude-sonnet-5-5', ms: 10, reintentos: 0 })
}
const promptDe = (llamada: number) => {
  const parte = llm.mock.calls[llamada]![0].partes[0]!
  return parte.tipo === 'texto' ? parte.texto : ''
}
// v5.10 · Los problemas de cada salida, como los ve alIntentar: el segundo intento es un pedido nuevo (otro foco) y no los lee
const intentos: Parameters<NonNullable<DepsRecetaCreativa['alIntentar']>>[0][] = []
const problemasDe = (llamada: number) => intentos[llamada]!.problemas.join('\n')
const pedir = (anteriores?: string[], k: ConocimientoReceta = kPapas()) =>
  generarRecetaCreativa({ ninoId: 'tomas', momento: 'cena', ...(anteriores ? { anteriores } : {}) }, { conocimiento: async () => k, alIntentar: (x) => { intentos.push(x) } })

beforeAll(() => fijarAlimentos([...alimentos.values()]))
afterAll(() => fijarAlimentos(null))
beforeEach(() => {
  llm.mockReset()
  intentos.length = 0
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

  it('dos cambios (y una textura que rechaza) no pasan: otro intento, que es un pedido nuevo (v5.10)', async () => {
    responde(PURE_CON_QUESO, PAPAS_CON_QUESO)
    const r = await pedir()
    expect(llm).toHaveBeenCalledTimes(2)
    expect(problemasDe(0)).toMatch(/cambian 2 cosas/)
    expect(promptDe(1)).not.toMatch(/cambian 2 cosas/)
    expect(r.validacion.reintentos).toBe(1)
  })

  it('no repite una receta que ya vio la familia', async () => {
    responde(PAPAS_CON_QUESO, { ...PAPAS_CON_QUESO, nombre: 'Bastones de papa con muzzarella gratinada' })
    const r = await pedir(['Papas al horno con queso gratinado'])
    expect(problemasDe(0)).toContain('ya lo vio la familia')
    expect(r.nombre).toBe('Bastones de papa con muzzarella gratinada')
  })

  it('si no llega al mínimo del nutriente, lo dice con los ingredientes que ayudan', async () => {
    const poquito = { ...PAPAS_CON_QUESO, ingredientes: [{ alimentoId: 'papa', gramos: 120 }, { alimentoId: 'queso_muzzarella', gramos: 5 }] }
    responde(poquito, PAPAS_CON_QUESO)
    await pedir()
    expect(problemasDe(0)).toMatch(/La porción aporta [\d,]+ de calcio y el mínimo es [\d,]+: subí los gramos/)
  })

  it('un alérgeno o algo que ya come tampoco pasa; si no pasa ninguno de los 3 intentos, sin_candidatos (otro pedido sortea otro foco)', async () => {
    const conHuevo = { ...PAPAS_CON_QUESO, ingredientes: [...PAPAS_CON_QUESO.ingredientes, { alimentoId: 'huevo', gramos: 20 }] }
    const loMismo = { ...PAPAS_CON_QUESO, nombre: 'Papas al horno', ingredientes: [{ alimentoId: 'papa', gramos: 120 }] }
    responde(conHuevo, conHuevo, loMismo)
    const e = await pedir().then(() => null, (x: unknown) => x)
    expect(e).toBeInstanceOf(ErrorNibble)
    expect((e as ErrorNibble).codigo).toBe('sin_candidatos')
    expect(llm).toHaveBeenCalledTimes(3)
    expect(problemasDe(0)).toMatch(/huevo/i)
    // El reintento relajado lee los problemas del segundo
    expect(promptDe(2)).toMatch(/huevo/i)
    expect(problemasDe(2)).toMatch(/más de lo mismo/)
  })
})

describe('(v5.8) sus otras alergias y sin alimento seguro para esta comida', () => {
  const conOtras = (...alergiasOtras: string[]): ConocimientoReceta => ({ ...kPapas(), alergiasOtras })

  it('el LLM las lee abajo del chico, y lo que alcanzan no está en la lista ni en el schema', async () => {
    responde(PAPAS_CON_QUESO)
    await pedir(undefined, conOtras('frutillas', 'colorante rojo'))
    const p = promptDe(0)
    expect(p).toMatch(/Chico: .*\nOtras alergias, como las contó la familia \(nada que las lleve, ni en los ingredientes ni en los pasos\): frutillas, colorante rojo\./)
    expect(p).not.toContain('- frutilla:')
    expect(p).toContain('- banana:')
    const schema = llm.mock.calls[0]![0].schema
    const conFrutilla = { ...PAPAS_CON_QUESO, ingredientes: [...PAPAS_CON_QUESO.ingredientes, { alimentoId: 'frutilla', gramos: 20 }] }
    expect(schema.safeParse(conFrutilla).success).toBe(false)
    expect(schema.safeParse(PAPAS_CON_QUESO).success).toBe(true)
  })

  it('un ingrediente que alcanzan o un paso que las nombra no pasa: reintenta con el problema', async () => {
    const conColorante = { ...PAPAS_CON_QUESO, pasos: [...PAPAS_CON_QUESO.pasos, 'Decoralos con colorante rojo.'] }
    responde(conColorante, PAPAS_CON_QUESO)
    const r = await pedir(undefined, conOtras('colorante rojo'))
    expect(problemasDe(0)).toContain('aparece «colorante rojo» y tiene alergia declarada a colorante rojo')
    expect(r.validacion.reintentos).toBe(1)

    const k = conOtras('muzzarella')
    const receta = completarCreativa(PAPAS_CON_QUESO, k, papasHorno)
    expect(problemasCreativa(receta, k, papasHorno, [])).toContainEqual(expect.stringContaining('«Queso muzzarella» no puede ir: tiene alergia declarada a muzzarella'))
  })

  it('sin nada seguro para esta comida, dice cuál falta (sin_candidatos)', async () => {
    const k = { ...conocimiento(), seguros: [], momento: 'desayuno' as const }
    const e = await generarRecetaCreativa({ ninoId: 'tomas', momento: 'desayuno' }, { conocimiento: async () => k }).then(() => null, (x: unknown) => x)
    expect((e as ErrorNibble).codigo).toBe('sin_candidatos')
    expect((e as ErrorNibble).message).toBe(`Todavía no sabemos qué come ${k.nombre} en el desayuno: registrá un desayuno o contanos qué come.`)
    expect(textoSinSeguros('Lucía', 'merienda')).toBe('Todavía no sabemos qué come Lucía en la merienda: registrá una merienda o contanos qué come.')
    expect(llm).not.toHaveBeenCalled()
  })
})

describe('(v5.6) calidad: el corazón de la app no puede ser una receta pobre', () => {
  const pureDePapa = catalogo.get('pure_papa')
  const desdePapas = papasHorno
  const receta = (s: Partial<SalidaCreativa>) => {
    const salida = { ...PAPAS_CON_QUESO, ...s }
    const k = conocimiento()
    return completarCreativa(salida, k, desdePapas)
  }

  it('el cambio no puede ser solo aceite: "puré con aceite de canola" no pasa', () => {
    const conAceite = receta({ nombre: 'Papas al horno con aceite de canola', ingredientes: [{ alimentoId: 'papa', gramos: 120 }, { alimentoId: 'aceite_canola', gramos: 10 }, { alimentoId: 'aceite_girasol', gramos: 5 }] })
    const p = problemasDeCalidad(conAceite, desdePapas, 0)
    expect(p.join(' ')).toMatch(/un aceite, una grasa o un dulce no es un plato nuevo/)
    expect(p.join(' ')).toMatch(/habla del aceite/)
    expect(pureDePapa).toBeDefined()
  })

  it('más de lo mismo (sus mismos ingredientes) no pasa', () => {
    const mismo = receta({ nombre: 'Papas al horno extra crocantes', ingredientes: desdePapas.ingredientes.map((i) => ({ ...i, gramos: i.gramos + 10 })) })
    expect(problemasDeCalidad(mismo, desdePapas, 0).join(' ')).toMatch(/es más de lo mismo/)
  })

  it('pocos ingredientes o pocos pasos no pasan', () => {
    const simple = receta({ ingredientes: [{ alimentoId: 'queso_muzzarella', gramos: 40 }], pasos: ['Cortá.', 'Horneá.'] })
    const p = problemasDeCalidad(simple, desdePapas, 0).join(' ')
    expect(p).toMatch(/muy simple/)
    expect(p).toMatch(/al menos 4/)
  })

  it('el nutriente tiene que venir de un alimento, no del aceite', () => {
    const omega = receta({ nutriente: 'calcio_mg', ingredientes: [{ alimentoId: 'papa', gramos: 120 }, { alimentoId: 'zanahoria', gramos: 20 }, { alimentoId: 'aceite_canola', gramos: 15 }] })
    // Con un mínimo que solo el aceite haría alcanzar: el aporte total llega y sin el aceite no
    const sinAceite = omega.aporte.omega3_g - calcularAporte([{ alimentoId: 'aceite_canola', gramos: 15 }]).omega3_g
    const conOmega = { ...omega, evidencia: { ...omega.evidencia, nutriente: 'omega3_g' as const } }
    expect(problemasDeCalidad(conOmega, desdePapas, (omega.aporte.omega3_g + sinAceite) / 2).join(' ')).toMatch(/sale casi todo del aceite/)
  })

  it('una receta elaborada de verdad pasa', () => {
    expect(problemasDeCalidad(receta({}), desdePapas, 0)).toEqual([])
  })
})

describe('(v5.7) la comida completa: lo nuevo + lo que ya come, equilibrado para esa comida', () => {
  const k = kPapas
  const armar = (s: Partial<SalidaCreativa>) => completarCreativa({ ...PAPAS_CON_QUESO, ...s }, k(), papasHorno)
  const problemas = (s: Partial<SalidaCreativa>) => problemasCreativa(armar(s), k(), papasHorno, [], { ...PAPAS_CON_QUESO, ...s }.acompanamientos)

  it('arma el plato con lo nuevo primero, lo que ya come después y el aporte del plato entero', () => {
    const r = armar({})
    expect(r.platoCompleto?.componentes.map((c) => [c.preparacionId, c.nuevo, c.rol])).toEqual([
      ['nuevo_papas_al_horno_con_queso_gratinado', true, 'principal'],
      ['papas_fritas_baston', false, 'guarnicion'],
      ['bastones_zanahoria_horno', false, 'verdura_fruta'],
    ])
    expect(r.platoCompleto!.aporte.energia_kcal).toBeGreaterThan(r.aporte.energia_kcal)
    expect(r.platoCompleto!.aporte.proteina_g).toBeGreaterThan(r.aporte.proteina_g)
    expect(r.platoCompleto!.cubreDelDia.energia_kcal).toBeGreaterThan(0.25)
    expect(problemas({})).toEqual([])
  })

  it('una cena con solo lo nuevo se completa sola con lo que ya come (nunca queda un plato suelto)', () => {
    const r = armar({ acompanamientos: [] })
    const otros = r.platoCompleto!.componentes.filter((c) => !c.nuevo)
    expect(otros.length).toBeGreaterThanOrEqual(1)
    for (const c of otros) expect(k().seguros.map((s) => s.id)).toContain(c.preparacionId)
    expect(problemas({ acompanamientos: [] }).join(' ')).not.toMatch(/El plato tiene 1 cosa/)
  })

  it('la energía y la proteína del plato entero tienen que ser las de esa comida', () => {
    // Lo que ya come se ajusta solo a las calorías de la comida (sin gastar un reintento)
    const chico = [{ preparacionId: 'papas_fritas_baston', rol: 'guarnicion' as const, gramos: 15 }, { preparacionId: 'bastones_zanahoria_horno', rol: 'verdura_fruta' as const, gramos: 15 }]
    const r = armar({ acompanamientos: chico })
    expect(r.platoCompleto!.componentes.filter((c) => !c.nuevo).every((c) => c.gramos > 15)).toBe(true)
    expect(problemasCreativa(r, k(), papasHorno, []).join(' ')).not.toMatch(/kcal/)
    // Si ni así entra (lo nuevo solo ya se pasa), lo dice
    const enorme = armar({ ingredientes: [{ alimentoId: 'papa', gramos: 300 }, { alimentoId: 'queso_muzzarella', gramos: 200 }, { alimentoId: 'aceite_girasol', gramos: 30 }] })
    expect(problemasCreativa(enorme, k(), papasHorno, []).join(' ')).toMatch(/kcal y una comida completa para cena va de \d+ a \d+ kcal/)
  })

  it('un solo principal y solo cosas que ya come', () => {
    const dos = [{ preparacionId: 'milanesa_carne_horno', rol: 'principal' as const, gramos: 120 }, { preparacionId: 'papas_fritas_baston', rol: 'guarnicion' as const, gramos: 60 }]
    expect(problemas({ rol: 'principal', acompanamientos: dos }).join(' ')).toMatch(/Hay dos platos principales/)
    // En la cena lo nuevo es el principal (pedido de la familia: platos potentes), no una guarnición
    expect(problemas({ rol: 'guarnicion', acompanamientos: dos }).join(' ')).toMatch(/En cena lo nuevo tiene que ser el principal/)
    const ajeno = [{ preparacionId: 'brocoli_hervido', rol: 'verdura_fruta' as const, gramos: 60 }, { preparacionId: 'milanesa_carne_horno', rol: 'principal' as const, gramos: 120 }]
    expect(problemas({ acompanamientos: ajeno }).join(' ')).toMatch(/brocoli_hervido no está entre lo que ya come/)
  })

  it('el prompt le pide la comida completa con lo que ya come y el rango de calorías', async () => {
    responde(PAPAS_CON_QUESO)
    await pedir()
    expect(promptDe(0)).toMatch(/La receta es una COMIDA COMPLETA para cena: un principal potente/)
    expect(promptDe(0)).toMatch(/- milanesa_carne_horno: Milanesa de carne al horno .* · proteina · ~\d+ g/)
    expect(promptDe(0)).toMatch(/El plato entero tiene que tener entre \d+ y \d+ kcal y al menos \d+ g de proteína/)
  })
})

describe('(v5.8) repertorio chico: el plato se completa con lo que haya', () => {
  it('si lo que ya come no alcanza sin otro principal, el mínimo baja (nunca a menos de 1)', () => {
    const k = conocimiento()
    const soloProteinas = { ...k, seguros: k.seguros.map((s) => ({ ...s, atributos: { ...s.atributos, grupo: 'proteina' as const } })) }
    expect(minimoComponentes(soloProteinas)).toBe(1)
    const unaGuarnicion = { ...soloProteinas, seguros: [...soloProteinas.seguros.slice(1), { ...k.seguros[0]!, atributos: { ...k.seguros[0]!.atributos, grupo: 'cereal_almidon' as const } }] }
    expect(minimoComponentes(unaGuarnicion)).toBe(2)
    expect(minimoComponentes(k)).toBeLessThanOrEqual(3)
  })
})

describe('(v5.10) el foco es obligatorio en el primer intento; lo que ya usó hace poco, nunca', () => {
  // De sus papas al horno a bastones de boniato con queso rallado: cambia solo el ingrediente principal
  const BONIATO: SalidaCreativa = {
    ...PAPAS_CON_QUESO,
    nombre: 'Bastones de boniato al horno con queso rallado',
    atributos: { ...papasHorno.atributos, color: 'naranja', coccion: 'horno' },
    imagen: { uno: 'sweet potato fry', varios: 'sweet potato fries', aspecto: 'orange sweet potato sticks shaped exactly like French fries, oven-baked until crispy, with grated cheese' },
    ingredientes: [{ alimentoId: 'boniato', gramos: 120 }, { alimentoId: 'queso_rallado', gramos: 15 }, { alimentoId: 'aceite_girasol', gramos: 5 }],
    pasos: ['Pelá el boniato y cortalo en bastones como sus papas.', 'Pincelalos con aceite.', 'Horneá 25 minutos hasta que estén crocantes.', 'Espolvoreá el queso rallado y gratiná 3 minutos.'],
    porQue: 'Parte de sus papas al horno en bastones, que come siempre; cambia solo el ingrediente principal: boniato, gratinado con queso rallado, que aporta calcio.',
  }
  const cambiarA = (ingrediente: string): Foco => ({ desdeId: 'papas_horno_baston', modo: 'cambiar_principal', nutriente: 'calcio_mg', ingrediente })
  const schemaDe = (llamada: number) => llm.mock.calls[llamada]![0].schema as { safeParse: (x: unknown) => { success: boolean } }
  const errorDe = (p: Promise<unknown>) => p.then(() => null, (x: unknown) => x as ErrorNibble)

  it('el prompt nombra el ingrediente del foco: el principal, o el que se suma', async () => {
    responde(BONIATO)
    const r = await pedir(undefined, conFoco(conocimiento(), cambiarA('boniato')))
    expect(promptDe(0)).toContain('Esta vez: partí de «Papas al horno en bastones, crocantes» (papas_horno_baston), cambiá el ingrediente principal: el ingrediente principal (el de más gramos) es «Boniato cocido» (boniato); mantené')
    expect(promptDe(0)).toContain('Es lo que pide la app: no partas de otro alimento seguro ni cambies de ingrediente.')
    expect(r.validacion.reintentos).toBe(0)
    responde(PAPAS_CON_QUESO)
    await pedir()
    expect(promptDe(1)).toContain('mantené su plato y sumale «Queso muzzarella» (queso_muzzarella), sin cambiar nada más')
    expect(llm).toHaveBeenCalledTimes(2)
  })

  it('el schema de los intentos con foco solo acepta su alimento de partida; el del reintento relajado, todos sus seguros', async () => {
    responde(BONIATO, BONIATO, BONIATO)
    await pedir(undefined, conFoco(conocimiento(), cambiarA('zapallo')))
    const deSusFritas = { ...BONIATO, desdeId: 'papas_fritas_baston' }
    expect(schemaDe(0).safeParse(BONIATO).success).toBe(true)
    expect(schemaDe(0).safeParse(deSusFritas).success).toBe(false)
    expect(schemaDe(1).safeParse(deSusFritas).success).toBe(false)
    expect(schemaDe(2).safeParse(deSusFritas).success).toBe(true)
    // Los acompañamientos salen de todo lo que come seguro, en los dos intentos
    const conSusFritas = { ...BONIATO, acompanamientos: [{ preparacionId: 'papas_fritas_baston', rol: 'guarnicion', gramos: 60 }] }
    expect(schemaDe(0).safeParse(conSusFritas).success).toBe(true)
  })

  it('otro principal no pasa con el foco y sí en el reintento relajado (y queda en el log)', async () => {
    responde(BONIATO, BONIATO, BONIATO)
    const r = await pedir(undefined, conFoco(conocimiento(), cambiarA('zapallo')))
    expect(llm).toHaveBeenCalledTimes(3)
    const otroPrincipal = 'Esta vez el ingrediente principal (el de más gramos) tiene que ser Zapallo cocido (zapallo), y en «Bastones de boniato al horno con queso rallado» es Boniato cocido'
    expect(problemasDe(1)).toContain(otroPrincipal)
    expect(promptDe(2)).toContain(otroPrincipal)
    expect(promptDe(2)).toContain('Si así no se puede cumplir alguna regla o el mínimo del nutriente, elegí otro alimento seguro, otro ingrediente rico en calcio u otro nutriente de la lista.')
    expect(r.nombre).toBe(BONIATO.nombre)
    expect(r.validacion).toEqual({ ok: true, problemas: [], reintentos: 2 })
    expect(vi.mocked(console.info)).toHaveBeenCalledWith(expect.stringMatching(/"resultado":"intento","intento":2,"paso":"relajado","foco":\{.*"ingrediente":"zapallo"\},"estricto":false/))
  })

  it('sumar_ingrediente: el primer intento tiene que llevarlo; en el reintento puede sumar otro, pero no uno que ya usó', () => {
    const foco = { ...FOCO_PAPAS, ingrediente: 'queso_rallado' }
    const k = conFoco(conocimiento(), foco)
    const receta = completarCreativa(PAPAS_CON_QUESO, k, papasHorno)
    expect(problemasCreativa(receta, k, papasHorno, [])).toEqual(['Esta vez a su «Papas al horno en bastones, crocantes» hay que sumarle Queso rallado (queso_rallado), y «Papas al horno con queso gratinado» no lo lleva.'])
    expect(problemasCreativa(receta, k, papasHorno, [], undefined, undefined, true)).toEqual([])
    const yaUso = conFoco(conocimiento(), foco, ['queso_muzzarella'])
    expect(problemasCreativa(receta, yaUso, papasHorno, [], undefined, undefined, true)).toEqual(['Ya usó Queso muzzarella hace poco (está en las recetas que vio la familia): sumale otro alimento.'])
  })

  it('un principal que ya usó hace poco no pasa nunca: ni en el primer intento ni en el reintento', async () => {
    const k = conFoco(conocimiento(), cambiarA('zapallo'), ['boniato'])
    responde(BONIATO, BONIATO, BONIATO)
    const e = await errorDe(pedir(['Bastones de boniato fritos'], k))
    expect(e?.codigo).toBe('sin_candidatos')
    const yaUso = 'Ya usó Boniato cocido hace poco (está en las recetas que vio la familia): el ingrediente principal de «Bastones de boniato al horno con queso rallado» tiene que ser otro.'
    expect(promptDe(2)).toContain(yaUso)
    expect((e?.detalle as { problemas: string[] }).problemas).toContain(yaUso)
    expect(promptDe(0)).toContain('Ya usó hace poco (ninguno puede ser el ingrediente principal): «Boniato cocido» (boniato).')
    // Con el foco cumplido también: el ingrediente sorteado no salva un principal repetido
    const conBoniato = conFoco(conocimiento(), cambiarA('boniato'), ['boniato'])
    expect(problemasCreativa(completarCreativa(BONIATO, conBoniato, papasHorno), conBoniato, papasHorno, [])).toEqual([yaUso])
  })

  describe('si no pasa, otro foco; si tampoco y queda tiempo, el reintento relajado', () => {
    const papasFritas = catalogo.get('papas_fritas_baston')!
    // De sus papas fritas a bastones de boniato fritos con queso rallado: cambia solo el ingrediente principal
    const BONIATO_FRITO: SalidaCreativa = {
      ...BONIATO,
      desdeId: 'papas_fritas_baston',
      nombre: 'Bastones de boniato fritos con queso rallado',
      atributos: { ...papasFritas.atributos, color: 'naranja', coccion: 'frito' },
      acompanamientos: [{ preparacionId: 'papas_horno_baston', rol: 'guarnicion', gramos: 60 }, { preparacionId: 'bastones_zanahoria_horno', rol: 'verdura_fruta', gramos: 60 }],
      pasos: ['Pelá el boniato y cortalo en bastones como sus papas.', 'Secalos bien.', 'Freílos hasta que estén crocantes.', 'Espolvoreá el queso rallado y serví.'],
    }
    const conocimientoCon = (...focos: Foco[]) => {
      const deps = vi.fn<DepsRecetaCreativa['conocimiento']>()
      for (const foco of focos) deps.mockResolvedValueOnce(conFoco(conocimiento(), foco))
      return deps
    }
    const logs = () => vi.mocked(console.info).mock.calls.map(([l]) => String(l))

    it('falla el primero → el segundo pide otro foco (evitar lleva el del primero) y también es estricto', async () => {
      const otro: Foco = { desdeId: 'papas_fritas_baston', modo: 'cambiar_principal', nutriente: 'calcio_mg', ingrediente: 'boniato' }
      const deps = conocimientoCon(cambiarA('zapallo'), otro)
      responde(BONIATO, BONIATO_FRITO)
      const r = await generarRecetaCreativa({ ninoId: 'tomas', momento: 'cena', anteriores: ['Medallones de ricota'] }, { conocimiento: deps, alIntentar: (x) => { intentos.push(x) } })
      expect(deps).toHaveBeenCalledTimes(2)
      expect(deps).toHaveBeenLastCalledWith('tomas', { momento: 'cena', anteriores: ['Medallones de ricota'], evitar: { desdeIds: ['papas_horno_baston'], ingredientes: ['zapallo'] } })
      // Un pedido nuevo, con el foco nuevo y estricto: ni los problemas del primero ni su escapatoria
      expect(promptDe(1)).toContain(`Esta vez: partí de «${papasFritas.nombre}» (papas_fritas_baston), cambiá el ingrediente principal: el ingrediente principal (el de más gramos) es «Boniato cocido» (boniato)`)
      expect(promptDe(1)).toContain('Es lo que pide la app: no partas de otro alimento seguro ni cambies de ingrediente.')
      expect(promptDe(1)).not.toContain('tiene que ser Zapallo cocido')
      expect(schemaDe(1).safeParse(BONIATO_FRITO).success).toBe(true)
      expect(schemaDe(1).safeParse(BONIATO).success).toBe(false)
      expect(r.desde.preparacionId).toBe('papas_fritas_baston')
      expect(r.validacion).toEqual({ ok: true, problemas: [], reintentos: 1 })
      // En el log, el foco de cada intento
      expect(logs()).toContainEqual(expect.stringMatching(/"resultado":"intento","intento":0,"paso":"foco","foco":\{"desdeId":"papas_horno_baston".*"ingrediente":"zapallo"\},"estricto":true/))
      expect(logs()).toContainEqual(expect.stringMatching(/"resultado":"intento","intento":1,"paso":"otro_foco","foco":\{"desdeId":"papas_fritas_baston".*"ingrediente":"boniato"\},"estricto":true/))
      expect(intentos.map((x) => x.foco?.ingrediente)).toEqual(['zapallo', 'boniato'])
    })

    it('fallan los dos con foco → el tercero relaja el último, con sus problemas (sin pedir otro conocimiento)', async () => {
      const deps = conocimientoCon(cambiarA('zapallo'), cambiarA('zanahoria'))
      responde(BONIATO, BONIATO, BONIATO)
      const r = await generarRecetaCreativa({ ninoId: 'tomas', momento: 'cena' }, { conocimiento: deps })
      expect(deps).toHaveBeenCalledTimes(2)
      expect(deps).toHaveBeenLastCalledWith('tomas', { momento: 'cena', evitar: { desdeIds: ['papas_horno_baston'], ingredientes: ['zapallo'] } })
      expect(llm).toHaveBeenCalledTimes(3)
      expect(promptDe(2)).toContain('tiene que ser Zanahoria (zanahoria), y en «Bastones de boniato al horno con queso rallado» es Boniato cocido')
      expect(promptDe(2)).not.toContain('tiene que ser Zapallo cocido')
      expect(schemaDe(2).safeParse({ ...BONIATO, desdeId: 'papas_fritas_baston' }).success).toBe(true)
      expect(r.validacion).toEqual({ ok: true, problemas: [], reintentos: 2 })
      expect(logs()).toContainEqual(expect.stringMatching(/"resultado":"intento","intento":2,"paso":"relajado","foco":\{.*"ingrediente":"zanahoria"\},"estricto":false,"problemas":\[/))
    })

    it('sin tiempo, no hay tercero: pasado TOPE_NUEVA_LLAMADA_MS no arranca otra llamada, y cada una lleva lo que queda de CORTE_MS', async () => {
      let reloj = 0
      const tarda = (ms: number) => llm.mockImplementationOnce(async () => {
        reloj += ms
        return { datos: BONIATO, modelo: 'claude-sonnet-5-5', ms, reintentos: 0 }
      })
      const mitad = TOPE_NUEVA_LLAMADA_MS / 2
      tarda(mitad + 1)
      tarda(mitad)
      const deps = conocimientoCon(cambiarA('zapallo'), cambiarA('zanahoria'))
      const e = await errorDe(generarRecetaCreativa({ ninoId: 'tomas', momento: 'cena' }, { conocimiento: deps, ahora: () => reloj }))
      expect(llm).toHaveBeenCalledTimes(2)
      expect(llm.mock.calls[0]![0].limiteMs).toBe(CORTE_MS)
      expect(llm.mock.calls[1]![0].limiteMs).toBe(CORTE_MS - (mitad + 1))
      expect(e?.codigo).toBe('timeout')
      expect((e?.detalle as { problemas: string[] }).problemas).toContainEqual(expect.stringContaining('tiene que ser Zanahoria (zanahoria)'))
      expect(vi.mocked(console.warn)).toHaveBeenCalledWith(expect.stringMatching(/"resultado":"sin_tiempo","intento":2,"focos":\[\{.*"zapallo".*\},\{.*"zanahoria".*\}\]/))
    })

    it('con el plato elegido no hay foco: el primero y el reintento, sin pedir otro conocimiento', async () => {
      const deps = vi.fn(async () => kPapas())
      const candidato = {
        preparacionId: 'papas_fritas_baston', nombre: papasFritas.nombre, puntaje: 1, camino: { desde: papasHorno.nombre, aceptacion: '8/8', atributos: [] },
        desdeId: 'papas_horno_baston', cambio: 'coccion' as const, seMantiene: [], patrones: [], aportePorcion: {},
      }
      const conHuevo = { ...PAPAS_CON_QUESO, ingredientes: [...PAPAS_CON_QUESO.ingredientes, { alimentoId: 'huevo', gramos: 20 }] }
      responde(conHuevo, conHuevo)
      const e = await errorDe(generarRecetaCreativa(
        { ninoId: 'tomas', momento: 'cena', preparacionId: 'papas_fritas_baston' },
        { conocimiento: deps, elegido: async () => ({ preparacion: papasFritas, desde: papasHorno, candidato }) },
      ))
      expect(e?.codigo).toBe('sin_candidatos')
      expect(llm).toHaveBeenCalledTimes(2)
      expect(deps).toHaveBeenCalledTimes(1)
      expect(promptDe(1)).toMatch(/huevo/i)
    })
  })

})

describe('(v5.10) las recetas que ya vio llegan al conocimiento (para el ingrediente del foco y los recientes)', () => {
  it('llegan a deps.conocimiento (las últimas 10), y armarConocimientoReceta las pasa a conocimientoDe', async () => {
    const vistas = Array.from({ length: 12 }, (_, i) => `Receta ${i + 1}`)
    const deps = vi.fn(async () => kPapas())
    responde(PAPAS_CON_QUESO)
    await generarRecetaCreativa({ ninoId: 'tomas', momento: 'cena', nutriente: 'calcio_mg', anteriores: vistas }, { conocimiento: deps })
    expect(deps).toHaveBeenCalledWith('tomas', { nutriente: 'calcio_mg', momento: 'cena', anteriores: vistas.slice(-10) })

    vi.mocked(cargarNino).mockResolvedValueOnce(cargado)
    await armarConocimientoReceta('tomas', { momento: 'cena', anteriores: ['Medallones de ricota'] })
    expect(vi.mocked(conocimientoDe)).toHaveBeenLastCalledWith(cargado, { momento: 'cena', anteriores: ['Medallones de ricota'] })
  })
})

describe('(v5.10) cada cosa en su comida, y un solo plato principal (server/ia/momentos.ts)', () => {
  // Los ravioles no están en el fixture de alimentos: los del catálogo real
  beforeAll(() => fijarAlimentos([...alimentos.values(), alimentosCatalogo().get('ravioles')!]))
  afterAll(() => fijarAlimentos([...alimentos.values()]))
  const prep = (id: string) => catalogo.get(id)!
  const tostadas = prep('tostadas')
  const milanesa = prep('milanesa_carne_horno')
  const conSeguros = (k: Conocimiento, ...ids: string[]): ConocimientoReceta => ({ ...k, seguros: [...ids.map(prep), ...k.seguros.filter((x) => !ids.includes(x.id))], recientes: [] })
  const atributosDe = (p: PreparacionCatalogo): SalidaCreativa['atributos'] => ({ ...p.atributos, coccion: p.atributos.coccion ?? 'listo' })
  const otrosDe = (r: ReturnType<typeof completarCreativa>) => r.platoCompleto!.componentes.filter((c) => !c.nuevo).map((c) => c.preparacionId)
  const RAVIOLES: SalidaCreativa = {
    ...PAPAS_CON_QUESO,
    nombre: 'Ravioles de ricota con manteca',
    rol: 'guarnicion', // el LLM lo pone de guarnición: igual es el plato principal
    acompanamientos: [],
    ingredientes: [{ alimentoId: 'ravioles', gramos: 150 }, { alimentoId: 'manteca', gramos: 5 }, { alimentoId: 'queso_rallado', gramos: 10 }],
  }

  it('(v5.10, franjas) ravioles + tostadas no pasan ni en el desayuno ni en la cena, y el problema se dice una vez', () => {
    // En el desayuno: lo nuevo (los ravioles) es de almuerzo y cena
    const k = conSeguros(conocimiento({ momento: 'desayuno' }), 'tostadas')
    const kd = { ...k, foco: { desdeId: 'tostadas', modo: 'cambiar_principal' as const, nutriente: 'hierro_mg' as const } }
    const conTostadas = { ...RAVIOLES, desdeId: 'tostadas', atributos: atributosDe(tostadas), acompanamientos: [{ preparacionId: 'tostadas', rol: 'cereal_pan' as const, gramos: 40 }] }
    const r = completarCreativa(conTostadas, kd, tostadas)
    const enElDesayuno = problemasCreativa(r, kd, tostadas, [])
    expect(enElDesayuno).toContainEqual(expect.stringMatching(/^«Ravioles de ricota con manteca» es de almuerzo y cena y esta comida es desayuno: lo nuevo tiene que ser de desayuno y merienda \(lácteos/))
    expect(problemasDelMomento(r, kd)).toEqual([]) // ya lo dice el plato: no se repite
    expect(enElDesayuno.join(' ')).not.toMatch(/no es para el desayuno/)
    // Unas tostadas de pan integral sí son de desayuno
    const integrales = completarCreativa({ ...conTostadas, nombre: 'Tostadas de pan integral con queso', acompanamientos: [], ingredientes: [{ alimentoId: 'pan_integral', gramos: 50 }, { alimentoId: 'queso_muzzarella', gramos: 20 }] }, kd, tostadas)
    expect(problemasCreativa(integrales, kd, tostadas, []).join(' ')).not.toMatch(/es de almuerzo y cena|no es para/)

    // En la cena: los ravioles van, sus tostadas no (ni las suma el código, aunque estén primeras en la lista)
    const kc = conFoco(conSeguros(conocimiento(), 'tostadas'))
    expect(otrosDe(completarCreativa(RAVIOLES, kc, papasHorno))).not.toContain('tostadas')
    const enLaCena = completarCreativa({ ...RAVIOLES, acompanamientos: [{ preparacionId: 'tostadas', rol: 'guarnicion', gramos: 40 }, { preparacionId: 'bastones_zanahoria_horno', rol: 'verdura_fruta', gramos: 60 }] }, kc, papasHorno)
    expect(problemasCreativa(enLaCena, kc, papasHorno, [])).toContainEqual(`«${tostadas.nombre}» es de desayuno y merienda: en cena no va, las comidas no se mezclan. Completá con lo que ya come de almuerzo y cena (un plato principal, su guarnición (papa, boniato, arroz, polenta, puré) y verduras; nada de desayuno o merienda (pan, tostadas, galletitas, cereales, leche, yogur ni licuados); la fruta entera, solo de postre).`)
  })

  it('cena con ravioles nuevos: nunca su pizza en el plato (ni la suma el código ni pasa si la elige el LLM)', () => {
    // La pizza primero en la lista: antes, el código la tomaba de guarnición
    const k = conFoco(conSeguros(conocimiento(), 'pizza_muzzarella'))
    const r = completarCreativa(RAVIOLES, k, papasHorno)
    expect(r.platoCompleto!.componentes[0]).toMatchObject({ nuevo: true, rol: 'principal' })
    expect(otrosDe(r)).not.toContain('pizza_muzzarella')
    expect(otrosDe(r)).not.toContain('milanesa_carne_horno')
    expect(otrosDe(r).length).toBeGreaterThan(0)
    expect(problemasCreativa(r, k, papasHorno, []).join(' ')).not.toMatch(/dos platos principales/)

    const conPizza = { ...RAVIOLES, acompanamientos: [{ preparacionId: 'pizza_muzzarella', rol: 'guarnicion' as const, gramos: 100 }, { preparacionId: 'bastones_zanahoria_horno', rol: 'verdura_fruta' as const, gramos: 60 }] }
    const conLaPizza = completarCreativa(conPizza, k, papasHorno)
    const pizza = prep('pizza_muzzarella').nombre
    expect(problemasCreativa(conLaPizza, k, papasHorno, [])).toContainEqual(expect.stringContaining(`Hay dos platos principales («Ravioles de ricota con manteca» y «${pizza}»): una comida lleva uno solo. Sacá «${pizza}» y completá con una guarnición`))
  })

  it('milanesa nueva: ningún otro principal (ni nuggets, ni hamburguesa, ni pizza, ni fideos)', () => {
    const principales = ['nuggets_pollo_horno', 'hamburguesa_casera', 'pizza_muzzarella', 'fideos_con_salsa']
    const k = conFoco(conSeguros(conocimiento(), ...principales), { desdeId: 'milanesa_carne_horno', modo: 'cambiar_principal', nutriente: 'proteina_g', ingrediente: 'pollo' })
    const MILANESA_POLLO: SalidaCreativa = {
      ...PAPAS_CON_QUESO,
      desdeId: 'milanesa_carne_horno',
      nombre: 'Milanesa de pollo al horno',
      atributos: atributosDe(milanesa),
      acompanamientos: [],
      ingredientes: [{ alimentoId: 'pollo', gramos: 110 }, { alimentoId: 'pan_rallado', gramos: 25 }, { alimentoId: 'leche', gramos: 20 }, { alimentoId: 'aceite_girasol', gramos: 5 }],
    }
    const r = completarCreativa(MILANESA_POLLO, k, milanesa)
    expect(otrosDe(r).length).toBeGreaterThanOrEqual(2)
    for (const id of otrosDe(r)) expect(esPlatoPrincipal(prep(id)), id).toBe(false)
    expect(problemasCreativa(r, k, milanesa, []).join(' ')).not.toMatch(/dos platos principales/)

    const conNuggets = completarCreativa({ ...MILANESA_POLLO, acompanamientos: [{ preparacionId: 'nuggets_pollo_horno', rol: 'guarnicion', gramos: 80 }, { preparacionId: 'papas_fritas_baston', rol: 'guarnicion', gramos: 60 }] }, k, milanesa)
    expect(problemasCreativa(conNuggets, k, milanesa, [])).toContainEqual(expect.stringMatching(/^Hay dos platos principales \(«Milanesa de pollo al horno» y «Nuggets de pollo/))
  })

  it('el cereal o pan del desayuno es pan, tostadas o galletitas: nunca su pizza', () => {
    const k = { ...conSeguros(conocimiento({ momento: 'merienda' }), 'pizza_muzzarella', 'tostadas', 'yogur_vainilla'), foco: { desdeId: 'yogur_vainilla', modo: 'sumar_ingrediente' as const, nutriente: 'calcio_mg' as const } }
    const yogur = prep('yogur_vainilla')
    const YOGUR: SalidaCreativa = {
      ...PAPAS_CON_QUESO, desdeId: 'yogur_vainilla', nombre: 'Yogur de vainilla con banana pisada', atributos: atributosDe(yogur), rol: 'lacteo', acompanamientos: [],
      ingredientes: [{ alimentoId: 'yogur', gramos: 150 }, { alimentoId: 'banana', gramos: 50 }],
    }
    const r = completarCreativa(YOGUR, k, yogur)
    expect(r.platoCompleto!.componentes.find((c) => c.rol === 'cereal_pan')?.preparacionId).toBe('tostadas')
    expect(otrosDe(r)).not.toContain('pizza_muzzarella')
    const conPizza = completarCreativa({ ...YOGUR, acompanamientos: [{ preparacionId: 'pizza_muzzarella', rol: 'cereal_pan', gramos: 60 }] }, k, yogur)
    expect(problemasCreativa(conPizza, k, yogur, [])).toContainEqual(`«${prep('pizza_muzzarella').nombre}» no es el cereal o pan para merienda: ese lugar es para pan, tostadas, galletitas o un cereal (avena, copos), nunca pizza ni pasta.`)
  })
})

describe('(v5.10) el nombre dice qué es el plato, sin compararlo con lo que ya come', () => {
  // Los del pedido y los de eval/resultados/variedad-*.md
  const CON_COMPARACION: [string, string][] = [
    ['Milanesa de arvejas al horno, crocante como la de lentejas', 'Milanesa de arvejas al horno'],
    ['Nuggets de ricota dorados y crocantes, como sus nuggets', 'Nuggets de ricota dorados y crocantes'],
    ['Milanesas de arvejas secas al horno, crocantes como sus milanesas', 'Milanesas de arvejas secas al horno'],
    ['Milanesa de pollo al horno con rebozado de lino, crocante como la suya', 'Milanesa de pollo al horno con rebozado de lino'],
    ['Milanesas de garbanzos y dambo al horno, crocantes como las suyas', 'Milanesas de garbanzos y dambo al horno'],
    ['Medallones de ricota dorados al horno, crocantes como su milanesa', 'Medallones de ricota dorados al horno'],
    ['Pizzetas de porotos y muzzarella al horno, crocantes como su pizza', 'Pizzetas de porotos y muzzarella al horno'],
    ['Crema de ricota y vainilla, bien fría como su yogur', 'Crema de ricota y vainilla'],
    ['Crema fría de avena y manzana, suave como su banana pisada', 'Crema fría de avena y manzana'],
    ['Cremita fría de vainilla en vasito, como su yogur', 'Cremita fría de vainilla en vasito'],
    ['Galletas crocantes de queso al horno, finitas como sus tostadas', 'Galletas crocantes de queso al horno'],
    ['Huevo duro desmenuzado tibio, tierno como su pollo', 'Huevo duro desmenuzado tibio'],
    ['Postre frío de leche y vainilla, cremoso como su yogur', 'Postre frío de leche y vainilla'],
    ['Tortilla de huevo enriquecido y papa desmenuzada, tibia y tierna como su pollo', 'Tortilla de huevo enriquecido y papa desmenuzada'],
    // Sin coma, entre paréntesis, con raya, "igual que" y una parte que dice con qué
    ['Bastones de zanahoria fritos como sus papas', 'Bastones de zanahoria fritos'],
    ['Milanesa de lentejas (igual que la suya, al horno)', 'Milanesa de lentejas'],
    ['Tostadas con palta — igual que sus tostadas de siempre', 'Tostadas con palta'],
    ['Puré de zapallo cremoso, con queso rallado como el suyo', 'Puré de zapallo cremoso, con queso rallado'],
  ]
  const SIN_COMPARACION = [
    'Licuado cremoso de naranja y leche, bien frío', 'Crema fría de ravioles de ricota y cacao, para tomar en vaso', 'Hojuelas crocantes de papa y lino, para el desayuno',
    'Milanesa de avena y queso al horno, dorada y crocante', 'Nuggets de pollo y queso, fritos y crocantes', 'Bastones de polenta con queso, gratinados al horno', 'Crema de pera y avena, como postre',
  ]

  it('limpiarNombre saca la comparación (los casos reales) y deja igual lo demás', () => {
    for (const [con, sin] of CON_COMPARACION) expect(limpiarNombre(con), con).toBe(sin)
    for (const n of SIN_COMPARACION) expect(limpiarNombre(n), n).toBe(n)
  })

  it('se limpia sin gastar un reintento; si no queda un nombre, es un problema para el reintento', async () => {
    responde({ ...PAPAS_CON_QUESO, nombre: 'Papas al horno con queso gratinado, crocantes como las suyas' })
    const r = await pedir()
    expect(r.nombre).toBe('Papas al horno con queso gratinado')
    expect(r.preparacionBaseId).toBe('nuevo_papas_al_horno_con_queso_gratinado')
    expect(r.validacion.reintentos).toBe(0)

    responde({ ...PAPAS_CON_QUESO, nombre: 'Crocantes como las suyas' }, PAPAS_CON_QUESO)
    const otra = await pedir()
    expect(problemasDe(1)).toContain('El nombre tiene que decir qué es el plato (por ejemplo «Milanesa de arvejas al horno» o «Bastones de boniato fritos»), sin nombrar ni comparar con lo que ya come: sin la comparación, «Crocantes». La comparación con lo que ya come va en porQue.')
    expect(otra.nombre).toBe(PAPAS_CON_QUESO.nombre)
    const vacio = completarCreativa({ ...PAPAS_CON_QUESO, nombre: 'Como su milanesa' }, kPapas(), papasHorno)
    expect(problemasCreativa(vacio, kPapas(), papasHorno, [])).toContainEqual(expect.stringContaining('sin la comparación, no queda nada.'))
  })

  it('una receta que ya vio con la comparación es la misma receta', () => {
    const r = completarCreativa(PAPAS_CON_QUESO, kPapas(), papasHorno)
    expect(problemasCreativa(r, kPapas(), papasHorno, ['Papas al horno con queso gratinado, crocantes como las suyas'])).toContain('«Papas al horno con queso gratinado» ya lo vio la familia: proponé un plato distinto.')
  })

  it('con el plato elegido, también se limpia; si no queda un nombre, el del catálogo (sin reintento)', () => {
    const pure = catalogo.get('pure_papa_queso')!
    const pureSimple = catalogo.get('pure_papa')!
    const candidato = {
      preparacionId: pure.id, nombre: pure.nombre, puntaje: 1, camino: { desde: pureSimple.nombre, aceptacion: '8/8', atributos: [] },
      desdeId: pureSimple.id, cambio: 'ingrediente' as const, seMantiene: [], patrones: [], aportePorcion: {},
    }
    const elegido = { preparacion: pure, desde: pureSimple, candidato }
    const salida = { ...PAPAS_CON_QUESO, desdeId: pureSimple.id, ingredientes: pure.ingredientes }
    expect(completarCreativa({ ...salida, nombre: 'Puré de papa con queso, cremoso como el suyo' }, kPapas(), pureSimple, elegido).nombre).toBe('Puré de papa con queso')
    const sinNombre = completarCreativa({ ...salida, nombre: 'Como su puré' }, kPapas(), pureSimple, elegido)
    expect(sinNombre.nombre).toBe(pure.nombre)
    expect(problemasCreativa(sinNombre, kPapas(), pureSimple, [], undefined, elegido).join(' ')).not.toMatch(/El nombre tiene que decir/)
  })

  it('el prompt lo pide: el sistema (con ejemplos sin comparación), el foco y el plato elegido', async () => {
    expect(SISTEMA_RECETA_CREATIVA).toContain('no nombra su alimento seguro ni lo compara ("como su milanesa", "como la de lentejas", "como las suyas", "igual que sus papas")')
    expect(SISTEMA_RECETA_CREATIVA).not.toMatch(/Así SÍ: [^\n]*como (su|sus|la suya)/)
    responde(PAPAS_CON_QUESO)
    await pedir()
    expect(promptDe(0)).toContain('El nombre dice qué es el plato nuevo, sin nombrar ni comparar con su «Papas al horno en bastones, crocantes» (eso va en porQue).')
  })
})

describe('(v5.10) franjas: desayuno y merienda, almuerzo y cena, sin mezclar (server/ia/momentos.ts)', () => {
  const prep = (id: string) => catalogo.get(id)!
  const atributosDe = (p: PreparacionCatalogo): SalidaCreativa['atributos'] => ({ ...p.atributos, coccion: p.atributos.coccion ?? 'listo' })
  const otrosDe = (r: ReturnType<typeof completarCreativa>) => r.platoCompleto!.componentes.filter((c) => !c.nuevo)
  const conSeguros = (k: Conocimiento, ...ids: string[]): Conocimiento => ({ ...k, seguros: [...ids.map(prep), ...k.seguros.filter((x) => !ids.includes(x.id))] })
  const deLaOtra = (franja: string) => new RegExp(`es de ${franja}`)

  it('yogur y leche no entran en la cena: ni los suma el código ni pasan si los elige el LLM', () => {
    const k = conFoco(conSeguros(conocimiento(), 'yogur_vainilla', 'leche_chocolatada'))
    const r = completarCreativa({ ...PAPAS_CON_QUESO, acompanamientos: [] }, k, papasHorno)
    for (const id of ['yogur_vainilla', 'leche_chocolatada']) expect(otrosDe(r).map((c) => c.preparacionId)).not.toContain(id)
    const conYogur = completarCreativa({ ...PAPAS_CON_QUESO, acompanamientos: [...PAPAS_CON_QUESO.acompanamientos!, { preparacionId: 'yogur_vainilla', rol: 'lacteo', gramos: 120 }] }, k, papasHorno)
    expect(problemasCreativa(conYogur, k, papasHorno, [])).toContainEqual(expect.stringMatching(/^«Yogur de vainilla[^»]*» es de desayuno y merienda: en cena no va, las comidas no se mezclan/))
  })

  it('en almuerzo y cena el cereal o pan no es pan: sus tostadas o galletitas no van ni de cereal_pan ni de guarnición', () => {
    const k = conFoco(conSeguros(conocimiento(), 'tostadas', 'galletitas_agua'))
    for (const rol of ['cereal_pan', 'guarnicion'] as const) {
      const conPan = completarCreativa({ ...PAPAS_CON_QUESO, acompanamientos: [{ preparacionId: 'tostadas', rol, gramos: 40 }, { preparacionId: 'bastones_zanahoria_horno', rol: 'verdura_fruta', gramos: 60 }] }, k, papasHorno)
      expect(problemasCreativa(conPan, k, papasHorno, []).join(' '), rol).toMatch(/es de desayuno y merienda: en cena no va/)
    }
    expect(otrosDe(completarCreativa({ ...PAPAS_CON_QUESO, acompanamientos: [] }, k, papasHorno)).map((c) => c.rol)).not.toContain('cereal_pan')
  })

  it('la fruta sí puede ser el postre de la cena: la que ya come completa el plato, aunque no sea un punto de partida', () => {
    const base = conocimiento()
    const banana = prep('banana_pisada')
    // Sin una verdura que ya come para la cena: la fruta que acepta es su postre
    const k: ConocimientoReceta = { ...base, aceptadas: [...base.aceptadas, banana], foco: FOCO_PAPAS, recientes: [] }
    expect(k.seguros.map((p) => p.id)).not.toContain('banana_pisada')
    const r = completarCreativa({ ...PAPAS_CON_QUESO, acompanamientos: [] }, k, papasHorno)
    expect(otrosDe(r)).toContainEqual(expect.objectContaining({ preparacionId: 'banana_pisada', rol: 'verdura_fruta' }))
    expect(problemasCreativa(r, k, papasHorno, []).join(' ')).not.toMatch(/es de desayuno y merienda|no está entre lo que ya come/)
    // La elige el LLM de postre: pasa; de lácteo, no (no es la excepción)
    const dePostre = completarCreativa({ ...PAPAS_CON_QUESO, acompanamientos: [{ preparacionId: 'papas_fritas_baston', rol: 'guarnicion', gramos: 60 }, { preparacionId: 'banana_pisada', rol: 'verdura_fruta', gramos: 80 }] }, k, papasHorno)
    expect(problemasCreativa(dePostre, k, papasHorno, []).join(' ')).not.toMatch(deLaOtra('desayuno y merienda'))
    const deLacteo = completarCreativa({ ...PAPAS_CON_QUESO, acompanamientos: [{ preparacionId: 'papas_fritas_baston', rol: 'guarnicion', gramos: 60 }, { preparacionId: 'banana_pisada', rol: 'lacteo', gramos: 80 }] }, k, papasHorno)
    expect(problemasCreativa(deLacteo, k, papasHorno, []).join(' ')).toMatch(deLaOtra('desayuno y merienda'))
  })

  it('el plato nuevo también: una milanesa en el desayuno o un licuado en la cena no pasan (y con el plato elegido, igual)', () => {
    const tostadas = prep('tostadas')
    const kd: ConocimientoReceta = { ...conSeguros(conocimiento({ momento: 'desayuno' }), 'tostadas'), foco: { desdeId: 'tostadas', modo: 'cambiar_principal', nutriente: 'proteina_g' }, recientes: [] }
    const MILANESA: SalidaCreativa = {
      ...PAPAS_CON_QUESO, desdeId: 'tostadas', nombre: 'Milanesa de pollo al horno', atributos: atributosDe(tostadas), rol: 'principal', acompanamientos: [],
      ingredientes: [{ alimentoId: 'pollo', gramos: 110 }, { alimentoId: 'pan_rallado', gramos: 25 }, { alimentoId: 'aceite_girasol', gramos: 5 }],
    }
    expect(problemasCreativa(completarCreativa(MILANESA, kd, tostadas), kd, tostadas, [])).toContainEqual(expect.stringMatching(/^«Milanesa de pollo al horno» es de almuerzo y cena y esta comida es desayuno: lo nuevo tiene que ser de desayuno y merienda/))

    const LICUADO: SalidaCreativa = {
      ...PAPAS_CON_QUESO, nombre: 'Licuado de banana y leche', rol: 'lacteo',
      ingredientes: [{ alimentoId: 'leche', gramos: 180 }, { alimentoId: 'banana', gramos: 80 }, { alimentoId: 'azucar', gramos: 5 }],
    }
    expect(problemasCreativa(completarCreativa(LICUADO, kPapas(), papasHorno), kPapas(), papasHorno, [])).toContainEqual(expect.stringMatching(/^«Licuado de banana y leche» es de desayuno y merienda y esta comida es cena: lo nuevo tiene que ser de almuerzo y cena/))

    // Con el plato elegido: su milanesa del catálogo en el desayuno no pasa
    const milanesa = prep('milanesa_carne_horno')
    const candidato = {
      preparacionId: milanesa.id, nombre: milanesa.nombre, puntaje: 1, camino: { desde: tostadas.nombre, aceptacion: '8/8', atributos: [] },
      desdeId: tostadas.id, cambio: 'ingrediente' as const, seMantiene: [], patrones: [], aportePorcion: {},
    }
    const elegido = { preparacion: milanesa, desde: tostadas, candidato }
    const r = completarCreativa({ ...MILANESA, nombre: milanesa.nombre, ingredientes: milanesa.ingredientes }, kd, tostadas, elegido)
    expect(problemasCreativa(r, kd, tostadas, [], undefined, elegido).join(' ')).toMatch(/es de almuerzo y cena y esta comida es desayuno/)
  })
})
