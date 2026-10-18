// Prompt de la receta (PLAN.md §7, A9, "Reglas de la receta"). El LLM ve solo el paquete de evidencia (evidencia.texto),
// el candidato elegido de ese paquete y los ingredientes del catálogo que puede usar: nada más del grafo. Las reglas con ✓
// las vuelve a mirar el código (server/validacion/receta.ts), así que acá se piden con las mismas palabras.
import { z } from 'zod'
import type { Alergeno, Candidato, Evidencia, Nutriente, PreparacionCatalogo } from '../../../shared/contratos.js'
import { GRAMOS_MAX, GRAMOS_MIN, NOMBRE_CAMBIO } from '../../validacion/receta.js'

export const NOMBRE_NUTRIENTE: Record<Nutriente, string> = {
  energia_kcal: 'energía', proteina_g: 'proteína', calcio_mg: 'calcio', vitamina_d_ug: 'vitamina D', hierro_mg: 'hierro',
  fibra_g: 'fibra', omega3_g: 'omega-3', b12_ug: 'vitamina B12', vitamina_c_mg: 'vitamina C',
}

/**
 * Las reglas de la receta que valen igual para la del catálogo y para la creativa (v5.4, prompts/receta-creativa.ts):
 * ingredientes, alergias, pasos, presentación, transparencia, cómo ofrecerlo y el lenguaje prohibido.
 */
export const REGLAS_COMUNES_RECETA = `- Ingredientes: solo de la lista, con su alimentoId exacto, en gramos por porción y entre ${GRAMOS_MIN} y ${GRAMOS_MAX} g cada uno. El de más gramos tiene que ser el ingrediente principal de la preparación. La sal y los condimentos no van en la lista: si hacen falta, se nombran en los pasos.
- Alergias: ningún ingrediente ni paso puede llevar un alérgeno del chico. Si la receta de siempre lo lleva (por ejemplo, un rebozado con huevo), reemplazalo por algo de la lista y decí con qué.
- pasos: de 3 a 7, cortos, en voseo ("Cortá", "Horneá"). Sin mezclas: nada de guisos, rellenos ni salsa por encima. Si lleva salsa, va aparte, para mojar.
- presentacion: separado (o en su plato con divisiones, si sus reglas lo piden), en porción mínima (del tamaño de una arveja o de un bastón), al lado de su alimento seguro y sin tocarse. Nombrá su alimento seguro (por ejemplo, "al lado de su milanesa"). Un solo alimento nuevo en el plato: la mayor parte del plato es lo que ya come.
- transparencia: si un ingrediente va adentro y no se ve (por ejemplo, queso en la masa), decilo acá y proponé ofrecerlo también a la vista, aparte. Si todo se ve, null.
- comoOfrecer: sin presión. Usá esta idea: "Ofrecelo sin pedirle que lo coma; que esté en el plato ya es un avance." Decí que cada paso cuenta (que lo tolere en el plato, que lo toque, que lo huela, que lo pruebe) y que conviene servirlo igual, con la misma presentación, de 8 a 15 veces antes de cambiar algo.
- Nunca sugieras suplementos, dosis ni dietas de eliminación. Si el nutriente es la vitamina D, decí en porQue que conviene consultarlo con su pediatra o nutricionista.
- Nunca sugieras sacarle un alimento seguro ni opines sobre si lo que come es sano: no se juzga al chico, a la familia ni a ningún alimento.
- No escribas cantidades de nutrientes (ni mg ni porcentajes): la app las calcula con la tabla de alimentos y las muestra aparte.
- Estas expresiones no pueden aparecer en ningún texto, ni siquiera para negarlas: "que termine", "una probadita más", "premio", "recompensa", "si come", "tiene que comer", "obligar", "forzar", "escondé", "escondido", "disimulá", "oculto", "que no se dé cuenta", "suplemento", "dosis", "dieta".
- Textos en español de Uruguay, con voseo, cálidos y concretos, sin markdown. nombre: corto y descriptivo (por ejemplo, "Bastones de queso al horno, crocantes como sus papas").`

export const SISTEMA_RECETA = `Escribís recetas de food chaining para familias de chicos con autismo y selectividad alimentaria. Cada receta parte de un alimento que el chico ya come (su alimento seguro) y cambia una sola cosa, para acercarlo a un nutriente que le falta. La app ya eligió la preparación y el cambio: vos escribís cómo hacerla, cómo servirla y cómo ofrecerla.

Reglas:
- Usá solo lo que viene en los datos: el paquete de evidencia, la receta a escribir y la lista de ingredientes. No inventes gustos, rechazos ni datos del chico. Respetá las reglas que contó la familia y los patrones del paquete.
- Parte de su alimento seguro y cambia solo lo que dice "Cambia solo". Todo lo que dice "Se mantiene" queda igual. En porQue decí de qué alimento parte (y cuántas veces lo comió), qué cambia, qué se mantiene, qué patrones del paquete aplican y a qué nutriente apunta.
- Si el cambio es la versión fortificada: es la misma preparación en su versión fortificada, de la misma marca si existe.
${REGLAS_COMUNES_RECETA}`

/** La salida del LLM. Sin rangos ni largos: la salida estructurada no los acepta, y los valida el código. */
export function esquemaSalidaReceta(alimentoIds: string[]) {
  const alimentoId = alimentoIds.length ? z.enum(alimentoIds as [string, ...string[]]) : z.string()
  return z.object({
    nombre: z.string(),
    ingredientes: z.array(z.object({ alimentoId, gramos: z.number() })),
    pasos: z.array(z.string()),
    porQue: z.string(),
    presentacion: z.string(),
    comoOfrecer: z.string(),
    transparencia: z.string().nullable(),
  })
}
export type SalidaReceta = z.infer<ReturnType<typeof esquemaSalidaReceta>>

export interface DatosPromptReceta {
  evidencia: Evidencia
  candidato: Candidato                                    // el elegido, siempre uno de evidencia.candidatos
  base: PreparacionCatalogo                               // su preparación en el catálogo (los ingredientes de referencia)
  ingredientes: { alimentoId: string; nombre: string }[]  // los sugeridos: los de la base, los de su alimento seguro y básicos
  alergias: Alergeno[]
  anterior?: { salida: SalidaReceta; problemas: string[] } // para el reintento: lo que respondió y por qué no pasó
  yaVistas?: string[]                                     // v5.4 · recetas de esta preparación que la familia ya vio
}

const porcentaje = (x: number) => `${Math.round(x * 100)}%`
const lista = (xs: string[]) => (xs.length ? xs.join(', ') : 'ninguno')

export function promptReceta(d: DatosPromptReceta): string {
  const { evidencia, candidato, base } = d
  const nombreDe = new Map(d.ingredientes.map((i) => [i.alimentoId, i.nombre]))
  const deLaBase = base.ingredientes.map((i) => `${nombreDe.get(i.alimentoId) ?? i.alimentoId} (${i.alimentoId}) ${i.gramos} g`)
  const lineas = [
    'Paquete de evidencia (lo único que sabés del chico):',
    evidencia.texto,
    '',
    'Receta a escribir:',
    `- Preparación: ${candidato.nombre}`,
    `- Parte de: ${candidato.camino.desde} (la comió ${candidato.camino.aceptacion})`,
    `- Cambia solo: ${NOMBRE_CAMBIO[candidato.cambio]}`,
    `- Se mantiene: ${lista(candidato.seMantiene)}`,
    `- Patrones que aplican: ${lista(candidato.patrones)}`,
    `- Apunta a: ${NOMBRE_NUTRIENTE[evidencia.nutriente]} (esta semana cubrió el ${porcentaje(evidencia.coberturaSemana)})`,
    `- Ingredientes de la preparación, por porción: ${lista(deLaBase)}`,
    `- Alergias: ${d.alergias.length ? `${d.alergias.join(', ')}. Ningún ingrediente ni paso puede llevarlas.` : 'ninguna declarada.'}`,
  ]
  if (evidencia.nutriente === 'vitamina_d_ug') {
    lineas.push('- La vitamina D casi no está en los alimentos: en porQue decí que conviene consultarlo con su pediatra o nutricionista.')
  }
  lineas.push('', 'Ingredientes que podés usar (alimentoId: nombre):', ...d.ingredientes.map((i) => `- ${i.alimentoId}: ${i.nombre}`))
  if (d.yaVistas?.length) {
    lineas.push(
      '',
      'La familia ya vio estas recetas de esta misma preparación:',
      ...d.yaVistas.map((n) => `- ${n}`),
      'Escribí otra versión, que no se parezca a esas: otro nombre y otra manera de hacerla (otro paso a paso, otro corte o terminación dentro de lo que se mantiene) o de presentarla al lado de su alimento seguro. Lo que dice "Se mantiene" y todas las reglas siguen igual.',
    )
  }
  if (d.anterior) {
    lineas.push(
      '',
      'Tu respuesta anterior no pasó la validación de la app por estos motivos:',
      ...d.anterior.problemas.map((p) => `- ${p}`),
      'Corregí eso y devolvé la receta completa otra vez. Tu respuesta anterior era:',
      JSON.stringify(d.anterior.salida),
    )
  }
  return lineas.join('\n')
}
