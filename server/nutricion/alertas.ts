// Señales de alerta por código (PLAN.md §10.4). La app detecta y deriva; no diagnostica ni trata.
// Mensajes calmos, sin alarmar.
import type { Alerta, Conducta, DatosBasicos, Grupo, Nutrientes } from '../../shared/contratos.js'
import { lista, mayuscula, minuscula } from '../aprendizaje/textos.js'
import { UMBRAL_SIN_VITAMINA_C } from './calcular.js'

export const CONFIG_ALERTAS = {
  minRepertorio: 10, // menos de 10 preparaciones que acepta (el research habla de 10 a 20 alimentos)
  diasSinGrupo: 7,
  diasRepertorioBaja: 14,
  arcadasEnSemana: 2,
  minDiasVitaminaC: 3, // con menos días registrados en la semana, la cobertura no dice mucho
}

export interface EntradaAlertas {
  nombre: string
  datos: Pick<DatosBasicos, 'alertas' | 'dieta'>
  aceptadas: number
  segurasPerdidas: string[] // seguras que no aparecen hace 14 días o más, si no se sumó ninguna nueva
  grupos: { grupo: Grupo; diasSinComer: number | null }[]
  diasDeHistorial: number // días de calendario desde el alta (o la primera comida)
  diasRegistrados: number // días con al menos una comida registrada, hasta hoy
  comidasRecientes: number // comidas registradas en los últimos `diasRepertorioBaja` días
  coberturaSemana: Nutrientes
  diasRegistradosSemana: number
  conductasSemana: Conducta[][] // una lista por comida de los últimos 7 días
  atragantamientos: number // comidas con tos o atragantamiento en la ventana del tablero
}

const DECLARADA: Record<DatosBasicos['alertas'][number], string> = {
  bajo_peso: 'bajo peso',
  arcadas_vomitos: 'arcadas o vómitos frecuentes',
  menos_15_alimentos: 'que come menos de 15 alimentos',
}

export function alertas(e: EntradaAlertas, cfg = CONFIG_ALERTAS): Alerta[] {
  const r: Alerta[] = []
  if (e.atragantamientos > 0) {
    r.push({ tipo: 'atragantamiento', texto: 'Si tose o se atraganta al comer, conviene consultar con su pediatra o con fonoaudiología.' })
  }
  const arcadas = e.conductasSemana.filter((c) => c.includes('arcadas')).length
  if (arcadas >= cfg.arcadasEnSemana) {
    r.push({ tipo: 'arcadas', texto: `Tuvo arcadas o vómitos en ${arcadas} comidas esta semana. Consultá con su pediatra.` })
  }
  if (e.diasRegistradosSemana >= cfg.minDiasVitaminaC && e.coberturaSemana.vitamina_c_mg < UMBRAL_SIN_VITAMINA_C) {
    r.push({ tipo: 'sin_vitamina_c', texto: 'Casi no está recibiendo vitamina C. Su falta prolongada puede traer problemas: conviene consultar.' })
  }
  if (e.diasDeHistorial >= cfg.diasSinGrupo && e.diasRegistrados > 0) {
    const dias = (g: Grupo) => e.grupos.find((x) => x.grupo === g)?.diasSinComer ?? null
    const ausente = (gs: Grupo[], que: string): string | null => {
      const ds = gs.map(dias)
      if (!ds.every((d) => d === null || d >= cfg.diasSinGrupo)) return null
      const conocidos = ds.filter((d): d is number => d !== null)
      if (conocidos.length) return `hace ${Math.min(...conocidos)} días que no come ${que}`
      return e.diasRegistrados === 1 ? `en el día registrado no comió ${que}` : `en los ${e.diasRegistrados} días registrados no comió ${que}`
    }
    const faltan = [
      ausente(['fruta', 'verdura'], 'frutas ni verduras'),
      ausente(['lacteo'], 'lácteos'),
      ausente(['proteina'], 'carnes, huevo, legumbres ni otras proteínas'),
    ].filter((x): x is string => x !== null)
    // Una sola alerta con todos los grupos: la recomendación va una vez, no una por grupo
    if (faltan.length) {
      r.push({
        tipo: 'grupo_ausente',
        texto: `${faltan.map((f) => `${mayuscula(f)}.`).join(' ')} Dejar grupos enteros es una señal para consultar con su pediatra o nutricionista.`,
      })
    }
  }
  if (e.aceptadas < cfg.minRepertorio || e.datos.alertas.includes('menos_15_alimentos')) {
    r.push({ tipo: 'repertorio_chico', texto: `${e.nombre} come pocos alimentos distintos. Vale la pena comentarlo con su pediatra o nutricionista.` })
  }
  // Sin comidas registradas en la ventana no se sabe si dejó de comerlas: puede que no se haya registrado nada
  if (e.segurasPerdidas.length && e.comidasRecientes > 0) {
    r.push({
      tipo: 'repertorio_baja',
      texto: `Dejó de comer ${lista(e.segurasPerdidas.map(minuscula))} y no apareció nada nuevo. Si su repertorio se achica, conviene consultar.`,
    })
  }
  if (e.datos.dieta === 'sin_gluten_caseina') {
    r.push({ tipo: 'dieta_eliminacion', texto: 'En esta dieta, el calcio y la vitamina D se vuelven prioridad. Conviene que la supervise un profesional.' })
  }
  if (e.datos.alertas.length) {
    r.push({ tipo: 'declarada', texto: `En el perfil marcaste ${lista(e.datos.alertas.map((a) => DECLARADA[a]))}. Recomendamos consultar a un profesional.` })
  }
  return r
}
