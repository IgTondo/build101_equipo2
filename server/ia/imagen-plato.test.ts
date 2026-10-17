// A10 · prompt de la imagen del plato y POST /api/imagen-plato, con generarImagen mockeado (sin Workers AI).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ErrorApi, ImagenPlatoReq, Receta, Regla } from '../../shared/contratos.js'
import handler from '../../api/imagen-plato.js'
import { HEADER_STUB } from '../http.js'
import { preparacion } from '../validacion/ejemplos.js'
import { ErrorIA } from './errores.js'
import { generarImagen } from './imagen.js'
import { imagenPlato, promptImagenPlato } from './imagen-plato.js'

vi.mock('./imagen.js', () => ({ generarImagen: vi.fn() }))
const flux = vi.mocked(generarImagen)

const RECETA = JSON.parse(readFileSync(join(process.cwd(), 'fixtures', 'receta.json'), 'utf8')) as Receta
const pedido = (reglas: Regla[] = [], receta: Receta = RECETA): ImagenPlatoReq => ({ receta, reglas })
const regla = (efecto: Regla['efecto'], tipo: Regla['condiciones'][number]['tipo'], valor: string): Regla =>
  ({ texto: `${tipo}=${valor}`, condiciones: [{ tipo, valor }], efecto })

beforeEach(() => {
  flux.mockReset()
  flux.mockResolvedValue({ imagenBase64: 'AAAA', mime: 'image/jpeg', modelo: '@cf/black-forest-labs/flux-1-schnell', ms: 900 })
})

describe('promptImagenPlato', () => {
  const p = promptImagenPlato(pedido(), preparacion)

  it('foto cenital realista en un plato playo blanco', () => {
    expect(p).toMatch(/^Realistic overhead photo, shot from directly above, of a plain white flat plate/)
  })

  it('su alimento seguro en porción normal y el nuevo separado, en porción chica', () => {
    expect(p).toContain('On the left side of the plate: a normal portion of crispy golden oven-baked potato, cut into sticks.')
    expect(p).toContain('On the right side, clearly separated so they do not touch: a very small portion, just 2 pieces of crispy golden oven-baked breaded mozzarella cheese, cut into sticks.')
  })

  it('sin salsa encima, sin texto, sin personas y sin decoración', () => {
    for (const frase of ['No sauce on the food.', 'No other foods on the plate.', 'No text, no letters, no labels', 'no people, no hands', 'no decoration, no garnish']) {
      expect(p).toContain(frase)
    }
  })

  it('en inglés: no pasa los nombres en español si están en el catálogo', () => {
    expect(p).not.toMatch(/[^\x20-\x7e]/)
    expect(p).not.toContain('Bastones')
  })

  it('plato con divisiones si una regla lo pide (o si rechaza el playo)', () => {
    for (const r of [regla('requiere', 'plato', 'con_divisiones'), regla('rechaza', 'plato', 'playo')]) {
      const conDivisiones = promptImagenPlato(pedido([r]), preparacion)
      expect(conDivisiones).toContain('a plain white divided plate with separate sections')
      expect(conDivisiones).toContain('In the left section: a normal portion of')
      expect(conDivisiones).toContain('In a separate section on the right: a very small portion')
    }
  })

  it('plato hondo si una regla lo requiere', () => {
    expect(promptImagenPlato(pedido([regla('requiere', 'plato', 'hondo')]), preparacion)).toContain('a plain white deep plate')
  })

  it('"que no se toquen": deja un espacio grande entre los dos', () => {
    expect(promptImagenPlato(pedido([regla('rechaza', 'distribucion', 'tocandose')]), preparacion)).toContain('they must not touch at all')
    expect(p).not.toContain('must not touch at all')
  })

  it('un puré o algo con granos va en una cucharada', () => {
    const yogur: Receta = { ...RECETA, preparacionBaseId: 'yogur_vainilla' }
    expect(promptImagenPlato(pedido([], yogur), preparacion)).toContain('just one spoonful of creamy white yogurt, as a smooth puree')
  })

  it('sin la preparación en el catálogo: el ingrediente principal en inglés, o el nombre tal cual', () => {
    const r = promptImagenPlato(pedido(), () => undefined)
    expect(r).toContain('a normal portion of "Papas al horno en bastones, crocantes"')
    expect(r).toContain('a very small portion of mozzarella cheese')
  })
})

describe('imagenPlato', () => {
  it('llama a generarImagen con el prompt y la marca como ilustrativa', async () => {
    expect(await imagenPlato(pedido())).toEqual({ imagenBase64: 'AAAA', mime: 'image/jpeg', ilustrativa: true })
    expect(flux).toHaveBeenCalledWith({ prompt: promptImagenPlato(pedido()) })
  })
})

describe('POST /api/imagen-plato', () => {
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
  async function llamar(method: string, body: unknown) {
    const { r, res } = resFalsa()
    await handler({ method, query: {}, body } as unknown as VercelRequest, res)
    return r
  }
  vi.spyOn(console, 'error').mockImplementation(() => {})

  it('devuelve la imagen con ilustrativa: true y sin el header de stub', async () => {
    const r = await llamar('POST', pedido([regla('requiere', 'plato', 'con_divisiones')]))
    expect(r.statusCode).toBe(200)
    expect(r.body).toEqual({ imagenBase64: 'AAAA', mime: 'image/jpeg', ilustrativa: true })
    expect(r.headers[HEADER_STUB]).toBeUndefined()
    expect(flux.mock.calls[0][0].prompt).toContain('divided plate')
  })

  it('las reglas son opcionales', async () => {
    expect((await llamar('POST', { receta: RECETA })).statusCode).toBe(200)
  })

  it('body vacío → 400 entrada_invalida, sin generar nada', async () => {
    const r = await llamar('POST', {})
    expect(r.statusCode).toBe(400)
    expect((r.body as ErrorApi).error.codigo).toBe('entrada_invalida')
    expect(flux).not.toHaveBeenCalled()
  })

  it('una regla con un tipo que no existe → 400', async () => {
    const r = await llamar('POST', { receta: RECETA, reglas: [{ texto: 'x', condiciones: [{ tipo: 'marca', valor: 'y' }], efecto: 'rechaza' }] })
    expect(r.statusCode).toBe(400)
  })

  it('otro método → 405', async () => {
    const r = await llamar('GET', undefined)
    expect(r.statusCode).toBe(405)
    expect((r.body as ErrorApi).error.codigo).toBe('metodo_no_permitido')
  })

  it('si Workers AI se queda sin cupo → 429 limite_proveedor, reintentable', async () => {
    flux.mockRejectedValueOnce(new ErrorIA('limite', '429 de Workers AI'))
    const r = await llamar('POST', pedido())
    expect(r.statusCode).toBe(429)
    expect((r.body as ErrorApi).error).toMatchObject({ codigo: 'limite_proveedor', reintentable: true })
  })

  it('mientras generarImagen no esté implementado → 500 interno', async () => {
    flux.mockRejectedValueOnce(new ErrorIA('no_implementado', 'generarImagen todavía no está implementado'))
    expect((await llamar('POST', pedido())).statusCode).toBe(500)
  })
})
