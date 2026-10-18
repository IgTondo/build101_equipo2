// v5.10 · La variedad de la receta creativa, del lado del grafo (conocimientoDe): los "Ricos en X" uno por familia y sin
// golosinas, el ingrediente del foco sorteado entre ellos y lo que ya usó en las recetas que vio la familia, afuera. Sin
// Mongo: Valentina del dataset sintético (§10.5) con los catálogos reales, como la cargaría cargarNino().
// v5.10 · Y el sorteo pesado por las afinidades (server/ia/afinidades.ts): con pares de ejemplo (fijarAfinidades) y, donde
// se dice, con data/afinidades.json.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { MOMENTO, NUTRIENTE, type Momento, type Nutriente } from '../../shared/contratos.js'
import { principal } from '../aprendizaje/cadena.js'
import { alimentosCatalogo, preparacionesCatalogo } from '../datos/catalogos.js'
import { type Cargado, objetivoDe } from '../datos/cargar.js'
import { comidasSinteticas, ninoDoc, sintetico, type SinteticoId } from '../datos/prueba/catalogos.js'
import { fijarAfinidades, type ParAfinidad } from '../ia/afinidades.js'
import { escalar } from '../nutricion/calcular.js'
import {
  ACOMPANAMIENTOS, GOLOSINAS_Y_ULTRAPROCESADOS, GRUPOS_PARA_CAMBIAR, afinidadConPlato, conDatos, conocimientoDe, contextoAfinidad, familia, recientesDe,
  type Conocimiento, type Foco,
} from './conocimiento.js'

const HOY = '2026-10-18' // el último día del historial de Valentina
const catalogo = new Map(preparacionesCatalogo())
const alimentos = new Map(alimentosCatalogo())

/** El chico sintético con los catálogos reales; con `factor` < 1 el objetivo diario se achica (0,01: todo cubierto). */
function cargado(id: SinteticoId, factor = 1, creadoISO?: string): Cargado {
  const s = sintetico(id)
  const nino = ninoDoc(s, creadoISO)
  return { nino, comidas: comidasSinteticas(s, alimentos, catalogo), catalogo, alimentos, objetivo: escalar(objetivoDe(nino), factor) }
}
const valentina = cargado('valentina', 1, '2026-09-07T07:00:00-03:00')

type Op = Parameters<typeof conocimientoDe>[1]
const conocimiento = (op: Op = {}, c = valentina): Conocimiento => conocimientoDe(c, { hoy: HOY, momento: 'almuerzo', azar: () => 0.4, ...op })
const ricosDe = (k: Conocimiento, n: Nutriente) => k.nutrientes.find((x) => x.nutriente === n)?.ricos.map((r) => r.alimentoId) ?? []
const deSuPlato = (k: Conocimiento) => k.seguros.find((p) => p.id === k.foco.desdeId)?.ingredientes.map((i) => i.alimentoId) ?? []
const principalDe = (k: Conocimiento, id = k.foco.desdeId) => principal(k.seguros.find((p) => p.id === id)?.ingredientes ?? [])
const noIdentifican = (id: string) => ACOMPANAMIENTOS.has(id) || GOLOSINAS_Y_ULTRAPROCESADOS.has(id)
/** Lo que puede ser el principal de un plato nuevo: ni frutos secos ni semillas (grupo otro), y una porción de 40 g o más. */
const puedeSerPrincipal = (id: string) => alimentos.get(id)!.grupo !== 'otro' && alimentos.get(id)!.porcionMedianaG >= 40
const AZARES = [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 0.99]
/** Un azar con semilla (congruencial lineal): cada llamada da otro número, y la misma semilla, la misma secuencia. */
/** Un azar que da estos números en orden (y después repite el último): el sorteo es desde, modo, nutriente e ingrediente. */
const enOrden = (...xs: number[]) => {
  let i = 0
  return () => xs[Math.min(i++, xs.length - 1)]!
}
const conSemilla = (semilla: number) => {
  let x = semilla
  return () => (x = (x * 9301 + 49297) % 233280) / 233280
}

// Cada conocimientoDe() recalcula el estado y la recomendación enteros: lo que comparten los tests se arma una vez
const porNutriente = new Map(NUTRIENTE.map((n) => [n, conocimiento({ nutriente: n })]))
const calcio = porNutriente.get('calcio_mg')!
const calcioPorAzar = AZARES.map((a) => conocimiento({ nutriente: 'calcio_mg', azar: () => a }))

describe('conocimientoDe: los ricos en cada nutriente', () => {
  it('"ricos en calcio" van por porción: entran un yogur y una leche, como máximo un queso, de más a menos', () => {
    const ricos = calcio.nutrientes[0]!.ricos
    expect(ricos.some((r) => familia(r.alimentoId) === 'yogur') && ricos.some((r) => familia(r.alimentoId) === 'leche')).toBe(true)
    expect(ricos.filter((r) => familia(r.alimentoId) === 'queso').length).toBeLessThanOrEqual(1)
    expect(ricos.length).toBeLessThanOrEqual(8)
    for (const [i, r] of ricos.entries()) {
      expect(r.porcionG).toBe(alimentos.get(r.alimentoId)!.porcionMedianaG)
      expect(r.porPorcion).toBeCloseTo((r.por100g * r.porcionG) / 100, 1)
      if (i > 0) expect(r.porPorcion).toBeLessThanOrEqual(ricos[i - 1]!.porPorcion)
    }
    // El queso rallado tiene más calcio cada 100 g que el yogur, pero su porción es de 10 g
    const rallado = alimentos.get('queso_rallado')!
    expect(rallado.por100g.calcio_mg).toBeGreaterThan(alimentos.get('yogur')!.por100g.calcio_mg)
    expect(ricos.map((r) => r.alimentoId)).not.toContain('queso_rallado')
    expect(calcio.texto).toMatch(/Ricos en calcio, por porción: \w+ \([\d,]+ mg en \d+ g; [\d,]+\/100 g\)/)
  })

  it('como máximo 2 por grupo en cada lista, y de cada familia el que más aporta por porción', () => {
    for (const n of NUTRIENTE) {
      const ricos = porNutriente.get(n)!.nutrientes[0]!.ricos
      const porGrupo = new Map<string, number>()
      for (const r of ricos) porGrupo.set(alimentos.get(r.alimentoId)!.grupo, (porGrupo.get(alimentos.get(r.alimentoId)!.grupo) ?? 0) + 1)
      for (const [g, cuantos] of porGrupo) expect(cuantos, `${n}: ${g}`).toBeLessThanOrEqual(2)
    }
    // Los yogures: el que entra es el de más calcio por porción (sin alérgenos de Valentina, ninguno es golosina)
    const yogures = [...alimentos.values()].filter((a) => familia(a.id) === 'yogur' && !GOLOSINAS_Y_ULTRAPROCESADOS.has(a.id))
    const mejor = yogures.sort((a, b) => b.por100g.calcio_mg * b.porcionMedianaG - a.por100g.calcio_mg * a.porcionMedianaG)[0]!
    expect(ricosDe(calcio, 'calcio_mg')).toContain(mejor.id)
  })

  it('en omega-3 entran pescados, lino y nueces (Tomás, que no es alérgico al pescado), no solo quesos', () => {
    const omega3 = ricosDe(conocimiento({ nutriente: 'omega3_g', momento: 'cena' }, cargado('tomas')), 'omega3_g')
    expect(omega3.some((id) => alimentos.get(id)?.alergenos.includes('pescado'))).toBe(true)
    expect(omega3).toEqual(expect.arrayContaining(['semillas_lino', 'nueces']))
    expect(omega3.filter((id) => familia(id) === 'queso').length).toBeLessThanOrEqual(1)
  })

  it('la crema y el dulce de batata acompañan; el refresco, el jugo envasado y la barra de cereal son golosinas', () => {
    for (const id of ['crema_leche', 'dulce_batata']) expect(ACOMPANAMIENTOS.has(id), id).toBe(true)
    for (const id of ['refresco', 'jugo_envasado', 'barra_cereal']) expect(GOLOSINAS_Y_ULTRAPROCESADOS.has(id), id).toBe(true)
    for (const id of ['crema_leche', 'dulce_batata', 'refresco', 'jugo_envasado', 'barra_cereal']) {
      expect(alimentos.has(id), `${id} está en el catálogo`).toBe(true)
      for (const n of NUTRIENTE) expect(ricosDe(porNutriente.get(n)!, n), `${n}: ${id}`).not.toContain(id)
    }
    expect(recientesDe(['Bastones de boniato con dulce de batata y crema de leche, y un refresco'], alimentos)).toEqual(['boniato'])
  })

  it('un solo alimento por familia en cada lista (un yogur, una leche, un pan)', () => {
    for (const n of NUTRIENTE) {
      const ids = ricosDe(porNutriente.get(n)!, n)
      expect(new Set(ids.map(familia)).size, n).toBe(ids.length)
    }
  })

  it('no hay golosinas, ultraprocesados ni acompañamientos en ninguna lista', () => {
    for (const n of NUTRIENTE) {
      for (const id of ricosDe(porNutriente.get(n)!, n)) {
        expect(GOLOSINAS_Y_ULTRAPROCESADOS.has(id) || ACOMPANAMIENTOS.has(id), `${n}: ${id}`).toBe(false)
        expect(id, n).not.toMatch(/^(otro|fdc)_/)
      }
    }
    expect(ricosDe(calcio, 'calcio_mg')).not.toContain('chocolate')
    expect(ricosDe(calcio, 'calcio_mg')).not.toContain('pan_rallado')
    const omega3 = ricosDe(porNutriente.get('omega3_g')!, 'omega3_g')
    for (const id of ['galletitas_integrales', 'galletitas_agua', 'nuggets_pollo', 'papas_chips', 'papas_fritas', 'medialuna']) expect(omega3).not.toContain(id)
  })
})

describe('conocimientoDe: el ingrediente del foco', () => {
  it('sumando, está entre los ricos de su nutriente; cambiando el principal, es de un grupo que puede reemplazarlo; nunca de su plato', { timeout: 30_000 }, () => {
    let con = 0
    for (const momento of ['almuerzo', 'cena', 'merienda'] as Momento[]) {
      for (const a of AZARES) {
        const k = conocimiento({ momento, azar: () => a })
        const { ingrediente, nutriente, modo } = k.foco
        if (!ingrediente) continue
        con++
        if (modo === 'sumar_ingrediente') expect(ricosDe(k, nutriente!), `${momento} ${a}`).toContain(ingrediente)
        else expect(GRUPOS_PARA_CAMBIAR[alimentos.get(principalDe(k)!)!.grupo], `${momento} ${a}`).toContain(alimentos.get(ingrediente)!.grupo)
        expect(deSuPlato(k), `${momento} ${a}`).not.toContain(ingrediente)
      }
    }
    expect(con).toBeGreaterThanOrEqual(12) // casi siempre hay uno
  })

  it('con azar distinto, el ingrediente cambia: al menos 3 distintos', { timeout: 20_000 }, () => {
    const conAzarFijo = new Set(calcioPorAzar.map((k) => k.foco.ingrediente))
    expect(conAzarFijo.size).toBeGreaterThanOrEqual(3)
    const conSemillas = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((s) => conocimiento({ azar: conSemilla(s) }).foco.ingrediente))
    expect(conSemillas.size).toBeGreaterThanOrEqual(3)
    // La misma semilla, el mismo foco
    expect(conocimiento({ azar: conSemilla(3) }).foco).toEqual(conocimiento({ azar: conSemilla(3) }).foco)
  })

  it('nunca de un grupo que rechaza una regla de la familia ("No come verduras"), aunque esté entre los ricos', () => {
    expect(valentina.nino.reglas.map((r) => r.texto)).toContain('No come verduras')
    // Con el catálogo ampliado (v5.10, capa 1) cambia cuál verdura entra: alcanza con que haya alguna
    expect(ricosDe(calcio, 'calcio_mg').some((id) => alimentos.get(id)?.grupo === 'verdura')).toBe(true)
    for (const [i, k] of calcioPorAzar.entries()) expect(alimentos.get(k.foco.ingrediente!)?.grupo, String(AZARES[i])).not.toBe('verdura')
  })

  it('modo variedad con grupo: el ingrediente es de ese grupo (Tomás nunca comió verdura; Valentina come de todos)', { timeout: 20_000 }, () => {
    const tomas = cargado('tomas', 0.01)
    for (const a of [0, 0.4, 0.8]) {
      const k = conocimiento({ momento: 'cena', azar: () => a }, tomas)
      expect(k.foco.grupo).toBe('verdura')
      const ingrediente = k.foco.ingrediente!
      expect(alimentos.get(ingrediente)?.grupo).toBe('verdura')
      expect(deSuPlato(k)).not.toContain(ingrediente)
      expect(GOLOSINAS_Y_ULTRAPROCESADOS.has(ingrediente) || ACOMPANAMIENTOS.has(ingrediente)).toBe(false)
    }
    // Sin grupo (come de todos), no hay de dónde sortearlo
    const k = conocimiento({}, cargado('valentina', 0.01, '2026-09-07T07:00:00-03:00'))
    expect(k.variedad).toEqual({})
    expect(k.foco.ingrediente).toBeUndefined()
  })
})

describe('conocimientoDe: lo que ya usó (recientes)', () => {
  const MEDALLONES = 'Medallones de ricota crocantes, como sus nuggets'

  it('una receta que ya vio pone lo que lleva en recientes, y lo saca de los ricos y del sorteo', { timeout: 30_000 }, () => {
    const k = conocimiento({ nutriente: 'calcio_mg', anteriores: [MEDALLONES] })
    expect(k.recientes).toEqual(['ricota'])
    expect(ricosDe(k, 'calcio_mg')).not.toContain('ricota')
    expect(k.texto).toContain('Ya usó hace poco (no los repitas como ingrediente principal): ricota.')
    // Con el que más calcio aporta: sale de la lista y del sorteo, y entra otro de su grupo si hay
    const primero = calcio.nutrientes[0]!.ricos[0]!
    const anteriores = [`Licuado de ${primero.nombre.toLowerCase()} y banana`]
    const sin = conocimiento({ nutriente: 'calcio_mg', anteriores })
    expect(sin.recientes).toContain(primero.alimentoId)
    expect(ricosDe(sin, 'calcio_mg')).not.toContain(primero.alimentoId)
    expect(ricosDe(sin, 'calcio_mg').length).toBe(ricosDe(calcio, 'calcio_mg').length)
    for (const a of AZARES) expect(conocimiento({ nutriente: 'calcio_mg', anteriores, azar: () => a }).foco.ingrediente).not.toBe(primero.alimentoId)
  })

  it('sin anteriores no hay recientes ni la línea en el texto', () => {
    const k = conocimiento()
    expect(k.recientes).toEqual([])
    expect(k.texto).not.toContain('Ya usó hace poco')
  })

  it('si sacarlos deja menos de 3 ricos, vuelven los que más aportan; y si no queda ninguno posible, sin ingrediente', () => {
    const antes = ricosDe(calcio, 'calcio_mg')
    const todo = [...alimentos.values()].map((a) => a.nombre)
    const k = conocimiento({ nutriente: 'calcio_mg', anteriores: todo })
    expect(ricosDe(k, 'calcio_mg')).toEqual(antes.slice(0, 3))
    expect(k.foco.ingrediente).toBeUndefined()
  })

  it('sumando un ingrediente, el principal (el de su plato) nunca está en recientes: se parte de otro alimento seguro', { timeout: 20_000 }, () => {
    const sin = conocimiento({ azar: () => 0.8 })
    expect(sin.foco.modo).toBe('sumar_ingrediente')
    const suPrincipal = principalDe(sin)!
    const k = conocimiento({ azar: () => 0.8, anteriores: [`Bastones de ${alimentos.get(suPrincipal)!.nombre.toLowerCase()} gratinados`] })
    expect(k.recientes).toContain(suPrincipal)
    expect(k.foco.modo).toBe('sumar_ingrediente')
    expect(k.foco.desdeId).not.toBe(sin.foco.desdeId)
    expect(k.recientes).not.toContain(principalDe(k))
    // Con cualquier azar y en cualquier comida, con las recetas del diagnóstico
    const DIAGNOSTICO = ['Milanesa con avena', MEDALLONES, 'Milanesa de pollo con costra de queso', 'Pizzetas de porotos y muzzarella', 'Bastones de papa gratinados']
    for (const momento of ['almuerzo', 'merienda'] as Momento[]) {
      for (const a of [0.75, 0.8, 0.9, 0.99]) {
        const x = conocimiento({ momento, azar: () => a, anteriores: DIAGNOSTICO })
        if (x.foco.modo === 'sumar_ingrediente') expect(x.recientes, `${momento} ${a}`).not.toContain(principalDe(x))
      }
    }
  })

  it('y si todos sus puntos de partida tienen el principal reciente, el foco cambia el principal (Tomás en la cena)', () => {
    const tomas = cargado('tomas')
    const sin = conocimiento({ momento: 'cena', azar: () => 0.8 }, tomas)
    expect(sin.foco.modo).toBe('sumar_ingrediente')
    const principales = sin.seguros.map((p) => principal(p.ingredientes)!)
    const k = conocimiento({ momento: 'cena', azar: () => 0.8, anteriores: principales.map((id) => alimentos.get(id)!.nombre) }, tomas)
    for (const id of principales) expect(k.recientes).toContain(id)
    expect(k.foco.modo).toBe('cambiar_principal')
    expect(k.recientes).not.toContain(k.foco.ingrediente)
  })

  it('cada momento sigue teniendo de dónde partir con recientes', { timeout: 20_000 }, () => {
    for (const momento of MOMENTO) expect(conocimiento({ momento, anteriores: [MEDALLONES] }).foco.desdeId, momento).not.toBe('')
  })
})

describe('recientesDe', () => {
  const de = (...nombres: string[]) => recientesDe(nombres, alimentos)

  it('palabras completas, sin mayúsculas ni tildes, contra el nombre y los alias', () => {
    const porotos = [...alimentos.keys()].filter((id) => familia(id) === 'porotos') // "porotos" nombra a la familia
    expect(new Set(de('Pizzetas de porotos y muzzarella'))).toEqual(new Set([...porotos, 'queso_muzzarella']))
    expect(de('Arbolitos de BRÓCOLI gratinados')).toEqual(['brocoli'])
    expect(de('Panqueques de banana')).toEqual(['panqueques', 'banana']) // "pan" no está en "panqueques" (que es un alimento del catálogo)
  })

  it('los alias de menos de 4 letras no cuentan ("pan", "res")', () => {
    expect(de('Tostadas de pan con manteca')).toEqual([]) // la manteca es acompañamiento (la palta ya es un alimento del catálogo)
  })

  it('la familia, cuando nombra a varios: "costra de queso" son todos los quesos', () => {
    const quesos = [...alimentos.keys()].filter((id) => familia(id) === 'queso')
    expect(new Set(de('Milanesa de pollo con costra de queso'))).toEqual(new Set(['pollo', ...quesos]))
  })

  it('solo lo que identifica el plato: sin acompañamientos, golosinas ni rellenos (pan rallado, harina, aceite, manteca)', () => {
    expect(de('Milanesa de pollo rebozada con pan rallado y harina, frita en aceite de girasol con manteca')).toEqual(['pollo'])
    expect(de('Panqueques con dulce de leche y chocolate')).toEqual(['panqueques']) // el dulce de leche no es leche
    expect(de('Tostadas con queso crema y tomate')).toEqual(['tomate', 'queso_crema']) // el más largo se consume primero
    const todo = de(...[...alimentos.values()].map((a) => a.nombre))
    expect(todo.length).toBeGreaterThan(40)
    for (const id of todo) expect(noIdentifican(id), id).toBe(false)
  })

  it('lo que viene después de "como su(s)" es su alimento seguro, no lo que lleva', () => {
    expect(de('Medallones de ricota crocantes, como sus nuggets')).toEqual(['ricota'])
    expect(de('Bastones de polenta dorados como su milanesa de pollo')).toEqual(['polenta'])
    expect(de('', '   ')).toEqual([])
  })
})

describe('conocimientoDe: el ingrediente del foco combina con lo que queda de su plato (afinidades)', () => {
  const PARES: ParAfinidad[] = [
    { a: 'banana', b: 'avena', n: 120, afinidad: 0.3 },
    { a: 'banana', b: 'chocolate', n: 90, afinidad: 0.28 }, // una golosina: no va en las combinaciones
    { a: 'banana', b: 'yogur', n: 200, afinidad: 0.25 },
    { a: 'banana', b: 'merluza', n: 10, afinidad: 0.2 }, // pescado, su alergia: tampoco
    { a: 'banana', b: 'frambuesa', n: 70, afinidad: 0.2 },
    { a: 'banana', b: 'huevo_enriquecido', n: 40, afinidad: 0.1 },
    { a: 'pan_rallado', b: 'queso_rallado', n: 300, afinidad: 0.3 },
    { a: 'pan_rallado', b: 'ricota', n: 80, afinidad: 0.15 },
    { a: 'carne_vacuna', b: 'porotos', n: 150, afinidad: 0.2 },
    { a: 'carne_vacuna', b: 'ricota', n: 60, afinidad: 0.1 },
  ]
  const R = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.95] // el número que sortea el ingrediente
  // Los alimentos seguros de Valentina en el desayuno son 9 (el licuado es el 6.º) y en la cena 10 (la milanesa, el último)
  const LICUADO = 0.6
  const MILANESA = 0.95
  const CAMBIAR = 0.1
  const SUMAR = 0.9
  const sorteados = (momento: Momento, desde: number, modo: number, nutriente: Nutriente) =>
    R.map((r) => conocimiento({ momento, nutriente, azar: enOrden(desde, modo, 0, r) }).foco)
  /** Pares de ejemplo: lo de `platos` combina con todo el catálogo menos con la familia de `menos` (no depende de los ricos). */
  const todoMenos = (menos: string, ...platos: string[]): ParAfinidad[] =>
    platos.flatMap((a) => [...alimentos.keys()].filter((b) => b !== a && familia(b) !== familia(menos) && !/^(otro|fdc)_/.test(b)).map((b) => ({ a, b, n: 10, afinidad: 0.2 })))
  /** El primer nutriente con un rico que cumple `es` en esa comida, y cuál: así el que no combina es candidato. */
  const conRico = (momento: Momento, es: (id: string) => boolean) => {
    for (const n of NUTRIENTE) {
      const id = ricosDe(conocimiento({ momento, nutriente: n }), n).find(es)
      if (id) return { n, id }
    }
    return undefined
  }
  const esQueso = (id: string) => familia(id) === 'queso'
  /** El sorteo de antes de las afinidades: por lugar entre los ricos posibles (de n, el primero pesa n … el último 1). */
  const porLugar = (k: Conocimiento, a: number) => {
    const plato = deSuPlato(k)
    const xs = ricosDe(k, k.foco.nutriente!).filter((id) => !plato.includes(id) && alimentos.get(id)?.grupo !== 'verdura') // "No come verduras"
    let r = (a * xs.length * (xs.length + 1)) / 2
    for (const [i, x] of xs.entries()) {
      r -= xs.length - i
      if (r < 0) return x
    }
    return xs.at(-1)
  }
  let info: ReturnType<typeof vi.spyOn>
  beforeEach(() => {
    fijarAfinidades(PARES)
    info = vi.spyOn(console, 'info').mockImplementation(() => {})
  })
  afterAll(() => {
    fijarAfinidades(null)
    vi.restoreAllMocks()
  })

  it('lo que queda del plato: sumando, todo; cambiando el principal, lo demás o, si no queda nada, el principal; sin acompañamientos', () => {
    expect(contextoAfinidad(catalogo.get('licuado_banana_leche'), 'cambiar_principal')).toEqual(['banana'])
    expect(contextoAfinidad(catalogo.get('banana_pisada'), 'cambiar_principal')).toEqual(['banana'])
    expect(contextoAfinidad(catalogo.get('milanesa_carne_horno'), 'cambiar_principal')).toEqual(['pan_rallado'])
    expect(contextoAfinidad(catalogo.get('milanesa_carne_horno'), 'sumar_ingrediente')).toEqual(['carne_vacuna', 'pan_rallado'])
    expect(contextoAfinidad(undefined, 'sumar_ingrediente')).toEqual([])
    // Con los datos reales el pan rallado no está en las recetas de Ahn: cuenta la carne
    fijarAfinidades(null)
    expect(contextoAfinidad(catalogo.get('milanesa_carne_horno'), 'cambiar_principal')).toEqual(['carne_vacuna'])
  })

  it('lo que no está en las recetas de Ahn combina como el de su familia que sí (el yogur bebible, como el yogur)', () => {
    fijarAfinidades([{ a: 'yogur', b: 'banana', n: 10, afinidad: 0.25 }, { a: 'porotos', b: 'carne_vacuna', n: 10, afinidad: 0.2 }])
    expect(conDatos('yogur_bebible')).toBe('yogur')
    expect(afinidadConPlato('yogur_bebible', ['banana'])).toBe(0.25)
    expect(afinidadConPlato('porotos_soja', ['carne_vacuna'])).toBe(0.2)
    expect(afinidadConPlato('banana', ['yogur_bebible'])).toBe(0.25) // también lo del plato
    expect(contextoAfinidad({ ingredientes: [{ alimentoId: 'pan_blanco', gramos: 40 }, { alimentoId: 'yogur_bebible', gramos: 20 }] }, 'cambiar_principal')).toEqual(['yogur_bebible'])
    // Con sus propios datos, los suyos; sin datos ni familia, nada
    fijarAfinidades([{ a: 'yogur', b: 'banana', n: 10, afinidad: 0.25 }, { a: 'yogur_bebible', b: 'banana', n: 10, afinidad: 0.1 }])
    expect(afinidadConPlato('yogur_bebible', ['banana'])).toBe(0.1)
    expect(afinidadConPlato('tofu', ['banana'])).toBe(0)
  })

  it('desde su licuado de banana con leche nunca sale el queso (el dambo, o el que esté entre los ricos: no va con la banana)', { timeout: 60_000 }, () => {
    const rico = conRico('desayuno', esQueso)
    expect(rico).toBeDefined()
    const { n, id: queso } = rico!
    fijarAfinidades(todoMenos(queso, 'banana', 'leche'))
    info.mockClear()
    for (const [modo, nombre] of [[CAMBIAR, 'cambiar_principal'], [SUMAR, 'sumar_ingrediente']] as const) {
      const focos = sorteados('desayuno', LICUADO, modo, n)
      for (const f of focos) expect(f).toMatchObject({ desdeId: 'licuado_banana_leche', modo: nombre })
      expect(focos.map((f) => f.ingrediente), nombre).not.toContain(queso)
      expect(new Set(focos.map((f) => f.ingrediente)).size, nombre).toBeGreaterThanOrEqual(2)
    }
    expect(info).not.toHaveBeenCalled() // combinan al menos 2: no cae al sorteo de antes
  })

  it('desde su milanesa de carne al horno nunca sale un yogur (el que esté entre los ricos)', { timeout: 60_000 }, () => {
    const rico = conRico('cena', (id) => familia(id) === 'yogur')
    expect(rico).toBeDefined()
    const yogur = rico!.id
    fijarAfinidades(todoMenos(yogur, 'carne_vacuna', 'pan_rallado'))
    info.mockClear()
    for (const [modo, nombre] of [[CAMBIAR, 'cambiar_principal'], [SUMAR, 'sumar_ingrediente']] as const) {
      const focos = sorteados('cena', MILANESA, modo, rico!.n)
      for (const f of focos) expect(f).toMatchObject({ desdeId: 'milanesa_carne_horno', modo: nombre })
      expect(focos.map((f) => f.ingrediente), nombre).not.toContain(yogur)
      expect(new Set(focos.map((f) => f.ingrediente)).size, nombre).toBeGreaterThanOrEqual(2)
    }
    expect(info).not.toHaveBeenCalled()
  })

  it('si combinan menos de 2, el sorteo de antes, y queda en el log', { timeout: 30_000 }, () => {
    const { n, id: queso } = conRico('desayuno', esQueso)!
    fijarAfinidades([])
    const antes = sorteados('desayuno', LICUADO, SUMAR, n).map((f) => f.ingrediente)
    const uno = antes.find((id) => id !== queso)!
    fijarAfinidades([{ a: 'banana', b: uno, n: 10, afinidad: 0.2 }])
    info.mockClear()
    expect(sorteados('desayuno', LICUADO, SUMAR, n).map((f) => f.ingrediente)).toEqual(antes)
    expect(JSON.parse(String(info.mock.calls[0]![0]))).toMatchObject({ evento: 'foco_sin_afinidad', desdeId: 'licuado_banana_leche', conQue: ['banana'], combinan: 1 })
  })

  it('sin datos de afinidad, el sorteo es el de antes: sumando, por lugar entre los ricos posibles', { timeout: 30_000 }, () => {
    fijarAfinidades([])
    for (const momento of ['almuerzo', 'desayuno'] as Momento[]) {
      for (const desde of [0.05, 0.35, 0.65, 0.95]) {
        for (const r of [0, 0.3, 0.6, 0.9]) {
          const k = conocimiento({ momento, azar: enOrden(desde, SUMAR, 0, r) })
          expect(k.foco.modo).toBe('sumar_ingrediente')
          expect(k.foco.ingrediente, `${momento} ${desde} ${r}`).toBe(porLugar(k, r))
        }
      }
    }
    expect(conocimiento().texto).not.toContain('Combinaciones probadas')
  })

  it('el LLM lee las combinaciones probadas del principal de su plato: del catálogo, sin alérgenos ni golosinas', () => {
    const k = conocimiento({ momento: 'desayuno', azar: enOrden(0.25, CAMBIAR, 0, 0.5) })
    expect(k.foco.desdeId).toBe('banana_pisada')
    expect(k.texto).toContain('Combinaciones probadas en recetas reales: banana va bien con avena, yogur, frambuesa, huevo_enriquecido.')
    // Con los datos reales: hasta 6, ninguno que no pueda ser lo nuevo
    fijarAfinidades(null)
    const linea = conocimiento({ momento: 'desayuno', azar: enOrden(LICUADO, CAMBIAR, 0, 0.5) }).texto.split('\n').find((l) => l.startsWith('Combinaciones probadas'))!
    const ids = linea.replace(/^.* va bien con /, '').replace(/\.$/, '').split(', ')
    expect(linea).toMatch(/^Combinaciones probadas en recetas reales: leche va bien con /)
    expect(ids.length).toBeGreaterThan(0)
    expect(ids.length).toBeLessThanOrEqual(6)
    for (const id of ids) {
      expect(alimentos.has(id), id).toBe(true)
      expect(noIdentifican(id) || (alimentos.get(id)?.alergenos ?? []).includes('pescado'), id).toBe(false)
    }
  })
})

describe('conocimientoDe: cambiando el principal, el ingrediente tiene que poder ser el plato', () => {
  // Sin afinidades, para ver solo esto
  beforeAll(() => fijarAfinidades([]))
  afterAll(() => fijarAfinidades(null))
  const R = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.99]
  const omega3 = (modo: number) => R.map((r) => conocimiento({ momento: 'desayuno', nutriente: 'omega3_g', azar: enOrden(0.6, modo, 0, r) }).foco)

  it('en cambiar_principal, ni frutos secos ni semillas ni una porción de menos de 40 g, aunque estén entre los ricos', { timeout: 30_000 }, () => {
    const ricos = ricosDe(conocimiento({ momento: 'desayuno', nutriente: 'omega3_g' }), 'omega3_g')
    expect(ricos).toEqual(expect.arrayContaining(['semillas_lino', 'nueces']))
    for (const f of omega3(0.1)) {
      expect(f.modo).toBe('cambiar_principal')
      expect(puedeSerPrincipal(f.ingrediente!), f.ingrediente).toBe(true)
    }
    for (const momento of ['almuerzo', 'cena'] as Momento[]) {
      for (const a of AZARES) {
        const f = conocimiento({ momento, azar: () => a }).foco
        if (f.modo === 'cambiar_principal' && f.ingrediente) expect(puedeSerPrincipal(f.ingrediente), `${momento} ${a}: ${f.ingrediente}`).toBe(true)
      }
    }
  })

  it('en sumar_ingrediente sí van (un puñado de nueces o semillas de lino sumado a su plato)', { timeout: 30_000 }, () => {
    const focos = omega3(0.9)
    for (const f of focos) expect(f.modo).toBe('sumar_ingrediente')
    expect(focos.some((f) => !puedeSerPrincipal(f.ingrediente!))).toBe(true)
  })
})

describe('conocimientoDe: cambiando el principal, del mismo grupo o de uno que pueda reemplazarlo', () => {
  const N: Nutriente[] = ['calcio_mg', 'proteina_g', 'hierro_mg', 'fibra_g', 'vitamina_c_mg', 'b12_ug']
  /** Los focos cambiando el principal desde el alimento seguro que sortea `desde`, con varios nutrientes y azares. */
  const cambiando = (momento: Momento, desde: number, c = valentina) =>
    N.flatMap((n) => [0, 0.3, 0.6, 0.9].map((r) => conocimiento({ momento, nutriente: n, azar: enOrden(desde, 0.1, 0, r) }, c).foco))
  const grupos = (focos: Foco[]) => new Set(focos.flatMap((f) => (f.ingrediente ? [alimentos.get(f.ingrediente)!.grupo] : [])))
  beforeEach(() => {
    vi.spyOn(console, 'info').mockImplementation(() => {}) // los que caen al sorteo sin afinidad
  })
  afterAll(() => {
    fijarAfinidades(null)
    vi.restoreAllMocks()
  })

  it('los grupos: lácteo por lácteo, fruta por fruta, proteína por proteína, papas por cereal o verdura; del grupo otro, nada', () => {
    expect(GRUPOS_PARA_CAMBIAR).toEqual({
      lacteo: ['lacteo'], fruta: ['fruta'], proteina: ['proteina'],
      cereal_almidon: ['cereal_almidon', 'verdura'], verdura: ['verdura', 'cereal_almidon'], otro: [],
    })
  })

  it('desde su leche chocolatada, un lácteo: nunca ravioles ni tofu (tampoco sin datos de afinidad)', { timeout: 60_000 }, () => {
    for (const datos of [null, [] as ParAfinidad[]]) {
      fijarAfinidades(datos)
      const focos = cambiando('desayuno', 0.05)
      for (const f of focos) expect(f).toMatchObject({ desdeId: 'leche_chocolatada', modo: 'cambiar_principal' })
      expect(focos.filter((f) => f.ingrediente).length).toBeGreaterThan(0)
      expect([...grupos(focos)]).toEqual(['lacteo'])
      for (const id of ['ravioles', 'tofu']) expect(focos.map((f) => f.ingrediente)).not.toContain(id)
    }
  })

  it('desde sus papas fritas pueden salir boniato o zanahoria (cereal o verdura), nunca lino', { timeout: 60_000 }, () => {
    const focos = [...cambiando('cena', 0.85), ...cambiando('cena', 0.05, cargado('tomas'))]
    for (const f of focos) expect(f).toMatchObject({ desdeId: 'papas_fritas_baston', modo: 'cambiar_principal' })
    const salen = focos.map((f) => f.ingrediente)
    expect(salen.some((id) => id === 'boniato' || id === 'zanahoria')).toBe(true)
    expect(salen).not.toContain('semillas_lino')
    for (const g of grupos(focos)) expect(['cereal_almidon', 'verdura']).toContain(g)
  })

  it('desde su milanesa de carne, una proteína', { timeout: 60_000 }, () => {
    const focos = cambiando('cena', 0.95)
    for (const f of focos) expect(f).toMatchObject({ desdeId: 'milanesa_carne_horno', modo: 'cambiar_principal' })
    expect(focos.filter((f) => f.ingrediente).length).toBeGreaterThan(0)
    expect([...grupos(focos)]).toEqual(['proteina'])
  })
})

describe('conocimientoDe: lo que pide evitar el reintento', () => {
  let info: ReturnType<typeof vi.spyOn>
  beforeEach(() => {
    info = vi.spyOn(console, 'info').mockImplementation(() => {})
  })
  afterAll(() => vi.restoreAllMocks())
  const evitoLog = (que: string) =>
    info.mock.calls.map((x: unknown[]) => JSON.parse(String(x[0])) as Record<string, unknown>).find((x: Record<string, unknown>) => x.evento === 'foco_evitar_ignorado' && x.que === que)

  it('evitar.desdeIds saca ese alimento seguro del sorteo; si no queda otro, se ignora y queda en el log', { timeout: 30_000 }, () => {
    const evitar = ['milanesa_carne_horno', conocimiento({ momento: 'cena', azar: () => 0 }).foco.desdeId]
    for (const a of AZARES) expect(evitar, String(a)).not.toContain(conocimiento({ momento: 'cena', azar: () => a, evitar: { desdeIds: evitar } }).foco.desdeId)
    expect(evitoLog('desde')).toBeUndefined()
    const todos = conocimiento({ momento: 'cena' }).seguros.map((p) => p.id)
    const k = conocimiento({ momento: 'cena', azar: () => 0.4, evitar: { desdeIds: todos } })
    expect(k.foco.desdeId).toBe(conocimiento({ momento: 'cena', azar: () => 0.4 }).foco.desdeId)
    expect(evitoLog('desde')).toMatchObject({ evitar: todos })
  })

  it('evitar.ingredientes saca ese ingrediente (mismo alimento de partida, otro ingrediente); si era el único, se ignora', { timeout: 30_000 }, () => {
    let probados = 0
    for (const a of AZARES) {
      const antes = conocimiento({ azar: () => a }).foco
      if (!antes.ingrediente) continue
      info.mockClear()
      const k = conocimiento({ azar: () => a, evitar: { ingredientes: [antes.ingrediente] } })
      if (evitoLog('ingrediente')) continue // era el único posible
      probados++
      expect(k.foco.desdeId, String(a)).toBe(antes.desdeId)
      expect(k.foco.ingrediente, String(a)).not.toBe(antes.ingrediente)
    }
    expect(probados).toBeGreaterThanOrEqual(4)
    info.mockClear()
    const k = conocimiento({ azar: () => 0.4, evitar: { ingredientes: [...alimentos.keys()] } })
    expect(k.foco.ingrediente).toBeDefined()
    expect(k.foco.ingrediente).toBe(conocimiento({ azar: () => 0.4 }).foco.ingrediente)
    expect(evitoLog('ingrediente')).toBeDefined()
  })
})
