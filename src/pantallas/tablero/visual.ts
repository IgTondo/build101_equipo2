// Ayudas de presentación del tablero (no cambian datos): el grupo de una preparación, para pintar su IconoAlimento con
// el color de su grupo. El contrato no siempre lo trae, así que se busca en el catálogo (por id o, si no, por nombre).
import preparaciones from '../../../data/preparaciones.json'
import { GRUPO, type Grupo, type Perfil } from '../../../shared/contratos'
import { normalizar } from '../../lib/alimentos'

const CATALOGO = preparaciones as { id: string; nombre: string; atributos: { grupo: Grupo } }[]
const POR_ID = new Map(CATALOGO.map((p) => [p.id, p.atributos.grupo]))
const POR_NOMBRE = new Map(CATALOGO.map((p) => [normalizar(p.nombre), p.atributos.grupo]))

export function grupoDe(preparacionId?: string | null, nombre?: string): Grupo | undefined {
  return (preparacionId ? POR_ID.get(preparacionId) : undefined) ?? (nombre ? POR_NOMBRE.get(normalizar(nombre)) : undefined)
}

export interface Comestible { id: string; nombre: string; grupo?: Grupo }

/** Lo que acepta, ordenado por grupo (el orden de GRUPO) y, dentro de cada grupo, de lo que más le gusta a lo que menos. */
export function loQueCome(lista: Perfil['preparaciones']): Comestible[] {
  const lugar = (g?: Grupo) => (g ? GRUPO.indexOf(g) : GRUPO.length)
  return lista
    .filter((p) => p.estado === 'acepta')
    .map((p) => ({ id: p.id, nombre: p.nombre, grupo: grupoDe(p.id, p.nombre), puntaje: p.puntaje }))
    .sort((a, b) => lugar(a.grupo) - lugar(b.grupo) || b.puntaje - a.puntaje)
    .map(({ id, nombre, grupo }) => ({ id, nombre, grupo }))
}

/** El reveal de los datos (anillo, barras, gráfico): sale rápido y se asienta despacio. */
export const EASE_DATOS = [0.22, 1, 0.36, 1] as const
