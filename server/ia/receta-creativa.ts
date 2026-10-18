// v5.4 · Receta creativa (PLAN §7 y §9, "Generar receta"): /api/receta sin preparacionId. El grafo arma la base de
// conocimiento del chico y sortea un foco (armarConocimiento, server/grafo/conocimiento.ts) → el LLM inventa un plato
// nuevo a UN cambio de un alimento seguro (prompts/receta-creativa.ts) → el código arma la preparación con los atributos
// y los ingredientes que declaró, cuenta los cambios con cadena.ts y valida como la receta del catálogo
// (validacion/receta.ts), más el aporte mínimo, que no sea algo que ya come y que no repita una receta que ya vio
// → si falla, 1 reintento con los problemas → si sigue mal, ErrorNibble('sin_candidatos'): otro pedido sortea otro foco.
import type { Alergeno, Evidencia, Nutriente, PreparacionCatalogo, Receta, RecetaReq } from '../../shared/contratos.js'
import { DIMENSIONES, cambios } from '../aprendizaje/cadena.js'
import { NOMBRE_NUTRIENTE, decimal, slug } from '../aprendizaje/textos.js'
import type { Conocimiento } from '../grafo/conocimiento.js'
import { ErrorNibble } from '../http.js'
import { calcularAporte, cambiosEntre, problemasPorTipo, aplanar, type ContextoValidacion } from '../validacion/receta.js'
import { alimentoPorId, alimentos } from './catalogo.js'
import { generarJSON } from './modelo.js'
import { esquemaSalidaCreativa, promptRecetaCreativa, SISTEMA_RECETA_CREATIVA, type SalidaCreativa } from './prompts/receta-creativa.js'
import { CORTE_MS, TOPE_NUEVA_LLAMADA_MS, coberturaDeLoQueFalta, sinAlergenos, type IntentoReceta } from './receta.js'

export interface DepsRecetaCreativa {
  conocimiento: (ninoId: string, op: { nutriente?: Nutriente; momento?: RecetaReq['momento'] }) => Promise<Conocimiento>
  ahora?: () => number
  alIntentar?: (intento: Omit<IntentoReceta, 'salida' | 'problemas'> & { salida: SalidaCreativa; problemas: string[] }) => void
}

/** Lo que pide su dieta cuenta como alergia para validar (sin gluten ni caseína = sin gluten ni leche). */
function alergiasDe(k: Conocimiento): Alergeno[] {
  return [...new Set<Alergeno>([...k.alergias, ...(k.dieta === 'sin_gluten_caseina' ? (['gluten', 'leche'] as const) : [])])]
}

const normal = (s: string) => slug(s).replace(/_/g, ' ')

/** El plato que inventó el LLM, como una preparación más (no está en el catálogo: el id empieza con "nuevo_"). */
export function platoDe(salida: SalidaCreativa): PreparacionCatalogo {
  return {
    id: `nuevo_${slug(salida.nombre).slice(0, 60) || 'plato'}`,
    nombre: salida.nombre.trim(),
    atributos: salida.atributos,
    ingredientes: salida.ingredientes.map(({ alimentoId, gramos }) => ({ alimentoId, gramos })),
  }
}

/** La receta completa: el cambio y lo que se mantiene los cuenta el código (cadena.ts), nunca el LLM. */
export function completarCreativa(salida: SalidaCreativa, k: Conocimiento, desde: PreparacionCatalogo): Receta {
  const base = platoDe(salida)
  const n = salida.nutriente
  const opcion = k.nutrientes.find((x) => x.nutriente === n) ?? k.nutrientes[0]!
  const difs = cambiosEntre(desde, base)
  const ingredientes = salida.ingredientes.map(({ alimentoId, gramos }) => ({ alimentoId, nombre: alimentoPorId(alimentoId)?.nombre ?? alimentoId, gramos }))
  const aporte = calcularAporte(ingredientes)
  const evidencia: Evidencia = {
    nutriente: n,
    coberturaSemana: opcion.coberturaSemana,
    faltaHoy: opcion.faltaHoy,
    candidatos: [],
    reglas: k.reglas.map((r) => r.texto),
    alergias: k.alergias,
    texto: k.texto,
  }
  return {
    nombre: base.nombre,
    preparacionBaseId: base.id,
    desde: { preparacionId: desde.id, nombre: desde.nombre },
    cambio: difs[0]?.cambio ?? 'ingrediente',
    seMantiene: DIMENSIONES.flatMap((dim) => {
      const v = desde.atributos[dim]
      return v && v === base.atributos[dim] ? [`${dim}=${v}`] : []
    }),
    ingredientes,
    pasos: salida.pasos,
    porQue: salida.porQue,
    presentacion: salida.presentacion,
    comoOfrecer: salida.comoOfrecer,
    transparencia: salida.transparencia?.trim() || null,
    aporte,
    coberturaDeLoQueFalta: coberturaDeLoQueFalta(aporte, evidencia),
    validacion: { ok: false, problemas: [], reintentos: 0 },
    evidencia,
    plato: { atributos: salida.atributos, imagen: salida.imagen },
  }
}

/** Lo que valida la receta del catálogo, más lo propio de un plato inventado. */
export function problemasCreativa(receta: Receta, k: Conocimiento, desde: PreparacionCatalogo, anteriores: readonly string[]): string[] {
  const base: PreparacionCatalogo = { id: receta.preparacionBaseId, nombre: receta.nombre, atributos: receta.plato!.atributos, ingredientes: receta.ingredientes }
  const ctx: ContextoValidacion = { alergias: alergiasDe(k), reglas: k.reglas, desde, base, presentacionesAceptadas: k.presentacionesAceptadas }
  const p = aplanar(problemasPorTipo(receta, ctx))
  const n = receta.evidencia.nutriente
  const minimo = k.nutrientes.find((x) => x.nutriente === n)?.minimo ?? 0
  if (receta.aporte[n] < minimo) {
    const ricos = k.nutrientes.find((x) => x.nutriente === n)?.ricos.slice(0, 4).map((r) => r.alimentoId) ?? []
    p.push(`La porción aporta ${decimal(receta.aporte[n], 1)} de ${NOMBRE_NUTRIENTE[n]} y el mínimo es ${decimal(minimo, 1)}: subí los gramos de un ingrediente rico en ${NOMBRE_NUTRIENTE[n]} (${ricos.join(', ')}) o elegí otro plato.`)
  }
  const igual = k.seguros.find((s) => s.id !== desde.id && cambios(s, base).length === 0)
  if (igual) p.push(`«${receta.nombre}» es lo mismo que «${igual.nombre}», que ya come: proponé un plato nuevo.`)
  if (anteriores.some((a) => normal(a) === normal(receta.nombre))) p.push(`«${receta.nombre}» ya lo vio la familia: proponé un plato distinto.`)
  return p
}

function registrar(datos: Record<string, unknown>, aviso = false) {
  const linea = JSON.stringify({ evento: 'receta_creativa', ...datos })
  if (aviso) console.warn(linea)
  else console.info(linea)
}

export async function generarRecetaCreativa(req: RecetaReq, deps: DepsRecetaCreativa): Promise<Receta> {
  const ahora = deps.ahora ?? Date.now
  const t0 = ahora()
  const k = await deps.conocimiento(req.ninoId, { ...(req.nutriente ? { nutriente: req.nutriente } : {}), ...(req.momento ? { momento: req.momento } : {}) })
  if (k.seguros.length === 0) {
    throw new ErrorNibble('sin_candidatos', 'Todavía no sabemos qué come seguro: registrá algunas comidas y aparecen recetas.')
  }
  const anteriores = (req.anteriores ?? []).slice(-10)
  const alergias = alergiasDe(k)
  const ingredientes = alimentos().filter((a) => sinAlergenos(a.id, alergias)).map((a) => ({ alimentoId: a.id, nombre: a.nombre }))
  const schema = esquemaSalidaCreativa(ingredientes.map((i) => i.alimentoId), k.seguros.map((s) => s.id), k.nutrientes.map((x) => x.nutriente))

  let anterior: { salida: SalidaCreativa; problemas: string[] } | undefined
  for (let intento = 0; intento < 2; intento++) {
    if (ahora() - t0 > TOPE_NUEVA_LLAMADA_MS) {
      registrar({ ninoId: req.ninoId, resultado: 'sin_tiempo', intento, ms: ahora() - t0 }, true)
      throw new ErrorNibble('timeout', 'Tardamos demasiado en armar una receta segura. ¿Probás de nuevo?')
    }
    const desdeLlamada = ahora()
    const { datos } = await generarJSON({
      tarea: 'receta',
      sistema: SISTEMA_RECETA_CREATIVA,
      partes: [{ tipo: 'texto', texto: promptRecetaCreativa({ conocimiento: k, ingredientes, anteriores, ...(anterior ? { anterior } : {}) }) }],
      schema,
      limiteMs: CORTE_MS - (desdeLlamada - t0),
    })
    const desde = k.seguros.find((s) => s.id === datos.desdeId)!
    const receta = completarCreativa(datos, k, desde)
    const problemas = problemasCreativa(receta, k, desde, anteriores)
    deps.alIntentar?.({ llamada: intento + 1, preparacionId: receta.preparacionBaseId, reintento: intento > 0, salida: datos, problemas, ms: ahora() - desdeLlamada })
    if (problemas.length === 0) {
      registrar({ ninoId: req.ninoId, nombre: receta.nombre, desde: desde.id, cambio: receta.cambio, nutriente: receta.evidencia.nutriente, foco: k.foco, llamadas: intento + 1, ms: ahora() - t0 })
      return { ...receta, validacion: { ok: true, problemas: [], reintentos: intento } }
    }
    anterior = { salida: datos, problemas }
  }
  registrar({ ninoId: req.ninoId, resultado: 'no_paso', foco: k.foco, problemas: anterior?.problemas, ms: ahora() - t0 }, true)
  throw new ErrorNibble('sin_candidatos', 'Esta vez no salió una receta segura. Probá otra idea.', { problemas: anterior?.problemas ?? [] })
}
