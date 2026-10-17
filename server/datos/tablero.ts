// GET /api/nutricion y GET /api/progreso (B7): el tablero "¿está comiendo bien?" y las tres sugerencias (§8).
import type { CoberturaDia, Motor, Nutriente, Progreso } from '../../shared/contratos.js'
import type { EstadoNino } from '../aprendizaje/estado.js'
import { calcularEstado } from '../aprendizaje/estado.js'
import { type EntradaRecomendador, type Recomendacion, recomendar } from '../aprendizaje/recomendador.js'
import { faltanSemana } from '../nutricion/calcular.js'
import { armarProgreso, coberturaDia, semana } from '../nutricion/progreso.js'
import { type Cargado, cargarNino } from './cargar.js'
import { horaUruguay, hoyUruguay, momentoSegunHora, sumarDias } from './fechas.js'

export interface OpcionesTablero {
  dias?: number // ventana del tablero, por defecto 28
  motor?: Motor // recomendador: grafo (por defecto) o base (§4.3)
  hasta?: string // 'YYYY-MM-DD': "hoy" para el tablero (por defecto, hoy en Uruguay)
  ahora?: Date
}

/** Lo que el recomendador necesita, con lo que se sirvió en la última comida del mismo momento (para no repetir). */
export function entradaRecomendador(c: Cargado, estado: EstadoNino, hoy: string, ahora: Date = new Date()): EntradaRecomendador {
  const sem = semana(estado.comidas, hoy, c.objetivo)
  const momento = momentoSegunHora(horaUruguay(ahora))
  const ultima = [...estado.comidas].reverse().find((m) => m.momento === momento)
  return {
    catalogo: [...c.catalogo.values()],
    conocidas: estado.conocidas,
    estados: estado.estados,
    alergias: c.nino.datos.alergias,
    reglas: c.nino.reglas,
    alimentos: c.alimentos,
    objetivo: c.objetivo,
    observaciones: estado.observaciones,
    patrones: estado.patrones,
    faltan: sem.diasRegistrados ? faltanSemana(sem.cobertura) : [],
    coberturaSemana: sem.cobertura,
    evitarSegura: ultima ? ultima.items.map((it) => it.preparacionId) : [],
  }
}

export function recomendacionDe(c: Cargado, estado: EstadoNino, hoy: string, motor: Motor = 'grafo', nutriente?: Nutriente, ahora?: Date): Recomendacion {
  return recomendar(entradaRecomendador(c, estado, hoy, ahora), motor, nutriente)
}

export function progresoDe(c: Cargado, op: OpcionesTablero = {}): Progreso {
  const hoy = op.hasta ?? hoyUruguay(op.ahora)
  const estado = calcularEstado(c.nino, c.comidas, c.catalogo, { hasta: hoy })
  return armarProgreso({
    nino: c.nino,
    comidas: c.comidas,
    objetivo: c.objetivo,
    hoy,
    dias: Math.min(Math.max(Math.round(op.dias ?? 28), 7), 120),
    estado,
    estadoHace7: calcularEstado(c.nino, c.comidas, c.catalogo, { hasta: sumarDias(hoy, -7) }),
    estadoHace14: calcularEstado(c.nino, c.comidas, c.catalogo, { hasta: sumarDias(hoy, -14) }),
    recomendacion: recomendacionDe(c, estado, hoy, op.motor ?? 'grafo', undefined, op.ahora),
  })
}

export async function obtenerProgreso(ninoId: string, op: OpcionesTablero = {}): Promise<Progreso> {
  return progresoDe(await cargarNino(ninoId), op)
}

export async function obtenerNutricionDia(ninoId: string, dia: string): Promise<CoberturaDia> {
  const c = await cargarNino(ninoId)
  return coberturaDia(dia, c.comidas, c.objetivo)
}
