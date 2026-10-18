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
import { cantidadEnPresentacion, imagenPlato, promptImagenPlato } from './imagen-plato.js'

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

// Las recetas de la evaluación visual (A10): las que en vivo salían mal con el prompt anterior.
const otra = (preparacionBaseId: string, desde: [string, string], presentacion: string, extra: Partial<Receta> = {}): Receta =>
  ({ ...RECETA, preparacionBaseId, desde: { preparacionId: desde[0], nombre: desde[1] }, presentacion, ...extra })

describe('promptImagenPlato', () => {
  const p = promptImagenPlato(pedido(), preparacion)

  it('foto cenital realista en un plato playo blanco', () => {
    expect(p).toMatch(/^Realistic overhead food photograph taken from directly above, a 90-degree top-down view of one plain round white flat plate/)
  })

  it('papas al horno en bastones → bastones con forma de papas fritas, no "cut into sticks" (salían cubos)', () => {
    expect(p).toContain('On the left half of the plate: a normal portion of about 12 oven-baked potato fries: potato cut into long thin sticks shaped exactly like French fries')
    expect(p).not.toContain('cut into sticks')
    expect(p).not.toMatch(/cube/i)
  })

  it('el nuevo a la derecha, con la cantidad de la presentación ("2 bastones de queso") y la misma forma que su alimento seguro', () => {
    expect(p).toContain('On the right half of the plate: exactly 2 breaded mozzarella sticks, a very small portion: long rectangular mozzarella cheese sticks')
    expect(p).toContain('The breaded mozzarella sticks have the same shape and size as the oven-baked potato fries.')
  })

  it('separados, sin salsa, sin cubiertos, sin texto y sin personas', () => {
    expect(p).toContain('they do not touch each other')
    for (const frase of ['no sauce or garnish', 'no cutlery', 'no text', 'no people, no hands']) expect(p).toContain(frase)
  })

  it('en inglés: no pasa los nombres en español si están en el catálogo', () => {
    expect(p).not.toMatch(/[^\x20-\x7e]/)
    expect(p).not.toContain('Bastones')
  })

  it('leche chocolatada → yogur bebible: dos vasos, nunca "en el plato" (antes daba un 400 de contenido NSFW)', () => {
    const r = promptImagenPlato(pedido([], otra('yogur_bebible', ['leche_chocolatada', 'Leche chocolatada'], '')), preparacion)
    expect(r).toMatch(/^Realistic food photograph taken from a high angle/)
    expect(r).toContain('On the left: a tall clear drinking glass filled with chocolate milk')
    expect(r).toContain('On the right, set a little apart: a small short clear glass with only a few sips of drinkable vanilla yogurt')
    expect(r).not.toContain('plate')
    expect(r).not.toContain('whole')
  })

  it('milanesa de carne → "un pedacito" de milanesa de merluza: un trozo chico, no otra milanesa entera', () => {
    const r = promptImagenPlato(pedido([], otra('milanesa_merluza_horno', ['milanesa_carne_horno', 'Milanesa de carne'],
      'Su milanesa de carne a la izquierda y un pedacito de milanesa de merluza a la derecha.')), preparacion)
    expect(r).toContain('On the left half of the plate: one whole breaded beef cutlet: a thin, flat, oval cutlet')
    expect(r).toContain('On the right half of the plate: just one small piece cut from a breaded hake fish fillet, about a quarter of a whole one')
  })

  it('tostadas → tostadas con queso: el queso no se pierde (antes salía "white bread" a los dos lados)', () => {
    const r = promptImagenPlato(pedido([], otra('tostadas_queso', ['tostadas', 'Tostadas de pan blanco'], 'Media tostada con queso a la derecha.')), preparacion)
    expect(r).toContain('a normal portion of 2 slices of white bread toast: square white sandwich bread toasted golden brown, plain, with nothing on top')
    expect(r).toContain('just half of one slice of cheese toast, a small piece: square white sandwich bread toast completely covered with melted mozzarella cheese')
  })

  it('papas fritas → bastones de boniato: cada uno de su color, 3 como dice la receta', () => {
    const r = promptImagenPlato(pedido([regla('rechaza', 'distribucion', 'tocandose')],
      otra('bastones_boniato_fritos', ['papas_fritas_baston', 'Papas fritas en bastones'], 'Sus papas fritas a la izquierda y 3 bastones de boniato a la derecha.',
        { seMantiene: ['forma=baston', 'textura=crocante', 'coccion=frito'] })), preparacion)
    expect(r).toContain('about 14 French fries: golden, crispy deep-fried potato sticks')
    expect(r).toContain('exactly 3 sweet potato fries, a very small portion: bright orange sweet potato')
    expect(r).toContain('with plenty of space')
  })

  it('plato con divisiones si una regla lo pide (o si rechaza el playo)', () => {
    for (const r of [regla('requiere', 'plato', 'con_divisiones'), regla('rechaza', 'plato', 'playo')]) {
      const conDivisiones = promptImagenPlato(pedido([r]), preparacion)
      expect(conDivisiones).toContain('one plain white divided plate with two separate sections')
      expect(conDivisiones).toContain('In the left section of the plate: a normal portion of')
      expect(conDivisiones).toContain('In the right section of the plate: exactly 2')
    }
  })

  it('plato hondo si una regla lo requiere', () => {
    expect(promptImagenPlato(pedido([regla('requiere', 'plato', 'hondo')]), preparacion)).toContain('one plain round white deep plate')
  })

  it('el yogur va en un bol al lado del plato', () => {
    const r = promptImagenPlato(pedido([], otra('yogur_vainilla', ['papas_horno_baston', 'Papas al horno'], '')), preparacion)
    expect(r).toContain('On the left: one plain round white flat plate with a normal portion of about 12 oven-baked potato fries')
    expect(r).toContain('On the right, set a little apart: a very small plain white bowl with just two spoonfuls of vanilla yogurt')
  })

  it('un puré va en una cucharada; con salsa no se pide "sin salsa"', () => {
    const pure = promptImagenPlato(pedido([], otra('pure_zapallo', ['papas_horno_baston', 'Papas'], '')), preparacion)
    expect(pure).toContain('just one small spoonful of pumpkin puree: smooth bright orange pumpkin puree')
    const salsa = promptImagenPlato(pedido([], otra('fideos_con_salsa', ['papas_horno_baston', 'Papas'], '')), preparacion)
    expect(salsa).not.toContain('no sauce')
  })

  it('sin la preparación en el catálogo: el ingrediente principal en inglés (o el nombre) y la forma que se mantiene', () => {
    const r = promptImagenPlato(pedido([], otra('bastones_raros', ['empanada_x', 'Bastones de polenta fritos'], '',
      { seMantiene: ['forma=baston', 'textura=crocante', 'coccion=frito'] })), () => undefined)
    expect(r).toContain('a normal portion of about 10 pieces of "Bastones de polenta fritos": crispy fried "Bastones de polenta fritos", cut into long thin sticks shaped exactly like French fries')
    expect(r).toContain('exactly 2 pieces of mozzarella cheese, a very small portion: crispy fried breaded mozzarella cheese, cut into long thin sticks')
    expect(r).toContain('have the same shape and size as the')
  })

  it('cada preparación del catálogo, como su alimento seguro o como la nueva, da un prompt en inglés de menos de 2048 caracteres', () => {
    const ids = (JSON.parse(readFileSync(join(process.cwd(), 'data', 'preparaciones.json'), 'utf8')) as { id: string }[]).map((x) => x.id)
    for (const id of ids) {
      for (const r of [otra(id, ['papas_horno_baston', 'Papas'], ''), otra('bastones_queso_horno', [id, 'x'], '')]) {
        const prompt = promptImagenPlato(pedido([regla('requiere', 'plato', 'con_divisiones')], r))
        expect(prompt.length, id).toBeLessThanOrEqual(2048)
        expect(prompt, id).not.toMatch(/[^\x20-\x7e]/)
        expect(prompt, id).not.toContain('"')
      }
    }
  })
})

describe('cantidadEnPresentacion', () => {
  it.each([
    ['2 bastones de queso a la derecha', 2],
    ['Sus papas y tres nuggets', 3],
    ['media tostada con queso', 0.5],
    ['un pedacito de milanesa', 1],
    ['Sus 12 bastones de papa y 2 bastones de queso', 2],
    ['En su plato playo de siempre', undefined],
    [undefined, undefined],
  ])('"%s" → %s', (texto, n) => {
    expect(cantidadEnPresentacion(texto)).toBe(n)
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
