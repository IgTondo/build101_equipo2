// Resultado del registro (C2, PLAN v5.1): alertas si hay, "Qué aprendí", lo que aportó la comida (con rangos) y, al
// final, la próxima comida calculada con la que se acaba de registrar. Se vuelve a pedir el progreso después de
// guardar, así la sugerencia y el "Hoy" del inicio ya la cuentan. La energía va como dato, sin meta (§1). Las alertas
// derivan al profesional, sin alarmar.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Rango, RegistrarComidaReq, RegistrarComidaRes } from '../../../shared/contratos'
import { ErrorConReintento } from '../../componentes/Estados'
import { TarjetaProximaComida } from '../../componentes/ProximaComida'
import { api } from '../../lib/api'
import { comidasDelDia, horaUruguay, proximaComida } from '../../lib/proximaComida'
import { useApi } from '../../lib/useApi'
import { NOMBRE_NUTRIENTE, NUTRIENTES_CON_META, textoParaPadres } from '../../lib/vocabulario'
import { rangoLegible } from './modelo'

/** "Qué aprendí" corto: lo más nuevo primero, como mucho tres líneas. */
const MAX_APRENDI = 3

function Nutrientes({ rango }: { rango: Rango }) {
  return (
    <section className="nb-tarjeta" aria-labelledby="rg-nutrientes">
      <h2 id="rg-nutrientes">Lo que aportó esta comida</h2>
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
    </section>
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
            {res.aprendi.slice(0, MAX_APRENDI).map((a, i) => <li key={`${a.tipo}-${i}`}>{textoParaPadres(a.texto)}</li>)}
          </ul>
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
