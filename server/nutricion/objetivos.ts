// Objetivos diarios por edad y sexo (PLAN.md §10.1), desde data/objetivos.json.
import type { DatosBasicos, Nutriente, Nutrientes } from '../../shared/contratos.js'
import { NUTRIENTE } from '../../shared/contratos.js'
import { leerJSON } from '../datos/archivos.js'

export interface TablaObjetivos {
  fuentes: Partial<Record<Nutriente, string>>
  rangos: { desde: number; hasta: number; sexo: DatosBasicos['sexo'] | null; objetivo: Partial<Nutrientes> }[]
}

/** Los 8 nutrientes con meta. La energía se muestra como dato, sin meta: no se le cuentan calorías al chico (§1). */
export const CON_META: readonly Nutriente[] = NUTRIENTE.filter((n) => n !== 'energia_kcal')

export function tablaObjetivos(): TablaObjetivos {
  const tabla = leerJSON<TablaObjetivos>('data/objetivos.json')
  if (!tabla) throw new Error('Falta data/objetivos.json')
  return tabla
}

/** Objetivo diario para la edad y el sexo (energía = 0). Si el nutricionista dejó indicaciones, reemplazan la tabla. */
export function objetivosPara(
  edad: number,
  sexo: DatosBasicos['sexo'],
  override?: Partial<Nutrientes>,
  tabla: TablaObjetivos = tablaObjetivos(),
): Nutrientes {
  const e = Math.min(Math.max(Math.floor(edad), 1), 18)
  const fila = tabla.rangos.find((r) => e >= r.desde && e <= r.hasta && (r.sexo === null || r.sexo === sexo))
  if (!fila) throw new Error(`No hay objetivos para ${edad} años (${sexo})`)
  const objetivo = Object.fromEntries(NUTRIENTE.map((n) => [n, 0])) as Nutrientes
  for (const n of CON_META) {
    const propio = override?.[n]
    objetivo[n] = propio !== undefined && propio > 0 ? propio : (fila.objetivo[n] ?? 0)
  }
  return objetivo
}
