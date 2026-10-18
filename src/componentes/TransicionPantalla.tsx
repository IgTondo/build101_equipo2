// Al cambiar de pantalla (de ruta, no de búsqueda: el switch del motor no la dispara), la nueva entra con un fundido
// corto. Es la única entrada animada de la app: adentro, las secciones no entran una por una.
import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'

export function TransicionPantalla({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  return (
    <motion.div
      key={pathname}
      className="flex flex-1 flex-col gap-4"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}
