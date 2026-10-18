// v5.10 · La variedad de la receta creativa, del lado del grafo (conocimientoDe): los "Ricos en X" uno por familia y sin
// golosinas, el ingrediente del foco sorteado entre ellos y lo que ya usó en las recetas que vio la familia, afuera. Sin
// Mongo: Valentina del dataset sintético (§10.5) con los catálogos reales, como la cargaría cargarNino().
// v5.10 · Y el sorteo pesado por las afinidades (server/ia/afinidades.ts): con pares de ejemplo (fijarAfinidades) y, donde
// se dice, con data/afinidades.json.
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { MOMENTO, NUTRIENTE, type Momento, type Nutriente } from '../../shared/contratos.js'
import { principal } from '../aprendizaje/cadena.js'
import { alimentosCatalogo, preparacionesCatalogo } from '../datos/catalogos.js'
import { type Cargado, objetivoDe } from '../datos/cargar.js'
import { comidasSinteticas, ninoDoc, sintetico, type SinteticoId } from '../datos/prueba/catalogos.js'
import { fijarAfinidades, type ParAfinidad } from '../ia/afinidades.js'
import { escalar } from '../nutricion/calcular.js'
import {
  ACOMPANAMIENTOS, GOLOSINAS_Y_ULTRAPROCESADOS, conocimientoDe, contextoAfinidad, familia, recientesDe, type Conocimiento,
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
  it('en "ricos en calcio" hay como máximo un queso, el que más aporta, y siguen de más a menos', () => {
    const ricos = calcio.nutrientes[0]!.ricos
    expect(ricos.filter((r) => familia(r.alimentoId) === 'queso').map((r) => r.alimentoId)).toEqual(['queso_rallado'])
    expect(ricos.map((r) => r.alimentoId)).toEqual(expect.arrayContaining(['ricota']))
    expect(ricos.some((r) => familia(r.alimentoId) === 'yogur') && ricos.some((r) => familia(r.alimentoId) === 'leche')).toBe(true)
    expect(ricos.length).toBeLessThanOrEqual(8)
    for (const [i, r] of ricos.entries()) if (i > 0) expect(r.por100g).toBeLessThanOrEqual(ricos[i - 1]!.por100g)
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
    for (const id of ['galletitas_integrales', 'galletitas_agua', 'nuggets_pollo', 'papas_chips', 'medialuna']) expect(omega3).not.toContain(id)
  })
})

describe('conocimientoDe: el ingrediente del foco', () => {
  it('está entre los ricos de su nutriente y no está en el alimento de partida', { timeout: 20_000 }, () => {
    for (const momento of ['almuerzo', 'cena', 'merienda'] as Momento[]) {
      for (const a of AZARES) {
        const k = conocimiento({ momento, azar: () => a })
        const { ingrediente, nutriente } = k.foco
        expect(ingrediente, `${momento} ${a}`).toBeDefined()
        expect(ricosDe(k, nutriente!), `${momento} ${a}`).toContain(ingrediente)
        expect(deSuPlato(k), `${momento} ${a}`).not.toContain(ingrediente)
      }
    }
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

  it('una receta que ya vio saca la ricota de los ricos y del sorteo, y la pone en recientes', { timeout: 20_000 }, () => {
    expect(ricosDe(calcio, 'calcio_mg')).toContain('ricota')
    const k = conocimiento({ nutriente: 'calcio_mg', anteriores: [MEDALLONES] })
    expect(k.recientes).toEqual(['ricota'])
    expect(ricosDe(k, 'calcio_mg')).not.toContain('ricota')
    expect(k.texto).toContain('Ya usó hace poco (no los repitas como ingrediente principal): ricota.')
    for (const a of AZARES) expect(conocimiento({ nutriente: 'calcio_mg', anteriores: [MEDALLONES], azar: () => a }).foco.ingrediente).not.toBe('ricota')
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
  /** Pares de ejemplo: lo de `platos` combina con todo el catálogo menos con `menos` (no depende de cuáles son los ricos). */
  const todoMenos = (menos: string, ...platos: string[]): ParAfinidad[] =>
    platos.flatMap((a) => [...alimentos.keys()].filter((b) => b !== a && b !== menos && !/^(otro|fdc)_/.test(b)).map((b) => ({ a, b, n: 10, afinidad: 0.2 })))
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

  it('desde su milanesa de carne al horno nunca sale yogur', { timeout: 60_000 }, () => {
    const rico = conRico('cena', (id) => id === 'yogur')
    expect(rico).toBeDefined()
    fijarAfinidades(todoMenos('yogur', 'carne_vacuna', 'pan_rallado'))
    info.mockClear()
    for (const [modo, nombre] of [[CAMBIAR, 'cambiar_principal'], [SUMAR, 'sumar_ingrediente']] as const) {
      const focos = sorteados('cena', MILANESA, modo, rico!.n)
      for (const f of focos) expect(f).toMatchObject({ desdeId: 'milanesa_carne_horno', modo: nombre })
      expect(focos.map((f) => f.ingrediente), nombre).not.toContain('yogur')
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

  it('sin datos de afinidad, el sorteo es el de antes: por lugar entre los ricos posibles', { timeout: 30_000 }, () => {
    fijarAfinidades([])
    for (const momento of ['almuerzo', 'desayuno'] as Momento[]) {
      for (const a of AZARES) {
        const k = conocimiento({ momento, azar: () => a })
        expect(k.foco.ingrediente, `${momento} ${a}`).toBe(porLugar(k, a))
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
