// Prompts del perfil inicial (PLAN.md §7, A8 y A12): el relato de la familia → lo que acepta, lo que rechaza y sus
// reglas; la foto de la indicación del nutricionista → sus objetivos diarios.
// VOCABULARIO y NUTRIENTES_OBJETIVO son lo que ve el modelo y, a la vez, contra lo que valida el código
// (server/ia/perfil.ts): no se desfasan.
import {
  ALERGENO, COCCION, COLOR, DISTRIBUCION, FORMA, GRUPO, MOTIVO, NUTRIENTE, PLATO, PRESENTACION, SABOR, TEMPERATURA, TEXTURA,
  type Atributos, type Nutriente, type PreparacionCatalogo,
} from '../../../shared/contratos.js'

export const VOCABULARIO = {
  textura: TEXTURA, forma: FORMA, color: COLOR, sabor: SABOR, temperatura: TEMPERATURA,
  presentacion: PRESENTACION, grupo: GRUPO, coccion: COCCION,
  distribucion: DISTRIBUCION, plato: PLATO,           // solo en reglas: cómo están en el plato y qué plato
} as const satisfies Record<keyof Atributos | 'distribucion' | 'plato', readonly string[]>

export const ATRIBUTOS = ['textura', 'forma', 'color', 'sabor', 'temperatura', 'presentacion', 'grupo', 'coccion'] as const satisfies readonly (keyof Atributos)[]

const vocabulario = Object.entries(VOCABULARIO).map(([tipo, valores]) => `- ${tipo}: ${valores.join(', ')}`).join('\n')

export const SISTEMA_PERFIL = `Armás el perfil inicial de un chico o una chica con autismo y selectividad alimentaria a partir de lo que cuenta su familia, para Nibble. La familia revisa y corrige todo antes de guardar: es mejor dejar algo afuera que inventarlo.

Recibís el nombre y la edad (si los hay), el catálogo de preparaciones ("id: nombre") y el relato. Respondé solo el JSON del schema, en español de Uruguay. No agregues alimentos, motivos ni reglas que el relato no diga.

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
  nombre?: string
  edad?: number
  catalogo: Pick<PreparacionCatalogo, 'id' | 'nombre'>[]
  texto: string
}): string {
  const catalogo = entrada.catalogo.map((p) => `${p.id}: ${p.nombre}`).join('\n')
  // v5 · En el alta por voz no vienen el nombre ni la edad: los saca extraerDatos() del mismo relato, en paralelo
  const chico = entrada.nombre ? `<chico>${entrada.nombre}${entrada.edad !== undefined ? `, ${entrada.edad} años` : ''}</chico>\n\n` : ''
  return `${chico}<catalogo>\n${catalogo}\n</catalogo>\n\n<relato>\n${entrada.texto}\n</relato>`
}

// ---------- Los datos del chico en el alta por voz (A8b, PLAN §5.2) ----------
export const SISTEMA_DATOS = `Del relato de una familia sobre su hijo o hija (un chico o una chica con autismo y selectividad alimentaria), sacás sus datos básicos para Nibble. La familia revisa y corrige todo antes de guardar: es mejor dejar un dato vacío que inventarlo. Respondé solo el JSON del schema.

Cada dato va con su cita: el fragmento del relato de donde lo sacaste, copiado TAL CUAL (mismas palabras, sin corregir ni resumir). Sin cita, el dato va en null.
- nombre: el nombre del chico, como lo dicen ("Valentina", "Tomi"). No el de quien habla.
- edad: en años, como número (ocho años → 8; "tiene seis" → 6; "un año y medio" → 1.5).
- sexo: masculino o femenino si el relato lo deja claro: lo dice ("mi hija", "mi nene") o habla del chico en femenino o en masculino ("es alérgica" → femenino, "está flaquito" → masculino, "ella", "él"). La cita es esa frase. Un nombre solo no alcanza.
- pesoKg: en kilos (veinticinco kilos → 25; 25,5 → 25.5).
- tallaCm: en centímetros (un metro dieciséis → 116; 1,27 → 127; "mide 98" → 98).
- alergiasMencionadas: cada alergia o intolerancia que nombran, con el valor de esta lista: ${ALERGENO.join(', ')} (leche también para "lactosa" o "lácteos"; gluten para "celíaco" o "TACC"; frutos_secos para nueces, almendras, avellanas). Lo que no está en la lista, no va.
- sinAlergias: si dicen explícitamente que no tiene alergias ("no es alérgico a nada"), con su cita; si no, null.
- alertas: bajo_peso (si dicen que está bajo de peso o que el pediatra se lo marcó), arcadas_vomitos (arcadas o vómitos con la comida), menos_15_alimentos (si dicen que come menos de 15 alimentos o "muy pocas cosas" con números así). Cada una con su cita.
- atragantamiento: si dicen que se atraganta o se ahoga con la comida, con su cita; si dicen que no, null.
- dieta: ninguna, sin_gluten_caseina u otra, solo si la mencionan ("no hace ninguna dieta" → ninguna).
- suplementos: lo que toma, como lo dicen ("vitamina D en gotas"), solo si lo mencionan; "no toma suplementos" → null.`

export function mensajeDatos(texto: string): string {
  return `<relato>\n${texto}\n</relato>`
}

// ---------- Foto de la indicación del nutricionista (A12) ----------
/** Los nutrientes que pueden tener objetivo: todos menos la energía, que se muestra sin meta (§1). */
export const NUTRIENTES_OBJETIVO = NUTRIENTE.filter((n): n is Exclude<Nutriente, 'energia_kcal'> => n !== 'energia_kcal')

export const SISTEMA_INDICACION = `Leés la foto de una indicación del nutricionista o del pediatra de un chico o una chica con autismo y selectividad alimentaria, y sacás los objetivos de ingesta diaria de nutrientes que dice. Respondé solo el JSON del schema.

Nutrientes posibles (no hay otros): ${NUTRIENTES_OBJETIVO.join(', ')}. La energía (calorías) no va: en Nibble no tiene meta.

Por cada objetivo escrito en la indicación:
- nutriente.
- valor: el número tal como figura, sin convertir (1,3 → 1.3).
- unidad: la que figura, sin convertir: g, mg, ug (también si dice µg o mcg) o UI. Si es otra, otra.
- cita: el texto de la indicación de donde lo sacaste, copiado tal cual.
- tipo: objetivo_diario (cuánto tiene que comer por día con la comida), objetivo_semanal, suplemento (gotas, comprimidos, jarabes o cualquier producto o medicamento recetado, aunque sea de un nutriente: "vitamina D 400 UI en gotas" es suplemento) u otro (análisis de sangre, valores de laboratorio, porciones de alimentos o cualquier otra cosa).

No inventes ni completes con valores de referencia: solo lo que está escrito. Si la foto no se lee o no es una indicación de nutrientes, devolvé la lista vacía.`

export function mensajeIndicacion(entrada: { nombre: string; edad: number }): string {
  return `Esta es la indicación para ${entrada.nombre}, de ${entrada.edad} años.`
}
