// Resultado del registro (C2): nutrientes de la comida con rangos, "Qué aprendí" y alertas.
// La energía va como dato, sin meta (§1). Las alertas derivan al profesional, sin alarmar.
import { Link, useLocation } from 'react-router-dom'
import type { Rango, RegistrarComidaRes } from '../../../shared/contratos'
import { NOMBRE_NUTRIENTE, NUTRIENTES_CON_META, textoParaPadres } from '../../lib/vocabulario'
import { rangoLegible } from './modelo'

function Nutrientes({ rango }: { rango: Rango }) {
  return (
    <section className="nb-tarjeta" aria-labelledby="rg-nutrientes">
      <h2 id="rg-nutrientes">Lo que aportó esta comida</h2>
      <p className="rg-pista">Son aproximados: una foto puede errarle a los gramos, por eso mostramos un rango.</p>
      <dl className="rg-nutrientes">
        {NUTRIENTES_CON_META.map((n) => (
          <div key={n} className="rg-nutriente">
            <dt>{NOMBRE_NUTRIENTE[n]}</dt>
            <dd className="nb-numero">{rangoLegible(n, rango.min[n], rango.max[n])}</dd>
          </div>
        ))}
      </dl>
      <p className="rg-energia">
        Energía aproximada: <span className="nb-numero">{rangoLegible('energia_kcal', rango.min.energia_kcal, rango.max.energia_kcal)}</span>
        <span className="nb-suave"> · es un dato, no una meta</span>
      </p>
    </section>
  )
}

export function Resultado({ res, alOtra }: { res: RegistrarComidaRes; alOtra: () => void }) {
  const { search } = useLocation()
  return (
    <>
      <section className="nb-tarjeta rg-guardado" aria-labelledby="rg-guardado">
        <h1 id="rg-guardado" tabIndex={-1} data-foco>Comida guardada</h1>
        <p>Gracias por contarlo. Cada registro ayuda a conocerlo mejor.</p>
      </section>

      {res.alertas.length > 0 && (
        <section className="nb-tarjeta rg-alerta" aria-labelledby="rg-alertas">
          <h2 id="rg-alertas">Algo para comentar con su pediatra</h2>
          <ul>
            {res.alertas.map((a, i) => <li key={`${a.tipo}-${i}`}>{a.texto}</li>)}
          </ul>
          <p className="nb-suave">No es un diagnóstico: conviene consultarlo con su pediatra o nutricionista.</p>
        </section>
      )}

      {res.aprendi.length > 0 && (
        <section className="nb-tarjeta" aria-labelledby="rg-aprendi">
          <h2 id="rg-aprendi">Qué aprendí</h2>
          <ul className="rg-aprendi">
            {res.aprendi.map((a, i) => <li key={`${a.tipo}-${i}`}>{textoParaPadres(a.texto)}</li>)}
          </ul>
        </section>
      )}

      <Nutrientes rango={res.nutrientesComida} />

      <div className="rg-acciones">
        <Link className="nb-boton" to={{ pathname: '/tablero', search }}>Ver cómo viene</Link>
        <button type="button" className="nb-boton nb-boton-secundario" onClick={alOtra}>Registrar otra</button>
      </div>
    </>
  )
}
