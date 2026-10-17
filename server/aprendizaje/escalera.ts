// La escalera de exposición de PLAN.md §5.1: una sola tabla para la nutrición, el aprendizaje y los textos.
// Cada escalón cuenta como avance (enfoque SOS): tolerarlo en el plato → tocarlo → probarlo → comerlo.
import type { Cuanto, Porcion } from '../../shared/contratos.js'

/** Fracción comida: la usa la nutrición. */
export const FRACCION: Record<Cuanto, number> = { todo: 1, mitad: 0.5, poco: 0.25, probo: 0.05, toco: 0, nada: 0, aparto: 0 }

/** `o`: el resultado que usa el aprendizaje (aceptación). */
export const O: Record<Cuanto, number> = { todo: 1, mitad: 0.7, poco: 0.4, probo: 0.3, toco: 0.15, nada: 0.05, aparto: 0 }

export type Escalon = 'comio' | 'probo' | 'toco' | 'tolero' | 'rechazo'
export const ESCALON: Record<Cuanto, Escalon> = {
  todo: 'comio', mitad: 'comio', poco: 'comio', probo: 'probo', toco: 'toco', nada: 'tolero', aparto: 'rechazo',
}

/** Cómo se cuenta en "qué aprendí" y en los porqué. */
export const DICHO: Record<Cuanto, string> = {
  todo: 'comió todo', mitad: 'comió la mitad', poco: 'comió un poco', probo: 'lo probó',
  toco: 'lo tocó', nada: 'lo dejó en el plato', aparto: 'lo apartó',
}

/** Lo mismo en pasado, para "esta vez lo tocó (antes lo dejaba en el plato)". */
export const DICHO_ANTES: Record<Cuanto, string> = {
  todo: 'comía todo', mitad: 'comía la mitad', poco: 'comía un poco', probo: 'lo probaba',
  toco: 'lo tocaba', nada: 'lo dejaba en el plato', aparto: 'lo apartaba',
}

/** De peor a mejor: sirve para el mejor paso alcanzado en cada exposición. */
export const ORDEN_ESCALERA: readonly Cuanto[] = ['aparto', 'nada', 'toco', 'probo', 'poco', 'mitad', 'todo']

export const mejorPaso = (a: Cuanto | null, b: Cuanto): Cuanto =>
  a === null || ORDEN_ESCALERA.indexOf(b) > ORDEN_ESCALERA.indexOf(a) ? b : a

/** "Lo comió" a efectos de grupos y de los "x de n" de los textos: todo, la mitad o un poco. */
export const comio = (c: Cuanto): boolean => ESCALON[c] === 'comio'

/** "No lo comió" en los patrones de rechazo: lo tocó, lo dejó o lo apartó. */
export const noComio = (c: Cuanto): boolean => FRACCION[c] === 0

/** Porción: chica ×0,6 · mediana ×1 · grande ×1,5 (§5.1). */
export const FACTOR_PORCION: Record<Porcion, number> = { chica: 0.6, mediana: 1, grande: 1.5 }
