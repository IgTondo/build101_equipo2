// Food chaining en código (PLAN.md §8): candidatos a UN solo cambio desde algo que el chico ya acepta.
import type { Alergeno, Alimento, Atributos, Cambio, Momento, Nutriente, Nutrientes, PreparacionCatalogo, Regla } from '../../shared/contratos.js'
import { CAMBIO } from '../../shared/contratos.js'
import { aporte } from '../nutricion/calcular.js'
import type { EstadoPrep } from './aceptacion.js'
import { cumple, esAtributo } from './condiciones.js'

/** Lo que se sabe de una preparación: del catálogo, de lo observado en las comidas o de lo que contó el padre. */
export interface PrepConocida {
  id: string
  nombre: string
  atributos: Partial<Atributos>
  ingredientes: { alimentoId: string; gramos: number }[]
  momentos?: Momento[] // en qué comidas se come: las del catálogo, las que contó el padre, las comidas en que se lo vio
}

/**
 * Las dimensiones que cuentan como cambio. El color no se cuenta aparte: cambia junto con el ingrediente y no
 * distinguió a los chicos con TEA (Hubbard 2014); si el chico tiene una regla de color, la aplica el filtro de reglas.
 * Orden de `seMantiene`: forma, textura, sabor, temperatura, cocción.
 */
export const DIMENSIONES = ['forma', 'textura', 'sabor', 'temperatura', 'coccion'] as const

/** Dificultad según el orden de CAMBIO (de menor a mayor): fortificar 0 … textura 6. */
export const DIFICULTAD = Object.fromEntries(CAMBIO.map((c, i) => [c, i])) as Record<Cambio, number>

/** Aporte mínimo de un candidato: el 15% del objetivo diario del nutriente, por porción. */
export const APORTE_MINIMO = 0.15
/**
 * La versión fortificada REEMPLAZA a su alimento seguro: tiene que sumar al menos el 5% del objetivo respecto de él
 * (el puré con queso suma calcio, no vitamina C; la leche con vitamina D suma vitamina D, no calcio).
 */
export const GANANCIA_MINIMA_FORTIFICAR = 0.05

export function principal(ingredientes: readonly { alimentoId: string; gramos: number }[]): string | null {
  let mejor: string | null = null
  let gramos = -Infinity
  for (const i of ingredientes) {
    if (i.gramos > gramos) {
      mejor = i.alimentoId
      gramos = i.gramos
    }
  }
  return mejor
}

/**
 * ¿Sirve de punto de partida? Solo lo que se conoce entero: las 5 dimensiones y el ingrediente principal (que no sea un
 * "otro_…" de la visión). `cambios()` no cuenta lo que falta de un lado, así que un "Sushi" contado sin forma, textura,
 * sabor ni ingredientes quedaba a "un cambio" de todo lo frío ("Leche chocolatada: se parece a su sushi"). Mejor ninguna
 * sugerencia que una relación inventada: lo incompleto no es origen hasta que se complete.
 */
export function esAncla(p: Pick<PrepConocida, 'atributos' | 'ingredientes'>): boolean {
  const pr = principal(p.ingredientes)
  return DIMENSIONES.every((d) => Boolean(p.atributos[d])) && pr !== null && !pr.startsWith('otro_')
}

/**
 * Qué dimensiones cambian entre `desde` y `cand`: textura, forma, sabor, temperatura, cocción e ingrediente
 * principal (el de más gramos). Una dimensión que falta de un lado no cuenta (por eso el origen tiene que ser un
 * ancla: `esAncla`). Si todo coincide pero los ingredientes no son los mismos (leche chocolatada → licuado de banana),
 * cuenta como cambio de ingrediente.
 */
export function cambios(desde: PrepConocida, cand: PrepConocida): Cambio[] {
  const r: Cambio[] = []
  for (const d of DIMENSIONES) {
    const a = desde.atributos[d]
    const b = cand.atributos[d]
    if (a && b && a !== b) r.push(d)
  }
  const pDesde = principal(desde.ingredientes)
  const pCand = principal(cand.ingredientes)
  if (pDesde && pCand && pDesde !== pCand) r.push('ingrediente')
  else if (r.length === 0 && pDesde && pCand) {
    const a = new Set(desde.ingredientes.map((i) => i.alimentoId))
    const b = new Set(cand.ingredientes.map((i) => i.alimentoId))
    if (a.size !== b.size || [...a].some((x) => !b.has(x))) r.push('ingrediente')
  }
  return r
}

/** Lo que se mantiene: ["forma=baston", "textura=crocante", "sabor=salado", "temperatura=caliente", "coccion=horno"]. */
export function seMantiene(desde: PrepConocida, cand: PrepConocida): string[] {
  return DIMENSIONES.flatMap((d) => {
    const v = cand.atributos[d]
    return v && desde.atributos[d] === v ? [`${d}=${v}`] : []
  })
}

/**
 * ¿Es segura para sus alergias? Ningún ingrediente con un alérgeno del chico según la tabla, ni uno de `prohibidos`
 * (los alimentos de sus alergias contadas con palabras, que no están en ALERGENO). Si algún ingrediente no está en la
 * tabla, no se puede garantizar y queda afuera; si no se saben los ingredientes, tampoco. Como respaldo, también se
 * mira el id ("huevo_revuelto"). Sin alergias ni prohibidos no hay nada que cuidar: es segura.
 */
export function esSegura(
  prep: Pick<PrepConocida, 'ingredientes'>, alergias: readonly Alergeno[], alimentos: ReadonlyMap<string, Alimento>, prohibidos?: ReadonlySet<string>,
): boolean {
  const hayProhibidos = (prohibidos?.size ?? 0) > 0
  if (alergias.length === 0 && !hayProhibidos) return true
  if (prep.ingredientes.length === 0) return false
  return prep.ingredientes.every(({ alimentoId }) => {
    if (prohibidos?.has(alimentoId)) return false
    if (alergias.length === 0) return true
    const a = alimentos.get(alimentoId)
    if (!a?.alergenos) return false
    return !a.alergenos.some((x) => alergias.includes(x)) && !alergias.some((x) => alimentoId.includes(x))
  })
}

/** La regla del padre que la preparación viola, si hay. Las reglas de contexto (plato, distribución) se aplican al servir. */
export function reglaQueViola(prep: Pick<PrepConocida, 'atributos'>, reglas: readonly Regla[]): Regla | null {
  for (const regla of reglas) {
    if (regla.condiciones.length === 0 || !regla.condiciones.every((c) => esAtributo(c.tipo))) continue
    const se = cumple(regla.condiciones, prep.atributos)
    if ((regla.efecto === 'rechaza' && se) || (regla.efecto === 'requiere' && !se)) return regla
  }
  return null
}

export interface EntradaCadena {
  catalogo: readonly PreparacionCatalogo[]
  conocidas: ReadonlyMap<string, PrepConocida> // catálogo ∪ lo observado ∪ lo que contó el padre
  estados: ReadonlyMap<string, EstadoPrep>
  alergias: readonly Alergeno[]
  prohibidos?: ReadonlySet<string> // alimentoIds de sus alergias contadas con palabras ("es alérgico al kiwi")
  reglas: readonly Regla[]
  alimentos: ReadonlyMap<string, Alimento>
  objetivo: Nutrientes
  momento?: Momento // v5.2 · la comida para la que se sugiere: el origen también tiene que ir en esa comida
}

export interface PasoCadena {
  cand: PreparacionCatalogo
  desde: PrepConocida
  estadoDesde: EstadoPrep
  cambio: Cambio
  seMantiene: string[]
  aporte: Nutrientes // por porción
}

/**
 * A igual dificultad, el origen que más se parece al candidato: el mismo ingrediente principal pesa más que todo lo
 * demás y después cuenta cada ingrediente compartido. Si come milanesa y pizza, la milanesa con huevo viene de su
 * milanesa, no de su pizza.
 */
function afinidad(desde: PrepConocida, cand: PrepConocida): number {
  const mismo = principal(desde.ingredientes) === principal(cand.ingredientes) ? 100 : 0
  const ids = new Set(desde.ingredientes.map((i) => i.alimentoId))
  return mismo + cand.ingredientes.filter((i) => ids.has(i.alimentoId)).length
}

/**
 * Un candidato entra si: está a 1 cambio de algo que acepta (o es su versión fortificada); se sirve separado (salvo
 * que ya acepte lo mezclado o con salsa); no tiene alérgenos del chico ni viola una regla; aporta al menos el 15%
 * del objetivo diario del nutriente, y más que su origen; y no es algo que ya acepta o que rechazó después de 10
 * exposiciones. El origen es un ancla (`esAncla`: se conoce entero), es seguro para sus alergias y, con `momento`, va
 * en esa comida. Si el chico acepta la base de una versión fortificada, el único origen posible es esa base. Para cada
 * candidato queda el camino más fácil (menor dificultad del cambio; a igualdad, el origen más parecido y después el
 * alimento seguro más aceptado).
 */
export function candidatosCadena(e: EntradaCadena, nutriente: Nutriente): PasoCadena[] {
  const aceptadas = [...e.estados.values()].flatMap((s) => {
    const prep = s.estado === 'acepta' ? e.conocidas.get(s.prepId) : undefined
    return prep ? [{ s, prep }] : []
  })
  // Lo mezclado y con salsa se miran con todo lo que acepta, aunque no sirva de origen
  const aceptaMezclado = aceptadas.some((d) => d.prep.atributos.presentacion === 'mezclado')
  const aceptaSalsa = aceptadas.some((d) => d.prep.atributos.presentacion === 'con_salsa')
  const delCatalogo = new Map(e.catalogo.map((p) => [p.id, p]))
  const vaEnLaComida = (p: PrepConocida) => !e.momento || (p.momentos ?? delCatalogo.get(p.id)?.momentos ?? []).includes(e.momento)
  const desdes = aceptadas
    .filter((d) => esAncla(d.prep) && esSegura(d.prep, e.alergias, e.alimentos, e.prohibidos) && vaEnLaComida(d.prep))
    .map((d) => ({ ...d, aporte: aporte(d.prep.ingredientes, e.alimentos).nutrientes[nutriente] }))
  const minimo = APORTE_MINIMO * e.objetivo[nutriente]
  const pasos: PasoCadena[] = []
  for (const cand of e.catalogo) {
    const estado = e.estados.get(cand.id)
    if (estado && estado.estado !== 'en_proceso') continue
    const pres = cand.atributos.presentacion
    if (pres === 'mezclado' && !aceptaMezclado) continue
    if (pres === 'con_salsa' && !aceptaSalsa) continue
    if (!esAncla(cand) || !esSegura(cand, e.alergias, e.alimentos, e.prohibidos) || reglaQueViola(cand, e.reglas)) continue
    const aporteCand = aporte(cand.ingredientes, e.alimentos).nutrientes
    if (!(aporteCand[nutriente] >= minimo && aporteCand[nutriente] > 0)) continue
    // La leche fortificada, si ya toma la común, es SU leche fortificada: no "un cambio de ingrediente" desde el licuado
    const baseAceptada = cand.fortificadaDe !== undefined && e.estados.get(cand.fortificadaDe)?.estado === 'acepta'
    let mejor: { paso: PasoCadena; afinidad: number } | null = null
    for (const d of desdes) {
      if (d.prep.id === cand.id) continue
      if (baseAceptada && d.prep.id !== cand.fortificadaDe) continue
      let cambio: Cambio | null = null
      if (cand.fortificadaDe === d.prep.id) {
        if (aporteCand[nutriente] - d.aporte >= GANANCIA_MINIMA_FORTIFICAR * e.objetivo[nutriente]) cambio = 'fortificar'
      } else if (aporteCand[nutriente] > d.aporte) {
        // Un paso tiene que sumar del nutriente: si aporta lo mismo o menos que lo que ya come, no es "más nutritiva"
        const cs = cambios(d.prep, cand)
        if (cs.length === 1) cambio = cs[0] ?? null
      }
      if (!cambio) continue
      const paso: PasoCadena = { cand, desde: d.prep, estadoDesde: d.s, cambio, seMantiene: seMantiene(d.prep, cand), aporte: aporteCand }
      const af = afinidad(d.prep, cand)
      const dif = DIFICULTAD[paso.cambio] - (mejor ? DIFICULTAD[mejor.paso.cambio] : 0)
      if (
        !mejor ||
        dif < 0 ||
        (dif === 0 &&
          (af > mejor.afinidad ||
            (af === mejor.afinidad &&
              (paso.estadoDesde.p > mejor.paso.estadoDesde.p ||
                (paso.estadoDesde.p === mejor.paso.estadoDesde.p && paso.estadoDesde.veces > mejor.paso.estadoDesde.veces)))))
      ) {
        mejor = { paso, afinidad: af }
      }
    }
    if (mejor) pasos.push(mejor.paso)
  }
  return pasos
}
