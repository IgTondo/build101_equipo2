import { useEffect, useState } from 'react'
import { ENDPOINTS, ErrorDeApi, pedirConMeta } from '../lib/api'

// Para los checkpoints (§6): qué endpoints siguen en stub y cuáles ya son reales.
// Los POST se pingean con {}: un handler real responde 400 (entrada inválida) sin llamar a ningún modelo.
type Resultado = { estado: 'stub' | 'real' | 'error'; status: number; ms: number; detalle?: string }

export function Estado() {
  const [res, setRes] = useState<Record<string, Resultado>>({})

  useEffect(() => {
    for (const e of ENDPOINTS) {
      const t0 = performance.now()
      const ruta = e.metodo === 'GET' ? `/api/${e.nombre}?ninoId=tomas&dia=2026-10-16` : `/api/${e.nombre}`
      pedirConMeta(ruta, { metodo: e.metodo, cuerpo: e.metodo === 'POST' ? {} : undefined, timeoutMs: 15_000 })
        .then((r) => ({ estado: r.stub ? 'stub' : 'real', status: 200, ms: r.ms }) as Resultado)
        .catch((err) => {
          const ms = Math.round(performance.now() - t0)
          if (err instanceof ErrorDeApi && err.status === 400) return { estado: 'real', status: 400, ms } as Resultado
          return { estado: 'error', status: err instanceof ErrorDeApi ? err.status : 0, ms, detalle: err instanceof ErrorDeApi ? err.codigo : String(err) } as Resultado
        })
        .then((r) => setRes((prev) => ({ ...prev, [e.nombre]: r })))
    }
  }, [])

  return (
    <section className="nb-tarjeta">
      <h1>Estado de la API</h1>
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
