import { afterEach, describe, expect, it, vi } from 'vitest'
import { cargarNino, leerNino } from './cargar.js'
import { col } from './mongo.js'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe('cargarNino sin base', () => {
  it('rechaza una sola vez y no deja promesas rechazadas sin atrapar (que tirarían abajo la API local)', async () => {
    vi.stubEnv('MONGODB_URI', '')
    const sueltas: unknown[] = []
    const alRechazo = (e: unknown) => sueltas.push(e)
    process.on('unhandledRejection', alRechazo)
    try {
      await expect(cargarNino('sint-tomas')).rejects.toThrow('Falta MONGODB_URI')
      await new Promise((r) => setTimeout(r, 20))
      expect(sueltas).toEqual([])
    } finally {
      process.off('unhandledRejection', alRechazo)
    }
  })
})

describe('leerNino', () => {
  it('el 404 no repite el id del chico', async () => {
    vi.spyOn(col, 'ninos').mockReturnValue({ findOne: async () => null } as unknown as ReturnType<typeof col.ninos>)
    const error = await leerNino('sint-tomas-1234').catch((e: unknown) => e)
    expect(error).toMatchObject({ codigo: 'no_encontrado', message: 'No encontramos ese perfil.' })
    expect((error as Error).message).not.toContain('sint-tomas')
  })
})
