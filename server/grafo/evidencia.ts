// armarEvidencia(ninoId, nutriente?) (PLAN.md §8, B12): el paquete de ~20 líneas que es lo ÚNICO que ve el LLM de
// la receta (A9). Lo que falta → candidatos a UN cambio de un alimento seguro → propagación + patrones.
import type { Candidato, Evidencia, Motor, Nutriente } from '../../shared/contratos.js'
import { calcularEstado } from '../aprendizaje/estado.js'
import { NOMBRE_NUTRIENTE, TEXTO_CAMBIO, decimal, lista, porciento } from '../aprendizaje/textos.js'
import { type Cargado, cargarNino } from '../datos/cargar.js'
import { hoyUruguay } from '../datos/fechas.js'
import { recomendacionDe } from '../datos/tablero.js'
import { coberturaDia, semana } from '../nutricion/progreso.js'

const MAX_CANDIDATOS = 3
const UNIDAD: Record<Nutriente, string> = {
  energia_kcal: 'kcal', proteina_g: 'g', calcio_mg: 'mg', vitamina_d_ug: 'µg', hierro_mg: 'mg', fibra_g: 'g', omega3_g: 'g', b12_ug: 'µg', vitamina_c_mg: 'mg',
}
/** Lo que la receta tiene que respetar siempre (§7): va en el paquete aunque el chico no tenga reglas propias. */
const PRESENTACION = 'Presentación: separado, porción mínima, al lado de su alimento seguro, salsas aparte. Un solo alimento nuevo por comida. Nada escondido.'

export function evidenciaDe(c: Cargado, op: { nutriente?: Nutriente; motor?: Motor; hoy?: string; ahora?: Date } = {}): Evidencia {
  const hoy = op.hoy ?? hoyUruguay(op.ahora)
  const estado = calcularEstado(c.nino, c.comidas, c.catalogo, { hasta: hoy })
  const rec = recomendacionDe(c, estado, hoy, op.motor ?? 'grafo', op.nutriente, op.ahora)
  const n = rec.nutriente
  const sem = semana(estado.comidas, hoy, c.objetivo)
  const faltaHoy = Math.max(0, c.objetivo[n] - coberturaDia(hoy, estado.comidas, c.objetivo).consumido.valor[n])

  // Primero el "un pasito" si apunta a este nutriente (la exposición en curso se sigue igual), después por puntaje
  const unPaso = rec.sugerencias.find((s) => s.tipo === 'un_paso')?.candidato
  const candidatos: Candidato[] = [
    ...(unPaso && rec.candidatos.some((x) => x.preparacionId === unPaso.preparacionId) ? [unPaso] : []),
    ...rec.candidatos.filter((x) => x.preparacionId !== unPaso?.preparacionId),
  ].slice(0, MAX_CANDIDATOS)

  const d = c.nino.datos
  const lineas = [
    `Chico: ${d.nombre}, ${d.edad} años. Alergias: ${d.alergias.length ? lista(d.alergias) : 'ninguna'}${d.dieta === 'sin_gluten_caseina' ? '. Dieta sin gluten ni caseína' : ''}.`,
    `Le falta: ${NOMBRE_NUTRIENTE[n]} (esta semana cubre ${porciento(sem.cobertura[n])}; hoy le faltan ${decimal(faltaHoy, 0)} ${UNIDAD[n]}).`,
    `Reglas de la familia: ${c.nino.reglas.length ? c.nino.reglas.map((r) => r.texto).join(' · ') : 'ninguna'}.`,
    `Patrones: ${estado.patrones.filter((p) => p.fuente === 'aprendido').slice(0, 4).map((p) => p.texto).join(' · ') || 'todavía pocos datos'}.`,
    ...candidatos.flatMap((x, i) => [
      `Candidato ${i + 1}: ${x.nombre} (puntaje ${decimal(x.puntaje)})`,
      `  Camino: ${x.camino.desde} (comió ${x.camino.aceptacion}) ─${x.camino.atributos.join(', ')}─▶ ${x.nombre}`,
      `  Cambia solo: ${x.cambio === 'fortificar' ? 'es la versión fortificada' : TEXTO_CAMBIO[x.cambio]}. Se mantiene: ${x.seMantiene.join(', ') || '—'}`,
      ...(x.patrones.length ? [`  Patrones que aplican: ${x.patrones.join(' · ')}`] : []),
      `  Aporta: ~${decimal(x.aportePorcion[n] ?? 0, 1)} ${UNIDAD[n]} de ${NOMBRE_NUTRIENTE[n]} por porción (${porciento((x.aportePorcion[n] ?? 0) / (c.objetivo[n] || 1))} de lo que necesita por día)`,
    ]),
    ...(candidatos.length ? [] : ['No hay candidatos a un solo cambio para este nutriente con su catálogo actual.']),
    PRESENTACION,
  ]
  return {
    nutriente: n,
    coberturaSemana: Math.round(sem.cobertura[n] * 1000) / 1000,
    faltaHoy: Math.round(faltaHoy * 10) / 10,
    candidatos,
    reglas: [...c.nino.reglas.map((r) => r.texto), PRESENTACION],
    alergias: d.alergias,
    texto: lineas.join('\n'),
  }
}

export async function armarEvidencia(ninoId: string, nutriente?: Nutriente, motor: Motor = 'grafo'): Promise<Evidencia> {
  return evidenciaDe(await cargarNino(ninoId), { ...(nutriente ? { nutriente } : {}), motor })
}
