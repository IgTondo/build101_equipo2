// Texto del resumen para el nutricionista (C8). Claude Haiku 5.5 redacta a partir de las líneas de numeros.ts y el código
// comprueba que cada número del texto esté en esas líneas. Si no hay ANTHROPIC_API_KEY, si la llamada falla o si el texto
// trae un número que no estaba, se usa una plantilla armada por código con los mismos hechos (y se deja en el log).
//
// TODO(A4): cuando exista server/ia/modelo.ts, reemplazar redactorClaude() por su generarTexto(). Mientras tanto,
// el cliente de Anthropic vive aislado acá para no pisar a la pista A.
import Anthropic from '@anthropic-ai/sdk'
import type { CodigoError } from '../../shared/contratos.js'
import { DIAS_GRUPO_AUSENTE, fechaCorta, UMBRAL_FALTA, type Hechos } from './numeros.js'

export const MODELO_RESUMEN = 'claude-haiku-5-5'
export const ACLARACION = 'Valores aproximados, no es un diagnóstico.'
const TIMEOUT_MS = 25_000

export const SISTEMA = `Redactás el resumen semanal de alimentación de un chico con autismo y selectividad alimentaria, para que la familia se lo pase a su nutricionista.

Cómo escribirlo:
- En español de Uruguay, en tono profesional, claro y conciso. Sin markdown: ni asteriscos, ni numerales, ni viñetas con guiones.
- Una línea de apertura (quién, qué período y cuántas comidas) y después párrafos cortos que empiecen con un rótulo: "Repertorio:", "Grupos:", "Nutrientes:", "Energía:", "Exposiciones:", "Conducta en la mesa:", "Señales de alerta:".
- Usá solo los números que vienen en los datos, escritos con cifras y tal como aparecen. No calcules, no sumes, no restes, no redondees, no promedies ni inventes ningún número, fecha ni porcentaje. Si un dato no está, no lo menciones.
- Describí lo observado. No diagnostiques ni uses términos clínicos que los datos no dicen (por ejemplo "déficit", "desnutrición" o "trastorno").
- No sugieras suplementos, dosis, dietas ni tratamientos. Las señales de alerta se mencionan tal cual vienen.
- No juzgues al chico, a la familia ni a ningún alimento.
- Terminá exactamente con esta frase, sola en la última línea: ${ACLARACION}`

/** Recibe el system prompt y el mensaje del usuario y devuelve el texto. Inyectable para los tests. */
export type Redactor = (sistema: string, usuario: string) => Promise<string>

export interface TextoResumen {
  texto: string
  fuente: 'llm' | 'plantilla'
  motivo?: string        // por qué se usó la plantilla
  ms: number
}

let cliente: Anthropic | null = null

/** El redactor real, o null si no hay ANTHROPIC_API_KEY (la app desplegada usa siempre la key, §4.1). */
export function redactorClaude(): Redactor | null {
  if (!process.env.ANTHROPIC_API_KEY) return null
  cliente ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: TIMEOUT_MS, maxRetries: 0 })
  const c = cliente
  return async (sistema, usuario) => {
    // Haiku 5.5: sin temperature (valores no default dan 400); thinking adaptativo por defecto y esfuerzo bajo,
    // porque es redactar, no razonar.
    const r = await c.messages.create({
      model: MODELO_RESUMEN,
      max_tokens: 4000,
      output_config: { effort: 'low' },
      system: sistema,
      messages: [{ role: 'user', content: usuario }],
    })
    if (r.stop_reason === 'refusal') throw new Error('El modelo declinó (refusal)')
    if (r.stop_reason === 'max_tokens') throw new Error('El texto quedó cortado (max_tokens)')
    const texto = r.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('').trim()
    if (!texto) throw new Error('Respuesta sin texto')
    return texto
  }
}

/** Cómo se llamaría el error del proveedor en el contrato (solo para el log: la plantilla siempre puede correr). */
export function codigoDeError(e: unknown): CodigoError {
  if (e instanceof Anthropic.APIConnectionTimeoutError) return 'timeout'
  if (e instanceof Anthropic.RateLimitError) return 'limite_proveedor'
  if (e instanceof Anthropic.APIError) return 'proveedor_caido'
  return 'interno'
}

// ---------- El número-chequeo ----------
const NUMERO = /\d+(?:[.,]\d+)?/g
const normalizar = (s: string) => String(Number(s.replace(',', '.')))

/** Todos los números de un texto, normalizados ("0,5" → "0.5", "07" → "7"). Incluye los de "omega-3" o "B12". */
export function numerosDe(texto: string): string[] {
  return (texto.match(NUMERO) ?? []).map(normalizar)
}

/** Los números del texto que no aparecen en los hechos. Vacío = el texto pasa. */
export function numerosQueNoEstan(texto: string, lineas: string[]): string[] {
  const permitidos = new Set(numerosDe(lineas.join('\n')))
  return [...new Set(numerosDe(texto).filter((n) => !permitidos.has(n)))]
}

// ---------- Plantilla (respaldo, sin LLM) ----------
const ultimaVez = (d: number | null) => (d === null ? 'sin registros' : d === 0 ? 'hoy' : d === 1 ? 'ayer' : `hace ${d} días`)
const lista = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs.at(-1)}`)

export function textoPlantilla(h: Hechos): string {
  const { conteo, comidas } = h.conducta
  const ausentes = h.grupos.filter((g) => g.ausente)
  const t = h.repertorio.tendencia
  const riesgo = conteo.arcadas + conteo.atragantamiento
  const lineas = [
    `Resumen de alimentación de ${h.nombre}${h.edad !== null ? ` (${h.edad} años)` : ''}, del ${fechaCorta(h.periodo.desde)} al ${fechaCorta(h.periodo.hasta)}, ` +
      `armado con ${comidas} comidas registradas por la familia.`,
    '',
    `Repertorio: acepta ${h.repertorio.aceptadas} preparaciones (${t > 0 ? '+' : ''}${t} respecto de la semana anterior) y tiene ${h.repertorio.enProceso} en proceso.`,
    `Grupos: ${ausentes.length ? `no comió ${lista(ausentes.map((g) => g.nombre))} en los últimos ${DIAS_GRUPO_AUSENTE} días` : 'comió de todos los grupos en la semana'}. ` +
      `Última vez de cada grupo: ${h.grupos.map((g) => `${g.nombre}, ${ultimaVez(g.diasSinComer)}`).join('; ')}.`,
    `Nutrientes: cobertura semanal estimada respecto de la referencia para su edad. ` +
      (h.nutrientesBajos.length ? `Por debajo del ${UMBRAL_FALTA}%: ${h.nutrientesBajos.map((n) => `${n.nombre} ${n.porcentaje}%`).join(', ')}.` : `Ninguno por debajo del ${UMBRAL_FALTA}%.`) +
      (h.nutrientesCubiertos.length ? ` En ${UMBRAL_FALTA}% o más: ${h.nutrientesCubiertos.map((n) => `${n.nombre} ${n.porcentaje}%`).join(', ')}.` : ''),
    `Energía: ${h.energiaPromedioKcal} kcal por día en promedio, como dato (sin meta).`,
    `Exposiciones: ${h.exposiciones.total} en curso` + (h.exposiciones.lista.length
      ? `. ${h.exposiciones.lista.map((e) => `${e.nombre} (${e.veces} ${e.veces === 1 ? 'ofrecimiento' : 'ofrecimientos'}, mejor escalón: ${e.escalon})`).join('; ')}.`
      : '.'),
    `Conducta en la mesa: tranquilo en ${conteo.tranquilo} de ${comidas} comidas; se levantó en ${conteo.se_levanto}; ` +
      `pidió su comida de siempre en ${conteo.pidio_otra_cosa}; angustia en ${conteo.angustia}; ` +
      (riesgo ? `arcadas o vómitos en ${conteo.arcadas} y tos o atragantamiento en ${conteo.atragantamiento}.` : 'sin arcadas ni atragantamientos.'),
    `Señales de alerta: ${h.alertas.length ? h.alertas.join(' ') : 'ninguna.'}`,
  ]
  if (h.alergias.length) lineas.push(`Alergias declaradas: ${h.alergias.join(', ')}.`)
  lineas.push('', ACLARACION)
  return lineas.join('\n')
}

// ---------- Orquestación ----------
export function mensajeUsuario(h: Hechos, lineas: string[]): string {
  return `Datos de ${h.nombre}, calculados por la app a partir de lo que registró la familia:\n` +
    lineas.map((l) => `- ${l}`).join('\n') +
    '\n\nEscribí el resumen para su nutricionista.'
}

/** Deja el texto del LLM en su forma final: sin marcas de markdown y con la aclaración al final, siempre. */
export function pulir(texto: string): string {
  const cuerpo = texto.replace(/\*\*|__|^#+\s*/gm, '').split(ACLARACION).join('').trim()
  return `${cuerpo}\n\n${ACLARACION}`
}

function registrar(datos: Record<string, unknown>) {
  const linea = JSON.stringify({ evento: 'resumen', ...datos })
  if (datos.fuente === 'plantilla') console.warn(linea)
  else console.info(linea)
}

export async function redactarResumen(h: Hechos, lineas: string[], redactor: Redactor | null = redactorClaude()): Promise<TextoResumen> {
  const t0 = Date.now()
  const plantilla = (motivo: string, extra: Record<string, unknown> = {}): TextoResumen => {
    const ms = Date.now() - t0
    registrar({ fuente: 'plantilla', motivo, ms, ...extra })
    return { texto: textoPlantilla(h), fuente: 'plantilla', motivo, ms }
  }
  if (!redactor) return plantilla('sin_api_key')

  let texto: string
  try {
    texto = pulir(await redactor(SISTEMA, mensajeUsuario(h, lineas)))
  } catch (e) {
    return plantilla('error_proveedor', { codigo: codigoDeError(e), error: e instanceof Error ? e.message : String(e) })
  }
  const inventados = numerosQueNoEstan(texto, lineas)
  if (inventados.length) return plantilla('numeros_fuera_de_los_hechos', { inventados })

  const ms = Date.now() - t0
  registrar({ fuente: 'llm', modelo: MODELO_RESUMEN, ms })
  return { texto, fuente: 'llm', ms }
}
