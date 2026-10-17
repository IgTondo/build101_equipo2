// El chico activo no existe en la base (404 no_encontrado): un estado calmo con salida, nunca "Reintentar".
// Lo usan el tablero, el perfil, el resumen y el inicio. El mensaje de B trae el id ("sint-tomas", "martina-3f2a1c"),
// que no es para el padre: acá no se muestra.
import { Link } from 'react-router-dom'
import { NINO_DEMO } from '../lib/nino'
import { Vacio } from './Estados'

/** `pantalla`: adónde lleva "Ver el perfil de ejemplo" (la misma pantalla, con el chico de ejemplo). */
export function PerfilNoEncontrado({ ninoId, pantalla = '/tablero' }: { ninoId: string; pantalla?: string }) {
  return (
    <Vacio titulo="No encontramos este perfil">
      <p className="nb-suave">Puede que se haya creado en otro celular. Podés crear uno nuevo en un par de minutos.</p>
      <div className="nb-botones">
        <Link className="nb-boton" to="/perfil/nuevo">Crear un perfil</Link>
        {ninoId !== NINO_DEMO && (
          <Link className="nb-boton nb-boton-secundario" to={`${pantalla}?nino=${NINO_DEMO}`}>Ver el perfil de ejemplo</Link>
        )}
      </div>
    </Vacio>
  )
}
