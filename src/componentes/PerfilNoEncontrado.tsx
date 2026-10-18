// El chico activo no existe en la base (404 no_encontrado): un estado calmo con salida, nunca "Reintentar".
// Lo usan el inicio, el tablero, el perfil y el resumen. El mensaje de B trae el id del chico, que no es
// para el padre: acá no se muestra.
import { Link } from 'react-router-dom'
import { RUTA_ALTA } from '../lib/nino'
import { Vacio } from './Estados'
import { Button } from './ui/button'

export function PerfilNoEncontrado() {
  return (
    <Vacio titulo="No encontramos este perfil">
      <p className="text-musgo">Puede que se haya creado en otro celular. Contanos de tu hijo y armamos su perfil en un par de minutos.</p>
      <Button asChild className="mt-1">
        <Link to={RUTA_ALTA}>Agregar a tu hijo</Link>
      </Button>
    </Vacio>
  )
}
