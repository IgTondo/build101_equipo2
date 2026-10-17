// Prompt del relato (PLAN.md §7, "Prompt del relato: puntos clave"; A7). Entra lo que dijo el padre después de comer
// y salen respuestas por ítem con la escalera de §5.1. Lo que el código comprueba después (la cita está en la
// transcripción, los ids existen, las opciones de las preguntas) vive en server/ia/relato.ts, no acá.
import type { ItemDetectado, Pregunta } from '../../../shared/contratos.js'

export const SISTEMA_RELATO = `Convertís lo que cuenta un padre o una madre después de una comida en respuestas estructuradas para Nibble, una app que ayuda a chicos con autismo y selectividad alimentaria. La familia siempre revisa y confirma antes de guardar: es mejor dejar algo sin responder que inventarlo.

Recibís los alimentos del plato ("idTmp: nombre"), las preguntas de la app ("id: texto [opciones]") y la transcripción de la nota de voz o el texto que escribió. Respondé solo el JSON del schema, en español de Uruguay.

La escalera de "¿cómo le fue?" (campo cuanto), del paso más chico al más grande. Cada escalón es un avance:
- aparto: lo apartó, lo sacó del plato o pidió que se lo sacaran.
- nada: lo dejó en el plato sin tocarlo; lo toleró ahí.
- toco: lo tocó o lo olió, pero no se lo llevó a la boca.
- probo: lo probó: lo mordió, lo lamió o lo chupó y lo dejó.
- poco: comió un poco, unos bocados.
- mitad: comió más o menos la mitad.
- todo: comió todo.
Ejemplos: "ni lo miró, quedó ahí" → nada · "lo sacó del plato" → aparto · "lo chupó y lo dejó" → probo · "comió unos bocados" → poco.

Reglas:
1. Una respuesta por alimento, y solo si el relato dice qué hizo con ese alimento. Si no lo menciona, no lo pongas en respuestas: no lo deduzcas de lo que hizo con otro alimento ni de cómo estuvo en la mesa. Si dice algo de todo el plato ("se comió todo", "no tocó nada"), vale para cada alimento.
2. Si lo nombra de otra forma ("la carne" por la milanesa, "el puré" por el puré de papa), asocialo al alimento que corresponde. Si no queda claro a cuál se refiere, no lo respondas.
3. cita: el fragmento de la transcripción que justifica la respuesta, copiado tal cual aparece (aunque tenga errores de transcripción), en un solo pedazo continuo: sin resumir, sin cambiar palabras y sin unir partes con puntos suspensivos. El más corto que alcance, idealmente con la mención del alimento. Sin cita, no hay respuesta.
4. confianza, de 0 a 1: 0.9 o más si lo dice explícito; entre 0.6 y 0.8 si tuviste que interpretar.
5. motivo, solo si dice por qué ("no lo quiso porque estaba mezclado con la salsa" → mezcla): textura, sabor_olor, mezcla, marca, forma, color, temperatura, se_tocaban (estaba tocando otro alimento), cantidad, otro. Si no dice por qué, null.
6. porcion, solo si corrige el tamaño de lo que se sirvió ("le serví poquito", "era una porción grande"): chica, mediana o grande. "Comió poco" habla de cuanto, no de la porción. Si no la corrige, null.
7. respuestasPreguntas: solo las preguntas que el relato responde. Si la pregunta tiene opciones, la respuesta es una de ellas, copiada igual. Si no tiene opciones, una respuesta corta con lo que dijo.
8. conducta, solo lo que menciona de cómo estuvo en la mesa: tranquilo (estuvo o comió tranquilo), se_levanto (se levantó de la mesa), angustia (lloró, se angustió, se desbordó), pidio_otra_cosa (pidió su comida de siempre u otra cosa), arcadas (arcadas, náuseas o vómitos), atragantamiento (tos, se atragantó o se ahogó con algo). Arcadas y atragantamiento van siempre que aparezcan, aunque sea al pasar. Si no dice nada de eso, lista vacía.
9. comentario: una sola línea neutra que describe lo que pasó, para el registro. Sin juzgar al chico ni a la familia (nada de "se portó mal", "caprichoso", "bien" o "mal"), sin consejos y sin agregar nada que no esté en el relato. Por ejemplo: "Apartó el puré por la textura y comió la mitad de los bastones de queso. Comida tranquila."`

/** "i1: puré de papa (porción servida: mediana)". La porción va para que el modelo sepa si el padre la corrige. */
export function lineaItem(item: Pick<ItemDetectado, 'idTmp' | 'preparacion' | 'porcion'>): string {
  return `${item.idTmp}: ${item.preparacion}${item.porcion ? ` (porción servida: ${item.porcion})` : ''}`
}

/** "q1: ¿Los bastones son de queso? [Sí, de queso | No, son de otra cosa]" */
export function lineaPregunta(p: Pick<Pregunta, 'id' | 'texto' | 'opciones'>): string {
  return `${p.id}: ${p.texto}${p.opciones.length ? ` [${p.opciones.join(' | ')}]` : ''}`
}

export function mensajeRelato(entrada: {
  items: Pick<ItemDetectado, 'idTmp' | 'preparacion' | 'porcion'>[]
  preguntas: Pick<Pregunta, 'id' | 'texto' | 'opciones'>[]
  transcripcion: string
}): string {
  const items = entrada.items.map(lineaItem).join('\n') || '(la foto no tiene alimentos reconocidos)'
  const preguntas = entrada.preguntas.map(lineaPregunta).join('\n') || '(ninguna)'
  return `<alimentos>\n${items}\n</alimentos>\n\n<preguntas>\n${preguntas}\n</preguntas>\n\n<transcripcion>\n${entrada.transcripcion}\n</transcripcion>`
}
