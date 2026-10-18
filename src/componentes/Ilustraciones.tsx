// Ilustraciones de marca, dibujadas con la paleta y el mordisco del logo. Decorativas (aria-hidden).
import { useId } from 'react'

/** Un plato visto desde arriba con un mordisco en el borde y una arveja sola: "todavía no hay nada acá". */
export function PlatoVacio({ className }: { className?: string }) {
  const id = useId()
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden="true" focusable="false">
      <defs>
        <mask id={`${id}-m`}>
          <rect width="120" height="120" fill="#fff" />
          <circle cx="101" cy="19" r="17" fill="#000" />
        </mask>
      </defs>
      <g mask={`url(#${id}-m)`}>
        <circle cx="60" cy="60" r="55" fill="var(--nb-brote)" />
        <circle cx="60" cy="60" r="55" fill="none" stroke="var(--nb-hoja)" strokeWidth="2" />
      </g>
      <circle cx="60" cy="60" r="37" fill="#fff" stroke="var(--nb-hoja)" strokeWidth="2.5" />
      <circle cx="67" cy="66" r="6.5" fill="var(--nb-verde)" />
      <circle cx="65" cy="64" r="2" fill="#fff" opacity="0.55" />
    </svg>
  )
}
