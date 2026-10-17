// Casos de la eval de recetas (PLAN.md §11.3, A12): 3 perfiles con alergias × 4 nutrientes = 12 Evidencia.
// - Tomás (huevo) y Lucía (sin alergias; "no come nada verde"): evidenciaDe() de B, la misma de /api/receta, sobre sus
//   20 comidas de data/sinteticos/ y los catálogos reales, sin Mongo. Si B no encuentra candidatos, el caso queda así:
//   lo correcto es sin_candidatos.
// - Bruno (leche y gluten): inventado y sin comidas. Con data/preparaciones.json no tiene candidatos a un cambio para
//   estos nutrientes, así que su evidencia se arma acá, con el formato de evidenciaDe(), el criterio de cadena.ts y unas
//   preparaciones puente (PUENTES) que van en el mismo archivo. La cobertura de la semana es de ejemplo.
// Todo es una simulación y se declara. Uso: npx tsx scripts/eval/casos-recetas.ts → reescribe eval/recetas/casos.json.
// No editarlo a mano: cambiar este archivo (o el recomendador de B) y volver a correrlo.
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import type {
  Atributos, Candidato, DatosBasicos, Evidencia, Nutriente, Perfil, PreparacionCatalogo, Regla,
} from '../../shared/contratos.js'
import { cambios, esSegura, seMantiene } from '../../server/aprendizaje/cadena.js'
import { calcularEstado } from '../../server/aprendizaje/estado.js'
import { NOMBRE_NUTRIENTE, TEXTO_CAMBIO, decimal, lista, porciento } from '../../server/aprendizaje/textos.js'
import { alimentosCatalogo, preparacionesCatalogo } from '../../server/datos/catalogos.js'
import { type Cargado, objetivoDe } from '../../server/datos/cargar.js'
import { comidasSinteticas, ninoDoc, sintetico } from '../../server/datos/prueba/catalogos.js'
import type { NinoDoc } from '../../server/datos/tipos.js'
import { evidenciaDe } from '../../server/grafo/evidencia.js'
import { patronesVista } from '../../server/nutricion/progreso.js'
import { calcularAporte, validarCandidato } from '../../server/validacion/receta.js'
import { DIR_EVAL } from './datos.js'

export const RUTA_CASOS = join(DIR_EVAL, 'recetas', 'casos.json')
export const NUTRIENTES_EVAL = ['calcio_mg', 'hierro_mg', 'vitamina_d_ug', 'fibra_g'] as const satisfies readonly Nutriente[]
type NutrienteEval = (typeof NUTRIENTES_EVAL)[number]
export const HOY = '2026-10-16'                          // el último día del dataset sintético
const AHORA = new Date('2026-10-16T20:00:00-03:00')      // la cena: fija para que el archivo salga igual cada vez

export interface CasoReceta {
  id: string; ninoId: string; nutriente: Nutriente
  fuente: 'evidenciaDe' | 'armada'                        // de B o armada acá (Bruno)
  evidencia: Evidencia
}
export interface CasosRecetas {
  _nota: string
  hoy: string
  perfiles: Perfil[]
  preparaciones: PreparacionCatalogo[]   // las puente que usan los casos armados (no están en data/preparaciones.json)
  casos: CasoReceta[]
}

// ---------- Bruno: perfil inventado y preparaciones puente (§10.3) ----------
const A = (textura: Atributos['textura'], forma: Atributos['forma'], color: Atributos['color'], sabor: Atributos['sabor'],
  temperatura: Atributos['temperatura'], grupo: Atributos['grupo'], coccion: Atributos['coccion']): Atributos =>
  ({ textura, forma, color, sabor, temperatura, presentacion: 'separado', grupo, coccion })

const PUENTES: PreparacionCatalogo[] = [
  { id: 'bastones_garbanzo_horno', nombre: 'Bastones de garbanzo al horno (tipo fainá)',
    atributos: A('crocante', 'baston', 'amarillo', 'salado', 'caliente', 'proteina', 'horno'),
    ingredientes: [{ alimentoId: 'garbanzos', gramos: 80 }, { alimentoId: 'aceite_girasol', gramos: 5 }] },
  { id: 'bastones_boniato_horno', nombre: 'Bastones de boniato al horno',
    atributos: A('crocante', 'baston', 'naranja', 'salado', 'caliente', 'cereal_almidon', 'horno'),
    ingredientes: [{ alimentoId: 'boniato', gramos: 120 }, { alimentoId: 'aceite_girasol', gramos: 5 }] },
  { id: 'brocoli_horno_trozos', nombre: 'Brócoli al horno en trozos',
    atributos: A('blando', 'trozos', 'verde', 'salado', 'caliente', 'verdura', 'horno'),
    ingredientes: [{ alimentoId: 'brocoli', gramos: 60 }, { alimentoId: 'aceite_girasol', gramos: 5 }] },
  { id: 'bife_plancha', nombre: 'Bife de carne a la plancha',
    atributos: A('jugoso', 'plano', 'marron', 'salado', 'caliente', 'proteina', 'plancha'),
    ingredientes: [{ alimentoId: 'carne_vacuna', gramos: 90 }] },
  { id: 'salmon_plancha', nombre: 'Salmón a la plancha',
    atributos: A('jugoso', 'plano', 'rojo', 'salado', 'caliente', 'proteina', 'plancha'),
    ingredientes: [{ alimentoId: 'salmon', gramos: 90 }] },
]

const ACEPTA_BRUNO: [string, number][] = [
  ['papas_fritas_baston', 9], ['banana_pisada', 8], ['pollo_plancha', 7], ['manzana_bastones', 6], ['papas_horno_cubos', 5], ['papas_horno_baston', 4],
]
const REGLAS_BRUNO: Regla[] = [{ texto: 'No come nada con salsa', condiciones: [{ tipo: 'presentacion', valor: 'con_salsa' }], efecto: 'rechaza' }]
const DATOS_BRUNO: DatosBasicos = { nombre: 'Bruno', edad: 8, sexo: 'masculino', alergias: ['leche', 'gluten'], alertas: [], dieta: 'ninguna' }
const COBERTURA_BRUNO: Record<NutrienteEval, number> = { calcio_mg: 0.25, hierro_mg: 0.6, vitamina_d_ug: 0.15, fibra_g: 0.35 }
const MAX_CANDIDATOS = 3

const UNIDAD: Record<NutrienteEval, string> = { calcio_mg: 'mg', hierro_mg: 'mg', vitamina_d_ug: 'µg', fibra_g: 'g' }
// La misma línea final de evidenciaDe() (server/grafo/evidencia.ts)
const PRESENTACION = 'Presentación: separado, porción mínima, al lado de su alimento seguro, salsas aparte. Un solo alimento nuevo por comida. Nada escondido.'

/**
 * Candidatos a un cambio desde lo que acepta, con cambios(), seMantiene() y esSegura() de cadena.ts y que pasan
 * validarCandidato(). A diferencia de cadena.ts, alcanza con que aporte algo del nutriente (no el 15% del objetivo):
 * si no, Bruno no tendría ninguno.
 */
function candidatosBruno(n: NutrienteEval, catalogo: ReadonlyMap<string, PreparacionCatalogo>, objetivo: number): Candidato[] {
  const alimentos = alimentosCatalogo()
  const acepta = new Set(ACEPTA_BRUNO.map(([id]) => id))
  const mejores = new Map<string, Candidato>()
  for (const [id, veces] of ACEPTA_BRUNO) {
    const desde = catalogo.get(id)
    if (!desde) throw new Error(`${id} no está en data/preparaciones.json`)
    for (const base of catalogo.values()) {
      if (acepta.has(base.id) || mejores.has(base.id) || !esSegura(base, DATOS_BRUNO.alergias, alimentos)) continue
      const cs = base.fortificadaDe === desde.id ? ['fortificar' as const] : cambios(desde, base)
      if (cs.length !== 1) continue
      const candidato = { cambio: cs[0], seMantiene: seMantiene(desde, base) }
      if (!validarCandidato({ alergias: DATOS_BRUNO.alergias, reglas: REGLAS_BRUNO, desde, base }, candidato).ok) continue
      const aporte = calcularAporte(base.ingredientes)[n]
      if (!(aporte > 0)) continue
      mejores.set(base.id, {
        preparacionId: base.id, nombre: base.nombre, desdeId: desde.id, ...candidato,
        puntaje: Math.round(Math.min(1, aporte / objetivo) * 100) / 100, // de ejemplo: sin propagación (Bruno no tiene comidas)
        camino: { desde: desde.nombre, aceptacion: `${veces}/${veces}`, atributos: candidato.seMantiene },
        patrones: [], aportePorcion: { [n]: aporte },
      })
    }
  }
  return [...mejores.values()]
    .sort((x, y) => (y.aportePorcion[n] ?? 0) - (x.aportePorcion[n] ?? 0) || x.preparacionId.localeCompare(y.preparacionId))
    .slice(0, MAX_CANDIDATOS)
}

/** La evidencia de Bruno, con las mismas líneas que evidenciaDe(). */
function evidenciaBruno(n: NutrienteEval, catalogo: ReadonlyMap<string, PreparacionCatalogo>, objetivo: number): Evidencia {
  const candidatos = candidatosBruno(n, catalogo, objetivo)
  const faltaHoy = Math.round(objetivo * (1 - COBERTURA_BRUNO[n]) * 10) / 10
  const texto = [
    `Chico: ${DATOS_BRUNO.nombre}, ${DATOS_BRUNO.edad} años. Alergias: ${lista(DATOS_BRUNO.alergias)}.`,
    `Le falta: ${NOMBRE_NUTRIENTE[n]} (esta semana cubre ${porciento(COBERTURA_BRUNO[n])}; hoy le faltan ${decimal(faltaHoy, 0)} ${UNIDAD[n]}).`,
    `Reglas de la familia: ${REGLAS_BRUNO.map((r) => r.texto).join(' · ')}.`,
    'Patrones: todavía pocos datos.',
    ...candidatos.flatMap((x, i) => [
      `Candidato ${i + 1}: ${x.nombre} (puntaje ${decimal(x.puntaje)})`,
      `  Camino: ${x.camino.desde} (comió ${x.camino.aceptacion}) ─${x.camino.atributos.join(', ')}─▶ ${x.nombre}`,
      `  Cambia solo: ${x.cambio === 'fortificar' ? 'es la versión fortificada' : TEXTO_CAMBIO[x.cambio]}. Se mantiene: ${x.seMantiene.join(', ') || '—'}`,
      `  Aporta: ~${decimal(x.aportePorcion[n] ?? 0, 1)} ${UNIDAD[n]} de ${NOMBRE_NUTRIENTE[n]} por porción (${porciento((x.aportePorcion[n] ?? 0) / objetivo)} de lo que necesita por día)`,
    ]),
    PRESENTACION,
  ].join('\n')
  return {
    nutriente: n, coberturaSemana: COBERTURA_BRUNO[n], faltaHoy, candidatos,
    reglas: [...REGLAS_BRUNO.map((r) => r.texto), PRESENTACION], alergias: DATOS_BRUNO.alergias, texto,
  }
}

// ---------- Perfiles: lo mismo que obtenerPerfil() (server/datos/perfiles.ts), sin Mongo ----------
function perfilDe(c: Cargado): Perfil {
  const estado = calcularEstado(c.nino, c.comidas, c.catalogo, { hasta: HOY })
  const orden = { acepta: 0, en_proceso: 1, rechaza: 2 }
  return {
    ninoId: c.nino._id, datos: c.nino.datos, reglas: c.nino.reglas, patrones: patronesVista(estado.patrones),
    preparaciones: [...estado.estados.values()]
      .sort((a, b) => orden[a.estado] - orden[b.estado] || b.p - a.p)
      .map((e) => ({ id: e.prepId, nombre: e.nombre, estado: e.estado, puntaje: Math.round(e.p * 100) / 100, veces: e.veces })),
  }
}

export function generarCasos(): CasosRecetas {
  const catalogoB = new Map(preparacionesCatalogo())
  const alimentos = new Map(alimentosCatalogo())
  const cargados: Cargado[] = (['tomas', 'lucia'] as const).map((id) => {
    const nino = ninoDoc(sintetico(id))
    return { nino, comidas: comidasSinteticas(sintetico(id), alimentos, catalogoB), catalogo: catalogoB, alimentos, objetivo: objetivoDe(nino) }
  })
  const casosB: CasoReceta[] = cargados.flatMap((c) => NUTRIENTES_EVAL.map((n) => ({
    id: `${c.nino._id}-${n}`, ninoId: c.nino._id, nutriente: n, fuente: 'evidenciaDe' as const,
    evidencia: evidenciaDe(c, { nutriente: n, hoy: HOY, ahora: AHORA }),
  })))

  const conPuentes = new Map([...catalogoB, ...PUENTES.map((p) => [p.id, p] as const)])
  const bruno: NinoDoc = {
    _id: 'bruno', datos: DATOS_BRUNO, reglas: REGLAS_BRUNO, creadoISO: `${HOY}T08:00:00-03:00`, actualizadoISO: `${HOY}T08:00:00-03:00`,
    borrador: {
      acepta: ACEPTA_BRUNO.map(([id]) => ({ nombre: catalogoB.get(id)?.nombre ?? id, preparacionId: id, atributos: catalogoB.get(id)?.atributos ?? {} })),
      rechaza: [], reglas: REGLAS_BRUNO,
    },
  }
  const objetivo = objetivoDe(bruno)
  const casosBruno: CasoReceta[] = NUTRIENTES_EVAL.map((n) => ({
    id: `bruno-${n}`, ninoId: 'bruno', nutriente: n, fuente: 'armada' as const, evidencia: evidenciaBruno(n, conPuentes, objetivo[n]),
  }))
  const usadas = new Set(casosBruno.flatMap((c) => c.evidencia.candidatos.map((x) => x.preparacionId)))

  return {
    _nota: 'Sintético (PLAN.md §11.3, A12): lo genera scripts/eval/casos-recetas.ts. Tomás y Lucía: evidenciaDe() de B sobre ' +
      'data/sinteticos/. Bruno: perfil inventado, evidencia armada con el criterio de cadena.ts y preparaciones puente; ' +
      'su cobertura es de ejemplo. No editar a mano.',
    hoy: HOY,
    perfiles: [...cargados.map(perfilDe), perfilDe({ nino: bruno, comidas: [], catalogo: catalogoB, alimentos, objetivo })],
    preparaciones: PUENTES.filter((p) => usadas.has(p.id)),
    casos: [...casosB, ...casosBruno],
  }
}

export const serializar = (c: CasosRecetas) => `${JSON.stringify(c, null, 2)}\n`

export function leerCasosRecetas(ruta = RUTA_CASOS): CasosRecetas {
  const c = JSON.parse(readFileSync(ruta, 'utf8')) as CasosRecetas
  if (!Array.isArray(c.perfiles) || !Array.isArray(c.preparaciones) || !Array.isArray(c.casos)) {
    throw new Error(`${ruta}: no tiene perfiles, preparaciones y casos; regeneralo con npx tsx scripts/eval/casos-recetas.ts`)
  }
  return c
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const c = generarCasos()
  writeFileSync(RUTA_CASOS, serializar(c))
  console.log(`eval/recetas/casos.json: ${c.casos.length} casos, ${c.perfiles.length} perfiles, ${c.preparaciones.length} preparaciones puente`)
  for (const caso of c.casos) {
    const cs = caso.evidencia.candidatos.map((x) => `${x.preparacionId} (${x.cambio})`).join(', ')
    console.log(`  ${caso.id} [${caso.fuente}]: ${cs || 'sin candidatos'}`)
  }
}
