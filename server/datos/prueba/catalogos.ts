// Ayudas para los tests de la pista B: el fixture de nutrientes, el catálogo de preparaciones y el dataset
// sintético de Tomás, Lucía y Valentina (PLAN.md §10.5) ya resueltos como documentos de Mongo.
import type { Alimento, DatosBasicos, PerfilBorrador, PreparacionCatalogo, RegistrarComidaReq } from '../../../shared/contratos.js'
import type { Condicion } from '../../aprendizaje/condiciones.js'
import { leerJSON } from '../archivos.js'
import { resolverComida } from '../resolver.js'
import type { ComidaDoc, NinoDoc } from '../tipos.js'

export interface ReglaOculta {
  id: string
  texto: string
  condiciones: Condicion[]
  resultado: 'acepta' | 'rechaza'
  declarada: boolean
}

export interface Sintetico {
  ninoId: string
  datos: DatosBasicos
  borrador: PerfilBorrador
  reglasOcultas: ReglaOculta[] // la verdad de base: solo para tests y evals
  comidas: RegistrarComidaReq[]
}

function exigir<T>(valor: T | null, ruta: string): T {
  if (valor === null) throw new Error(`Falta ${ruta}`)
  return valor
}

export function alimentosPrueba(): Map<string, Alimento> {
  const { alimentos } = exigir(leerJSON<{ alimentos: Alimento[] }>('server/datos/prueba/alimentos-prueba.json'), 'el fixture de alimentos')
  return new Map(alimentos.map((a) => [a.id, a]))
}

export function catalogoPrueba(): Map<string, PreparacionCatalogo> {
  const preparaciones = exigir(leerJSON<PreparacionCatalogo[]>('data/preparaciones.json'), 'data/preparaciones.json')
  return new Map(preparaciones.map((p) => [p.id, p]))
}

export type SinteticoId = 'tomas' | 'lucia' | 'valentina'

export function sintetico(id: SinteticoId): Sintetico {
  return exigir(leerJSON<Sintetico>(`data/sinteticos/${id}.json`), `data/sinteticos/${id}.json`)
}

export function ninoDoc(s: Sintetico, creadoISO = '2026-10-07T08:00:00-03:00'): NinoDoc {
  return { _id: s.ninoId, datos: s.datos, borrador: s.borrador, reglas: s.borrador.reglas, creadoISO, actualizadoISO: creadoISO }
}

export function comidasSinteticas(s: Sintetico, alimentos = alimentosPrueba(), catalogo = catalogoPrueba()): ComidaDoc[] {
  return s.comidas.map((req, i) =>
    resolverComida(req, { id: `${s.ninoId}-${String(i + 1).padStart(2, '0')}`, creadoISO: req.fechaISO, alimentos, catalogo }),
  )
}
