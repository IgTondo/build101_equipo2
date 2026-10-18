// Las relaciones entre alimentos tienen que ser ciertas (precisión primero). Regresión de "Leche chocolatada: se parece
// a su sushi, cambia solo la cocción": un alimento contado a medias (Rosario, "Sushi": frío, crudo, sin ingredientes)
// quedaba a "un cambio" de todo lo frío. Los fixtures se arman acá, sin la base.
import { describe, expect, it } from 'vitest'
import type { Atributos, Momento, Nutriente } from '../../shared/contratos.js'
import { MOMENTO } from '../../shared/contratos.js'
import { alimentosPrueba, catalogoPrueba, comidasSinteticas, ninoDoc, sintetico } from '../datos/prueba/catalogos.js'
import type { Cargado } from '../datos/cargar.js'
import type { NinoDoc } from '../datos/tipos.js'
import { conocimientoDe } from '../grafo/conocimiento.js'
import { franjaDe, franjaDePreparacion } from '../ia/momentos.js'
import { CON_META, objetivosPara } from '../nutricion/objetivos.js'
import type { EstadoPrep } from './aceptacion.js'
import { type EntradaCadena, type PasoCadena, type PrepConocida, cambios, candidatosCadena, esAncla, esSegura } from './cadena.js'
import { calcularEstado } from './estado.js'
import { type NodoPreparacion, propagar } from './propagacion.js'
import { recomendar } from './recomendador.js'

const catalogo = catalogoPrueba()
const alimentos = alimentosPrueba()
const objetivo = objetivosPara(7, 'femenino')

const acepta = (prepId: string, p = 0.9, veces = 5): EstadoPrep => ({
  prepId, nombre: prepId, p, veces, declarada: veces ? null : 'acepta', estado: 'acepta', pasos: [], mejorPaso: null, comio: veces,
  primeraISO: null, ultimaISO: null,
})

/** "Sushi" como lo contó la familia de Rosario: frío, crudo, del grupo otro y nada más. */
const SUSHI_CONTADO: PrepConocida = { id: 'sushi', nombre: 'Sushi', atributos: { temperatura: 'frio', grupo: 'otro', coccion: 'crudo' }, ingredientes: [] }
/** El mismo sushi completo: arroz con merluza (pescado). */
const SUSHI_COMPLETO: PrepConocida = {
  id: 'sushi',
  nombre: 'Sushi',
  atributos: { textura: 'blando', forma: 'redondo', color: 'blanco', sabor: 'salado', temperatura: 'frio', presentacion: 'separado', grupo: 'cereal_almidon', coccion: 'hervido' },
  ingredientes: [{ alimentoId: 'arroz', gramos: 80 }, { alimentoId: 'merluza', gramos: 30 }],
  momentos: ['almuerzo', 'cena'],
}

function entrada(op: {
  acepta: (string | EstadoPrep)[]; extra?: PrepConocida[]; alergias?: EntradaCadena['alergias']; momento?: Momento; prohibidos?: Set<string>
}): EntradaCadena {
  const conocidas = new Map<string, PrepConocida>(catalogo)
  for (const p of op.extra ?? []) conocidas.set(p.id, p)
  const estados = new Map(op.acepta.map((a) => (typeof a === 'string' ? acepta(a) : a)).map((s) => [s.prepId, s]))
  return {
    catalogo: [...catalogo.values()], conocidas, estados, alergias: op.alergias ?? [], reglas: [], alimentos, objetivo,
    ...(op.momento ? { momento: op.momento } : {}), ...(op.prohibidos ? { prohibidos: op.prohibidos } : {}),
  }
}

const todos = (e: EntradaCadena): (PasoCadena & { n: Nutriente })[] => CON_META.flatMap((n) => candidatosCadena(e, n).map((p) => ({ ...p, n })))
const par = (p: PasoCadena) => `${p.cand.id} <- ${p.desde.id}`

/** Lo que tiene que valer para todo paso: el origen es un ancla, está a un solo cambio y se mantienen al menos 4 dimensiones. */
function invariantes(pasos: readonly PasoCadena[], e: EntradaCadena) {
  for (const p of pasos) {
    expect(esAncla(p.desde), par(p)).toBe(true)
    expect(e.estados.get(p.desde.id)?.estado, par(p)).toBe('acepta')
    expect(esSegura(p.desde, e.alergias, alimentos, e.prohibidos), par(p)).toBe(true)
    if (p.cambio === 'fortificar') {
      expect(p.cand.fortificadaDe, par(p)).toBe(p.desde.id)
      continue
    }
    expect(cambios(p.desde, p.cand), par(p)).toHaveLength(1)
    expect(p.seMantiene.length, par(p)).toBeGreaterThanOrEqual(4)
    // v5.10 · Por franja (desayuno y merienda o almuerzo y cena): la del catálogo o la de su tipo
    if (e.momento) expect(franjaDePreparacion(p.desde, catalogo), par(p)).toBe(franjaDe(e.momento))
  }
}

const ROSARIO = { acepta: ['hamburguesa_casera', 'milanesa_carne_horno', 'sushi'], extra: [SUSHI_CONTADO], alergias: ['pescado', 'sesamo'] as EntradaCadena['alergias'] }

describe('el origen es un ancla (D1): lo contado a medias no es punto de partida', () => {
  it('esAncla: las 5 dimensiones y un ingrediente principal conocido (no un "otro_…" de la visión)', () => {
    expect(esAncla(SUSHI_CONTADO)).toBe(false)
    expect(esAncla(SUSHI_COMPLETO)).toBe(true)
    expect(esAncla({ ...SUSHI_COMPLETO, ingredientes: [{ alimentoId: 'otro_pescado', gramos: 90 }, { alimentoId: 'arroz', gramos: 30 }] })).toBe(false)
    expect(esAncla({ ...SUSHI_COMPLETO, atributos: { ...SUSHI_COMPLETO.atributos, sabor: undefined } })).toBe(false)
    for (const p of catalogo.values()) expect(esAncla(p), p.id).toBe(true)
  })

  it('Rosario: el sushi contado nunca es origen; ninguna bebida ni lácteo "se parece a su sushi"', () => {
    for (const momento of [undefined, ...MOMENTO]) {
      const e = entrada({ ...ROSARIO, ...(momento ? { momento } : {}) })
      const pasos = todos(e)
      expect(pasos.map((p) => p.desde.id), String(momento)).not.toContain('sushi')
      invariantes(pasos, e)
    }
    // Sin una sola relación inventada, el desayuno y la merienda quedan vacíos (hamburguesa y milanesa son de almuerzo y cena)
    expect(todos(entrada({ ...ROSARIO, momento: 'desayuno' }))).toEqual([])
    expect(todos(entrada({ ...ROSARIO, momento: 'merienda' }))).toEqual([])
  })

  it('el recomendador de Rosario para el desayuno no dice "Se parece a su sushi"', () => {
    const e = { ...entrada({ ...ROSARIO, momento: 'desayuno' }), observaciones: [], patrones: [], faltan: ['proteina_g' as const], coberturaSemana: { ...objetivo } }
    const rec = recomendar(e)
    expect(rec.candidatos).toEqual([])
    for (const s of rec.sugerencias) expect(s.porQue).not.toMatch(/sushi/i)
  })

  it('invariante con la historia entera de Valentina, en cada comida y para cada nutriente', () => {
    const s = sintetico('valentina')
    const comidas = comidasSinteticas(s, alimentos, catalogo)
    const estado = calcularEstado(ninoDoc(s, '2026-09-07T07:00:00-03:00'), comidas, catalogo)
    for (const momento of [undefined, ...MOMENTO]) {
      const e: EntradaCadena = {
        catalogo: [...catalogo.values()], conocidas: estado.conocidas, estados: estado.estados, alergias: s.datos.alergias, reglas: [], alimentos,
        objetivo: objetivosPara(s.datos.edad, s.datos.sexo), ...(momento ? { momento } : {}),
      }
      invariantes(todos(e), e)
    }
  })
})

describe('las cadenas que tienen sentido siguen estando', () => {
  const e = entrada({ acepta: ['papas_fritas_baston', 'milanesa_carne_horno', 'leche_chocolatada', 'tostadas'] })
  const pares = new Set(todos(e).map(par))

  it.each([
    ['bastones_boniato_fritos', 'papas_fritas_baston'],
    ['milanesa_lentejas_horno', 'milanesa_carne_horno'],
    ['licuado_banana_leche', 'leche_chocolatada'],
    ['tostadas_queso', 'tostadas'],
    ['leche_chocolatada_fortificada', 'leche_chocolatada'],
  ])('%s <- %s', (cand, desde) => {
    expect(pares).toContain(`${cand} <- ${desde}`)
  })

  it('cumplen el invariante', () => invariantes(todos(e), e))
})

describe('la versión fortificada viene de su base (D2)', () => {
  it('si acepta la base, la única forma de llegar a la fortificada es fortificar su base', () => {
    const e = entrada({ acepta: ['leche_chocolatada', acepta('licuado_banana_leche', 1, 20)] })
    const fortificada = todos(e).filter((p) => p.cand.id === 'leche_chocolatada_fortificada')
    expect(fortificada.length).toBeGreaterThan(0)
    for (const p of fortificada) {
      expect(p.desde.id, p.n).toBe('leche_chocolatada')
      expect(p.cambio, p.n).toBe('fortificar')
    }
    // Para calcio no suma el 5%: no aparece (antes salía "desde el licuado, cambia el ingrediente")
    expect(candidatosCadena(e, 'calcio_mg').map((p) => p.cand.id)).not.toContain('leche_chocolatada_fortificada')
  })

  it('si no acepta la base, la fortificada puede venir de otro a un cambio (como cualquier preparación)', () => {
    const e = entrada({ acepta: ['licuado_banana_leche'] })
    const desdes = new Set(todos(e).filter((p) => p.cand.id === 'leche_chocolatada_fortificada').map((p) => p.desde.id))
    expect([...desdes].every((d) => d === 'licuado_banana_leche')).toBe(true)
  })
})

describe('el origen va en la comida (D3), por franja (v5.10: desayuno y merienda o almuerzo y cena, no se mezclan)', () => {
  it.each(MOMENTO)('%s: cada origen es de la franja de esa comida', (momento) => {
    const e = entrada({ acepta: ['papas_fritas_baston', 'milanesa_carne_horno', 'leche_chocolatada', 'tostadas', 'pizza_muzzarella', 'yogur_vainilla'], momento })
    const pasos = todos(e)
    expect(pasos.length).toBeGreaterThan(0)
    for (const p of pasos) expect((catalogo.get(p.desde.id)?.momentos ?? []).map(franjaDe), par(p)).toContain(franjaDe(momento))
    invariantes(pasos, e)
  })

  it('lo que no es del catálogo va por su tipo, nunca por la hora en que lo comió: la pizza de la merienda sigue siendo de almuerzo y cena', () => {
    const milanesa: PrepConocida = { ...catalogo.get('milanesa_carne_horno')!, id: 'milanesa_de_la_abuela', nombre: 'Milanesa de la abuela', momentos: ['cena'] }
    const pizza: PrepConocida = { ...catalogo.get('pizza_muzzarella')!, id: 'pizza_de_la_esquina', nombre: 'Pizza de la esquina', momentos: ['merienda'] }
    const origenes = (id: string, extra: PrepConocida, momento: Momento) => todos(entrada({ acepta: [id], extra: [extra], momento })).map((p) => p.desde.id)
    expect(origenes('milanesa_de_la_abuela', milanesa, 'almuerzo')).toContain('milanesa_de_la_abuela') // misma franja que la cena
    expect(origenes('milanesa_de_la_abuela', milanesa, 'desayuno')).toEqual([])
    expect(origenes('pizza_de_la_esquina', pizza, 'merienda')).toEqual([])
    expect(origenes('pizza_de_la_esquina', pizza, 'cena')).toContain('pizza_de_la_esquina')
  })
})

describe('a igual dificultad, el origen más parecido (D4)', () => {
  it('la milanesa con huevo viene de su milanesa aunque la pizza la acepte más', () => {
    const e = entrada({ acepta: [acepta('milanesa_carne_horno', 0.7, 4), acepta('pizza_muzzarella', 0.99, 20)] })
    const huevo = todos(e).filter((p) => p.cand.id === 'milanesa_carne_con_huevo')
    expect(huevo.length).toBeGreaterThan(0)
    for (const p of huevo) expect(p.desde.id, p.n).toBe('milanesa_carne_horno')
  })
})

describe('alergias en el origen y en el candidato (D6)', () => {
  it('sin ingredientes conocidos no se puede garantizar (si hay algo que cuidar)', () => {
    expect(esSegura({ ingredientes: [] }, ['pescado'], alimentos)).toBe(false)
    expect(esSegura({ ingredientes: [] }, [], alimentos, new Set(['manzana']))).toBe(false)
    expect(esSegura({ ingredientes: [] }, [], alimentos)).toBe(true)
  })

  it('prohibidos (alergias contadas con palabras): ningún ingrediente puede estar', () => {
    expect(esSegura({ ingredientes: [{ alimentoId: 'manzana', gramos: 60 }] }, [], alimentos, new Set(['manzana']))).toBe(false)
    expect(esSegura({ ingredientes: [{ alimentoId: 'banana', gramos: 60 }] }, [], alimentos, new Set(['manzana']))).toBe(true)
    const e = entrada({ acepta: ['papas_fritas_baston'], prohibidos: new Set(['boniato']) })
    expect(todos(e).map((p) => p.cand.id)).not.toContain('bastones_boniato_fritos')
  })

  it('un sushi completo con pescado no es origen para una chica alérgica al pescado (y sí para otra)', () => {
    const conAlergia = todos(entrada({ acepta: ['sushi'], extra: [SUSHI_COMPLETO], alergias: ['pescado'] }))
    expect(conAlergia.map((p) => p.desde.id)).not.toContain('sushi')
    const sin = entrada({ acepta: ['sushi'], extra: [SUSHI_COMPLETO] })
    invariantes(todos(sin), sin)
  })

  it('un origen con un alimento prohibido no es punto de partida', () => {
    const e = entrada({ acepta: ['papas_fritas_baston'], prohibidos: new Set(['papa']) })
    expect(todos(e)).toEqual([])
  })
})

describe('un paso suma del nutriente (D7)', () => {
  it('todo candidato que no es fortificado aporta estrictamente más que su origen', async () => {
    const { aporte } = await import('../nutricion/calcular.js')
    const e = entrada({ acepta: ['papas_fritas_baston', 'milanesa_carne_horno', 'leche_chocolatada', 'tostadas', 'pizza_muzzarella', 'yogur_vainilla', 'banana_pisada'] })
    for (const p of todos(e)) {
      if (p.cambio === 'fortificar') continue
      expect(p.aporte[p.n], `${par(p)} ${p.n}`).toBeGreaterThan(aporte(p.desde.ingredientes, alimentos).nutrientes[p.n])
    }
  })
})

describe('propagación con nodos incompletos (D5)', () => {
  // Un grafo chico: A (semilla positiva) se parece a B en 4 atributos; X (la semilla que se prueba) comparte con C solo
  // lo dulce, lo frío y la fruta. X "contado a medias" tiene solo esos 3; X completo tiene además 5 propios.
  const propios = (pre: string, comunes: Partial<Atributos> = {}) => ({
    textura: `${pre}_t`, forma: `${pre}_f`, color: `${pre}_c`, sabor: `${pre}_s`, temperatura: `${pre}_te`, presentacion: `${pre}_p`, grupo: `${pre}_g`, coccion: `${pre}_co`,
    ...comunes,
  }) as unknown as Partial<Atributos>
  const tres: Partial<Atributos> = { sabor: 'dulce', temperatura: 'frio', grupo: 'fruta' }
  const A = { id: 'A', atributos: propios('a') }
  const B = { id: 'B', atributos: propios('b', { textura: 'a_t', forma: 'a_f', color: 'a_c', sabor: 'a_s' } as unknown as Partial<Atributos>) }
  const C = { id: 'C', atributos: propios('c', tres) }
  const incompleta: NodoPreparacion = { id: 'X', atributos: tres }
  const completa: NodoPreparacion = { id: 'X', atributos: propios('x', tres) }
  const puntajeC = (X: NodoPreparacion, p: number) => propagar([A, B, C, X], new Map([['A', 0.95], ['X', p]])).get('C') ?? 0

  it('una semilla positiva incompleta no empuja más que la misma semilla completa (antes: 1 contra 0,88)', () => {
    expect(puntajeC(incompleta, 0.95)).toBeGreaterThan(0)
    expect(puntajeC(incompleta, 0.95)).toBeLessThanOrEqual(puntajeC(completa, 0.95))
  })

  it('un rechazo incompleto no hunde más que el mismo rechazo completo (antes: −0,82 contra −0,34)', () => {
    expect(puntajeC(incompleta, 0.05)).toBeLessThan(0)
    expect(Math.abs(puntajeC(incompleta, 0.05))).toBeLessThanOrEqual(Math.abs(puntajeC(completa, 0.05)))
  })

  it('con el catálogo (todo completo) sigue igual: lo parecido a lo que acepta sube, lo parecido a lo que rechaza baja', () => {
    const nodos = [...catalogo.values()].map((p) => ({ id: p.id, atributos: p.atributos }))
    const r = propagar(nodos, new Map([['milanesa_carne_horno', 0.95], ['manzana_bastones', 0.1]]))
    expect(r.get('milanesa_carne_con_huevo')).toBeGreaterThan(0)
    expect(r.get('manzana_bastones')).toBeLessThan(0)
  })
})

describe('la base de la receta creativa parte de lo que va en esa comida, sin respaldo (D3)', () => {
  const nino: NinoDoc = ninoDoc({
    ninoId: 'rosario-prueba',
    datos: { nombre: 'Rosario', edad: 7, sexo: 'femenino', alergias: ['pescado', 'sesamo'], alertas: [], dieta: 'ninguna' },
    borrador: {
      acepta: [
        { nombre: 'Hamburguesa casera', preparacionId: 'hamburguesa_casera', atributos: catalogo.get('hamburguesa_casera')!.atributos },
        { nombre: 'Milanesa al horno', preparacionId: 'milanesa_carne_horno', atributos: catalogo.get('milanesa_carne_horno')!.atributos },
        { nombre: 'Sushi', preparacionId: null, atributos: SUSHI_CONTADO.atributos },
      ],
      rechaza: [],
      reglas: [],
    },
    reglasOcultas: [],
    comidas: [],
  })
  const cargado: Cargado = { nino, comidas: [], catalogo, alimentos, objetivo }
  const k = (momento?: Momento) => conocimientoDe(cargado, { hoy: '2026-10-18', azar: () => 0.4, ...(momento ? { momento } : {}) })

  it('desayuno y merienda: sin puntos de partida (no se cae a la milanesa ni al sushi), con el momento para el mensaje', () => {
    for (const momento of ['desayuno', 'merienda'] as const) {
      const x = k(momento)
      expect(x.seguros, momento).toEqual([])
      expect(x.momento).toBe(momento)
      expect(x.foco.desdeId).toBe('')
      expect(x.texto).not.toMatch(/^- (hamburguesa_casera|milanesa_carne_horno|sushi):/m)
    }
  })

  it('almuerzo y cena: la hamburguesa y la milanesa, nunca el sushi (incompleto y con pescado probable)', () => {
    for (const momento of ['almuerzo', 'cena'] as const) {
      const ids = k(momento).seguros.map((p) => p.id).sort()
      expect(ids, momento).toEqual(['hamburguesa_casera', 'milanesa_carne_horno'])
    }
  })
})
