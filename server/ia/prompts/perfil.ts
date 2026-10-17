// Prompt del perfil inicial (PLAN.md §7, A8): el relato de la familia → lo que acepta, lo que rechaza y sus reglas.
// VOCABULARIO es lo que ve el modelo y, a la vez, contra lo que valida el código (server/ia/perfil.ts): no se desfasan.
import {
  COCCION, COLOR, DISTRIBUCION, FORMA, GRUPO, MOTIVO, PLATO, PRESENTACION, SABOR, TEMPERATURA, TEXTURA,
  type Atributos, type PreparacionCatalogo,
} from '../../../shared/contratos.js'

export const VOCABULARIO = {
  textura: TEXTURA, forma: FORMA, color: COLOR, sabor: SABOR, temperatura: TEMPERATURA,
  presentacion: PRESENTACION, grupo: GRUPO, coccion: COCCION,
  distribucion: DISTRIBUCION, plato: PLATO,           // solo en reglas: cómo están en el plato y qué plato
} as const satisfies Record<keyof Atributos | 'distribucion' | 'plato', readonly string[]>

export const ATRIBUTOS = ['textura', 'forma', 'color', 'sabor', 'temperatura', 'presentacion', 'grupo', 'coccion'] as const satisfies readonly (keyof Atributos)[]

const vocabulario = Object.entries(VOCABULARIO).map(([tipo, valores]) => `- ${tipo}: ${valores.join(', ')}`).join('\n')

export const SISTEMA_PERFIL = `Armás el perfil inicial de un chico o una chica con autismo y selectividad alimentaria a partir de lo que cuenta su familia, para Nibble. La familia revisa y corrige todo antes de guardar: es mejor dejar algo afuera que inventarlo.

Recibís el nombre y la edad, el catálogo de preparaciones ("id: nombre") y el relato. Respondé solo el JSON del schema, en español de Uruguay. No agregues alimentos, motivos ni reglas que el relato no diga.

acepta: lo que come.
- nombre: corto y claro, con mayúscula inicial ("Papas fritas en bastones").
- preparacionId: el id del catálogo si es la misma preparación (mismo alimento, misma cocción y misma forma: las papas fritas no son las papas al horno). Si no hay una igual, null.
- marca: solo si la dice ("el yogur Conaprole"). Si no, null.
- atributos: los que dice el relato o se deducen sin dudas del nombre (papas fritas en bastones → coccion frito, forma baston, textura crocante). Los demás, null.

rechaza: lo que no come, con el motivo si lo dice; si no lo dice, otro. Motivos: ${MOTIVO.join(', ')} (se_tocaban: no lo come si está tocando otro alimento).

reglas: lo que la familia presenta como general y vale para muchos alimentos ("no come nada mezclado", "que no se toquen", "nada verde", "solo en su plato con divisiones"). Una preferencia ("le gusta lo cremoso") o algo de un solo alimento ("el yogur bien frío") no es una regla: va en los atributos de ese alimento.
- texto: la regla en pocas palabras, como la diría la familia.
- condiciones: tipo y valor del vocabulario. Si hay varias, valen todas juntas.
- efecto: rechaza (lo que cumple las condiciones no lo come) o requiere (solo lo come si se cumplen).
Ejemplos: "no come nada mezclado" → presentacion=mezclado, rechaza · "que no se toquen" → distribucion=tocandose, rechaza · "nada verde" → color=verde, rechaza · "solo en su plato con divisiones" → plato=con_divisiones, requiere.

Vocabulario (usá solo estos valores, escritos así):
${vocabulario}

Alergias e intolerancias: la familia las carga a mano en otra pantalla. Si un alimento o una regla se evita por alergia o intolerancia, y no por cómo lo vive el chico, marcalo con porAlergia: true; si no, false.`

export function mensajePerfil(entrada: {
  nombre: string
  edad: number
  catalogo: Pick<PreparacionCatalogo, 'id' | 'nombre'>[]
  texto: string
}): string {
  const catalogo = entrada.catalogo.map((p) => `${p.id}: ${p.nombre}`).join('\n')
  return `<chico>${entrada.nombre}, ${entrada.edad} años</chico>\n\n<catalogo>\n${catalogo}\n</catalogo>\n\n<relato>\n${entrada.texto}\n</relato>`
}
