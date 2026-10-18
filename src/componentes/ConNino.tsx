// Rutas que necesitan un chico activo (inicio, registrar, tablero, perfil, resumen, receta). Si no hay ninguno
// en la URL ni en localStorage (la primera vez, §5.2), se va al alta por voz en lugar de pedir un chico que no existe.
// Adentro, las pantallas leen el chico con useNinoActivo().
import { Navigate, Outlet } from 'react-router-dom'
import { RUTA_ALTA, useNino } from '../lib/nino'

export function ConNino() {
  return useNino() ? <Outlet /> : <Navigate to={RUTA_ALTA} replace />
}
