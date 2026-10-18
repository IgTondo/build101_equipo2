// A8 y A12: perfil inicial y foto de la indicación. generarJSON va mockeado (sin keys ni red): se prueba lo que decide
// el código.
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DatosBasicos, ErrorApi, PerfilBorrador, PerfilInicialReq, PreparacionCatalogo } from '../../shared/contratos.js'
import { ErrorNibble, HEADER_STUB, type Handler } from '../http.js'
import perfilInicialHandler from '../../api/perfil-inicial.js'
import { generarJSON } from './modelo.js'
import {
  depurarDatos, depurarIndicacion, depurarPerfil, esquemaPerfil, esquemaSalidaDatos, extraerPerfil, faltanVitales, fijarPreparaciones,
  idsIngredientes, preparaciones, RANGO_OBJETIVO,
  type SalidaDatos, type SalidaIndicacion, type SalidaPerfil,
} from './perfil.js'
import { SISTEMA_DATOS } from './prompts/perfil.js'
import { schemaClaude } from './proveedores/claude.js'

vi.mock('./modelo.js', () => ({ generarJSON: vi.fn() }))
const mockJSON = vi.mocked(generarJSON)

const DATOS: DatosBasicos = {
  nombre: 'Tomás', edad: 6, sexo: 'masculino', alergias: ['huevo', 'sesamo'], alertas: [], dieta: 'ninguna',
}
const RELATO = 'Tomás tiene 6 años. Come papas fritas en bastones, la milanesa al horno y el yogur Conaprole. '
  + 'No come nada mezclado: el arroz con pollo no lo toca. El puré de papa tampoco, por la textura. '
  + 'Es alérgico al huevo, así que la milanesa la hacemos sin huevo.'

// v5.8 · Las preparaciones reales (con atributos e ingredientes): verificarId() las necesita y con id quedan sus atributos.
const IDS = ['papas_fritas_baston', 'milanesa_carne_horno', 'milanesa_carne_con_huevo', 'pure_papa', 'arroz_con_pollo', 'licuado_banana_leche', 'yogur_bebible']
const CATALOGO: PreparacionCatalogo[] = preparaciones().filter((p) => IDS.includes(p.id))
const prep = (id: string) => CATALOGO.find((p) => p.id === id)!

type AtributosLLM = SalidaPerfil['acepta'][number]['atributos']
const TIPICOS: AtributosLLM = { textura: 'blando', forma: 'trozos', color: 'beige', sabor: 'salado', temperatura: 'caliente', presentacion: 'separado', grupo: 'otro', coccion: 'horno' }
const acepta = (a: Partial<SalidaPerfil['acepta'][number]> & { nombre: string }): SalidaPerfil['acepta'][number] =>
  ({ dicho: a.nombre.toLowerCase(), preparacionId: null, marca: null, ingredientes: [], momentos: [], duda: null, ...a, atributos: { ...TIPICOS, ...a.atributos } })
const rechaza = (r: Partial<SalidaPerfil['rechaza'][number]> & { nombre: string }): SalidaPerfil['rechaza'][number] =>
  ({ dicho: r.nombre.toLowerCase(), preparacionId: null, motivo: 'otro', porAlergia: false, ...r, atributos: { ...TIPICOS, ...r.atributos } })
const regla = (r: Partial<SalidaPerfil['reglas'][number]> & { texto: string }): SalidaPerfil['reglas'][number] =>
  ({ condiciones: [], efecto: 'rechaza', porAlergia: false, ...r })

function salida(s: Partial<SalidaPerfil> = {}): SalidaPerfil {
  return {
    acepta: [
      acepta({ nombre: 'Papas fritas en bastones', preparacionId: 'papas_fritas_baston', atributos: { ...TIPICOS, textura: 'crocante', forma: 'baston', coccion: 'frito' } }),
      acepta({ nombre: 'Yogur', dicho: 'el yogur Conaprole', marca: 'Conaprole', atributos: { ...TIPICOS, grupo: 'lacteo', coccion: 'listo' }, ingredientes: [{ alimentoId: 'yogur', gramos: 120 }], momentos: ['desayuno'] }),
    ],
    rechaza: [
      rechaza({ nombre: 'Puré de papa', preparacionId: 'pure_papa', motivo: 'textura' }),
      rechaza({ nombre: 'Arroz con pollo', preparacionId: 'arroz_con_pollo', motivo: 'mezcla' }),
    ],
    reglas: [regla({ texto: 'No come nada mezclado', condiciones: [{ tipo: 'presentacion', valor: 'mezclado' }] })],
    ...s,
  }
}

function conLLM(s: SalidaPerfil) {
  mockJSON.mockResolvedValue({ datos: s, modelo: 'claude-haiku-5-5', ms: 1500, reintentos: 0 })
}

beforeEach(() => {
  mockJSON.mockReset() // con llaves: si devuelve el mock, Vitest lo llama como limpieza
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  fijarPreparaciones(null)
  vi.restoreAllMocks()
})

// ---------- Depuración ----------
describe('depurarPerfil', () => {
  it('con id del catálogo: los atributos y los momentos son los del catálogo y no lleva ingredientes; sin id, lo del modelo, inferido', () => {
    expect(depurarPerfil(salida(), CATALOGO)).toEqual({
      acepta: [
        { nombre: 'Papas fritas en bastones', dicho: 'papas fritas en bastones', preparacionId: 'papas_fritas_baston', atributos: prep('papas_fritas_baston').atributos, momentos: prep('papas_fritas_baston').momentos },
        {
          nombre: 'Yogur', dicho: 'el yogur Conaprole', preparacionId: null, marca: 'Conaprole', atributos: { ...TIPICOS, grupo: 'lacteo', coccion: 'listo' },
          ingredientes: [{ alimentoId: 'yogur', gramos: 120 }], momentos: ['desayuno'], inferido: true,
        },
      ],
      rechaza: [
        { nombre: 'Puré de papa', dicho: 'puré de papa', preparacionId: 'pure_papa', atributos: prep('pure_papa').atributos, motivo: 'textura' },
        { nombre: 'Arroz con pollo', dicho: 'arroz con pollo', preparacionId: 'arroz_con_pollo', atributos: prep('arroz_con_pollo').atributos, motivo: 'mezcla' },
      ],
      reglas: [{ texto: 'No come nada mezclado', condiciones: [{ tipo: 'presentacion', valor: 'mezclado' }], efecto: 'rechaza' }],
    } satisfies PerfilBorrador)
  })

  it('un preparacionId que no está en el catálogo pasa a null', () => {
    const b = depurarPerfil(salida({
      acepta: [acepta({ nombre: 'Papas noisette', preparacionId: 'papas_noisette' })],
      rechaza: [rechaza({ nombre: 'Lentejas', preparacionId: 'lentejas_guisadas' })],
    }), CATALOGO)
    expect(b.acepta[0].preparacionId).toBeNull()
    expect(b.rechaza[0].preparacionId).toBeNull()
  })

  it('un id que no es la misma preparación que dijo la familia pasa a null, con los atributos y los ingredientes del modelo, y queda en el log', () => {
    const atributos: AtributosLLM = { ...TIPICOS, textura: 'crocante', forma: 'plano', grupo: 'proteina' }
    const ingredientes = [{ alimentoId: 'pollo', gramos: 100 }, { alimentoId: 'pan_rallado', gramos: 20 }]
    const b = depurarPerfil(salida({
      acepta: [
        acepta({ nombre: 'Milanesa de pollo al horno', dicho: 'milanesa de pollo al horno', preparacionId: 'milanesa_carne_horno', atributos, ingredientes }),
        acepta({ nombre: 'Yogur bebible de frutilla', dicho: 'yogur bebible de frutilla', preparacionId: 'yogur_bebible' }),
      ],
      rechaza: [rechaza({ nombre: 'Arroz', dicho: 'el arroz blanco solo', preparacionId: 'arroz_con_pollo' })],
    }), CATALOGO)
    expect(b.acepta[0]).toMatchObject({ preparacionId: null, atributos, ingredientes, inferido: true })
    expect(b.acepta[1].preparacionId).toBeNull()
    expect(b.rechaza[0]).toMatchObject({ preparacionId: null, atributos: TIPICOS, inferido: true })
    const avisos = vi.mocked(console.warn).mock.calls.map(([m]) => JSON.parse(String(m)))
    expect(avisos).toContainEqual(expect.objectContaining({ evento: 'perfil', aviso: 'id_descartado', id: 'milanesa_carne_horno', motivo: 'dice pollo y el catálogo no' }))
    expect(avisos.filter((a) => a.aviso === 'id_descartado')).toHaveLength(3)
  })

  it('las alergias del chico: el id que las lleva pasa a null y los ingredientes que chocan se sacan, con una duda', () => {
    const b = depurarPerfil(salida({
      acepta: [
        acepta({ nombre: 'Milanesa al horno', dicho: 'la milanesa al horno', preparacionId: 'milanesa_carne_con_huevo' }),
        acepta({ nombre: 'Licuado de banana con leche', preparacionId: 'licuado_banana_leche' }),
        acepta({ nombre: 'Sushi de palta', ingredientes: [{ alimentoId: 'arroz', gramos: 80 }, { alimentoId: 'salmon', gramos: 30 }] }),
      ],
    }), CATALOGO, { alergias: ['huevo', 'pescado'], alergiasOtras: ['banana'] })
    expect(b.acepta.map((a) => a.preparacionId)).toEqual([null, null, null])
    expect(b.acepta[2].ingredientes).toEqual([{ alimentoId: 'arroz', gramos: 80 }])
    expect(b.acepta[2].duda).toMatch(/^¿Sushi de palta lleva salm[oó]n\?/)
    // la misma milanesa sin la alergia sí es la del catálogo… si dijo el huevo
    const sin = depurarPerfil(salida({ acepta: [acepta({ nombre: 'Milanesa con huevo', dicho: 'la milanesa con huevo al horno', preparacionId: 'milanesa_carne_con_huevo' })] }), CATALOGO)
    expect(sin.acepta[0].preparacionId).toBe('milanesa_carne_con_huevo')
  })

  it('con el relato, el dicho queda solo si está tal cual; si no, se verifica con el nombre', () => {
    const b = depurarPerfil(salida({
      acepta: [
        acepta({ nombre: 'Papas fritas', dicho: 'papas fritas en bastones', preparacionId: 'papas_fritas_baston' }),
        acepta({ nombre: 'Yogur', dicho: 'el yogurcito de siempre' }),
      ],
    }), CATALOGO, { relato: RELATO })
    expect(b.acepta[0].dicho).toBe('papas fritas en bastones')
    expect(b.acepta[0].preparacionId).toBe('papas_fritas_baston')
    expect('dicho' in b.acepta[1]).toBe(false)
  })

  it('momentos de MOMENTO; ingredientes del catálogo de alimentos, de 1 a 500 g, repetidos sumados', () => {
    const b = depurarPerfil(salida({
      acepta: [acepta({
        nombre: 'Guiso de la abuela',
        momentos: ['almuerzo', 'postre', 'Cena', 'almuerzo'],
        ingredientes: [
          { alimentoId: 'papa', gramos: 80.4 }, { alimentoId: 'papa', gramos: 40 }, { alimentoId: 'carne_vacuna', gramos: 900 },
          { alimentoId: 'carne_de_dragon', gramos: 50 }, { alimentoId: 'zanahoria', gramos: 0 }, { alimentoId: 'otro_verdura', gramos: 30 },
        ],
      })],
    }), CATALOGO)
    expect(b.acepta[0].momentos).toEqual(['almuerzo', 'cena'])
    expect(b.acepta[0].ingredientes).toEqual([{ alimentoId: 'papa', gramos: 120 }, { alimentoId: 'carne_vacuna', gramos: 500 }, { alimentoId: 'otro_verdura', gramos: 30 }])
  })

  it('atributos fuera del vocabulario se descartan (un respaldo sin salida estructurada); los demás quedan escritos como en el contrato', () => {
    const b = depurarPerfil(salida({
      acepta: [acepta({ nombre: 'Papas fritas', atributos: { textura: 'Crocante', forma: 'bastón', color: 'fucsia', sabor: 'umami', temperatura: 'caliente', presentacion: 'x', grupo: 'cereal_almidon', coccion: 'y' } as unknown as AtributosLLM })],
    }), CATALOGO)
    expect(b.acepta[0].atributos).toEqual({ textura: 'crocante', forma: 'baston', temperatura: 'caliente', grupo: 'cereal_almidon' })
  })

  it('marca solo si la dijo; nombres sin espacios de más y sin repetir', () => {
    const b = depurarPerfil(salida({
      acepta: [
        acepta({ nombre: '  Yogur   de vainilla ', marca: '  ' }),
        acepta({ nombre: 'yogur de VAINILLA', marca: 'Conaprole' }),
        acepta({ nombre: '   ' }),
      ],
    }), CATALOGO)
    expect(b.acepta.map((a) => [a.nombre, a.marca])).toEqual([['Yogur de vainilla', undefined]])
  })

  it('motivo fuera de MOTIVO → otro; lo que se evita por alergia no queda en rechaza', () => {
    const b = depurarPerfil(salida({
      rechaza: [
        rechaza({ nombre: 'Puré de papa', motivo: 'Textura' }),
        rechaza({ nombre: 'Brócoli', motivo: 'es verde' }),
        rechaza({ nombre: 'Huevo', motivo: 'otro', porAlergia: true }),
        rechaza({ nombre: 'Sopa', motivo: 'se tocaban' }),
      ],
    }), CATALOGO)
    expect(b.rechaza.map((r) => [r.nombre, r.motivo])).toEqual([['Puré de papa', 'textura'], ['Brócoli', 'otro'], ['Sopa', 'se_tocaban']])
  })

  it('reglas con tipo y valor del vocabulario: "nada mezclado", "que no se toquen", "plato con divisiones"', () => {
    const b = depurarPerfil(salida({
      reglas: [
        regla({ texto: 'No come nada mezclado', condiciones: [{ tipo: 'presentacion', valor: 'mezclado' }] }),
        regla({ texto: 'Que no se toquen', condiciones: [{ tipo: 'distribucion', valor: 'tocándose' }, { tipo: 'distribucion', valor: 'tocandose' }] }),
        regla({ texto: 'Solo en su plato con divisiones', condiciones: [{ tipo: 'plato', valor: 'con divisiones' }], efecto: 'Requiere' }),
      ],
    }), CATALOGO)
    expect(b.reglas).toEqual([
      { texto: 'No come nada mezclado', condiciones: [{ tipo: 'presentacion', valor: 'mezclado' }], efecto: 'rechaza' },
      { texto: 'Que no se toquen', condiciones: [{ tipo: 'distribucion', valor: 'tocandose' }], efecto: 'rechaza' },
      { texto: 'Solo en su plato con divisiones', condiciones: [{ tipo: 'plato', valor: 'con_divisiones' }], efecto: 'requiere' },
    ])
  })

  it('una regla con una condición fuera del vocabulario queda solo como texto, sin achicar las condiciones', () => {
    const b = depurarPerfil(salida({
      reglas: [
        regla({ texto: 'Nada verde mezclado', condiciones: [{ tipo: 'color', valor: 'verde' }, { tipo: 'presentacion', valor: 'revuelto' }] }),
        regla({ texto: 'Nada con cebolla', condiciones: [{ tipo: 'ingrediente', valor: 'cebolla' }] }),
        regla({ texto: 'Nada separado', condiciones: [{ tipo: 'distribucion', valor: 'verde' }] }),
      ],
    }), CATALOGO)
    expect(b.reglas.map((r) => [r.texto, r.condiciones])).toEqual([['Nada verde mezclado', []], ['Nada con cebolla', []], ['Nada separado', []]])
  })

  it('una regla que choca con lo que acepta queda solo como texto si generaliza un grupo o choca con algo del catálogo', () => {
    const b = depurarPerfil(salida({
      acepta: [
        acepta({ nombre: 'Milanesa de soja', atributos: { ...TIPICOS, grupo: 'proteina', presentacion: 'separado' } }),
        acepta({ nombre: 'Pizza', atributos: { ...TIPICOS, grupo: 'cereal_almidon', presentacion: 'mezclado' } }),
        acepta({ nombre: 'Licuado de banana con leche', preparacionId: 'licuado_banana_leche' }),
      ],
      reglas: [
        regla({ texto: 'En casa no comemos carne', condiciones: [{ tipo: 'grupo', valor: 'proteina' }] }),
        regla({ texto: 'Solo lo crocante', condiciones: [{ tipo: 'textura', valor: 'crocante' }], efecto: 'requiere' }), // el licuado (catálogo) es cremoso
        regla({ texto: 'No come nada mezclado', condiciones: [{ tipo: 'presentacion', valor: 'mezclado' }] }), // la pizza "mezclado" es inferido
        regla({ texto: 'Nada verde', condiciones: [{ tipo: 'color', valor: 'verde' }] }),
      ],
    }), CATALOGO)
    expect(b.reglas.map((r) => [r.texto, r.condiciones.length])).toEqual([
      ['En casa no comemos carne', 0], ['Solo lo crocante', 0], ['No come nada mezclado', 1], ['Nada verde', 1],
    ])
    const avisos = vi.mocked(console.warn).mock.calls.map(([m]) => JSON.parse(String(m)))
    expect(avisos.filter((a) => a.aviso.startsWith('regla_')).map((a) => [a.aviso, a.acepta])).toEqual([
      ['regla_contradictoria', 'Milanesa de soja'], ['regla_contradictoria', 'Licuado de banana con leche'], ['regla_choca_con_inferido', 'Pizza'],
    ])
  })

  it('descarta reglas sin texto, con otro efecto, por alergia o repetidas', () => {
    const b = depurarPerfil(salida({
      reglas: [
        regla({ texto: 'Nada verde', condiciones: [{ tipo: 'color', valor: 'verde' }] }),
        regla({ texto: '  ', condiciones: [{ tipo: 'color', valor: 'rojo' }] }),
        regla({ texto: 'Nada frío', condiciones: [{ tipo: 'temperatura', valor: 'frio' }], efecto: 'prohibe' }),
        regla({ texto: 'Nada con huevo', porAlergia: true }),
        regla({ texto: 'nada verde', condiciones: [{ tipo: 'color', valor: 'verde' }] }),
      ],
    }), CATALOGO)
    expect(b.reglas).toEqual([{ texto: 'Nada verde', condiciones: [{ tipo: 'color', valor: 'verde' }], efecto: 'rechaza' }])
  })

  it('nunca devuelve alergias ni objetivos del nutricionista', () => {
    expect(Object.keys(depurarPerfil(salida(), CATALOGO))).toEqual(['acepta', 'rechaza', 'reglas'])
  })
})

// ---------- Schemas ----------
/** Parámetros con null o anyOf: la salida estructurada de Claude acepta hasta 16 por schema (si no, 400). */
function uniones(nodo: unknown): number {
  if (!nodo || typeof nodo !== 'object') return 0
  const propio = 'anyOf' in nodo || (Array.isArray((nodo as { type?: unknown }).type)) ? 1 : 0
  return propio + Object.values(nodo).reduce<number>((n, v) => n + (Array.isArray(v) ? v.reduce<number>((m, x) => m + uniones(x), 0) : uniones(v)), 0)
}

describe('schemas para la salida estructurada', () => {
  it('perfil y datos: como mucho 16 uniones; los 8 atributos son enum sin null; alimentoId lleva el enum', () => {
    const perfil = schemaClaude(esquemaPerfil(idsIngredientes()))
    expect(uniones(perfil)).toBeLessThanOrEqual(16)
    expect(uniones(schemaClaude(esquemaSalidaDatos))).toBeLessThanOrEqual(16)
    const json = JSON.stringify(perfil)
    expect(json).toContain('"enum":["crocante","blando","cremoso","masticable","jugoso","mixto"]')
    expect(json).toContain('"otro_verdura"')
  })
})

// ---------- Indicación del nutricionista ----------
type ObjetivoLLM = SalidaIndicacion['objetivos'][number]
const objetivo = (o: Partial<ObjetivoLLM> & Pick<ObjetivoLLM, 'nutriente' | 'valor' | 'unidad'>): ObjetivoLLM =>
  ({ cita: `${o.nutriente}: ${o.valor} ${o.unidad} por día`, tipo: 'objetivo_diario', ...o })

describe('depurarIndicacion', () => {
  it('convierte a las unidades del contrato: g → mg, mg → g, mcg → µg y vitamina D en UI (1 µg = 40 UI)', () => {
    const { objetivos, descartes } = depurarIndicacion({ objetivos: [
      objetivo({ nutriente: 'calcio_mg', valor: 1.3, unidad: 'g', cita: 'Calcio: 1,3 g/día' }),
      objetivo({ nutriente: 'vitamina_d_ug', valor: 600, unidad: 'UI', cita: 'Vitamina D: 600 UI diarias con la alimentación' }),
      objetivo({ nutriente: 'omega3_g', valor: 900, unidad: 'mg' }),
      objetivo({ nutriente: 'b12_ug', valor: 1.8, unidad: 'ug', cita: 'B12 1,8 mcg' }),
      objetivo({ nutriente: 'hierro_mg', valor: 10, unidad: 'mg' }),
      objetivo({ nutriente: 'fibra_g', valor: 25, unidad: 'g' }),
      objetivo({ nutriente: 'proteina_g', valor: 34000, unidad: 'mg' }),
      objetivo({ nutriente: 'vitamina_c_mg', valor: 45, unidad: 'mg' }),
    ] })
    expect(objetivos).toEqual({
      calcio_mg: 1300, vitamina_d_ug: 15, omega3_g: 0.9, b12_ug: 1.8, hierro_mg: 10, fibra_g: 25, proteina_g: 34, vitamina_c_mg: 45,
    })
    expect(descartes).toEqual([])
  })

  it('los suplementos no se convierten ni quedan, los marque el modelo o los delate la cita', () => {
    const { objetivos, descartes } = depurarIndicacion({ objetivos: [
      objetivo({ nutriente: 'vitamina_d_ug', valor: 400, unidad: 'UI', cita: 'Vitamina D 400 UI en gotas', tipo: 'objetivo_diario' }),
      objetivo({ nutriente: 'hierro_mg', valor: 15, unidad: 'mg', cita: 'Sulfato ferroso 15 mg', tipo: 'suplemento' }),
      objetivo({ nutriente: 'calcio_mg', valor: 500, unidad: 'mg', cita: '1 comprimido de calcio de 500 mg' }),
      objetivo({ nutriente: 'b12_ug', valor: 2, unidad: 'ug', cita: 'Suplementar B12 2 µg' }),
    ] })
    expect(objetivos).toEqual({})
    expect(descartes.map((d) => d.motivo)).toEqual(['suplemento', 'suplemento', 'suplemento', 'suplemento'])
  })

  it('solo objetivos de ingesta diaria y con cita', () => {
    const { objetivos, descartes } = depurarIndicacion({ objetivos: [
      objetivo({ nutriente: 'hierro_mg', valor: 70, unidad: 'mg', tipo: 'objetivo_semanal', cita: 'Hierro: 70 mg por semana' }),
      objetivo({ nutriente: 'vitamina_d_ug', valor: 18, unidad: 'otra', tipo: 'otro', cita: '25-OH vitamina D: 18 ng/mL' }),
      objetivo({ nutriente: 'calcio_mg', valor: 1000, unidad: 'mg', cita: '  ' }),
      objetivo({ nutriente: 'fibra_g', valor: 20, unidad: 'g' }),
    ] })
    expect(objetivos).toEqual({ fibra_g: 20 })
    expect(descartes.map((d) => [d.nutriente, d.motivo])).toEqual([
      ['hierro_mg', 'no_es_objetivo_diario'], ['vitamina_d_ug', 'no_es_objetivo_diario'], ['calcio_mg', 'sin_cita'],
    ])
  })

  it('UI solo para la vitamina D; una unidad desconocida no se convierte', () => {
    const { objetivos, descartes } = depurarIndicacion({ objetivos: [
      objetivo({ nutriente: 'vitamina_c_mg', valor: 45, unidad: 'UI' }),
      objetivo({ nutriente: 'calcio_mg', valor: 3, unidad: 'otra', cita: 'Calcio: 3 porciones de lácteos' }),
    ] })
    expect(objetivos).toEqual({})
    expect(descartes.map((d) => d.motivo)).toEqual(['unidad_invalida', 'unidad_invalida'])
  })

  it('descarta lo que queda fuera del rango plausible (errores de lectura o de unidad)', () => {
    const { objetivos, descartes } = depurarIndicacion({ objetivos: [
      objetivo({ nutriente: 'calcio_mg', valor: 1.3, unidad: 'mg' }),      // eran 1,3 g
      objetivo({ nutriente: 'vitamina_d_ug', valor: 4000, unidad: 'UI' }), // 100 µg: por encima del tope
      objetivo({ nutriente: 'hierro_mg', valor: 0, unidad: 'mg' }),
      objetivo({ nutriente: 'proteina_g', valor: -20, unidad: 'g' }),
      objetivo({ nutriente: 'b12_ug', valor: RANGO_OBJETIVO.b12_ug[1], unidad: 'ug' }), // el borde vale
    ] })
    expect(objetivos).toEqual({ b12_ug: RANGO_OBJETIVO.b12_ug[1] })
    expect(descartes.map((d) => d.motivo)).toEqual(['fuera_de_rango', 'fuera_de_rango', 'fuera_de_rango', 'fuera_de_rango'])
  })

  it('un nutriente repetido: vale el primero', () => {
    const { objetivos, descartes } = depurarIndicacion({ objetivos: [
      objetivo({ nutriente: 'calcio_mg', valor: 1000, unidad: 'mg' }),
      objetivo({ nutriente: 'calcio_mg', valor: 1.3, unidad: 'g' }),
    ] })
    expect(objetivos).toEqual({ calcio_mg: 1000 })
    expect(descartes).toEqual([{ nutriente: 'calcio_mg', motivo: 'repetido' }])
  })

  it('los rangos cubren las referencias de §10.1 para todas las edades', () => {
    const referencias = {
      proteina_g: [13, 52], calcio_mg: [700, 1300], vitamina_d_ug: [15, 15], hierro_mg: [7, 15],
      fibra_g: [19, 38], omega3_g: [0.7, 1.6], b12_ug: [0.9, 2.4], vitamina_c_mg: [15, 75],
    } satisfies Record<keyof typeof RANGO_OBJETIVO, [number, number]>
    for (const [n, [bajo, alto]] of Object.entries(referencias)) {
      const [min, max] = RANGO_OBJETIVO[n as keyof typeof RANGO_OBJETIVO]
      expect(min, n).toBeLessThanOrEqual(bajo)
      expect(max, n).toBeGreaterThanOrEqual(alto)
    }
  })
})

// ---------- extraerPerfil ----------
describe('extraerPerfil', () => {
  const pedido = (extra: Partial<PerfilInicialReq> = {}): PerfilInicialReq => ({ datos: DATOS, texto: RELATO, ...extra })

  // v5.8 · Antes las alergias no se le pasaban al modelo. Ahora sí (las de los datos): las necesita para elegir la
  // versión que come (los ingredientes) y para la duda; lo que marque porAlergia se sigue descartando.
  it('le pasa al modelo el chico, sus alergias, el catálogo con ingredientes, el vocabulario, los alimentos y el relato', async () => {
    fijarPreparaciones(CATALOGO)
    conLLM(salida())
    const b = await extraerPerfil(pedido({ texto: `  ${RELATO}  ` }))
    expect(b.acepta[0].preparacionId).toBe('papas_fritas_baston')

    const opciones = mockJSON.mock.calls[0][0]
    expect(opciones.tarea).toBe('perfil')
    expect(opciones.partes).toHaveLength(1)
    const mensaje = opciones.partes.map((p) => (p.tipo === 'texto' ? p.texto : '')).join('')
    expect(mensaje).toContain('<chico>Tomás, 6 años</chico>')
    expect(mensaje).toContain('<alergias>huevo, sesamo</alergias>')
    expect(mensaje).toContain('papas_fritas_baston: Papas fritas en bastones [papa, aceite_girasol]')
    expect(mensaje).toContain(`<relato>\n${RELATO}\n</relato>`)
    expect(opciones.sistema).toContain('- distribucion: separados, tocandose, mezclados')
    expect(opciones.sistema).toContain('"que no se toquen" → distribucion=tocandose, rechaza')
    expect(opciones.sistema).toContain('- otro_verdura: ')
    expect(opciones.sistema).toContain('Ante cualquier duda, null')
  })

  it('verifica los ids con las alergias de los datos: la milanesa con huevo no es la que come', async () => {
    fijarPreparaciones(CATALOGO)
    conLLM(salida({ acepta: [acepta({ nombre: 'Milanesa al horno', dicho: 'la milanesa al horno', preparacionId: 'milanesa_carne_con_huevo' })] }))
    const b = await extraerPerfil(pedido())
    expect(b.acepta[0].preparacionId).toBeNull()
  })

  it('en el alta por voz, las alergias que dijo (de extraerDatos) entran a la verificación', async () => {
    fijarPreparaciones(CATALOGO)
    const relato = 'Lola tiene 5 años y es alérgica al huevo. Come la milanesa al horno y el licuado de banana con leche. Le cae mal el kiwi, es alérgica.'
    const datos: SalidaDatos = {
      nombre: { valor: 'Lola', cita: 'Lola' }, edad: { valor: 5, cita: 'tiene 5 años' }, sexo: { valor: 'femenino', cita: 'es alérgica al huevo' },
      pesoKg: null, tallaCm: null, alergiasMencionadas: [{ valor: 'huevo', cita: 'alérgica al huevo' }],
      otrasAlergiasMencionadas: [{ valor: 'kiwi', cita: 'Le cae mal el kiwi' }], sinAlergias: null, alertas: [], atragantamiento: null, dieta: null, suplementos: null,
    }
    const perfil = salida({ acepta: [
      acepta({ nombre: 'Milanesa al horno', dicho: 'la milanesa al horno', preparacionId: 'milanesa_carne_con_huevo' }),
      acepta({ nombre: 'Licuado de banana con leche', preparacionId: 'licuado_banana_leche' }),
    ] })
    mockJSON.mockImplementation(async (o) => ({ datos: o.sistema === SISTEMA_DATOS ? datos : perfil, modelo: 'claude-haiku-5-5', ms: 1, reintentos: 0 }))
    const b = await extraerPerfil({ texto: relato })
    expect(b.acepta.map((a) => a.preparacionId)).toEqual([null, 'licuado_banana_leche'])
    expect(b.datos?.otrasAlergiasMencionadas).toEqual([{ valor: 'kiwi', cita: 'Le cae mal el kiwi' }])
    const mensaje = mockJSON.mock.calls.map(([o]) => o).find((o) => o.sistema !== SISTEMA_DATOS)!.partes[0]
    expect(mensaje.tipo === 'texto' && mensaje.texto).not.toContain('<alergias>')
  })

  it('el catálogo real se lee del archivo (el de B o, si no está, el sintético)', () => {
    const lista = preparaciones()
    expect(lista.length).toBeGreaterThan(0)
    for (const p of lista) expect(p).toMatchObject({ id: expect.any(String), nombre: expect.any(String) })
  })

  // Cada llamada queda pendiente hasta que el test la suelta: así se ve que las dos salen antes de que vuelva ninguna.
  function conFoto(indicacion: SalidaIndicacion | Error, relato: SalidaPerfil | Error = salida()) {
    const soltar: (() => void)[] = []
    mockJSON.mockImplementation((o) => new Promise((ok, mal) => {
      const r = o.partes.some((p) => p.tipo === 'imagen') ? indicacion : relato
      soltar.push(() => (r instanceof Error ? mal(r) : ok({ datos: r, modelo: 'claude-haiku-5-5', ms: 1, reintentos: 0 })))
    }))
    return () => soltar.forEach((s) => s())
  }
  const INDICACION: SalidaIndicacion = { objetivos: [
    objetivo({ nutriente: 'calcio_mg', valor: 1.3, unidad: 'g', cita: 'Calcio 1,3 g por día' }),
    objetivo({ nutriente: 'vitamina_d_ug', valor: 400, unidad: 'UI', cita: 'Vitamina D 400 UI en gotas', tipo: 'suplemento' }),
  ] }

  it('sin foto, una sola llamada y sin objetivosNutricionista', async () => {
    fijarPreparaciones(CATALOGO)
    conLLM(salida())
    const b = await extraerPerfil(pedido())
    expect(mockJSON).toHaveBeenCalledTimes(1)
    expect('objetivosNutricionista' in b).toBe(false)
  })

  it('con foto, la lee en paralelo con el relato (imagen JPEG, tarea perfil) y suma los objetivos válidos', async () => {
    fijarPreparaciones(CATALOGO)
    const soltar = conFoto(INDICACION)
    const promesa = extraerPerfil(pedido({ fotoIndicacionBase64: '/9j/FOTO' }))
    expect(mockJSON).toHaveBeenCalledTimes(2) // las dos salieron antes de que respondiera ninguna
    soltar()
    const b = await promesa

    const foto = mockJSON.mock.calls.map(([o]) => o).find((o) => o.partes.some((p) => p.tipo === 'imagen'))!
    expect(foto.tarea).toBe('perfil')
    expect(foto.partes[0]).toEqual({ tipo: 'imagen', base64: '/9j/FOTO', mime: 'image/jpeg' })
    expect(foto.sistema).toContain('"vitamina D 400 UI en gotas" es suplemento')
    expect(b.objetivosNutricionista).toEqual({ calcio_mg: 1300 })
    expect(b.acepta.map((a) => a.nombre)).toEqual(['Papas fritas en bastones', 'Yogur'])
  })

  it('si la foto no se lee, el perfil sale igual, sin objetivosNutricionista', async () => {
    fijarPreparaciones(CATALOGO)
    const soltar = conFoto(new Error('la imagen no se pudo procesar'))
    const promesa = extraerPerfil(pedido({ fotoIndicacionBase64: '/9j/FOTO' }))
    soltar()
    const b = await promesa
    expect('objetivosNutricionista' in b).toBe(false)
    expect(b.reglas).toHaveLength(1)
  })

  it('si la foto no trae objetivos válidos (solo suplementos, o nada), objetivosNutricionista no va', async () => {
    fijarPreparaciones(CATALOGO)
    for (const indicacion of [{ objetivos: [INDICACION.objetivos[1]] }, { objetivos: [] }]) {
      const soltar = conFoto(indicacion)
      const promesa = extraerPerfil(pedido({ fotoIndicacionBase64: '/9j/FOTO' }))
      soltar()
      expect('objetivosNutricionista' in (await promesa)).toBe(false)
    }
  })

  it('si falla el relato, falla el perfil aunque la foto se lea', async () => {
    fijarPreparaciones(CATALOGO)
    const soltar = conFoto(INDICACION, new ErrorNibble('timeout', 'La IA tardó demasiado.'))
    const promesa = extraerPerfil(pedido({ fotoIndicacionBase64: '/9j/FOTO' }))
    soltar()
    await expect(promesa).rejects.toMatchObject({ codigo: 'timeout' })
  })

  it('sin texto → entrada_invalida, sin llamar al modelo', async () => {
    await expect(extraerPerfil(pedido({ texto: '   ' }))).rejects.toMatchObject({ codigo: 'entrada_invalida' })
    expect(mockJSON).not.toHaveBeenCalled()
  })
})

// ---------- Handler ----------
function resFalsa() {
  const r = { statusCode: 0, headers: {} as Record<string, string>, body: undefined as unknown, headersSent: false }
  const res = {
    status(c: number) { r.statusCode = c; return res },
    json(b: unknown) { r.body = b; r.headersSent = true; return res },
    setHeader(k: string, v: string) { r.headers[k.toLowerCase()] = v; return res },
    get headersSent() { return r.headersSent },
  }
  return { r, res: res as unknown as VercelResponse }
}

async function llamar(handler: Handler, body: unknown, method = 'POST') {
  const { r, res } = resFalsa()
  await handler({ method, query: {}, body } as unknown as VercelRequest, res)
  return r
}

describe('api/perfil-inicial', () => {
  it('400 entrada_invalida con body vacío, datos incompletos, una alergia fuera del vocabulario o sin texto', async () => {
    const { alergias: _, ...sinAlergias } = DATOS
    for (const body of [
      {},
      { datos: sinAlergias, texto: RELATO },
      { datos: { ...DATOS, alergias: ['frutilla'] }, texto: RELATO },
      { datos: DATOS, texto: '  ' },
    ]) {
      const r = await llamar(perfilInicialHandler, body)
      expect(r.statusCode).toBe(400)
      expect((r.body as ErrorApi).error.codigo).toBe('entrada_invalida')
    }
    expect(mockJSON).not.toHaveBeenCalled()
  })

  it('200 con el PerfilBorrador y sin header de stub', async () => {
    fijarPreparaciones(CATALOGO)
    conLLM(salida())
    const r = await llamar(perfilInicialHandler, { datos: DATOS, texto: RELATO })
    expect(r.statusCode).toBe(200)
    expect(r.headers[HEADER_STUB]).toBeUndefined()
    const b = r.body as PerfilBorrador
    expect(b.rechaza.map((x) => x.motivo)).toEqual(['textura', 'mezcla'])
    expect(b.reglas[0].condiciones).toEqual([{ tipo: 'presentacion', valor: 'mezclado' }])
  })

  it('la foto llega limpia al modelo: sin el prefijo data: ni saltos de línea', async () => {
    fijarPreparaciones(CATALOGO)
    mockJSON.mockImplementation(async (o) => ({
      datos: o.partes.some((p) => p.tipo === 'imagen') ? { objetivos: [objetivo({ nutriente: 'fibra_g', valor: 20, unidad: 'g' })] } : salida(),
      modelo: 'claude-haiku-5-5', ms: 1, reintentos: 0,
    }))
    const r = await llamar(perfilInicialHandler, { datos: DATOS, texto: RELATO, fotoIndicacionBase64: 'data:image/jpeg;base64,/9j/4AAQ\nSkZJ Rg==' })
    expect(r.statusCode).toBe(200)
    expect((r.body as PerfilBorrador).objetivosNutricionista).toEqual({ fibra_g: 20 })
    const partes = mockJSON.mock.calls.flatMap(([o]) => o.partes)
    expect(partes).toContainEqual({ tipo: 'imagen', base64: '/9j/4AAQSkZJRg==', mime: 'image/jpeg' })
  })

  it('una foto vacía es como si no viniera', async () => {
    fijarPreparaciones(CATALOGO)
    conLLM(salida())
    const r = await llamar(perfilInicialHandler, { datos: DATOS, texto: RELATO, fotoIndicacionBase64: '  ' })
    expect(r.statusCode).toBe(200)
    expect(mockJSON).toHaveBeenCalledTimes(1)
  })

  it('400 si la foto no es base64, no es un JPEG o pasa de 4,5 MB, sin llamar al modelo', async () => {
    for (const foto of ['/9j/no*es*base64', 'iVBORw0KGgoAAAANSUhEUg==', `/9j/${'A'.repeat(4_500_000)}`, 1234]) {
      const r = await llamar(perfilInicialHandler, { datos: DATOS, texto: RELATO, fotoIndicacionBase64: foto })
      expect(r.statusCode).toBe(400)
      expect((r.body as ErrorApi).error.codigo).toBe('entrada_invalida')
    }
    expect(mockJSON).not.toHaveBeenCalled()
  })

  it('405 con otro método', async () => {
    const r = await llamar(perfilInicialHandler, {}, 'GET')
    expect(r.statusCode).toBe(405)
  })
})

describe('(A8b) los datos del chico en el alta por voz', () => {
  const relato = 'Te cuento de Valentina. Tiene ocho años, pesa veinticinco kilos y mide un metro veintisiete. Es alérgica al pescado y a la lactosa.'
  const salida = (extra: Partial<SalidaDatos> = {}): SalidaDatos => ({
    nombre: { valor: 'Valentina', cita: 'Te cuento de Valentina' },
    edad: { valor: 8, cita: 'Tiene ocho años' },
    sexo: { valor: 'femenino', cita: 'Es alérgica' },
    pesoKg: { valor: 25, cita: 'pesa veinticinco kilos' },
    tallaCm: { valor: 127, cita: 'mide un metro veintisiete' },
    alergiasMencionadas: [{ valor: 'pescado', cita: 'alérgica al pescado' }, { valor: 'leche', cita: 'a la lactosa' }, { valor: 'pescado', cita: 'alérgica al pescado' }],
    otrasAlergiasMencionadas: [],
    sinAlergias: null,
    alertas: [],
    atragantamiento: null,
    dieta: null,
    suplementos: null,
    ...extra,
  })

  it('cada dato con su cita del relato; las alergias sin repetir', () => {
    const d = depurarDatos(salida(), relato)
    expect(d.nombre?.valor).toBe('Valentina')
    expect(d.edad?.valor).toBe(8)
    expect(d.sexo?.valor).toBe('femenino')
    expect([d.pesoKg?.valor, d.tallaCm?.valor]).toEqual([25, 127])
    expect(d.alergiasMencionadas.map((a) => a.valor)).toEqual(['pescado', 'leche'])
    expect(faltanVitales(d, { acepta: [{ nombre: 'x', preparacionId: null, atributos: {} }], rechaza: [] })).toEqual(['rechaza'])
  })

  it('sin cita que esté en el relato, o fuera de rango o de vocabulario, no hay dato', () => {
    const d = depurarDatos(salida({
      nombre: { valor: 'Valentina', cita: 'se llama Vale' },
      edad: { valor: 45, cita: 'Tiene ocho años' },
      sexo: { valor: 'otro', cita: 'Es alérgica' },
      alergiasMencionadas: [{ valor: 'polen', cita: 'Es alérgica' }],
    }), relato)
    expect(d.nombre).toBeUndefined()
    expect(d.edad).toBeUndefined()
    expect(d.sexo).toBeUndefined()
    expect(d.alergiasMencionadas).toEqual([])
    expect(faltanVitales(d, { acepta: [], rechaza: [] })).toEqual(['nombre', 'edad', 'sexo', 'alergias', 'acepta', 'rechaza'])
  })

  it('(v5.8) las otras alergias: como las dijo, con cita, sin repetir y sin las que son de ALERGENO con otro nombre', () => {
    const texto = 'Es alérgico al kiwi y al Kiwi también, intolerante a la lactosa y el colorante rojo le da ronchas. Es celíaco.'
    const d = depurarDatos(salida({
      alergiasMencionadas: [],
      otrasAlergiasMencionadas: [
        { valor: 'kiwi', cita: 'alérgico al kiwi' }, { valor: 'Kiwi', cita: 'al Kiwi también' }, { valor: 'lactosa', cita: 'intolerante a la lactosa' },
        { valor: 'colorante  rojo', cita: 'el colorante rojo le da ronchas' }, { valor: 'gluten (celíaco)', cita: 'Es celíaco' },
        { valor: 'durazno', cita: 'alérgico al durazno' },
      ],
    }), texto)
    expect(d.otrasAlergiasMencionadas).toEqual([
      { valor: 'kiwi', cita: 'alérgico al kiwi' }, { valor: 'colorante rojo', cita: 'el colorante rojo le da ronchas' },
    ])
    // dijo una alergia (aunque no sea de ALERGENO): las alergias no faltan
    expect(faltanVitales(d, { acepta: [], rechaza: [] })).not.toContain('alergias')
    expect('otrasAlergiasMencionadas' in depurarDatos(salida(), relato)).toBe(false)
  })
})
