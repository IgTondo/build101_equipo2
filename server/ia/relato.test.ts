// A7: relato de la comida. generarJSON y transcribir van mockeados (sin keys ni red): se prueba lo que decide el código.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AnalisisComida, ErrorApi, RelatoComida, RelatoComidaReq, TranscribirRes } from '../../shared/contratos.js'
import { ErrorNibble, HEADER_STUB, type Handler } from '../http.js'
import relatoHandler from '../../api/relato-comida.js'
import transcribirHandler from '../../api/transcribir.js'
import { generarJSON } from './modelo.js'
import {
  citaEnTranscripcion, depurarRelato, interpretarRelato, normalizar, pistaTranscripcion, type SalidaRelato,
} from './relato.js'
import { transcribir } from './voz.js'

vi.mock('./modelo.js', () => ({ generarJSON: vi.fn() }))
vi.mock('./voz.js', () => ({ transcribir: vi.fn() }))
const mockJSON = vi.mocked(generarJSON)
const mockTranscribir = vi.mocked(transcribir)

const ANALISIS = JSON.parse(readFileSync(join(process.cwd(), 'fixtures', 'analizar-comida.json'), 'utf8')) as AnalisisComida
// i1 puré de papa (mediana) · i2 milanesa de carne al horno (mediana) · i3 bastones de queso horneados (chica)
// q1 "¿Los bastones de la derecha son de queso?" [Sí, de queso | No, son de otra cosa] · q2 "¿Comió en la mesa…?" [Sí | No]
const RELATO = 'El puré ni lo quiso, lo corrió para el costado, no le gusta esa textura. Los bastones de queso se comió la mitad, '
  + 'agarró uno solo y lo fue mordiendo despacito. Sí, eran de queso. Comimos todos juntos y estuvo tranquilo.'

type RespuestaLLM = SalidaRelato['respuestas'][number]
const resp = (r: Partial<RespuestaLLM> & Pick<RespuestaLLM, 'itemIdTmp' | 'cuanto' | 'cita'>): RespuestaLLM =>
  ({ porcion: null, motivo: null, confianza: 0.9, ...r })

function salida(s: Partial<SalidaRelato> = {}): SalidaRelato {
  return {
    respuestas: [
      resp({ itemIdTmp: 'i1', cuanto: 'aparto', motivo: 'textura', confianza: 0.92, cita: 'El puré ni lo quiso, lo corrió para el costado' }),
      resp({ itemIdTmp: 'i3', cuanto: 'mitad', confianza: 0.85, cita: 'Los bastones de queso se comió la mitad' }),
    ],
    respuestasPreguntas: [{ preguntaId: 'q1', respuesta: 'Sí, de queso' }, { preguntaId: 'q2', respuesta: 'Sí' }],
    conducta: ['tranquilo'],
    comentario: 'Apartó el puré por la textura y comió la mitad de los bastones de queso. Comida tranquila.',
    ...s,
  }
}

const depurar = (s: SalidaRelato, transcripcion = RELATO) =>
  depurarRelato(s, { items: ANALISIS.items, preguntas: ANALISIS.preguntas, transcripcion })

function conLLM(s: SalidaRelato) {
  mockJSON.mockResolvedValue({ datos: s, modelo: 'claude-haiku-5-5', ms: 900, reintentos: 0 })
}

const pedido = (extra: Partial<RelatoComidaReq>): RelatoComidaReq => ({ ninoId: 'tomas', analisis: ANALISIS, ...extra })

beforeEach(() => {
  mockJSON.mockReset()
  mockTranscribir.mockReset()
})

// ---------- Citas ----------
describe('normalizar y citaEnTranscripcion', () => {
  it('ignora mayúsculas, tildes, puntuación y espacios de más', () => {
    expect(normalizar('  ¡Lo SACÓ   del plato!, ¿viste?  ')).toBe('lo saco del plato viste')
    expect(citaEnTranscripcion('el pure NI LO QUISO lo corrio para el costado', RELATO)).toBe(true)
    expect(citaEnTranscripcion('Sí — eran de queso…', RELATO)).toBe(true)
  })

  it('compara palabras completas y una cita vacía o solo con puntuación nunca está', () => {
    expect(citaEnTranscripcion('comi', 'se lo comió todo')).toBe(false)
    expect(citaEnTranscripcion('', RELATO)).toBe(false)
    expect(citaEnTranscripcion(' ... ', RELATO)).toBe(false)
  })

  it('una cita que el padre no dijo no está', () => {
    expect(citaEnTranscripcion('se comió todo el puré', RELATO)).toBe(false)
  })
})

// ---------- Depuración ----------
describe('depurarRelato', () => {
  it('se queda con las respuestas con cita y manda lo no mencionado a sinMencion', () => {
    const { relato, descartes } = depurar(salida())
    expect(relato.respuestas.map((r) => [r.itemIdTmp, r.cuanto, r.motivo])).toEqual([['i1', 'aparto', 'textura'], ['i3', 'mitad', undefined]])
    expect(relato.sinMencion).toEqual(['i2'])
    expect(descartes).toEqual([])
  })

  it('acepta la cita con tildes y mayúsculas distintas, y la devuelve como la escribió el modelo', () => {
    const { relato } = depurar(salida({ respuestas: [resp({ itemIdTmp: 'i1', cuanto: 'aparto', cita: ' EL PURE NI LO QUISO ' })] }))
    expect(relato.respuestas).toEqual([{ itemIdTmp: 'i1', cuanto: 'aparto', confianza: 0.9, cita: 'EL PURE NI LO QUISO' }])
    expect(relato.sinMencion).toEqual(['i2', 'i3'])
  })

  it('descarta la respuesta si la cita no está en la transcripción o viene vacía, y el ítem va a sinMencion', () => {
    const { relato, descartes } = depurar(salida({
      respuestas: [
        resp({ itemIdTmp: 'i1', cuanto: 'aparto', cita: 'El puré ni lo quiso' }),
        resp({ itemIdTmp: 'i2', cuanto: 'todo', cita: 'La milanesa se la comió toda' }),    // inventada
        resp({ itemIdTmp: 'i3', cuanto: 'mitad', cita: '   ' }),
      ],
    }))
    expect(relato.respuestas.map((r) => r.itemIdTmp)).toEqual(['i1'])
    expect(relato.sinMencion).toEqual(['i2', 'i3'])
    expect(descartes).toEqual([{ itemIdTmp: 'i2', motivo: 'cita_no_esta' }, { itemIdTmp: 'i3', motivo: 'sin_cita' }])
  })

  it('descarta ítems que el modelo inventó (idTmp que no está en el plato) y no los suma a sinMencion', () => {
    const { relato, descartes } = depurar(salida({
      respuestas: [...salida().respuestas, resp({ itemIdTmp: 'i9', cuanto: 'todo', cita: 'estuvo tranquilo' })],
    }))
    expect(relato.respuestas.map((r) => r.itemIdTmp)).toEqual(['i1', 'i3'])
    expect(relato.sinMencion).toEqual(['i2'])
    expect(descartes).toEqual([{ itemIdTmp: 'i9', motivo: 'item_inexistente' }])
  })

  it('con dos respuestas para el mismo ítem se queda con la de mayor confianza, aunque venga después', () => {
    const { relato } = depurar(salida({
      respuestas: [
        resp({ itemIdTmp: 'i3', cuanto: 'probo', confianza: 0.6, cita: 'lo fue mordiendo despacito' }),
        resp({ itemIdTmp: 'i3', cuanto: 'mitad', confianza: 0.85, cita: 'se comió la mitad' }),
        resp({ itemIdTmp: 'i3', cuanto: 'poco', confianza: 0.7, cita: 'agarró uno solo' }),
      ],
    }))
    expect(relato.respuestas).toEqual([{ itemIdTmp: 'i3', cuanto: 'mitad', confianza: 0.85, cita: 'se comió la mitad' }])
    expect(relato.sinMencion).toEqual(['i1', 'i2'])
  })

  it('si la de mayor confianza tiene una cita inventada, queda la otra', () => {
    const { relato } = depurar(salida({
      respuestas: [
        resp({ itemIdTmp: 'i3', cuanto: 'todo', confianza: 0.95, cita: 'se comió todos los bastones' }),
        resp({ itemIdTmp: 'i3', cuanto: 'mitad', confianza: 0.8, cita: 'se comió la mitad' }),
      ],
    }))
    expect(relato.respuestas.map((r) => r.cuanto)).toEqual(['mitad'])
  })

  it('sinMencion sin duplicados aunque el plato repita un idTmp', () => {
    const items = [...ANALISIS.items, ANALISIS.items[1]]
    const { relato } = depurarRelato(salida(), { items, preguntas: ANALISIS.preguntas, transcripcion: RELATO })
    expect(relato.sinMencion).toEqual(['i2'])
  })

  it('preguntas: solo ids existentes y, si hay opciones, una de ellas escrita como la opción', () => {
    const { relato } = depurar(salida({
      respuestasPreguntas: [
        { preguntaId: 'q1', respuesta: 'si de queso' },          // la opción, con otra puntuación
        { preguntaId: 'q2', respuesta: 'Tal vez' },              // no es una opción
        { preguntaId: 'q9', respuesta: 'Sí' },                   // no existe
        { preguntaId: 'q1', respuesta: 'No, son de otra cosa' }, // repetida: vale la primera
      ],
    }))
    expect(relato.respuestasPreguntas).toEqual([{ preguntaId: 'q1', respuesta: 'Sí, de queso' }])
  })

  it('una pregunta sin opciones acepta la respuesta libre', () => {
    const preguntas = [{ id: 'q3', texto: '¿Qué tomó?', opciones: [] }]
    const { relato } = depurarRelato(salida({ respuestasPreguntas: [{ preguntaId: 'q3', respuesta: ' agua ' }] }),
      { items: ANALISIS.items, preguntas, transcripcion: RELATO })
    expect(relato.respuestasPreguntas).toEqual([{ preguntaId: 'q3', respuesta: 'agua' }])
  })

  it('porción solo si corrige la servida; confianza entre 0 y 1', () => {
    const { relato } = depurar(salida({
      respuestas: [
        resp({ itemIdTmp: 'i1', cuanto: 'aparto', porcion: 'mediana', confianza: 1.4, cita: 'El puré ni lo quiso' }),
        resp({ itemIdTmp: 'i3', cuanto: 'mitad', porcion: 'mediana', confianza: -0.2, cita: 'se comió la mitad' }),
      ],
    }))
    expect(relato.respuestas).toEqual([
      { itemIdTmp: 'i1', cuanto: 'aparto', confianza: 1, cita: 'El puré ni lo quiso' },
      { itemIdTmp: 'i3', cuanto: 'mitad', porcion: 'mediana', confianza: 0, cita: 'se comió la mitad' },
    ])
  })

  it('conducta sin repetir y en el orden del vocabulario; comentario en una línea', () => {
    const { relato } = depurar(salida({ conducta: ['atragantamiento', 'tranquilo', 'atragantamiento'], comentario: ' Comió la mitad.\n\nTosió un poco. ' }))
    expect(relato.conducta).toEqual(['tranquilo', 'atragantamiento'])
    expect(relato.comentario).toBe('Comió la mitad. Tosió un poco.')
  })
})

// ---------- interpretarRelato ----------
describe('interpretarRelato', () => {
  it('con texto se saltea la transcripción y le pasa al modelo los ítems, las preguntas y el relato', async () => {
    conLLM(salida())
    const r = await interpretarRelato(pedido({ texto: `  ${RELATO}  `, audioBase64: 'AAAA', mime: 'audio/webm' }))
    expect(mockTranscribir).not.toHaveBeenCalled()
    expect(r.transcripcion).toBe(RELATO)
    expect(r.sinMencion).toEqual(['i2'])
    expect(r.ms).toBeGreaterThanOrEqual(0)

    const opciones = mockJSON.mock.calls[0][0]
    expect(opciones.tarea).toBe('relato')
    const mensaje = opciones.partes.map((p) => (p.tipo === 'texto' ? p.texto : '')).join('')
    expect(mensaje).toContain('i1: puré de papa (porción servida: mediana)')
    expect(mensaje).toContain('q1: ¿Los bastones de la derecha son de queso? [Sí, de queso | No, son de otra cosa]')
    expect(mensaje).toContain(RELATO)
    expect(opciones.sistema).toContain('"lo chupó y lo dejó" → probo')
  })

  it('con audio transcribe con los nombres del plato como pista', async () => {
    mockTranscribir.mockResolvedValue({ texto: ` ${RELATO} `, ms: 700, modelo: 'whisper-large-v3-turbo' })
    conLLM(salida())
    const r = await interpretarRelato(pedido({ audioBase64: 'AAAA', mime: 'audio/mp4' }))
    expect(mockTranscribir).toHaveBeenCalledWith({
      audioBase64: 'AAAA', mime: 'audio/mp4',
      pista: 'puré de papa, milanesa de carne al horno (rebozada sin huevo), bastones de queso horneados',
    })
    expect(r.transcripcion).toBe(RELATO)
    expect(r.respuestas).toHaveLength(2)
  })

  it('sin audio ni texto (o con los dos vacíos) → entrada_invalida, sin llamar al modelo', async () => {
    for (const extra of [{}, { texto: '   ', audioBase64: '' }]) {
      await expect(interpretarRelato(pedido(extra))).rejects.toMatchObject({ codigo: 'entrada_invalida' })
    }
    await expect(interpretarRelato(pedido({ audioBase64: 'AAAA' }))).rejects.toMatchObject({ codigo: 'entrada_invalida' })
    expect(mockTranscribir).not.toHaveBeenCalled()
    expect(mockJSON).not.toHaveBeenCalled()
  })

  it('audio que transcribe vacío → audio_no_entendido, sin llamar al modelo', async () => {
    mockTranscribir.mockResolvedValue({ texto: '  ', ms: 300, modelo: 'whisper-large-v3-turbo' })
    await expect(interpretarRelato(pedido({ audioBase64: 'AAAA', mime: 'audio/webm' }))).rejects.toMatchObject({ codigo: 'audio_no_entendido' })
    mockTranscribir.mockRejectedValue(new ErrorNibble('audio_no_entendido', 'No se entendió.'))
    await expect(interpretarRelato(pedido({ audioBase64: 'AAAA', mime: 'audio/webm' }))).rejects.toMatchObject({ codigo: 'audio_no_entendido' })
    expect(mockJSON).not.toHaveBeenCalled()
  })

  it('plato sin ítems: todo vacío pero con transcripción', async () => {
    conLLM(salida({ respuestas: [resp({ itemIdTmp: 'i1', cuanto: 'todo', cita: 'estuvo tranquilo' })] }))
    const r = await interpretarRelato(pedido({ texto: RELATO, analisis: { ...ANALISIS, items: [], preguntas: [] } }))
    expect(r).toMatchObject({ transcripcion: RELATO, respuestas: [], respuestasPreguntas: [], sinMencion: [], conducta: ['tranquilo'] })
  })
})

// ---------- Handlers ----------
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

describe('api/relato-comida', () => {
  it('400 entrada_invalida con body vacío o sin preguntas, antes de llamar a nada', async () => {
    for (const body of [{}, { ninoId: 'tomas', analisis: { items: [] }, texto: RELATO }]) {
      const r = await llamar(relatoHandler, body)
      expect(r.statusCode).toBe(400)
      expect((r.body as ErrorApi).error.codigo).toBe('entrada_invalida')
    }
    expect(mockJSON).not.toHaveBeenCalled()
  })

  it('400 sin audio ni texto', async () => {
    const r = await llamar(relatoHandler, { ninoId: 'tomas', analisis: ANALISIS })
    expect(r.statusCode).toBe(400)
  })

  it('200 con el RelatoComida y sin header de stub', async () => {
    conLLM(salida())
    const r = await llamar(relatoHandler, pedido({ texto: RELATO }))
    expect(r.statusCode).toBe(200)
    expect(r.headers[HEADER_STUB]).toBeUndefined()
    const relato = r.body as RelatoComida
    expect(relato.respuestas.map((x) => x.itemIdTmp)).toEqual(['i1', 'i3'])
    expect(relato.sinMencion).toEqual(['i2'])
  })

  it('405 con otro método', async () => {
    const r = await llamar(relatoHandler, {}, 'GET')
    expect(r.statusCode).toBe(405)
  })
})

describe('api/transcribir', () => {
  it('400 con body vacío o audio vacío', async () => {
    for (const body of [{}, { audioBase64: '', mime: 'audio/webm' }]) {
      const r = await llamar(transcribirHandler, body)
      expect(r.statusCode).toBe(400)
      expect((r.body as ErrorApi).error.codigo).toBe('entrada_invalida')
    }
    expect(mockTranscribir).not.toHaveBeenCalled()
  })

  it('200 con { texto, ms } y sin header de stub', async () => {
    mockTranscribir.mockResolvedValue({ texto: ' Tomás come papas fritas. ', ms: 640, modelo: 'whisper-large-v3-turbo' })
    const r = await llamar(transcribirHandler, { audioBase64: 'AAAA', mime: 'audio/mp4', pista: 'Tomás' })
    expect(r.statusCode).toBe(200)
    expect(r.headers[HEADER_STUB]).toBeUndefined()
    expect(r.body as TranscribirRes).toEqual({ texto: 'Tomás come papas fritas.', ms: 640 })
    expect(mockTranscribir).toHaveBeenCalledWith({ audioBase64: 'AAAA', mime: 'audio/mp4', pista: 'Tomás' })
  })

  it('422 audio_no_entendido si la transcripción viene vacía', async () => {
    mockTranscribir.mockResolvedValue({ texto: '', ms: 200, modelo: 'whisper-large-v3-turbo' })
    const r = await llamar(transcribirHandler, { audioBase64: 'AAAA', mime: 'audio/webm' })
    expect(r.statusCode).toBe(422)
    expect((r.body as ErrorApi).error.codigo).toBe('audio_no_entendido')
  })
})

describe('pistaTranscripcion', () => {
  it('sin repetir, sin vacíos y cortada por nombre completo', () => {
    expect(pistaTranscripcion([{ preparacion: 'dambo' }, { preparacion: ' dambo ' }, { preparacion: '' }, { preparacion: 'boniato' }])).toBe('dambo, boniato')
    expect(pistaTranscripcion([])).toBeUndefined()
    const largo = Array.from({ length: 60 }, (_, i) => ({ preparacion: `preparación número ${i}` }))
    const pista = pistaTranscripcion(largo)!
    expect(pista.length).toBeLessThanOrEqual(400)
    expect(pista.split(', ').every((n) => largo.some((l) => l.preparacion === n))).toBe(true)
  })
})
