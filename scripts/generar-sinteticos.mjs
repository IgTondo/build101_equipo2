// Dataset sintético de PLAN.md §10.5: dos chicos con historial de comidas y reglas ocultas.
// Uso: node scripts/generar-sinteticos.mjs → escribe data/sinteticos/*.json y controla que las reglas ocultas
// se puedan encontrar con los umbrales de la minería de patrones (§8). Sale con código 1 si algo no cierra.
// Es una simulación: se declara en el README. No editar los JSON a mano; cambiar este archivo y volver a correrlo.
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SALIDA = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'sinteticos')

// ---------- Vocabulario (copia de shared/contratos.ts, §5; cuando exista, importarlo de ahí) ----------
const ATRIBUTOS = {
  textura: ['crocante', 'blando', 'cremoso', 'masticable', 'jugoso', 'mixto'],
  forma: ['baston', 'redondo', 'plano', 'trozos', 'pure', 'granos', 'entero'],
  color: ['blanco', 'beige', 'amarillo', 'naranja', 'rojo', 'verde', 'marron', 'mixto'],
  sabor: ['salado', 'dulce', 'acido', 'neutro'],
  temperatura: ['frio', 'tibio', 'caliente'],
  presentacion: ['separado', 'mezclado', 'con_salsa'],
  grupo: ['cereal_almidon', 'proteina', 'verdura', 'fruta', 'lacteo', 'otro'],
  coccion: ['frito', 'horno', 'hervido', 'plancha', 'crudo', 'listo'], // v4
}
const CUANTO = ['todo', 'mitad', 'poco', 'probo', 'toco', 'nada', 'aparto']
const PORCION = { chica: 0.6, mediana: 1, grande: 1.5 }
const CONDUCTA = ['tranquilo', 'se_levanto', 'angustia', 'pidio_otra_cosa', 'arcadas', 'atragantamiento']
const MOTIVO = ['textura', 'sabor_olor', 'mezcla', 'marca', 'forma', 'color', 'temperatura', 'se_tocaban', 'cantidad', 'otro']
const HORA = { desayuno: '08:30', almuerzo: '12:30', merienda: '17:00', cena: '20:30', colacion: '10:30' }

// §5.1: o (aceptación) por escalón
const O = { todo: 1, mitad: 0.7, poco: 0.4, probo: 0.3, toco: 0.15, nada: 0.05, aparto: 0 }

// ---------- Preparaciones ----------
// Atributos en este orden: textura forma color sabor temperatura presentacion grupo coccion
// `corto` es como lo nombra el padre en la nota de voz (con artículo, para concordar "lo/la/los/las").
const P = {}
function prep(id, nombre, corto, atributos, ingredientes) {
  const valores = atributos.split(' ')
  P[id] = {
    id, nombre, corto,
    atributos: Object.fromEntries(Object.keys(ATRIBUTOS).map((k, i) => [k, valores[i]])),
    ingredientes: ingredientes.map(([alimentoId, gramos]) => ({ alimentoId, gramos })),
  }
}

prep('papas_fritas_baston', 'Papas fritas en bastones', 'las papas fritas', 'crocante baston amarillo salado caliente separado cereal_almidon frito', [['papa', 120], ['aceite_girasol', 10]])
prep('papas_horno_baston', 'Papas al horno en bastones, crocantes', 'las papas al horno', 'crocante baston amarillo salado caliente separado cereal_almidon horno', [['papa', 120], ['aceite_girasol', 5]])
prep('papas_horno_cubos', 'Papas al horno en cubos, blandas', 'las papas al horno', 'blando trozos amarillo salado caliente separado cereal_almidon horno', [['papa', 120], ['aceite_girasol', 5]])
prep('papa_hervida', 'Papa hervida en trozos', 'la papa hervida', 'blando trozos blanco neutro caliente separado cereal_almidon hervido', [['papa', 120]])
prep('pure_papa', 'Puré de papa', 'el puré', 'cremoso pure amarillo salado caliente separado cereal_almidon hervido', [['papa', 130], ['leche', 30], ['manteca', 5]])
prep('milanesa_carne_horno', 'Milanesa de carne al horno (rebozada sin huevo)', 'la milanesa', 'crocante plano marron salado caliente separado proteina horno', [['carne_vacuna', 90], ['pan_rallado', 20], ['aceite_girasol', 5]])
prep('milanesa_napolitana', 'Milanesa a la napolitana (sin huevo)', 'la milanesa', 'mixto plano mixto salado caliente con_salsa proteina horno', [['carne_vacuna', 90], ['pan_rallado', 20], ['salsa_tomate', 30], ['queso_muzzarella', 30]])
prep('hamburguesa_casera', 'Hamburguesa casera a la plancha', 'la hamburguesa', 'jugoso redondo marron salado caliente separado proteina plancha', [['carne_picada', 100]])
prep('pollo_plancha', 'Pollo a la plancha', 'el pollo', 'jugoso plano blanco salado caliente separado proteina plancha', [['pollo', 90]])
prep('pollo_desmenuzado', 'Pollo hervido desmenuzado', 'el pollo', 'blando trozos blanco neutro tibio separado proteina hervido', [['pollo', 70]])
prep('tostadas', 'Tostadas de pan blanco', 'las tostadas', 'crocante plano beige neutro tibio separado cereal_almidon horno', [['pan_blanco', 40]])
prep('galletitas_agua', 'Galletitas de agua', 'las galletitas', 'crocante plano beige salado frio separado cereal_almidon listo', [['galletitas_agua', 25]])
prep('leche_chocolatada', 'Leche chocolatada', 'la leche chocolatada', 'cremoso entero marron dulce frio separado lacteo listo', [['leche', 200], ['cacao_azucarado', 15]])
prep('bastones_queso_horno', 'Bastones de queso horneados', 'los bastones de queso', 'crocante baston amarillo salado caliente separado lacteo horno', [['queso_muzzarella', 40], ['pan_rallado', 10]])
prep('bastones_zanahoria_horno', 'Bastones de zanahoria horneados', 'los bastones de zanahoria', 'crocante baston naranja dulce caliente separado verdura horno', [['zanahoria', 60], ['aceite_girasol', 3]])
prep('manzana_bastones', 'Manzana pelada en bastones', 'la manzana', 'crocante baston blanco dulce frio separado fruta crudo', [['manzana', 60]])
prep('arroz_con_pollo', 'Arroz con pollo', 'el arroz con pollo', 'mixto granos mixto salado caliente mezclado cereal_almidon hervido', [['arroz', 80], ['pollo', 50]])
prep('fideos_con_salsa', 'Fideos con salsa de tomate', 'los fideos', 'blando trozos rojo salado caliente con_salsa cereal_almidon hervido', [['fideos', 80], ['salsa_tomate', 40]])
prep('fideos_manteca_queso', 'Fideos con manteca y queso rallado', 'los fideos', 'blando trozos beige salado caliente mezclado cereal_almidon hervido', [['fideos', 90], ['manteca', 5], ['queso_rallado', 10]])
prep('lentejas_guisadas', 'Lentejas guisadas', 'las lentejas', 'blando granos marron salado caliente mezclado proteina hervido', [['lentejas', 80], ['zanahoria', 20]])
prep('brocoli_hervido', 'Brócoli hervido', 'el brócoli', 'blando trozos verde neutro caliente separado verdura hervido', [['brocoli', 50]])
prep('arvejas_enteras', 'Arvejas enteras', 'las arvejas', 'blando granos verde neutro caliente separado verdura hervido', [['arvejas', 50]])
prep('chauchas_hervidas', 'Chauchas hervidas', 'las chauchas', 'blando baston verde neutro caliente separado verdura hervido', [['chauchas', 50]])
prep('pure_arvejas', 'Arvejas en puré', 'el puré de arvejas', 'cremoso pure verde neutro caliente separado verdura hervido', [['arvejas', 60], ['manteca', 3]])
prep('pure_zapallo', 'Puré de zapallo', 'el puré de zapallo', 'cremoso pure naranja dulce caliente separado verdura hervido', [['zapallo', 100]])
prep('yogur_vainilla', 'Yogur de vainilla', 'el yogur', 'cremoso pure blanco dulce frio separado lacteo listo', [['yogur', 150]])
prep('banana_pisada', 'Banana pisada', 'la banana', 'cremoso pure amarillo dulce frio separado fruta crudo', [['banana', 80]])
prep('arroz_con_leche', 'Arroz con leche', 'el arroz con leche', 'cremoso granos blanco dulce frio mezclado lacteo hervido', [['arroz', 30], ['leche', 150], ['azucar', 10]])

// ---------- Chicos ----------
// Comida: [dia, momento, ítems, conducta, opciones]. Ítem: [preparacionId, cuanto, porcion = 'mediana', motivo].
// Lo nuevo va en porción chica (§7, reglas de la receta).
const NINOS = [
  {
    ninoId: 'tomas',
    datos: { nombre: 'Tomás', edad: 6, sexo: 'masculino', pesoKg: 21, tallaCm: 116, alergias: ['huevo'], alertas: [], dieta: 'ninguna' },
    acepta: ['papas_fritas_baston', 'milanesa_carne_horno', 'tostadas', 'galletitas_agua', 'leche_chocolatada'],
    rechaza: [['pure_papa', 'textura'], ['arroz_con_pollo', 'mezcla']],
    reglas: [
      { texto: 'No come nada mezclado', condiciones: [{ tipo: 'presentacion', valor: 'mezclado' }], efecto: 'rechaza' },
    ],
    reglasOcultas: [
      { id: 'T1', texto: 'Lo crocante y separado lo acepta, sin importar la cocción (papa frita o al horno en bastones, igual)', condiciones: [{ tipo: 'textura', valor: 'crocante' }, { tipo: 'presentacion', valor: 'separado' }], resultado: 'acepta', declarada: false },
      { id: 'T2', texto: 'Lo blando lo rechaza, aunque sea un alimento que acepta en otra textura (papa al horno blanda, papa hervida)', condiciones: [{ tipo: 'textura', valor: 'blando' }], resultado: 'rechaza', declarada: false },
      { id: 'T3', texto: 'Lo jugoso lo rechaza: la hamburguesa no, la milanesa sí, aunque las dos vengan con papas fritas', condiciones: [{ tipo: 'textura', valor: 'jugoso' }], resultado: 'rechaza', declarada: false },
      { id: 'T4', texto: 'Lo mezclado lo rechaza', condiciones: [{ tipo: 'presentacion', valor: 'mezclado' }], resultado: 'rechaza', declarada: true },
      { id: 'T5', texto: 'Lo que viene con salsa lo rechaza, aunque sea su milanesa', condiciones: [{ tipo: 'presentacion', valor: 'con_salsa' }], resultado: 'rechaza', declarada: false },
    ],
    comidas: [
      ['2026-10-07', 'almuerzo', [['papas_fritas_baston', 'todo'], ['milanesa_carne_horno', 'todo'], ['bastones_queso_horno', 'nada', 'chica']], ['tranquilo']],
      ['2026-10-07', 'cena', [['hamburguesa_casera', 'aparto', 'mediana', 'textura'], ['papas_fritas_baston', 'todo']], ['pidio_otra_cosa']],
      ['2026-10-08', 'almuerzo', [['arroz_con_pollo', 'aparto', 'mediana', 'mezcla'], ['tostadas', 'todo']], ['angustia', 'pidio_otra_cosa'], { plato: 'hondo' }],
      ['2026-10-08', 'merienda', [['leche_chocolatada', 'todo'], ['galletitas_agua', 'todo']], ['tranquilo']],
      ['2026-10-09', 'almuerzo', [['papas_horno_cubos', 'nada', 'mediana', 'textura'], ['milanesa_carne_horno', 'todo']], ['tranquilo']],
      ['2026-10-09', 'cena', [['papas_fritas_baston', 'todo'], ['bastones_queso_horno', 'toco', 'chica'], ['brocoli_hervido', 'nada', 'chica']], ['tranquilo']],
      ['2026-10-10', 'almuerzo', [['papas_horno_baston', 'todo'], ['milanesa_napolitana', 'aparto', 'mediana', 'mezcla']], ['se_levanto']],
      ['2026-10-10', 'merienda', [['leche_chocolatada', 'todo'], ['manzana_bastones', 'poco', 'chica']], ['tranquilo']],
      ['2026-10-11', 'almuerzo', [['fideos_con_salsa', 'aparto', 'mediana', 'mezcla'], ['papas_fritas_baston', 'todo']], ['se_levanto', 'pidio_otra_cosa'], { plato: 'hondo' }],
      ['2026-10-11', 'cena', [['pollo_plancha', 'aparto', 'mediana', 'textura'], ['tostadas', 'todo']], ['pidio_otra_cosa']],
      ['2026-10-12', 'almuerzo', [['papas_horno_baston', 'todo'], ['milanesa_carne_horno', 'todo'], ['bastones_queso_horno', 'probo', 'chica']], ['tranquilo']],
      ['2026-10-12', 'cena', [['arroz_con_pollo', 'nada', 'chica'], ['papas_fritas_baston', 'todo']], ['tranquilo']],
      ['2026-10-13', 'almuerzo', [['papa_hervida', 'aparto', 'mediana', 'textura'], ['milanesa_carne_horno', 'mitad'], ['bastones_zanahoria_horno', 'nada', 'chica']], ['tranquilo']],
      ['2026-10-13', 'merienda', [['leche_chocolatada', 'todo'], ['galletitas_agua', 'todo'], ['manzana_bastones', 'mitad', 'chica']], ['tranquilo']],
      ['2026-10-14', 'almuerzo', [['papas_fritas_baston', 'todo'], ['bastones_queso_horno', 'poco', 'chica'], ['bastones_zanahoria_horno', 'toco', 'chica']], ['tranquilo']],
      ['2026-10-14', 'cena', [['hamburguesa_casera', 'toco'], ['papas_fritas_baston', 'todo']], ['tranquilo']],
      ['2026-10-15', 'almuerzo', [['lentejas_guisadas', 'nada', 'chica'], ['milanesa_carne_horno', 'todo'], ['papas_fritas_baston', 'todo']], ['tranquilo']],
      ['2026-10-15', 'cena', [['fideos_con_salsa', 'nada', 'chica'], ['tostadas', 'todo']], ['tranquilo'], { plato: 'hondo' }],
      ['2026-10-16', 'almuerzo', [['pure_papa', 'aparto', 'mediana', 'textura'], ['milanesa_carne_horno', 'todo'], ['bastones_queso_horno', 'mitad', 'chica']], ['tranquilo']],
      ['2026-10-16', 'merienda', [['leche_chocolatada', 'mitad'], ['tostadas', 'todo']], ['tranquilo']],
    ],
  },
  {
    ninoId: 'lucia',
    datos: { nombre: 'Lucía', edad: 10, sexo: 'femenino', pesoKg: 31, tallaCm: 138, alergias: [], alertas: [], dieta: 'ninguna' },
    acepta: ['fideos_manteca_queso', 'pure_papa', 'yogur_vainilla', 'arroz_con_leche', 'banana_pisada'],
    rechaza: [['papas_fritas_baston', 'textura'], ['brocoli_hervido', 'color']],
    reglas: [
      { texto: 'No come nada verde', condiciones: [{ tipo: 'color', valor: 'verde' }], efecto: 'rechaza' },
    ],
    reglasOcultas: [
      { id: 'L1', texto: 'Lo crocante lo rechaza (al revés que Tomás: las mismas papas fritas)', condiciones: [{ tipo: 'textura', valor: 'crocante' }], resultado: 'rechaza', declarada: false },
      { id: 'L2', texto: 'Lo verde en puré lo acepta: contradice la regla "no come nada verde"', condiciones: [{ tipo: 'color', valor: 'verde' }, { tipo: 'forma', valor: 'pure' }], resultado: 'acepta', declarada: false },
      { id: 'L3', texto: 'Lo verde entero o en trozos lo rechaza', condiciones: [{ tipo: 'color', valor: 'verde' }, { tipo: 'textura', valor: 'blando' }], resultado: 'rechaza', declarada: true },
    ],
    comidas: [
      ['2026-10-07', 'almuerzo', [['fideos_manteca_queso', 'todo'], ['pure_zapallo', 'nada', 'chica']], ['tranquilo'], { plato: 'hondo' }],
      ['2026-10-07', 'merienda', [['yogur_vainilla', 'todo'], ['galletitas_agua', 'toco', 'chica']], ['tranquilo']],
      ['2026-10-07', 'cena', [['pure_papa', 'todo'], ['pollo_desmenuzado', 'mitad'], ['brocoli_hervido', 'aparto', 'chica', 'color']], ['tranquilo']],
      ['2026-10-08', 'almuerzo', [['papas_fritas_baston', 'aparto', 'mediana', 'textura'], ['pollo_desmenuzado', 'mitad'], ['pure_papa', 'todo']], ['pidio_otra_cosa']],
      ['2026-10-08', 'merienda', [['arroz_con_leche', 'todo'], ['banana_pisada', 'mitad']], ['tranquilo']],
      ['2026-10-09', 'almuerzo', [['fideos_manteca_queso', 'todo'], ['pure_zapallo', 'toco', 'chica']], ['tranquilo'], { plato: 'hondo' }],
      ['2026-10-09', 'cena', [['pure_papa', 'todo'], ['arvejas_enteras', 'aparto', 'chica', 'color']], ['angustia']],
      ['2026-10-10', 'almuerzo', [['lentejas_guisadas', 'nada', 'chica'], ['fideos_manteca_queso', 'todo']], ['tranquilo'], { plato: 'hondo' }],
      ['2026-10-10', 'merienda', [['yogur_vainilla', 'todo'], ['banana_pisada', 'todo']], ['tranquilo']],
      ['2026-10-11', 'almuerzo', [['pure_papa', 'mitad'], ['pure_arvejas', 'mitad', 'chica'], ['pollo_desmenuzado', 'poco']], ['tranquilo']],
      ['2026-10-11', 'cena', [['fideos_manteca_queso', 'todo'], ['pure_zapallo', 'probo', 'chica']], ['tranquilo'], { plato: 'hondo' }],
      ['2026-10-12', 'almuerzo', [['pure_papa', 'todo'], ['lentejas_guisadas', 'toco', 'chica'], ['arroz_con_leche', 'todo']], ['tranquilo']],
      ['2026-10-13', 'almuerzo', [['pure_arvejas', 'todo', 'chica'], ['fideos_manteca_queso', 'todo']], ['tranquilo'], { plato: 'hondo' }],
      ['2026-10-13', 'cena', [['chauchas_hervidas', 'aparto', 'chica', 'color'], ['pure_papa', 'todo'], ['pollo_desmenuzado', 'mitad']], ['se_levanto']],
      ['2026-10-14', 'almuerzo', [['pure_zapallo', 'poco', 'chica'], ['fideos_manteca_queso', 'todo']], ['tranquilo'], { plato: 'hondo' }],
      ['2026-10-14', 'merienda', [['yogur_vainilla', 'todo'], ['bastones_zanahoria_horno', 'nada', 'chica']], ['tranquilo']],
      ['2026-10-15', 'almuerzo', [['lentejas_guisadas', 'probo', 'chica'], ['pure_papa', 'todo'], ['pure_arvejas', 'todo', 'chica']], ['tranquilo']],
      ['2026-10-15', 'cena', [['brocoli_hervido', 'aparto', 'chica', 'color'], ['fideos_manteca_queso', 'todo']], ['tranquilo'], { plato: 'hondo' }],
      ['2026-10-16', 'almuerzo', [['pure_zapallo', 'mitad', 'chica'], ['pollo_desmenuzado', 'mitad'], ['pure_papa', 'todo']], ['tranquilo']],
      ['2026-10-16', 'merienda', [['arroz_con_leche', 'todo'], ['banana_pisada', 'todo']], ['tranquilo']],
    ],
  },
]

// ---------- Nota de voz simulada ----------
// Cada respuesta lleva como `cita` la frase exacta de la transcripción que la justifica (v4).
const FRASE = {
  todo: 'se {lo} comió sin dejar nada',
  mitad: 'comió más o menos la mitad',
  poco: 'comió unos bocados',
  probo: 'probó un bocadito y {lo} dejó',
  toco: '{lo} tocó y {lo} olió, pero no se {lo} llevó a la boca',
  nada: 'ni {lo} tocó, {lo} dejó en el plato',
  aparto: '{lo} sacó del plato',
}
const POR_MOTIVO = {
  textura: 'no le gusta cómo se siente en la boca',
  mezcla: 'estaba todo junto con la salsa',
  color: 'dijo que lo verde no lo come',
}
const FRASE_CONDUCTA = {
  tranquilo: 'La comida fue tranquila.',
  se_levanto: 'Se levantó varias veces de la mesa.',
  angustia: 'Se angustió y lloró un rato.',
  pidio_otra_cosa: 'Pidió su comida de siempre.',
}
const PRONOMBRE = { el: 'lo', la: 'la', los: 'los', las: 'las' }

function frase(p, cuanto, motivo) {
  const pron = PRONOMBRE[p.corto.split(' ')[0]]
  const texto = FRASE[cuanto].replaceAll('{lo}', pron) + (motivo ? `, porque ${POR_MOTIVO[motivo]}` : '')
  return `${p.corto[0].toUpperCase()}${p.corto.slice(1)}: ${texto}.`
}

// ---------- Armado de los RegistrarComidaReq (§5) ----------
function armarComida(nino, [dia, momento, items, conducta, opciones = {}], n) {
  const detectados = items.map(([prepId, , porcion = 'mediana'], i) => {
    const p = P[prepId]
    return {
      idTmp: `i${i + 1}`,
      preparacion: p.nombre.toLowerCase(),
      preparacionId: p.id,
      ingredientes: p.ingredientes.map(({ alimentoId, gramos }) => ({ alimentoId, gramosEst: Math.round(gramos * PORCION[porcion]) })),
      porcion,
      atributos: p.atributos,
      caja: null,
      confianza: 1,
    }
  })
  const respuestas = items.map(([prepId, cuanto, porcion = 'mediana', motivo], i) => ({
    itemIdTmp: `i${i + 1}`, cuanto, porcion, ...(motivo && { motivo }), cita: frase(P[prepId], cuanto, motivo),
  }))
  const transcripcion = [...respuestas.map((r) => r.cita), ...conducta.map((c) => FRASE_CONDUCTA[c])].join(' ')
  return {
    ninoId: nino.ninoId,
    dia,
    fechaISO: `${dia}T${HORA[momento]}:00-03:00`,
    momento,
    analisis: {
      analisisId: `sint-${nino.ninoId}-${String(n + 1).padStart(2, '0')}`,
      sinComida: false,
      items: detectados,
      distribucion: { estado: opciones.distribucion ?? 'separados', cantidadItems: detectados.length, plato: opciones.plato ?? 'playo' },
      preguntas: [],
      modelo: 'sintetico',
      ms: 0,
    },
    respuestas,
    respuestasPreguntas: [],
    conducta,
    relato: { transcripcion, fuente: 'texto' },
  }
}

function armarNino(nino) {
  const conAtributos = (id) => ({ nombre: P[id].nombre, preparacionId: id, atributos: P[id].atributos })
  return {
    _nota: 'Dataset sintético (simulación declarada). Generado por scripts/generar-sinteticos.mjs. Ver PLAN.md §10.5.',
    ninoId: nino.ninoId,
    datos: nino.datos,
    borrador: {
      acepta: nino.acepta.map(conAtributos),
      rechaza: nino.rechaza.map(([id, motivo]) => ({ nombre: P[id].nombre, preparacionId: id, motivo })),
      reglas: nino.reglas,
    },
    reglasOcultas: nino.reglasOcultas, // la verdad de base: solo para tests y evals, nunca para la app
    comidas: nino.comidas.map((c, n) => armarComida(nino, c, n)),
  }
}

// ---------- Controles ----------
const errores = []
function exigir(ok, mensaje) { if (!ok) errores.push(mensaje) }

for (const p of Object.values(P)) {
  for (const [k, v] of Object.entries(p.atributos)) exigir(ATRIBUTOS[k].includes(v), `${p.id}: ${k}=${v} no está en el vocabulario`)
  exigir(p.corto.split(' ')[0] in PRONOMBRE, `${p.id}: "corto" tiene que empezar con el, la, los o las`)
}

const salida = NINOS.map(armarNino)

for (const nino of salida) {
  const alergias = nino.datos.alergias
  for (const c of nino.comidas) {
    const donde = `${nino.ninoId} ${c.dia} ${c.momento}`
    exigir(c.momento in HORA, `${donde}: momento desconocido`)
    exigir(!Number.isNaN(Date.parse(c.fechaISO)), `${donde}: fecha inválida`)
    for (const x of c.conducta) exigir(CONDUCTA.includes(x), `${donde}: conducta ${x}`)
    for (const it of c.analisis.items) {
      exigir(it.preparacionId in P, `${donde}: preparación ${it.preparacionId} desconocida`)
      for (const ing of it.ingredientes) exigir(!alergias.some((a) => ing.alimentoId.includes(a)), `${donde}: ${ing.alimentoId} choca con la alergia`)
    }
    for (const r of c.respuestas) {
      exigir(CUANTO.includes(r.cuanto), `${donde}: cuanto=${r.cuanto}`)
      exigir(r.porcion in PORCION, `${donde}: porcion=${r.porcion}`)
      exigir(!r.motivo || (MOTIVO.includes(r.motivo) && r.motivo in POR_MOTIVO), `${donde}: motivo=${r.motivo}`)
      exigir(c.relato.transcripcion.includes(r.cita), `${donde}: la cita no está en la transcripción`)
    }
  }
}

// ¿Las reglas ocultas pasan los umbrales de la minería de patrones (§8)? n ≥ 3, media ≥ 0,75 (acepta)
// o ≤ 0,25 (rechaza), y al menos 0,2 lejos de la media del resto (las observaciones que no cumplen la condición).
// Contra la media global no alcanza: en un chico selectivo, lo que acepta es casi todo lo que come y arrastra la media.
const media = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length
const fmt = (x) => x.toFixed(2)
for (const nino of salida) {
  const obs = nino.comidas.flatMap((c) => c.respuestas.map((r) => {
    const item = c.analisis.items.find((it) => it.idTmp === r.itemIdTmp)
    return { prepId: item.preparacionId, atributos: item.atributos, cuanto: r.cuanto, o: O[r.cuanto] }
  }))
  const global = media(obs.map((x) => x.o))
  console.log(`\n${nino.datos.nombre}: ${nino.comidas.length} comidas, ${obs.length} observaciones, media global ${fmt(global)}`)
  for (const regla of nino.reglasOcultas) {
    const cumple = (x) => regla.condiciones.every(({ tipo, valor }) => x.atributos[tipo] === valor)
    const sub = obs.filter(cumple)
    const resto = obs.filter((x) => !cumple(x))
    const m = sub.length ? media(sub.map((x) => x.o)) : NaN
    const mResto = resto.length ? media(resto.map((x) => x.o)) : NaN
    const ok = sub.length >= 3 && (regla.resultado === 'acepta' ? m >= 0.75 : m <= 0.25) && Math.abs(m - mResto) >= 0.2
    console.log(`  ${ok ? 'OK ' : 'MAL'} ${regla.id} ${regla.condiciones.map((c) => `${c.tipo}=${c.valor}`).join(' ∧ ').padEnd(40)} n=${String(sub.length).padStart(2)} media=${fmt(m)} resto=${fmt(mResto)} → ${regla.resultado}`)
    exigir(ok, `${nino.ninoId} ${regla.id}: no pasa los umbrales de la minería`)
  }

  // Aceptación por preparación (§8): p ← p + 0,3·(o − p); inicial 0,8 si el padre dijo que acepta, 0,1 si rechaza, 0,5 si es nuevo
  const borrador = new Map([...nino.borrador.acepta.map((a) => [a.preparacionId, 0.8]), ...nino.borrador.rechaza.map((r) => [r.preparacionId, 0.1])])
  const estado = new Map()
  for (const x of obs) {
    const e = estado.get(x.prepId) ?? { p: borrador.get(x.prepId) ?? 0.5, veces: 0, pasos: [] }
    e.p += 0.3 * (x.o - e.p); e.veces += 1; e.pasos.push(x.cuanto)
    estado.set(x.prepId, e)
  }
  const etiqueta = ({ p, veces }) => (p >= 0.6 && veces >= 2 ? 'acepta' : p < 0.2 && veces >= 10 ? 'rechaza' : 'en_proceso')
  const filas = [...estado].map(([id, e]) => ({ id, ...e, estado: etiqueta(e) })).sort((a, b) => b.p - a.p)
  console.log(`  repertorio (acepta): ${filas.filter((f) => f.estado === 'acepta').map((f) => f.id).join(', ')}`)
  for (const f of filas.filter((f) => f.estado === 'en_proceso' && !borrador.has(f.id) && f.pasos.length >= 3)) {
    console.log(`  exposiciones ${f.id}: ${f.pasos.join(' → ')} (p=${fmt(f.p)})`)
  }
}

if (errores.length) {
  console.error(`\n${errores.length} problema(s):\n- ${errores.join('\n- ')}`)
  process.exit(1)
}

// ---------- Escritura ----------
mkdirSync(SALIDA, { recursive: true })
const escribir = (nombre, datos) => writeFileSync(join(SALIDA, nombre), JSON.stringify(datos, null, 2) + '\n')
for (const nino of salida) escribir(`${nino.ninoId}.json`, nino)

const usadas = new Set(salida.flatMap((n) => n.comidas.flatMap((c) => c.analisis.items.map((it) => it.preparacionId))))
const preparaciones = [...usadas].sort().map((id) => ({ id, nombre: P[id].nombre, atributos: P[id].atributos, ingredientes: P[id].ingredientes }))
escribir('preparaciones.json', preparaciones)
escribir('indice.json', {
  _nota: 'Ids que usan los chicos sintéticos: tienen que existir en data/alimentos.json (A3) y data/preparaciones.json (B11), o renombrarse en el generador.',
  ninos: salida.map((n) => ({ ninoId: n.ninoId, nombre: n.datos.nombre, comidas: n.comidas.length, desde: n.comidas[0].dia, hasta: n.comidas.at(-1).dia })),
  preparacionIds: preparaciones.map((p) => p.id),
  alimentoIds: [...new Set(preparaciones.flatMap((p) => p.ingredientes.map((i) => i.alimentoId)))].sort(),
})
console.log(`\nEscrito en data/sinteticos/: ${salida.map((n) => `${n.ninoId}.json`).join(', ')}, preparaciones.json, indice.json`)
