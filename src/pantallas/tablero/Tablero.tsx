// C3 · Tablero "¿está comiendo bien?" (PLAN.md §1 y §9), de arriba hacia abajo: la respuesta corta y las alertas,
// la cobertura semanal, el próximo paso, la evolución,
// repertorio + grupos + exposiciones y las últimas comidas (lo que aprendimos va, simple, en el Perfil). C9: cargando, error y vacío.
// Si los últimos 7 días no tienen comidas pero hay historial, se muestra la última semana con registros (`hasta`).
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Progreso } from '../../../shared/contratos'
import { AvisoConsulta } from '../../componentes/AvisoConsulta'
import { Cargando, ErrorConReintento, Vacio } from '../../componentes/Estados'
import { PerfilNoEncontrado } from '../../componentes/PerfilNoEncontrado'
import { api, type ErrorDeApi } from '../../lib/api'
import { diaUruguay, useNinoActivo } from '../../lib/nino'
import { aErrorDeApi } from '../../lib/useApi'
import { UltimasComidas } from './UltimasComidas'
import { Cobertura } from './Cobertura'
import { Evolucion } from './Evolucion'
import { ProximoPaso } from './ProximoPaso'
import { Repertorio } from './Repertorio'
import { fechaCorta, gruposDesdeHoy, hayComidas, respuestaSemana, ultimoDia, ultimoDiaConComidas } from './calculos'
import './tablero.css'

const DIAS = 7 // la cobertura es semanal; las 4 semanas de la evolución vienen aparte en `semanas`

interface Carga { clave: string; datos: Progreso | null; hasta: string | null; error: ErrorDeApi | null; cargando: boolean }

/** El tablero de los últimos 7 días; si vino vacío pero hay historial, el de la última semana con comidas. */
async function pedirProgreso(ninoId: string, senal: AbortSignal): Promise<{ datos: Progreso; hasta: string | null }> {
  const datos = await api.progreso(ninoId, { dias: DIAS }, senal)
  const hoy = diaUruguay()
  const hasta = hayComidas(datos.dias) ? null : ultimoDiaConComidas(datos, hoy)
  if (!hasta) return { datos, hasta: null }
  const semana = await api.progreso(ninoId, { dias: DIAS, hasta }, senal)
  return { datos: { ...semana, grupos: gruposDesdeHoy(semana.grupos, hasta, hoy) }, hasta }
}

/**
 * Como useApi, pero al reintentar conserva el tablero anterior mientras llega el nuevo
 * (sin parpadeo de "Cargando…"). Los datos de otro chico nunca se muestran.
 */
function useProgreso(ninoId: string) {
  const [carga, setCarga] = useState<Carga>({ clave: ninoId, datos: null, hasta: null, error: null, cargando: true })
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    const control = new AbortController()
    setCarga((c) => (c.clave === ninoId ? { ...c, error: null, cargando: true } : { clave: ninoId, datos: null, hasta: null, error: null, cargando: true }))
    pedirProgreso(ninoId, control.signal)
      .then(({ datos, hasta }) => { if (!control.signal.aborted) setCarga({ clave: ninoId, datos, hasta, error: null, cargando: false }) })
      .catch((e) => { if (!control.signal.aborted) setCarga((c) => ({ ...c, error: aErrorDeApi(e), cargando: false })) })
    return () => control.abort()
  }, [ninoId, intento])

  const propia = carga.clave === ninoId
  return {
    datos: propia ? carga.datos : null, hasta: propia ? carga.hasta : null,
    error: carga.error, cargando: carga.cargando, reintentar: () => setIntento((i) => i + 1),
  }
}

export function Tablero() {
  const ninoId = useNinoActivo()
  const { datos, hasta, error, cargando, reintentar } = useProgreso(ninoId)
  const conNino = `?nino=${encodeURIComponent(ninoId)}`

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
        {/* La frase de §1 cuenta "cubrió 4 de 8" con la regla del 70%; acá va la respuesta corta, coherente con los estados. */}
        <p className="tb-frase">{respuestaSemana(p.semana.faltan)}</p>
        {hasta && (
          <p className="tb-aviso-semana" role="status">
            Sin comidas en los últimos 7 días: es la semana hasta el <span className="nb-numero">{fechaCorta(hasta)}</span>.
          </p>
        )}
      </header>

      {error && <ErrorConReintento error={error} reintentar={reintentar} />}
      <AvisoConsulta alertas={p.alertas} />

      <Cobertura semana={p.semana} dia={ultimoDia(p.dias)} />

      <ProximoPaso
        ninoId={ninoId}
        sugerencias={p.sugerencias}
        proximoPaso={p.proximoPaso}
        nutriente={nutrienteQueFalta}
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

      <UltimasComidas dias={p.dias} />

      <nav className="tb-acciones" aria-label="Seguir">
        <Link className="nb-boton" to={`/registrar${conNino}`}>Registrar una comida</Link>
        <Link className="nb-boton nb-boton-secundario" to={`/resumen${conNino}`}>Resumen para el nutricionista</Link>
      </nav>
    </div>
  )
}
