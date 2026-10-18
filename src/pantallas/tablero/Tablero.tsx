// C3 · Tablero "¿está comiendo bien?" (PLAN.md §1 y §9), de arriba hacia abajo: la respuesta corta y las alertas,
// la cobertura semanal, el próximo paso, la evolución,
// repertorio + grupos + exposiciones y las últimas comidas (lo que aprendimos va, simple, en el Perfil). C9: cargando, error y vacío.
// Si los últimos 7 días no tienen comidas pero hay historial, se muestra la última semana con registros (`hasta`).
// Arriba va la respuesta (la respuesta corta como titular y, al lado, el plato de nutrientes); la protagonista es el
// próximo paso. La grilla de "Lo que come" lee además el perfil (solo para mostrar; si falla, queda el número de aceptadas).
import { CalendarClock, Camera, FileText } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Progreso } from '../../../shared/contratos'
import { AvisoConsulta } from '../../componentes/AvisoConsulta'
import { Cargando, ErrorConReintento, Vacio } from '../../componentes/Estados'
import { PerfilNoEncontrado } from '../../componentes/PerfilNoEncontrado'
import { Button } from '../../componentes/ui/button'
import { api, type ErrorDeApi } from '../../lib/api'
import { diaUruguay, useNinoActivo } from '../../lib/nino'
import { aErrorDeApi, useApi } from '../../lib/useApi'
import { UltimasComidas } from './UltimasComidas'
import { Cobertura } from './Cobertura'
import { Evolucion } from './Evolucion'
import { ProximoPaso } from './ProximoPaso'
import { Repertorio } from './Repertorio'
import { Respuesta } from './Respuesta'
import { fechaCorta, gruposDesdeHoy, hayComidas, respuestaSemana, ultimoDia, ultimoDiaConComidas } from './calculos'
import { loQueCome } from './visual'

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
  const perfil = useApi((s) => api.perfil(ninoId, s), [ninoId])
  const conNino = `?nino=${encodeURIComponent(ninoId)}`

  const titulo = <h1 className="text-lg font-extrabold text-musgo">¿Está comiendo bien?</h1>

  if (!datos) {
    if (error?.codigo === 'no_encontrado') return <PerfilNoEncontrado />
    return (
      <div className="flex flex-col gap-4">
        {titulo}
        {error ? <ErrorConReintento error={error} reintentar={reintentar} /> : <Cargando texto="Juntando lo que comió esta semana…" className="py-2" />}
      </div>
    )
  }

  if (!hayComidas(datos.dias)) {
    return (
      <div className="flex flex-col gap-4">
        {titulo}
        <Vacio titulo="Todavía no hay comidas registradas">
          <Button asChild size="lg" className="mt-1">
            <Link to={`/registrar${conNino}`}>
              <Camera aria-hidden="true" />
              Registrar la primera comida
            </Link>
          </Button>
        </Vacio>
      </div>
    )
  }

  const p = datos
  const nutrienteQueFalta = p.semana.faltan[0]
  const lista = perfil.tipo === 'ok' ? loQueCome(perfil.datos.preparaciones) : perfil.tipo === 'error' ? null : undefined

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          {titulo}
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
            {/* La frase de §1 cuenta "cubrió 4 de 8" con la regla del 70%; acá va la respuesta corta, coherente con los estados. */}
            <p className="font-titulo text-2xl leading-tight font-extrabold text-pino text-balance">{respuestaSemana(p.semana.faltan)}</p>
            <Respuesta semana={p.semana} />
          </div>
        </div>
        {hasta && (
          <p className="flex items-start gap-2.5 rounded-xl bg-muted px-3.5 py-3 text-sm text-musgo text-pretty" role="status">
            <CalendarClock className="mt-0.5 size-4 shrink-0" strokeWidth={2.25} aria-hidden="true" />
            <span>
              Sin comidas en los últimos 7 días: es la semana hasta el <span className="tabular-nums">{fechaCorta(hasta)}</span>.
            </span>
          </p>
        )}
      </header>

      {(error || p.alertas.length > 0) && (
        <div className="-mt-4 flex flex-col gap-3">
          {error && <ErrorConReintento error={error} reintentar={reintentar} />}
          <AvisoConsulta alertas={p.alertas} />
        </div>
      )}

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
        loQueCome={lista}
      />

      <UltimasComidas dias={p.dias} />

      <nav className="flex flex-col gap-3" aria-label="Seguir">
        <Button asChild size="lg">
          <Link to={`/registrar${conNino}`}>
            <Camera aria-hidden="true" />
            Registrar una comida
          </Link>
        </Button>
        <Button asChild size="lg" variant="secondary">
          <Link to={`/resumen${conNino}`}>
            <FileText aria-hidden="true" />
            Resumen para el nutricionista
          </Link>
        </Button>
      </nav>
    </div>
  )
}
