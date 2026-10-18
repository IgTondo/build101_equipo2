// Fixtures de la API (PLAN.md §9, C1): una respuesta de ejemplo por endpoint, para los stubs de api/ y el front.
// Uso: npx tsx scripts/generar-fixtures.ts → escribe fixtures/*.json. Sale con código 1 si algo no cierra.
// Cada respuesta es una constante anotada con su tipo de shared/contratos.ts: si el contrato cambia, tsc avisa.
// Los números salen del historial sintético de Tomás (data/sinteticos/, §10.5) y de una tabla chica de nutrientes
// (abajo) que hace de data/alimentos.json hasta que exista (A3). Es una simulación. No editar los JSON a mano:
// cambiar este archivo y volver a correrlo.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CUANTO, GRUPO, NUTRIENTE } from '../shared/contratos.js'
import type {
  AnalisisComida, Alerta, Aprendizaje, Atributos, Candidato, Cambio, CoberturaDia, ComidaResumen, Conducta, CrearPerfilRes,
  Cuanto, DatosBasicos, DatosExtraidos, Evidencia, Grupo, ImagenPlatoRes, ItemDetectado, Nutriente, Nutrientes, PatronVista, Perfil,
  PerfilBorrador, Porcion, PreparacionCatalogo, Progreso, Rango, Receta, RegistrarComidaReq, RegistrarComidaRes,
  RelatoComida, ResumenRes, SaludRes, Sugerencia, TranscribirRes,
} from '../shared/contratos.js'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const SALIDA = join(RAIZ, 'fixtures')
const leer = <T>(ruta: string): T => JSON.parse(readFileSync(join(RAIZ, ruta), 'utf8')) as T

// ---------- Entrada: el dataset sintético ----------
interface NinoSintetico { datos: DatosBasicos; borrador: PerfilBorrador; comidas: RegistrarComidaReq[] }
const TOMAS = leer<NinoSintetico>('data/sinteticos/tomas.json')
const CATALOGO = leer<PreparacionCatalogo[]>('data/sinteticos/preparaciones.json')
const NINO_ID = 'tomas'
const NOMBRE = TOMAS.datos.nombre

function prep(id: string): PreparacionCatalogo {
  const p = CATALOGO.find((x) => x.id === id)
  if (!p) throw new Error(`Preparación desconocida: ${id}`)
  return p
}

// ---------- Tabla de nutrientes (aproximada, USDA FDC, por 100 g de alimento listo para comer) ----------
// Orden de los valores: el de NUTRIENTE (energía, proteína, calcio, vitamina D, hierro, fibra, omega-3, B12, vitamina C).
// La leche y el yogur, sin fortificar con vitamina D. El pan y el pan rallado, con la harina fortificada con hierro. Cuando exista data/alimentos.json (A3), los fixtures deberían salir de ahí.
const TABLA: Record<string, { nombre: string; por100g: Nutrientes }> = {}
function alimento(id: string, nombre: string, valores: number[]) {
  TABLA[id] = { nombre, por100g: deLista(valores) }
}
alimento('aceite_girasol', 'Aceite de girasol', [884, 0, 0, 0, 0, 0, 0.2, 0, 0])
alimento('arroz', 'Arroz', [130, 2.7, 10, 0, 0.2, 0.4, 0.01, 0, 0])
alimento('arvejas', 'Arvejas', [84, 5.4, 27, 0, 1.5, 5.5, 0.03, 0, 14])
alimento('azucar', 'Azúcar', [387, 0, 1, 0, 0, 0, 0, 0, 0])
alimento('banana', 'Banana', [89, 1.1, 5, 0, 0.3, 2.6, 0.03, 0, 8.7])
alimento('brocoli', 'Brócoli', [35, 2.4, 40, 0, 0.7, 3.3, 0.1, 0, 65])
// Fortificado con hierro y vitaminas C y D, como los de la góndola (≈ 15% del valor diario por porción de 15 g).
alimento('cacao_azucarado', 'Cacao azucarado en polvo', [380, 4, 40, 5, 14, 4, 0, 0, 45])
alimento('carne_picada', 'Carne picada', [250, 26, 18, 0.1, 2.6, 0, 0.05, 2.6, 0])
alimento('carne_vacuna', 'Carne vacuna', [200, 29, 15, 0.1, 2.9, 0, 0.03, 2.5, 0])
alimento('chauchas', 'Chauchas', [35, 1.9, 44, 0, 0.7, 3.2, 0.1, 0, 10])
alimento('fideos', 'Fideos', [158, 5.8, 7, 0, 1.3, 1.8, 0.03, 0, 0])
alimento('galletitas_agua', 'Galletitas de agua', [430, 9, 30, 0, 4, 2.5, 0.1, 0, 0])
alimento('leche', 'Leche', [61, 3.2, 113, 0.1, 0.03, 0, 0.03, 0.45, 0])
alimento('lentejas', 'Lentejas', [116, 9, 19, 0, 3.3, 7.9, 0.04, 0, 1.5])
alimento('manteca', 'Manteca', [717, 0.9, 24, 1.5, 0, 0, 0.3, 0.17, 0])
alimento('manzana', 'Manzana', [48, 0.3, 5, 0, 0.1, 1.3, 0.01, 0, 4])
alimento('pan_blanco', 'Pan blanco', [266, 8.9, 60, 0, 3, 2.7, 0.05, 0, 0])
alimento('pan_rallado', 'Pan rallado', [395, 13, 100, 0, 4.8, 4.5, 0.1, 0, 0])
alimento('papa', 'Papa', [93, 2.5, 15, 0, 0.6, 2.2, 0.01, 0, 10])
alimento('pollo', 'Pollo', [165, 31, 15, 0.1, 1, 0, 0.05, 0.3, 0])
alimento('queso_muzzarella', 'Queso muzzarella', [300, 22, 505, 0.4, 0.4, 0, 0.1, 2.3, 0])
alimento('queso_rallado', 'Queso rallado', [420, 29, 1100, 0.5, 0.8, 0, 0.1, 1.2, 0])
alimento('salsa_tomate', 'Salsa de tomate', [30, 1.3, 15, 0, 0.8, 1.5, 0, 0, 7])
alimento('yogur', 'Yogur', [85, 3.5, 120, 0.1, 0.1, 0, 0.03, 0.4, 0.5])
alimento('zanahoria', 'Zanahoria', [35, 0.8, 30, 0, 0.3, 3, 0, 0, 3.6])
alimento('zapallo', 'Zapallo', [20, 0.7, 15, 0, 0.6, 1.1, 0, 0, 5])

// ---------- Referencias (§10.1 y §5.1) ----------
// Objetivo diario para 4–8 años. La energía se muestra, pero no tiene meta: objetivo 0 y cobertura 0.
const OBJETIVO: Nutrientes = deLista([0, 19, 1000, 15, 10, 25, 0.9, 1.2, 25])
const UMBRAL_FALTA = 0.7                       // §1: falta lo que está por debajo del 70% de cobertura
const FRACCION: Record<Cuanto, number> = { todo: 1, mitad: 0.5, poco: 0.25, probo: 0.05, toco: 0, nada: 0, aparto: 0 }
const O: Record<Cuanto, number> = { todo: 1, mitad: 0.7, poco: 0.4, probo: 0.3, toco: 0.15, nada: 0.05, aparto: 0 }
const PORCION: Record<Porcion, number> = { chica: 0.6, mediana: 1, grande: 1.5 }
const ESCALON: Record<Cuanto, string> = {
  todo: 'comió todo', mitad: 'comió la mitad', poco: 'comió un poco', probo: 'lo probó',
  toco: 'lo tocó', nada: 'lo dejó en el plato', aparto: 'lo apartó',
}
const NOMBRE_NUTRIENTE: Record<Nutriente, string> = {
  energia_kcal: 'energía', proteina_g: 'proteína', calcio_mg: 'calcio', vitamina_d_ug: 'vitamina D', hierro_mg: 'hierro',
  fibra_g: 'fibra', omega3_g: 'omega-3', b12_ug: 'vitamina B12', vitamina_c_mg: 'vitamina C',
}
const UNIDAD: Record<Nutriente, string> = {
  energia_kcal: 'kcal', proteina_g: 'g', calcio_mg: 'mg', vitamina_d_ug: 'µg', hierro_mg: 'mg',
  fibra_g: 'g', omega3_g: 'g', b12_ug: 'µg', vitamina_c_mg: 'mg',
}
const NOMBRE_GRUPO: Record<Grupo, string> = {
  cereal_almidon: 'cereales y almidones', proteina: 'proteínas', verdura: 'verduras', fruta: 'frutas', lacteo: 'lácteos', otro: 'otros',
}
const DECIMALES: Record<Nutriente, number> = {
  energia_kcal: 0, proteina_g: 1, calcio_mg: 0, vitamina_d_ug: 2, hierro_mg: 1,
  fibra_g: 1, omega3_g: 2, b12_ug: 2, vitamina_c_mg: 1,
}
// §1: orden de prioridad de lo que falta. La vitamina C va primera solo si casi no hay ninguna fuente (< 30%,
// el mismo umbral que la alerta sin_vitamina_c); si no, va al final.
const PRIORIDAD: Nutriente[] = ['calcio_mg', 'vitamina_d_ug', 'hierro_mg', 'fibra_g', 'omega3_g', 'b12_ug', 'proteina_g']

// ---------- Helpers de Nutrientes y Rango ----------
function deLista(valores: number[]): Nutrientes {
  return Object.fromEntries(NUTRIENTE.map((n, i) => [n, valores[i] ?? 0])) as Nutrientes
}
const mapa = (f: (n: Nutriente) => number): Nutrientes => Object.fromEntries(NUTRIENTE.map((n) => [n, f(n)])) as Nutrientes
const cero = (): Nutrientes => mapa(() => 0)
const sumar = (a: Nutrientes, b: Nutrientes): Nutrientes => mapa((n) => a[n] + b[n])
const redondear = (x: number, decimales = 2): number => Math.round(x * 10 ** decimales) / 10 ** decimales
const redondearN = (v: Nutrientes): Nutrientes => mapa((n) => redondear(v[n], DECIMALES[n]))
const coma = (x: number): string => String(x).replace('.', ',')
const pct = (x: number): string => `${Math.round(x * 100)}%`

// Rango mostrado (§5.1): ±35%, el error medio de gramos que reporta la literatura.
function rango(v: Nutrientes): Rango {
  const valor = redondearN(v)
  return { valor, min: redondearN(mapa((n) => valor[n] * 0.65)), max: redondearN(mapa((n) => valor[n] * 1.35)) }
}
// Nutrientes de una lista de ingredientes en gramos, con la tabla.
function deIngredientes(ingredientes: { alimentoId: string; gramos: number }[]): Nutrientes {
  return ingredientes.reduce((total, { alimentoId, gramos }) => {
    const fila = TABLA[alimentoId]
    if (!fila) throw new Error(`Alimento sin nutrientes en la tabla: ${alimentoId}`)
    return sumar(total, mapa((n) => (fila.por100g[n] * gramos) / 100))
  }, cero())
}
const aportePorcion = (prepId: string): Nutrientes => redondearN(deIngredientes(prep(prepId).ingredientes))
const coberturaDe = (v: Nutrientes): Nutrientes => mapa((n) => (OBJETIVO[n] ? redondear(v[n] / OBJETIVO[n]) : 0))
// Del día: de menor a mayor cobertura, sin energía (contrato de CoberturaDia).
const faltanDia = (c: Nutrientes): Nutriente[] =>
  NUTRIENTE.filter((n) => n !== 'energia_kcal' && c[n] < UMBRAL_FALTA).sort((a, b) => c[a] - c[b])
// De la semana: en el orden de prioridad de §1.
function faltanSemana(c: Nutrientes): Nutriente[] {
  const orden: Nutriente[] = c.vitamina_c_mg < 0.3 ? ['vitamina_c_mg', ...PRIORIDAD] : [...PRIORIDAD, 'vitamina_c_mg']
  return orden.filter((n) => c[n] < UMBRAL_FALTA)
}

// ---------- Historial: las comidas sintéticas + el desayuno de siempre ----------
// El dataset registra 2 comidas por día; un chico de 6 años come 4 o 5 veces. Para que la cobertura del tablero
// se parezca a una semana real, se suma cada día el desayuno que la familia no registró en §10.5: leche chocolatada
// y tostadas, dos de sus alimentos seguros. Los fixtures lo muestran como una comida más.
function item(idTmp: string, prepId: string, porcion: Porcion = 'mediana'): ItemDetectado {
  const p = prep(prepId)
  return {
    idTmp, preparacion: p.nombre.toLowerCase(), preparacionId: p.id,
    ingredientes: p.ingredientes.map((i) => ({ alimentoId: i.alimentoId, gramosEst: Math.round(i.gramos * PORCION[porcion]) })),
    porcion, atributos: p.atributos, caja: null, confianza: 1,
  }
}
function desayuno(dia: string): RegistrarComidaReq {
  const items = [item('i1', 'leche_chocolatada'), item('i2', 'tostadas')]
  return {
    ninoId: NINO_ID, dia, fechaISO: `${dia}T08:30:00-03:00`, momento: 'desayuno',
    analisis: {
      analisisId: `fix-desayuno-${dia}`, sinComida: false, items,
      distribucion: { estado: 'separados', cantidadItems: 2, plato: 'playo' }, preguntas: [], modelo: 'sintetico', ms: 0,
    },
    respuestas: items.map((i) => ({ itemIdTmp: i.idTmp, cuanto: 'todo', porcion: 'mediana' })),
    respuestasPreguntas: [], conducta: ['tranquilo'],
  }
}
const DIAS_HISTORIAL = [...new Set(TOMAS.comidas.map((c) => c.dia))]
const COMIDAS = [...TOMAS.comidas, ...DIAS_HISTORIAL.map(desayuno)].sort((a, b) => a.fechaISO.localeCompare(b.fechaISO))
const idComida = (c: RegistrarComidaReq) => `${c.ninoId}-${c.dia}-${c.momento}`

// Gramos consumidos (§5.1): gramosEst × porción(padre) / porción(visión) × fracción del escalón.
function nutrientesDe(c: RegistrarComidaReq): Nutrientes {
  return c.respuestas.reduce((total, r) => {
    const it = c.analisis.items.find((i) => i.idTmp === r.itemIdTmp)
    if (!it) throw new Error(`${idComida(c)}: respuesta sin ítem ${r.itemIdTmp}`)
    const factor = (PORCION[r.porcion] / PORCION[it.porcion]) * FRACCION[r.cuanto]
    return sumar(total, deIngredientes(it.ingredientes.map((i) => ({ alimentoId: i.alimentoId, gramos: i.gramosEst * factor }))))
  }, cero())
}
function resumenDe(c: RegistrarComidaReq): ComidaResumen {
  return {
    id: idComida(c), fechaISO: c.fechaISO, momento: c.momento,
    items: c.respuestas.map((r) => {
      const it = c.analisis.items.find((i) => i.idTmp === r.itemIdTmp)
      return { nombre: it?.preparacionId ? prep(it.preparacionId).nombre : it?.preparacion ?? '', cuanto: r.cuanto }
    }),
    conducta: c.conducta,
  }
}
function coberturaDia(dia: string): CoberturaDia {
  const delDia = COMIDAS.filter((c) => c.dia === dia)
  const consumido = rango(delDia.reduce((t, c) => sumar(t, nutrientesDe(c)), cero()))
  const cobertura = coberturaDe(consumido.valor)
  return { dia, consumido, objetivo: OBJETIVO, cobertura, faltan: faltanDia(cobertura), comidas: delDia.map(resumenDe) }
}
// Promedio de la cobertura diaria en los días con registros.
function coberturaSemana(dias: string[]): Nutrientes {
  const conDatos = dias.filter((d) => COMIDAS.some((c) => c.dia === d))
  const total = conDatos.reduce((t, d) => sumar(t, coberturaDia(d).consumido.valor), cero())
  return coberturaDe(mapa((n) => total[n] / conDatos.length))
}
function diasDesde(desde: string, cantidad: number): string[] {
  return Array.from({ length: cantidad }, (_, i) => {
    const f = new Date(`${desde}T12:00:00Z`)
    f.setUTCDate(f.getUTCDate() + i)
    return f.toISOString().slice(0, 10)
  })
}
const entreDias = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 864e5)

// ---------- Aceptación y exposiciones (§8) ----------
// p ← p + 0,3·(o − p); inicial 0,8 si el padre dijo que acepta, 0,1 si rechaza, 0,5 si es nuevo.
interface EstadoPrep { p: number; veces: number; comio: number; mejorPaso: Cuanto; ultimaISO: string }
const DEL_PERFIL = new Set([...TOMAS.borrador.acepta, ...TOMAS.borrador.rechaza].map((x) => x.preparacionId))
function aceptacion(comidas: RegistrarComidaReq[]): Map<string, EstadoPrep> {
  const estado = new Map<string, EstadoPrep>()
  const inicial = (p: number): EstadoPrep => ({ p, veces: 0, comio: 0, mejorPaso: 'aparto', ultimaISO: '' })
  for (const a of TOMAS.borrador.acepta) if (a.preparacionId) estado.set(a.preparacionId, inicial(0.8))
  for (const r of TOMAS.borrador.rechaza) if (r.preparacionId) estado.set(r.preparacionId, inicial(0.1))
  for (const c of comidas) {
    for (const r of c.respuestas) {
      const id = c.analisis.items.find((i) => i.idTmp === r.itemIdTmp)?.preparacionId
      if (!id) continue
      const e = estado.get(id) ?? inicial(0.5)
      e.p += 0.3 * (O[r.cuanto] - e.p)
      e.veces += 1
      if (FRACCION[r.cuanto] >= 0.25) e.comio += 1       // escalón "comió" (todo, mitad, poco)
      if (CUANTO.indexOf(r.cuanto) < CUANTO.indexOf(e.mejorPaso)) e.mejorPaso = r.cuanto
      e.ultimaISO = c.fechaISO
      estado.set(id, e)
    }
  }
  return estado
}
// acepta si p ≥ 0,6 y veces ≥ 2; rechaza solo si p < 0,2 y veces ≥ 10; si no, en proceso.
const estadoDe = (e: EstadoPrep): 'acepta' | 'en_proceso' | 'rechaza' =>
  e.p >= 0.6 && e.veces >= 2 ? 'acepta' : e.p < 0.2 && e.veces >= 10 ? 'rechaza' : 'en_proceso'
const contar = (m: Map<string, EstadoPrep>, estado: string) => [...m.values()].filter((e) => estadoDe(e) === estado).length

// ---------- Patrones combinados (§8), con las observaciones de todo el historial ----------
const OBS = COMIDAS.flatMap((c) => c.respuestas.map((r) => {
  const it = c.analisis.items.find((i) => i.idTmp === r.itemIdTmp)
  if (!it) throw new Error(`${idComida(c)}: respuesta sin ítem`)
  return { atributos: it.atributos, o: O[r.cuanto], comio: FRACCION[r.cuanto] >= 0.25 }
}))
function estadistica(cond: Partial<Atributos>) {
  const cumple = (a: Atributos) => Object.entries(cond).every(([k, v]) => a[k as keyof Atributos] === v)
  const si = OBS.filter((x) => cumple(x.atributos))
  const no = OBS.filter((x) => !cumple(x.atributos))
  const media = (xs: typeof OBS) => xs.reduce((s, x) => s + x.o, 0) / xs.length
  return { n: si.length, media: media(si), resto: media(no), comio: si.filter((x) => x.comio).length }
}
function patron(texto: string, cond: Partial<Atributos>, resultado: 'acepta' | 'rechaza'): PatronVista {
  const { n, media } = estadistica(cond)
  return { texto, resultado, apoyo: n, confianza: redondear(resultado === 'acepta' ? media : 1 - media), fuente: 'aprendido' }
}
const COND_CROCANTE: Partial<Atributos> = { textura: 'crocante', presentacion: 'separado' }
const PATRONES: PatronVista[] = [
  patron('Lo crocante servido separado lo acepta', COND_CROCANTE, 'acepta'),
  patron('Lo blando lo rechaza, aunque sea un alimento que acepta en otra textura', { textura: 'blando' }, 'rechaza'),
  patron('Lo jugoso lo rechaza: la hamburguesa no, la milanesa sí', { textura: 'jugoso' }, 'rechaza'),
  patron('Lo mezclado lo rechaza', { presentacion: 'mezclado' }, 'rechaza'),
  patron('Lo que viene con salsa lo rechaza, aunque sea su milanesa', { presentacion: 'con_salsa' }, 'rechaza'),
  // De investigación (§10.2): la confianza es la inicial; el apoyo, lo que ya hay en sus datos.
  { texto: 'Las texturas mixtas suelen rechazarse', resultado: 'rechaza', apoyo: estadistica({ textura: 'mixto' }).n, confianza: 0.4, fuente: 'investigacion' },
]

// ---------- Progreso (GET /api/progreso) ----------
const HOY = '2026-10-16'
const DIAS = diasDesde('2026-10-10', 7)
const ACEPT = aceptacion(COMIDAS)
const ACEPT_HACE_7 = aceptacion(COMIDAS.filter((c) => c.dia <= '2026-10-09'))
const dias = DIAS.map(coberturaDia)
const coberturaSem = coberturaSemana(DIAS)
const faltan = faltanSemana(coberturaSem)
const energiaPromedioKcal = Math.round(dias.reduce((s, d) => s + d.consumido.valor.energia_kcal, 0) / dias.length)
const aceptadas = contar(ACEPT, 'acepta')
const repertorioTendencia = aceptadas - contar(ACEPT_HACE_7, 'acepta')

// Evolución: 4 ventanas de 7 días que terminan hoy. Antes del 7/10 no hay comidas sintéticas: las dos primeras
// semanas se extrapolan desde la tercera (un poco más bajas), para que la curva tenga 4 puntos.
const semana3 = coberturaSemana(diasDesde('2026-10-03', 7))
const semanas: Progreso['semanas'] = [
  { desde: '2026-09-19', cobertura: mapa((n) => redondear(semana3[n] * 0.85)) },
  { desde: '2026-09-26', cobertura: mapa((n) => redondear(semana3[n] * 0.92)) },
  { desde: '2026-10-03', cobertura: semana3 },
  { desde: '2026-10-10', cobertura: coberturaSem },
]

// Grupos: días desde la última vez que comió algo del grupo (escalón "comió"). Si en todo el historial no lo comió
// pero se le ofreció, se cuenta el historial entero; null queda para lo que nunca se registró.
const PRIMER_DIA = DIAS_HISTORIAL[0] ?? HOY
const grupos: Progreso['grupos'] = GRUPO.map((grupo: Grupo) => {
  const conGrupo = COMIDAS.filter((c) => c.respuestas.some((r) => c.analisis.items.find((i) => i.idTmp === r.itemIdTmp)?.atributos.grupo === grupo))
  const comidos = conGrupo.filter((c) => c.respuestas.some((r) => FRACCION[r.cuanto] >= 0.25 &&
    c.analisis.items.find((i) => i.idTmp === r.itemIdTmp)?.atributos.grupo === grupo))
  const ultimo = comidos.at(-1)?.dia
  return { grupo, diasSinComer: ultimo ? entreDias(ultimo, HOY) : conGrupo.length ? entreDias(PRIMER_DIA, HOY) + 1 : null }
})

// Exposiciones en curso: lo nuevo (no estaba en el perfil) que sigue en proceso, del mejor escalón al peor.
const exposiciones: Progreso['exposiciones'] = [...ACEPT.entries()]
  .filter(([id, e]) => !DEL_PERFIL.has(id) && estadoDe(e) === 'en_proceso')
  .sort(([, a], [, b]) => CUANTO.indexOf(a.mejorPaso) - CUANTO.indexOf(b.mejorPaso) || b.veces - a.veces)
  .map(([id, e]) => ({ preparacionId: id, nombre: prep(id).nombre, veces: e.veces, mejorPaso: e.mejorPaso, ultimaISO: e.ultimaISO }))

// Alertas (§10.4), con los mensajes de la tabla.
const alertasProgreso: Alerta[] = []
if (aceptadas < 10) alertasProgreso.push({ tipo: 'repertorio_chico', texto: `${NOMBRE} come pocos alimentos distintos. Vale la pena comentarlo con su pediatra o nutricionista.` })
if (coberturaSem.vitamina_c_mg < 0.3) alertasProgreso.push({ tipo: 'sin_vitamina_c', texto: 'Casi no está recibiendo vitamina C. Su falta prolongada puede traer problemas: conviene consultar.' })
const diasSin = (g: Grupo) => grupos.find((x) => x.grupo === g)?.diasSinComer ?? Infinity
if (Math.min(diasSin('fruta'), diasSin('verdura')) >= 7) alertasProgreso.push({ tipo: 'grupo_ausente', texto: 'Hace 7 días que no come frutas ni verduras. Conviene comentarlo con su pediatra o nutricionista.' })

// ---------- Candidatos y sugerencias (§8) ----------
// El puntaje lo calcula B12 (propagación + patrones − dificultad); acá va un valor fijo de ejemplo.
const NUTRIENTE_OBJ: Nutriente = faltan[0] ?? 'calcio_mg'
const aceptacionTxt = (id: string) => { const e = ACEPT.get(id); return e ? `${e.comio}/${e.veces}` : '0/0' }
function candidato(id: string, desdeId: string, cambio: Cambio, seMantiene: string[], puntaje: number, patrones: string[]): Candidato {
  return {
    preparacionId: id, nombre: prep(id).nombre, puntaje,
    camino: { desde: prep(desdeId).nombre, aceptacion: aceptacionTxt(desdeId), atributos: seMantiene },
    desdeId, cambio, seMantiene, patrones, aportePorcion: aportePorcion(id),
  }
}
const PATRON_CROCANTE = PATRONES[0]?.texto ?? ''
// Parte de las papas al horno en bastones y no de las fritas: con la cocción contada (v4), fritas → queso al horno son 2 cambios.
const CAND_QUESO = candidato('bastones_queso_horno', 'papas_horno_baston', 'ingrediente',
  ['forma=baston', 'textura=crocante', 'sabor=salado', 'temperatura=caliente', 'coccion=horno'], 0.62, [PATRON_CROCANTE])
const CAND_YOGUR = candidato('yogur_vainilla', 'leche_chocolatada', 'forma',
  ['textura=cremoso', 'sabor=dulce', 'temperatura=frio', 'presentacion=separado'], 0.41, [])

// Segura: entre lo que acepta, la de mayor p × aporte al nutriente que más falta.
const [seguraId, seguraEst] = [...ACEPT.entries()].filter(([, e]) => estadoDe(e) === 'acepta')
  .sort(([a, ea], [b, eb]) => eb.p * aportePorcion(b)[NUTRIENTE_OBJ] - ea.p * aportePorcion(a)[NUTRIENTE_OBJ])[0] ??
  (() => { throw new Error('Sin preparaciones en acepta') })()
const expQueso = ACEPT.get('bastones_queso_horno')
const uni = (n: Nutriente, v: number) => `${coma(v)} ${UNIDAD[n]} de ${NOMBRE_NUTRIENTE[n]}`
const sugerencias: Sugerencia[] = [
  {
    tipo: 'segura', preparacionId: seguraId, nombre: prep(seguraId).nombre, probAcepta: redondear(seguraEst.p),
    aporte: aportePorcion(seguraId),
    porQue: `La come ${seguraEst.comio} de cada ${seguraEst.veces} veces y aporta ${uni(NUTRIENTE_OBJ, aportePorcion(seguraId)[NUTRIENTE_OBJ])} por porción`,
  },
  {
    tipo: 'un_paso', preparacionId: CAND_QUESO.preparacionId, nombre: CAND_QUESO.nombre, probAcepta: CAND_QUESO.puntaje,
    aporte: CAND_QUESO.aportePorcion,
    porQue: `Se parece a sus papas al horno en bastones: cambia solo el ingrediente. Ya los vio ${expQueso?.veces ?? 0} veces y la última ${ESCALON[expQueso?.mejorPaso ?? 'nada']}`,
    candidato: CAND_QUESO,
  },
  {
    tipo: 'mas_nutritiva', preparacionId: CAND_YOGUR.preparacionId, nombre: CAND_YOGUR.nombre, probAcepta: CAND_YOGUR.puntaje,
    aporte: CAND_YOGUR.aportePorcion,
    porQue: `Aporta ${uni(NUTRIENTE_OBJ, aportePorcion(CAND_YOGUR.preparacionId)[NUTRIENTE_OBJ])} por porción. Se parece a su leche chocolatada: cambia solo la forma`,
    candidato: CAND_YOGUR,
  },
]

// Frase de arriba del tablero (§1), con plantilla.
function frase(): string {
  const cubiertos = 8 - faltan.length
  const top = faltan.slice(0, 2).map((n) => `${NOMBRE_NUTRIENTE[n]} (${pct(coberturaSem[n])})`)
  const falta = top.length ? ` Lo que más le falta: ${top.join(' y ')}.` : ''
  const t = repertorioTendencia
  const tendencia = t === 0 ? 'las mismas que la semana pasada' : `${Math.abs(t)} ${t > 0 ? 'más' : 'menos'} que la semana pasada`
  return `Esta semana ${NOMBRE} cubrió ${cubiertos} de 8 nutrientes.${falta} Come ${aceptadas} preparaciones (${tendencia}).`
}

const progreso: Progreso = {
  dias,
  semana: { cobertura: coberturaSem, faltan, energiaPromedioKcal },
  aceptadas, enProceso: contar(ACEPT, 'en_proceso'), patrones: PATRONES,
  frase: frase(),
  semanas, repertorioTendencia, grupos, exposiciones, alertas: alertasProgreso,
  proximoPaso: CAND_QUESO,
  sugerencias,
}

// ---------- La comida de ejemplo: el almuerzo del 16/10 (analizar → relato → registrar) ----------
const ALMUERZO = TOMAS.comidas.find((c) => c.dia === HOY && c.momento === 'almuerzo')
if (!ALMUERZO) throw new Error('Falta el almuerzo del 16/10 en el dataset')
// Lo que devolvería la visión: los mismos ítems, con cajas, confianza y preguntas.
const CAJAS: [number, number, number, number][] = [[180, 90, 520, 420], [420, 380, 820, 900], [150, 560, 420, 880]]
const CONFIANZA = [0.9, 0.93, 0.71]
const analisis: AnalisisComida = {
  analisisId: 'an-tomas-2026-10-16-almuerzo',
  sinComida: false,
  items: ALMUERZO.analisis.items.map((it, i) => ({
    ...it,
    caja: CAJAS[i] ?? null,
    confianza: CONFIANZA[i] ?? 0.8,
    ...(it.preparacionId === 'bastones_queso_horno' && { conteo: { cantidad: 2, unidad: 'bastón' } }),
  })),
  distribucion: { estado: 'separados', cantidadItems: ALMUERZO.analisis.items.length, plato: 'playo' },
  preguntas: [
    { id: 'q1', texto: '¿Los bastones de la derecha son de queso?', opciones: ['Sí, de queso', 'No, son de otra cosa'], itemIdTmp: 'i3', caja: CAJAS[2], origen: 'duda' },
    { id: 'q2', texto: '¿Comió en la mesa con el resto de la familia?', opciones: ['Sí', 'No'], origen: 'contexto' },
  ],
  modelo: 'claude-haiku-5-5',
  ms: 3400,
}
const idItem = (prepId: string) => analisis.items.find((i) => i.preparacionId === prepId)?.idTmp ?? ''

// Nota de voz: habla del puré y de los bastones; de la milanesa no dice nada (queda en sinMencion).
const transcripcion = 'El puré ni lo quiso, lo corrió para el costado, no le gusta esa textura. ' +
  'Los bastones de queso se comió la mitad, agarró uno solo y lo fue mordiendo despacito. ' +
  'Sí, eran de queso. Comimos todos juntos y estuvo tranquilo.'
const relato: RelatoComida = {
  transcripcion,
  respuestas: [
    { itemIdTmp: idItem('pure_papa'), cuanto: 'aparto', motivo: 'textura', confianza: 0.92, cita: 'El puré ni lo quiso, lo corrió para el costado, no le gusta esa textura.' },
    { itemIdTmp: idItem('bastones_queso_horno'), cuanto: 'mitad', porcion: 'chica', confianza: 0.85, cita: 'Los bastones de queso se comió la mitad' },
  ],
  respuestasPreguntas: [
    { preguntaId: 'q1', respuesta: 'Sí, de queso' },
    { preguntaId: 'q2', respuesta: 'Sí' },
  ],
  conducta: ['tranquilo'],
  comentario: 'Apartó el puré por la textura y comió la mitad de los bastones de queso. Comida tranquila, en familia.',
  sinMencion: [idItem('milanesa_carne_horno')],
  ms: 2100,
}

// Lo que guarda B: la comida del dataset (el padre marcó a mano la milanesa).
const antes = aceptacion(COMIDAS.filter((c) => c.fechaISO < ALMUERZO.fechaISO))
const despues = aceptacion(COMIDAS.filter((c) => c.fechaISO <= ALMUERZO.fechaISO))
const ordinal = (n: number) => `${n}.ª`
function cambioAceptacion(id: string, cuanto: Cuanto): Aprendizaje {
  const a = antes.get(id)?.p ?? 0.5
  const d = despues.get(id)?.p ?? 0.5
  // Como lo dice B (server/aprendizaje/aprendi.ts): sin números hacia el padre
  const cambio = Math.round(d * 100) - Math.round(a * 100)
  const como = cambio > 0 ? 'le está gustando más' : cambio < 0 ? 'le está costando más que antes' : 'sigue igual'
  return { tipo: 'aceptacion', texto: `${prep(id).nombre}: ${como} (${ESCALON[cuanto]}).` }
}
const qAntes = antes.get('bastones_queso_horno')
const qDespues = despues.get('bastones_queso_horno')
const crocante = estadistica(COND_CROCANTE)
const registrar: RegistrarComidaRes = {
  comidaId: idComida(ALMUERZO),
  nutrientesComida: rango(nutrientesDe(ALMUERZO)),
  dia: coberturaDia(HOY),
  aprendi: [
    {
      tipo: 'exposicion',
      texto: `${prep('bastones_queso_horno').nombre}: ${ordinal(qDespues?.veces ?? 0)} exposición. Esta vez ${ESCALON[qDespues?.mejorPaso ?? 'nada']} ` +
        `(antes, como mucho ${ESCALON[qAntes?.mejorPaso ?? 'nada'].replace(/^comió /, '')}). Cada paso cuenta.`,
    },
    cambioAceptacion('milanesa_carne_horno', 'todo'),
    { tipo: 'patron_reforzado', texto: `Lo crocante servido separado lo acepta (lo comió ${crocante.comio} de ${crocante.n} veces).` },
  ],
  alertas: [],
}
const nutricion: CoberturaDia = coberturaDia(HOY)

// ---------- Perfil ----------
const transcribir: TranscribirRes = {
  texto: 'Tomás tiene 6 años. Come papas fritas en bastones, la milanesa al horno, tostadas de pan blanco, galletitas de agua ' +
    'y leche chocolatada. No come nada mezclado: el arroz con pollo no lo toca. El puré de papa tampoco, por la textura. ' +
    'Es alérgico al huevo, así que la milanesa la hacemos sin huevo.',
  ms: 1800,
}
// v5 (§5.2): el alta por voz. /api/perfil-inicial recibe solo el texto (este es el audio de alta de Tomás, el guion de la
// demo) y devuelve el borrador de siempre + `datos` (cada uno con su cita textual del audio) + `faltan`. La alergia al
// huevo va como mencionada: el padre la confirma tocándola. No cuenta lo de la salsa ni lo blando (reglas ocultas, §10.5).
const AUDIO_ALTA_TOMAS = 'Hola, te cuento de Tomás. Tiene seis años, pesa veintiún kilos y mide un metro dieciséis. ' +
  'Es alérgico al huevo, eso es lo más importante. No tiene ninguna dieta especial ni toma suplementos. ' +
  'Come pocas cosas, pero las que come las come siempre: papas fritas en bastones, bien crocantes; la milanesa de carne al horno, ' +
  'que se la hacemos sin huevo; tostadas de pan blanco; las galletitas de agua, las de siempre; y la leche chocolatada fría a la mañana. ' +
  'Lo que no come es nada mezclado: el arroz con pollo, por ejemplo, no lo toca. El puré de papa tampoco, por la textura, ' +
  'dice que es raro. No tiene arcadas ni se atraganta.'
const datosAltaTomas: DatosExtraidos = {
  nombre: { valor: TOMAS.datos.nombre, cita: 'te cuento de Tomás' },
  edad: { valor: TOMAS.datos.edad, cita: 'Tiene seis años' },
  sexo: { valor: TOMAS.datos.sexo, cita: 'Es alérgico al huevo' },
  pesoKg: { valor: TOMAS.datos.pesoKg!, cita: 'pesa veintiún kilos' },
  tallaCm: { valor: TOMAS.datos.tallaCm!, cita: 'mide un metro dieciséis' },
  alergiasMencionadas: [{ valor: 'huevo', cita: 'Es alérgico al huevo' }],
  alertas: [],
  dieta: { valor: TOMAS.datos.dieta, cita: 'No tiene ninguna dieta especial' },
}
const perfilInicial: PerfilBorrador = { ...TOMAS.borrador, datos: datosAltaTomas, faltan: [] }
const perfilCrear: CrearPerfilRes = { ninoId: NINO_ID }
const ORDEN_ESTADO = { acepta: 0, en_proceso: 1, rechaza: 2 }
const perfil: Perfil = {
  ninoId: NINO_ID,
  datos: TOMAS.datos,
  reglas: TOMAS.borrador.reglas,
  patrones: PATRONES,
  preparaciones: [...ACEPT.entries()]
    .map(([id, e]) => ({ id, nombre: prep(id).nombre, estado: estadoDe(e), puntaje: redondear(e.p), veces: e.veces }))
    .sort((a, b) => ORDEN_ESTADO[a.estado] - ORDEN_ESTADO[b.estado] || b.puntaje - a.puntaje),
}

// ---------- Receta (POST /api/receta): de sus papas al horno en bastones a los bastones de queso ----------
const hoy = coberturaDia(HOY)
const faltaHoy = redondear(Math.max(0, OBJETIVO[NUTRIENTE_OBJ] - hoy.consumido.valor[NUTRIENTE_OBJ]), DECIMALES[NUTRIENTE_OBJ])
const lineaCandidato = (c: Candidato, i: number) =>
  `${i + 1}. ${c.nombre} · parte de: ${c.camino.desde} (${c.camino.aceptacion}) · cambia: ${c.cambio} · se mantiene: ${c.seMantiene.join(', ')} · ` +
  `aporta ${uni(NUTRIENTE_OBJ, c.aportePorcion[NUTRIENTE_OBJ] ?? 0)} por porción · puntaje ${coma(c.puntaje)}`
const seguros = [...ACEPT.entries()].filter(([, e]) => estadoDe(e) === 'acepta')
const evidencia: Evidencia = {
  nutriente: NUTRIENTE_OBJ,
  coberturaSemana: coberturaSem[NUTRIENTE_OBJ],
  faltaHoy,
  candidatos: [CAND_QUESO, CAND_YOGUR],
  reglas: TOMAS.borrador.reglas.map((r) => r.texto),
  alergias: TOMAS.datos.alergias,
  texto: [
    `Chico: ${NOMBRE}, ${TOMAS.datos.edad} años. Alergias: ${TOMAS.datos.alergias.join(', ')}. Dieta: ${TOMAS.datos.dieta}.`,
    `Nutriente a cubrir: ${NOMBRE_NUTRIENTE[NUTRIENTE_OBJ]}. Cobertura de la semana: ${pct(coberturaSem[NUTRIENTE_OBJ])}. Falta hoy: ${coma(faltaHoy)} ${UNIDAD[NUTRIENTE_OBJ]}.`,
    `Otros que faltan esta semana: ${faltan.slice(1).map((n) => `${NOMBRE_NUTRIENTE[n]} (${pct(coberturaSem[n])})`).join(', ')}.`,
    'Reglas que contó la familia:',
    ...TOMAS.borrador.reglas.map((r) => `- ${r.texto} (${r.efecto})`),
    'Patrones aprendidos de sus comidas:',
    ...PATRONES.filter((p) => p.fuente === 'aprendido').map((p) => `- ${p.texto} (${p.apoyo} observaciones, confianza ${coma(p.confianza)})`),
    'Alimentos seguros (en acepta):',
    `- ${seguros.map(([id, e]) => `${prep(id).nombre} ${e.comio}/${e.veces}`).join('; ')}`,
    'Candidatos a un solo cambio de algo que acepta:',
    ...[CAND_QUESO, CAND_YOGUR].map(lineaCandidato),
    'Reglas de la receta:',
    '- Porción chica, servida separada y al lado de su alimento seguro; que no se toquen.',
    '- Un solo cambio respecto del alimento de partida; todo lo demás igual.',
    `- Sin ${TOMAS.datos.alergias.join(', ')} (alergia): el rebozado va sin huevo.`,
    '- Nada escondido: si un ingrediente va adentro, se dice y se ofrece también a la vista.',
    '- Usá solo los ingredientes de los candidatos y los alimentos seguros.',
  ].join('\n'),
}

const INGREDIENTES_RECETA = [
  { alimentoId: 'queso_muzzarella', gramos: 40 },
  { alimentoId: 'pan_rallado', gramos: 10 },
  { alimentoId: 'leche', gramos: 10 },        // para que se pegue el pan rallado, en lugar del huevo
  { alimentoId: 'aceite_girasol', gramos: 2 },
]
const aporteReceta = redondearN(deIngredientes(INGREDIENTES_RECETA))
const receta: Receta = {
  nombre: 'Bastones de queso al horno, crocantes como sus papas',
  preparacionBaseId: CAND_QUESO.preparacionId,
  desde: { preparacionId: CAND_QUESO.desdeId, nombre: prep(CAND_QUESO.desdeId).nombre },
  cambio: CAND_QUESO.cambio,
  seMantiene: CAND_QUESO.seMantiene,
  ingredientes: INGREDIENTES_RECETA.map((i) => ({ ...i, nombre: TABLA[i.alimentoId]?.nombre ?? i.alimentoId })),
  pasos: [
    'Prendé el horno a 200 °C y poné papel de horno en una placa.',
    'Cortá la muzzarella en bastones del mismo largo y grosor que sus papas en bastones (unos 8 cm por 1 cm).',
    'Pasá cada bastón por un poco de leche y después por el pan rallado, apretando para que se pegue. No lleva huevo.',
    'Ponelos en la placa separados entre sí y pincelalos apenas con el aceite.',
    'Congelalos 15 minutos para que el queso no se derrita antes de dorarse.',
    'Horneá de 8 a 10 minutos, hasta que estén dorados y crocantes por fuera. Dejalos entibiar 2 minutos antes de servir.',
  ],
  porQue: `Parte de sus papas al horno en bastones, que comió ${ACEPT.get(CAND_QUESO.desdeId)?.comio ?? 0} de ${ACEPT.get(CAND_QUESO.desdeId)?.veces ?? 0} veces: mantiene la forma de bastón, lo crocante, lo salado, lo caliente y el horno, ` +
    `y cambia solo el ingrediente. Lo crocante servido separado lo acepta, y los bastones de queso ya los vio ${expQueso?.veces ?? 0} veces ` +
    `(la última ${ESCALON[expQueso?.mejorPaso ?? 'nada']}). Una porción aporta ${uni(NUTRIENTE_OBJ, aporteReceta[NUTRIENTE_OBJ])}, lo que más le falta esta semana.`,
  presentacion: 'En su plato playo de siempre: sus papas al horno a la izquierda y 2 bastones de queso a la derecha, separados y sin tocarse. ' +
    'La mayor parte del plato es lo que ya come.',
  comoOfrecer: 'Ofrecelo sin pedirle que lo coma; que esté en el plato ya es un avance. Si lo toca, lo huele o lo deja, también cuenta. ' +
    'Servilo igual, con la misma forma y al lado de sus papas, de 8 a 15 veces antes de cambiar algo.',
  transparencia: null,
  aporte: aporteReceta,
  coberturaDeLoQueFalta: faltaHoy ? redondear(aporteReceta[NUTRIENTE_OBJ] / faltaHoy) : 0,
  validacion: { ok: true, problemas: [], reintentos: 0 },
  evidencia,
}

// ---------- Imagen del plato (POST /api/imagen-plato): SVG ilustrativo escrito a mano ----------
// Plato playo visto desde arriba: bastones de papa a la izquierda y de queso a la derecha, con aire entre los dos.
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" width="320" height="320">
  <rect width="320" height="320" fill="#FBF7F0"/>
  <circle cx="160" cy="160" r="140" fill="#FFFFFF" stroke="#D8D1C4" stroke-width="4"/>
  <circle cx="160" cy="160" r="110" fill="none" stroke="#EEE8DC" stroke-width="2"/>
  <g fill="#F4C752" stroke="#D9A42B" stroke-width="2">
    <rect x="72" y="104" width="14" height="96" rx="4" transform="rotate(-10 79 152)"/>
    <rect x="92" y="98" width="14" height="104" rx="4" transform="rotate(-4 99 150)"/>
    <rect x="112" y="102" width="14" height="98" rx="4" transform="rotate(3 119 151)"/>
    <rect x="84" y="150" width="14" height="80" rx="4" transform="rotate(8 91 190)"/>
    <rect x="106" y="154" width="14" height="78" rx="4" transform="rotate(-6 113 193)"/>
  </g>
  <g fill="#E39B3A" stroke="#B4722A" stroke-width="2">
    <rect x="190" y="112" width="20" height="96" rx="6" transform="rotate(6 200 160)"/>
    <rect x="222" y="118" width="20" height="92" rx="6" transform="rotate(-5 232 164)"/>
  </g>
  <g fill="#B4722A">
    <circle cx="198" cy="132" r="2"/><circle cx="204" cy="160" r="2"/><circle cx="197" cy="188" r="2"/>
    <circle cx="230" cy="138" r="2"/><circle cx="236" cy="168" r="2"/><circle cx="229" cy="194" r="2"/>
  </g>
</svg>
`
const imagenPlato: ImagenPlatoRes = { imagenBase64: Buffer.from(SVG, 'utf8').toString('base64'), mime: 'image/svg+xml', ilustrativa: true }

// ---------- Resumen para la nutricionista (GET /api/resumen) ----------
// Solo con números del mismo objeto progreso (lo que haría el LLM con "usá solo estos números").
function resumenTexto(p: Progreso): string {
  const desde = p.dias[0]?.dia ?? ''
  const hasta = p.dias.at(-1)?.dia ?? ''
  const fecha = (d: string) => `${Number(d.slice(8, 10))}/${Number(d.slice(5, 7))}`
  const comidas = p.dias.flatMap((d) => d.comidas)
  const conducta = (c: Conducta) => comidas.filter((x) => x.conducta?.includes(c)).length
  const riesgo = conducta('arcadas') + conducta('atragantamiento')
  const bajos = p.semana.faltan.map((n) => `${NOMBRE_NUTRIENTE[n]} ${pct(p.semana.cobertura[n])}`).join(', ')
  const cubiertos = NUTRIENTE.filter((n) => n !== 'energia_kcal' && !p.semana.faltan.includes(n))
    .map((n) => `${NOMBRE_NUTRIENTE[n]} ${pct(p.semana.cobertura[n])}`).join(', ')
  const t = p.repertorioTendencia
  const grupos = p.grupos.filter((g) => g.grupo !== 'otro').map((g) => `${NOMBRE_GRUPO[g.grupo]}: ${g.diasSinComer === null ? 'sin registros' : g.diasSinComer === 0 ? 'hoy' : `hace ${g.diasSinComer} días`}`)
  const expos = p.exposiciones.slice(0, 4).map((e) => `${e.nombre.toLowerCase()} (${e.veces} ofrecimientos, mejor escalón: ${ESCALON[e.mejorPaso]})`)
  return [
    `Resumen de alimentación de ${NOMBRE}, del ${fecha(desde)} al ${fecha(hasta)}, armado con ${comidas.length} comidas registradas por la familia.`,
    '',
    `Repertorio: acepta ${p.aceptadas} preparaciones (${t >= 0 ? '+' : ''}${t} respecto de la semana anterior) y tiene ${p.enProceso} en proceso.`,
    `Cobertura semanal estimada respecto de la referencia para su edad. Por debajo del 70%: ${bajos}. Por encima: ${cubiertos}.`,
    `Energía aproximada: ${p.semana.energiaPromedioKcal} kcal por día, como dato (sin meta).`,
    `Última vez que comió de cada grupo: ${grupos.join('; ')}.`,
    `Exposiciones en curso: ${expos.join('; ')}.`,
    `Conducta en la mesa: tranquilo en ${conducta('tranquilo')} de ${comidas.length} comidas; se levantó en ${conducta('se_levanto')}; ` +
      `pidió su comida de siempre en ${conducta('pidio_otra_cosa')}; angustia en ${conducta('angustia')}; ${riesgo ? `arcadas o tos en ${riesgo}` : 'sin arcadas ni atragantamientos'}.`,
    `Señales de alerta: ${p.alertas.length ? p.alertas.map((a) => a.texto).join(' ') : 'ninguna.'}`,
    '',
    'Valores aproximados, no es un diagnóstico.',
  ].join('\n')
}
const resumen: ResumenRes = { texto: resumenTexto(progreso), progreso, generadoISO: '2026-10-17T09:00:00-03:00' }

// ---------- Salud (GET /api/salud), versión stub ----------
const salud: SaludRes = {
  ok: true,
  servicios: {
    mongo: { ok: true, ms: 38 }, neo4j: { ok: true, ms: 112 }, claude: { ok: true, ms: 640 },
    transcripcion: { ok: true, ms: 410 }, imagen: { ok: true, ms: 950 },
  },
  motorGrafo: 'neo4j',
  stub: true,
}

// ---------- Controles ----------
const errores: string[] = []
const exigir = (ok: unknown, msj: string) => { if (!ok) errores.push(msj) }
for (const r of relato.respuestas) exigir(r.cita && transcripcion.includes(r.cita), `relato: la cita de ${r.itemIdTmp} no está en la transcripción`)
const cubiertos = new Set([...relato.respuestas.map((r) => r.itemIdTmp), ...relato.sinMencion])
exigir(analisis.items.every((i) => cubiertos.has(i.idTmp)) && cubiertos.size === analisis.items.length, 'relato: cada ítem va en respuestas o en sinMencion')
exigir(relato.sinMencion.length === 1, 'relato: un ítem en sinMencion')
exigir(analisis.preguntas.length <= 3, 'análisis: máximo 3 preguntas')
exigir(progreso.dias.length === 7 && progreso.semanas.length === 4, 'progreso: 7 días y 4 semanas')
exigir(progreso.grupos.length === GRUPO.length, 'progreso: todos los grupos')
exigir(progreso.exposiciones.some((e) => e.preparacionId === 'bastones_queso_horno'), 'progreso: exposición a los bastones de queso')
exigir(progreso.alertas.some((a) => a.tipo === 'repertorio_chico'), 'progreso: alerta repertorio_chico')
exigir(sugerencias.map((s) => s.tipo).join() === 'segura,un_paso,mas_nutritiva', 'sugerencias: orden segura, un_paso, mas_nutritiva')
exigir(progreso.proximoPaso?.preparacionId === sugerencias[1]?.preparacionId, 'proximoPaso = la sugerencia un_paso')
for (const n of ['calcio_mg', 'vitamina_d_ug', 'fibra_g'] as const) exigir(faltan.includes(n), `Tomás debería estar bajo en ${n}`)
exigir(NUTRIENTE_OBJ === 'calcio_mg', 'la receta está escrita para el calcio')
exigir(!receta.ingredientes.some((i) => i.alimentoId.includes('huevo')), 'receta: sin huevo (alergia)')
exigir(TOMAS.datos.alergias.includes('huevo'), 'Tomás es alérgico al huevo')
{
  const { alergiasMencionadas, alertas, otrasAlergiasMencionadas: _otras, ...simples } = datosAltaTomas
  for (const [k, d] of [...Object.entries(simples), ...alergiasMencionadas.map((a) => ['alergia', a] as const), ...alertas.map((a) => ['alerta', a] as const)]) {
    exigir(d && AUDIO_ALTA_TOMAS.includes(d.cita), `perfil-inicial: la cita de ${k} no está en el audio de alta`)
  }
  exigir(alergiasMencionadas.map((a) => a.valor).join() === TOMAS.datos.alergias.join(), 'perfil-inicial: las alergias mencionadas son las de Tomás')
}
for (const [id, e] of ACEPT) exigir(e.veces > 0 || DEL_PERFIL.has(id), `preparación sin veces: ${id}`)
for (const p of PATRONES.filter((x) => x.fuente === 'aprendido')) {
  const s = PATRONES.indexOf(p)
  exigir(p.apoyo >= 3 && p.confianza >= 0.75, `patrón ${s} no pasa los umbrales de §8 (n ${p.apoyo}, ${p.confianza})`)
}
const PROHIBIDAS = ['que termine', 'premio', 'una probadita más', 'caloría']
const textos = JSON.stringify([progreso.frase, sugerencias, receta, registrar.aprendi, resumen.texto, relato.comentario]).toLowerCase()
for (const f of PROHIBIDAS) exigir(!textos.includes(f), `lenguaje prohibido: "${f}"`)
exigir(resumen.texto.trimEnd().endsWith('Valores aproximados, no es un diagnóstico.'), 'resumen: termina con la aclaración')
if (errores.length) {
  console.error(`✗ ${errores.length} problema(s):\n- ${errores.join('\n- ')}`)
  process.exit(1)
}

// ---------- Escritura ----------
const FIXTURES: Record<string, unknown> = {
  'analizar-comida': analisis,
  'relato-comida': relato,
  transcribir,
  'perfil-inicial': perfilInicial,
  'perfil-crear': perfilCrear,
  perfil,
  'registrar-comida': registrar,
  nutricion,
  progreso,
  receta,
  'imagen-plato': imagenPlato,
  resumen,
  salud,
}
mkdirSync(SALIDA, { recursive: true })
for (const [nombre, valor] of Object.entries(FIXTURES)) {
  writeFileSync(join(SALIDA, `${nombre}.json`), `${JSON.stringify(valor, null, 2)}\n`)
}
console.log(`✓ ${Object.keys(FIXTURES).length} fixtures en fixtures/`)
console.log(`  ${progreso.frase}`)
