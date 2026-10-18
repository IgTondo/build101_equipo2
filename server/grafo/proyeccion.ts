// Qué nodos y aristas salen de cada cosa (PLAN.md §8). Puro: lo usan los dos motores del grafo, así Neo4j y Mongo
// guardan exactamente lo mismo.
import type { Alimento, Nutriente, Nutrientes, PreparacionCatalogo } from '../../shared/contratos.js'
import { ALERGENO, NUTRIENTE } from '../../shared/contratos.js'
import type { EstadoNino } from '../aprendizaje/estado.js'
import { esAtributo } from '../aprendizaje/condiciones.js'
import type { ComidaDoc, NinoDoc } from '../datos/tipos.js'
import { ATRIBUTOS_VOCABULARIO } from '../datos/validar.js'

export const LABELS = ['Nino', 'Comida', 'Item', 'Preparacion', 'Ingrediente', 'Nutriente', 'Atributo', 'Contexto', 'Reaccion', 'Alergeno', 'Regla', 'Patron'] as const
export type Label = (typeof LABELS)[number]
export const TIPOS = [
  'COMIO', 'INCLUYE', 'ES', 'TIENE', 'CONTIENE', 'EN_CONTEXTO', 'RESULTADO', 'APORTA', 'TIENE_ALERGENO', 'FORTIFICADA_DE',
  'ALERGICO_A', 'SIGUE', 'CONDICION', 'OBJETIVO', 'ACEPTA', 'EN_PROCESO', 'RECHAZA', 'TIENE_PATRON',
] as const
export type TipoArista = (typeof TIPOS)[number]
/** Las aristas de conocimiento que se reemplazan enteras cada vez que se recalcula el silver. */
export const TIPOS_ESTADO: readonly TipoArista[] = ['ACEPTA', 'EN_PROCESO', 'RECHAZA']

export type Props = Record<string, string | number | boolean | string[] | null>
export interface Nodo {
  label: Label
  id: string
  props: Props
  ninoId: string | null
}
export interface Arista {
  tipo: TipoArista
  desde: { label: Label; id: string }
  hasta: { label: Label; id: string }
  props: Props
  ninoId: string | null
}
export interface Proyeccion {
  nodos: Nodo[]
  aristas: Arista[]
}

const UNIDAD: Record<Nutriente, string> = {
  energia_kcal: 'kcal', proteina_g: 'g', calcio_mg: 'mg', vitamina_d_ug: 'µg', hierro_mg: 'mg', fibra_g: 'g', omega3_g: 'g', b12_ug: 'µg', vitamina_c_mg: 'mg',
}
/**
 * Lo que no es del catálogo es de cada chico: el "Sushi" de Rosario no es el de otro chico (otros ingredientes, otros
 * atributos). Su nodo es `${ninoId}|${id}`, lleva `ninoId` y se borra con el chico. Lo del catálogo es compartido.
 */
export const idPreparacion = (ninoId: string, prepId: string, catalogo: ReadonlySet<string>): string =>
  catalogo.has(prepId) ? prepId : `${ninoId}|${prepId}`

const condicionNodo = (tipo: string, valor: string): { label: Label; id: string } => ({ label: esAtributo(tipo) ? 'Atributo' : 'Contexto', id: `${tipo}:${valor}` })

/** B5: Nutrientes, Ingredientes + APORTA {por100g}, Atributos, Preparaciones del catálogo + TIENE + CONTIENE. */
export function proyectarCatalogo(preparaciones: readonly PreparacionCatalogo[], alimentos: readonly Alimento[]): Proyeccion {
  const nodos: Nodo[] = []
  const aristas: Arista[] = []
  for (const n of NUTRIENTE) nodos.push({ label: 'Nutriente', id: n, props: { nombre: n, unidad: UNIDAD[n] }, ninoId: null })
  for (const a of ALERGENO) nodos.push({ label: 'Alergeno', id: a, props: { nombre: a }, ninoId: null })
  for (const [tipo, valores] of Object.entries(ATRIBUTOS_VOCABULARIO)) {
    for (const valor of valores) nodos.push({ label: 'Atributo', id: `${tipo}:${valor}`, props: { tipo, valor }, ninoId: null })
  }
  for (const a of alimentos) {
    nodos.push({
      label: 'Ingrediente', id: a.id, ninoId: null,
      props: { nombre: a.nombre ?? a.id, grupo: a.grupo ?? null, fdcId: a.fdcId ?? null, fuente: a.fuente ?? null, dataset: a.dataset ?? null },
    })
    for (const n of NUTRIENTE) {
      const valor = a.por100g?.[n] // A3 sube primero los ids y después los valores
      if (valor) aristas.push({ tipo: 'APORTA', desde: { label: 'Ingrediente', id: a.id }, hasta: { label: 'Nutriente', id: n }, props: { por100g: valor }, ninoId: null })
    }
    for (const al of a.alergenos ?? []) aristas.push({ tipo: 'TIENE_ALERGENO', desde: { label: 'Ingrediente', id: a.id }, hasta: { label: 'Alergeno', id: al }, props: {}, ninoId: null })
  }
  const conocidos = new Set(alimentos.map((a) => a.id))
  for (const p of preparaciones) {
    nodos.push({ label: 'Preparacion', id: p.id, props: { nombre: p.nombre, catalogo: true }, ninoId: null })
    for (const [tipo, valor] of Object.entries(p.atributos)) {
      if (valor) aristas.push({ tipo: 'TIENE', desde: { label: 'Preparacion', id: p.id }, hasta: { label: 'Atributo', id: `${tipo}:${valor}` }, props: {}, ninoId: null })
    }
    for (const i of p.ingredientes) {
      if (!conocidos.has(i.alimentoId)) {
        conocidos.add(i.alimentoId)
        nodos.push({ label: 'Ingrediente', id: i.alimentoId, props: { nombre: i.alimentoId }, ninoId: null })
      }
      aristas.push({ tipo: 'CONTIENE', desde: { label: 'Preparacion', id: p.id }, hasta: { label: 'Ingrediente', id: i.alimentoId }, props: { gramos: i.gramos }, ninoId: null })
    }
    if (p.fortificadaDe) aristas.push({ tipo: 'FORTIFICADA_DE', desde: { label: 'Preparacion', id: p.id }, hasta: { label: 'Preparacion', id: p.fortificadaDe }, props: {}, ninoId: null })
  }
  return { nodos, aristas }
}

/** B8: Nino, ALERGICO_A, SIGUE (reglas del padre), OBJETIVO. */
export function proyectarNino(nino: NinoDoc, objetivo: Nutrientes): Proyeccion {
  const id = nino._id
  const d = nino.datos
  const nodos: Nodo[] = [
    { label: 'Nino', id, props: { nombre: d.nombre, edad: d.edad, sexo: d.sexo, dieta: d.dieta, pesoKg: d.pesoKg ?? null, tallaCm: d.tallaCm ?? null }, ninoId: id },
  ]
  const aristas: Arista[] = d.alergias.map((a) => ({ tipo: 'ALERGICO_A' as const, desde: { label: 'Nino' as const, id }, hasta: { label: 'Alergeno' as const, id: a }, props: {}, ninoId: id }))
  nino.reglas.forEach((r, i) => {
    const reglaId = `${id}|regla|${i}`
    nodos.push({ label: 'Regla', id: reglaId, props: { texto: r.texto, efecto: r.efecto, fuente: 'padre' }, ninoId: id })
    aristas.push({ tipo: 'SIGUE', desde: { label: 'Nino', id }, hasta: { label: 'Regla', id: reglaId }, props: {}, ninoId: id })
    for (const c of r.condiciones) aristas.push({ tipo: 'CONDICION', desde: { label: 'Regla', id: reglaId }, hasta: condicionNodo(c.tipo, c.valor), props: {}, ninoId: id })
  })
  for (const n of NUTRIENTE) {
    if (objetivo[n] > 0) {
      const fuente = nino.objetivosNutricionista?.[n] ? 'nutricionista' : 'tabla'
      aristas.push({ tipo: 'OBJETIVO', desde: { label: 'Nino', id }, hasta: { label: 'Nutriente', id: n }, props: { cantidad: objetivo[n], fuente }, ninoId: id })
    }
  }
  return { nodos, aristas }
}

/** B6: (:Nino)-[:COMIO]->(:Comida)-[:INCLUYE]->(:Item)-[:ES]->(:Preparacion), CONTIENE, EN_CONTEXTO y RESULTADO. */
export function proyectarComida(c: ComidaDoc, catalogo: ReadonlySet<string>): Proyeccion {
  const id = c.ninoId
  const nodos: Nodo[] = [
    { label: 'Comida', id: c._id, props: { dia: c.dia, fechaISO: c.fechaISO, momento: c.momento, conducta: c.conducta, comentario: c.comentario ?? null }, ninoId: id },
  ]
  const aristas: Arista[] = [{ tipo: 'COMIO', desde: { label: 'Nino', id }, hasta: { label: 'Comida', id: c._id }, props: {}, ninoId: id }]
  for (const [tipo, valor] of [['distribucion', c.distribucion], ['plato', c.plato], ['momento', c.momento]] as const) {
    nodos.push({ label: 'Contexto', id: `${tipo}:${valor}`, props: { tipo, valor }, ninoId: null })
    aristas.push({ tipo: 'EN_CONTEXTO', desde: { label: 'Comida', id: c._id }, hasta: { label: 'Contexto', id: `${tipo}:${valor}` }, props: {}, ninoId: id })
  }
  for (const k of c.conducta) {
    nodos.push({ label: 'Reaccion', id: k, props: { tipo: k }, ninoId: null })
    aristas.push({ tipo: 'RESULTADO', desde: { label: 'Comida', id: c._id }, hasta: { label: 'Reaccion', id: k }, props: {}, ninoId: id })
  }
  for (const it of c.items) {
    const itemId = `${c._id}|${it.idTmp}`
    const a = it.atributos
    nodos.push({
      label: 'Item', id: itemId, ninoId: id,
      props: {
        gramos: Math.round(it.gramos * 10) / 10, fraccion: it.fraccion, o: it.o, cuanto: it.cuanto, motivo: it.motivo ?? null, cita: it.cita ?? null,
        confianza: it.confianza, textura: a.textura, forma: a.forma, color: a.color, sabor: a.sabor, temperatura: a.temperatura,
        presentacion: a.presentacion, grupo: a.grupo, coccion: a.coccion ?? null,
      },
    })
    aristas.push({ tipo: 'INCLUYE', desde: { label: 'Comida', id: c._id }, hasta: { label: 'Item', id: itemId }, props: {}, ninoId: id })
    // Lo que no está en el catálogo es del chico; sus atributos e ingredientes los pone proyectarConocimiento (que va
    // siempre en la misma escritura), con lo declarado y lo observado juntos
    const prep = idPreparacion(id, it.preparacionId, catalogo)
    const propio = prep !== it.preparacionId
    nodos.push({ label: 'Preparacion', id: prep, props: propio ? { nombre: it.nombre, catalogo: false, ninoId: id, prepId: it.preparacionId } : { nombre: it.nombre }, ninoId: propio ? id : null })
    aristas.push({ tipo: 'ES', desde: { label: 'Item', id: itemId }, hasta: { label: 'Preparacion', id: prep }, props: {}, ninoId: id })
    for (const g of it.ingredientes) {
      nodos.push({ label: 'Ingrediente', id: g.alimentoId, props: {}, ninoId: null })
      aristas.push({ tipo: 'CONTIENE', desde: { label: 'Item', id: itemId }, hasta: { label: 'Ingrediente', id: g.alimentoId }, props: { gramos: Math.round(g.gramos * 10) / 10 }, ninoId: id })
    }
  }
  return { nodos, aristas }
}

/**
 * Silver: ACEPTA / EN_PROCESO / RECHAZA con su puntaje, los patrones vigentes con sus condiciones y las preparaciones
 * propias del chico (fuera del catálogo: lo que contó el padre y lo observado) con sus atributos (TIENE), ingredientes
 * (CONTIENE) y momentos. Los TIENE/CONTIENE de las propias se borran antes de reescribirlas (no se acumulan viejos).
 */
export function proyectarConocimiento(ninoId: string, estado: EstadoNino, catalogo: ReadonlySet<string>): Proyeccion {
  const nodos: Nodo[] = []
  const aristas: Arista[] = []
  const tipo = { acepta: 'ACEPTA', en_proceso: 'EN_PROCESO', rechaza: 'RECHAZA' } as const
  for (const p of estado.conocidas.values()) {
    if (catalogo.has(p.id)) continue
    const prep = idPreparacion(ninoId, p.id, catalogo)
    const momentos = (p as { momentos?: readonly string[] }).momentos
    nodos.push({
      label: 'Preparacion', id: prep, ninoId,
      props: { nombre: p.nombre, catalogo: false, ninoId, prepId: p.id, ...(momentos?.length ? { momentos: [...momentos] } : {}) },
    })
    for (const [t, valor] of Object.entries(p.atributos)) {
      if (valor) aristas.push({ tipo: 'TIENE', desde: { label: 'Preparacion', id: prep }, hasta: { label: 'Atributo', id: `${t}:${valor}` }, props: {}, ninoId })
    }
    const gramos = new Map<string, number>()
    for (const g of p.ingredientes) if (g.alimentoId) gramos.set(g.alimentoId, (gramos.get(g.alimentoId) ?? 0) + (Number(g.gramos) || 0))
    for (const [alimentoId, g] of gramos) {
      nodos.push({ label: 'Ingrediente', id: alimentoId, props: {}, ninoId: null })
      aristas.push({ tipo: 'CONTIENE', desde: { label: 'Preparacion', id: prep }, hasta: { label: 'Ingrediente', id: alimentoId }, props: { gramos: Math.round(g * 10) / 10 }, ninoId })
    }
  }
  for (const e of estado.estados.values()) {
    const prep = idPreparacion(ninoId, e.prepId, catalogo)
    const propio = prep !== e.prepId
    nodos.push({ label: 'Preparacion', id: prep, props: propio ? { nombre: e.nombre, catalogo: false, ninoId, prepId: e.prepId } : { nombre: e.nombre }, ninoId: propio ? ninoId : null })
    aristas.push({
      tipo: tipo[e.estado], desde: { label: 'Nino', id: ninoId }, hasta: { label: 'Preparacion', id: prep }, ninoId,
      props: { puntaje: Math.round(e.p * 1000) / 1000, veces: e.veces, comio: e.comio, mejorPaso: e.mejorPaso, ultima: e.ultimaISO, declarada: e.declarada, motivo: e.motivoDeclarado ?? null },
    })
  }
  for (const p of estado.patrones) {
    const patronId = `${ninoId}|${p.clave}`
    nodos.push({
      label: 'Patron', id: patronId, ninoId,
      props: { clave: p.clave, texto: p.texto, resultado: p.resultado, apoyo: p.n, media: Math.round(p.media * 1000) / 1000, confianza: Math.round(p.confianza * 1000) / 1000, fuente: p.fuente },
    })
    aristas.push({ tipo: 'TIENE_PATRON', desde: { label: 'Nino', id: ninoId }, hasta: { label: 'Patron', id: patronId }, props: {}, ninoId })
    for (const c of p.condiciones) aristas.push({ tipo: 'CONDICION', desde: { label: 'Patron', id: patronId }, hasta: condicionNodo(c.tipo, c.valor), props: {}, ninoId })
  }
  for (const a of aristas) {
    if (a.tipo === 'CONDICION' && a.hasta.label === 'Contexto') {
      const [t, v] = a.hasta.id.split(':')
      nodos.push({ label: 'Contexto', id: a.hasta.id, props: { tipo: t ?? '', valor: v ?? '' }, ninoId: null })
    }
  }
  return { nodos, aristas }
}

export function unir(...ps: Proyeccion[]): Proyeccion {
  return { nodos: ps.flatMap((p) => p.nodos), aristas: ps.flatMap((p) => p.aristas) }
}
