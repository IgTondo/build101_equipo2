// v5.4 · Prompt de la receta creativa (server/ia/receta-creativa.ts). El LLM ve la base de conocimiento del chico que
// arma el grafo (server/grafo/conocimiento.ts), el foco que sorteó el código, las recetas que la familia ya vio para esa
// comida y los ingredientes que puede usar. Inventa el plato; el código vuelve a contar los cambios con los atributos que
// declara y el ingrediente de más gramos, y valida alergias, reglas, mezclas, lenguaje y aporte (validacion/receta.ts).
// v5.5 · Modo variedad (no le falta ningún nutriente): sin nutriente (`nutriente: null` en el schema) ni mínimo; si la
// base nombra un grupo, el plato tiene que ser de ese grupo.
// v5.10 · El LLM ignoraba el foco (le pedíamos partir del pollo desmenuzado y elegía igual su milanesa): en el primer
// intento el schema solo acepta el alimento de partida del foco y el prompt nombra el ingrediente sorteado (cuál es el
// principal o cuál se suma); en el reintento se relaja. Y ve los ingredientes que ya usó hace poco, para no repetirlos.
// v5.10 · El nombre dice qué es el plato y nada más: salían "Milanesa de arvejas al horno, crocante como la de lentejas"
// (los ejemplos de acá lo enseñaban). La comparación con lo que ya come va en porQue; el código igual la saca del nombre.
import { z } from 'zod'
import { COCCION, COLOR, FORMA, GRUPO, PRESENTACION, ROL_PLATO, SABOR, TEMPERATURA, TEXTURA, type Nutriente } from '../../../shared/contratos.js'
import type { Conocimiento, Modo } from '../../grafo/conocimiento.js'
import { NOMBRE_GRUPO } from '../../aprendizaje/textos.js'
import { alimentoPorId } from '../catalogo.js'
import { minimoComponentes, textoComidaCompleta } from '../plato-completo.js'
import { NOMBRE_NUTRIENTE, REGLAS_COMUNES_RECETA } from './receta.js'

export const SISTEMA_RECETA_CREATIVA = `Sos cocinero y especialista en food chaining para familias de chicos con autismo y selectividad alimentaria. La app te da todo lo que sabe del chico (lo que come seguro con sus atributos, lo que rechaza y por qué, lo que se le está ofreciendo, los patrones que encontró y las reglas de la familia). Con eso inventás UN plato nuevo, casero y rico, que lo acerque a un nutriente que le falta o, si no le falta ninguno, que le sume variedad. La idea es que coma mejor y más variado: nada de repetir lo que ya come ni lo que la familia ya vio.

Cómo inventar el plato (food chaining):
- Partí de UNO de sus alimentos seguros (desdeId) y cambiá UNA sola cosa. Si la app te dice de cuál partir y qué ingrediente usar ("Esta vez: …"), es lo que pide: cumplilo. Dos caminos:
  a) cambiar el ingrediente principal y mantener todo lo demás igual que su alimento seguro: misma forma, textura, sabor, temperatura y cocción (de sus papas fritas en bastones a bastones de polenta con queso, fritos y crocantes; de su milanesa al horno a una milanesa de lentejas, también al horno);
  b) su mismo plato con un ALIMENTO sumado que aporta el nutriente (un lácteo, una verdura, una legumbre, una carne…), sin cambiar forma, textura, sabor, temperatura ni cocción (sus tostadas con queso fundido y un toque de orégano, sus papas al horno con costra de queso rallado y pan rallado). Una grasa, un aceite o un dulce nunca es el cambio.
- Declarás los atributos del plato nuevo con el vocabulario de la app. Tienen que ser los reales del plato: la app los compara con los de su alimento seguro y cuenta los cambios (forma, textura, sabor, temperatura, cocción e ingrediente principal, que es el de más gramos). Más de un cambio no pasa.
La calidad es lo más importante (es el corazón de la app):
- Una receta elaborada y apetitosa, de las que un cocinero casero estaría orgulloso de servir: con técnica (rebozar, gratinar, armar, hornear, formar bastones, nuggets o medallones), de 3 a 6 ingredientes de verdad y de 4 a 7 pasos claros. Que un padre la lea y piense "qué buena idea, esto lo puedo hacer".
- Comida de verdad y nutritiva: el ingrediente principal es un alimento (verdura, legumbre, lácteo, carne, pescado, papa, boniato, polenta o un cereal), nunca masa frita, harina sola ni golosinas.
- El nutriente sale de los alimentos, nunca del aceite, la manteca o un dulce. Si para un nutriente solo se llega con aceite, elegí otro nutriente de la lista.
- Así NO: "puré con aceite de canola", "milanesa con aceite de canola", "pizza con queso extra", "papas un poco más crocantes" (cambios que no son un plato nuevo). Así SÍ: "nuggets caseros de pollo y zanahoria, rebozados y crocantes", "bastones de polenta con queso, gratinados al horno", "medallones de lentejas y arroz, dorados al horno", "tostadas con ricota, tomate y orégano gratinadas", "chips de boniato al horno con un toque de pimentón".
- El nombre da ganas y dice qué es el plato, no con qué se cocina, y nada más: no nombra su alimento seguro ni lo compara ("como su milanesa", "como la de lentejas", "como las suyas", "igual que sus papas"). Así NO: "Milanesa de arvejas al horno, crocante como la de lentejas", "Nuggets de ricota dorados, como sus nuggets". Así SÍ: "Milanesa de arvejas al horno", "Nuggets de ricota dorados y crocantes". La comparación con lo que ya come va en porQue.

La comida completa (v5.7): no es un plato suelto, es la comida entera para esa comida del día.
- Lo nuevo (la receta) es UNA parte de la comida: en almuerzo y cena, de preferencia el principal, un plato potente y que llene. rol dice qué lugar ocupa (principal, guarnicion, verdura_fruta, lacteo, cereal_pan, bebida).
- El resto del plato (acompanamientos) es lo que YA COME, de la lista que te da la app, con su rol y los gramos de la porción: la familia ya sabe hacerlo. Nunca otro alimento nuevo: un solo alimento nuevo por comida.
- Que el plato entero sea nutritivo y equilibrado para esa comida (la app te da el rango de calorías y la proteína mínima, y los calcula con la tabla).
- pasos: los de lo nuevo; el último paso arma el plato con lo que ya come (qué va dónde, separado).
- presentacion: el plato entero, cada cosa en su lugar y sin tocarse (o en su plato con divisiones si sus reglas lo piden). La primera vez, de lo nuevo alcanza con una porción chica: lo que ya come sostiene la comida.
- Que sea distinto: no propongas nada que ya come, nada que se le está ofreciendo ahora (exposición) y nada parecido a las recetas que la familia ya vio. Usá ingredientes comunes en Uruguay y técnicas simples de casa.
- Respetá todo lo que dice la base de conocimiento: lo que rechaza (y por qué), los patrones y las reglas de la familia. Si rechaza algo por la textura, no uses esa textura.
- Elegí el nutriente de la lista "Le falta" y asegurate con los gramos de que la porción llegue al mínimo que dice ahí (la lista de "Ricos en…" te ayuda). La app calcula el aporte con la tabla: si no llega, no pasa.
- Si la base dice que no le falta ningún nutriente, el objetivo es sumar variedad: no hay mínimo de nutriente y devolvés nutriente: null. Si nombra un grupo, el plato tiene que ser de ese grupo: atributos.grupo y el ingrediente principal (el de más gramos), cambiando el ingrediente principal de su alimento seguro por uno de ese grupo.
- Que vaya en la comida que dice "La receta es para" (nada de chocolatada en la cena).
- En porQue contá de qué alimento seguro parte (y cuánto lo come, y en qué se parece: acá sí va la comparación), qué cambia, qué se mantiene, qué patrones aplican y a qué nutriente apunta (o qué variedad suma).
- imagen: en inglés, para dibujar el plato nuevo: uno (una unidad, ej. "polenta fry"), varios (ej. "polenta fries") y aspecto (forma exacta, corte, tamaño, color y cocción, ej. "golden polenta cut into long thin sticks shaped exactly like French fries, fried until crispy"). Solo el plato nuevo, sin su alimento seguro.

Reglas:
${REGLAS_COMUNES_RECETA}`


/**
 * La salida del LLM. Como en la receta del catálogo, sin rangos ni largos: los valida el código. v5.5 · Sin nutrientes
 * (modo variedad), `nutriente` es null: el nutriente que se muestra lo elige el código por el aporte. v5.10 · `desdeIds`:
 * de qué alimentos seguros puede partir (en el primer intento, solo el del foco); los acompañamientos, de todos.
 */
export function esquemaSalidaCreativa(alimentoIds: string[], seguroIds: string[], nutrientes: Nutriente[], desdeIds: string[] = seguroIds) {
  const alimentoId = alimentoIds.length ? z.enum(alimentoIds as [string, ...string[]]) : z.string()
  return z.object({
    desdeId: z.enum(desdeIds as [string, ...string[]]),
    nutriente: nutrientes.length ? z.enum(nutrientes as [Nutriente, ...Nutriente[]]) : z.null(),
    nombre: z.string(),
    atributos: z.object({
      textura: z.enum(TEXTURA), forma: z.enum(FORMA), color: z.enum(COLOR), sabor: z.enum(SABOR),
      temperatura: z.enum(TEMPERATURA), presentacion: z.enum(PRESENTACION), grupo: z.enum(GRUPO), coccion: z.enum(COCCION),
    }),
    imagen: z.object({ uno: z.string(), varios: z.string(), aspecto: z.string() }),
    rol: z.enum(ROL_PLATO), // v5.7 · qué lugar ocupa lo nuevo en la comida
    acompanamientos: z.array(z.object({ preparacionId: z.enum(seguroIds as [string, ...string[]]), rol: z.enum(ROL_PLATO), gramos: z.number() })),
    ingredientes: z.array(z.object({ alimentoId, gramos: z.number() })),
    pasos: z.array(z.string()),
    porQue: z.string(),
    presentacion: z.string(),
    comoOfrecer: z.string(),
    transparencia: z.string().nullable(),
  })
}
export type SalidaCreativa = z.infer<ReturnType<typeof esquemaSalidaCreativa>>

export interface DatosPromptCreativa {
  conocimiento: Conocimiento
  ingredientes: { alimentoId: string; nombre: string }[] // del catálogo, sin genéricos ni alérgenos del chico
  anteriores: string[]                                   // las recetas que ya vio para esta comida
  anterior?: { salida: SalidaCreativa; problemas: string[] } // para el reintento
  elegido?: PlatoElegido                                   // v5.9 · lo nuevo ya lo eligió el grafo (una sugerencia del catálogo)
}

/** v5.9 · La sugerencia del catálogo que tocó la familia ("Un pasito", la próxima comida): lo nuevo ya está elegido. */
export interface PlatoElegido {
  preparacion: { id: string; nombre: string; ingredientes: { alimentoId: string; gramos: number }[] }
  desde: { id: string; nombre: string }
  cambio: string
}

const MANTENE = 'mantené la forma, la textura, el sabor, la temperatura y la cocción'
const MODO_TEXTO: Record<Modo, string> = {
  cambiar_principal: `cambiá el ingrediente principal y ${MANTENE}`,
  sumar_ingrediente: 'mantené su plato y sumale un ingrediente que aporte el nutriente, sin cambiar nada más',
}

/** v5.10 · Un alimento como lo ve el LLM: el nombre del catálogo y su id. */
const conNombre = (id: string) => `«${alimentoPorId(id)?.nombre ?? id}» (${id})`

/** v5.10 · El nombre no lo compara con su alimento seguro: eso va en porQue. */
const sinComparar = (desde: { nombre: string }) => `El nombre dice qué es el plato nuevo, sin nombrar ni comparar con su «${desde.nombre}» (eso va en porQue).`

/** v5.10 · El cambio con el ingrediente que sorteó el código, sin ambigüedad: cuál es el principal o cuál se suma. */
function cambioCon(modo: Modo, id: string): string {
  return modo === 'cambiar_principal'
    ? `cambiá el ingrediente principal: el ingrediente principal (el de más gramos) es ${conNombre(id)}; ${MANTENE}`
    : `mantené su plato y sumale ${conNombre(id)}, sin cambiar nada más`
}

/**
 * Qué pide el foco: el nutriente, o (v5.5) la variedad, con el grupo si hay uno que menos come. v5.10 · Con el
 * ingrediente sorteado. En el primer intento el alimento de partida y el ingrediente son obligatorios (el schema solo
 * acepta ese desdeId); en el reintento puede elegir otro alimento seguro u otro ingrediente, sin repetir lo que ya usó.
 */
function textoFoco(k: Conocimiento, desde: Conocimiento['seguros'][number] | undefined, reintento: boolean): string {
  const { foco } = k
  const ing = foco.ingrediente
  const obligatorio = `Es lo que pide la app: no partas de otro alimento seguro${ing ? ' ni cambies de ingrediente' : ''}.`
  const sinRepetir = k.recientes?.length ? ', sin repetir lo que ya usó hace poco' : ''
  if (!k.variedad || foco.nutriente) {
    const n = NOMBRE_NUTRIENTE[foco.nutriente ?? k.nutrientes[0]!.nutriente]
    if (!desde) return `Esta vez apuntá a ${n}.`
    const salida = reintento
      ? `Si así no se puede cumplir alguna regla o el mínimo del nutriente, elegí otro alimento seguro${ing ? `, otro ingrediente rico en ${n}` : ''} u otro nutriente de la lista${sinRepetir}.`
      : `${obligatorio} Si así no llega al mínimo del nutriente, ${ing ? `subí los gramos de ${conNombre(ing)} o ` : ''}elegí otro nutriente de la lista.`
    return `Esta vez: partí de «${desde.nombre}» (${desde.id}), ${ing ? cambioCon(foco.modo, ing) : MODO_TEXTO[foco.modo]}, y apuntá a ${n}. ${salida} ${sinComparar(desde)}`
  }
  const g = foco.grupo
  const cambio = ing
    ? cambioCon(foco.modo, ing)
    : g
      ? `cambiá el ingrediente principal por uno de ${NOMBRE_GRUPO[g]} y ${MANTENE}`
      : foco.modo === 'sumar_ingrediente' ? 'mantené su plato y sumale un ingrediente nuevo para él, sin cambiar nada más' : MODO_TEXTO[foco.modo]
  const objetivo = g ? `para sumar variedad: el plato tiene que ser del grupo ${g}` : 'para sumar variedad: algo nuevo a un solo cambio de lo que ya come'
  const salida = reintento
    ? `Si así no se puede cumplir alguna regla, elegí otro alimento seguro${ing ? ` u otro ingrediente${g ? ` de ${NOMBRE_GRUPO[g]}` : ''}` : ''}${sinRepetir}.`
    : obligatorio
  return [
    desde ? `Esta vez: partí de «${desde.nombre}» (${desde.id}), ${cambio}, ${objetivo}.` : `Esta vez, ${objetivo}.`,
    'No le falta ningún nutriente: no hay mínimo y devolvé nutriente: null.',
    ...(desde ? [salida, sinComparar(desde)] : []),
  ].join(' ')
}

export function promptRecetaCreativa(d: DatosPromptCreativa): string {
  const { conocimiento: k } = d
  const desde = k.seguros.find((p) => p.id === k.foco.desdeId)
  const e = d.elegido
  const foco = e
    ? `Lo nuevo YA LO ELIGIÓ la app: «${e.preparacion.nombre}» (${e.preparacion.id}), a un solo cambio de su «${e.desde.nombre}» (cambia ${e.cambio}). No inventes otro plato: escribí la receta de ESTE (elaborada y rica, que dé ganas), con su ingrediente principal (${[...e.preparacion.ingredientes].sort((a, b) => b.gramos - a.gramos)[0]?.alimentoId ?? 'el del catálogo'}) como el de más gramos; ingredientes de referencia: ${e.preparacion.ingredientes.map((i) => `${i.alimentoId} ${i.gramos} g`).join(', ')}. desdeId es ${e.desde.id}. Si es una guarnición (un puré, unas papas, una verdura), rol guarnicion o verdura_fruta, y el principal de la comida es algo que ya come. Lo nuevo solo NO es una comida: completala con ${Math.max(1, minimoComponentes(k) - 1)} o más cosas de la lista de lo que ya come (un principal potente si lo nuevo no lo es, y una verdura o fruta si come alguna). ${sinComparar(e.desde)}`
    : textoFoco(k, desde, Boolean(d.anterior))
  const lineas = ['Base de conocimiento del chico (lo único que sabés de él):', k.texto, '', foco, '', ...textoComidaCompleta(k)]
  if (d.anteriores.length && !e) {
    lineas.push('', 'La familia ya vio estas recetas: proponé un plato distinto a todas (otro ingrediente principal u otra idea):', ...d.anteriores.map((n) => `- ${n}`))
  }
  // v5.10 · Lo que ya usó hace poco no puede ser el ingrediente principal (la validación lo rechaza en los dos intentos)
  if (k.recientes?.length && !e) lineas.push(`Ya usó hace poco (ninguno puede ser el ingrediente principal): ${k.recientes.map(conNombre).join(', ')}.`)
  lineas.push('', 'Ingredientes que podés usar (alimentoId: nombre):', ...d.ingredientes.map((i) => `- ${i.alimentoId}: ${i.nombre}`))
  if (d.anterior) {
    lineas.push(
      '',
      'Tu respuesta anterior no pasó la validación de la app por estos motivos:',
      ...d.anterior.problemas.map((p) => `- ${p}`),
      'Corregí eso (podés cambiar de plato si hace falta) y devolvé la receta completa otra vez. Tu respuesta anterior era:',
      JSON.stringify(d.anterior.salida),
    )
  }
  return lineas.join('\n')
}
