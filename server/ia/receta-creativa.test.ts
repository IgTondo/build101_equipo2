// v5.4 · La receta creativa: la base de conocimiento de Tomás (dataset sintético, §10.5) y generarRecetaCreativa() con
// generarJSON mockeado (ningún test llama a un modelo real).
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cargarNino } from '../datos/cargar.js'
import { alimentosPrueba, catalogoPrueba, comidasSinteticas, ninoDoc, sintetico } from '../datos/prueba/catalogos.js'
import { conocimientoDe, type Conocimiento, type Foco } from '../grafo/conocimiento.js'
import { ErrorNibble } from '../http.js'
import { objetivosPara } from '../nutricion/objetivos.js'
import { fijarAlimentos } from './catalogo.js'
import { generarJSON } from './modelo.js'
import type { SalidaCreativa } from './prompts/receta-creativa.js'
import { calcularAporte } from '../validacion/receta.js'
import { minimoComponentes } from './plato-completo.js'
import { armarConocimientoReceta, completarCreativa, generarRecetaCreativa, problemasCreativa, problemasDeCalidad, textoSinSeguros, type ConocimientoReceta } from './receta-creativa.js'

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
  acompanamientos: [{ preparacionId: 'milanesa_carne_horno', rol: 'guarnicion', gramos: 130 }, { preparacionId: 'papas_fritas_baston', rol: 'guarnicion', gramos: 60 }],
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
const conFoco = (k: Conocimiento, foco: Foco = FOCO_PAPAS, recientes: string[] = []): ConocimientoReceta => ({ ...k, foco, recientes })
const kPapas = () => conFoco(conocimiento())

const responde = (...salidas: SalidaCreativa[]) => {
  for (const datos of salidas) llm.mockResolvedValueOnce({ datos, modelo: 'claude-sonnet-5-5', ms: 10, reintentos: 0 })
}
const promptDe = (llamada: number) => {
  const parte = llm.mock.calls[llamada]![0].partes[0]!
  return parte.tipo === 'texto' ? parte.texto : ''
}
const pedir = (anteriores?: string[], k: ConocimientoReceta = kPapas()) =>
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
    expect(promptDe(1)).toContain('aparece «colorante rojo» y tiene alergia declarada a colorante rojo')
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
      ['milanesa_carne_horno', false, 'guarnicion'],
      ['papas_fritas_baston', false, 'guarnicion'],
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
    const chico = [{ preparacionId: 'milanesa_carne_horno', rol: 'guarnicion' as const, gramos: 15 }, { preparacionId: 'papas_fritas_baston', rol: 'guarnicion' as const, gramos: 15 }]
    const r = armar({ acompanamientos: chico })
    expect(r.platoCompleto!.componentes.filter((c) => !c.nuevo).every((c) => c.gramos > 15)).toBe(true)
    expect(problemasCreativa(r, k(), papasHorno, []).join(' ')).not.toMatch(/kcal/)
    // Si ni así entra (lo nuevo solo ya se pasa), lo dice
    const enorme = armar({ ingredientes: [{ alimentoId: 'papa', gramos: 300 }, { alimentoId: 'queso_muzzarella', gramos: 200 }, { alimentoId: 'aceite_girasol', gramos: 30 }] })
    expect(problemasCreativa(enorme, k(), papasHorno, []).join(' ')).toMatch(/kcal y una comida completa para cena va de \d+ a \d+ kcal/)
  })

  it('un solo principal y solo cosas que ya come', () => {
    const dos = [{ preparacionId: 'milanesa_carne_horno', rol: 'principal' as const, gramos: 120 }, { preparacionId: 'papas_fritas_baston', rol: 'guarnicion' as const, gramos: 60 }]
    expect(problemas({ rol: 'principal', acompanamientos: dos }).join(' ')).toMatch(/Hay dos principales/)
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

  it('el schema del primer intento solo acepta el alimento de partida del foco; el del reintento, todos sus seguros', async () => {
    responde(BONIATO, BONIATO)
    await pedir(undefined, conFoco(conocimiento(), cambiarA('zapallo')))
    const deSusFritas = { ...BONIATO, desdeId: 'papas_fritas_baston' }
    expect(schemaDe(0).safeParse(BONIATO).success).toBe(true)
    expect(schemaDe(0).safeParse(deSusFritas).success).toBe(false)
    expect(schemaDe(1).safeParse(deSusFritas).success).toBe(true)
    // Los acompañamientos salen de todo lo que come seguro, en los dos intentos
    const conSusFritas = { ...BONIATO, acompanamientos: [{ preparacionId: 'papas_fritas_baston', rol: 'guarnicion', gramos: 60 }] }
    expect(schemaDe(0).safeParse(conSusFritas).success).toBe(true)
  })

  it('otro principal no pasa en el primer intento y sí en el reintento (el foco se relaja y queda en el log)', async () => {
    responde(BONIATO, BONIATO)
    const r = await pedir(undefined, conFoco(conocimiento(), cambiarA('zapallo')))
    expect(llm).toHaveBeenCalledTimes(2)
    expect(promptDe(1)).toContain('Esta vez el ingrediente principal (el de más gramos) tiene que ser Zapallo cocido (zapallo), y en «Bastones de boniato al horno con queso rallado» es Boniato cocido')
    expect(promptDe(1)).toContain('Si así no se puede cumplir alguna regla o el mínimo del nutriente, elegí otro alimento seguro, otro ingrediente rico en calcio u otro nutriente de la lista.')
    expect(r.nombre).toBe(BONIATO.nombre)
    expect(r.validacion).toEqual({ ok: true, problemas: [], reintentos: 1 })
    expect(vi.mocked(console.info)).toHaveBeenCalledWith(expect.stringMatching(/"resultado":"foco_relajado","intento":1/))
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
    responde(BONIATO, BONIATO)
    const e = await errorDe(pedir(['Bastones de boniato fritos'], k))
    expect(e?.codigo).toBe('sin_candidatos')
    const yaUso = 'Ya usó Boniato cocido hace poco (está en las recetas que vio la familia): el ingrediente principal de «Bastones de boniato al horno con queso rallado» tiene que ser otro.'
    expect(promptDe(1)).toContain(yaUso)
    expect((e?.detalle as { problemas: string[] }).problemas).toContain(yaUso)
    expect(promptDe(0)).toContain('Ya usó hace poco (ninguno puede ser el ingrediente principal): «Boniato cocido» (boniato).')
    // Con el foco cumplido también: el ingrediente sorteado no salva un principal repetido
    const conBoniato = conFoco(conocimiento(), cambiarA('boniato'), ['boniato'])
    expect(problemasCreativa(completarCreativa(BONIATO, conBoniato, papasHorno), conBoniato, papasHorno, [])).toEqual([yaUso])
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
