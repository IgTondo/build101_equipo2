// Guardas de C1: el límite de funciones de Vercel Hobby y que cada stub responda su fixture.
// Cuando un dueño reemplaza un stub, su caso de acá se saltea solo (ya no manda x-nibble-stub y no da 5xx).
import { existsSync, readdirSync } from 'node:fs'
import { basename, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { describe, expect, it } from 'vitest'
import type { ErrorApi } from '../shared/contratos.js'
import { HEADER_STUB, type Handler } from '../server/http.js'

const DIR_API = join(process.cwd(), 'api')
const ENDPOINTS = readdirSync(DIR_API).filter((f) => f.endsWith('.ts')).map((f) => basename(f, '.ts'))

const METODO: Record<string, string> = {
  nutricion: 'GET', progreso: 'GET', salud: 'GET', resumen: 'GET', perfil: 'GET',
}

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

async function llamar(nombre: string, method: string) {
  const { default: handler } = (await import(pathToFileURL(join(DIR_API, `${nombre}.ts`)).href)) as { default: Handler }
  const { r, res } = resFalsa()
  await handler({ method, query: { ninoId: 'tomas' }, body: {} } as unknown as VercelRequest, res)
  return r
}

describe('api/', () => {
  it('tiene exactamente 12 funciones (límite de Vercel Hobby)', () => {
    expect(ENDPOINTS).toHaveLength(12)
  })

  for (const nombre of ENDPOINTS) {
    it(`${nombre}: el stub devuelve su fixture y rechaza otros métodos`, async ({ skip }) => {
      const metodo = METODO[nombre] ?? 'POST'
      const r = await llamar(nombre, metodo)
      // Sin header y sin 5xx = ya es real (un handler real responde 400 al body vacío): no es asunto de este test.
      if (r.headers[HEADER_STUB] !== '1' && r.statusCode < 500) skip()
      expect(r.statusCode).toBe(200)
      expect(r.body).toBeTypeOf('object')

      const mal = await llamar(nombre, 'DELETE')
      expect(mal.statusCode).toBe(405)
      expect((mal.body as ErrorApi).error.codigo).toBe('metodo_no_permitido')
    })
  }

  it('cada stub tiene su fixture', () => {
    const fixtures = ENDPOINTS.flatMap((n) => (n === 'perfil' ? ['perfil', 'perfil-crear'] : [n]))
    for (const f of fixtures) expect(existsSync(join(process.cwd(), 'fixtures', `${f}.json`)), f).toBe(true)
  })
})
