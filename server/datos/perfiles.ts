// POST /api/perfil (B8): crea el chico desde el borrador que confirmó el padre. GET /api/perfil: su Perfil (§5).
import { randomBytes } from 'node:crypto'
import type { AlimentoDeclarado, Atributos, DatosBasicos, Momento, Perfil, PerfilBorrador, PreparacionCatalogo } from '../../shared/contratos.js'
import { MOMENTO } from '../../shared/contratos.js'
import { calcularEstado } from '../aprendizaje/estado.js'
import { slug } from '../aprendizaje/textos.js'
import { almacen, sinFrenar } from '../grafo/almacen.js'
import { ErrorNibble } from '../http.js'
import { completarAlimentos } from '../ia/completar.js'
import { patronesVista } from '../nutricion/progreso.js'
import { alimentosCatalogo, preparacionesCatalogo } from './catalogos.js'
import { cargarNino, objetivoDe } from './cargar.js'
import { asegurarIndices, col } from './mongo.js'
import type { NinoDoc } from './tipos.js'
import { ATRIBUTOS_VOCABULARIO } from './validar.js'

export interface NuevoPerfil {
  datos: DatosBasicos
  borrador: PerfilBorrador
  ninoId?: string // solo para scripts y demo (Tomás vive en ?nino=tomas)
}

const nuevoId = (nombre: string) => `${slug(nombre).slice(0, 24) || 'nino'}-${randomBytes(3).toString('hex')}`

export interface OpcionesCrear {
  reemplazar?: boolean
  ahora?: Date
  completar?: boolean // false: se guarda el borrador tal cual (sin la llamada al modelo)
  limiteMs?: number   // cuánto se espera al modelo antes de seguir con lo que contó el padre
}

export async function crearPerfil(p: NuevoPerfil, op: OpcionesCrear = {}): Promise<{ ninoId: string }> {
  await asegurarIndices()
  const ahora = (op.ahora ?? new Date()).toISOString()
  // Antes de razonar: lo declarado que no es del catálogo y viene incompleto se completa (atributos, ingredientes, momentos)
  const borrador = op.completar === false ? p.borrador : await completarBorrador(p.borrador, p.datos, op)
  const nino: NinoDoc = {
    _id: p.ninoId ?? nuevoId(p.datos.nombre),
    datos: p.datos,
    borrador,
    reglas: borrador.reglas,
    ...(borrador.objetivosNutricionista ? { objetivosNutricionista: borrador.objetivosNutricionista } : {}),
    creadoISO: ahora,
    actualizadoISO: ahora,
  }
  if (op.reemplazar) {
    await col.comidas().deleteMany({ ninoId: nino._id })
    await col.ninos().replaceOne({ _id: nino._id }, nino, { upsert: true })
    await sinFrenar('borrar el chico del grafo', () => almacen().borrarNino(nino._id))
  } else {
    try {
      await col.ninos().insertOne(nino)
    } catch (e) {
      if ((e as { code?: number }).code === 11000) throw new ErrorNibble('entrada_invalida', `Ya existe el perfil "${nino._id}".`)
      throw e
    }
  }
  // El conocimiento inicial: lo que contó el padre y los patrones de investigación (§10.2)
  const estado = calcularEstado(nino, [], preparacionesCatalogo())
  await sinFrenar('escribir el chico en el grafo', () => almacen().escribirNino(nino, objetivoDe(nino), estado))
  await col.ninos().updateOne({ _id: nino._id }, { $set: { patrones: estado.patrones.map(guardarPatron) } })
  return { ninoId: nino._id }
}

// ---------- Lo declarado, completo ----------
// Las relaciones entre alimentos (food chaining) se calculan con los 8 atributos y los ingredientes. Un "Sushi" guardado
// solo con {temperatura, grupo, cocción} y sin ingredientes terminaba "parecido" a la chocolatada. Lo que no es del
// catálogo y viene incompleto se completa con lo típico (server/ia/completar.ts, una llamada a Haiku) ANTES de guardarlo.
// Nunca se pierde lo que dijo el padre: el nombre, sus palabras (`dicho`) y los atributos que ya traía mandan.

type Declarado = PerfilBorrador['acepta'][number] | PerfilBorrador['rechaza'][number]

const LIMITE_COMPLETAR_MS = Number(process.env.COMPLETAR_LIMITE_MS) || 8000
const CLAVES_ATRIBUTOS = Object.keys(ATRIBUTOS_VOCABULARIO) as (keyof Atributos)[]

/** Le faltan atributos (de los 8), ingredientes o momentos. Solo lo que no es del catálogo (el catálogo ya está completo). */
export function declaradoIncompleto(a: Declarado): boolean {
  if (a.preparacionId !== null) return false
  const atr = a.atributos ?? {}
  return CLAVES_ATRIBUTOS.some((k) => !atr[k]) || !a.ingredientes?.length || !a.momentos?.length
}

/** Solo los valores del vocabulario cerrado (lo que vuelve del modelo no se guarda sin mirar). */
function atributosValidos(x: Partial<Atributos> | undefined): Partial<Atributos> {
  const r: Partial<Record<keyof Atributos, string>> = {}
  for (const k of CLAVES_ATRIBUTOS) {
    const v = x?.[k]
    if (typeof v === 'string' && (ATRIBUTOS_VOCABULARIO[k] as readonly string[]).includes(v)) r[k] = v
  }
  return r as Partial<Atributos>
}

function unir<T extends Declarado>(original: T, nuevo: AlimentoDeclarado | undefined): T {
  if (!nuevo) return original
  const ingredientes = original.ingredientes?.length
    ? original.ingredientes
    : (nuevo.ingredientes ?? []).filter((i) => typeof i?.alimentoId === 'string' && i.alimentoId && Number.isFinite(i.gramos) && i.gramos > 0)
  const momentos: Momento[] = original.momentos?.length ? original.momentos : MOMENTO.filter((m) => nuevo.momentos?.includes(m))
  const duda = original.duda ?? (typeof nuevo.duda === 'string' && nuevo.duda.trim() ? nuevo.duda.trim().slice(0, 300) : undefined)
  const inferido = original.inferido === true || nuevo.inferido === true
  const atributos = { ...atributosValidos(nuevo.atributos), ...atributosValidos(original.atributos) }
  // El grupo es el del ingrediente principal (convención del catálogo): el "Sushi" de la extracción vieja venía como
  // grupo otro y es arroz. Los padres no dicen el grupo, así que corregirlo no pisa nada que hayan contado.
  const principal = [...ingredientes].sort((a, b) => b.gramos - a.gramos)[0]?.alimentoId
  const grupoPrincipal = principal ? alimentosCatalogo().get(principal)?.grupo : undefined
  if (grupoPrincipal) atributos.grupo = grupoPrincipal
  return {
    ...original,
    atributos,
    ...(ingredientes.length ? { ingredientes } : {}),
    ...(momentos.length ? { momentos } : {}),
    ...(inferido ? { inferido } : {}),
    ...(duda ? { duda } : {}),
  }
}

/** Lo que el padre nombró igual que una preparación del catálogo pasa a ser esa (con los atributos del catálogo). */
function delCatalogo<T extends Declarado>(a: T, porNombre: ReadonlyMap<string, PreparacionCatalogo>): T {
  if (a.preparacionId !== null) return a
  const p = porNombre.get(slug(a.nombre))
  if (!p) return a
  const r: T = { ...a, preparacionId: p.id, atributos: { ...p.atributos }, ...(a.momentos?.length || !p.momentos ? {} : { momentos: [...p.momentos] }) }
  delete r.ingredientes // los ingredientes son los del catálogo
  return r
}

async function conLimite<T>(promesa: Promise<T>, ms: number): Promise<T> {
  let reloj: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promesa,
      new Promise<never>((_, rechazar) => {
        reloj = setTimeout(() => rechazar(new Error(`tardó más de ${ms} ms`)), ms)
      }),
    ])
  } finally {
    clearTimeout(reloj)
  }
}

/**
 * Completa lo declarado (lo que acepta y lo que rechaza) que no es del catálogo y viene incompleto. Una sola llamada
 * al modelo, con las alergias (y las otras), la dieta y la edad del chico. Si tarda o falla, sigue con lo original:
 * crear el perfil nunca falla por esto. Lo usan crearPerfil y scripts/completar-perfiles.ts.
 */
export async function completarBorrador(
  borrador: PerfilBorrador,
  datos: DatosBasicos,
  op: { limiteMs?: number; catalogo?: ReadonlyMap<string, PreparacionCatalogo> } = {},
): Promise<PerfilBorrador> {
  const catalogo = op.catalogo ?? preparacionesCatalogo()
  const porNombre = new Map<string, PreparacionCatalogo>()
  for (const p of catalogo.values()) {
    porNombre.set(slug(p.nombre), p)
    porNombre.set(p.id, p)
  }
  const acepta = (borrador.acepta ?? []).map((a) => delCatalogo(a, porNombre))
  const rechaza = (borrador.rechaza ?? []).map((r) => delCatalogo(r, porNombre))
  const pendientes = [
    ...acepta.flatMap((a, i) => (declaradoIncompleto(a) ? [{ lista: 'acepta' as const, i, a: { ...a, atributos: a.atributos ?? {} } }] : [])),
    ...rechaza.flatMap((r, i) => (declaradoIncompleto(r) ? [{ lista: 'rechaza' as const, i, a: { ...r, atributos: r.atributos ?? {} } }] : [])),
  ]
  let completados: AlimentoDeclarado[] = []
  if (pendientes.length) {
    try {
      const r = await conLimite(
        completarAlimentos(pendientes.map((x) => x.a), {
          alergias: datos.alergias,
          ...(datos.alergiasOtras?.length ? { alergiasOtras: datos.alergiasOtras } : {}),
          dieta: datos.dieta,
          edad: datos.edad,
        }),
        op.limiteMs ?? LIMITE_COMPLETAR_MS,
      )
      // Vuelven en el mismo orden; si no, no se puede saber cuál es cuál y se sigue con lo original
      if (Array.isArray(r) && r.length === pendientes.length) completados = r
      else console.warn('[perfil] completar devolvió otra cantidad de alimentos: se guardan como vinieron')
    } catch (e) {
      console.warn('[perfil] no se pudieron completar los alimentos declarados:', (e as Error).message)
    }
  }
  pendientes.forEach((x, k) => {
    const nuevo = completados[k]
    if (x.lista === 'acepta') acepta[x.i] = unir(acepta[x.i] as PerfilBorrador['acepta'][number], nuevo)
    else rechaza[x.i] = unir(rechaza[x.i] as PerfilBorrador['rechaza'][number], nuevo)
  })
  return { ...borrador, acepta, rechaza }
}

export const guardarPatron = (p: { clave: string; texto: string; resultado: 'acepta' | 'rechaza'; n: number; media: number; fuente: 'aprendido' | 'investigacion' }) => ({
  clave: p.clave, texto: p.texto, resultado: p.resultado, apoyo: p.n, media: Math.round(p.media * 1000) / 1000, fuente: p.fuente,
})

export async function obtenerPerfil(ninoId: string): Promise<Perfil> {
  const c = await cargarNino(ninoId)
  const estado = calcularEstado(c.nino, c.comidas, c.catalogo)
  const orden = { acepta: 0, en_proceso: 1, rechaza: 2 }
  return {
    ninoId,
    datos: c.nino.datos,
    reglas: c.nino.reglas,
    patrones: patronesVista(estado.patrones),
    preparaciones: [...estado.estados.values()]
      .sort((a, b) => orden[a.estado] - orden[b.estado] || b.p - a.p)
      .map((e) => ({ id: e.prepId, nombre: e.nombre, estado: e.estado, puntaje: Math.round(e.p * 100) / 100, veces: e.veces })),
  }
}
