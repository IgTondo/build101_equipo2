// Utilidades HTTP para los handlers de api/ (C1). Las usan todas las pistas:
// - manejar(): envuelve el handler y convierte cualquier excepción en un ErrorApi (§5, contratos).
// - permitir(): responde 405 si el método no es el esperado.
// - enviarError(): el único lugar donde se arma un ErrorApi.
// - responderStub(): devuelve fixtures/<nombre>.json con el header x-nibble-stub: 1.
// Al reemplazar un stub por la implementación real, se deja de llamar a responderStub() y el header desaparece solo.
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { CodigoError, ErrorApi } from '../shared/contratos.js'

export type Handler = (req: VercelRequest, res: VercelResponse) => unknown | Promise<unknown>

export const HEADER_STUB = 'x-nibble-stub'

const STATUS: Record<CodigoError, number> = {
  entrada_invalida: 400,
  metodo_no_permitido: 405,
  no_encontrado: 404,
  muy_grande: 413,
  sin_comida: 422,
  audio_no_entendido: 422,
  sin_candidatos: 422,
  limite_proveedor: 429,
  timeout: 504,
  proveedor_caido: 502,
  interno: 500,
}

const REINTENTABLE: CodigoError[] = ['limite_proveedor', 'timeout', 'proveedor_caido', 'interno']

/** Error que un handler puede tirar desde cualquier capa (server/ia, server/grafo…) para cortar con un ErrorApi. */
export class ErrorNibble extends Error {
  constructor(
    readonly codigo: CodigoError,
    mensaje: string,
    readonly detalle?: unknown,
  ) {
    super(mensaje)
  }
}

export function enviarError(
  res: VercelResponse,
  codigo: CodigoError,
  mensaje: string,
  detalle?: unknown,
): void {
  const cuerpo: ErrorApi = {
    error: { codigo, mensaje, reintentable: REINTENTABLE.includes(codigo), ...(detalle === undefined ? {} : { detalle }) },
  }
  res.status(STATUS[codigo]).json(cuerpo)
}

export function permitir(req: VercelRequest, res: VercelResponse, ...metodos: string[]): boolean {
  if (req.method && metodos.includes(req.method)) return true
  res.setHeader('Allow', metodos.join(', '))
  enviarError(res, 'metodo_no_permitido', `Este endpoint acepta ${metodos.join(' o ')}.`)
  return false
}

export function manejar(handler: Handler): Handler {
  return async (req, res) => {
    try {
      await handler(req, res)
    } catch (e) {
      if (res.headersSent) return
      if (e instanceof ErrorNibble) return enviarError(res, e.codigo, e.message, e.detalle)
      // Zod (v4) tira ZodError con .issues: lo tratamos como entrada inválida sin depender del import.
      if (e instanceof Error && e.name === 'ZodError') {
        return enviarError(res, 'entrada_invalida', 'Faltan datos o no tienen el formato esperado.', (e as { issues?: unknown }).issues)
      }
      console.error(e)
      enviarError(res, 'interno', 'Algo falló de nuestro lado. ¿Probás de nuevo?', e instanceof Error ? e.message : String(e))
    }
  }
}

/** Primer valor de un parámetro de la query (Vercel y Express pueden dar string o string[]). */
export function param(req: VercelRequest, nombre: string): string | undefined {
  const v = req.query[nombre]
  return Array.isArray(v) ? v[0] : v
}

export async function responderStub(res: VercelResponse, nombre: string): Promise<void> {
  const ruta = join(process.cwd(), 'fixtures', `${nombre}.json`) // en Vercel, vercel.json → includeFiles
  const json: unknown = JSON.parse(await readFile(ruta, 'utf8'))
  res.setHeader(HEADER_STUB, '1')
  res.status(200).json(json)
}
