// El plato de una comida (PLAN.md §5.3): lo seguro (lo que ya acepta, para esa comida) + un pasito (un solo alimento
// nuevo, en porción chica). Función pura, sin LLM y sin I/O: usa lo que el recomendador ya tiene armado.
import type {
  CoberturaDia, Grupo, ItemPlato, Momento, Nutriente, Nutrientes, PlatoComida, PreparacionCatalogo, Sugerencia,
} from '../../shared/contratos.js'
import { aporte, escalar, redondearParcial } from '../nutricion/calcular.js'
import type { EstadoPrep } from './aceptacion.js'
import { type EntradaCadena, esSegura, reglaQueViola } from './cadena.js'
import { FACTOR_PORCION } from './escalera.js'
import { esParaMomento, menorCobertura } from './recomendador.js'
import { DEL_NUTRIENTE, NOMBRE_NUTRIENTE } from './textos.js'

export interface EntradaPlato extends EntradaCadena {
  momento: Momento
  faltan: readonly Nutriente[] // de la semana, en el orden de prioridad de §1
  coberturaSemana: Nutrientes
  /** El día de hoy (`Progreso.dias`); sin comidas hoy (o sin entrada), el nutriente sale de la semana. */
  hoy?: Pick<CoberturaDia, 'consumido' | 'faltan' | 'comidas'>
  /** Las preparaciones de la última comida de ese momento: si lo seguro se repite entero, rota uno. */
  ultima?: readonly string[]
  /** Las sugerencias que el recomendador ya armó para ese momento (segura, un_paso, mas_nutritiva). */
  sugerencias: readonly Sugerencia[]
}

/** Comidas fuertes: con buenas opciones, el plato lleva hasta 3 seguros (una proteína, un almidón, una verdura…). */
export const COMIDA_FUERTE: readonly Momento[] = ['almuerzo', 'cena']
export const MAX_SEGUROS_FUERTE = 3
export const MAX_SEGUROS = 2
/** Lo que se dice "aporta calcio" en el porqué de un seguro: al menos el 10% del objetivo del día por porción. */
const APORTE_DESTACADO = 0.1
/** "Un pasito hacia el calcio" si el pasito, en porción chica, aporta al menos el 5% del objetivo del día. */
const APORTE_PASITO = 0.05
/** Para no dividir por cero cuando hoy ya casi no le falta nada de ese nutriente. */
const EPSILON = 1e-6

export const PARA_MOMENTO: Record<Momento, string> = {
  desayuno: 'para el desayuno', almuerzo: 'para el almuerzo', merienda: 'para la merienda', cena: 'para la cena',
  colacion: 'para la colación',
}
const DE_LA_ULTIMA: Record<Momento, string> = {
  desayuno: 'el último desayuno', almuerzo: 'el último almuerzo', merienda: 'la última merienda', cena: 'la última cena',
  colacion: 'la última colación',
}

/** "el calcio", "la vitamina D". */
const EL_NUTRIENTE = (n: Nutriente): string => DEL_NUTRIENTE[n].replace(/^del /, 'el ').replace(/^de la /, 'la ')

interface Opcion {
  prep: PreparacionCatalogo
  s: EstadoPrep
  grupo: Grupo
  ap: Nutrientes // por porción mediana
  valor: number // p × aporte al nutriente ÷ objetivo
}

/** El nutriente del plato: el que más le falta hoy; sin comidas hoy, el de la semana (como el recomendador). */
export function nutrienteDelPlato(e: Pick<EntradaPlato, 'hoy' | 'faltan' | 'coberturaSemana'>): Nutriente {
  const hoy = e.hoy && e.hoy.comidas.length > 0 ? e.hoy.faltan[0] : undefined
  return hoy ?? e.faltan[0] ?? menorCobertura(e.coberturaSemana)
}

/**
 * Lo seguro que sirve para esa comida: en `acepta`, del catálogo con ese momento anotado, sin alérgenos del chico y sin
 * violar una regla suya. Ordenado por p × aporte al nutriente (porción mediana), después p y el id.
 */
export function opcionesSeguras(e: EntradaPlato, n: Nutriente): Opcion[] {
  const catalogo = new Map(e.catalogo.map((p) => [p.id, p]))
  const factor = FACTOR_PORCION.mediana
  const opciones: Opcion[] = []
  for (const s of e.estados.values()) {
    const prep = catalogo.get(s.prepId)
    if (s.estado !== 'acepta' || !prep || !esParaMomento(prep, e.momento)) continue
    if (!esSegura(prep, e.alergias, e.alimentos) || reglaQueViola(prep, e.reglas)) continue
    const ap = escalar(aporte(prep.ingredientes, e.alimentos).nutrientes, factor)
    const valor = s.p * (e.objetivo[n] > 0 ? ap[n] / e.objetivo[n] : 0)
    opciones.push({ prep, s, grupo: prep.atributos.grupo, ap, valor })
  }
  return opciones.sort((a, b) => b.valor - a.valor || b.s.p - a.s.p || a.prep.id.localeCompare(b.prep.id))
}

/**
 * Variado: primero uno por grupo (de mejor a peor), hasta el tamaño de la comida; en una comida fuerte el tercero entra
 * solo si es de otro grupo. Si hay un solo grupo, igual van 2 (nunca 3 del mismo grupo).
 */
function elegirVariado(opciones: readonly Opcion[], momento: Momento): Opcion[] {
  const max = COMIDA_FUERTE.includes(momento) ? MAX_SEGUROS_FUERTE : MAX_SEGUROS
  const elegidos: Opcion[] = []
  for (const o of opciones) {
    if (elegidos.length >= max) break
    if (!elegidos.some((x) => x.grupo === o.grupo)) elegidos.push(o)
  }
  for (const o of opciones) {
    if (elegidos.length >= MAX_SEGUROS) break
    if (!elegidos.includes(o)) elegidos.push(o)
  }
  return elegidos
}

/**
 * Si todo lo seguro ya estuvo en la última comida de ese momento, rota uno: desde el de menos puntaje, lo cambia por el
 * mejor que no estuvo, del mismo grupo (papas fritas → papas al horno) o de un grupo que el plato no tenga. Todo lo que
 * entra está en `acepta`: rotar no baja la aceptación. Si no hay con qué, se repite (repetir lo seguro está bien).
 */
function rotar(elegidos: Opcion[], opciones: readonly Opcion[], ultima: ReadonlySet<string>): { platos: Opcion[]; rotado: string | null } {
  if (!elegidos.length || !elegidos.every((o) => ultima.has(o.prep.id))) return { platos: elegidos, rotado: null }
  const libres = opciones.filter((o) => !ultima.has(o.prep.id) && !elegidos.includes(o))
  for (let i = elegidos.length - 1; i >= 0; i--) {
    const sale = elegidos[i]
    if (!sale) continue
    const otros = elegidos.filter((_, j) => j !== i)
    const entra =
      libres.find((o) => o.grupo === sale.grupo) ?? libres.find((o) => !otros.some((x) => x.grupo === o.grupo))
    if (entra) {
      const platos = [...elegidos]
      platos[i] = entra
      return { platos, rotado: entra.prep.id }
    }
  }
  return { platos: elegidos, rotado: null }
}

function porQueSeguro(o: Opcion, n: Nutriente, objetivo: Nutrientes, rotado: boolean, momento: Momento): string {
  const s = o.s
  const base = s.veces > 0 ? `la come ${s.comio} de cada ${s.veces} ${s.veces === 1 ? 'vez' : 'veces'}` : 'según contaste, la come seguido'
  const aporta = objetivo[n] > 0 && o.ap[n] / objetivo[n] >= APORTE_DESTACADO ? ` y aporta ${NOMBRE_NUTRIENTE[n]}` : ''
  const frase = `${base}${aporta}`
  return rotado ? `Para no repetir ${DE_LA_ULTIMA[momento]}: ${frase}.` : `${frase.charAt(0).toUpperCase()}${frase.slice(1)}.`
}

function aItem(o: Opcion, n: Nutriente, objetivo: Nutrientes, rotado: boolean, momento: Momento): ItemPlato {
  return {
    preparacionId: o.prep.id,
    nombre: o.prep.nombre,
    porcion: 'mediana',
    grupo: o.grupo,
    aporte: redondearParcial(o.ap),
    porQue: porQueSeguro(o, n, objetivo, rotado, momento),
  }
}

/** El pasito: la de un_paso; si no hay, la de mas_nutritiva. Nunca más de uno, nunca algo que ya está en lo seguro. */
function elegirPasito(sugerencias: readonly Sugerencia[], seguros: ReadonlySet<string>): Sugerencia | undefined {
  for (const tipo of ['un_paso', 'mas_nutritiva'] as const) {
    const s = sugerencias.find((x) => x.tipo === tipo)
    if (s && !seguros.has(s.preparacionId)) return s
  }
  return undefined
}

export function armarPlato(e: EntradaPlato): PlatoComida {
  const n = nutrienteDelPlato(e)
  const opciones = opcionesSeguras(e, n)
  const { platos, rotado } = rotar(elegirVariado(opciones, e.momento), opciones, new Set(e.ultima ?? []))
  const seguros = platos.map((o) => aItem(o, n, e.objetivo, o.prep.id === rotado, e.momento))
  // Sin nada seguro para esa comida no va un alimento nuevo solo: lo nuevo va al lado de lo que ya come (§7)
  const pasito = seguros.length ? elegirPasito(e.sugerencias, new Set(seguros.map((s) => s.preparacionId))) : undefined

  // Cuánto de lo que le falta hoy de ese nutriente cubre el plato: seguros en porción mediana + el pasito en chica
  const delPasito = (() => {
    if (!pasito) return 0
    const prep = e.catalogo.find((p) => p.id === pasito.preparacionId)
    const ap = prep ? aporte(prep.ingredientes, e.alimentos).nutrientes[n] : (pasito.aporte[n] ?? 0)
    return ap * FACTOR_PORCION.chica
  })()
  const total = platos.reduce((t, o) => t + o.ap[n], 0) + delPasito
  const consumidoHoy = e.hoy && e.hoy.comidas.length > 0 ? e.hoy.consumido.valor[n] : 0
  const falta = Math.max(e.objetivo[n] - consumidoHoy, EPSILON)
  const cubre = Math.round(Math.min(1, Math.max(0, total / falta)) * 100) / 100

  const para = PARA_MOMENTO[e.momento]
  const haciaNutriente = pasito && e.objetivo[n] > 0 && delPasito >= APORTE_PASITO * e.objetivo[n]
  const porQue = !seguros.length
    ? `Todavía no conocemos algo que coma ${para}. Cuando registres lo que le sirvas, armamos el plato con eso.`
    : pasito
      ? `Lo que ya come ${para}, y un pasito ${haciaNutriente ? `hacia ${EL_NUTRIENTE(n)}` : 'nuevo, en porción chica'}.`
      : `Lo que ya come ${para}.`

  return { momento: e.momento, seguros, ...(pasito ? { pasito } : {}), nutriente: n, cubre, porQue }
}
