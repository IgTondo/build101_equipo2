// C8: los hechos del resumen (numeros.ts), el número-chequeo y el respaldo por plantilla (texto.ts). Sin red.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ErrorApi, Perfil, Progreso, ResumenRes } from '../shared/contratos.js'
import type { Handler } from '../server/http.js'
import { armarHechos, hechosResumen, lineasHechos } from '../server/resumen/numeros.js'
import {
  ACLARACION, numerosDe, numerosQueNoEstan, pulir, redactarResumen, redactorClaude, textoPlantilla,
} from '../server/resumen/texto.js'

const leer = <T>(nombre: string): T => JSON.parse(readFileSync(join(process.cwd(), 'fixtures', `${nombre}.json`), 'utf8')) as T
const PROGRESO = leer<Progreso>('progreso')
const PERFIL = leer<Perfil>('perfil')

describe('numeros.ts: armarHechos', () => {
  const h = armarHechos(PROGRESO, PERFIL)

  it('toma el nombre, la edad y el período de la semana', () => {
    expect(h.nombre).toBe('Tomás')
    expect(h.edad).toBe(6)
    expect(h.periodo).toEqual({ desde: '2026-10-10', hasta: '2026-10-16', dias: 7, comidas: 21 })
  })

  it('repertorio y tendencia', () => {
    expect(h.repertorio).toEqual({ aceptadas: 6, enProceso: 13, tendencia: 2 })
  })

  it('marca como ausente un grupo con 7 días o más sin comer, y deja afuera "otro"', () => {
    expect(h.grupos.map((g) => g.grupo)).not.toContain('otro')
    expect(h.grupos.filter((g) => g.ausente).map((g) => g.grupo)).toEqual(['verdura'])
  })

  it('nutrientes por debajo de la referencia, en el orden de semana.faltan y en %', () => {
    expect(h.nutrientesBajos.map((n) => [n.nutriente, n.porcentaje])).toEqual([
      ['calcio_mg', 40], ['vitamina_d_ug', 9], ['fibra_g', 22], ['omega3_g', 19],
    ])
    expect(h.nutrientesCubiertos.map((n) => n.nutriente)).toEqual(['proteina_g', 'hierro_mg', 'b12_ug', 'vitamina_c_mg'])
    expect(h.nutrientesCubiertos.find((n) => n.nutriente === 'b12_ug')?.porcentaje).toBe(201)
  })

  it('energía como dato y exposiciones con su mejor escalón', () => {
    expect(h.energiaPromedioKcal).toBe(762)
    expect(h.exposiciones.total).toBe(11)
    expect(h.exposiciones.lista[0]).toEqual({ nombre: 'Bastones de queso horneados', veces: 5, mejorPaso: 'mitad', escalon: 'comió la mitad' })
    expect(h.exposiciones.lista.length).toBeLessThanOrEqual(6)
  })

  it('cuenta la conducta en la mesa desde dias[].comidas[].conducta', () => {
    expect(h.conducta.comidas).toBe(21)
    expect(h.conducta.conteo).toMatchObject({ tranquilo: 18, se_levanto: 2, pidio_otra_cosa: 2, angustia: 0, arcadas: 0, atragantamiento: 0 })
  })

  it('usa solo los últimos 7 días si el progreso trae más', () => {
    const viejo = { ...PROGRESO.dias[0], dia: '2026-10-01', comidas: [{ id: 'x', fechaISO: '2026-10-01T12:00:00-03:00', momento: 'almuerzo' as const, items: [], conducta: ['arcadas' as const] }] }
    const h2 = armarHechos({ ...PROGRESO, dias: [viejo, ...PROGRESO.dias] }, PERFIL)
    expect(h2.periodo.desde).toBe('2026-10-10')
    expect(h2.conducta.conteo.arcadas).toBe(0)
  })

  it('sin perfil, se arma igual', () => {
    const h2 = armarHechos(PROGRESO, null)
    expect(h2.edad).toBeNull()
    expect(h2.alergias).toEqual([])
  })

  it('alertas como texto', () => {
    expect(h.alertas).toEqual([PROGRESO.alertas[0].texto])
  })
})

describe('numeros.ts: lineasHechos', () => {
  const lineas = lineasHechos(armarHechos(PROGRESO, PERFIL))
  const todo = lineas.join('\n')

  it('trae cada bloque con sus números', () => {
    expect(todo).toContain('acepta 6 preparaciones (+2 respecto de la semana anterior) y tiene 13 en proceso')
    expect(todo).toContain('verduras (hace 10 días)')
    expect(todo).toContain('calcio 40%, vitamina D 9%, fibra 22%, omega-3 19%')
    expect(todo).toContain('762 kcal')
    expect(todo).toContain('Bastones de queso horneados (5 ofrecimientos, mejor escalón: comió la mitad)')
    expect(todo).toContain('tranquilo en 18')
    expect(todo).toContain('del 10/10 al 16/10')
    expect(todo).toContain('Alergias declaradas: huevo')
  })

  it('es texto plano, una línea por hecho', () => {
    for (const l of lineas) expect(l).not.toContain('\n')
  })
})

describe('texto.ts: número-chequeo', () => {
  const { lineas } = hechosResumen(PROGRESO, PERFIL)

  it('normaliza los números', () => {
    expect(numerosDe('calcio 40%, 0,5 g, omega-3 y B12; 1.5 y 07')).toEqual(['40', '0.5', '3', '12', '1.5', '7'])
  })

  it('acepta un texto que usa solo números de los hechos', () => {
    const texto = 'Tomás (6 años) acepta 6 preparaciones (+2) y le falta calcio (40%) y vitamina D (9%). Verduras: hace 10 días. 762 kcal. Omega-3 19%, B12 201%.'
    expect(numerosQueNoEstan(texto, lineas)).toEqual([])
  })

  it('detecta un número calculado o inventado', () => {
    expect(numerosQueNoEstan('Cubre 4 de 8 nutrientes y le falta un 60% de calcio.', lineas)).toEqual(expect.arrayContaining(['4', '8', '60']))
  })

  it('la plantilla siempre pasa su propio chequeo y termina con la aclaración', () => {
    const h = armarHechos(PROGRESO, PERFIL)
    const t = textoPlantilla(h)
    expect(numerosQueNoEstan(t, lineasHechos(h))).toEqual([])
    expect(t.trimEnd().endsWith(ACLARACION)).toBe(true)
    const sinPerfil = armarHechos(PROGRESO, null)
    expect(numerosQueNoEstan(textoPlantilla(sinPerfil), lineasHechos(sinPerfil))).toEqual([])
  })

  it('la plantilla con una sola comida en un día: singular, sin "del 17/10 al 17/10" ni "0 respecto"', () => {
    const h = armarHechos(PROGRESO, PERFIL)
    const uno = { ...h, periodo: { ...h.periodo, desde: '2026-10-17', hasta: '2026-10-17', comidas: 1 }, conducta: { ...h.conducta, comidas: 1 },
      repertorio: { aceptadas: 1, enProceso: 0, tendencia: 0 } }
    const t = textoPlantilla(uno)
    expect(t).toContain('del 17/10, armado con 1 comida registrada por la familia')
    expect(t).toContain('acepta 1 preparación (igual que la semana anterior)')
    expect(t).toContain('de 1 comida;')
    expect(numerosQueNoEstan(t, lineasHechos(uno))).toEqual([])
  })

  it('sin comidas en la semana: no inventa período ni cobertura, y no llama al modelo', async () => {
    const vacio: Progreso = {
      ...PROGRESO, dias: [], exposiciones: [], alertas: [],
      semana: { cobertura: Object.fromEntries(Object.keys(PROGRESO.semana.cobertura).map((k) => [k, 0])) as Progreso['semana']['cobertura'], faltan: [], energiaPromedioKcal: 0 },
      grupos: PROGRESO.grupos.map((g) => ({ ...g, diasSinComer: null })),
    }
    const { hechos, lineas } = hechosResumen(vacio, PERFIL)
    const t = textoPlantilla(hechos)
    expect(t).toContain('no registró comidas en los últimos 7 días')
    expect(t).not.toMatch(/0\/0|Ninguno por debajo|0 kcal/)
    expect(numerosQueNoEstan(t, lineas)).toEqual([])
    const redactor = vi.fn(async () => 'no debería llamarse')
    const r = await redactarResumen(hechos, lineas, redactor)
    expect(redactor).not.toHaveBeenCalled()
    expect(r).toMatchObject({ fuente: 'plantilla', motivo: 'sin_comidas' })
  })

  it('pulir saca el markdown y deja la aclaración una sola vez, al final', () => {
    const t = pulir(`**Repertorio:** acepta 6.\n${ACLARACION}\nAlgo más.`)
    expect(t).not.toContain('**')
    expect(t.endsWith(`\n\n${ACLARACION}`)).toBe(true)
    expect(t.split(ACLARACION)).toHaveLength(2)
  })
})

describe('texto.ts: redactarResumen y sus respaldos', () => {
  const { hechos, lineas } = hechosResumen(PROGRESO, PERFIL)
  beforeEach(() => { vi.spyOn(console, 'warn').mockImplementation(() => {}); vi.spyOn(console, 'info').mockImplementation(() => {}) })
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs() })

  it('sin ANTHROPIC_API_KEY no hay redactor y sale la plantilla', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '')
    expect(redactorClaude()).toBeNull()
    const r = await redactarResumen(hechos, lineas, null)
    expect(r).toMatchObject({ fuente: 'plantilla', motivo: 'sin_api_key', texto: textoPlantilla(hechos) })
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('"fuente":"plantilla"'))
  })

  it('usa el texto del LLM si sus números están en los hechos, y le asegura la aclaración', async () => {
    const r = await redactarResumen(hechos, lineas, async () => 'Repertorio: Tomás acepta 6 preparaciones (+2) y tiene 13 en proceso.')
    expect(r.fuente).toBe('llm')
    expect(r.texto).toBe(`Repertorio: Tomás acepta 6 preparaciones (+2) y tiene 13 en proceso.\n\n${ACLARACION}`)
  })

  it('le pasa al LLM solo las líneas de los hechos y el system prompt con las reglas', async () => {
    let recibido = { sistema: '', usuario: '' }
    await redactarResumen(hechos, lineas, async (sistema, usuario) => { recibido = { sistema, usuario }; return 'ok' })
    expect(recibido.sistema).toContain('Usá solo los números')
    expect(recibido.sistema).toContain('No sugieras suplementos')
    expect(recibido.sistema).toContain(ACLARACION)
    for (const l of lineas) expect(recibido.usuario).toContain(l)
  })

  it('si el LLM inventa un número, vuelve a la plantilla', async () => {
    const r = await redactarResumen(hechos, lineas, async () => 'Cubrió 4 de 8 nutrientes.')
    expect(r).toMatchObject({ fuente: 'plantilla', motivo: 'numeros_fuera_de_los_hechos' })
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('"inventados":["4","8"]'))
  })

  it('si el proveedor falla, vuelve a la plantilla', async () => {
    const r = await redactarResumen(hechos, lineas, async () => { throw new Error('529 overloaded') })
    expect(r).toMatchObject({ fuente: 'plantilla', motivo: 'error_proveedor' })
  })
})

describe('api/resumen', () => {
  async function llamar(query: Record<string, string>, method = 'GET') {
    const { default: handler } = (await import(pathToFileURL(join(process.cwd(), 'api', 'resumen.ts')).href)) as { default: Handler }
    const r = { statusCode: 0, headers: {} as Record<string, string>, body: undefined as unknown }
    const res = {
      status(c: number) { r.statusCode = c; return res },
      json(b: unknown) { r.body = b; return res },
      setHeader(k: string, v: string) { r.headers[k.toLowerCase()] = v; return res },
      headersSent: false,
    }
    await handler({ method, query } as unknown as VercelRequest, res as unknown as VercelResponse)
    return r
  }
  beforeEach(() => { vi.stubEnv('ANTHROPIC_API_KEY', ''); vi.spyOn(console, 'warn').mockImplementation(() => {}) })
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs() })

  it('sin ninoId responde 400 entrada_invalida', async () => {
    const r = await llamar({})
    expect(r.statusCode).toBe(400)
    expect((r.body as ErrorApi).error.codigo).toBe('entrada_invalida')
  })

  it('con ninoId y sin key responde 200 con la plantilla, marcado como datos de ejemplo', async () => {
    const r = await llamar({ ninoId: 'tomas' })
    expect(r.statusCode).toBe(200)
    expect(r.headers['x-nibble-stub']).toBe('1')
    expect(r.headers['x-nibble-resumen-fuente']).toBe('plantilla')
    const body = r.body as ResumenRes
    expect(body.texto.endsWith(ACLARACION)).toBe(true)
    expect(body.progreso.aceptadas).toBe(6)
    expect(Number.isNaN(Date.parse(body.generadoISO))).toBe(false)
  })
})
