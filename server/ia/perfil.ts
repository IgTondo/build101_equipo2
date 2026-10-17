// Perfil inicial (PLAN.md §7, A8): el relato de la familia → PerfilBorrador, que la familia confirma en "Esto entendimos".
// Claude Haiku 5.5 (tarea 'perfil') con el catálogo de preparaciones → depurarPerfil(), que decide en código qué queda:
// valores fuera del vocabulario se descartan y un preparacionId que no está en el catálogo pasa a null.
// Las alergias nunca salen de la IA: vienen a mano en `datos`, no se le pasan al modelo y no se devuelven. Lo que el
// modelo marca como evitado por alergia (porAlergia) se descarta.
// La foto de la indicación del nutricionista (A12, P2) → objetivosNutricionista, con depurarIndicacion(): unidades del
// contrato, rangos plausibles para chicos y solo objetivos de ingesta diaria. Los suplementos no son objetivos.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import {
  ALERGENO, DIETA, MOTIVO,
  type Atributos, type Nutrientes, type PerfilBorrador, type PerfilInicialReq, type PreparacionCatalogo, type Regla,
} from '../../shared/contratos.js'
import { ErrorNibble } from '../http.js'
import { generarJSON } from './modelo.js'
import { ATRIBUTOS, mensajePerfil, NUTRIENTES_OBJETIVO, SISTEMA_PERFIL, VOCABULARIO } from './prompts/perfil.js'
import { normalizar } from './relato.js'

// ---------- Entrada ----------
export const esquemaPerfilInicialReq = z.object({
  datos: z.object({
    nombre: z.string().min(1),
    edad: z.number().nonnegative(),
    sexo: z.enum(['masculino', 'femenino']),
    pesoKg: z.number().optional(),
    tallaCm: z.number().optional(),
    alergias: z.array(z.enum(ALERGENO)),
    alertas: z.array(z.enum(['bajo_peso', 'arcadas_vomitos', 'menos_15_alimentos'])),
    dieta: z.enum(DIETA),
    suplementos: z.string().optional(),
  }),
  texto: z.string(),
  fotoIndicacionBase64: z.string().optional(),
})

// ---------- Salida del modelo ----------
// Los valores del vocabulario van como texto: si el modelo se sale, el código los descarta en vez de fallar todo.
const valor = z.string().nullable()
export const esquemaSalidaPerfil = z.object({
  acepta: z.array(z.object({
    nombre: z.string(),
    preparacionId: z.string().nullable(),
    marca: z.string().nullable(),
    atributos: z.object({ textura: valor, forma: valor, color: valor, sabor: valor, temperatura: valor, presentacion: valor, grupo: valor, coccion: valor }),
  })),
  rechaza: z.array(z.object({ nombre: z.string(), preparacionId: z.string().nullable(), motivo: z.string(), porAlergia: z.boolean() })),
  reglas: z.array(z.object({
    texto: z.string(),
    condiciones: z.array(z.object({ tipo: z.string(), valor: z.string() })),
    efecto: z.string(),
    porAlergia: z.boolean(),
  })),
})
export type SalidaPerfil = z.infer<typeof esquemaSalidaPerfil>

export const esquemaSalidaIndicacion = z.object({
  objetivos: z.array(z.object({
    nutriente: z.enum(NUTRIENTES_OBJETIVO),
    valor: z.number(),
    unidad: z.enum(['g', 'mg', 'ug', 'UI', 'otra']),          // como figura: la conversión la hace el código
    cita: z.string(),
    tipo: z.enum(['objetivo_diario', 'objetivo_semanal', 'suplemento', 'otro']),
  })),
})
export type SalidaIndicacion = z.infer<typeof esquemaSalidaIndicacion>

// ---------- Catálogo de preparaciones ----------
let catalogo: PreparacionCatalogo[] | null = null

/** data/preparaciones.json (B); mientras no exista, el del dataset sintético. vercel.json → includeFiles. */
export function preparaciones(): PreparacionCatalogo[] {
  if (!catalogo) {
    const deB = join(process.cwd(), 'data', 'preparaciones.json')
    const ruta = existsSync(deB) ? deB : join(process.cwd(), 'data', 'sinteticos', 'preparaciones.json')
    catalogo = JSON.parse(readFileSync(ruta, 'utf8')) as PreparacionCatalogo[]
  }
  return catalogo
}

/** Solo para tests: reemplaza el catálogo (null vuelve a leer el archivo). */
export function fijarPreparaciones(nuevas: PreparacionCatalogo[] | null): void {
  catalogo = nuevas
}

// ---------- Depuración (código, nunca IA) ----------
/** El valor del vocabulario que corresponde, sin importar mayúsculas, tildes ni "_" ("Con divisiones" → con_divisiones). */
function delVocabulario<T extends string>(lista: readonly T[], v: string | null | undefined): T | undefined {
  if (!v) return undefined
  const n = normalizar(v)
  return lista.find((x) => normalizar(x) === n)
}

const TIPOS = Object.keys(VOCABULARIO) as (keyof typeof VOCABULARIO)[]
const EFECTOS = ['rechaza', 'requiere'] as const satisfies readonly Regla['efecto'][]

function atributosValidos(a: SalidaPerfil['acepta'][number]['atributos']): Partial<Atributos> {
  const validos: Partial<Record<keyof Atributos, string>> = {}
  for (const k of ATRIBUTOS) {
    const v = delVocabulario(VOCABULARIO[k], a[k])
    if (v) validos[k] = v
  }
  return validos as Partial<Atributos>
}

/**
 * Una regla con una condición fuera del vocabulario queda solo como texto (condiciones: []), como las que escribe la
 * familia a mano: sacarle una condición la volvería más amplia de lo que dijo. Sin texto o con otro efecto, no queda.
 */
function reglaValida(r: SalidaPerfil['reglas'][number]): Regla | null {
  const texto = r.texto.replace(/\s+/g, ' ').trim()
  const efecto = delVocabulario(EFECTOS, r.efecto)
  if (!texto || !efecto || r.porAlergia) return null
  const condiciones: Regla['condiciones'] = []
  for (const c of r.condiciones) {
    const tipo = delVocabulario(TIPOS, c.tipo)
    const v = tipo && delVocabulario(VOCABULARIO[tipo], c.valor)
    if (!tipo || !v) return { texto, condiciones: [], efecto }
    if (!condiciones.some((x) => x.tipo === tipo && x.valor === v)) condiciones.push({ tipo, valor: v })
  }
  return { texto, condiciones, efecto }
}

/** Sin repetir por nombre (o por texto, en las reglas): queda el primero. */
function unicos<T>(lista: T[], clave: (x: T) => string): T[] {
  const vistas = new Set<string>()
  return lista.filter((x) => {
    const k = normalizar(clave(x))
    if (!k || vistas.has(k)) return false
    vistas.add(k)
    return true
  })
}

/** Lo que el código no le deja al modelo. Pura: la usan extraerPerfil() y los tests. */
export function depurarPerfil(salida: SalidaPerfil, catalogo: Pick<PreparacionCatalogo, 'id'>[]): PerfilBorrador {
  const ids = new Set(catalogo.map((p) => p.id))
  const idValido = (id: string | null) => (id && ids.has(id) ? id : null)
  const limpio = (s: string | null) => s?.replace(/\s+/g, ' ').trim() ?? ''

  const acepta = salida.acepta.map((a) => {
    const marca = limpio(a.marca)
    return { nombre: limpio(a.nombre), preparacionId: idValido(a.preparacionId), ...(marca ? { marca } : {}), atributos: atributosValidos(a.atributos) }
  })
  const rechaza = salida.rechaza
    .filter((r) => !r.porAlergia)
    .map((r) => ({ nombre: limpio(r.nombre), preparacionId: idValido(r.preparacionId), motivo: delVocabulario(MOTIVO, r.motivo) ?? 'otro' }))
  const reglas = salida.reglas.flatMap((r) => reglaValida(r) ?? [])

  return {
    acepta: unicos(acepta, (a) => a.nombre),
    rechaza: unicos(rechaza, (r) => r.nombre),
    reglas: unicos(reglas, (r) => r.texto),
  }
}

// ---------- Objetivos de la indicación (código, nunca IA) ----------
type NutrienteObjetivo = (typeof NUTRIENTES_OBJETIVO)[number]
type Masa = 'g' | 'mg' | 'ug'

/** La unidad de cada nutriente en el contrato (el sufijo del id). */
const UNIDAD: Record<NutrienteObjetivo, Masa> = {
  proteina_g: 'g', calcio_mg: 'mg', vitamina_d_ug: 'ug', hierro_mg: 'mg',
  fibra_g: 'g', omega3_g: 'g', b12_ug: 'ug', vitamina_c_mg: 'mg',
}
const GRAMOS: Record<Masa, number> = { g: 1, mg: 1e-3, ug: 1e-6 }
const UI_POR_UG_VITAMINA_D = 40 // 1 µg de vitamina D = 40 UI; las UI no valen para ningún otro de estos nutrientes

/**
 * Rango plausible de un objetivo diario para chicos de 1 a 18 años, en las unidades del contrato. Cubre con margen las
 * referencias de §10.1 y queda por debajo de los topes (UL) del IOM. Afuera = error de lectura o de unidad.
 */
export const RANGO_OBJETIVO: Record<NutrienteObjetivo, [number, number]> = {
  proteina_g: [5, 120],
  calcio_mg: [300, 2500],
  vitamina_d_ug: [5, 50],
  hierro_mg: [3, 40],
  fibra_g: [5, 50],
  omega3_g: [0.1, 3],
  b12_ug: [0.4, 10],
  vitamina_c_mg: [10, 300],
}

// Si la cita habla de un producto, es un suplemento aunque el modelo diga otra cosa.
const SUPLEMENTO = /\b(suplement\w*|gotas?|comprimidos?|capsulas?|jarabes?|ampollas?|tabletas?|pastillas?|grageas?|multivitaminic\w*)\b/

export interface DescarteIndicacion {
  nutriente: NutrienteObjetivo
  motivo: 'suplemento' | 'no_es_objetivo_diario' | 'sin_cita' | 'unidad_invalida' | 'fuera_de_rango' | 'repetido'
}

/** valor en `unidad` → la unidad del contrato, o null si no se puede convertir. */
function aUnidadDelContrato(nutriente: NutrienteObjetivo, valor: number, unidad: SalidaIndicacion['objetivos'][number]['unidad']): number | null {
  if (unidad === 'otra') return null
  const convertido = unidad === 'UI'
    ? (nutriente === 'vitamina_d_ug' ? valor / UI_POR_UG_VITAMINA_D : null)
    : (valor * GRAMOS[unidad]) / GRAMOS[UNIDAD[nutriente]]
  return convertido === null ? null : Number(convertido.toPrecision(4)) // 1,3 g → 1300 mg, sin 1300.0000000000002
}

/**
 * Lo que el código no le deja al modelo. Pura: la usan leerIndicacion() y los tests.
 * - Un suplemento (por el tipo o por la cita) se descarta sin convertir: la app nunca sugiere suplementos y los
 *   recetados se registran a mano en datos.suplementos.
 * - Solo objetivos de ingesta diaria, con cita, en una unidad convertible y dentro de RANGO_OBJETIVO.
 * - Un nutriente repetido: vale el primero.
 */
export function depurarIndicacion(salida: SalidaIndicacion): { objetivos: Partial<Nutrientes>; descartes: DescarteIndicacion[] } {
  const objetivos: Partial<Nutrientes> = {}
  const descartes: DescarteIndicacion[] = []
  for (const o of salida.objetivos) {
    const descartar = (motivo: DescarteIndicacion['motivo']) => descartes.push({ nutriente: o.nutriente, motivo })
    if (o.tipo === 'suplemento' || SUPLEMENTO.test(normalizar(o.cita))) { descartar('suplemento'); continue }
    if (o.tipo !== 'objetivo_diario') { descartar('no_es_objetivo_diario'); continue }
    if (!o.cita.trim()) { descartar('sin_cita'); continue }
    const valor = aUnidadDelContrato(o.nutriente, o.valor, o.unidad)
    if (valor === null) { descartar('unidad_invalida'); continue }
    const [min, max] = RANGO_OBJETIVO[o.nutriente]
    if (!(valor >= min && valor <= max)) { descartar('fuera_de_rango'); continue }
    if (o.nutriente in objetivos) { descartar('repetido'); continue }
    objetivos[o.nutriente] = valor
  }
  return { objetivos, descartes }
}

// ---------- El perfil ----------
export async function extraerPerfil(req: PerfilInicialReq): Promise<PerfilBorrador> {
  const texto = req.texto.trim()
  if (!texto) throw new ErrorNibble('entrada_invalida', 'Contanos cómo come para armar su perfil.', { campo: 'texto' })
  // TODO(A12, P2): fotoIndicacionBase64 → objetivosNutricionista (la foto de la indicación del nutricionista).
  // Se acepta en el pedido pero todavía no se procesa ni se le manda al modelo.
  const catalogo = preparaciones()
  const { datos } = await generarJSON({
    tarea: 'perfil',
    sistema: SISTEMA_PERFIL,
    partes: [{ tipo: 'texto', texto: mensajePerfil({ nombre: req.datos.nombre, edad: req.datos.edad, catalogo, texto }) }],
    schema: esquemaSalidaPerfil,
  })
  return depurarPerfil(datos, catalogo)
}
