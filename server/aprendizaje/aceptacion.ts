// Aceptación por preparación, exposiciones y α/β por atributo (PLAN.md §8). Funciones puras sobre el bronze.
import type { Atributos, Cuanto, Motivo, PerfilBorrador, Progreso } from '../../shared/contratos.js'
import type { ComidaDoc } from '../datos/tipos.js'
import { type Observacion, TIPOS_ATRIBUTO } from './condiciones.js'
import { O, comio, mejorPaso } from './escalera.js'
import { slug } from './textos.js'

export const CONFIG_ACEPTACION = {
  peso: 0.3, // p ← p + 0,3·(o − p): más peso a lo reciente (el perfil cambia con los años)
  inicialAcepta: 0.8, // lo que el padre dijo que acepta
  inicialRechaza: 0.1, // lo que dijo que rechaza
  inicialNuevo: 0.5,
  umbralAcepta: 0.6,
  minVecesAcepta: 2,
  umbralRechaza: 0.2,
  minVecesRechaza: 10, // el research habla de 8 a 15 exposiciones: antes, queda en proceso
}
export type ConfigAceptacion = typeof CONFIG_ACEPTACION
export type EstadoAceptacion = 'acepta' | 'en_proceso' | 'rechaza'

export interface EstadoPrep {
  prepId: string
  nombre: string
  p: number
  veces: number
  declarada: 'acepta' | 'rechaza' | null // lo que contó el padre en el perfil
  motivoDeclarado?: Motivo
  estado: EstadoAceptacion
  pasos: Cuanto[] // en orden
  mejorPaso: Cuanto | null
  comio: number // veces en el escalón "comió" (todo, la mitad o un poco)
  primeraISO: string | null
  ultimaISO: string | null
}

/**
 * `acepta` si p ≥ 0,6 y veces ≥ 2 (o si el padre dijo que lo come); `rechaza` solo si p < 0,2 y veces ≥ 10.
 * Lo que el padre dijo que rechaza se muestra como rechazo hasta que se ofrece por primera vez; desde ahí, es una
 * exposición más. Un rechazo no descarta la preparación.
 */
export function estadoDe(
  p: number,
  veces: number,
  declarada: EstadoPrep['declarada'],
  cfg: ConfigAceptacion = CONFIG_ACEPTACION,
): EstadoAceptacion {
  if (declarada === 'rechaza' && veces === 0) return 'rechaza'
  if (p >= cfg.umbralAcepta && (veces >= cfg.minVecesAcepta || declarada === 'acepta')) return 'acepta'
  if (p < cfg.umbralRechaza && veces >= cfg.minVecesRechaza) return 'rechaza'
  return 'en_proceso'
}

function nuevoEstado(prepId: string, nombre: string, p: number, declarada: EstadoPrep['declarada'], cfg: ConfigAceptacion): EstadoPrep {
  return {
    prepId, nombre, p, veces: 0, declarada, estado: estadoDe(p, 0, declarada, cfg),
    pasos: [], mejorPaso: null, comio: 0, primeraISO: null, ultimaISO: null,
  }
}

/** Valor inicial (§8): lo que acepta 0,8; lo que rechaza 0,1; lo nuevo, 0,5. */
export function estadosIniciales(borrador: PerfilBorrador, cfg: ConfigAceptacion = CONFIG_ACEPTACION): Map<string, EstadoPrep> {
  const estados = new Map<string, EstadoPrep>()
  for (const r of borrador.rechaza) {
    const id = r.preparacionId ?? slug(r.nombre)
    estados.set(id, { ...nuevoEstado(id, r.nombre, cfg.inicialRechaza, 'rechaza', cfg), motivoDeclarado: r.motivo })
  }
  for (const a of borrador.acepta) {
    const id = a.preparacionId ?? slug(a.nombre)
    estados.set(id, nuevoEstado(id, a.nombre, cfg.inicialAcepta, 'acepta', cfg))
  }
  return estados
}

export function ordenarComidas<T extends Pick<ComidaDoc, 'fechaISO' | 'creadoISO'>>(comidas: readonly T[]): T[] {
  return [...comidas].sort((a, b) => Date.parse(a.fechaISO) - Date.parse(b.fechaISO) || a.creadoISO.localeCompare(b.creadoISO))
}

/**
 * Recorre las comidas en orden y actualiza la aceptación ítem por ítem. Devuelve también las observaciones,
 * con `juntoASeguro` calculado con el estado de antes de cada comida.
 */
export function procesarHistorial(
  comidas: readonly ComidaDoc[],
  borrador: PerfilBorrador,
  cfg: ConfigAceptacion = CONFIG_ACEPTACION,
): { estados: Map<string, EstadoPrep>; observaciones: Observacion[] } {
  const estados = estadosIniciales(borrador, cfg)
  const observaciones: Observacion[] = []
  for (const c of ordenarComidas(comidas)) {
    const seguras = c.items.filter((it) => estados.get(it.preparacionId)?.estado === 'acepta').map((it) => it.preparacionId)
    for (const it of c.items) {
      if (it.cuanto === null) continue
      const o = O[it.cuanto]
      observaciones.push({
        comidaId: c._id, prepId: it.preparacionId, nombre: it.nombre, atributos: it.atributos,
        contexto: { distribucion: c.distribucion, plato: c.plato, momento: c.momento, juntoASeguro: seguras.some((id) => id !== it.preparacionId) },
        o, cuanto: it.cuanto, ...(it.motivo ? { motivo: it.motivo } : {}), fechaISO: c.fechaISO, dia: c.dia,
      })
      const e = estados.get(it.preparacionId) ?? nuevoEstado(it.preparacionId, it.nombre, cfg.inicialNuevo, null, cfg)
      e.p += cfg.peso * (o - e.p)
      e.veces += 1
      e.pasos.push(it.cuanto)
      e.mejorPaso = mejorPaso(e.mejorPaso, it.cuanto)
      if (comio(it.cuanto)) e.comio += 1
      e.primeraISO ??= c.fechaISO
      e.ultimaISO = c.fechaISO
      e.estado = estadoDe(e.p, e.veces, e.declarada, cfg)
      estados.set(it.preparacionId, e)
    }
  }
  return { estados, observaciones }
}

// ---------- α/β por atributo: la base de comparación (§8 y §11.4) ----------
export interface AlfaBeta {
  alfa: number
  beta: number
  p: number
}

/** Prior 1/1; α += o, β += 1 − o; p = α / (α + β). Clave: "textura:crocante". */
export function alfaBeta(observaciones: readonly Observacion[]): Map<string, AlfaBeta> {
  const ab = new Map<string, AlfaBeta>()
  for (const x of observaciones) {
    for (const tipo of TIPOS_ATRIBUTO) {
      const valor = x.atributos[tipo]
      if (!valor) continue
      const k = `${tipo}:${valor}`
      const a = ab.get(k) ?? { alfa: 1, beta: 1, p: 0.5 }
      a.alfa += x.o
      a.beta += 1 - x.o
      a.p = a.alfa / (a.alfa + a.beta)
      ab.set(k, a)
    }
  }
  return ab
}

/** La aceptación que predice la base para una preparación: el promedio de p de sus atributos (0,5 si no hay datos). */
export function pAtributos(ab: ReadonlyMap<string, AlfaBeta>, atributos: Partial<Atributos>): number {
  const ps = TIPOS_ATRIBUTO.flatMap((tipo) => {
    const valor = atributos[tipo]
    return valor ? [ab.get(`${tipo}:${valor}`)?.p ?? 0.5] : []
  })
  return ps.length ? ps.reduce((a, b) => a + b, 0) / ps.length : 0.5
}

// ---------- Exposiciones en curso (§1) ----------
export function exposiciones(estados: ReadonlyMap<string, EstadoPrep>): Progreso['exposiciones'] {
  return [...estados.values()]
    .flatMap((e) =>
      e.estado === 'en_proceso' && e.veces > 0 && e.mejorPaso && e.ultimaISO
        ? [{ preparacionId: e.prepId, nombre: e.nombre, veces: e.veces, mejorPaso: e.mejorPaso, ultimaISO: e.ultimaISO }]
        : [],
    )
    .sort((a, b) => Date.parse(b.ultimaISO) - Date.parse(a.ultimaISO))
}
