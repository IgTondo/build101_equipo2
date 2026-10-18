// El plato de una comida (PLAN.md §5.3): lo seguro para esa comida + un solo pasito, sin LLM.
import { describe, expect, it } from 'vitest'
import type {
  Alergeno, Alimento, Atributos, CoberturaDia, Grupo, Momento, Nutrientes, PreparacionCatalogo, Regla, Sugerencia,
} from '../../shared/contratos.js'
import { alimentosPrueba, catalogoPrueba, comidasSinteticas, ninoDoc, sintetico } from '../datos/prueba/catalogos.js'
import { progresoDe } from '../datos/tablero.js'
import { cero } from '../nutricion/calcular.js'
import { objetivosPara } from '../nutricion/objetivos.js'
import { type EstadoPrep, estadoDe } from './aceptacion.js'
import { calcularEstado } from './estado.js'
import { type EntradaPlato, armarPlato, nutrientesCandidatos } from './plato.js'

// ---------- Un mundo chico, con números redondos ----------
const nutr = (x: Partial<Nutrientes>): Nutrientes => ({ ...cero(), ...x })
const alimento = (id: string, grupo: Grupo, por100g: Partial<Nutrientes>, alergenos: Alergeno[] = []): Alimento => ({
  id, nombre: id, alias: [], fdcId: null, grupo, por100g: nutr(por100g), alergenos, porcionMedianaG: 100, fuente: 'equipo',
})
const ALIMENTOS = new Map(
  [
    alimento('papa', 'cereal_almidon', { vitamina_c_mg: 10 }),
    alimento('pan', 'cereal_almidon', { calcio_mg: 50 }, ['gluten']),
    alimento('carne', 'proteina', { hierro_mg: 3 }),
    alimento('huevo', 'proteina', { vitamina_d_ug: 2 }, ['huevo']),
    alimento('leche', 'lacteo', { calcio_mg: 120 }, ['leche']),
    alimento('zanahoria', 'verdura', { fibra_g: 3 }),
    alimento('queso', 'lacteo', { calcio_mg: 500 }, ['leche']),
  ].map((a) => [a.id, a]),
)
const ATR: Atributos = {
  textura: 'crocante', forma: 'baston', color: 'beige', sabor: 'salado', temperatura: 'caliente', presentacion: 'separado', grupo: 'cereal_almidon',
}
const prep = (
  id: string, grupo: Grupo, ingredientes: [string, number][], momentos: Momento[] | undefined, atr: Partial<Atributos> = {},
): PreparacionCatalogo => ({
  id, nombre: id.replace(/_/g, ' '), atributos: { ...ATR, ...atr, grupo },
  ingredientes: ingredientes.map(([alimentoId, gramos]) => ({ alimentoId, gramos })), ...(momentos ? { momentos } : {}),
})
const CENA: Momento[] = ['almuerzo', 'cena']
const CATALOGO: PreparacionCatalogo[] = [
  prep('papas_fritas', 'cereal_almidon', [['papa', 100]], CENA),
  prep('papas_horno', 'cereal_almidon', [['papa', 100]], CENA),
  prep('milanesa', 'proteina', [['carne', 100], ['pan', 20]], CENA),
  prep('tortilla', 'proteina', [['huevo', 100]], CENA),
  prep('zanahorias', 'verdura', [['zanahoria', 60]], CENA),
  prep('guiso', 'proteina', [['carne', 100]], CENA, { presentacion: 'mezclado' }),
  prep('tostadas', 'cereal_almidon', [['pan', 40]], ['desayuno', 'merienda']),
  prep('chocolatada', 'lacteo', [['leche', 200]], ['desayuno', 'merienda']),
  prep('galletitas', 'cereal_almidon', [['pan', 25]], ['desayuno', 'merienda']),
  prep('sin_momento', 'verdura', [['zanahoria', 60]], undefined),
  prep('bastones_queso', 'lacteo', [['queso', 40]], CENA),
]
const OBJETIVO = nutr({ proteina_g: 19, calcio_mg: 1000, vitamina_d_ug: 15, hierro_mg: 10, fibra_g: 25, omega3_g: 0.9, b12_ug: 1.2, vitamina_c_mg: 25 })

function estado(prepId: string, p: number, veces: number, comio = veces): EstadoPrep {
  return {
    prepId, nombre: prepId, p, veces, declarada: null, estado: estadoDe(p, veces, null), pasos: [], mejorPaso: null, comio,
    primeraISO: null, ultimaISO: null,
  }
}
const sugerencia = (tipo: Sugerencia['tipo'], preparacionId: string, calcio = 200): Sugerencia => ({
  tipo, preparacionId, nombre: preparacionId, probAcepta: 0.5, aporte: { calcio_mg: calcio }, porQue: 'Se parece a sus papas fritas: cambia solo el ingrediente.',
})
const hoyCon = (consumido: Partial<Nutrientes>, faltan: CoberturaDia['faltan']): EntradaPlato['hoy'] => ({
  consumido: { valor: nutr(consumido), min: nutr(consumido), max: nutr(consumido) }, faltan,
  comidas: [{ id: 'c1', fechaISO: '2026-10-16T12:30:00-03:00', momento: 'almuerzo', items: [] }],
})

function entrada(over: Partial<EntradaPlato> & { aceptadas?: [string, number, number][] } = {}): EntradaPlato {
  const { aceptadas, ...resto } = over
  const lista = aceptadas ?? [['papas_fritas', 0.95, 8], ['papas_horno', 0.9, 4], ['milanesa', 0.92, 6], ['chocolatada', 0.9, 5], ['tostadas', 0.85, 5]]
  return {
    momento: 'cena',
    catalogo: CATALOGO,
    conocidas: new Map(CATALOGO.map((p) => [p.id, { id: p.id, nombre: p.nombre, atributos: p.atributos, ingredientes: p.ingredientes }])),
    estados: new Map([...lista.map(([id, p, v]) => [id, estado(id, p, v)] as const), ['bastones_queso', estado('bastones_queso', 0.4, 3, 1)]]),
    alergias: [],
    reglas: [],
    alimentos: ALIMENTOS,
    objetivo: OBJETIVO,
    faltan: ['calcio_mg', 'vitamina_d_ug'],
    coberturaSemana: nutr({ calcio_mg: 0.4, vitamina_d_ug: 0.2 }),
    sugerencias: [sugerencia('segura', 'milanesa', 10), sugerencia('un_paso', 'bastones_queso'), sugerencia('mas_nutritiva', 'tortilla', 0)],
    ...resto,
  }
}
const ids = (e: EntradaPlato) => armarPlato(e).seguros.map((s) => s.preparacionId)

describe('lo seguro: variado, de esa comida, sin alérgenos ni reglas violadas', () => {
  it('variado: un almidón y una proteína para la cena, nunca dos almidones si hay otra cosa', () => {
    const p = armarPlato(entrada())
    expect(p.seguros.map((s) => s.grupo).sort()).toEqual(['cereal_almidon', 'proteina'])
    expect(p.seguros.every((s) => s.porcion === 'mediana')).toBe(true)
  })

  it('3 en una comida fuerte cuando hay tres grupos; en el desayuno, 2', () => {
    const conVerdura = entrada({ aceptadas: [['papas_fritas', 0.95, 8], ['milanesa', 0.92, 6], ['zanahorias', 0.8, 4], ['chocolatada', 0.9, 5], ['tostadas', 0.85, 5], ['galletitas', 0.9, 3]] })
    expect(ids(conVerdura).sort()).toEqual(['milanesa', 'papas_fritas', 'zanahorias'])
    expect(ids({ ...conVerdura, momento: 'desayuno' }).sort()).toEqual(['chocolatada', 'tostadas'])
  })

  it('si hay un solo grupo, van 2 (nunca 3 del mismo); si hay uno solo, 1', () => {
    expect(ids(entrada({ aceptadas: [['papas_fritas', 0.95, 8], ['papas_horno', 0.9, 4]] })).sort()).toEqual(['papas_fritas', 'papas_horno'])
    expect(ids(entrada({ aceptadas: [['papas_fritas', 0.95, 8]] }))).toEqual(['papas_fritas'])
  })

  it('filtro por momento: la chocolatada no va a la cena; lo que no tiene momentos anotados no sale', () => {
    expect(ids(entrada())).not.toContain('chocolatada')
    expect(ids(entrada({ momento: 'desayuno' })).sort()).toEqual(['chocolatada', 'tostadas'])
    expect(ids(entrada({ aceptadas: [['sin_momento', 0.95, 8]] }))).toEqual([])
    // lo que acepta pero no está en el catálogo tampoco (no sabemos para qué comida es)
    expect(ids(entrada({ aceptadas: [['algo_casero', 0.95, 8]] }))).toEqual([])
  })

  it('alérgenos: con alergia al gluten la milanesa (pan rallado) no entra; con alergia al huevo, la tortilla tampoco', () => {
    expect(ids(entrada({ alergias: ['gluten'] }))).not.toContain('milanesa')
    expect(ids(entrada({ alergias: ['huevo'], aceptadas: [['tortilla', 0.95, 8], ['papas_fritas', 0.9, 4]] }))).toEqual(['papas_fritas'])
  })

  it('reglas: "nada mezclado" saca el guiso aunque lo acepte', () => {
    const regla: Regla = { texto: 'No come nada mezclado', condiciones: [{ tipo: 'presentacion', valor: 'mezclado' }], efecto: 'rechaza' }
    const e = entrada({ aceptadas: [['guiso', 0.99, 9], ['papas_fritas', 0.9, 4]] })
    expect(ids(e)).toContain('guiso')
    expect(ids({ ...e, reglas: [regla] })).toEqual(['papas_fritas'])
  })

  it('ordena por aporte al nutriente que más falta hoy (por porción) y después por aceptación', () => {
    // Hoy falta vitamina C: las papas aportan; la milanesa no → las papas primero
    const e = entrada({ hoy: hoyCon({ vitamina_c_mg: 2 }, ['vitamina_c_mg', 'calcio_mg']) })
    const p = armarPlato(e)
    expect(p.nutriente).toBe('vitamina_c_mg')
    expect(p.seguros[0]?.preparacionId).toBe('papas_fritas')
    expect(p.seguros[0]?.porQue).toBe('La come 8 de cada 8 veces y aporta vitamina C.')
    expect(p.seguros[1]?.porQue).toBe('La come 6 de cada 6 veces.')
  })
})

describe('rotación: si lo seguro se repite entero, cambia uno', () => {
  it('la última cena fue milanesa con papas fritas → mismas proteínas, papas al horno (sin bajar la aceptación)', () => {
    const p = armarPlato(entrada({ ultima: ['milanesa', 'papas_fritas', 'bastones_queso'] }))
    expect(p.seguros.map((s) => s.preparacionId).sort()).toEqual(['milanesa', 'papas_horno'])
    expect(p.seguros.find((s) => s.preparacionId === 'papas_horno')?.porQue).toBe('Para no repetir la última cena: la come 4 de cada 4 veces.')
    // el pasito sigue igual (el research pide repetir el mismo de 8 a 15 veces)
    expect(p.pasito?.preparacionId).toBe('bastones_queso')
  })

  it('si solo se repite una parte, no rota; si no hay con qué rotar, repite', () => {
    expect(ids(entrada({ ultima: ['milanesa'] })).sort()).toEqual(['milanesa', 'papas_fritas'])
    expect(ids(entrada({ ultima: ['milanesa', 'papas_fritas'], aceptadas: [['papas_fritas', 0.95, 8], ['milanesa', 0.92, 6]] })).sort())
      .toEqual(['milanesa', 'papas_fritas'])
  })
})

describe('el pasito: uno solo, nunca dos alimentos nuevos', () => {
  it('es la sugerencia un_paso; si no hay, la más nutritiva; nunca más de uno', () => {
    expect(armarPlato(entrada()).pasito?.tipo).toBe('un_paso')
    const sinPaso = entrada({ sugerencias: [sugerencia('segura', 'milanesa'), sugerencia('mas_nutritiva', 'tortilla')] })
    expect(armarPlato(sinPaso).pasito?.preparacionId).toBe('tortilla')
    expect(armarPlato(entrada({ sugerencias: [sugerencia('segura', 'milanesa')] })).pasito).toBeUndefined()
  })

  it('lo seguro es todo lo que ya acepta: lo que está en proceso no entra como seguro', () => {
    const p = armarPlato(entrada())
    expect(p.seguros.map((s) => s.preparacionId)).not.toContain('bastones_queso')
    const nuevos = [...p.seguros.map((s) => s.preparacionId), p.pasito?.preparacionId].filter((id) => id && entrada().estados.get(id)?.estado !== 'acepta')
    expect(nuevos).toEqual(['bastones_queso'])
  })

  it('nunca repite un seguro como pasito', () => {
    const e = entrada({ sugerencias: [sugerencia('un_paso', 'milanesa'), sugerencia('mas_nutritiva', 'bastones_queso')] })
    expect(armarPlato(e).pasito?.preparacionId).toBe('bastones_queso')
  })
})

describe('cubre y el nutriente', () => {
  it('nutriente: el que más falta hoy; sin comidas hoy, el de la semana', () => {
    expect(armarPlato(entrada()).nutriente).toBe('calcio_mg')
    expect(armarPlato(entrada({ hoy: hoyCon({}, ['hierro_mg']) })).nutriente).toBe('hierro_mg')
    expect(armarPlato(entrada({ hoy: { ...hoyCon({}, ['hierro_mg'])!, comidas: [] } })).nutriente).toBe('calcio_mg')
  })

  it('seguros en mediana + el pasito en chica, sobre lo que falta hoy', () => {
    // Calcio: milanesa 10 mg (20 g de pan) + papas 0 + bastones de queso 200 mg × 0,6 = 130 mg; faltan 1000 − 740 = 260
    const p = armarPlato(entrada({ hoy: hoyCon({ calcio_mg: 740 }, ['calcio_mg']) }))
    expect(p.cubre).toBe(0.5)
    expect(p.porQue).toBe('Lo que ya come para la cena, y un pasito hacia el calcio.')
  })

  it('con tope 1, aunque lo que falta sea casi nada', () => {
    expect(armarPlato(entrada({ hoy: hoyCon({ calcio_mg: 990 }, ['calcio_mg']) })).cubre).toBe(1)
    expect(armarPlato(entrada({ hoy: hoyCon({ calcio_mg: 5000 }, ['calcio_mg']) })).cubre).toBe(1)
  })
})

describe('el nutriente del plato: el orden de §1 y que el plato le sirva (cubre ≥ 15%)', () => {
  const conFuenteC = nutr({ calcio_mg: 0.4, vitamina_d_ug: 0.2, vitamina_c_mg: 0.8 })

  it('candidatos: lo que falta hoy, en el orden de §1 (no por cobertura); sin comidas hoy, semana.faltan tal cual', () => {
    const hoy = hoyCon({}, ['vitamina_d_ug', 'vitamina_c_mg', 'omega3_g', 'calcio_mg'])
    expect(nutrientesCandidatos({ hoy, faltan: [], coberturaSemana: conFuenteC })).toEqual(['calcio_mg', 'vitamina_d_ug', 'omega3_g', 'vitamina_c_mg'])
    // casi sin vitamina C en la semana (< 30%), la vitamina C va primera (como en semana.faltan)
    expect(nutrientesCandidatos({ hoy, faltan: [], coberturaSemana: nutr({}) })[0]).toBe('vitamina_c_mg')
    expect(nutrientesCandidatos({ faltan: ['fibra_g', 'b12_ug'], coberturaSemana: conFuenteC })).toEqual(['fibra_g', 'b12_ug'])
    expect(nutrientesCandidatos({ hoy: { ...hoy!, comidas: [] }, faltan: ['fibra_g'], coberturaSemana: conFuenteC })).toEqual(['fibra_g'])
  })

  it('el primero del orden si su plato cubre al menos el 15%: calcio antes que vitamina C, aunque la C esté más baja hoy', () => {
    // Calcio: 130 mg sobre 260 que faltan = 0,5
    const p = armarPlato(entrada({ coberturaSemana: conFuenteC, hoy: hoyCon({ calcio_mg: 740 }, ['vitamina_c_mg', 'calcio_mg']) }))
    expect([p.nutriente, p.cubre]).toEqual(['calcio_mg', 0.5])
  })

  it('si no llega al 15%, prueba el siguiente: calcio 13% → vitamina D 0% → vitamina C 40% (las papas)', () => {
    const p = armarPlato(entrada({ coberturaSemana: conFuenteC, hoy: hoyCon({}, ['vitamina_d_ug', 'vitamina_c_mg', 'calcio_mg']) }))
    expect([p.nutriente, p.cubre]).toEqual(['vitamina_c_mg', 0.4])
    expect(p.seguros[0]?.preparacionId).toBe('papas_fritas') // ordenado por el nutriente elegido
  })

  it('si ninguno llega, el plato del primero', () => {
    const p = armarPlato(entrada({ coberturaSemana: conFuenteC, hoy: hoyCon({}, ['omega3_g', 'vitamina_d_ug']) }))
    expect([p.nutriente, p.cubre]).toEqual(['vitamina_d_ug', 0])
    // sin comidas hoy: calcio (13%) y vitamina D (0%) de la semana → queda el calcio
    expect(armarPlato(entrada()).nutriente).toBe('calcio_mg')
  })
})

describe('sin nada para esa comida', () => {
  it('el plato sale vacío, sin pasito solo, y lo dice con calma', () => {
    const p = armarPlato(entrada({ aceptadas: [['chocolatada', 0.9, 5]] }))
    expect(p.seguros).toEqual([])
    expect(p.pasito).toBeUndefined()
    expect(p.cubre).toBe(0)
    expect(p.porQue).toBe('Todavía no conocemos algo que coma para la cena. Cuando registres lo que le sirvas, armamos el plato con eso.')
  })
})

// ---------- Los dos chicos sintéticos (§10.5) × las cuatro comidas, por el tablero real ----------
const catalogo = catalogoPrueba()
const alimentos = alimentosPrueba()
const HOY = '2026-10-16'
function cargado(id: 'tomas' | 'lucia') {
  const s = sintetico(id)
  return { s, c: { nino: ninoDoc(s), comidas: comidasSinteticas(s, alimentos, catalogo), catalogo, alimentos, objetivo: objetivosPara(s.datos.edad, s.datos.sexo) } }
}
const MOMENTOS = ['desayuno', 'almuerzo', 'merienda', 'cena'] as const

describe('sintéticos × comidas (por progresoDe, ?momento=)', () => {
  // seguros | pasito | nutriente cubre (alimentos-prueba.json; contra Mongo, con data/alimentos.json, cambian algunos)
  const TABLA: Record<'tomas' | 'lucia', Record<(typeof MOMENTOS)[number], string>> = {
    tomas: {
      desayuno: 'leche_chocolatada + tostadas | tostadas_queso | calcio_mg 0.58',
      almuerzo: 'milanesa_carne_horno + papas_fritas_baston | bastones_queso_horno | calcio_mg 0.26',
      merienda: 'leche_chocolatada + galletitas_agua | tostadas_queso | calcio_mg 0.51', // rota las tostadas: la última merienda fue chocolatada con tostadas
      cena: 'milanesa_carne_horno + papas_fritas_baston | bastones_queso_horno | calcio_mg 0.26',
    },
    lucia: {
      // casi sin vitamina C en la semana: va primera
      desayuno: 'banana_pisada + yogur_vainilla | frutilla_pisada | vitamina_c_mg 1',
      // rota el puré de papa (estuvo en el último almuerzo) y la vitamina C ya no llega al 15%: calcio y vitamina D
      // tampoco, el hierro sí. Nada a un cambio para el almuerzo: sin pasito
      almuerzo: 'fideos_manteca_queso + pollo_desmenuzado | — | hierro_mg 0.29',
      merienda: 'banana_pisada + yogur_vainilla | frutilla_pisada | vitamina_c_mg 1',
      cena: 'pure_papa + pollo_desmenuzado | — | vitamina_c_mg 0.4',
    },
  }

  it.each(['tomas', 'lucia'] as const)('%s: el plato de cada comida', (id) => {
    const { s, c } = cargado(id)
    for (const momento of MOMENTOS) {
      const p = progresoDe(c, { hasta: HOY, momento })
      const plato = p.plato
      expect(plato, momento).toBeDefined()
      if (!plato) continue
      expect(`${plato.seguros.map((x) => x.preparacionId).join(' + ')} | ${plato.pasito?.preparacionId ?? '—'} | ${plato.nutriente} ${plato.cubre}`, `${id} ${momento}`).toBe(TABLA[id][momento])
      expect(plato.momento).toBe(momento)
      // el pasito es la sugerencia un_paso del mismo progreso (la misma tarjeta que el tablero)
      if (plato.pasito) expect(plato.pasito).toEqual(p.sugerencias?.find((x) => x.tipo === plato.pasito?.tipo))
      const estados = calcularEstado(c.nino, c.comidas, catalogo, { hasta: HOY }).estados
      for (const x of plato.seguros) {
        const cat = catalogo.get(x.preparacionId)
        expect(cat?.momentos, `${id} ${momento} ${x.preparacionId}`).toContain(momento)
        expect(cat?.ingredientes.some((i) => alimentos.get(i.alimentoId)?.alergenos.some((a) => s.datos.alergias.includes(a)))).toBe(false)
        expect(cat?.atributos.color === 'verde' && id === 'lucia').toBe(false) // "No come nada verde"
        expect(cat?.atributos.presentacion === 'mezclado' && id === 'tomas').toBe(false) // "No come nada mezclado"
        expect(estados.get(x.preparacionId)?.estado, `${id} ${momento} ${x.preparacionId}`).toBe('acepta')
      }
      expect(new Set(plato.seguros.map((x) => x.grupo)).size).toBe(plato.seguros.length)
      expect(plato.cubre).toBeGreaterThanOrEqual(0)
      expect(plato.cubre).toBeLessThanOrEqual(1)
      const textos = [plato.porQue, ...plato.seguros.map((x) => x.porQue)].join(' ')
      expect(textos).not.toMatch(/rechaz|\d,\d|\d\.\d|que termine|premio|una probadita más|escondé/i)
    }
  })

  it('sin momento no hay plato (el tablero de la semana queda igual)', () => {
    const { c } = cargado('tomas')
    const sin = progresoDe(c, { hasta: HOY })
    expect(sin.plato).toBeUndefined()
    expect(sin.momento).toBeUndefined()
    const con = progresoDe(c, { hasta: HOY, momento: 'cena' })
    expect(con.plato?.momento).toBe('cena')
    expect([con.frase, con.dias, con.semana, con.alertas]).toEqual([sin.frase, sin.dias, sin.semana, sin.alertas])
  })
})
