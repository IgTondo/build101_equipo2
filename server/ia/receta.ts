// A9 · Receta con food chaining (PLAN.md §7). armarEvidencia() (B) → prompt con solo el candidato elegido del paquete y
// evidencia.texto → generarJSON({ tarea: 'receta' }) (Claude Sonnet 5.5) → validarReceta() (código) → si falla, 1 reintento
// con los problemas → si sigue mal, el siguiente candidato → sin más, ErrorNibble('sin_candidatos').
// El LLM escribe los textos y elige los gramos; el código completa el resto: la cadena (preparacionBaseId, desde, cambio,
// seMantiene), el aporte con la tabla, la cobertura de lo que falta, la validación y la evidencia.
// La función corta a los 60 s (vercel.json) y cada llamada puede tardar 25 s: pasados 30 s no se arranca otra.
// api/receta.ts: esquemaRecetaReq.parse(req.body) → generarReceta(pedido, { armarEvidencia, perfil }) → 200.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import {
  NUTRIENTE,
  type Alergeno, type Candidato, type Evidencia, type Nutriente, type Nutrientes, type Perfil,
  type PreparacionCatalogo, type Presentacion, type Receta, type RecetaReq,
} from '../../shared/contratos.js'
import { ErrorNibble } from '../http.js'
import { calcularAporte, validarCandidato, validarReceta, type ContextoValidacion } from '../validacion/receta.js'
import { alimentoPorId, alimentos, esGenerico } from './catalogo.js'
import { generarJSON } from './modelo.js'
import { esquemaSalidaReceta, promptReceta, SISTEMA_RECETA, type SalidaReceta } from './prompts/receta.js'

export const TOPE_NUEVA_LLAMADA_MS = 30_000

export const esquemaRecetaReq = z.object({
  ninoId: z.string().trim().min(1),
  nutriente: z.enum(NUTRIENTE).exclude(['energia_kcal']).optional(), // sin meta de calorías: no hay receta "para la energía"
  preparacionId: z.string().trim().min(1).optional(),
})

export interface DepsReceta {
  armarEvidencia: (ninoId: string, nutriente?: Nutriente) => Promise<Evidencia>  // B · server/grafo/evidencia.ts
  perfil: (ninoId: string) => Promise<Perfil>          // B · el de GET /api/perfil: alergias, reglas con condiciones y lo que acepta
  preparacion?: (id: string) => PreparacionCatalogo | undefined  // por defecto, preparacionCatalogo()
  ahora?: () => number                                 // reloj, para los tests del tope de tiempo
}

// ---------- Catálogo de preparaciones ----------
let catalogo: Map<string, PreparacionCatalogo> | null = null

/** Catálogo de preparaciones (B11). Mientras B no suba data/preparaciones.json, el de data/sinteticos/ (mismos ids). */
export function preparacionCatalogo(id: string): PreparacionCatalogo | undefined {
  if (!catalogo) {
    const ruta = [['data', 'preparaciones.json'], ['data', 'sinteticos', 'preparaciones.json']]
      .map((r) => join(process.cwd(), ...r)) // vercel.json → includeFiles
      .find((r) => existsSync(r))
    const lista = ruta ? (JSON.parse(readFileSync(ruta, 'utf8')) as PreparacionCatalogo[]) : []
    catalogo = new Map(lista.map((p) => [p.id, p]))
  }
  return catalogo.get(id)
}

// ---------- Lo que completa el código ----------
// Ingredientes que casi toda receta puede necesitar (aceite, leche para pegar el pan rallado, el rebozado): se sugieren
// solo si están en el catálogo y no tienen alérgenos del chico.
const BASICOS = ['aceite_girasol', 'aceite_canola', 'leche', 'manteca', 'pan_rallado', 'queso_rallado', 'harina_trigo']

const sinAlergenos = (id: string, alergias: Alergeno[]) =>
  !esGenerico(id) && (alimentoPorId(id)?.alergenos.every((a) => !alergias.includes(a)) ?? false)

function ingredientesSugeridos(base: PreparacionCatalogo, desde: PreparacionCatalogo, alergias: Alergeno[]) {
  const ids = [...base.ingredientes, ...desde.ingredientes].map((i) => i.alimentoId).concat(BASICOS)
  return [...new Set(ids)]
    .filter((id) => sinAlergenos(id, alergias))
    .map((id) => ({ alimentoId: id, nombre: alimentoPorId(id)?.nombre ?? id }))
}

/**
 * Cuánto de lo que le falta hoy cubre una porción, con tope 1. Se usa lo que falta hoy y no la semana porque la receta es
 * una porción para una comida, y eso es lo que la familia puede cerrar con ella; el tope evita un "cubre el 180%", que no
 * dice nada (pasarse no cubre más que todo). Si hoy no falta nada (faltaHoy ≤ 0), ya está cubierto: 1.
 */
export function coberturaDeLoQueFalta(aporte: Nutrientes, evidencia: Evidencia): number {
  if (!(evidencia.faltaHoy > 0)) return 1
  return Math.round(Math.min(1, aporte[evidencia.nutriente] / evidencia.faltaHoy) * 100) / 100
}

function completar(salida: SalidaReceta, candidato: Candidato, evidencia: Evidencia): Receta {
  const ingredientes = salida.ingredientes.map(({ alimentoId, gramos }) => ({ alimentoId, nombre: alimentoPorId(alimentoId)?.nombre ?? alimentoId, gramos }))
  const aporte = calcularAporte(ingredientes) // nunca el del LLM
  return {
    nombre: salida.nombre.trim(),
    preparacionBaseId: candidato.preparacionId,
    desde: { preparacionId: candidato.desdeId, nombre: candidato.camino.desde },
    cambio: candidato.cambio,
    seMantiene: candidato.seMantiene,
    ingredientes,
    pasos: salida.pasos,
    porQue: salida.porQue,
    presentacion: salida.presentacion,
    comoOfrecer: salida.comoOfrecer,
    transparencia: salida.transparencia?.trim() || null,
    aporte,
    coberturaDeLoQueFalta: coberturaDeLoQueFalta(aporte, evidencia),
    validacion: { ok: false, problemas: [], reintentos: 0 }, // la completa generarReceta() después de validar
    evidencia,
  }
}

/** Primero el candidato pedido y después los que le seguían (así "Otra opción" en la UI no repite el que ya vio). */
function ordenar(candidatos: Candidato[], preparacionId: string | undefined): Candidato[] {
  if (!preparacionId) return candidatos
  const i = candidatos.findIndex((c) => c.preparacionId === preparacionId)
  if (i < 0) {
    throw new ErrorNibble('entrada_invalida', 'Esa opción ya no está entre las de hoy. Volvé al tablero y elegí otra.', {
      preparacionId, candidatos: candidatos.map((c) => c.preparacionId),
    })
  }
  return [...candidatos.slice(i), ...candidatos.slice(0, i)]
}

function registrar(datos: Record<string, unknown>, aviso = false) {
  const linea = JSON.stringify({ evento: 'receta', ...datos })
  if (aviso) console.warn(linea)
  else console.info(linea)
}

// ---------- Orquestación ----------
export async function generarReceta(req: RecetaReq, deps: DepsReceta): Promise<Receta> {
  const ahora = deps.ahora ?? Date.now
  const preparacion = deps.preparacion ?? preparacionCatalogo
  const t0 = ahora()
  const [evidencia, perfil] = await Promise.all([deps.armarEvidencia(req.ninoId, req.nutriente), deps.perfil(req.ninoId)])

  const descartes: { preparacionId: string; problemas: string[] }[] = []
  const sinCandidatos = () => {
    registrar({ ninoId: req.ninoId, nutriente: evidencia.nutriente, resultado: 'sin_candidatos', descartes, ms: ahora() - t0 }, true)
    return new ErrorNibble('sin_candidatos', 'Todavía no encontramos un paso chico y seguro para lo que le falta.', { descartes })
  }
  if (evidencia.candidatos.length === 0) throw sinCandidatos()
  const candidatos = ordenar(evidencia.candidatos, req.preparacionId)

  const alergias = [...new Set([...evidencia.alergias, ...perfil.datos.alergias])]
  const presentacionesAceptadas = [...new Set(perfil.preparaciones
    .filter((p) => p.estado === 'acepta')
    .flatMap((p): Presentacion[] => {
      const pr = preparacion(p.id)?.atributos.presentacion
      return pr && pr !== 'separado' ? [pr] : []
    }))]
  // El schema deja elegir cualquier alimento del catálogo, menos los genéricos y los que tienen alérgenos del chico.
  const schema = esquemaSalidaReceta(alimentos().map((a) => a.id).filter((id) => sinAlergenos(id, alergias)))
  let llamadas = 0

  for (const candidato of candidatos) {
    const desde = preparacion(candidato.desdeId)
    const base = preparacion(candidato.preparacionId)
    if (!desde || !base) {
      const falta = desde ? `la preparación ${candidato.preparacionId}` : `su alimento de partida (${candidato.desdeId})`
      descartes.push({ preparacionId: candidato.preparacionId, problemas: [`No está ${falta} en el catálogo: no se puede validar el cambio.`] })
      continue
    }
    const ctx: ContextoValidacion = { alergias, reglas: perfil.reglas, desde, base, presentacionesAceptadas }
    const previa = validarCandidato(ctx, candidato)
    if (!previa.ok) {
      descartes.push({ preparacionId: candidato.preparacionId, problemas: previa.problemas })
      continue
    }

    const ingredientes = ingredientesSugeridos(base, desde, alergias)
    let anterior: { salida: SalidaReceta; problemas: string[] } | undefined
    for (let intento = 0; intento < 2; intento++) {
      if (ahora() - t0 > TOPE_NUEVA_LLAMADA_MS) {
        registrar({ ninoId: req.ninoId, resultado: 'sin_tiempo', llamadas, descartes, ms: ahora() - t0 }, true)
        throw new ErrorNibble('timeout', 'Tardamos demasiado en armar una receta segura. ¿Probás de nuevo?', { descartes })
      }
      const { datos } = await generarJSON({
        tarea: 'receta',
        sistema: SISTEMA_RECETA,
        partes: [{ tipo: 'texto', texto: promptReceta({ evidencia, candidato, base, ingredientes, alergias, anterior }) }],
        schema,
      })
      llamadas++
      const receta = completar(datos, candidato, evidencia)
      const v = validarReceta(receta, ctx)
      if (v.ok) {
        registrar({ ninoId: req.ninoId, nutriente: evidencia.nutriente, preparacionBaseId: receta.preparacionBaseId, llamadas, descartes: descartes.length, ms: ahora() - t0 })
        // reintentos = llamadas al LLM − 1: los reintentos con problemas más los cambios de candidato (el costo extra).
        return { ...receta, validacion: { ok: true, problemas: [], reintentos: llamadas - 1 } }
      }
      anterior = { salida: datos, problemas: v.problemas }
    }
    descartes.push({ preparacionId: candidato.preparacionId, problemas: anterior?.problemas ?? [] })
  }
  throw sinCandidatos()
}
