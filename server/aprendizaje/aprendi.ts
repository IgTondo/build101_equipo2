// "Qué aprendí" (PLAN.md §8): plantillas, sin LLM. Compara el estado del chico antes y después de una comida.
import type { Aprendizaje, Regla } from '../../shared/contratos.js'
import type { ComidaDoc } from '../datos/tipos.js'
import { CONFIG_ACEPTACION } from './aceptacion.js'
import { cumple, esAtributo } from './condiciones.js'
import { DICHO, DICHO_ANTES, comio } from './escalera.js'
import type { EstadoNino } from './estado.js'
import { decimal, lista, minuscula } from './textos.js'

interface Candidata extends Aprendizaje {
  prioridad: number // 0 primero
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
    const p0 = decimal(a?.p ?? CONFIG_ACEPTACION.inicialNuevo)
    const p1 = decimal(d.p)
    const dicho = DICHO[it.cuanto]
    if (d.estado === 'acepta' && a?.estado !== 'acepta') {
      r.push({ prioridad: 2, tipo: 'aceptacion', texto: `${d.nombre} ya es parte de su repertorio: aceptación ${p0} → ${p1} (${dicho}).` })
    } else if (d.estado === 'acepta') {
      r.push({ prioridad: 6, tipo: 'aceptacion', texto: `${d.nombre}: aceptación ${p0} → ${p1} (${dicho}).` })
    } else if (a?.estado === 'acepta') {
      r.push({
        prioridad: 4, tipo: 'aceptacion',
        texto: `${d.nombre}: aceptación ${p0} → ${p1} (${dicho}). A veces pasa: seguí ofreciéndolo como siempre, sin presión.`,
      })
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
  for (const q of antes.aprendidos) {
    if (!actuales.has(q.clave) && antes.patrones.some((v) => v.clave === q.clave)) {
      r.push({ prioridad: 4, tipo: 'patron_borrado', texto: `Ya no se cumple: ${minuscula(q.texto.replace(/ \(\d+ de \d+\)$/, ''))}.` })
    }
  }
  const borradosAntes = new Set(antes.borrados.map((p) => p.clave))
  for (const p of despues.borrados) {
    if (!borradosAntes.has(p.clave)) {
      r.push({
        prioridad: 4, tipo: 'patron_borrado',
        texto: `Con lo que registraste, no se cumple lo que dice la investigación: ${minuscula(p.texto.replace(' (según la investigación)', ''))}.`,
      })
    }
  }

  // Contradicciones entre una regla del padre y lo que pasa (P2): "Contaste que no come nada verde, pero…"
  for (const regla of reglas) {
    if (regla.efecto !== 'rechaza' || !regla.condiciones.length || !regla.condiciones.every((c) => esAtributo(c.tipo))) continue
    const contra = despues.observaciones.filter((x) => comio(x.cuanto) && cumple(regla.condiciones, x.atributos))
    const ahora = obsComida.some((x) => comio(x.cuanto) && cumple(regla.condiciones, x.atributos))
    if (ahora && contra.length >= 3) {
      const nombres = [...new Set(contra.map((x) => minuscula(x.nombre)))]
      r.push({
        prioridad: 0, tipo: 'contradiccion',
        texto: `Contaste: "${regla.texto}". Pero aceptó ${contra.length} veces ${lista(nombres)}. ¿Actualizo la regla?`,
      })
    }
  }

  return r
    .sort((a, b) => a.prioridad - b.prioridad)
    .slice(0, max)
    .map(({ tipo, texto }) => ({ tipo, texto }))
}
