// El grupo de una preparación del catálogo (data/preparaciones.json, ya en el bundle por lib/proximaComida), para pintar
// cada punta de la cadena con el color de su grupo. Si no está en el catálogo, null: el ícono queda en Brote.
import preparaciones from '../../../data/preparaciones.json'
import type { Grupo } from '../../../shared/contratos'

const GRUPO = new Map(
  (preparaciones as { id: string; atributos: { grupo: Grupo } }[]).map((p) => [p.id, p.atributos.grupo]),
)

export const grupoDePreparacion = (id: string): Grupo | null => GRUPO.get(id) ?? null
