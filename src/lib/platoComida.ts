// El plato de una comida (PLAN v5.3, §5.3): lo seguro (1 a 3) + un pasito (0 o 1), con una línea de qué cubre.
// Lo arma B (Progreso.plato con ?momento=); acá solo se decide qué muestra la tarjeta y con qué palabras.
// Funciones puras (sin React), testeadas en platoComida.test.ts.
//
// La tarjeta tiene cuatro formas:
// - plato: vino Progreso.plato para esa comida y trae algo (lo seguro, el pasito o los dos).
// - vacio: vino el plato, pero sin nada para esa comida (nunca se inventa: la pantalla lo dice con calma).
// - sugerencia: no vino el plato (B todavía no lo arma, o el fixture): la sugerencia sola de la v5.2.
// - sin_idea: tampoco hay sugerencia que encaje con esa comida.
import type { Momento, Nutriente, PlatoComida, Progreso, Receta, Sugerencia } from '../../shared/contratos'
import { elegirSugerencia, lineaPorQue, rutaRecetaComida, type ComidaPlan, type ProximaComida } from './proximaComida'
import { NOMBRE_MOMENTO } from './vocabulario'

// ---------- Palabras ----------

/** "el desayuno" · "la merienda" */
export const LA_COMIDA: Record<ComidaPlan, string> = {
  desayuno: 'el desayuno', almuerzo: 'el almuerzo', merienda: 'la merienda', cena: 'la cena',
}
const DE_LA = (m: ComidaPlan) => (m === 'merienda' || m === 'cena' ? `de ${LA_COMIDA[m]}` : `d${LA_COMIDA[m]}`)

/** "Para la cena" · "Para mañana: desayuno" */
export function etiquetaComida(momento: ComidaPlan, proxima: Pick<ProximaComida, 'momento' | 'manana'>): string {
  if (pasoHoy(momento, proxima)) return `Para mañana: ${NOMBRE_MOMENTO[momento].toLocaleLowerCase('es')}`
  return `Para ${LA_COMIDA[momento]}`
}

// Lugar en el día para saber si una comida ya pasó. La merienda cuenta junto con la cena: la secuencia automática la
// saltea (después del almuerzo la próxima es la cena), así que elegirla a la tarde es la de hoy, no la de mañana.
const LUGAR: Record<ComidaPlan, number> = { desayuno: 0, almuerzo: 1, merienda: 2, cena: 2 }

/** ¿Esa comida ya pasó hoy? (es anterior a la próxima comida calculada). */
export function pasoHoy(momento: ComidaPlan, proxima: Pick<ProximaComida, 'momento' | 'manana'>): boolean {
  const lugarProxima = proxima.manana ? 3 : LUGAR[proxima.momento]
  return LUGAR[momento] < lugarProxima
}

/** "Después de la cena, sacale una foto y contanos cómo le fue." */
export function lineaDespues(momento: ComidaPlan): string {
  return `Después ${DE_LA(momento)}, sacale una foto y contanos cómo le fue.`
}

/** "Todavía no tenemos algo para la merienda. Registrá comidas y van a aparecer ideas." */
export function lineaVacio(momento: ComidaPlan): string {
  return `Todavía no tenemos algo para ${LA_COMIDA[momento]}. Registrá comidas y van a aparecer ideas.`
}

/** "el calcio" · "la vitamina D" · "el omega-3" (null: la energía no tiene meta, §1). */
const EL_NUTRIENTE: Record<Nutriente, string | null> = {
  energia_kcal: null, proteina_g: 'la proteína', calcio_mg: 'el calcio', vitamina_d_ug: 'la vitamina D',
  hierro_mg: 'el hierro', fibra_g: 'la fibra', omega3_g: 'el omega-3', b12_ug: 'la vitamina B12',
  vitamina_c_mg: 'la vitamina C',
}

/**
 * Cuánto cubre el plato, en palabras y nunca en porcentaje (v5.2: ningún número pasa de 100%):
 * ≥ 1 todo · ≥ 0,5 la mitad o más · ≥ 0,25 una parte · > 0 un poco. Si no cubre nada (o no se sabe), null: no se dice.
 */
export function cubreEnPalabras(cubre: number, nutriente: Nutriente): string | null {
  const el = EL_NUTRIENTE[nutriente]
  if (!el || !Number.isFinite(cubre) || cubre <= 0) return null
  if (cubre >= 1) return `Cubre ${el.startsWith('la ') ? 'toda' : 'todo'} ${el} que le falta hoy.`
  const cuanto = cubre >= 0.5 ? 'la mitad o más' : cubre >= 0.25 ? 'una parte' : 'un poco'
  const del = el.startsWith('el ') ? `del ${el.slice(3)}` : `de ${el}`
  return `Cubre ${cuanto} ${del} que le falta hoy.`
}

/**
 * El nombre para una fila de la tarjeta: sin lo que va entre paréntesis ni la aclaración después de la coma
 * ("Milanesa de carne al horno (rebozada sin huevo)" → "Milanesa de carne al horno"; "Papas al horno en bastones,
 * crocantes" → "Papas al horno en bastones"). Lo seguro es lo que la familia ya prepara: el detalle está en la receta.
 */
export function nombreCorto(nombre: string): string {
  const corto = nombre.replace(/\s*\([^)]*\)/g, '').split(',')[0].trim()
  return corto || nombre.trim()
}

// ---------- El modelo de la tarjeta ----------

export interface PasitoTarjeta {
  nombre: string
  /** La receta del pasito, para esa comida y ese nutriente. */
  receta: string
  /** La misma receta, abierta en la imagen del plato completo. */
  servir: string
}

export type ModeloTarjeta =
  | { tipo: 'plato'; seguros: { id: string; nombre: string }[]; pasito: PasitoTarjeta | null; cubre: string | null }
  | { tipo: 'vacio'; texto: string }
  | { tipo: 'sugerencia'; nombre: string; porQue: string | null; receta: string | null }
  | { tipo: 'sin_idea'; texto: string }

type ProgresoTarjeta = Pick<Progreso, 'plato' | 'sugerencias' | 'proximoPaso' | 'momento' | 'semana'>

/** ¿Hay plato para esa comida? (si vino para otra, no sirve: la pantalla vuelve a pedir). */
export function platoDe(p: Pick<Progreso, 'plato'>, momento: Momento): PlatoComida | null {
  return p.plato && p.plato.momento === momento ? p.plato : null
}

/** Qué muestra la tarjeta de esa comida: el plato si vino, si no la sugerencia sola (v5.2). */
export function modeloTarjeta(ninoId: string, p: ProgresoTarjeta, momento: ComidaPlan): ModeloTarjeta {
  const plato = platoDe(p, momento)
  if (plato) {
    const seguros = plato.seguros.slice(0, 3).map((s) => ({ id: s.preparacionId, nombre: nombreCorto(s.nombre) }))
    if (!seguros.length && !plato.pasito) return { tipo: 'vacio', texto: lineaVacio(momento) }
    const pasito = plato.pasito ? {
      nombre: nombreCorto(plato.pasito.nombre),
      receta: rutaRecetaComida(ninoId, plato.pasito, momento, plato.nutriente),
      servir: rutaRecetaComida(ninoId, plato.pasito, momento, plato.nutriente, 'plato'),
    } : null
    return { tipo: 'plato', seguros, pasito, cubre: cubreEnPalabras(plato.cubre, plato.nutriente) }
  }

  const s = elegirSugerencia(p, momento)
  if (!s) return { tipo: 'sin_idea', texto: lineaVacio(momento) }
  const nutriente = p.semana.faltan.find((n) => n !== 'energia_kcal')
  return {
    tipo: 'sugerencia',
    nombre: s.nombre,
    porQue: s.porQue ? lineaPorQue(s.porQue) : null,
    // Una sugerencia "segura" (algo que ya come) no abre receta.
    receta: s.tipo === 'segura' ? null : rutaRecetaComida(ninoId, s, momento, nutriente),
  }
}

// ---------- La imagen del plato completo ----------

/** El preparacionId con el que se pide la receta del pasito (el del candidato, si vino). */
const idPasito = (s: Sugerencia) => s.candidato?.preparacionId ?? s.preparacionId

/**
 * El plato para dibujar junto con la receta: solo si la receta es la de su pasito. Si el padre pidió "Otra opción",
 * la receta ya no es la del plato y la imagen vuelve a ser la del pasito solo.
 */
export function platoParaImagen(plato: PlatoComida | null | undefined, receta: Pick<Receta, 'preparacionBaseId'>): PlatoComida | undefined {
  if (!plato?.pasito || idPasito(plato.pasito) !== receta.preparacionBaseId) return undefined
  return plato
}

/** El texto alternativo de la imagen del plato: "Milanesa y papas, y al costado, en porción chica, bastones de queso". */
export function altPlato(plato: PlatoComida, nombreReceta: string): string {
  const seguros = plato.seguros.map((s) => nombreCorto(s.nombre))
  const lista = seguros.length <= 1 ? seguros.join('') : `${seguros.slice(0, -1).join(', ')} y ${seguros.at(-1)!.toLocaleLowerCase('es')}`
  const pasito = nombreCorto(nombreReceta).toLocaleLowerCase('es')
  return lista ? `El plato: ${lista}; al costado, en porción chica, ${pasito}.` : `El plato: ${pasito}, en porción chica.`
}
