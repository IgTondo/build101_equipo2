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

  return (
    <section className="nb-tarjeta">
      <h1>Estado de la API</h1>
      <p className="nb-suave">Los GET se prueban con el perfil activo.</p>
      <table className="nb-tabla">
        <thead><tr><th>Endpoint</th><th>Pista</th><th>Estado</th><th className="nb-numero">ms</th></tr></thead>
        <tbody>
          {ENDPOINTS.map((e) => {
            const r = res[e.nombre]
            return (
              <tr key={e.nombre}>
                <td><code>{e.metodo} {e.nombre}</code></td>
                <td>{e.pista}</td>
                <td>{r ? (r.estado === 'error' ? `error ${r.status} ${r.detalle ?? ''}` : r.estado) : '…'}</td>
                <td className="nb-numero">{r?.ms ?? ''}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}
