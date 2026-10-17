// Rutas del perfil. RUTA_DEMO_JURADO es lo que abre el QR del pitch (C10, C12): "Crear perfil" con un relato de
// ejemplo editable. El chico que se crea pasa a ser el activo, así el jurado nunca escribe en Tomás.
export const RUTA_PERFIL_NUEVO = '/perfil/nuevo'
export const RUTA_DEMO_JURADO = '/perfil/nuevo?demo=1'

/** La URL completa para el QR, en el dominio donde corra la app. */
export function urlDemoJurado(origen = typeof window === 'undefined' ? '' : window.location.origin): string {
  return `${origen}${RUTA_DEMO_JURADO}`
}
