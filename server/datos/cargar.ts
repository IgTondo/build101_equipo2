// Todo lo que hace falta para calcular algo de un chico: su perfil, sus comidas (el bronze), los catálogos y su objetivo.
import type { Alimento, Nutrientes, PreparacionCatalogo } from '../../shared/contratos.js'
import { ErrorNibble } from '../http.js'
import { objetivosPara } from '../nutricion/objetivos.js'
import { preparacionesCatalogo, resolverAlimentos } from './catalogos.js'
import { col } from './mongo.js'
import type { ComidaDoc, NinoDoc } from './tipos.js'

export interface Cargado {
  nino: NinoDoc
  comidas: ComidaDoc[]
  catalogo: ReadonlyMap<string, PreparacionCatalogo>
  alimentos: ReadonlyMap<string, Alimento>
  objetivo: Nutrientes
}

export async function leerNino(ninoId: string): Promise<NinoDoc> {
  const nino = await col.ninos().findOne({ _id: ninoId })
  // Sin el id en el mensaje: lo ve el padre (y no hace falta repetir lo que mandó)
  if (!nino) throw new ErrorNibble('no_encontrado', 'No encontramos ese perfil.')
  return nino
}

export const objetivoDe = (nino: Pick<NinoDoc, 'datos' | 'objetivosNutricionista'>): Nutrientes =>
  objetivosPara(nino.datos.edad, nino.datos.sexo, nino.objetivosNutricionista)

/** Los ids de alimentos que hacen falta: los del catálogo de preparaciones y los de las comidas del chico. */
export function idsDeAlimentos(catalogo: ReadonlyMap<string, PreparacionCatalogo>, comidas: readonly ComidaDoc[]): Set<string> {
  const ids = new Set<string>()
  for (const p of catalogo.values()) for (const i of p.ingredientes) ids.add(i.alimentoId)
  for (const c of comidas) for (const it of c.items) for (const i of it.ingredientes) ids.add(i.alimentoId)
  return ids
}

/** Async a propósito: si col.comidas() tira (sin MONGODB_URI), queda como promesa rechazada y no como excepción. */
async function leerComidas(ninoId: string): Promise<ComidaDoc[]> {
  return col.comidas().find({ ninoId }).sort({ fechaISO: 1 }).toArray()
}

export async function cargarNino(ninoId: string): Promise<Cargado> {
  // Las dos lecturas son promesas antes del Promise.all: si una tirara sincrónico, la otra quedaría rechazada sin
  // atrapar y Node mataría la API local
  const [nino, comidas] = await Promise.all([leerNino(ninoId), leerComidas(ninoId)])
  const catalogo = preparacionesCatalogo()
  const alimentos = await resolverAlimentos(idsDeAlimentos(catalogo, comidas))
  return { nino, comidas, catalogo, alimentos, objetivo: objetivoDe(nino) }
}
