// El progreso de una comida (v5.3): GET /api/progreso?dias=7&momento= con una caché en memoria por chico y comida,
// para que cambiar entre Desayuno · Almuerzo · Merienda · Cena sea instantáneo la segunda vez y la receta reciba el
// mismo plato que vio el padre en el inicio. No se guarda nada fuera de la memoria: se pierde al recargar.
// Mientras llega una comida nueva, se sigue mostrando la anterior (la tarjeta la atenúa).
import { useCallback, useEffect, useState } from 'react'
import type { Momento, Progreso } from '../../shared/contratos'
import { api, type ErrorDeApi } from './api'
import { aErrorDeApi } from './useApi'

const DIAS = 7
const cache = new Map<string, Progreso>()
const clave = (ninoId: string, momento: Momento | undefined) => `${ninoId}|${momento ?? '-'}`

/** Al guardar una comida, cambia el día y el plato: se olvida todo lo de ese chico. */
export function olvidarProgresos(ninoId: string): void {
  for (const k of [...cache.keys()]) if (k.startsWith(`${ninoId}|`)) cache.delete(k)
}

export interface ProgresoComida {
  /** Lo que se muestra: el de esa comida o, mientras carga, el último que se mostró (null la primera vez). */
  datos: Progreso | null
  /** La comida de `datos` (puede no ser la pedida mientras carga). */
  momentoDatos: Momento | null
  /** Está pidiendo la comida elegida. */
  cargando: boolean
  /** El pedido de la comida elegida falló. */
  error: ErrorDeApi | null
  reintentar: () => void
}

interface Mostrado { ninoId: string; momento: Momento | null; datos: Progreso }

/** `momento` undefined: el progreso sin ?momento= (la receta abierta desde el tablero). */
export function useProgresoComida(ninoId: string, momento: Momento | undefined): ProgresoComida {
  const k = clave(ninoId, momento)
  const [mostrado, setMostrado] = useState<Mostrado | null>(null)
  const [fallo, setFallo] = useState<{ k: string; error: ErrorDeApi } | null>(null)
  const [intento, setIntento] = useState(0)
  const reintentar = useCallback(() => setIntento((i) => i + 1), [])

  useEffect(() => {
    const enCache = cache.get(k)
    if (enCache) { setMostrado({ ninoId, momento: momento ?? null, datos: enCache }); return }
    const control = new AbortController()
    setFallo(null)
    api.progreso(ninoId, { dias: DIAS, momento }, control.signal)
      .then((datos) => {
        cache.set(k, datos)
        if (!control.signal.aborted) setMostrado({ ninoId, momento: momento ?? null, datos })
      })
      .catch((e: unknown) => { if (!control.signal.aborted) setFallo({ k, error: aErrorDeApi(e) }) })
    return () => control.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k, intento])

  // Lo que está en la caché se muestra en el mismo render, sin esperar al efecto (sin parpadeo al volver a una comida).
  const enCache = cache.get(k)
  if (enCache) return { datos: enCache, momentoDatos: momento ?? null, cargando: false, error: null, reintentar }
  const previo = mostrado?.ninoId === ninoId ? mostrado : null
  const error = fallo?.k === k ? fallo.error : null
  return { datos: previo?.datos ?? null, momentoDatos: previo?.momento ?? null, cargando: !error, error, reintentar }
}
