// Íconos de trazo, decorativos (aria-hidden): el nombre accesible lo pone siempre el botón.
import type { ReactNode } from 'react'

function Icono({ children }: { children: ReactNode }) {
  return (
    <svg className="pf-icono" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {children}
    </svg>
  )
}

export const IconoCheck = () => <Icono><path d="M5 12.5l4.5 4.5L19 7.5" /></Icono>
export const IconoQuitar = () => <Icono><path d="M6 6l12 12M18 6L6 18" /></Icono>
export const IconoEditar = () => <Icono><path d="M4 20h4L19 9l-4-4L4 16v4z" /><path d="M13.5 6.5l4 4" /></Icono>
export const IconoMas = () => <Icono><path d="M12 5v14M5 12h14" /></Icono>
export const IconoMicrofono = () => (
  <Icono><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0013 0M12 17.5V21" /></Icono>
)
