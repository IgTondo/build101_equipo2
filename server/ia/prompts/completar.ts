// Prompt de completarAlimentos() (v5.8): los alimentos declarados que no están en el catálogo y quedaron a medias →
// la versión típica de cómo se sirven (8 atributos, ingredientes, momentos) y una duda si importa. Mismas convenciones
// que el perfil (prompts/perfil.ts), para que lo completado después sea igual a lo que sale del alta.
import type { Alimento, AlimentoDeclarado, Dieta } from '../../../shared/contratos.js'
import { ATRIBUTOS, VOCABULARIO } from './perfil.js'

const vocabulario = ATRIBUTOS.map((k) => `  - ${k}: ${VOCABULARIO[k].join(', ')}`).join('\n')

export const SISTEMA_COMPLETAR = `Para Nibble (chicos con autismo y selectividad alimentaria): recibís alimentos que un chico come o rechaza, como los nombró su familia y con lo que ya se sabe de cada uno. Para cada uno devolvé la versión típica en Uruguay de cómo se sirve, respetando lo que dice su nombre (si dice "sin" algo, o el chico es alérgico o hace una dieta, va la versión sin eso). La familia revisa todo: lo que completás es lo típico, no una certeza. Respondé solo el JSON del schema, con un ítem por alimento y su número en n.
- atributos: los 8, con este vocabulario (valores escritos así). Si ya se sabe alguno, devolvelo igual.
${vocabulario}
  Convenciones: coccion listo = se come como viene (yogur, leche, galletitas, chips, pan), no es crudo; la papa, el boniato y el choclo son grupo cereal_almidon; las bebidas son forma entero y textura cremoso; lo que se come a temperatura ambiente es frio; grupo es el del ingrediente principal. El ingrediente principal (el de más gramos) es un alimento concreto de la lista, nunca un genérico otro_… si hay uno que sirva: el sushi es arroz (más lo que lleve), la empanada es harina con su relleno, la tarta es harina con lo de adentro.
- ingredientes: los de la versión que come, como alimentoId de la lista de alimentos, con los gramos de una porción para un chico de su edad. Lo que no está en la lista, al genérico de su grupo (otro_fruta, otro_otro...).
- momentos: en qué comidas se suele comer: desayuno, almuerzo, merienda, cena o colacion.
- duda: solo si la versión típica suele llevar algo que choca con LAS ALERGIAS DE ESTE CHICO y el nombre no aclara que la suya no lo lleva (pescado o sésamo en el sushi para un chico alérgico a eso; el huevo del rebozado solo si es alérgico al huevo), una pregunta corta para la familia, de menos de 15 palabras y en voseo ("¿El sushi lleva pescado o sésamo?"); nombrá la alergia solo si la duda es por ella. No preguntes por marcas ni trazas. Si no hay nada que importe, null.`

/** El system prompt con la lista de alimentos. No depende del chico: se cachea. */
export function sistemaCompletar(alimentos: Pick<Alimento, 'id' | 'nombre'>[]): string {
  return `${SISTEMA_COMPLETAR}\n\nAlimentos (alimentoId: nombre):\n${alimentos.map((a) => `- ${a.id}: ${a.nombre}`).join('\n')}`
}

const DIETAS: Record<Dieta, string> = { ninguna: '', sin_gluten_caseina: 'sin gluten ni caseína (nada con trigo ni con lácteos)', otra: '' }

export function mensajeCompletar(
  items: Pick<AlimentoDeclarado, 'nombre' | 'dicho' | 'atributos'>[],
  chico: { alergias: readonly string[]; dieta?: Dieta; edad?: number },
): string {
  const datos = [
    chico.edad !== undefined ? `${chico.edad} años` : '',
    chico.alergias.length ? `alergias: ${chico.alergias.map((a) => a.replace(/_/g, ' ')).join(', ')}` : 'sin alergias cargadas',
    chico.dieta ? DIETAS[chico.dieta] : '',
  ].filter(Boolean).join('; ')
  const lista = items.map((a, i) => {
    const sabido = Object.entries(a.atributos ?? {}).map(([k, v]) => `${k}=${v}`).join(', ')
    const dicho = a.dicho && a.dicho !== a.nombre ? ` (la familia dijo: "${a.dicho}")` : ''
    return `${i + 1}. ${a.nombre}${dicho}${sabido ? ` [ya se sabe: ${sabido}]` : ''}`
  })
  return `<chico>${datos}</chico>\n\n<alimentos>\n${lista.join('\n')}\n</alimentos>`
}
