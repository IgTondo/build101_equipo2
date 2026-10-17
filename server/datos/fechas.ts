// Fechas en hora de Uruguay (UTC−3, sin horario de verano desde 2015). Los días son 'YYYY-MM-DD'.
// Vercel corre en UTC: el día de cada comida lo manda el cliente; acá solo se calcula "hoy" y se suman días.
import type { Momento } from '../../shared/contratos.js'

const ZONA = 'America/Montevideo'

export function hoyUruguay(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ahora)
}

export function horaUruguay(ahora: Date = new Date()): number {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: ZONA, hour: '2-digit', hourCycle: 'h23' }).format(ahora))
}

/** El día de Uruguay de un instante ISO ("2026-10-07T23:30:00-03:00" → "2026-10-07"). */
export const diaDe = (fechaISO: string): string => hoyUruguay(new Date(fechaISO))

export function sumarDias(dia: string, n: number): string {
  const d = new Date(`${dia}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export function diasEntre(desde: string, hasta: string): number {
  return Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000)
}

export const esDia = (s: unknown): s is string =>
  typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`))

/** El momento de la próxima comida según la hora: sirve para no repetir la sugerencia segura. */
export function momentoSegunHora(hora: number): Momento {
  if (hora < 10) return 'desayuno'
  if (hora < 15) return 'almuerzo'
  if (hora < 19) return 'merienda'
  return 'cena'
}
