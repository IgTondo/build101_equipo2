// Perfil inicial (PLAN.md §7, A8): el relato de la familia → PerfilBorrador, que la familia confirma en "Esto entendimos".
// Claude Haiku 5.5 (tarea 'perfil') con el catálogo de preparaciones → depurarPerfil(), que decide en código qué queda:
// valores fuera del vocabulario se descartan y un preparacionId que no está en el catálogo pasa a null.
// Las alergias nunca salen de la IA: vienen a mano en `datos`, no se le pasan al modelo y no se devuelven. Lo que el
// modelo marca como evitado por alergia (porAlergia) se descarta.
// A8b (alta por voz, §5.2): sin `datos`, extraerDatos() saca del mismo relato, en paralelo, nombre, edad, sexo, peso,
// talla, alergias mencionadas, alertas, dieta y suplementos, cada uno con su cita textual (sin cita que esté en el relato,
// no hay dato). Las alergias mencionadas son sugerencias: el padre las confirma una por una. Lo vital que falta, en `faltan`.
// La foto de la indicación del nutricionista (A12, P2) → objetivosNutricionista, con depurarIndicacion(): unidades del
// contrato, rangos plausibles para chicos y solo objetivos de ingesta diaria. Los suplementos no son objetivos.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import {
  ALERGENO, COCCION, COLOR, DIETA, FORMA, GRUPO, MOMENTO, MOTIVO, PRESENTACION, SABOR, TEMPERATURA, TEXTURA,
  type Alergeno, type Atributos, type CampoVital, type DatoCitado, type DatosExtraidos, type Momento,
  type Nutrientes, type PerfilBorrador, type PerfilInicialReq, type PreparacionCatalogo, type Regla,
} from '../../shared/contratos.js'
import { alergenoDe, patronAlergia } from '../alergias.js'
import { ErrorNibble } from '../http.js'
import { alimentoPorId, alimentos, idGenerico, idsAlimentos } from './catalogo.js'
import { alergiaQueChoca, verificarId } from './mismo-alimento.js'
import { generarJSON } from './modelo.js'
import {
  ATRIBUTOS, mensajeDatos, mensajeIndicacion, mensajePerfil, NUTRIENTES_OBJETIVO, SISTEMA_DATOS, SISTEMA_INDICACION, sistemaPerfil,
  VOCABULARIO,
} from './prompts/perfil.js'
import { citaEnTranscripcion, normalizar } from './relato.js'

// ---------- Entrada ----------
const MAX_FOTO = 4_500_000 // el body entero no puede pasar de 4,5 MB en Vercel

// La foto de la indicación, como en api/analizar-comida.ts: sin el prefijo data: ni saltos de línea (la API de Claude
// no los acepta), base64 limpio y JPEG. Vacía = no vino.
const fotoIndicacion = z.preprocess(
  (v) => (typeof v === 'string' ? v.replace(/^data:[^,]*,/, '').replace(/\s+/g, '') || undefined : v),
  z.string().max(MAX_FOTO).regex(/^[A-Za-z0-9+/]+={0,2}$/, 'No es base64').startsWith('/9j/', 'No es un JPEG').optional(),
)

export const esquemaPerfilInicialReq = z.object({
  // A8b: en el alta por voz no viene (se extrae del relato)
  datos: z.object({
    nombre: z.string().min(1),
    edad: z.number().nonnegative(),
    sexo: z.enum(['masculino', 'femenino']),
    pesoKg: z.number().optional(),
    tallaCm: z.number().optional(),
    alergias: z.array(z.enum(ALERGENO)),
    alergiasOtras: z.array(z.string().trim().min(1).max(60)).max(20).optional(), // v5.8
    alertas: z.array(z.enum(['bajo_peso', 'arcadas_vomitos', 'menos_15_alimentos'])),
    dieta: z.enum(DIETA),
    suplementos: z.string().optional(),
  }).optional(),
  texto: z.string(),
  fotoIndicacionBase64: fotoIndicacion,
})

// ---------- Salida del modelo ----------
// v5.8 · Los 8 atributos van como enum sin null: los obliga y no suma uniones (la salida estructurada de Claude acepta
// hasta 16 parámetros con null o anyOf por schema; un nullable por atributo los pasaba). Los alimentoId y los momentos
// van con el enum en el JSON Schema pero Zod acepta cualquier texto: lo que se sale, el código lo saca en vez de gastar
// el reintento (como en la visión).
export const esquemaAtributos = z.object({
  textura: z.enum(TEXTURA), forma: z.enum(FORMA), color: z.enum(COLOR), sabor: z.enum(SABOR),
  temperatura: z.enum(TEMPERATURA), presentacion: z.enum(PRESENTACION), grupo: z.enum(GRUPO), coccion: z.enum(COCCION),
})

/** Los alimentoId que acepta el contrato: el catálogo curado y los genéricos otro_<grupo>. */
export function idsIngredientes(): string[] {
  return [...new Set([...idsAlimentos(), ...GRUPO.map(idGenerico)])]
}

export function esquemaIngredientes(ids: string[] = idsIngredientes()) {
  const alimentoId = ids.length ? z.string().meta({ enum: ids }) : z.string()
  return z.array(z.object({ alimentoId, gramos: z.number() }))
}

export const esquemaMomentos = z.array(z.string().meta({ enum: [...MOMENTO] }))

export function esquemaPerfil(ids?: string[]) {
  const ingredientes = esquemaIngredientes(ids)
  return z.object({
    acepta: z.array(z.object({
      dicho: z.string(),
      nombre: z.string(),
      preparacionId: z.string().nullable(),
      marca: z.string().nullable(),
      atributos: esquemaAtributos,
      ingredientes,
      momentos: esquemaMomentos,
      duda: z.string().nullable(),
    })),
    rechaza: z.array(z.object({
      dicho: z.string(),
      nombre: z.string(),
      preparacionId: z.string().nullable(),
      motivo: z.string().meta({ enum: [...MOTIVO] }),
      porAlergia: z.boolean(),
      atributos: esquemaAtributos,
    })),
    reglas: z.array(z.object({
      texto: z.string(),
      condiciones: z.array(z.object({ tipo: z.string(), valor: z.string() })),
      efecto: z.string(),
      porAlergia: z.boolean(),
    })),
  })
}
/** Sin el enum de alimentoId (para tipos y tests); extraerPerfil() manda el de esquemaPerfil(idsIngredientes()). */
export const esquemaSalidaPerfil = esquemaPerfil([])
export type SalidaPerfil = z.infer<typeof esquemaSalidaPerfil>

// A8b · Los datos del chico, del relato. Todo nullable y como texto donde hay vocabulario: el código decide qué queda.
const citado = <T extends z.ZodTypeAny>(v: T) => z.object({ valor: v, cita: z.string() }).nullable()
const soloCita = z.object({ cita: z.string() }).nullable()
export const esquemaSalidaDatos = z.object({
  nombre: citado(z.string()),
  edad: citado(z.number()),
  sexo: citado(z.string()),
  pesoKg: citado(z.number()),
  tallaCm: citado(z.number()),
  alergiasMencionadas: z.array(z.object({ valor: z.string(), cita: z.string() })),
  otrasAlergiasMencionadas: z.array(z.object({ valor: z.string(), cita: z.string() })), // v5.8 · sin null: no suma uniones
  sinAlergias: soloCita,
  alertas: z.array(z.object({ valor: z.string(), cita: z.string() })),
  atragantamiento: soloCita,
  dieta: citado(z.string()),
  suplementos: citado(z.string()),
})
export type SalidaDatos = z.infer<typeof esquemaSalidaDatos>

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

/** Los atributos que están en el vocabulario, escritos como en el contrato; los demás, afuera. */
export function atributosValidos(a: Partial<Record<keyof Atributos, string | null | undefined>> | undefined): Partial<Atributos> {
  const validos: Partial<Record<keyof Atributos, string>> = {}
  for (const k of ATRIBUTOS) {
    const v = delVocabulario(VOCABULARIO[k], a?.[k])
    if (v) validos[k] = v
  }
  return validos as Partial<Atributos>
}

/** Los momentos de MOMENTO, sin repetir ("postre" o "almuerzo " no son momentos del contrato; el segundo, sí). */
export function momentosValidos(lista: readonly string[] | undefined): Momento[] {
  return [...new Set((lista ?? []).flatMap((m) => delVocabulario(MOMENTO, m) ?? []))]
}

export const MAX_GRAMOS_INGREDIENTE = 500

/**
 * Los ingredientes de algo que no está en el catálogo: alimentoId del catálogo curado (o un genérico), gramos de 1 a
 * 500 y redondeados, los repetidos sumados. Lo que choca con una alergia del chico se saca (y vuelve en `sacados`):
 * si lo come, es la versión sin eso.
 */
export function ingredientesValidos(
  lista: readonly { alimentoId: string; gramos: number }[] | undefined,
  alergias: readonly Alergeno[] = [],
  alergiasOtras: readonly string[] = [],
): { ingredientes: { alimentoId: string; gramos: number }[]; sacados: { alimentoId: string; alergia: string }[] } {
  const validos = new Set(idsIngredientes())
  const gramos = new Map<string, number>()
  const sacados: { alimentoId: string; alergia: string }[] = []
  for (const g of lista ?? []) {
    if (!validos.has(g.alimentoId) || !Number.isFinite(g.gramos) || g.gramos < 1) continue
    const alergia = alergiaQueChoca(g.alimentoId, alergias, alergiasOtras)
    if (alergia) {
      if (!sacados.some((x) => x.alimentoId === g.alimentoId)) sacados.push({ alimentoId: g.alimentoId, alergia })
      continue
    }
    gramos.set(g.alimentoId, (gramos.get(g.alimentoId) ?? 0) + g.gramos)
  }
  const ingredientes = [...gramos].map(([alimentoId, g]) => ({ alimentoId, gramos: Math.round(Math.min(g, MAX_GRAMOS_INGREDIENTE)) }))
  return { ingredientes, sacados }
}

/** La pregunta cuando la versión típica llevaba algo a lo que el chico es alérgico y el código lo sacó. */
/** Las palabras con que una duda puede nombrar cada alergia (para saber si la duda es por una alergia de este chico). */
const PALABRAS_ALERGENO: Record<Alergeno, string[]> = {
  leche: ['leche', 'lacteo', 'lactosa', 'queso', 'manteca', 'crema', 'yogur'], huevo: ['huevo', 'clara', 'yema'],
  gluten: ['gluten', 'harina', 'trigo', 'pan', 'tacc'], mani: ['mani'], frutos_secos: ['frutos secos', 'nuez', 'nueces', 'almendra', 'avellana'],
  soja: ['soja'], pescado: ['pescado', 'merluza', 'atun', 'salmon'], mariscos: ['marisco', 'camaron', 'langostino'], sesamo: ['sesamo'],
}

/**
 * La duda del modelo, solo si es por una alergia de ESTE chico (la nombra). "¿La milanesa lleva huevo?" a una familia
 * cuyo hijo no es alérgico al huevo no ayuda: se descarta. Sin alergias, ninguna duda del modelo queda.
 */
export function dudaRelevante(duda: string | null | undefined, alergias: readonly Alergeno[], alergiasOtras: readonly string[] = []): string | undefined {
  const d = duda?.replace(/\s+/g, ' ').trim()
  if (!d) return undefined
  const n = ` ${normalizar(d)} `
  const porFija = alergias.some((a) => PALABRAS_ALERGENO[a].some((w) => new RegExp(`\\b${normalizar(w)}`).test(n)))
  const porOtra = alergiasOtras.some((o) => patronAlergia(o).test(normalizar(d)))
  return porFija || porOtra ? d : undefined
}

export function dudaPorAlergia(nombre: string, sacados: { alimentoId: string }[]): string | undefined {
  if (!sacados.length) return undefined
  const que = sacados.map((x) => (alimentoPorId(x.alimentoId)?.nombre ?? x.alimentoId.replace(/_/g, ' ')).toLocaleLowerCase('es'))
  return `¿${nombre} lleva ${que.join(' o ')}? Lo sacamos por su alergia: confirmá que es la versión sin eso.`
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

/**
 * ¿La regla choca con algo que acepta? Solo las de los 8 atributos: "rechaza" choca si algo que come cumple todas las
 * condiciones; "requiere", si algo que come (con esos atributos conocidos) no las cumple. Devuelve lo que come y choca.
 */
function choqueConLoQueAcepta<A extends { nombre: string; preparacionId: string | null; atributos: Partial<Atributos> }>(r: Regla, acepta: A[]): A | null {
  if (!r.condiciones.length || !r.condiciones.every((c) => (ATRIBUTOS as readonly string[]).includes(c.tipo))) return null
  const valor = (a: { atributos: Partial<Atributos> }, tipo: string) => a.atributos[tipo as keyof Atributos]
  const chocan = acepta.filter((a) => {
    if (!r.condiciones.every((c) => valor(a, c.tipo) !== undefined)) return false
    const cumple = r.condiciones.every((c) => valor(a, c.tipo) === c.valor)
    return r.efecto === 'rechaza' ? cumple : !cumple
  })
  return chocan.find((a) => a.preparacionId !== null) ?? chocan[0] ?? null // primero lo del catálogo: es el choque seguro
}

/** Lo del chico que el código cruza con la salida: el relato (para el dicho) y sus alergias. */
export interface ContextoPerfil {
  relato?: string
  alergias?: readonly Alergeno[]
  alergiasOtras?: readonly string[]
}

type CatalogoPerfil = Pick<PreparacionCatalogo, 'id' | 'nombre'> & Partial<Pick<PreparacionCatalogo, 'atributos' | 'ingredientes' | 'momentos'>>

/**
 * Lo que el código no le deja al modelo. Pura: la usan extraerPerfil() y los tests.
 * - preparacionId: tiene que existir y pasar verificarId() contra lo que dijo la familia (y sus alergias, en acepta);
 *   si no, null (se queda con los atributos y los ingredientes del modelo). Con id, los atributos son los del catálogo
 *   y no lleva ingredientes: el catálogo es la convención.
 * - dicho: solo si está tal cual en el relato. Atributos del vocabulario, momentos de MOMENTO, ingredientes válidos y
 *   sin lo que choca con una alergia (con una duda que lo dice).
 * - Lo que se evita por alergia no queda en rechaza ni en reglas. Una regla de atributos que choca con algo que acepta
 *   del catálogo, o que generaliza un grupo, queda solo como texto (la familia la ve y la corrige; el grafo no la usa).
 */
export function depurarPerfil(salida: SalidaPerfil, catalogo: CatalogoPerfil[], ctx: ContextoPerfil = {}): PerfilBorrador {
  const porId = new Map(catalogo.map((p) => [p.id, p]))
  const alergias = ctx.alergias ?? []
  const alergiasOtras = ctx.alergiasOtras ?? []
  const limpio = (s: string | null | undefined) => s?.replace(/\s+/g, ' ').trim() ?? ''

  /** El id que queda (o null) y lo que dijo la familia, si está en el relato. */
  function identificar(x: { dicho: string; nombre: string; preparacionId: string | null }, conAlergias: boolean) {
    const nombre = limpio(x.nombre)
    const crudo = limpio(x.dicho)
    const dicho = crudo && (!ctx.relato || citaEnTranscripcion(crudo, ctx.relato)) ? crudo : undefined
    let prep = x.preparacionId ? porId.get(x.preparacionId) : undefined
    if (prep) {
      const motivo = verificarId(dicho ?? nombre, prep, conAlergias ? alergias : [], conAlergias ? alergiasOtras : [])
      if (motivo) {
        console.warn(JSON.stringify({ evento: 'perfil', aviso: 'id_descartado', id: prep.id, nombre, motivo }))
        prep = undefined
      }
    }
    return { nombre, dicho, prep }
  }

  const acepta: PerfilBorrador['acepta'] = salida.acepta.map((a) => {
    const { nombre, dicho, prep } = identificar(a, true)
    const marca = limpio(a.marca)
    const momentos = momentosValidos(a.momentos)
    const base = { nombre, preparacionId: prep?.id ?? null, ...(dicho ? { dicho } : {}), ...(marca ? { marca } : {}) }
    if (prep) {
      const deCatalogo = momentos.length ? momentos : (prep.momentos ?? [])
      const duda = dudaRelevante(limpio(a.duda), alergias, alergiasOtras)
      return {
        ...base,
        atributos: prep.atributos ? { ...prep.atributos } : atributosValidos(a.atributos),
        ...(deCatalogo.length ? { momentos: deCatalogo } : {}),
        ...(duda ? { duda } : {}),
      }
    }
    const atributos = atributosValidos(a.atributos)
    const { ingredientes, sacados } = ingredientesValidos(a.ingredientes, alergias, alergiasOtras)
    const duda = dudaRelevante(limpio(a.duda), alergias, alergiasOtras) || dudaPorAlergia(nombre, sacados)
    return {
      ...base,
      atributos,
      ingredientes,
      ...(momentos.length ? { momentos } : {}),
      ...(Object.keys(atributos).length || ingredientes.length ? { inferido: true } : {}),
      ...(duda ? { duda } : {}),
    }
  })

  const rechaza: PerfilBorrador['rechaza'] = salida.rechaza
    .filter((r) => !r.porAlergia)
    .map((r) => {
      const { nombre, dicho, prep } = identificar(r, false)
      const atributos = prep?.atributos ? { ...prep.atributos } : atributosValidos(r.atributos)
      return {
        nombre,
        preparacionId: prep?.id ?? null,
        ...(dicho ? { dicho } : {}),
        ...(Object.keys(atributos).length ? { atributos } : {}),
        ...(!prep && Object.keys(atributos).length ? { inferido: true } : {}),
        motivo: delVocabulario(MOTIVO, r.motivo) ?? 'otro',
      }
    })

  const aceptaUnicos = unicos(acepta, (a) => a.nombre)
  // Una regla que choca con lo que come queda solo como texto cuando el choque es seguro: con algo del catálogo (sus
  // atributos son curados) o si generaliza un grupo ("no comemos carne" → grupo=proteina, y come milanesa de soja; el
  // "no come queso" → lácteos de la eval). Si es sensorial ("nada mezclado") y choca solo con un atributo inferido (la
  // pizza "mezclado"), la familia la dijo con todas las letras: lo dudoso es el atributo y la regla queda.
  const reglas = salida.reglas.flatMap((r) => reglaValida(r) ?? []).map((r) => {
    const choca = choqueConLoQueAcepta(r, aceptaUnicos)
    if (!choca) return r
    const seguro = choca.preparacionId !== null || r.condiciones.some((c) => c.tipo === 'grupo')
    console.warn(JSON.stringify({ evento: 'perfil', aviso: seguro ? 'regla_contradictoria' : 'regla_choca_con_inferido', regla: r.texto, condiciones: r.condiciones, acepta: choca.nombre }))
    return seguro ? { ...r, condiciones: [] } : r
  })

  return {
    acepta: aceptaUnicos,
    rechaza: unicos(rechaza, (r) => r.nombre),
    reglas: unicos(reglas, (r) => r.texto),
  }
}

// ---------- Los datos del chico (A8b, código, nunca IA) ----------
const ALERTAS = ['bajo_peso', 'arcadas_vomitos', 'menos_15_alimentos'] as const

// Cómo se nombran los de ALERGENO en el relato: lo que cae acá no es una "otra" alergia.
const SINONIMOS_ALERGENO: [Alergeno, string[]][] = [
  ['leche', ['leche', 'lactosa', 'lacteo', 'caseina', 'proteina de la leche', 'aplv']],
  ['huevo', ['huevo', 'clara', 'yema']],
  ['gluten', ['gluten', 'celiac', 'tacc', 'trigo']],
  ['mani', ['mani', 'cacahuate']],
  ['frutos_secos', ['frutos secos', 'fruto seco', 'nuez', 'nueces', 'almendra', 'avellana', 'castana', 'pistacho']],
  ['soja', ['soja', 'soya']],
  ['pescado', ['pescado', 'merluza', 'atun', 'salmon']],
  ['mariscos', ['marisco', 'camaron', 'langostino', 'mejillon', 'crustaceo']],
  ['sesamo', ['sesamo']],
]

/** El ALERGENO que nombra el texto ("lactosa" → leche, "celíaco" → gluten), o undefined. */
export function aAlergeno(texto: string): Alergeno | undefined {
  const t = ` ${normalizar(texto).replace(/_/g, ' ')} `
  return alergenoDe(texto) ?? SINONIMOS_ALERGENO.find(([, nombres]) => nombres.some((n) => t.includes(` ${n}`)))?.[0]
}
const SEXOS = ['masculino', 'femenino'] as const

/**
 * Lo que dijo la familia de su hijo, pasado en limpio: sin cita que esté en el relato no hay dato, los valores fuera
 * del vocabulario o de un rango posible para un chico se descartan, y las alergias no se repiten.
 */
export function depurarDatos(x: SalidaDatos, relato: string): DatosExtraidos {
  const conCita = <T>(d: { valor: T; cita: string } | null, valido: (v: T) => boolean): DatoCitado<T> | undefined =>
    d && d.cita?.trim() && citaEnTranscripcion(d.cita, relato) && valido(d.valor) ? { valor: d.valor, cita: d.cita.trim() } : undefined
  const enRango = (min: number, max: number) => (v: number) => Number.isFinite(v) && v >= min && v <= max
  const nombre = conCita(x.nombre ? { ...x.nombre, valor: x.nombre.valor.replace(/\s+/g, ' ').trim() } : null, (v) => v.length > 0 && v.length <= 40)
  const sexo = x.sexo ? delVocabulario(SEXOS, x.sexo.valor) : undefined
  const dieta = x.dieta ? delVocabulario(DIETA, x.dieta.valor) : undefined
  const alergias = new Map<Alergeno, DatoCitado<Alergeno>>()
  for (const a of x.alergiasMencionadas) {
    const v = delVocabulario(ALERGENO, a.valor)
    if (v && !alergias.has(v) && a.cita?.trim() && citaEnTranscripcion(a.cita, relato)) alergias.set(v, { valor: v, cita: a.cita.trim() })
  }
  // v5.8 · Las que no están en ALERGENO, como las dijo ("kiwi"); las que son de ALERGENO con otro nombre, no
  const otras = new Map<string, DatoCitado<string>>()
  for (const a of x.otrasAlergiasMencionadas ?? []) {
    const valor = a.valor.replace(/\s+/g, ' ').trim()
    const clave = normalizar(valor)
    if (!clave || valor.length > 40 || otras.has(clave) || aAlergeno(valor)) continue
    if (a.cita?.trim() && citaEnTranscripcion(a.cita, relato)) otras.set(clave, { valor, cita: a.cita.trim() })
  }
  const alertas = new Map<(typeof ALERTAS)[number], DatoCitado<(typeof ALERTAS)[number]>>()
  for (const a of x.alertas) {
    const v = delVocabulario(ALERTAS, a.valor)
    if (v && !alertas.has(v) && a.cita?.trim() && citaEnTranscripcion(a.cita, relato)) alertas.set(v, { valor: v, cita: a.cita.trim() })
  }
  const marca = (d: { cita: string } | null) => (d?.cita?.trim() && citaEnTranscripcion(d.cita, relato) ? { valor: true as const, cita: d.cita.trim() } : undefined)
  const edad = conCita(x.edad, enRango(0, 18))
  const pesoKg = conCita(x.pesoKg, enRango(3, 150))
  const tallaCm = conCita(x.tallaCm, enRango(40, 210))
  const sinAlergias = alergias.size || otras.size ? undefined : marca(x.sinAlergias)
  const atragantamiento = marca(x.atragantamiento)
  const sexoCitado = sexo && x.sexo ? conCita({ valor: sexo, cita: x.sexo.cita }, () => true) : undefined
  const dietaCitada = dieta && x.dieta ? conCita({ valor: dieta, cita: x.dieta.cita }, () => true) : undefined
  const suplementos = conCita(x.suplementos, (v) => v.trim().length > 0)
  return {
    ...(nombre ? { nombre } : {}),
    ...(edad ? { edad } : {}),
    ...(sexoCitado ? { sexo: sexoCitado } : {}),
    ...(pesoKg ? { pesoKg } : {}),
    ...(tallaCm ? { tallaCm } : {}),
    alergiasMencionadas: [...alergias.values()],
    ...(otras.size ? { otrasAlergiasMencionadas: [...otras.values()] } : {}),
    ...(sinAlergias ? { sinAlergias } : {}),
    alertas: [...alertas.values()],
    ...(atragantamiento ? { atragantamiento } : {}),
    ...(dietaCitada ? { dieta: dietaCitada } : {}),
    ...(suplementos ? { suplementos } : {}),
  }
}

/** Lo vital que no dijo (§5.2), en el orden de CAMPO_VITAL: la pantalla lo pregunta antes de crear el perfil. */
export function faltanVitales(d: DatosExtraidos, b: Pick<PerfilBorrador, 'acepta' | 'rechaza'>): CampoVital[] {
  const f: CampoVital[] = []
  if (!d.nombre) f.push('nombre')
  if (!d.edad) f.push('edad')
  if (!d.sexo) f.push('sexo')
  if (!d.alergiasMencionadas.length && !d.otrasAlergiasMencionadas?.length && !d.sinAlergias) f.push('alergias')
  if (!b.acepta.length) f.push('acepta')
  if (!b.rechaza.length) f.push('rechaza')
  return f
}

export async function extraerDatos(texto: string): Promise<DatosExtraidos> {
  const { datos } = await generarJSON({
    tarea: 'perfil',
    sistema: SISTEMA_DATOS,
    partes: [{ tipo: 'texto', texto: mensajeDatos(texto) }],
    schema: esquemaSalidaDatos,
  })
  return depurarDatos(datos, texto)
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
/**
 * La foto de la indicación → sus objetivos diarios, o undefined si no se lee o no trae ninguno válido.
 * Nunca hace fallar al perfil: si la llamada falla, el perfil sale igual y queda en el log.
 */
export async function leerIndicacion(fotoBase64: string, chico: { nombre: string; edad: number }): Promise<Partial<Nutrientes> | undefined> {
  try {
    const { datos } = await generarJSON({
      tarea: 'perfil',
      sistema: SISTEMA_INDICACION,
      partes: [{ tipo: 'imagen', base64: fotoBase64, mime: 'image/jpeg' }, { tipo: 'texto', texto: mensajeIndicacion(chico) }],
      schema: esquemaSalidaIndicacion,
    })
    const { objetivos, descartes } = depurarIndicacion(datos)
    if (descartes.length) console.warn(JSON.stringify({ evento: 'perfil', aviso: 'objetivos_descartados', descartes }))
    return Object.keys(objetivos).length ? objetivos : undefined
  } catch (e) {
    console.warn(JSON.stringify({ evento: 'perfil', aviso: 'indicacion_no_leida', error: e instanceof Error ? e.message : String(e) }))
    return undefined
  }
}

export async function extraerPerfil(req: PerfilInicialReq): Promise<PerfilBorrador> {
  const texto = req.texto.trim()
  if (!texto) throw new ErrorNibble('entrada_invalida', 'Contanos cómo come para armar su perfil.', { campo: 'texto' })
  const catalogo = preparaciones()
  // A8b · Sin datos (alta por voz), los datos del chico salen del mismo relato, en paralelo con el perfil
  const extraidos = req.datos ? undefined : extraerDatos(texto)
  const chico = req.datos ? { nombre: req.datos.nombre, edad: req.datos.edad } : undefined
  // v5.8 · Con los datos, el modelo conoce sus alergias para elegir la versión que come; en el alta por voz están en el relato
  const alergiasDatos = req.datos ? [...req.datos.alergias, ...(req.datos.alergiasOtras ?? [])] : []
  // El relato y la foto van en paralelo: la foto suma su latencia solo si tarda más que el relato.
  const [salida, objetivos, datos] = await Promise.all([
    generarJSON({
      tarea: 'perfil',
      sistema: sistemaPerfil(alimentos()),
      partes: [{ tipo: 'texto', texto: mensajePerfil({ ...(chico ?? {}), alergias: alergiasDatos, catalogo, texto }) }],
      schema: esquemaPerfil(idsIngredientes()),
    }).then((r) => r.datos),
    !req.fotoIndicacionBase64 ? undefined
      // Con los datos, la foto sale ya; en el alta por voz, cuando se sabe el nombre y la edad
      : chico ? leerIndicacion(req.fotoIndicacionBase64, chico)
      : extraidos!.then((d) => leerIndicacion(req.fotoIndicacionBase64!, { nombre: d.nombre?.valor ?? 'el chico', edad: d.edad?.valor ?? 0 })),
    extraidos,
  ])
  // v5.8 · Las alergias (las que cargó el padre o, en el alta por voz, las que dijo) entran a la verificación de los ids
  const perfil = depurarPerfil(salida, catalogo, {
    relato: texto,
    alergias: req.datos?.alergias ?? datos?.alergiasMencionadas.map((a) => a.valor) ?? [],
    alergiasOtras: req.datos?.alergiasOtras ?? datos?.otrasAlergiasMencionadas?.map((a) => a.valor) ?? [],
  })
  const borrador: PerfilBorrador = objetivos ? { ...perfil, objetivosNutricionista: objetivos } : perfil
  return datos ? { ...borrador, datos, faltan: faltanVitales(datos, borrador) } : borrador
}
