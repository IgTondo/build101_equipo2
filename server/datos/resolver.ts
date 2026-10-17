// De RegistrarComidaReq al documento de la comida (bronze): gramos servidos, fracción comida, `o` y nutrientes
// con su rango. Puro: lo usan registrarComida(), los tests y los scripts.
import type { Alimento, PreparacionCatalogo, RegistrarComidaReq } from '../../shared/contratos.js'
import { FRACCION, O } from '../aprendizaje/escalera.js'
import { mayuscula, slug } from '../aprendizaje/textos.js'
import { aporte, escalar, gramosServidos, rango, sumar } from '../nutricion/calcular.js'
import type { ComidaDoc, ItemComida } from './tipos.js'

export interface OpcionesResolver {
  id: string
  creadoISO: string
  alimentos: ReadonlyMap<string, Alimento>
  catalogo: ReadonlyMap<string, PreparacionCatalogo>
  nombres?: ReadonlyMap<string, string> // nombres de las preparaciones que el chico ya tiene (fuera del catálogo)
}

export function resolverComida(req: RegistrarComidaReq, op: OpcionesResolver): ComidaDoc {
  const respuestas = new Map(req.respuestas.map((r) => [r.itemIdTmp, r]))
  const items: ItemComida[] = req.analisis.items.map((it) => {
    const r = respuestas.get(it.idTmp)
    const porcion = r?.porcion ?? it.porcion
    const ingredientes = gramosServidos(it, porcion, op.alimentos)
    const { nutrientes: servido, sinDatos } = aporte(ingredientes, op.alimentos)
    const cuanto = r?.cuanto ?? null
    const fraccion = cuanto ? FRACCION[cuanto] : 0
    const preparacionId = it.preparacionId ?? slug(it.preparacion)
    const catalogo = op.catalogo.get(preparacionId)
    return {
      idTmp: it.idTmp,
      preparacionId,
      nombre: catalogo?.nombre ?? op.nombres?.get(preparacionId) ?? mayuscula(it.preparacion),
      // Lo observado manda (lo usa la minería); el catálogo solo completa lo que la visión no devolvió (la cocción)
      atributos: { ...(catalogo?.atributos ?? {}), ...it.atributos },
      ingredientes,
      gramos: ingredientes.reduce((s, i) => s + i.gramos, 0),
      porcion,
      cuanto,
      fraccion,
      o: cuanto ? O[cuanto] : null,
      ...(r?.motivo ? { motivo: r.motivo } : {}),
      ...(r?.cita ? { cita: r.cita } : {}),
      confianza: it.confianza,
      nutrientes: escalar(servido, fraccion),
      sinDatos,
    }
  })
  return {
    _id: op.id,
    ninoId: req.ninoId,
    dia: req.dia,
    fechaISO: req.fechaISO,
    momento: req.momento,
    ...(req.thumbBase64 ? { thumbBase64: req.thumbBase64 } : {}),
    ...(req.comentario ? { comentario: req.comentario } : {}),
    analisis: req.analisis,
    respuestas: req.respuestas,
    respuestasPreguntas: req.respuestasPreguntas ?? [],
    conducta: req.conducta ?? [],
    ...(req.relato ? { relato: req.relato } : {}),
    distribucion: req.analisis.distribucion.estado,
    plato: req.analisis.distribucion.plato,
    items,
    nutrientes: rango(sumar(...items.map((i) => i.nutrientes))),
    creadoISO: op.creadoISO,
  }
}
