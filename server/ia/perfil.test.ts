// A8: perfil inicial. generarJSON va mockeado (sin keys ni red): se prueba lo que decide el código.
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DatosBasicos, ErrorApi, PerfilBorrador, PerfilInicialReq, PreparacionCatalogo } from '../../shared/contratos.js'
import { HEADER_STUB, type Handler } from '../http.js'
import perfilInicialHandler from '../../api/perfil-inicial.js'
import { generarJSON } from './modelo.js'
import { depurarPerfil, extraerPerfil, fijarPreparaciones, preparaciones, type SalidaPerfil } from './perfil.js'

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

beforeEach(() => mockJSON.mockReset())
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

  it('acepta la foto de la indicación pero todavía no la procesa (P2)', async () => {
    fijarPreparaciones(CATALOGO as PreparacionCatalogo[])
    conLLM(salida())
    const b = await extraerPerfil(pedido({ fotoIndicacionBase64: '/9j/AAAA' }))
    expect(b.objetivosNutricionista).toBeUndefined()
    expect(mockJSON.mock.calls[0][0].partes.every((p) => p.tipo === 'texto')).toBe(true)
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
