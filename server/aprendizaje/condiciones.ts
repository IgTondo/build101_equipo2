// Condiciones de las observaciones y de los patrones (PLAN.md §8): los 8 atributos y el contexto de la comida.
import type { Atributos, Cuanto, Distribucion, Momento, Motivo, Plato } from '../../shared/contratos.js'

export const TIPOS_ATRIBUTO = ['textura', 'forma', 'color', 'sabor', 'temperatura', 'presentacion', 'grupo', 'coccion'] as const
export const TIPOS_CONTEXTO = ['distribucion', 'plato', 'momento', 'juntoASeguro'] as const
export type TipoAtributo = (typeof TIPOS_ATRIBUTO)[number]
export type TipoContexto = (typeof TIPOS_CONTEXTO)[number]
export type TipoCondicion = TipoAtributo | TipoContexto

export interface Condicion {
  tipo: TipoCondicion
  valor: string
}

/** `juntoASeguro`: en el mismo plato había una preparación que ya acepta (estado antes de esta comida). */
export interface Contexto {
  distribucion: Distribucion
  plato: Plato
  momento: Momento
  juntoASeguro: boolean
}

/** Una observación = un ítem de una comida. Se aprende por ítem, nunca por plato (§5.1). */
export interface Observacion {
  comidaId: string
  prepId: string
  nombre: string
  atributos: Partial<Atributos>
  contexto: Contexto
  o: number
  cuanto: Cuanto
  motivo?: Motivo
  fechaISO: string
  dia: string
}

export const claveCondicion = (c: Condicion): string => `${c.tipo}=${c.valor}`

export const esAtributo = (tipo: string): tipo is TipoAtributo => (TIPOS_ATRIBUTO as readonly string[]).includes(tipo)

/** Las condiciones de una observación: sus atributos (8, con la cocción) y, si hay, su contexto. */
export function condicionesDe(atributos: Partial<Atributos>, contexto?: Contexto): Condicion[] {
  const condiciones: Condicion[] = []
  for (const tipo of TIPOS_ATRIBUTO) {
    const valor = atributos[tipo]
    if (valor) condiciones.push({ tipo, valor })
  }
  if (contexto) for (const tipo of TIPOS_CONTEXTO) condiciones.push({ tipo, valor: String(contexto[tipo]) })
  return condiciones
}

/** ¿Se cumplen todas? Una condición de contexto sin contexto no se cumple. */
export function cumple(
  condiciones: readonly Condicion[],
  atributos: Partial<Atributos>,
  contexto?: Partial<Contexto>,
): boolean {
  return condiciones.every(({ tipo, valor }) => {
    if (esAtributo(tipo)) return atributos[tipo] === valor
    const v = contexto?.[tipo]
    return v !== undefined && String(v) === valor
  })
}
