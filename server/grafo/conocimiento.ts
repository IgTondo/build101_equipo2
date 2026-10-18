// v5.4 · La base de conocimiento del chico para la receta creativa (PLAN §7, "Generar receta"). El grafo ya no elige el
// plato: junta lo que sabe (lo que come seguro con sus atributos, lo que rechaza y por qué, lo que está en exposición,
// los patrones, las reglas de la familia y los nutrientes que faltan) y el LLM inventa un plato nuevo a UN cambio de
// uno de sus alimentos seguros. El código después vuelve a contar los cambios, las alergias, las reglas y el aporte.
// Para que no salga siempre lo mismo, el código elige un "foco" al azar: de qué alimento seguro partir, cómo cambiarlo y
// para qué nutriente. Los modos tocan el ingrediente porque es lo que mueve el nutriente: cambiar la forma o la cocción
// de sus papas no le suma calcio.
// v5.5 · Modo variedad: si no falta ningún nutriente clave esta semana (todos ≥ 70%) y no se pidió uno, el objetivo es
// sumar variedad: el grupo que menos come (variedadDe, nutricion/progreso.ts) o, si come de todos, algo nuevo a un cambio.
// Sin nutrientes que cumplir (`nutrientes` vacío, sin mínimo); con grupo, el foco cambia el ingrediente principal por uno
// de ese grupo (sumar un ingrediente no cambia el grupo del plato).
import type { Alergeno, Dieta, Grupo, Momento, Motor, Nutriente, Nutrientes, PreparacionCatalogo, Presentacion, Regla, Variedad } from '../../shared/contratos.js'
import { NUTRIENTE } from '../../shared/contratos.js'
import { APORTE_MINIMO, esAncla, esSegura } from '../aprendizaje/cadena.js'
import { calcularEstado } from '../aprendizaje/estado.js'
import { menorCobertura } from '../aprendizaje/recomendador.js'
import { NOMBRE_GRUPO, NOMBRE_NUTRIENTE, decimal, grupoSinComer, lista, porciento } from '../aprendizaje/textos.js'
import { type Cargado, cargarNino } from '../datos/cargar.js'
import { hoyUruguay } from '../datos/fechas.js'
import { recomendacionDe } from '../datos/tablero.js'
import { completa } from '../ia/candidato.js'
import { energiaDeReferencia } from '../ia/plato-completo.js'
import { faltanSemana } from '../nutricion/calcular.js'
import { coberturaDia, gruposDesde, semana, variedadDe } from '../nutricion/progreso.js'

export interface OpcionNutriente {
  nutriente: Nutriente
  coberturaSemana: number
  faltaHoy: number
  minimo: number // por porción: el APORTE_MINIMO (15%) de su objetivo diario, como los candidatos de cadena.ts
  ricos: { alimentoId: string; nombre: string; por100g: number }[] // los del catálogo sin sus alérgenos, de más a menos
}

export interface Conocimiento {
  nombre: string
  alergias: Alergeno[]
  dieta: Dieta
  momento?: Momento
  energiaReferencia: number // v5.7 · kcal por día para dimensionar el plato completo (no es una meta: ver plato-completo.ts)
  seguros: PreparacionCatalogo[] // los puntos de partida: lo que acepta, va en esta comida y es seguro (puede estar vacío)
  aceptadas: PreparacionCatalogo[] // todo lo que acepta, con todos sus atributos: para "eso ya lo come"
  reglas: Regla[]
  presentacionesAceptadas: Presentacion[]
  nutrientes: OpcionNutriente[] // el pedido, o hasta 3 de los que faltan (en el orden de §1) · v5.5: vacío en modo variedad
  variedad?: Variedad // v5.5 · modo variedad: no falta ningún nutriente; el grupo que menos come, si hay
  coberturas: Record<Nutriente, { coberturaSemana: number; faltaHoy: number }> // v5.5 · de todos: la evidencia del nutriente que se muestra
  metaDiaria: Nutrientes // v5.5 · el objetivo diario del chico
  foco: Foco
  texto: string // lo que ve el LLM
}

export const MODO = ['cambiar_principal', 'sumar_ingrediente'] as const
export type Modo = (typeof MODO)[number]
/** En modo nutriente trae `nutriente`; en modo variedad (v5.5) no, y trae `grupo` si hay uno que menos come. */
export interface Foco { desdeId: string; modo: Modo; nutriente?: Nutriente; grupo?: Grupo }

/**
 * v5.6 · Lo que acompaña pero no es el plato: grasas, dulces y aderezos. No cuentan como "rico en" un nutriente (el
 * omega-3 del aceite de canola daba "puré con aceite"), ni alcanzan para el cambio ni para el aporte de la receta creativa.
 */
export const ACOMPANAMIENTOS: ReadonlySet<string> = new Set([
  'aceite_girasol', 'aceite_canola', 'aceite_oliva', 'manteca', 'azucar', 'dulce_de_leche', 'mermelada', 'miel',
  'mayonesa', 'ketchup', 'cacao_azucarado',
])

const UNIDAD: Record<Nutriente, string> = {
  energia_kcal: 'kcal', proteina_g: 'g', calcio_mg: 'mg', vitamina_d_ug: 'µg', hierro_mg: 'mg', fibra_g: 'g', omega3_g: 'g', b12_ug: 'µg', vitamina_c_mg: 'mg',
}
/** Cambiar el principal da platos más distintos (más peso); sumar un ingrediente es el paso más chico. */
const MODOS_FOCO: Modo[] = ['cambiar_principal', 'cambiar_principal', 'cambiar_principal', 'sumar_ingrediente']
const MAX_NUTRIENTES = 3
const MAX_RICOS = 8

const atributosEnTexto = (p: PreparacionCatalogo) => {
  const a = p.atributos
  return [a.textura, a.forma, a.sabor, a.temperatura, a.coccion ?? 'sin dato', a.presentacion].join(', ')
}

export function conocimientoDe(
  c: Cargado,
  op: { nutriente?: Nutriente; momento?: Momento; motor?: Motor; hoy?: string; ahora?: Date; azar?: () => number } = {},
): Conocimiento {
  const azar = op.azar ?? Math.random
  const hoy = op.hoy ?? hoyUruguay(op.ahora)
  const estado = calcularEstado(c.nino, c.comidas, c.catalogo, { hasta: hoy })
  const sem = semana(estado.comidas, hoy, c.objetivo)
  const delDia = coberturaDia(hoy, estado.comidas, c.objetivo).consumido.valor
  const d = c.nino.datos
  const sinAlergenos = (id: string) => (c.alimentos.get(id)?.alergenos ?? []).every((x) => !d.alergias.includes(x))
  const preparacion = (id: string) => {
    const p = c.catalogo.get(id)
    if (p) return p
    const conocida = estado.conocidas.get(id)
    return conocida ? completa(conocida) : undefined
  }

  // Lo que come seguro: el punto de partida de la cadena. Primero lo que va en esta comida (lo anotado en el catálogo o,
  // si no es del catálogo, las comidas en que lo come según lo que se sabe de él).
  const estados = [...estado.estados.values()]
  const aceptadas = estados
    .filter((s) => s.estado === 'acepta')
    .flatMap((s) => {
      const p = preparacion(s.prepId)
      const momentos = p?.momentos ?? estado.conocidas.get(s.prepId)?.momentos ?? []
      return p ? [{ p, s, vaEnLaComida: !op.momento || momentos.includes(op.momento) }] : []
    })
    .sort((a, b) => Number(b.vaEnLaComida) - Number(a.vaEnLaComida) || b.s.p - a.s.p)
  // Se parte solo de lo que va en esta comida (la imagen lo sirve al lado: "Servilo al lado de su pizza" en el desayuno
  // no), se conoce entero y no tiene sus alérgenos. Si nada va en esta comida, no hay punto de partida: la receta
  // creativa no arranca (mejor eso que partir de la milanesa para el desayuno).
  const seguros = aceptadas.filter((x) => x.vaEnLaComida && esAncla(x.p) && esSegura(x.p, d.alergias, c.alimentos))
  const otras = aceptadas.filter((x) => !seguros.includes(x))

  // Los nutrientes que puede elegir: el pedido o los que faltan. La vitamina D casi no está en los alimentos: solo si se pide.
  const faltan = sem.diasRegistrados ? faltanSemana(sem.cobertura) : []
  const elegibles = op.nutriente ? [op.nutriente] : faltan.filter((n) => n !== 'vitamina_d_ug').slice(0, MAX_NUTRIENTES)
  // v5.5 · Si no falta ninguno (y no se pidió uno), sumar variedad: sin nutrientes que cumplir
  const variedad = op.nutriente ? null : variedadDe(sem.diasRegistrados, faltan, gruposDesde(estado.comidas, hoy))
  const coberturas = Object.fromEntries(NUTRIENTE.map((n) => [n, {
    coberturaSemana: Math.round(sem.cobertura[n] * 1000) / 1000,
    faltaHoy: Math.round(Math.max(0, c.objetivo[n] - delDia[n]) * 10) / 10,
  }])) as Conocimiento['coberturas']
  const aElegir = variedad ? [] : elegibles.length ? elegibles : [faltan[0] ?? menorCobertura(sem.cobertura)]
  const nutrientes: OpcionNutriente[] = aElegir.map((n) => ({
    nutriente: n,
    ...coberturas[n],
    minimo: Math.round(APORTE_MINIMO * c.objetivo[n] * 100) / 100,
    ricos: [...c.alimentos.values()]
      .filter((a) => !a.id.startsWith('otro_') && !ACOMPANAMIENTOS.has(a.id) && a.por100g[n] > 0 && sinAlergenos(a.id))
      .sort((a, b) => b.por100g[n] - a.por100g[n])
      .slice(0, MAX_RICOS)
      .map((a) => ({ alimentoId: a.id, nombre: a.nombre, por100g: a.por100g[n] })),
  }))

  // El foco, al azar: el alimento seguro entre los que van en esta comida, el modo y el nutriente (el primero pesa doble).
  // v5.5 · En modo variedad, sin nutriente; con un grupo, siempre cambiar el principal por uno de ese grupo.
  const paraFoco = seguros
  const elegir = <T>(xs: readonly T[]): T | undefined => xs[Math.min(xs.length - 1, Math.floor(azar() * xs.length))]
  const porNutriente = nutrientes.map((x) => x.nutriente)
  const desdeId = elegir(paraFoco)?.p.id ?? ''
  const modo = elegir(MODOS_FOCO) ?? 'cambiar_principal'
  const foco: Foco = variedad
    ? { desdeId, modo: variedad.grupo ? 'cambiar_principal' : modo, ...(variedad.grupo ? { grupo: variedad.grupo } : {}) }
    : { desdeId, modo, nutriente: elegir([porNutriente[0], ...porNutriente].filter((n) => n !== undefined)) ?? nutrientes[0]!.nutriente }

  const rechaza = estados.filter((s) => s.estado === 'rechaza' || (s.declarada === 'rechaza' && s.estado !== 'acepta'))
  const enExposicion = estados.filter((s) => s.estado === 'en_proceso' && s.veces >= 1 && s.declarada !== 'rechaza')
  const presentacionesAceptadas = [...new Set(aceptadas.map((x) => x.p.atributos.presentacion).filter((pr) => pr !== 'separado'))]
  const ideas = (recomendacionDe(c, estado, hoy, op.motor ?? 'grafo', nutrientes[0]?.nutriente, op.ahora, op.momento).ideas ?? []).slice(0, 6)

  const lineas = [
    `Chico: ${d.nombre}, ${d.edad} años. Alergias: ${d.alergias.length ? lista(d.alergias) : 'ninguna'}${d.dieta === 'sin_gluten_caseina' ? '. Dieta sin gluten ni caseína' : ''}.`,
    ...(op.momento ? [`La receta es para: ${op.momento}.`] : []),
    'Lo que come seguro (los puntos de partida posibles; id: nombre · textura, forma, sabor, temperatura, cocción, presentación · ingrediente principal · cuánto lo come):',
    ...seguros.map(({ p, s }) => {
      const principal = [...p.ingredientes].sort((a, b) => b.gramos - a.gramos)[0]?.alimentoId ?? 'sin dato'
      const cuanto = s.veces > 0 ? `comió ${s.comio} de ${s.veces}` : 'según contó la familia'
      return `- ${p.id}: ${p.nombre} · ${atributosEnTexto(p)} · ${principal} · ${cuanto}`
    }),
    ...(otras.length ? [`También come (no sirven de punto de partida para esta comida): ${otras.map((x) => x.p.nombre).join(' · ')}.`] : []),
    `Lo que rechaza o todavía le cuesta: ${rechaza.map((s) => {
      const p = preparacion(s.prepId)
      return `${s.nombre}${s.motivoDeclarado ? ` (${s.motivoDeclarado})` : ''}${p ? ` [${atributosEnTexto(p)}]` : ''}`
    }).join(' · ') || 'nada registrado'}.`,
    `En exposición (ya se los están ofreciendo: no los propongas): ${enExposicion.map((s) => `${s.nombre} (${s.veces} ${s.veces === 1 ? 'vez' : 'veces'})`).join(' · ') || 'ninguno'}.`,
    `Patrones del grafo: ${estado.patrones.slice(0, 8).map((p) => `${p.texto} (confianza ${decimal(p.confianza)})`).join(' · ') || 'todavía pocos datos'}.`,
    `Reglas de la familia: ${c.nino.reglas.length ? c.nino.reglas.map((r) => r.texto).join(' · ') : 'ninguna'}.`,
    ...(variedad
      ? lineasVariedad(variedad, [...c.alimentos.values()].filter((a) => a.grupo === variedad.grupo && !a.id.startsWith('otro_') && sinAlergenos(a.id)).map((a) => a.id))
      : [
          'Le falta (elegí uno):',
          ...nutrientes.map((x) => `- ${x.nutriente} (${NOMBRE_NUTRIENTE[x.nutriente]}): esta semana cubre ${porciento(x.coberturaSemana)}; hoy le faltan ${decimal(x.faltaHoy, 0)} ${UNIDAD[x.nutriente]}. La porción tiene que aportar al menos ${decimal(x.minimo, 1)} ${UNIDAD[x.nutriente]}. Ricos en ${NOMBRE_NUTRIENTE[x.nutriente]}: ${x.ricos.map((r) => `${r.alimentoId} (${decimal(r.por100g, 1)} ${UNIDAD[x.nutriente]}/100 g)`).join(', ')}.`),
        ]),
    ...(ideas.length ? [`Ideas del catálogo del grafo, solo como referencia (podés inventar otra): ${ideas.map((i) => (variedad ? i.nombre : `${i.nombre} (${NOMBRE_NUTRIENTE[i.nutriente]})`)).join(' · ')}.`] : []),
  ]

  return {
    nombre: d.nombre,
    alergias: d.alergias,
    dieta: d.dieta,
    ...(op.momento ? { momento: op.momento } : {}),
    energiaReferencia: energiaDeReferencia(d.edad, d.sexo),
    seguros: seguros.map((x) => x.p),
    aceptadas: aceptadas.map((x) => x.p),
    reglas: c.nino.reglas,
    presentacionesAceptadas,
    nutrientes,
    ...(variedad ? { variedad } : {}),
    coberturas,
    metaDiaria: c.objetivo,
    foco,
    texto: lineas.join('\n'),
  }
}

/** v5.5 · Lo que ve el LLM en modo variedad: no le falta ningún nutriente; el grupo que menos come y con qué alimentos. */
function lineasVariedad(v: Variedad, delGrupo: string[]): string[] {
  const intro = 'No le falta ningún nutriente clave esta semana (todos por encima del 70%). El objetivo es sumar variedad'
  if (!v.grupo) {
    return [`${intro}: come de todos los grupos, así que alcanza con un plato nuevo a un solo cambio de lo que ya come. No hace falta llegar a un mínimo de ningún nutriente.`]
  }
  return [
    `${intro}: ${grupoSinComer(v.grupo, v.diasSinComer)}.`,
    `El plato nuevo tiene que ser de ${NOMBRE_GRUPO[v.grupo]} (atributos.grupo = ${v.grupo}) y su ingrediente principal (el de más gramos) también${delGrupo.length ? `: ${delGrupo.join(', ')}` : ''}. No hace falta llegar a un mínimo de ningún nutriente.`,
  ]
}

export async function armarConocimiento(ninoId: string, op: { nutriente?: Nutriente; momento?: Momento; motor?: Motor } = {}): Promise<Conocimiento> {
  return conocimientoDe(await cargarNino(ninoId), op)
}
