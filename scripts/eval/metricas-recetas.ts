// Métricas de la eval de recetas (PLAN.md §11.3, A12). Funciones puras: no leen archivos ni llaman a la IA;
// scripts/eval-recetas.ts les pasa lo que pasó en cada caso (cada salida del LLM con sus problemas por tipo, la receta
// final validada de nuevo y la latencia).
import type { Nutriente } from '../../shared/contratos.js'
import { TIPOS_PROBLEMA, type ProblemasPorTipo } from '../../server/validacion/receta.js'
import { fraccion, media, percentil, type Conteo } from './metricas.js'

export const CUBRE_MINIMO = 0.2        // §11.3: el % de recetas que cubre al menos el 20% de lo que falta
export const LIMITE_RECETA_MS = 60_000 // la función de Vercel corta a los 60 s

// Costo por llamada a Claude Sonnet 5.5 (USD 2 y 10 por millón): ~3 k tokens de entrada (prompt, evidencia, lista de
// ingredientes y schema) y ~2 k de salida (receta y razonamiento con effort medium). Es una estimación para el reporte.
export const USD_POR_LLAMADA = (3000 * 2 + 2000 * 10) / 1_000_000

// El desglose de §11.3: alergias, un solo cambio y lenguaje; lo demás (reglas, mezclas, gramos, textos) va junto.
export const DESGLOSE = ['alergias', 'cambio', 'lenguaje', 'otros'] as const
export type Desglose = (typeof DESGLOSE)[number]

export function desglosar(p: ProblemasPorTipo): Record<Desglose, number> {
  const otros = TIPOS_PROBLEMA.filter((t) => t !== 'alergias' && t !== 'cambio' && t !== 'lenguaje').reduce((s, t) => s + p[t].length, 0)
  return { alergias: p.alergias.length, cambio: p.cambio.length, lenguaje: p.lenguaje.length, otros }
}

export const sinProblemas = (p: ProblemasPorTipo): boolean => TIPOS_PROBLEMA.every((t) => p[t].length === 0)

export interface ResultadoCasoReceta {
  id: string
  ninoId: string
  nutriente: Nutriente
  intentos: ProblemasPorTipo[]          // cada salida del LLM, en orden: la primera mide "el LLM solo"
  final: 'ok' | 'sin_candidatos' | 'error'
  revalidacion: ProblemasPorTipo | null // la receta que devolvió generarReceta(), validada de nuevo por la eval
  cobertura: number | null              // coberturaDeLoQueFalta de esa receta
  preparacionBaseId?: string
  ms: number | null                     // null si falló por un error
  error?: string
}

export interface ResumenRecetas {
  casos: number
  llmSolo: Conteo & { porTipo: Record<Desglose, Conteo> }   // la primera salida de cada caso que llegó a llamar al LLM
  final: { ok: number; sinCandidatos: number; errores: number; invalidas: number; porTipo: Record<Desglose, Conteo> }
  salidas: { total: number; conProblemas: number; porTipo: Record<Desglose, number> }   // todas las salidas del LLM
  cubre: Conteo                                             // de las recetas finales válidas, las que cubren ≥ 20%
  llamadas: number
  costoUsd: number
  latencia: { media: number | null; p95: number | null; bajoLimite: number | null }
}

const conteos = (): Record<Desglose, Conteo> => ({ alergias: { ok: 0, total: 0 }, cambio: { ok: 0, total: 0 }, lenguaje: { ok: 0, total: 0 }, otros: { ok: 0, total: 0 } })

function sumar(destino: Record<Desglose, Conteo>, p: ProblemasPorTipo) {
  const d = desglosar(p)
  for (const t of DESGLOSE) {
    destino[t].total++
    if (d[t] === 0) destino[t].ok++
  }
}

export function resumirRecetas(casos: ResultadoCasoReceta[]): ResumenRecetas {
  const llmSolo = { ok: 0, total: 0, porTipo: conteos() }
  const final = { ok: 0, sinCandidatos: 0, errores: 0, invalidas: 0, porTipo: conteos() }
  const salidas = { total: 0, conProblemas: 0, porTipo: { alergias: 0, cambio: 0, lenguaje: 0, otros: 0 } as Record<Desglose, number> }
  const cubre = { ok: 0, total: 0 }

  for (const c of casos) {
    const [primera] = c.intentos
    if (primera) {
      llmSolo.total++
      if (sinProblemas(primera)) llmSolo.ok++
      sumar(llmSolo.porTipo, primera)
    }
    for (const p of c.intentos) {
      salidas.total++
      if (!sinProblemas(p)) salidas.conProblemas++
      const d = desglosar(p)
      for (const t of DESGLOSE) if (d[t] > 0) salidas.porTipo[t]++
    }
    if (c.final === 'sin_candidatos') final.sinCandidatos++
    else if (c.final === 'error') final.errores++
    else if (!c.revalidacion || !sinProblemas(c.revalidacion)) final.invalidas++ // una receta que llegó al padre mal
    else {
      final.ok++
      cubre.total++
      if ((c.cobertura ?? 0) >= CUBRE_MINIMO) cubre.ok++
    }
    if (c.final === 'ok' && c.revalidacion) sumar(final.porTipo, c.revalidacion)
  }

  const ms = casos.map((c) => c.ms)
  const ok = ms.filter((x): x is number => x !== null)
  const llamadas = salidas.total
  return {
    casos: casos.length, llmSolo, final, salidas, cubre, llamadas,
    costoUsd: Math.round(llamadas * USD_POR_LLAMADA * 100) / 100,
    latencia: { media: media(ok), p95: percentil(ok, 95), bajoLimite: fraccion(ok.filter((x) => x < LIMITE_RECETA_MS).length, ms.length) },
  }
}

/** La frase para el pitch (§11.3): "el LLM se equivocó X veces; el código lo atrapó siempre". */
export function fraseRecetas(r: ResumenRecetas): string {
  if (r.salidas.total === 0) return 'No hubo salidas del modelo para medir.'
  const errores = `El LLM se equivocó en ${r.salidas.conProblemas} de sus ${r.salidas.total} salidas`
  return r.final.invalidas === 0
    ? `${errores}; el código lo atrapó siempre: ninguna receta inválida llegó a la familia.`
    : `${errores}, y ${r.final.invalidas} receta${r.final.invalidas === 1 ? '' : 's'} inválida${r.final.invalidas === 1 ? '' : 's'} pasó la validación: hay que revisarla.`
}
