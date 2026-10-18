// v5.8 · Las otras alergias ("kiwi", "colorante rojo") en la pantalla: cuáles no cruzan con ningún alimento del catálogo,
// para avisarle al padre que esas no se pueden revisar ingrediente por ingrediente. El cruce es el mismo que usa el
// servidor (server/alergias.ts, puro). El catálogo (data/alimentos.json) se carga aparte y solo si hace falta.
import { useEffect, useState } from 'react'
import type { Alimento } from '../../shared/contratos'
import { alergiasSinCruce } from '../../server/alergias'

let catalogo: Promise<Alimento[]> | null = null
const cargarCatalogo = () => (catalogo ??= import('../../data/alimentos.json').then((m) => m.default as unknown as Alimento[]))

/** Las otras alergias que no cruzan con ningún alimento; null mientras se carga el catálogo (o si no se pudo). */
export function useSinCruce(otras: readonly string[]): string[] | null {
  const clave = otras.join('\n')
  const [res, setRes] = useState<{ clave: string; sin: string[] } | null>(null)
  useEffect(() => {
    if (!clave) return
    let vivo = true
    cargarCatalogo()
      .then((alimentos) => { if (vivo) setRes({ clave, sin: alergiasSinCruce(clave.split('\n'), alimentos) }) })
      .catch(() => { catalogo = null })
    return () => { vivo = false }
  }, [clave])
  if (!clave) return []
  return res?.clave === clave ? res.sin : null
}
