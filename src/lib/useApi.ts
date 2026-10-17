// Carga de datos con estados explícitos (C9): cargando, ok, error con reintento. Cancela al desmontar o al cambiar deps.
import { useCallback, useEffect, useState } from 'react'
import { ErrorDeApi } from './api'

export type Estado<T> =
  | { tipo: 'cargando' }
  | { tipo: 'ok'; datos: T }
  | { tipo: 'error'; error: ErrorDeApi }

export function aErrorDeApi(e: unknown): ErrorDeApi {
  if (e instanceof ErrorDeApi) return e
  return new ErrorDeApi(0, { error: { codigo: 'interno', mensaje: 'Algo falló de nuestro lado. ¿Probás de nuevo?', reintentable: true, detalle: String(e) } })
}

export function useApi<T>(cargar: (senal: AbortSignal) => Promise<T>, deps: unknown[]): Estado<T> & { reintentar: () => void } {
  const [estado, setEstado] = useState<Estado<T>>({ tipo: 'cargando' })
  const [intento, setIntento] = useState(0)
  const reintentar = useCallback(() => setIntento((i) => i + 1), [])

  useEffect(() => {
    const control = new AbortController()
    setEstado({ tipo: 'cargando' })
    cargar(control.signal)
      .then((datos) => { if (!control.signal.aborted) setEstado({ tipo: 'ok', datos }) })
      .catch((e) => { if (!control.signal.aborted) setEstado({ tipo: 'error', error: aErrorDeApi(e) }) })
    return () => control.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, intento])

  return { ...estado, reintentar }
}
