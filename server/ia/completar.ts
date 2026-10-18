// Completar lo que la familia declaró (v5.8): los alimentos que no están en el catálogo (preparacionId null) y quedaron
// a medias (menos de 8 atributos o sin ingredientes: los perfiles viejos, o lo que la familia agregó a mano) → los 8
// atributos, los ingredientes típicos, los momentos y una duda si importa, en UNA llamada a Haiku (tarea 'perfil').
// Lo que ya se sabía no se pisa; todo lo agregado es lo típico (inferido: true) y la familia lo corrige.
// Lo llaman crearPerfil y el script de backfill (pista de datos). Nunca hace fallar a quien lo llama: ante cualquier
// error devuelve la entrada sin cambios (y queda en el log).
import { z } from 'zod'
import type { AlimentoDeclarado, Alergeno, Dieta } from '../../shared/contratos.js'
import { alimentos } from './catalogo.js'
import { generarJSON } from './modelo.js'
import {
  atributosValidos, dudaPorAlergia, dudaRelevante, esquemaAtributos, esquemaIngredientes, esquemaMomentos, idsIngredientes, ingredientesValidos,
  momentosValidos,
} from './perfil.js'
import { ATRIBUTOS } from './prompts/perfil.js'
import { mensajeCompletar, sistemaCompletar } from './prompts/completar.js'

export const MAX_COMPLETAR = 30          // por llamada; los que sobran quedan como estaban (el backfill vuelve a pasar)

export function esquemaCompletar(ids?: string[]) {
  return z.object({
    items: z.array(z.object({
      n: z.number().describe('El número del alimento en la lista'),
      atributos: esquemaAtributos,
      ingredientes: esquemaIngredientes(ids),
      momentos: esquemaMomentos,
      duda: z.string().nullable(),
    })),
  })
}
export type SalidaCompletar = z.infer<ReturnType<typeof esquemaCompletar>>

export interface ContextoCompletar { alergias: Alergeno[]; alergiasOtras?: string[]; dieta?: Dieta; edad?: number }

/** ¿Le falta algo? Solo lo que no está en el catálogo: con id, los atributos son los del catálogo. */
export function incompleto(a: AlimentoDeclarado): boolean {
  return a.preparacionId === null && (Object.keys(atributosValidos(a.atributos)).length < ATRIBUTOS.length || !a.ingredientes?.length)
}

/** La salida del modelo sobre lo que ya había. Pura: la usan completarAlimentos() y los tests. */
export function fusionar(a: AlimentoDeclarado, x: SalidaCompletar['items'][number], ctx: ContextoCompletar): AlimentoDeclarado {
  const atributos = { ...atributosValidos(x.atributos), ...atributosValidos(a.atributos) } // lo que ya se sabía gana
  const propios = a.ingredientes?.length ? a.ingredientes : undefined
  const { ingredientes, sacados } = propios ? { ingredientes: propios, sacados: [] } : ingredientesValidos(x.ingredientes, ctx.alergias, ctx.alergiasOtras)
  const momentos = a.momentos?.length ? a.momentos : momentosValidos(x.momentos)
  const duda = a.duda || dudaRelevante(x.duda, ctx.alergias, ctx.alergiasOtras) || dudaPorAlergia(a.nombre, sacados)
  return {
    ...a,
    atributos,
    ingredientes,
    ...(momentos.length ? { momentos } : {}),
    inferido: true,
    ...(duda ? { duda } : {}),
  }
}

export async function completarAlimentos(alimentosDeclarados: AlimentoDeclarado[], ctx: ContextoCompletar): Promise<AlimentoDeclarado[]> {
  const indices = alimentosDeclarados.flatMap((a, i) => (incompleto(a) ? [i] : [])).slice(0, MAX_COMPLETAR)
  if (!indices.length) return alimentosDeclarados
  try {
    const items = indices.map((i) => alimentosDeclarados[i])
    const { datos } = await generarJSON({
      tarea: 'perfil',
      sistema: sistemaCompletar(alimentos()),
      partes: [{ tipo: 'texto', texto: mensajeCompletar(items, { alergias: [...ctx.alergias, ...(ctx.alergiasOtras ?? [])], dieta: ctx.dieta, edad: ctx.edad }) }],
      schema: esquemaCompletar(idsIngredientes()),
    })
    const salida = [...alimentosDeclarados]
    const usados = new Set<number>()
    for (const x of datos.items) {
      const k = Math.round(x.n) - 1
      if (!Number.isFinite(k) || k < 0 || k >= indices.length || usados.has(k)) continue
      usados.add(k)
      salida[indices[k]] = fusionar(alimentosDeclarados[indices[k]], x, ctx)
    }
    if (usados.size < indices.length) {
      console.warn(JSON.stringify({ evento: 'completar', aviso: 'faltaron_items', pedidos: indices.length, completados: usados.size }))
    }
    return salida
  } catch (e) {
    console.warn(JSON.stringify({ evento: 'completar', aviso: 'sin_completar', error: e instanceof Error ? e.message : String(e) }))
    return alimentosDeclarados
  }
}
