// El chico activo (§9): vive en la URL (?nino=) y en localStorage, con try/catch porque puede no haber storage.
// Si no hay ninguno (la primera vez que se abre la app, §5.2), no hay chico activo: las pantallas que lo necesitan
// van dentro de <ConNino> (src/componentes/ConNino.tsx), que manda al alta por voz.
import { useSearchParams } from 'react-router-dom'

const CLAVE = 'nibble:nino'

/** El alta desde cero por voz (C6, §5.2): la primera vez (sin chico) o si el chico guardado ya no existe. */
export const RUTA_ALTA = '/perfil/nuevo'

function leerGuardado(): string | null {
  try { return localStorage.getItem(CLAVE) || null } catch { return null }
}

export function guardarNino(ninoId: string): void {
  try { localStorage.setItem(CLAVE, ninoId) } catch { /* sin storage: queda solo en la URL */ }
}

/** El chico activo, o null si todavía no se dio de alta ninguno en este celular. */
export function useNino(): string | null {
  const [params] = useSearchParams()
  const deUrl = params.get('nino')
  if (deUrl) {
    guardarNino(deUrl)
    return deUrl
  }
  return leerGuardado()
}

/** Para las pantallas que van dentro de <ConNino>: ahí siempre hay chico activo. */
export function useNinoActivo(): string {
  const ninoId = useNino()
  if (!ninoId) throw new Error('useNinoActivo() se usa solo dentro de <ConNino>')
  return ninoId
}

/** Día 'YYYY-MM-DD' en hora de Uruguay (Vercel corre en UTC; lo calcula el cliente, §5). */
export function diaUruguay(fecha = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Montevideo' }).format(fecha)
}
