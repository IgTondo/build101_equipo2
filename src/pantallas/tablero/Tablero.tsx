// C3 · Tablero "¿está comiendo bien?" (PLAN.md §1 y §9), de arriba hacia abajo: la frase y las alertas,
// la cobertura semanal, el próximo paso (con el switch de recomendador de C14), la evolución,
// repertorio + grupos + exposiciones, y lo que aprendimos + las últimas comidas. C9: cargando, error y vacío.
// Si los últimos 7 días no tienen comidas pero hay historial, se muestra la última semana con registros (`hasta`).
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { Alerta, Motor, Progreso } from '../../../shared/contratos'
import { Cargando, ErrorConReintento, Vacio } from '../../componentes/Estados'
import { PerfilNoEncontrado } from '../../componentes/PerfilNoEncontrado'
import { api, type ErrorDeApi } from '../../lib/api'
import { diaUruguay, useNinoActivo } from '../../lib/nino'
import { aErrorDeApi } from '../../lib/useApi'
import { Aprendimos, UltimasComidas } from './Aprendimos'
import { Cobertura } from './Cobertura'
import { Evolucion } from './Evolucion'
import { ProximoPaso } from './ProximoPaso'
import { Repertorio } from './Repertorio'
import { fechaCorta, gruposDesdeHoy, hayComidas, leerMotor, ultimoDia, ultimoDiaConComidas } from './calculos'
import './tablero.css'

const DIAS = 7 // la cobertura es semanal; las 4 semanas de la evolución vienen aparte en `semanas`

interface Carga { clave: string; datos: Progreso | null; hasta: string | null; error: ErrorDeApi | null; cargando: boolean }

/** El tablero de los últimos 7 días; si vino vacío pero hay historial, el de la última semana con comidas. */
async function pedirProgreso(ninoId: string, motor: Motor, senal: AbortSignal): Promise<{ datos: Progreso; hasta: string | null }> {
  const datos = await api.progreso(ninoId, { dias: DIAS, motor }, senal)
  const hoy = diaUruguay()
  const hasta = hayComidas(datos.dias) ? null : ultimoDiaConComidas(datos, hoy)
  if (!hasta) return { datos, hasta: null }
  const semana = await api.progreso(ninoId, { dias: DIAS, motor, hasta }, senal)
  return { datos: { ...semana, grupos: gruposDesdeHoy(semana.grupos, hasta, hoy) }, hasta }
}

/**
 * Como useApi, pero al cambiar de motor conserva el tablero anterior mientras llega el nuevo
 * (sin parpadeo de "Cargando…"). Los datos de otro chico nunca se muestran.
 */
function useProgreso(ninoId: string, motor: Motor) {
  const [carga, setCarga] = useState<Carga>({ clave: ninoId, datos: null, hasta: null, error: null, cargando: true })
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    const control = new AbortController()
    setCarga((c) => (c.clave === ninoId ? { ...c, error: null, cargando: true } : { clave: ninoId, datos: null, hasta: null, error: null, cargando: true }))
    pedirProgreso(ninoId, motor, control.signal)
      .then(({ datos, hasta }) => { if (!control.signal.aborted) setCarga({ clave: ninoId, datos, hasta, error: null, cargando: false }) })
      .catch((e) => { if (!control.signal.aborted) setCarga((c) => ({ ...c, error: aErrorDeApi(e), cargando: false })) })
    return () => control.abort()
  }, [ninoId, motor, intento])

  const propia = carga.clave === ninoId
  return {
    datos: propia ? carga.datos : null, hasta: propia ? carga.hasta : null,
    error: carga.error, cargando: carga.cargando, reintentar: () => setIntento((i) => i + 1),
  }
}

export function Tablero() {
  const ninoId = useNinoActivo()
  const [params, setParams] = useSearchParams()
  const motor = leerMotor(params.get('motor'))
  const { datos, hasta, error, cargando, reintentar } = useProgreso(ninoId, motor)
  const conNino = `?nino=${encodeURIComponent(ninoId)}`

  const cambiarMotor = (m: Motor) => {
    setParams((p) => { const n = new URLSearchParams(p); n.set('motor', m); return n }, { replace: true })
  }

  if (!datos) {
    if (error?.codigo === 'no_encontrado') return <PerfilNoEncontrado />
    return (
      <>
        <h1 className="tb-titulo">¿Está comiendo bien?</h1>
        {error ? <ErrorConReintento error={error} reintentar={reintentar} /> : <Cargando texto="Juntando lo que comió esta semana…" />}
      </>
    )
  }

  if (!hayComidas(datos.dias)) {
    return (
      <>
        <h1 className="tb-titulo">¿Está comiendo bien?</h1>
        <Vacio titulo="Todavía no hay comidas registradas">
          <Link className="nb-boton" to={`/registrar${conNino}`}>Registrar la primera comida</Link>
        </Vacio>
      </>
    )
  }

  const p = datos
  const nutrienteQueFalta = p.semana.faltan[0]

  return (
    <div className="tb-tablero">
      <header className="tb-hero">
        <h1 className="tb-titulo">¿Está comiendo bien?</h1>
        <p className="tb-frase">{p.frase}</p>
        {hasta && (
          <p className="tb-aviso-semana" role="status">
            No hay comidas registradas en los últimos 7 días. Te mostramos la última semana con registros,
            hasta el <span className="nb-numero">{fechaCorta(hasta)}</span>.
          </p>
        )}
      </header>

      {error && <ErrorConReintento error={error} reintentar={reintentar} />}
      {p.alertas.length > 0 && <Alertas alertas={p.alertas} />}

      <Cobertura semana={p.semana} dia={ultimoDia(p.dias)} />

      <ProximoPaso
        ninoId={ninoId}
        sugerencias={p.sugerencias}
        proximoPaso={p.proximoPaso}
        nutriente={nutrienteQueFalta}
        motor={motor}
        onMotor={cambiarMotor}
        recargando={cargando}
      />

      <Evolucion semanas={p.semanas} nutriente={nutrienteQueFalta} />

      <Repertorio
        aceptadas={p.aceptadas}
        enProceso={p.enProceso}
        repertorioTendencia={p.repertorioTendencia}
        grupos={p.grupos}
        exposiciones={p.exposiciones}
      />

      <Aprendimos patrones={p.patrones} />
      <UltimasComidas dias={p.dias} />

      <nav className="tb-acciones" aria-label="Seguir">
        <Link className="nb-boton" to={`/registrar${conNino}`}>Registrar una comida</Link>
        <Link className="nb-boton nb-boton-secundario" to={`/resumen${conNino}`}>Resumen para el nutricionista</Link>
      </nav>
    </div>
  )
}

function Alertas({ alertas }: { alertas: Alerta[] }) {
  return (
    <section className="tb-alertas" aria-labelledby="tb-alertas-t">
      <svg className="tb-alertas-icono" width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M12 7v6M12 16.5v.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
      <div>
        <h2 id="tb-alertas-t">Conviene consultar a su pediatra o nutricionista</h2>
        <ul>
          {alertas.map((a, i) => <li key={`${a.tipo}-${i}`}>{a.texto}</li>)}
        </ul>
      </div>
    </section>
  )
}
