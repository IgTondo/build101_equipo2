// Datos de las evals (PLAN.md §11.1 y §11.2): eval/etiquetas.json (fotos) y eval/voz/relatos.json (relatos).
// Se validan con Zod al leerlos, con el vocabulario cerrado de shared/contratos.ts: una etiqueta mal escrita corta antes
// de gastar una llamada. El formato está explicado en eval/README.md.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import { COCCION, COLOR, CONDUCTA, CUANTO, FORMA, TEXTURA, type AnalisisComida, type Atributos } from '../../shared/contratos.js'

export const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const DIR_EVAL = join(RAIZ, 'eval')
export const DIR_FOTOS = join(DIR_EVAL, 'fotos')
export const DIR_VOZ = join(DIR_EVAL, 'voz')
export const NINO_EVAL = 'eval' // ninoId de los pedidos: sin perfil guardado, la visión usa solo el catálogo semilla

// ---------- eval/etiquetas.json ----------
const alimentoEtiquetado = z.strictObject({
  alimentoId: z.string().min(1),
  textura: z.enum(TEXTURA),
  forma: z.enum(FORMA),
  color: z.enum(COLOR),
  coccion: z.enum(COCCION).optional(),
})

export const etiquetaFoto = z.strictObject({
  archivo: z.string().min(1),          // relativo a eval/fotos/
  fuente: z.enum(['equipo', 'internet']),
  url: z.url().optional(),
  autor: z.string().min(1).optional(),
  licencia: z.string().min(1).optional(),
  descripcion: z.string().min(1),
  alimentos: z.array(alimentoEtiquetado),
}).refine((e) => e.fuente === 'equipo' || (e.url && e.autor && e.licencia), {
  message: 'Las fotos de internet declaran url, autor y licencia',
})
export type EtiquetaFoto = z.infer<typeof etiquetaFoto>

export function leerEtiquetas(ruta = join(DIR_EVAL, 'etiquetas.json')): EtiquetaFoto[] {
  return z.array(etiquetaFoto).parse(JSON.parse(readFileSync(ruta, 'utf8')))
}

// ---------- eval/voz/relatos.json ----------
const pregunta = z.strictObject({
  id: z.string().min(1),
  texto: z.string().min(1),
  opciones: z.array(z.string()),
  itemIdTmp: z.string().optional(),
  caja: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
  origen: z.enum(['duda', 'regla', 'contexto']),
})

export const casoRelato = z.strictObject({
  id: z.string().min(1),
  audio: z.string().min(1).optional(),  // relativo a eval/voz/
  mime: z.string().min(1).optional(),   // 'audio/mp4' (iPhone) o 'audio/webm' (Android)
  dispositivo: z.enum(['iphone', 'android']).optional(),
  fuente: z.enum(['equipo', 'sintetico']),
  relatoEscrito: z.string().min(1),     // lo que "pasó", escrito antes de grabar
  items: z.array(z.strictObject({ idTmp: z.string().min(1), preparacion: z.string().min(1) })).min(1),
  preguntas: z.array(pregunta).optional(),
  esperado: z.strictObject({
    respuestas: z.array(z.strictObject({ itemIdTmp: z.string(), cuanto: z.enum(CUANTO) })),
    sinMencion: z.array(z.string()),
    conducta: z.array(z.enum(CONDUCTA)),
  }),
}).superRefine((c, ctx) => {
  if (c.audio && !c.mime) ctx.addIssue({ code: 'custom', message: `${c.id}: un caso con audio lleva su mime` })
  // Cada ítem va a una sola de las dos listas: o el padre dijo cómo le fue, o quedó sin mencionar.
  const marcados = [...c.esperado.respuestas.map((r) => r.itemIdTmp), ...c.esperado.sinMencion]
  const ids = c.items.map((i) => i.idTmp)
  if (marcados.length !== ids.length || ids.some((id) => !marcados.includes(id))) {
    ctx.addIssue({ code: 'custom', message: `${c.id}: cada ítem va una vez en esperado.respuestas o en esperado.sinMencion` })
  }
})
export type CasoRelato = z.infer<typeof casoRelato>

export function leerRelatos(ruta = join(DIR_VOZ, 'relatos.json')): CasoRelato[] {
  return z.array(casoRelato).parse(JSON.parse(readFileSync(ruta, 'utf8')))
}

// El relato solo usa idTmp, el nombre de cada ítem y las preguntas; los atributos van de relleno porque el contrato los pide.
const ATRIBUTOS_RELLENO: Atributos = {
  textura: 'mixto', forma: 'trozos', color: 'mixto', sabor: 'neutro', temperatura: 'tibio', presentacion: 'separado', grupo: 'otro',
}

/** El AnalisisComida mínimo que necesita interpretarRelato() para conocer los ítems de un caso. */
export function analisisMinimo(caso: CasoRelato): AnalisisComida {
  return {
    analisisId: `eval-${caso.id}`,
    sinComida: false,
    items: caso.items.map(({ idTmp, preparacion }) => ({
      idTmp, preparacion, preparacionId: null, ingredientes: [], porcion: 'mediana', atributos: ATRIBUTOS_RELLENO, caja: null, confianza: 1,
    })),
    distribucion: { estado: 'separados', cantidadItems: caso.items.length, plato: 'otro' },
    preguntas: caso.preguntas ?? [],
    modelo: 'eval', ms: 0,
  }
}
