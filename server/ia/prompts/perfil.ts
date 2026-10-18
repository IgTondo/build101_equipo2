// Prompts del perfil inicial (PLAN.md §7, A8 y A12): el relato de la familia → lo que acepta, lo que rechaza y sus
// reglas; la foto de la indicación del nutricionista → sus objetivos diarios.
// VOCABULARIO y NUTRIENTES_OBJETIVO son lo que ve el modelo y, a la vez, contra lo que valida el código
// (server/ia/perfil.ts): no se desfasan.
import {
  ALERGENO, COCCION, COLOR, DISTRIBUCION, FORMA, GRUPO, MOTIVO, NUTRIENTE, PLATO, PRESENTACION, SABOR, TEMPERATURA, TEXTURA,
  type Alimento, type Atributos, type Nutriente, type PreparacionCatalogo,
} from '../../../shared/contratos.js'

export const VOCABULARIO = {
  textura: TEXTURA, forma: FORMA, color: COLOR, sabor: SABOR, temperatura: TEMPERATURA,
  presentacion: PRESENTACION, grupo: GRUPO, coccion: COCCION,
  distribucion: DISTRIBUCION, plato: PLATO,           // solo en reglas: cómo están en el plato y qué plato
} as const satisfies Record<keyof Atributos | 'distribucion' | 'plato', readonly string[]>

export const ATRIBUTOS = ['textura', 'forma', 'color', 'sabor', 'temperatura', 'presentacion', 'grupo', 'coccion'] as const satisfies readonly (keyof Atributos)[]

const vocabulario = Object.entries(VOCABULARIO).map(([tipo, valores]) => `- ${tipo}: ${valores.join(', ')}`).join('\n')

// v5.8 · Prompt V2 (eval del 18/10, 13 relatos): con el anterior el modelo cambiaba el ingrediente, el sabor o la
// variedad y reescribía el nombre con el del catálogo (yogur de frutilla → "Yogur bebible de vainilla"); los rechazos
// salían sin atributos y lo que no estaba en el catálogo, con 2 o 3 de 8. Con este, más verificarId() en el código:
// 0 ids mal, 8 de 8 atributos y los ingredientes de lo que no está en el catálogo.
export const SISTEMA_PERFIL = `Armás el perfil inicial de un chico o una chica con autismo y selectividad alimentaria a partir de lo que cuenta su familia, para Nibble. La familia revisa y corrige todo antes de guardar: es mejor dejar algo afuera que inventarlo.

Recibís el nombre y la edad (si los hay), sus alergias (si las hay), el catálogo de preparaciones ("id: nombre [ingredientes]") y el relato. Respondé solo el JSON del schema, en español de Uruguay. No agregues alimentos, motivos ni reglas que el relato no diga.

acepta: lo que come. Si nombra varios alimentos puntuales, cada uno va por separado.
- dicho: las palabras con que la familia nombra ese alimento, copiadas TAL CUAL del relato ("milanesa de pollo al horno").
- nombre: corto y claro, con mayúscula inicial, fiel a lo que dijo la familia (no lo cambies por el nombre del catálogo).
- preparacionId: el id del catálogo SOLO si es exactamente la misma preparación. Tienen que coincidir:
  · el ingrediente principal: pollo, carne, merluza, soja, lentejas, jamón o queso no se intercambian (una milanesa de pollo NO es una milanesa de carne; una de soja NO es una de lentejas);
  · la cocción y la forma (papas fritas ≠ papas al horno; en bastones ≠ en cubos);
  · el sabor o la variedad (yogur de frutilla ≠ de vainilla; galletitas María ≠ de agua);
  · comprado o casero, si el catálogo lo distingue;
  · los ingredientes: si la del catálogo lleva algo que la familia no dijo (huevo, queso, salsa, leche) o la familia dice "sin" algo que la del catálogo lleva, no es la misma.
  Ante cualquier duda, null. Un null lo completamos después; un id equivocado le enseña a la app algo falso del chico.
- marca: solo si la dice ("el yogur Conaprole"). Si no, null.
- atributos: los 8, siempre. Lo que dice el relato y, lo que no dice, el valor típico de cómo se sirve esa preparación en Uruguay (la familia lo corrige). Convenciones del catálogo: coccion listo = se come como viene (yogur, leche, galletitas, chips, pan): no es crudo; la papa, el boniato y el choclo son grupo cereal_almidon (no verdura); las bebidas (leche, licuado, jugo, yogur bebible) son forma entero y textura cremoso, y un licuado con leche es lacteo; lo que se come a temperatura ambiente (galletitas, pan, frutas) es frio; grupo es el del ingrediente principal. El ingrediente principal (el de más gramos) es un alimento concreto de la lista, nunca un genérico otro_… si hay uno que sirva: el sushi es arroz (más lo que lleve), la empanada es harina con su relleno, la tarta es harina con lo de adentro.
- ingredientes: si preparacionId es null, los ingredientes típicos de la versión que come este chico, como alimentoId de la lista de alimentos, con los gramos de una porción para un chico. Respetá lo que dice el relato (si dice "sin" algo, o el chico es alérgico, va la versión sin eso). Lo que no está en la lista, al genérico de su grupo (otro_fruta, otro_otro...). Si preparacionId no es null, lista vacía.
- momentos: en qué comidas se suele comer (desayuno, almuerzo, merienda, cena, colacion), lo que diga el relato o lo típico.
- duda: solo si la versión típica suele llevar algo que choca con LAS ALERGIAS DE ESTE CHICO y el relato no aclara que la suya no lo lleva (pescado o sésamo en el sushi para un chico alérgico a eso; el huevo del rebozado solo si es alérgico al huevo), una pregunta corta para la familia, de menos de 15 palabras y en voseo ("¿El sushi lleva pescado o sésamo? Rosario es alérgica"); nombrá la alergia solo si la duda es por ella. No preguntes por marcas ni trazas. Si no hay nada que importe, null.

rechaza: lo que no come (con dicho, nombre, preparacionId con la misma regla estricta y los 8 atributos típicos), con el motivo si lo dice; si no lo dice, otro. Motivos: ${MOTIVO.join(', ')} (se_tocaban: no lo come si está tocando otro alimento). Un alimento solo ("no come queso", "la carne la escupe") va acá: no es una regla. No deduzcas rechazos que la familia no dijo ("solo en bastones" no es un rechazo de otra preparación).

reglas: lo que la familia presenta como general y vale para muchos alimentos ("no come nada mezclado", "que no se toquen", "nada verde", "solo en su plato con divisiones"). Un alimento solo no se generaliza a su grupo (no come queso ≠ no come lácteos; no come carne ≠ no come proteínas). Una preferencia ("le gusta lo cremoso") o algo de un solo alimento ("el yogur bien frío") no es una regla: va en los atributos de ese alimento. Una regla no puede chocar con lo que acepta: si come pizza, "nada mezclado" no incluye a la pizza.
- texto: la regla en pocas palabras, como la diría la familia.
- condiciones: tipo y valor del vocabulario. Si hay varias, valen todas juntas.
- efecto: rechaza (lo que cumple las condiciones no lo come) o requiere (solo lo come si se cumplen).
Ejemplos: "no come nada mezclado" → presentacion=mezclado, rechaza · "que no se toquen" → distribucion=tocandose, rechaza · "nada verde" → color=verde, rechaza · "solo en su plato con divisiones" → plato=con_divisiones, requiere.

Vocabulario (usá solo estos valores, escritos así):
${vocabulario}

Alergias e intolerancias: la familia las carga en otra pantalla. Usalas para elegir la versión que come y para las dudas, pero no las pongas en rechaza ni en reglas: si un alimento o una regla se evita por alergia o intolerancia, y no por cómo lo vive el chico, marcalo con porAlergia: true; si no, false.`

/** El system prompt con la lista de alimentos (los alimentoId de los ingredientes). No depende del chico: se cachea. */
export function sistemaPerfil(alimentos: Pick<Alimento, 'id' | 'nombre'>[]): string {
  return `${SISTEMA_PERFIL}\n\nAlimentos (alimentoId: nombre):\n${alimentos.map((a) => `- ${a.id}: ${a.nombre}`).join('\n')}`
}

export function mensajePerfil(entrada: {
  nombre?: string
  edad?: number
  alergias?: readonly string[]          // v5.8 · las de DatosBasicos (ALERGENO y las otras), si vinieron
  catalogo: (Pick<PreparacionCatalogo, 'id' | 'nombre'> & { ingredientes?: PreparacionCatalogo['ingredientes'] })[]
  texto: string
}): string {
  const catalogo = entrada.catalogo
    .map((p) => `${p.id}: ${p.nombre}${p.ingredientes?.length ? ` [${p.ingredientes.map((i) => i.alimentoId).join(', ')}]` : ''}`)
    .join('\n')
  // v5 · En el alta por voz no vienen el nombre ni la edad: los saca extraerDatos() del mismo relato, en paralelo
  const chico = entrada.nombre ? `<chico>${entrada.nombre}${entrada.edad !== undefined ? `, ${entrada.edad} años` : ''}</chico>\n\n` : ''
  const alergias = entrada.alergias?.length ? `<alergias>${entrada.alergias.map((a) => a.replace(/_/g, ' ')).join(', ')}</alergias>\n\n` : ''
  return `${chico}${alergias}<catalogo>\n${catalogo}\n</catalogo>\n\n<relato>\n${entrada.texto}\n</relato>`
}

// ---------- Los datos del chico en el alta por voz (A8b, PLAN §5.2) ----------
export const SISTEMA_DATOS = `Del relato de una familia sobre su hijo o hija (un chico o una chica con autismo y selectividad alimentaria), sacás sus datos básicos para Nibble. La familia revisa y corrige todo antes de guardar: es mejor dejar un dato vacío que inventarlo. Respondé solo el JSON del schema.

Cada dato va con su cita: el fragmento del relato de donde lo sacaste, copiado TAL CUAL (mismas palabras, sin corregir ni resumir). Sin cita, el dato va en null.
- nombre: el nombre del chico, como lo dicen ("Valentina", "Tomi"). No el de quien habla. Casi siempre lo presentan al principio: "te cuento de X", "se llama X", "mi hijo X", "X tiene seis años". Si el relato habla de una persona con ese nombre, es el nombre aunque también sea una ciudad o una palabra común (Rosario, Mercedes, Florida, Luz, Paz, Sol). La cita es la frase donde aparece.
- edad: en años, como número (ocho años → 8; "tiene seis" → 6; "un año y medio" → 1.5).
- sexo: masculino o femenino si el relato lo deja claro: lo dice ("mi hija", "mi nene") o habla del chico en femenino o en masculino ("es alérgica" → femenino, "está flaquito" → masculino, "ella", "él"). La cita es esa frase. Un nombre solo no alcanza.
- pesoKg: en kilos (veinticinco kilos → 25; 25,5 → 25.5).
- tallaCm: en centímetros (un metro dieciséis → 116; 1,27 → 127; "mide 98" → 98).
- alergiasMencionadas: cada alergia o intolerancia que nombran, con el valor de esta lista: ${ALERGENO.join(', ')} (leche también para "lactosa" o "lácteos"; gluten para "celíaco" o "TACC"; frutos_secos para nueces, almendras, avellanas). Lo que no está en la lista, no va acá.
- otrasAlergiasMencionadas: cada alergia o intolerancia a algo que NO está en esa lista ("es alérgico al kiwi", "el colorante rojo le cae mal"), con el valor como lo dicen, corto ("kiwi", "colorante rojo"), y su cita. Lo que es de la lista (leche, lactosa, huevo, gluten, maní, nueces, soja, pescado, mariscos, sésamo) no va acá. Un alimento que no come porque no le gusta no es una alergia.
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
