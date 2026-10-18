// Lógica pura del perfil (C6): el formulario de datos básicos (lo usa "Esto entendí" y, hasta A8b, PasoDatos), las ediciones de "Esto entendí" y el armado
// de CrearPerfilReq. Sin React, para poder testearla (borrador.test.ts).
import { ALERGENO, type Alergeno, type CrearPerfilReq, type DatosBasicos, type Dieta, type Motivo, type PatronVista, type Perfil, type PerfilBorrador } from '../../../shared/contratos'

export type Senal = DatosBasicos['alertas'][number]
export const SENALES: readonly Senal[] = ['bajo_peso', 'arcadas_vomitos', 'menos_15_alimentos']

/** El formulario guarda texto tal como lo escribe el padre; se convierte a DatosBasicos al validar. */
export interface FormDatos {
  nombre: string
  edad: string
  sexo: DatosBasicos['sexo'] | ''
  pesoKg: string
  tallaCm: string
  alergias: Alergeno[]
  alertas: Senal[]
  dieta: Dieta
  suplementos: string
}
export type CampoDatos = 'nombre' | 'edad' | 'sexo' | 'pesoKg' | 'tallaCm'
export type ErroresDatos = Partial<Record<CampoDatos, string>>

export function formVacio(): FormDatos {
  return { nombre: '', edad: '', sexo: '', pesoKg: '', tallaCm: '', alergias: [], alertas: [], dieta: 'ninguna', suplementos: '' }
}

export function formDesde(d: DatosBasicos): FormDatos {
  return {
    nombre: d.nombre, edad: String(d.edad), sexo: d.sexo,
    pesoKg: d.pesoKg === undefined ? '' : String(d.pesoKg).replace('.', ','),
    tallaCm: d.tallaCm === undefined ? '' : String(d.tallaCm),
    alergias: [...d.alergias], alertas: [...d.alertas], dieta: d.dieta, suplementos: d.suplementos ?? '',
  }
}

/** '' → undefined · '21,5' → 21.5 · 'abc' → NaN (acepta coma decimal, como se escribe en Uruguay). */
export function leerNumero(texto: string): number | undefined {
  const t = texto.trim().replace(',', '.')
  if (!t) return undefined
  return /^\d+(\.\d+)?$/.test(t) ? Number(t) : Number.NaN
}

/** Agrega o saca `valor`, conservando el orden del vocabulario (así el JSON sale siempre igual). */
export function alternar<T extends string>(lista: readonly T[], valor: T, orden: readonly T[]): T[] {
  const set = new Set(lista)
  if (set.has(valor)) set.delete(valor)
  else set.add(valor)
  return orden.filter((v) => set.has(v))
}
export const alternarAlergia = (lista: Alergeno[], a: Alergeno) => alternar(lista, a, ALERGENO)
export const alternarSenal = (lista: Senal[], s: Senal) => alternar(lista, s, SENALES)

export type Validacion = { ok: true; datos: DatosBasicos } | { ok: false; errores: ErroresDatos }

export function validarDatos(f: FormDatos): Validacion {
  const errores: ErroresDatos = {}
  const nombre = f.nombre.trim().replace(/\s+/g, ' ')
  if (!nombre) errores.nombre = 'Escribí su nombre (o un apodo).'
  const edad = leerNumero(f.edad)
  if (edad === undefined) errores.edad = 'Escribí su edad en años.'
  else if (!Number.isInteger(edad) || edad < 1 || edad > 18) errores.edad = 'La edad va de 1 a 18 años.'
  if (!f.sexo) errores.sexo = 'Elegí una opción: la usamos para sus referencias de nutrientes.'
  const pesoKg = leerNumero(f.pesoKg)
  if (pesoKg !== undefined && !(pesoKg >= 3 && pesoKg <= 150)) errores.pesoKg = 'Revisá el peso: va en kilos, por ejemplo 21 o 21,5.'
  const tallaCm = leerNumero(f.tallaCm)
  if (tallaCm !== undefined && !(tallaCm >= 40 && tallaCm <= 210)) errores.tallaCm = 'Revisá la talla: va en centímetros, por ejemplo 116.'
  if (Object.keys(errores).length || edad === undefined || !f.sexo) return { ok: false, errores }

  const suplementos = f.suplementos.trim()
  const datos: DatosBasicos = {
    nombre, edad, sexo: f.sexo,
    ...(pesoKg === undefined ? {} : { pesoKg }),
    ...(tallaCm === undefined ? {} : { tallaCm }),
    alergias: [...f.alergias], alertas: [...f.alertas], dieta: f.dieta,
    ...(suplementos ? { suplementos } : {}),
  }
  return { ok: true, datos }
}

/** El orden en que se enfoca el primer campo con error. */
export const ORDEN_CAMPOS: CampoDatos[] = ['nombre', 'edad', 'sexo', 'pesoKg', 'tallaCm']

/** El audio nuevo se suma a lo que ya estaba escrito. */
export function sumarNota(previo: string, nuevo: string): string {
  const p = previo.trim()
  return p ? `${p} ${nuevo}` : nuevo
}

// ---------- "Esto entendí": ediciones del borrador (siempre devuelven uno nuevo) ----------

const limpio = (s: string) => s.trim().replace(/\s+/g, ' ')
/** Para comparar nombres: sin mayúsculas, tildes ni espacios de más. */
export const clave = (s: string) => limpio(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

export const borradorVacio = (): PerfilBorrador => ({ acepta: [], rechaza: [], reglas: [] })

const quitar = <T>(lista: T[], i: number) => lista.filter((_, j) => j !== i)

export function quitarAcepta(b: PerfilBorrador, i: number): PerfilBorrador {
  return { ...b, acepta: quitar(b.acepta, i) }
}

/**
 * Renombrar un alimento seguro. Si el nombre cambia de verdad (no solo mayúsculas o tildes), deja de ser
 * la preparación que reconoció la IA: va sin preparacionId ni atributos y el back la resuelve por nombre.
 */
export function renombrarAcepta(b: PerfilBorrador, i: number, nombre: string): PerfilBorrador {
  const nuevo = limpio(nombre)
  const actual = b.acepta[i]
  if (!actual || !nuevo) return b
  const mismo = clave(nuevo) === clave(actual.nombre)
  const item = mismo ? { ...actual, nombre: nuevo } : { ...actual, nombre: nuevo, preparacionId: null, atributos: {} }
  return { ...b, acepta: b.acepta.map((a, j) => (j === i ? item : a)) }
}

export function agregarAcepta(b: PerfilBorrador, nombre: string): PerfilBorrador {
  const n = limpio(nombre)
  if (!n || b.acepta.some((a) => clave(a.nombre) === clave(n))) return b
  return { ...b, acepta: [...b.acepta, { nombre: n, preparacionId: null, atributos: {} }] }
}

export function quitarRechaza(b: PerfilBorrador, i: number): PerfilBorrador {
  return { ...b, rechaza: quitar(b.rechaza, i) }
}

export function cambiarMotivo(b: PerfilBorrador, i: number, motivo: Motivo): PerfilBorrador {
  return { ...b, rechaza: b.rechaza.map((r, j) => (j === i ? { ...r, motivo } : r)) }
}

export function agregarRechaza(b: PerfilBorrador, nombre: string, motivo: Motivo = 'otro'): PerfilBorrador {
  const n = limpio(nombre)
  if (!n || b.rechaza.some((r) => clave(r.nombre) === clave(n))) return b
  return { ...b, rechaza: [...b.rechaza, { nombre: n, preparacionId: null, motivo }] }
}

export function quitarRegla(b: PerfilBorrador, i: number): PerfilBorrador {
  return { ...b, reglas: quitar(b.reglas, i) }
}

/**
 * Regla escrita a mano: va con efecto 'rechaza' y sin condiciones, porque traducirla al vocabulario
 * (color=verde, distribucion=tocandose…) lo hace la IA. El back la guarda como texto hasta que haya condiciones.
 */
export function agregarRegla(b: PerfilBorrador, texto: string): PerfilBorrador {
  const t = limpio(texto)
  if (!t || b.reglas.some((r) => clave(r.texto) === clave(t))) return b
  return { ...b, reglas: [...b.reglas, { texto: t, condiciones: [], efecto: 'rechaza' }] }
}

/** El cuerpo de POST /api/perfil: nombres limpios, sin vacíos ni repetidos. */
export function armarCrearPerfilReq(datos: DatosBasicos, b: PerfilBorrador): CrearPerfilReq {
  const unico = <T>(lista: T[], k: (x: T) => string) => {
    const vistos = new Set<string>()
    return lista.filter((x) => {
      const c = k(x)
      if (!c || vistos.has(c)) return false
      vistos.add(c)
      return true
    })
  }
  const borrador: PerfilBorrador = {
    acepta: unico(b.acepta.map((a) => ({ ...a, nombre: limpio(a.nombre) })), (a) => clave(a.nombre)),
    rechaza: unico(b.rechaza.map((r) => ({ ...r, nombre: limpio(r.nombre) })), (r) => clave(r.nombre)),
    reglas: unico(b.reglas.map((r) => ({ ...r, texto: limpio(r.texto) })), (r) => clave(r.texto)),
    ...(b.objetivosNutricionista ? { objetivosNutricionista: b.objetivosNutricionista } : {}),
  }
  return { datos, borrador }
}

// ---------- Vista del perfil ----------

type Preparacion = Perfil['preparaciones'][number]

/** Acepta (por puntaje) · En proceso y Todavía no (por veces que se ofreció: lo más explorado arriba). */
export function agruparPreparaciones(lista: Preparacion[]) {
  const de = (estado: Preparacion['estado']) => lista.filter((p) => p.estado === estado)
  return {
    acepta: de('acepta').sort((a, b) => b.puntaje - a.puntaje || b.veces - a.veces),
    enProceso: de('en_proceso').sort((a, b) => b.veces - a.veces || b.puntaje - a.puntaje),
    todaviaNo: de('rechaza').sort((a, b) => b.veces - a.veces),
  }
}

export function separarPatrones(lista: PatronVista[]) {
  const orden = (a: PatronVista, b: PatronVista) => b.confianza - a.confianza
  return {
    aprendidos: lista.filter((p) => p.fuente === 'aprendido').sort(orden),
    investigacion: lista.filter((p) => p.fuente === 'investigacion').sort(orden),
  }
}

export const textoVeces = (n: number) => (n === 1 ? '1 vez' : `${n} veces`)
/** Lo que contó el padre al crear el perfil todavía no pasó por el plato (veces = 0): no se dice "0 veces". */
export const textoEnElPlato = (n: number) => (n > 0 ? `${textoVeces(n)} en el plato` : 'Según lo que contaste')

export function textoConfianza(c: number): string {
  if (c >= 0.75) return 'Bastante claro'
  if (c >= 0.5) return 'Probable'
  return 'Por confirmar'
}
