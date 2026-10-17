// Cómo se leen los atributos de la cadena en la tarjeta de la receta: "forma=baston" → "bastón".
import type { Alergeno, Nutriente } from '../../../shared/contratos'
import { NOMBRE_ALERGENO, NOMBRE_NUTRIENTE } from '../../lib/vocabulario'

const VALOR: Record<string, string> = {
  baston: 'bastón', pure: 'puré', frio: 'frío', acido: 'ácido', marron: 'marrón',
  horno: 'al horno', plancha: 'a la plancha', listo: 'listo para comer', con_salsa: 'con salsa',
  cereal_almidon: 'cereal o almidón', lacteo: 'lácteo',
}

/** "forma=baston" → "bastón" · "coccion=horno" → "al horno". Si no tiene "=", queda igual. */
export function valorLegible(par: string): string {
  const v = par.includes('=') ? par.slice(par.indexOf('=') + 1) : par
  return VALOR[v] ?? v.replace(/_/g, ' ')
}

/** ["forma=baston", "textura=crocante"] → "bastón, crocante y salado". */
export function listaLegible(pares: string[]): string {
  const xs = pares.map(valorLegible)
  return xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs.at(-1)}`
}

/** Nombre del nutriente para usar en medio de una frase: "calcio", "vitamina D", "omega-3". */
export function nutrienteEnFrase(n: Nutriente): string {
  const s = NOMBRE_NUTRIENTE[n]
  return s.startsWith('Vitamina') ? `v${s.slice(1)}` : s.toLowerCase()
}

export const alergenoEnFrase = (a: Alergeno) => NOMBRE_ALERGENO[a].toLowerCase()

/** "2/2" → "la aceptó 2 de 2 veces". */
export function aceptacionLegible(aceptacion: string): string {
  const m = /^(\d+)\s*\/\s*(\d+)$/.exec(aceptacion)
  return m ? `la aceptó ${m[1]} de ${m[2]} ${m[2] === '1' ? 'vez' : 'veces'}` : aceptacion
}
