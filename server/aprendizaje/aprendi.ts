// "Qué aprendí" (PLAN.md §8): plantillas, sin LLM. Compara el estado del chico antes y después de una comida.
import type { Aprendizaje, Regla } from '../../shared/contratos.js'
import type { ComidaDoc } from '../datos/tipos.js'
import { CONFIG_ACEPTACION } from './aceptacion.js'
import { type Condicion, cumple, esAtributo } from './condiciones.js'
import { DICHO, DICHO_ANTES, comio } from './escalera.js'
import type { EstadoNino } from './estado.js'
import { lista, mayuscula, minuscula, sujetoPatron } from './textos.js'

interface Candidata extends Aprendizaje {
  prioridad: number // 0 primero
}

const SIN_PRESION = 'A veces pasa: seguí ofreciéndolo como siempre, sin presión.'

/** Sube o baja si cambia a la vista (2 decimales); si no, sigue igual y no se cuenta. */
function cambioDe(antes: number, despues: number): 'sube' | 'baja' | 'igual' {
  const d = Math.round(despues * 100) - Math.round(antes * 100)
  return d > 0 ? 'sube' : d < 0 ? 'baja' : 'igual'
}

/** "Milanesa de carne al horno (rebozada sin huevo)" → "milanesa de carne al horno": va entre paréntesis. */
const sinAclaracion = (nombre: string) => minuscula(nombre.replace(/\s*\([^)]*\)\s*$/, '').trim())

/**
 * Un "todavía no lo acepta" que dejó de cumplirse porque esta vez lo comió, dicho en positivo:
 * "Lo mezclado ya no parece costarle tanto (esta vez comió arroz con pollo)."
 * Si era de la investigación: "… no parece costarle, aunque a muchos chicos les cuesta (esta vez comió …)."
 */
export function textoBorrado(condiciones: readonly Condicion[], nombre: string, investigacion: boolean): string {
  const s = sujetoPatron(condiciones)
  const parece = s.plural ? 'parecen' : 'parece'
  const dicho = investigacion
    ? `no ${parece} costarle, aunque a muchos chicos les ${s.plural ? 'cuestan' : 'cuesta'}`
    : `ya no ${parece} costarle tanto`
  return `${mayuscula(s.frase)} ${dicho} (esta vez comió ${sinAclaracion(nombre)}).`
}

export function queAprendi(antes: EstadoNino, despues: EstadoNino, comida: ComidaDoc, reglas: readonly Regla[], max = 6): Aprendizaje[] {
  const r: Candidata[] = []

  // Aceptación y exposiciones de los ítems de esta comida
  const vistos = new Set<string>()
  for (const it of comida.items) {
    if (it.cuanto === null || vistos.has(it.preparacionId)) continue
    vistos.add(it.preparacionId)
    const a = antes.estados.get(it.preparacionId)
    const d = despues.estados.get(it.preparacionId)
    if (!d) continue
    const p0 = a?.p ?? CONFIG_ACEPTACION.inicialNuevo
    const dicho = DICHO[it.cuanto]
    // Sin números hacia el padre (§9): "le está gustando más", no "aceptación 0,82 → 0,87"
    const cambio = cambioDe(p0, d.p)
    if (d.estado === 'acepta' && a?.estado !== 'acepta') {
      r.push({ prioridad: 2, tipo: 'aceptacion', texto: `${d.nombre} ya es parte de su repertorio (${dicho}).` })
    } else if (d.estado === 'acepta') {
      if (cambio === 'sube') r.push({ prioridad: 6, tipo: 'aceptacion', texto: `${d.nombre}: le está gustando más (${dicho}).` })
      else if (cambio === 'baja') r.push({ prioridad: 6, tipo: 'aceptacion', texto: `${d.nombre}: le está costando más que antes (${dicho}). ${SIN_PRESION}` })
    } else if (a?.estado === 'acepta') {
      r.push({ prioridad: 4, tipo: 'aceptacion', texto: `${d.nombre}: le está costando más que antes (${dicho}). ${SIN_PRESION}` })
    } else {
      const previo = a?.pasos.at(-1)
      const antesTxt = previo ? (previo === it.cuanto ? ' (igual que la vez anterior)' : ` (antes ${DICHO_ANTES[previo]})`) : ''
      r.push({ prioridad: 3, tipo: 'exposicion', texto: `${d.nombre}: ${d.veces}.ª exposición. Esta vez ${dicho}${antesTxt}. Cada paso cuenta.` })
    }
  }

  // Patrones aprendidos: nuevos, reforzados (si esta comida los tocó) y borrados (si dejaron de cumplirse)
  const previos = new Map(antes.aprendidos.map((p) => [p.clave, p]))
  const actuales = new Map(despues.aprendidos.map((p) => [p.clave, p]))
  const mostrados = new Set(despues.patrones.map((p) => p.clave))
  const obsComida = despues.observaciones.filter((x) => x.comidaId === comida._id)
  let reforzado = false // uno solo por comida, el más relevante (aprendidos viene ordenado): los demás son ruido
  for (const p of despues.aprendidos) {
    const q = previos.get(p.clave)
    if (!q) {
      if (mostrados.has(p.clave)) r.push({ prioridad: 1, tipo: 'patron_nuevo', texto: `Nuevo patrón: ${minuscula(p.texto)}.` })
    } else if (!reforzado && p.n > q.n && mostrados.has(p.clave) && obsComida.some((x) => cumple(p.condiciones, x.atributos, x.contexto))) {
      reforzado = true
      r.push({ prioridad: 5, tipo: 'patron_reforzado', texto: `Se confirma: ${minuscula(p.texto)}.` })
    }
  }
  // Patrones que se borran (§8): son para el equipo. Al padre solo le llega uno, en positivo y si lo explica esta
  // comida: algo que "todavía no aceptaba" y ahora comió. Que deje de cumplirse un "lo acepta" no se le dice (§9).
  const comioAhora = (condiciones: readonly Condicion[]) =>
    obsComida.find((x) => comio(x.cuanto) && cumple(condiciones, x.atributos, x.contexto))
  const borrado =
    antes.aprendidos
      .filter((q) => q.resultado === 'rechaza' && !actuales.has(q.clave) && antes.patrones.some((v) => v.clave === q.clave))
      .flatMap((q) => {
        const x = comioAhora(q.condiciones)
        return x ? [{ q, x, investigacion: false }] : []
      })[0] ??
    despues.borrados
      .filter((p) => p.resultado === 'rechaza' && !antes.borrados.some((q) => q.clave === p.clave))
      .flatMap((q) => {
        const x = comioAhora(q.condiciones)
        return x ? [{ q, x, investigacion: true }] : []
      })[0]
  if (borrado) r.push({ prioridad: 4, tipo: 'patron_borrado', texto: textoBorrado(borrado.q.condiciones, borrado.x.nombre, borrado.investigacion) })

  // Contradicciones entre una regla del padre y lo que pasa (P2): "Contaste que no come nada verde, pero…"
  for (const regla of reglas) {
    if (regla.efecto !== 'rechaza' || !regla.condiciones.length || !regla.condiciones.every((c) => esAtributo(c.tipo))) continue
    const contra = despues.observaciones.filter((x) => comio(x.cuanto) && cumple(regla.condiciones, x.atributos))
    const ahora = obsComida.filter((x) => comio(x.cuanto) && cumple(regla.condiciones, x.atributos))
    if (ahora.length && contra.length >= 3) {
      const nombres = [...new Set(ahora.map((x) => sinAclaracion(x.nombre)))]
      const contado = regla.texto.trim().replace(/[.!¡]+$/, '')
      r.push({
        prioridad: 0, tipo: 'contradiccion',
        texto: `Contaste: "${contado}". Pero esta vez comió ${lista(nombres)}, y ya van ${contra.length} veces que come algo así. ¿Actualizo la regla?`,
      })
    }
  }

  return r
    .sort((a, b) => a.prioridad - b.prioridad)
    .slice(0, max)
    .map(({ tipo, texto }) => ({ tipo, texto }))
}
