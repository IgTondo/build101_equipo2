// Cómo se le muestra al padre la cobertura de un nutriente: tres estados en vez de porcentajes crudos.
// Un "158% de proteína" es correcto (un chico de 6 años necesita ~19 g por día y una milanesa trae más de 25 g),
// pero no se entiende. Hacia el padre: Cubierto ✓ (desde el 100%), Casi (del 70 al 99%) o Le falta (menos del 70%).
// Las barras se cortan en el 100% y ningún número pasa de 100%. Funciones puras, testeadas en cobertura.test.ts.
import type { Nutriente, Nutrientes } from '../../shared/contratos'
import { NUTRIENTES_CON_META } from './vocabulario'

/**
 * Los umbrales, en un solo lugar. `casi` (70%) es el mismo de la regla "qué le falta" de PLAN §1: por debajo,
 * el nutriente está en `semana.faltan`.
 */
export const UMBRAL = { cubierto: 1, casi: 0.7 } as const

export type EstadoCobertura = 'cubierto' | 'casi' | 'falta'

/** El orden en que se cuentan y se explican: de lo mejor a lo que más falta. */
export const ESTADOS: readonly EstadoCobertura[] = ['cubierto', 'casi', 'falta']

export const ETIQUETA_ESTADO: Record<EstadoCobertura, string> = { cubierto: 'Cubierto', casi: 'Casi', falta: 'Le falta' }

const valido = (c: number) => (Number.isFinite(c) ? Math.max(0, c) : 0)

export function estadoCobertura(cobertura: number): EstadoCobertura {
  const c = valido(cobertura)
  if (c >= UMBRAL.cubierto) return 'cubierto'
  if (c >= UMBRAL.casi) return 'casi'
  return 'falta'
}

/** Cuánto de la barra se llena (0 a 1): la barra llena es lo recomendado; lo que pasa del 100% no se dibuja. */
export function fraccionBarra(cobertura: number): number {
  return Math.min(valido(cobertura), 1)
}

/** "40%" · "100%" (nunca más: 1,58 → "100%"). Solo para el detalle; en las listas va el estado. */
export function porcentajeTope(cobertura: number): string {
  return `${Math.min(Math.round(valido(cobertura) * 100), 100)}%`
}

/** "2 cubiertos · 1 casi · 1 le falta": la cuenta en una línea, sin porcentajes. */
export function resumenEstados(c: Record<EstadoCobertura, number>): string {
  return [
    `${c.cubierto} ${c.cubierto === 1 ? 'cubierto' : 'cubiertos'}`,
    `${c.casi} casi`,
    `${c.falta} ${c.falta === 1 ? 'le falta' : 'le faltan'}`,
  ].join(' · ')
}

/** Cuántos nutrientes con meta hay en cada estado. */
export function contarEstados(cobertura: Partial<Nutrientes>, nutrientes: readonly Nutriente[] = NUTRIENTES_CON_META): Record<EstadoCobertura, number> {
  const r: Record<EstadoCobertura, number> = { cubierto: 0, casi: 0, falta: 0 }
  for (const n of nutrientes) r[estadoCobertura(cobertura[n] ?? 0)]++
  return r
}
