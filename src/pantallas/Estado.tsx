import { CircleAlert, CircleCheck, FlaskConical, LoaderCircle, type LucideIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ENDPOINTS, ErrorDeApi, pedirConMeta } from '../lib/api'
import { diaUruguay, useNino } from '../lib/nino'

// Para los checkpoints (§6): qué endpoints siguen en stub y cuáles ya son reales.
// Los POST se pingean con {}: un handler real responde 400 (entrada inválida) sin llamar a ningún modelo.
// Los GET se pingean con el chico activo; un 404 no_encontrado también es un handler real (los stubs no miran el id).
type Resultado = { estado: 'stub' | 'real' | 'error'; status: number; ms: number; detalle?: string }

export function Estado() {
  // Sin chico activo se pingea con un id que no existe: el 404 no_encontrado también cuenta como handler real.
  const ninoId = useNino() ?? 'sin-nino'
  const [res, setRes] = useState<Record<string, Resultado>>({})

  useEffect(() => {
    const control = new AbortController()
    for (const e of ENDPOINTS) {
      const t0 = performance.now()
      const params = new URLSearchParams({ ninoId, ...(e.nombre === 'nutricion' ? { dia: diaUruguay() } : {}) })
      const ruta = e.metodo === 'GET' ? `/api/${e.nombre}?${params}` : `/api/${e.nombre}`
      pedirConMeta(ruta, { metodo: e.metodo, cuerpo: e.metodo === 'POST' ? {} : undefined, timeoutMs: 15_000, senal: control.signal })
        .then((r) => ({ estado: r.stub ? 'stub' : 'real', status: 200, ms: r.ms }) as Resultado)
        .catch((err) => {
          const ms = Math.round(performance.now() - t0)
          const real = err instanceof ErrorDeApi && (err.status === 400 || (err.status === 404 && err.codigo === 'no_encontrado'))
          if (real) return { estado: 'real', status: err.status, ms } as Resultado
          return { estado: 'error', status: err instanceof ErrorDeApi ? err.status : 0, ms, detalle: err instanceof ErrorDeApi ? err.codigo : String(err) } as Resultado
        })
        .then((r) => { if (!control.signal.aborted) setRes((prev) => ({ ...prev, [e.nombre]: r })) })
    }
    return () => control.abort()
  }, [ninoId])

  const pistas = [...new Set(ENDPOINTS.map((e) => e.pista))]

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl">Estado de la API</h1>
        <p className="text-musgo">Los GET se prueban con el perfil activo.</p>
      </header>
      {pistas.map((pista) => (
        <div key={pista} className="flex flex-col gap-2">
          <h2 className="text-base text-musgo">Pista {pista}</h2>
          <ul className="flex flex-col divide-y rounded-2xl border bg-card">
            {ENDPOINTS.filter((e) => e.pista === pista).map((e) => (
              <Fila key={e.nombre} metodo={e.metodo} nombre={e.nombre} r={res[e.nombre]} />
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}

// Cada estado con su ícono y su texto: el color acompaña, nunca dice solo.
const VISTA: Record<Resultado['estado'] | 'probando', { Icono: LucideIcon; clase: string }> = {
  real: { Icono: CircleCheck, clase: 'text-verde-hondo' },
  stub: { Icono: FlaskConical, clase: 'text-musgo' },
  error: { Icono: CircleAlert, clase: 'text-pino' },
  probando: { Icono: LoaderCircle, clase: 'text-musgo animate-spin motion-reduce:animate-none' },
}

function Fila({ metodo, nombre, r }: { metodo: string; nombre: string; r?: Resultado }) {
  const { Icono, clase } = VISTA[r?.estado ?? 'probando']
  return (
    <li className={`flex min-h-14 items-center gap-3 px-4 py-2.5 ${r?.estado === 'error' ? 'bg-zapallo-claro first:rounded-t-2xl last:rounded-b-2xl' : ''}`}>
      <Icono className={`size-5 shrink-0 ${clase}`} strokeWidth={2.25} aria-hidden="true" />
      <code className="min-w-0 flex-1 font-sans text-sm break-words">
        <span className="text-musgo">{metodo}</span> <span className="font-bold text-pino">{nombre}</span>
      </code>
      <span className="max-w-[40%] text-right text-sm break-words">
        {r ? (r.estado === 'error' ? `error ${r.status} ${r.detalle ?? ''}` : r.estado) : '…'}
      </span>
      <span className="min-w-14 shrink-0 text-right text-sm whitespace-nowrap text-musgo tabular-nums">{r ? `${r.ms} ms` : ''}</span>
    </li>
  )
}
