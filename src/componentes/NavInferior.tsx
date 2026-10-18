// La navegación principal (Inicio · Semana · Perfil): una barra flotante abajo, al alcance del pulgar. La pastilla
// verde se desliza a la pestaña activa. La navegación conserva ?nino= (y el motor de la demo), §9.
import { CalendarDays, House, UserRound } from 'lucide-react'
import { motion } from 'motion/react'
import { NavLink } from 'react-router-dom'

const NAV = [
  { a: '/', texto: 'Inicio', Icono: House },
  { a: '/tablero', texto: 'Semana', Icono: CalendarDays },
  { a: '/perfil', texto: 'Perfil', Icono: UserRound },
]

export function NavInferior({ search }: { search: string }) {
  return (
    <nav
      aria-label="Principal"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(14px,env(safe-area-inset-bottom))]"
    >
      <ul className="pointer-events-auto mx-auto flex max-w-sm items-center gap-1 rounded-full border bg-background p-1.5 shadow-flotante">
        {NAV.map(({ a, texto, Icono }) => (
          <li key={a} className="flex-1">
            <NavLink
              to={{ pathname: a, search }}
              end={a === '/'}
              className="relative flex h-12 items-center justify-center gap-2 rounded-full px-3 font-bold text-musgo transition-colors duration-200 hover:text-pino aria-[current=page]:text-primary-foreground"
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="nav-activa"
                      className="absolute inset-0 rounded-full bg-primary"
                      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    />
                  )}
                  <Icono className="relative size-5" strokeWidth={2.25} aria-hidden="true" />
                  <span className="relative text-sm">{texto}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
