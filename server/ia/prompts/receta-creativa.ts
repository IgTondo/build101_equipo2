// v5.4 · Prompt de la receta creativa (server/ia/receta-creativa.ts). El LLM ve la base de conocimiento del chico que
// arma el grafo (server/grafo/conocimiento.ts), el foco que sorteó el código, las recetas que la familia ya vio para esa
// comida y los ingredientes que puede usar. Inventa el plato; el código vuelve a contar los cambios con los atributos que
// declara y el ingrediente de más gramos, y valida alergias, reglas, mezclas, lenguaje y aporte (validacion/receta.ts).
import { z } from 'zod'
import { COCCION, COLOR, FORMA, GRUPO, PRESENTACION, SABOR, TEMPERATURA, TEXTURA, type Nutriente } from '../../../shared/contratos.js'
import type { Conocimiento, Modo } from '../../grafo/conocimiento.js'
import { NOMBRE_NUTRIENTE, REGLAS_COMUNES_RECETA } from './receta.js'

export const SISTEMA_RECETA_CREATIVA = `Sos cocinero y especialista en food chaining para familias de chicos con autismo y selectividad alimentaria. La app te da todo lo que sabe del chico (lo que come seguro con sus atributos, lo que rechaza y por qué, lo que se le está ofreciendo, los patrones que encontró y las reglas de la familia). Con eso inventás UN plato nuevo, casero y rico, que lo acerque a un nutriente que le falta. La idea es que coma mejor y más variado: nada de repetir lo que ya come ni lo que la familia ya vio.

Cómo inventar el plato (food chaining):
- Partí de UNO de sus alimentos seguros (desdeId) y cambiá UNA sola cosa. Dos caminos:
  a) cambiar el ingrediente principal y mantener todo lo demás igual que su alimento seguro: misma forma, textura, sabor, temperatura y cocción (de sus papas fritas en bastones a bastones de polenta con queso, fritos y crocantes; de su milanesa a una milanesa de lentejas, al horno como la suya);
  b) su mismo plato con un ingrediente sumado que aporta el nutriente, sin cambiar forma, textura, sabor, temperatura ni cocción (sus tostadas con una feta de queso fundida, sus papas al horno con queso rallado gratinado).
- Declarás los atributos del plato nuevo con el vocabulario de la app. Tienen que ser los reales del plato: la app los compara con los de su alimento seguro y cuenta los cambios (forma, textura, sabor, temperatura, cocción e ingrediente principal, que es el de más gramos). Más de un cambio no pasa.
- Que sea comida de verdad y nutritiva: el ingrediente principal es un alimento (verdura, legumbre, lácteo, carne, pescado, papa, boniato, polenta o un cereal), nunca masa frita, harina sola ni golosinas.
- Que sea distinto: no propongas nada que ya come, nada que se le está ofreciendo ahora (exposición) y nada parecido a las recetas que la familia ya vio. Usá ingredientes comunes en Uruguay y técnicas simples de casa.
- Respetá todo lo que dice la base de conocimiento: lo que rechaza (y por qué), los patrones y las reglas de la familia. Si rechaza algo por la textura, no uses esa textura.
- Elegí el nutriente de la lista "Le falta" y asegurate con los gramos de que la porción llegue al mínimo que dice ahí (la lista de "Ricos en…" te ayuda). La app calcula el aporte con la tabla: si no llega, no pasa.
- Que vaya en la comida que dice "La receta es para" (nada de chocolatada en la cena).
- En porQue contá de qué alimento seguro parte (y cuánto lo come), qué cambia, qué se mantiene, qué patrones aplican y a qué nutriente apunta.
- imagen: en inglés, para dibujar el plato nuevo: uno (una unidad, ej. "polenta fry"), varios (ej. "polenta fries") y aspecto (forma exacta, corte, tamaño, color y cocción, ej. "golden polenta cut into long thin sticks shaped exactly like French fries, fried until crispy"). Solo el plato nuevo, sin su alimento seguro.

Reglas:
${REGLAS_COMUNES_RECETA}`

/** La salida del LLM. Como en la receta del catálogo, sin rangos ni largos: los valida el código. */
export function esquemaSalidaCreativa(alimentoIds: string[], seguroIds: string[], nutrientes: Nutriente[]) {
  const alimentoId = alimentoIds.length ? z.enum(alimentoIds as [string, ...string[]]) : z.string()
  return z.object({
    desdeId: z.enum(seguroIds as [string, ...string[]]),
    nutriente: z.enum(nutrientes as [Nutriente, ...Nutriente[]]),
    nombre: z.string(),
    atributos: z.object({
      textura: z.enum(TEXTURA), forma: z.enum(FORMA), color: z.enum(COLOR), sabor: z.enum(SABOR),
      temperatura: z.enum(TEMPERATURA), presentacion: z.enum(PRESENTACION), grupo: z.enum(GRUPO), coccion: z.enum(COCCION),
    }),
    imagen: z.object({ uno: z.string(), varios: z.string(), aspecto: z.string() }),
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
}

const MODO_TEXTO: Record<Modo, string> = {
  cambiar_principal: 'cambiá el ingrediente principal y mantené la forma, la textura, el sabor, la temperatura y la cocción',
  sumar_ingrediente: 'mantené su plato y sumale un ingrediente que aporte el nutriente, sin cambiar nada más',
}

export function promptRecetaCreativa(d: DatosPromptCreativa): string {
  const { conocimiento: k } = d
  const desde = k.seguros.find((p) => p.id === k.foco.desdeId)
  const lineas = [
    'Base de conocimiento del chico (lo único que sabés de él):',
    k.texto,
    '',
    desde
      ? `Esta vez: partí de «${desde.nombre}» (${desde.id}), ${MODO_TEXTO[k.foco.modo]}, y apuntá a ${NOMBRE_NUTRIENTE[k.foco.nutriente]}. Si así no se puede cumplir alguna regla o el mínimo del nutriente, elegí otro alimento seguro u otro nutriente de la lista.`
      : `Esta vez apuntá a ${NOMBRE_NUTRIENTE[k.foco.nutriente]}.`,
  ]
  if (d.anteriores.length) {
    lineas.push('', 'La familia ya vio estas recetas: proponé un plato distinto a todas (otro ingrediente principal u otra idea):', ...d.anteriores.map((n) => `- ${n}`))
  }
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
