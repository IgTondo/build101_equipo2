// El tablero "¿está comiendo bien?" (PLAN.md §1 y §9): todo por código, sin LLM. Funciones puras.
import type { Alerta, CoberturaDia, ComidaResumen, Grupo, Nutriente, Nutrientes, Progreso } from '../../shared/contratos.js'
import { exposiciones } from '../aprendizaje/aceptacion.js'
import { comio } from '../aprendizaje/escalera.js'
import { type EstadoNino, contar } from '../aprendizaje/estado.js'
import type { Patron } from '../aprendizaje/patrones.js'
import type { Recomendacion } from '../aprendizaje/recomendador.js'
import { NOMBRE_NUTRIENTE, lista, porciento } from '../aprendizaje/textos.js'
import { diaDe, diasEntre, sumarDias } from '../datos/fechas.js'
import type { ComidaDoc, NinoDoc } from '../datos/tipos.js'
import { CONFIG_ALERTAS, alertas } from './alertas.js'
import {
  cero, cobertura, escalar, faltanDia, faltanSemana, redondearCobertura, redondearRango, sumar, sumarRangos,
} from './calcular.js'
import { CON_META } from './objetivos.js'

export const GRUPOS_TABLERO: readonly Grupo[] = ['fruta', 'verdura', 'lacteo', 'proteina']
/** Las últimas comidas del tablero llevan miniatura; el resto no, para no inflar la respuesta. */
const COMIDAS_CON_MINIATURA = 5

export const comidasEntre = (comidas: readonly ComidaDoc[], desde: string, hasta: string): ComidaDoc[] =>
  comidas.filter((c) => c.dia >= desde && c.dia <= hasta)

export function resumenComida(c: ComidaDoc, conMiniatura: boolean): ComidaResumen {
  return {
    id: c._id,
    fechaISO: c.fechaISO,
    momento: c.momento,
    ...(conMiniatura && c.thumbBase64 ? { thumbBase64: c.thumbBase64 } : {}),
    items: c.items.flatMap((it) => (it.cuanto ? [{ nombre: it.nombre, cuanto: it.cuanto }] : [])),
    conducta: c.conducta,
  }
}

export function coberturaDia(
  dia: string,
  comidas: readonly ComidaDoc[],
  objetivo: Nutrientes,
  conMiniatura: (c: ComidaDoc) => boolean = () => true,
): CoberturaDia {
  const delDia = comidas.filter((c) => c.dia === dia).sort((a, b) => Date.parse(a.fechaISO) - Date.parse(b.fechaISO))
  const consumido = delDia.length ? sumarRangos(delDia.map((c) => c.nutrientes)) : { valor: cero(), min: cero(), max: cero() }
  const cob = cobertura(consumido.valor, objetivo)
  return {
    dia,
    consumido: redondearRango(consumido),
    objetivo,
    cobertura: redondearCobertura(cob),
    faltan: faltanDia(cob),
    comidas: delDia.map((c) => resumenComida(c, conMiniatura(c))),
  }
}

export interface Semana {
  desde: string
  hasta: string
  diasRegistrados: number
  promedio: Nutrientes
  cobertura: Nutrientes
}

/**
 * Promedio diario de los 7 días que terminan en `hasta` ÷ objetivo (§1). Se divide por los días con alguna comida
 * registrada: un día sin registro es un dato que falta, no un día sin comer.
 */
export function semana(comidas: readonly ComidaDoc[], hasta: string, objetivo: Nutrientes): Semana {
  const desde = sumarDias(hasta, -6)
  const enRango = comidasEntre(comidas, desde, hasta)
  const dias = new Set(enRango.map((c) => c.dia)).size
  const promedio = dias ? escalar(sumar(...enRango.map((c) => c.nutrientes.valor)), 1 / dias) : cero()
  return { desde, hasta, diasRegistrados: dias, promedio, cobertura: cobertura(promedio, objetivo) }
}

/** Días desde la última vez que comió (todo, la mitad o un poco) algo de cada grupo; null si nunca. */
export function gruposDesde(comidas: readonly ComidaDoc[], hoy: string): Progreso['grupos'] {
  return GRUPOS_TABLERO.map((grupo) => {
    let ultimo: string | null = null
    for (const c of comidas) {
      if (c.dia > hoy || (ultimo && c.dia <= ultimo)) continue
      if (c.items.some((it) => it.atributos.grupo === grupo && it.cuanto !== null && comio(it.cuanto))) ultimo = c.dia
    }
    return { grupo, diasSinComer: ultimo ? diasEntre(ultimo, hoy) : null }
  })
}

export function patronesVista(patrones: readonly Patron[]): Progreso['patrones'] {
  return patrones.map((p) => ({
    texto: p.texto, resultado: p.resultado, apoyo: p.n, confianza: Math.round(p.confianza * 100) / 100, fuente: p.fuente,
  }))
}

/** "Esta semana Tomás cubrió 5 de 8 nutrientes. Lo que más le falta: calcio (48%) y vitamina D (20%). Come 14 preparaciones (1 más que la semana pasada)." */
export function frase(nombre: string, sem: Semana, faltan: readonly Nutriente[], aceptadas: number, tendencia: number): string {
  if (sem.diasRegistrados === 0) {
    return `Todavía no hay comidas registradas esta semana. Cuando registres la próxima, vas a ver cómo viene ${nombre}.`
  }
  const cubiertos = CON_META.filter((n) => sem.cobertura[n] >= 1).length
  const partes = [`Esta semana ${nombre} cubrió ${cubiertos} de ${CON_META.length} nutrientes.`]
  partes.push(
    faltan.length
      ? `Lo que más le falta: ${lista(faltan.slice(0, 2).map((n) => `${NOMBRE_NUTRIENTE[n]} (${porciento(sem.cobertura[n])})`))}.`
      : 'Ningún nutriente clave está por debajo del 70%.',
  )
  const t = tendencia > 0 ? `${tendencia} más que la semana pasada` : tendencia < 0 ? `${-tendencia} menos que la semana pasada` : 'igual que la semana pasada'
  partes.push(`Come ${aceptadas} ${aceptadas === 1 ? 'preparación' : 'preparaciones'} (${t}).`)
  return partes.join(' ')
}

/** Las alertas de §10.4 con el estado del chico al día `hoy`. */
export function evaluarAlertas(
  nino: NinoDoc,
  comidas: readonly ComidaDoc[],
  estado: EstadoNino,
  estadoHace14: EstadoNino,
  hoy: string,
  sem: Semana,
): Alerta[] {
  const hasta = comidasEntre(comidas, '0000-00-00', hoy)
  const inicio = [diaDe(nino.creadoISO), ...hasta.map((c) => c.dia)].sort()[0] ?? hoy
  const diasDeHistorial = Math.max(0, diasEntre(inicio, hoy))
  const aceptadas = [...estado.estados.values()].filter((s) => s.estado === 'acepta')
  const nuevas = aceptadas.filter((s) => estadoHace14.estados.get(s.prepId)?.estado !== 'acepta')
  const perdidas =
    diasDeHistorial >= 14 && nuevas.length === 0
      ? aceptadas.filter((s) => diasEntre(diaDe(s.ultimaISO ?? nino.creadoISO), hoy) >= 14).map((s) => s.nombre)
      : []
  return alertas({
    nombre: nino.datos.nombre,
    datos: nino.datos,
    aceptadas: aceptadas.length,
    segurasPerdidas: perdidas,
    grupos: gruposDesde(hasta, hoy),
    diasDeHistorial,
    diasRegistrados: new Set(hasta.map((c) => c.dia)).size,
    comidasRecientes: comidasEntre(hasta, sumarDias(hoy, -(CONFIG_ALERTAS.diasRepertorioBaja - 1)), hoy).length,
    coberturaSemana: sem.cobertura,
    diasRegistradosSemana: sem.diasRegistrados,
    conductasSemana: comidasEntre(hasta, sumarDias(hoy, -6), hoy).map((c) => c.conducta),
    atragantamientos: comidasEntre(hasta, sumarDias(hoy, -27), hoy).filter((c) => c.conducta.includes('atragantamiento')).length,
  })
}

export interface EntradaProgreso {
  nino: NinoDoc
  comidas: readonly ComidaDoc[] // todas las del chico
  objetivo: Nutrientes
  hoy: string
  dias: number // ventana de `dias` (por defecto 28)
  estado: EstadoNino // al día `hoy`
  estadoHace7: EstadoNino
  estadoHace14: EstadoNino
  recomendacion: Recomendacion | null
}

export function armarProgreso(e: EntradaProgreso): Progreso {
  const hasta = comidasEntre(e.comidas, '0000-00-00', e.hoy)
  const enVentana = comidasEntre(hasta, sumarDias(e.hoy, -(e.dias - 1)), e.hoy)
  const ordenadas = [...hasta].sort((a, b) => Date.parse(a.fechaISO) - Date.parse(b.fechaISO))
  const conMiniatura = new Set(ordenadas.slice(-COMIDAS_CON_MINIATURA).map((c) => c._id))
  const dias = [...new Set(enVentana.map((c) => c.dia))].sort().map((d) => coberturaDia(d, enVentana, e.objetivo, (c) => conMiniatura.has(c._id)))
  const sem = semana(hasta, e.hoy, e.objetivo)
  const faltan = sem.diasRegistrados ? faltanSemana(sem.cobertura) : []
  const aceptadas = contar(e.estado, 'acepta')
  const tendencia = aceptadas - contar(e.estadoHace7, 'acepta')
  const semanas = [3, 2, 1, 0]
    .map((k) => semana(hasta, sumarDias(e.hoy, -7 * k), e.objetivo))
    .filter((s) => s.diasRegistrados > 0)
    .map((s) => ({ desde: s.desde, cobertura: redondearCobertura(s.cobertura) }))
  const sugerencias = e.recomendacion?.sugerencias ?? []
  const proximoPaso = sugerencias.find((s) => s.tipo === 'un_paso')?.candidato
  return {
    dias,
    semana: { cobertura: redondearCobertura(sem.cobertura), faltan, energiaPromedioKcal: Math.round(sem.promedio.energia_kcal) },
    aceptadas,
    enProceso: contar(e.estado, 'en_proceso'),
    patrones: patronesVista(e.estado.patrones),
    frase: frase(e.nino.datos.nombre, sem, faltan, aceptadas, tendencia),
    semanas,
    repertorioTendencia: tendencia,
    grupos: gruposDesde(hasta, e.hoy),
    exposiciones: exposiciones(e.estado.estados),
    alertas: evaluarAlertas(e.nino, hasta, e.estado, e.estadoHace14, e.hoy, sem),
    ...(proximoPaso ? { proximoPaso } : {}),
    ...(sugerencias.length ? { sugerencias } : {}),
  }
}
