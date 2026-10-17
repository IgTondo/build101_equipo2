// Los hechos del resumen para el nutricionista (C8), calculados por código. Funciones puras: sin red ni archivos.
// El LLM recibe solo `lineasHechos()` y tiene prohibido calcular; texto.ts comprueba que cada número del texto esté acá.
import { CONDUCTA } from '../../shared/contratos.js'
import type { Conducta, Cuanto, Dieta, Grupo, Nutriente, Perfil, Progreso } from '../../shared/contratos.js'

// Etiquetas propias del servidor (las del front viven en src/lib/vocabulario.ts y no se importan desde server/).
const NUTRIENTE_TEXTO: Record<Nutriente, string> = {
  energia_kcal: 'energía', proteina_g: 'proteína', calcio_mg: 'calcio', vitamina_d_ug: 'vitamina D', hierro_mg: 'hierro',
  fibra_g: 'fibra', omega3_g: 'omega-3', b12_ug: 'vitamina B12', vitamina_c_mg: 'vitamina C',
}
const GRUPO_TEXTO: Record<Grupo, string> = {
  cereal_almidon: 'cereales y almidones', proteina: 'proteínas', verdura: 'verduras', fruta: 'frutas', lacteo: 'lácteos', otro: 'otros',
}
const ESCALON_TEXTO: Record<Cuanto, string> = {
  todo: 'comió todo', mitad: 'comió la mitad', poco: 'comió un poco', probo: 'lo probó',
  toco: 'lo tocó', nada: 'lo dejó en el plato', aparto: 'lo apartó',
}
const CONDUCTA_TEXTO: Record<Conducta, string> = {
  tranquilo: 'tranquilo', se_levanto: 'se levantó de la mesa', angustia: 'lloró o se angustió',
  pidio_otra_cosa: 'pidió su comida de siempre', arcadas: 'arcadas o vómitos', atragantamiento: 'tos o atragantamiento',
}
const DIETA_TEXTO: Record<Dieta, string> = { ninguna: 'sin dieta especial', sin_gluten_caseina: 'sin gluten ni caseína', otra: 'otra dieta declarada' }

/** Umbral de "le falta" de §1: por debajo del 70% de la cobertura semanal. */
export const UMBRAL_FALTA = 70
/** Un grupo cuenta como ausente si no aparece en 7 días o nunca se registró (§10.4). */
export const DIAS_GRUPO_AUSENTE = 7
/** La ventana del resumen. */
export const DIAS_SEMANA = 7
const MAX_EXPOSICIONES = 6

export interface NutrienteHecho { nutriente: Nutriente; nombre: string; porcentaje: number }
export interface Hechos {
  nombre: string
  edad: number | null
  alergias: string[]
  dieta: string | null
  periodo: { desde: string; hasta: string; dias: number; comidas: number }
  repertorio: { aceptadas: number; enProceso: number; tendencia: number }
  grupos: { grupo: Grupo; nombre: string; diasSinComer: number | null; ausente: boolean }[]
  nutrientesBajos: NutrienteHecho[]          // en el orden de prioridad de semana.faltan
  nutrientesCubiertos: NutrienteHecho[]      // el resto de los 8 con meta
  energiaPromedioKcal: number                // como dato, sin meta
  exposiciones: { total: number; lista: { nombre: string; veces: number; mejorPaso: Cuanto; escalon: string }[] }
  conducta: { comidas: number; conRegistro: number; conteo: Record<Conducta, number> }
  alertas: string[]
}

const pct = (x: number) => Math.round(x * 100)
/** 'YYYY-MM-DD' → 'D/M' (como lo escribe una persona en Uruguay). */
export const fechaCorta = (dia: string) => `${Number(dia.slice(8, 10))}/${Number(dia.slice(5, 7))}`

export function armarHechos(progreso: Progreso, perfil: Perfil | null): Hechos {
  // La semana es la ventana del resumen: los últimos 7 días que trae el progreso (puede traer hasta 28).
  const dias = [...progreso.dias].sort((a, b) => a.dia.localeCompare(b.dia)).slice(-7)
  const comidas = dias.flatMap((d) => d.comidas)
  const conteo = Object.fromEntries(CONDUCTA.map((c) => [c, 0])) as Record<Conducta, number>
  for (const c of comidas) for (const x of new Set(c.conducta ?? [])) conteo[x] += 1

  const { cobertura, faltan, energiaPromedioKcal } = progreso.semana
  const hecho = (n: Nutriente): NutrienteHecho => ({ nutriente: n, nombre: NUTRIENTE_TEXTO[n], porcentaje: pct(cobertura[n]) })
  const conMeta = (Object.keys(NUTRIENTE_TEXTO) as Nutriente[]).filter((n) => n !== 'energia_kcal')

  return {
    nombre: perfil?.datos.nombre ?? 'El chico',
    edad: perfil?.datos.edad ?? null,
    alergias: (perfil?.datos.alergias ?? []).map((a) => a.replace(/_/g, ' ')),
    dieta: perfil ? DIETA_TEXTO[perfil.datos.dieta] : null,
    periodo: { desde: dias[0]?.dia ?? '', hasta: dias.at(-1)?.dia ?? '', dias: dias.length, comidas: comidas.length },
    repertorio: { aceptadas: progreso.aceptadas, enProceso: progreso.enProceso, tendencia: progreso.repertorioTendencia },
    grupos: progreso.grupos.filter((g) => g.grupo !== 'otro').map((g) => ({
      grupo: g.grupo, nombre: GRUPO_TEXTO[g.grupo], diasSinComer: g.diasSinComer,
      ausente: g.diasSinComer === null || g.diasSinComer >= DIAS_GRUPO_AUSENTE,
    })),
    nutrientesBajos: faltan.filter((n) => n !== 'energia_kcal').map(hecho),
    nutrientesCubiertos: conMeta.filter((n) => !faltan.includes(n)).map(hecho),
    energiaPromedioKcal: Math.round(energiaPromedioKcal),
    exposiciones: {
      total: progreso.exposiciones.length,
      lista: progreso.exposiciones.slice(0, MAX_EXPOSICIONES).map((e) => ({
        nombre: e.nombre, veces: e.veces, mejorPaso: e.mejorPaso, escalon: ESCALON_TEXTO[e.mejorPaso],
      })),
    },
    conducta: { comidas: comidas.length, conRegistro: comidas.filter((c) => c.conducta?.length).length, conteo },
    alertas: progreso.alertas.map((a) => a.texto),
  }
}

const conSigno = (n: number) => (n > 0 ? `+${n}` : String(n))
const ultimaVez = (d: number | null) => (d === null ? 'sin registros' : d === 0 ? 'hoy' : d === 1 ? 'ayer' : `hace ${d} días`)

/** Los hechos como lista de líneas en texto plano: es lo único que ve el LLM y la base del número-chequeo. */
export function lineasHechos(h: Hechos): string[] {
  const { conteo } = h.conducta
  const ausentes = h.grupos.filter((g) => g.ausente)
  const lineas = [
    `Chico: ${h.nombre}${h.edad !== null ? `, ${h.edad} años` : ''}.` +
      (h.alergias.length ? ` Alergias declaradas: ${h.alergias.join(', ')}.` : '') + (h.dieta ? ` Dieta: ${h.dieta}.` : ''),
    h.periodo.comidas
      ? `Período: del ${fechaCorta(h.periodo.desde)} al ${fechaCorta(h.periodo.hasta)} (${h.periodo.dias} días), ${h.periodo.comidas} comidas registradas por la familia.`
      : `Período: los últimos ${DIAS_SEMANA} días, sin comidas registradas por la familia (no hay cobertura de nutrientes para calcular).`,
    `Repertorio: acepta ${h.repertorio.aceptadas} preparaciones (${conSigno(h.repertorio.tendencia)} respecto de la semana anterior) y tiene ${h.repertorio.enProceso} en proceso.`,
    `Grupos ausentes (${DIAS_GRUPO_AUSENTE} días o más sin comerlos): ${ausentes.length ? ausentes.map((g) => `${g.nombre} (${ultimaVez(g.diasSinComer)})`).join(', ') : 'ninguno'}.`,
    `Última vez que comió de cada grupo: ${h.grupos.map((g) => `${g.nombre}: ${ultimaVez(g.diasSinComer)}`).join('; ')}.`,
    `Nutrientes por debajo del ${UMBRAL_FALTA}% de la referencia para su edad (cobertura semanal estimada): ` +
      (h.nutrientesBajos.length ? h.nutrientesBajos.map((n) => `${n.nombre} ${n.porcentaje}%`).join(', ') : 'ninguno') + '.',
    `Nutrientes en ${UMBRAL_FALTA}% o más: ${h.nutrientesCubiertos.map((n) => `${n.nombre} ${n.porcentaje}%`).join(', ') || 'ninguno'}.`,
    `Energía aproximada: ${h.energiaPromedioKcal} kcal por día en promedio, como dato (sin meta).`,
    `Exposiciones en curso: ${h.exposiciones.total}.` + (h.exposiciones.lista.length
      ? ` ${h.exposiciones.lista.map((e) => `${e.nombre} (${e.veces} ${e.veces === 1 ? 'ofrecimiento' : 'ofrecimientos'}, mejor escalón: ${e.escalon})`).join('; ')}.`
      : ''),
    `Conducta en la mesa, en ${h.conducta.comidas} comidas (${h.conducta.conRegistro} con conducta registrada): ` +
      CONDUCTA.map((c) => `${CONDUCTA_TEXTO[c]} en ${conteo[c]}`).join('; ') + '.',
    `Señales de alerta: ${h.alertas.length ? h.alertas.join(' ') : 'ninguna.'}`,
  ]
  return lineas
}

/** Los dos formatos juntos: el objeto para el código y las líneas para el LLM. */
export function hechosResumen(progreso: Progreso, perfil: Perfil | null): { hechos: Hechos; lineas: string[] } {
  const hechos = armarHechos(progreso, perfil)
  return { hechos, lineas: lineasHechos(hechos) }
}
