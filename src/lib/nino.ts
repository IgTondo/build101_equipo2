// El chico activo (§9): vive en la URL (?nino=) y en localStorage, con try/catch porque puede no haber storage.
import { useSearchParams } from 'react-router-dom'

const CLAVE = 'nibble:nino'
export const NINO_DEMO = 'tomas'

function leerGuardado(): string | null {
  try { return localStorage.getItem(CLAVE) } catch { return null }
}

export function guardarNino(ninoId: string): void {
  try { localStorage.setItem(CLAVE, ninoId) } catch { /* sin storage: queda solo en la URL */ }
}

export function useNino(): string {
  const [params] = useSearchParams()
  const deUrl = params.get('nino')
  if (deUrl) {
    guardarNino(deUrl)
    return deUrl
  }
  return leerGuardado() ?? NINO_DEMO
}

/** Día 'YYYY-MM-DD' en hora de Uruguay (Vercel corre en UTC; lo calcula el cliente, §5). */
export function diaUruguay(fecha = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Montevideo' }).format(fecha)
}
