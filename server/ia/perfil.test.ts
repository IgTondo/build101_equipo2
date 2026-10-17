// A8 y A12: perfil inicial y foto de la indicación. generarJSON va mockeado (sin keys ni red): se prueba lo que decide
// el código.
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DatosBasicos, ErrorApi, PerfilBorrador, PerfilInicialReq, PreparacionCatalogo } from '../../shared/contratos.js'
import { ErrorNibble, HEADER_STUB, type Handler } from '../http.js'
import perfilInicialHandler from '../../api/perfil-inicial.js'
import { generarJSON } from './modelo.js'
import {
  depurarIndicacion, depurarPerfil, extraerPerfil, fijarPreparaciones, preparaciones, RANGO_OBJETIVO,
  type SalidaIndicacion, type SalidaPerfil,
} from './perfil.js'

vi.mock('./modelo.js', () => ({ generarJSON: vi.fn() }))
const mockJSON = vi.mocked(generarJSON)

const DATOS: DatosBasicos = {
  nombre: 'Tomás', edad: 6, sexo: 'masculino', alergias: ['huevo', 'sesamo'], alertas: [], dieta: 'ninguna',
}
const RELATO = 'Tomás tiene 6 años. Come papas fritas en bastones, la milanesa al horno y el yogur Conaprole. '
  + 'No come nada mezclado: el arroz con pollo no lo toca. El puré de papa tampoco, por la textura. '
  + 'Es alérgico al huevo, así que la milanesa la hacemos sin huevo.'

const CATALOGO: Pick<PreparacionCatalogo, 'id' | 'nombre'>[] = [
  { id: 'papas_fritas_baston', nombre: 'Papas fritas en bastones' },
  { id: 'milanesa_carne_horno', nombre: 'Milanesa de carne al horno' },
  { id: 'pure_papa', nombre: 'Puré de papa' },
  { id: 'arroz_con_pollo', nombre: 'Arroz con pollo' },
]

type AtributosLLM = SalidaPerfil['acepta'][number]['atributos']
const sinAtributos: AtributosLLM = { textura: null, forma: null, color: null, sabor: null, temperatura: null, presentacion: null, grupo: null, coccion: null }
const acepta = (a: Partial<SalidaPerfil['acepta'][number]> & { nombre: string }): SalidaPerfil['acepta'][number] =>
  ({ preparacionId: null, marca: null, ...a, atributos: { ...sinAtributos, ...a.atributos } })
const rechaza = (r: Partial<SalidaPerfil['rechaza'][number]> & { nombre: string }): SalidaPerfil['rechaza'][number] =>
  ({ preparacionId: null, motivo: 'otro', porAlergia: false, ...r })
const regla = (r: Partial<SalidaPerfil['reglas'][number]> & { texto: string }): SalidaPerfil['reglas'][number] =>
  ({ condiciones: [], efecto: 'rechaza', porAlergia: false, ...r })

function salida(s: Partial<SalidaPerfil> = {}): SalidaPerfil {
  return {
    acepta: [
      acepta({ nombre: 'Papas fritas en bastones', preparacionId: 'papas_fritas_baston', atributos: { ...sinAtributos, textura: 'crocante', forma: 'baston', coccion: 'frito' } }),
      acepta({ nombre: 'Yogur', marca: 'Conaprole' }),
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

beforeEach(() => { mockJSON.mockReset() }) // con llaves: si devuelve el mock, Vitest lo llama como limpieza
afterEach(() => fijarPreparaciones(null))

// ---------- Depuración ----------
describe('depurarPerfil', () => {
  it('deja el borrador como lo dio el modelo cuando todo está en el vocabulario y en el catálogo', () => {
    expect(depurarPerfil(salida(), CATALOGO)).toEqual({
      acepta: [
        { nombre: 'Papas fritas en bastones', preparacionId: 'papas_fritas_baston', atributos: { textura: 'crocante', forma: 'baston', coccion: 'frito' } },
        { nombre: 'Yogur', preparacionId: null, marca: 'Conaprole', atributos: {} },
      ],
      rechaza: [
        { nombre: 'Puré de papa', preparacionId: 'pure_papa', motivo: 'textura' },
        { nombre: 'Arroz con pollo', preparacionId: 'arroz_con_pollo', motivo: 'mezcla' },
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

  it('atributos fuera del vocabulario se descartan; los demás quedan escritos como en el contrato', () => {
    const b = depurarPerfil(salida({
      acepta: [acepta({ nombre: 'Papas fritas', atributos: { ...sinAtributos, textura: 'Crocante', forma: 'bastón', color: 'fucsia', sabor: 'umami', temperatura: 'caliente', grupo: 'cereal_almidon' } })],
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
    expect(b.acepta).toEqual([{ nombre: 'Yogur de vainilla', preparacionId: null, atributos: {} }])
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

  it('le pasa al modelo el chico, el catálogo, el vocabulario y el relato, pero no las alergias', async () => {
    fijarPreparaciones(CATALOGO as PreparacionCatalogo[])
    conLLM(salida())
    const b = await extraerPerfil(pedido({ texto: `  ${RELATO}  ` }))
    expect(b.acepta[0].preparacionId).toBe('papas_fritas_baston')

    const opciones = mockJSON.mock.calls[0][0]
    expect(opciones.tarea).toBe('perfil')
    expect(opciones.partes).toHaveLength(1)
    const mensaje = opciones.partes.map((p) => (p.tipo === 'texto' ? p.texto : '')).join('')
    expect(mensaje).toContain('<chico>Tomás, 6 años</chico>')
    expect(mensaje).toContain('papas_fritas_baston: Papas fritas en bastones')
    expect(mensaje).toContain(`<relato>\n${RELATO}\n</relato>`)
    expect(opciones.sistema).toContain('- distribucion: separados, tocandose, mezclados')
    expect(opciones.sistema).toContain('"que no se toquen" → distribucion=tocandose, rechaza')
    expect(`${opciones.sistema}\n${mensaje}`).not.toMatch(/sesamo/)
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
    fijarPreparaciones(CATALOGO as PreparacionCatalogo[])
    conLLM(salida())
    const b = await extraerPerfil(pedido())
    expect(mockJSON).toHaveBeenCalledTimes(1)
    expect('objetivosNutricionista' in b).toBe(false)
  })

  it('con foto, la lee en paralelo con el relato (imagen JPEG, tarea perfil) y suma los objetivos válidos', async () => {
    fijarPreparaciones(CATALOGO as PreparacionCatalogo[])
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
    fijarPreparaciones(CATALOGO as PreparacionCatalogo[])
    const soltar = conFoto(new Error('la imagen no se pudo procesar'))
    const promesa = extraerPerfil(pedido({ fotoIndicacionBase64: '/9j/FOTO' }))
    soltar()
    const b = await promesa
    expect('objetivosNutricionista' in b).toBe(false)
    expect(b.reglas).toHaveLength(1)
  })

  it('si la foto no trae objetivos válidos (solo suplementos, o nada), objetivosNutricionista no va', async () => {
    fijarPreparaciones(CATALOGO as PreparacionCatalogo[])
    for (const indicacion of [{ objetivos: [INDICACION.objetivos[1]] }, { objetivos: [] }]) {
      const soltar = conFoto(indicacion)
      const promesa = extraerPerfil(pedido({ fotoIndicacionBase64: '/9j/FOTO' }))
      soltar()
      expect('objetivosNutricionista' in (await promesa)).toBe(false)
    }
  })

  it('si falla el relato, falla el perfil aunque la foto se lea', async () => {
    fijarPreparaciones(CATALOGO as PreparacionCatalogo[])
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
    fijarPreparaciones(CATALOGO as PreparacionCatalogo[])
    conLLM(salida())
    const r = await llamar(perfilInicialHandler, { datos: DATOS, texto: RELATO })
    expect(r.statusCode).toBe(200)
    expect(r.headers[HEADER_STUB]).toBeUndefined()
    const b = r.body as PerfilBorrador
    expect(b.rechaza.map((x) => x.motivo)).toEqual(['textura', 'mezcla'])
    expect(b.reglas[0].condiciones).toEqual([{ tipo: 'presentacion', valor: 'mezclado' }])
  })

  it('405 con otro método', async () => {
    const r = await llamar(perfilInicialHandler, {}, 'GET')
    expect(r.statusCode).toBe(405)
  })
})
