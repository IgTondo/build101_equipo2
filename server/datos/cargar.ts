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
  if (!nino) throw new ErrorNibble('no_encontrado', `No encontramos el perfil "${ninoId}".`)
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

export async function cargarNino(ninoId: string): Promise<Cargado> {
  const [nino, comidas] = await Promise.all([leerNino(ninoId), col.comidas().find({ ninoId }).sort({ fechaISO: 1 }).toArray()])
  const catalogo = preparacionesCatalogo()
  const alimentos = await resolverAlimentos(idsDeAlimentos(catalogo, comidas))
  return { nino, comidas, catalogo, alimentos, objetivo: objetivoDe(nino) }
}
