// Lógica pura del alta desde cero por voz (C6, PLAN §5.2), sin React, para testearla (alta.test.ts):
// - el pedido a /api/perfil-inicial (solo texto) y qué hacer si el back todavía pide `datos` (transición hasta A8b);
// - de `DatosExtraidos` (lo que dijo el padre, con citas) al formulario de "Esto entendí";
// - las alergias: una mencionada es una sugerencia y solo pasa a DatosBasicos.alergias si el padre la toca;
//   v5.8 · las otras ("kiwi"), igual: las mencionadas se tocan para confirmarlas y el padre puede sumar las suyas;
// - lo vital que falta (`faltan`) y la regla de cuándo se puede crear el perfil.
import {
  ALERGENO, CAMPO_VITAL, DIETA, type Alergeno, type CampoVital, type DatoCitado, type DatosBasicos, type DatosExtraidos,
  type ErrorApi, type PerfilBorrador, type PerfilInicialReq,
} from '../../../shared/contratos'
import { NOMBRE_ALERGENO } from '../../lib/vocabulario'
import { alternarAlergia, clave, formDesde, formVacio, leerNumero, SENALES, validarDatos, type ErroresDatos, type FormDatos } from './borrador'

// ---------- El pedido y la transición hasta A8b ----------

/**
 * El cuerpo de POST /api/perfil-inicial. En el alta por voz va solo `texto` (§5.2).
 * v5 §5.2: sin datos (A8b). `PerfilInicialReq.datos` sigue obligatorio en shared/contratos.ts hasta que A haga A8b;
 * por eso el cast. Con `datos` (la transición, abajo) es el pedido de siempre.
 */
export function pedidoPerfilInicial(texto: string, datos?: DatosBasicos): PerfilInicialReq {
  return (datos ? { datos, texto } : { texto }) as PerfilInicialReq
}

/**
 * TRANSICIÓN hasta A8b (borrar cuando /api/perfil-inicial acepte el pedido sin `datos`): hoy el back responde
 * 400 entrada_invalida si falta `datos`. En ese caso la pantalla pide los datos básicos a mano (PasoDatos) y reenvía.
 * Si el 400 trae el detalle de Zod y ningún problema es de `datos` (por ejemplo, el texto), no es este caso.
 */
export function pideDatosManuales(e: { status: number; cuerpo: ErrorApi }): boolean {
  if (e.status !== 400 || e.cuerpo.error.codigo !== 'entrada_invalida') return false
  const detalle = e.cuerpo.error.detalle
  if (!Array.isArray(detalle)) return true
  return detalle.some((i) => Array.isArray((i as { path?: unknown })?.path) && (i as { path: unknown[] }).path[0] === 'datos')
}

// ---------- Lo que vino de la IA, saneado ----------

const esCita = (x: unknown): x is string => typeof x === 'string' && x.trim().length > 0

/** Un DatoCitado válido o nada: sin cita textual no hay dato (§5.2), y el valor tiene que pasar `valido`. */
function citado<T>(x: unknown, valido: (v: unknown) => v is T): DatoCitado<T> | undefined {
  if (!x || typeof x !== 'object') return undefined
  const { valor, cita } = x as { valor?: unknown; cita?: unknown }
  return esCita(cita) && valido(valor) ? { valor, cita: cita.trim() } : undefined
}
const citados = <T>(x: unknown, valido: (v: unknown) => v is T): DatoCitado<T>[] =>
  Array.isArray(x) ? x.map((d) => citado(d, valido)).filter((d): d is DatoCitado<T> => !!d) : []

const de = <T extends string>(lista: readonly T[]) => (v: unknown): v is T => typeof v === 'string' && (lista as readonly string[]).includes(v)
const texto = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0
const entre = (min: number, max: number) => (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max
const edadValida = (v: unknown): v is number => entre(1, 18)(v) && Number.isInteger(v)
const verdadero = (v: unknown): v is true => v === true
const SEXO = ['masculino', 'femenino'] as const

/**
 * `borrador.datos` tal como lo puede mandar la IA, pasado en limpio: sin datos sin cita, sin valores fuera del
 * vocabulario y sin alergias repetidas. `undefined` si la respuesta no trajo `datos` (A antes de A8b).
 */
export function sanearExtraidos(x: unknown): DatosExtraidos | undefined {
  if (!x || typeof x !== 'object') return undefined
  const d = x as Record<string, unknown>
  const vistas = new Set<Alergeno>()
  const alergias = citados(d.alergiasMencionadas, de(ALERGENO)).filter((a) => !vistas.has(a.valor) && vistas.add(a.valor))
  // v5.8 · Las otras: sin repetir (sin mirar mayúsculas ni tildes) y sin las que ya son de las de siempre
  const vistasOtras = new Set<string>()
  const otras = citados(d.otrasAlergiasMencionadas, texto)
    .map((a) => ({ valor: a.valor.trim().replace(/\s+/g, ' ').slice(0, MAX_OTRA), cita: a.cita }))
    .filter((a) => !alergenoDeTexto(a.valor) && !vistasOtras.has(clave(a.valor)) && vistasOtras.add(clave(a.valor)))
  const opcionales = {
    nombre: citado(d.nombre, texto), edad: citado(d.edad, edadValida), sexo: citado(d.sexo, de(SEXO)),
    pesoKg: citado(d.pesoKg, entre(3, 150)), tallaCm: citado(d.tallaCm, entre(40, 210)),
    sinAlergias: citado(d.sinAlergias, verdadero), atragantamiento: citado(d.atragantamiento, verdadero),
    dieta: citado(d.dieta, de(DIETA)), suplementos: citado(d.suplementos, texto),
  }
  return {
    alergiasMencionadas: alergias,
    ...(otras.length ? { otrasAlergiasMencionadas: otras } : {}),
    alertas: citados(d.alertas, de(SENALES)),
    ...Object.fromEntries(Object.entries(opcionales).filter(([, v]) => v !== undefined)),
  }
}

// ---------- El estado de "Esto entendí" ----------

/** `form.alergias` son solo las que el padre confirmó tocándolas; `sinAlergias`, si confirmó "No tiene alergias". */
export interface Alta { form: FormDatos; sinAlergias: boolean }

const numeroAForm = (n: number | undefined) => (n === undefined ? '' : String(n).replace('.', ','))

/**
 * El estado inicial de "Esto entendí".
 * - Alta por voz: el formulario sale de lo extraído, con las alergias VACÍAS (las mencionadas son sugerencias).
 * - Transición (`manual`, los datos de PasoDatos): manda lo que escribió el padre; las alergias que marcó a mano
 *   ya están confirmadas.
 */
export function altaInicial(extraidos: DatosExtraidos | undefined, manual?: DatosBasicos): Alta {
  if (manual) return { form: formDesde(manual), sinAlergias: false }
  const d = extraidos
  return {
    form: {
      ...formVacio(),
      nombre: d?.nombre?.valor ?? '',
      edad: d?.edad ? String(d.edad.valor) : '',
      sexo: d?.sexo?.valor ?? '',
      pesoKg: numeroAForm(d?.pesoKg?.valor),
      tallaCm: numeroAForm(d?.tallaCm?.valor),
      alergias: [],
      alergiasOtras: [],
      alertas: SENALES.filter((s) => d?.alertas.some((a) => a.valor === s)),
      dieta: d?.dieta?.valor ?? 'ninguna',
      suplementos: d?.suplementos?.valor ?? '',
    },
    sinAlergias: false,
  }
}

/** Tocar una alergia la confirma (o la desconfirma). Confirmar una alergia apaga "No tiene alergias". */
export function tocarAlergia(alta: Alta, a: Alergeno): Alta {
  return { form: { ...alta.form, alergias: alternarAlergia(alta.form.alergias, a) }, sinAlergias: false }
}

/** "No tiene alergias": al confirmarlo se sacan las que estuvieran marcadas (también las otras). */
export function tocarSinAlergias(alta: Alta): Alta {
  const sinAlergias = !alta.sinAlergias
  const form = sinAlergias ? { ...alta.form, alergias: [], alergiasOtras: [] } : alta.form
  return { form, sinAlergias }
}

export const alergiasRespondidas = (alta: Alta) => alta.sinAlergias || alta.form.alergias.length > 0 || alta.form.alergiasOtras.length > 0

// ---------- Las otras alergias (v5.8) ----------

/** Lo más largo que se guarda de una alergia escrita a mano, y cuántas: lo que acepta POST /api/perfil (datos/validar.ts). */
export const MAX_OTRA = 40
export const MAX_OTRAS = 10

/** Si lo que escribió es una de las de siempre ("Huevo", "maní", "frutos secos"), cuál. */
export function alergenoDeTexto(texto: string): Alergeno | undefined {
  const k = clave(texto)
  return ALERGENO.find((a) => clave(NOMBRE_ALERGENO[a]) === k || clave(a.replace(/_/g, ' ')) === k)
}

/** Tocar una otra alergia (una mencionada en el audio) la confirma o la desconfirma. Confirmarla apaga "No tiene alergias". */
export function tocarAlergiaOtra(alta: Alta, otra: string): Alta {
  const ya = alta.form.alergiasOtras.some((o) => clave(o) === clave(otra))
  if (!ya && alta.form.alergiasOtras.length >= MAX_OTRAS) return alta
  const alergiasOtras = ya ? alta.form.alergiasOtras.filter((o) => clave(o) !== clave(otra)) : [...alta.form.alergiasOtras, otra]
  return { form: { ...alta.form, alergiasOtras }, sinAlergias: false }
}

/**
 * Sumar una alergia escrita a mano: si es una de las de siempre, se marca esa (así se cruza con la tabla de alimentos);
 * si no, va a las otras. Vacía o repetida, no cambia nada salvo apagar "No tiene alergias" si sumó una que ya estaba.
 */
export function agregarAlergiaOtra(alta: Alta, texto: string): Alta {
  const t = texto.trim().replace(/\s+/g, ' ').slice(0, MAX_OTRA)
  if (!t) return alta
  const fija = alergenoDeTexto(t)
  if (fija) return alta.form.alergias.includes(fija) ? { ...alta, sinAlergias: false } : tocarAlergia(alta, fija)
  if (alta.form.alergiasOtras.some((o) => clave(o) === clave(t))) return { ...alta, sinAlergias: false }
  if (alta.form.alergiasOtras.length >= MAX_OTRAS) return alta
  return { form: { ...alta.form, alergiasOtras: [...alta.form.alergiasOtras, t] }, sinAlergias: false }
}

export function quitarAlergiaOtra(alta: Alta, otra: string): Alta {
  return { ...alta, form: { ...alta.form, alergiasOtras: alta.form.alergiasOtras.filter((o) => clave(o) !== clave(otra)) } }
}

/**
 * La cita de un dato extraído, mientras el valor del formulario siga siendo el que dijo. Si el padre lo corrige,
 * la cita ya no lo justifica y deja de mostrarse.
 */
export function citaVigente<T extends string | number>(dato: DatoCitado<T> | undefined, valorForm: string): string | undefined {
  if (!dato) return undefined
  const igual = typeof dato.valor === 'number' ? leerNumero(valorForm) === dato.valor : clave(valorForm) === clave(dato.valor)
  return igual ? dato.cita : undefined
}

// ---------- Lo vital que falta ----------

/**
 * Lo vital que no mencionó (§5.2), en el orden de CAMPO_VITAL: lo que dijo la IA en `faltan` más lo que se deduce
 * de la respuesta (por si `faltan` no vino o se quedó corto). Si la respuesta no trajo `datos` (A antes de A8b) y no
 * hubo datos a mano, nombre, edad, sexo y alergias faltan todos.
 */
export function faltanDe(b: Pick<PerfilBorrador, 'acepta' | 'rechaza' | 'faltan'>, extraidos: DatosExtraidos | undefined, manual?: DatosBasicos): CampoVital[] {
  const f = new Set<CampoVital>((b.faltan ?? []).filter((c) => (CAMPO_VITAL as readonly string[]).includes(c)))
  if (manual) {
    // Los datos básicos los escribió el padre: lo único que puede faltar es la respuesta explícita sobre alergias.
    for (const c of ['nombre', 'edad', 'sexo'] as const) f.delete(c)
    if (manual.alergias.length || manual.alergiasOtras?.length) f.delete('alergias')
    else f.add('alergias')
  } else {
    if (!extraidos?.nombre) f.add('nombre')
    if (!extraidos?.edad) f.add('edad')
    if (!extraidos?.sexo) f.add('sexo')
    if (!extraidos?.alergiasMencionadas.length && !extraidos?.otrasAlergiasMencionadas?.length && !extraidos?.sinAlergias) f.add('alergias')
    // v5.8 · Una otra alergia mencionada ("es alérgico al kiwi") también es hablar de alergias, aunque `faltan` no lo sepa
    else if (extraidos?.otrasAlergiasMencionadas?.length) f.delete('alergias')
  }
  if (!b.acepta.length) f.add('acepta')
  if (!b.rechaza.length) f.add('rechaza')
  return CAMPO_VITAL.filter((c) => f.has(c))
}

const QUE_FALTA: Record<CampoVital, string> = {
  nombre: 'su nombre', edad: 'su edad', sexo: 'su sexo', alergias: 'si tiene alergias',
  acepta: 'algo que coma seguro', rechaza: 'qué no come',
}

/** "su edad y si tiene alergias" · `rechaza` no se nombra: se puede seguir sin eso. */
export function textoFaltan(faltan: CampoVital[]): string {
  const partes = faltan.filter((c) => c !== 'rechaza').map((c) => QUE_FALTA[c])
  if (partes.length <= 1) return partes[0] ?? ''
  return `${partes.slice(0, -1).join(', ')} y ${partes.at(-1)}`
}

// ---------- ¿Se puede crear? ----------

export type CampoAlta = keyof ErroresDatos | 'alergias' | 'acepta'
export type ErroresAlta = Partial<Record<CampoAlta, string>>
/** El orden en que se enfoca el primer problema (el de la pantalla). */
export const ORDEN_ALTA: CampoAlta[] = ['nombre', 'edad', 'sexo', 'pesoKg', 'tallaCm', 'alergias', 'acepta']

export type RevisionAlta = { ok: true; datos: DatosBasicos } | { ok: false; errores: ErroresAlta }

/**
 * Para crear el perfil hacen falta nombre, edad (1 a 18), sexo, una respuesta explícita sobre alergias (al menos una
 * confirmada o "No tiene alergias") y al menos un alimento seguro. Las alergias de DatosBasicos son solo las tocadas.
 */
export function revisarAlta(alta: Alta, b: Pick<PerfilBorrador, 'acepta'>, nombre = 'tu hijo'): RevisionAlta {
  const v = validarDatos({
    ...alta.form,
    alergias: alta.sinAlergias ? [] : alta.form.alergias,
    alergiasOtras: alta.sinAlergias ? [] : alta.form.alergiasOtras,
  })
  const errores: ErroresAlta = v.ok ? {} : { ...v.errores }
  if (!alergiasRespondidas(alta)) errores.alergias = 'Contanos si tiene alergias: tocá las que tiene o “No tiene alergias”.'
  if (!b.acepta.some((a) => a.nombre.trim())) errores.acepta = `Sumá al menos un alimento que ${nombre} coma seguro.`
  if (!v.ok || Object.keys(errores).length) return { ok: false, errores }
  return { ok: true, datos: v.datos }
}
