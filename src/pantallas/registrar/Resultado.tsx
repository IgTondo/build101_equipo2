// Resultado del registro (C2, PLAN v5.1): alertas si hay (una línea), "Qué aprendí" (dos líneas cortas, el resto en
// "Ver más"), lo que aportó la comida (plegado, con rangos) y, al final, la próxima comida calculada con la que se acaba
// de registrar. Se vuelve a pedir el progreso después de
// guardar, así la sugerencia y el "Hoy" del inicio ya la cuentan. La energía va como dato, sin meta (§1). Las alertas
// derivan al profesional, sin alarmar.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Rango, RegistrarComidaReq, RegistrarComidaRes } from '../../../shared/contratos'
import { AvisoConsulta } from '../../componentes/AvisoConsulta'
import { ErrorConReintento } from '../../componentes/Estados'
import { TarjetaProximaComida } from '../../componentes/ProximaComida'
import { api } from '../../lib/api'
import { comidasDelDia, horaUruguay, proximaComida } from '../../lib/proximaComida'
import { useApi } from '../../lib/useApi'
import { NOMBRE_NUTRIENTE, NUTRIENTES_CON_META, textoParaPadres } from '../../lib/vocabulario'
import { aprendiCorto, rangoLegible } from './modelo'

/** "Qué aprendí" corto: lo más nuevo primero, dos líneas a la vista. */
const MAX_APRENDI = 2

/** Plegado: es un dato para quien lo quiera ver (la cobertura del día está en el inicio). */
function Nutrientes({ rango }: { rango: Rango }) {
  return (
    <details className="nb-tarjeta nb-ver-mas rg-plegable">
      <summary>Lo que aportó esta comida</summary>
      <dl className="rg-nutrientes rg-nutrientes-dos">
        {NUTRIENTES_CON_META.map((n) => (
          <div key={n} className="rg-nutriente">
            <dt>{NOMBRE_NUTRIENTE[n]}</dt>
            <dd className="nb-numero">{rangoLegible(n, rango.min[n], rango.max[n])}</dd>
          </div>
        ))}
      </dl>
      <p className="rg-energia">
        Energía: <span className="nb-numero">{rangoLegible('energia_kcal', rango.min.energia_kcal, rango.max.energia_kcal)}</span>
      </p>
      <p className="rg-pista">Valores aproximados.</p>
    </details>
  )
}

interface Props {
  ninoId: string
  res: RegistrarComidaRes
  /** Lo que se mandó a guardar: la comida y el día, para calcular la próxima. */
  req: RegistrarComidaReq
  alOtra: () => void
}

export function Resultado({ ninoId, res, req, alOtra }: Props) {
  const registrada = { id: res.comidaId, momento: req.momento, fechaISO: req.fechaISO }
  // Las comidas del día que devolvió el registro, más la recién guardada si no venía (B puede mandar el día sin ella).
  const delDia = comidasDelDia(res.dia.dia === req.dia ? [res.dia] : [], req.dia, [registrada])
  const [hora] = useState(horaUruguay)
  const proxima = proximaComida(delDia, hora)
  const progreso = useApi(
    (s) => api.progreso(ninoId, { dias: 7, momento: proxima.momento }, s),
    [ninoId, res.comidaId],
  )

  const conNino = new URLSearchParams({ nino: ninoId })

  return (
    <>
      <h1 id="rg-guardado" className="rg-guardado" tabIndex={-1} data-foco>Comida guardada</h1>

      <AvisoConsulta alertas={res.alertas} />

      {res.aprendi.length > 0 && (
        <section className="nb-tarjeta" aria-labelledby="rg-aprendi">
          <h2 id="rg-aprendi">Qué aprendí</h2>
          <ul className="rg-aprendi">
            {res.aprendi.slice(0, MAX_APRENDI).map((a, i) => <li key={`${a.tipo}-${i}`}>{aprendiCorto(textoParaPadres(a.texto))}</li>)}
          </ul>
          {res.aprendi.some((a, i) => i >= MAX_APRENDI || aprendiCorto(textoParaPadres(a.texto)) !== textoParaPadres(a.texto)) && (
            <details className="nb-ver-mas rg-aprendi-mas">
              <summary>Ver más</summary>
              <ul className="rg-aprendi">
                {res.aprendi.map((a, i) => <li key={`${a.tipo}-${i}`}>{textoParaPadres(a.texto)}</li>)}
              </ul>
            </details>
          )}
        </section>
      )}

      <Nutrientes rango={res.nutrientesComida} />

      <div className="rg-final">
        {progreso.tipo === 'error'
          ? <ErrorConReintento error={progreso.error} reintentar={progreso.reintentar} />
          : <TarjetaProximaComida ninoId={ninoId} proxima={proxima} progreso={progreso.tipo === 'ok' ? progreso.datos : null} />}
        <Link className="nb-boton nb-boton-secundario" to={{ pathname: '/', search: `?${conNino}` }}>Volver al inicio</Link>
        <button type="button" className="rg-boton-texto" onClick={alOtra}>Registrar otra comida</button>
      </div>
    </>
  )
}
