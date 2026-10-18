// Dataset sintético de PLAN.md §10.5: dos chicos con historial de comidas y reglas ocultas.
// Uso: node scripts/generar-sinteticos.mjs → escribe data/sinteticos/*.json y controla que las reglas ocultas
// se puedan encontrar con los umbrales de la minería de patrones (§8). Sale con código 1 si algo no cierra.
// Es una simulación: se declara en el README. No editar los JSON a mano; cambiar este archivo y volver a correrlo.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const SALIDA = join(RAIZ, 'data', 'sinteticos')
// Los catálogos que usa la app (solo se leen): las preparaciones tienen que existir ahí, con sus `momentos`, y los
// alérgenos de los alimentos sirven para controlar que ninguna comida choque con la alergia del chico.
const leerCatalogo = (nombre) => {
  const ruta = join(RAIZ, 'data', nombre)
  return existsSync(ruta) ? JSON.parse(readFileSync(ruta, 'utf8')) : null
}
const CATALOGO = new Map((leerCatalogo('preparaciones.json') ?? []).map((p) => [p.id, p]))
const ALIMENTOS = new Map((leerCatalogo('alimentos.json') ?? []).map((a) => [a.id, a]))

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
// Las que suma Valentina (v5.4): copiadas tal cual de data/preparaciones.json (el control de abajo avisa si se separan)
prep('copos_maiz', 'Copos de maíz (cereal de desayuno, como vienen)', 'los copos', 'crocante plano amarillo neutro frio separado cereal_almidon listo', [['cereal_fortificado', 30]])
prep('nuggets_pollo_caseros', 'Nuggets caseros de pollo con el mismo apanado, fritos (sin huevo)', 'los nuggets', 'crocante redondo beige salado caliente separado proteina frito', [['pollo', 70], ['pan_rallado', 15], ['aceite_girasol', 8]])
prep('pizza_muzzarella', 'Pizza de muzzarella sin salsa, masa fina y crocante', 'la pizza', 'crocante plano amarillo salado caliente separado cereal_almidon horno', [['prepizza', 70], ['queso_muzzarella', 40]])
prep('frutilla_pisada', 'Frutillas pisadas', 'las frutillas pisadas', 'cremoso pure rojo dulce frio separado fruta crudo', [['frutilla', 80]])
prep('milanesa_lentejas_horno', 'Milanesa de lentejas al horno (sin huevo)', 'la milanesa de lentejas', 'crocante plano marron salado caliente separado proteina horno', [['lentejas', 80], ['pan_rallado', 20], ['aceite_girasol', 5]])
prep('bastones_boniato_fritos', 'Bastones de boniato fritos', 'los bastones de boniato', 'crocante baston naranja salado caliente separado cereal_almidon frito', [['boniato', 120], ['aceite_girasol', 10]])
prep('pure_papa_queso', 'Puré de papa con queso rallado', 'el puré con queso', 'cremoso pure amarillo salado caliente separado cereal_almidon hervido', [['papa', 130], ['leche', 30], ['manteca', 5], ['queso_rallado', 20]])
prep('licuado_banana_leche', 'Licuado de banana con leche', 'el licuado de banana', 'cremoso entero amarillo dulce frio separado lacteo listo', [['leche', 150], ['banana', 60]])
prep('jugo_naranja_colado', 'Jugo de naranja natural, colado y sin pulpa', 'el jugo de naranja', 'cremoso entero naranja dulce frio separado fruta listo', [['jugo_naranja', 200]])
prep('yogur_bebible', 'Yogur bebible de vainilla', 'el yogur bebible', 'cremoso entero blanco dulce frio separado lacteo listo', [['yogur', 180]])
prep('tostadas_queso', 'Tostadas con queso gratinado, bien doradas', 'las tostadas con queso', 'crocante plano amarillo salado tibio separado cereal_almidon horno', [['pan_blanco', 40], ['queso_muzzarella', 30]])
prep('pure_lentejas', 'Puré de lentejas', 'el puré de lentejas', 'cremoso pure marron salado caliente separado proteina hervido', [['lentejas', 80], ['manteca', 3]])
prep('avena_con_leche', 'Avena con leche, fría', 'la avena con leche', 'cremoso granos beige dulce frio mezclado lacteo hervido', [['leche', 150], ['avena', 40], ['azucar', 5]])
prep('galletitas_integrales', 'Galletitas integrales del mismo formato que las de agua', 'las galletitas integrales', 'crocante plano marron salado frio separado cereal_almidon listo', [['galletitas_integrales', 40]])

// ---------- Valentina: seis semanas, armadas con azar con semilla ----------
// Tomás y Lucía están escritos comida por comida. Valentina tiene 6 semanas (del 7/9 al 18/10, "hoy"), así que la base
// (lo que come siempre) se arma con un generador con semilla y lo que importa va escrito a mano: cada exposición, cada
// rechazo, las comidas en las que la comida se tocó y lo que contó la familia. Misma semilla → mismo archivo.
function mulberry32(semilla) {
  let a = semilla >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const V_DESDE = '2026-09-07' // lunes
const V_DIAS = 42 // hasta el domingo 18/10 (hoy)
const diaV = (n) => new Date(Date.parse(`${V_DESDE}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10)
const ORDEN_MOMENTOS = ['desayuno', 'colacion', 'almuerzo', 'merienda', 'cena']
const V_SEGURAS = ['leche_chocolatada', 'tostadas', 'yogur_vainilla', 'banana_pisada', 'galletitas_agua', 'manzana_bastones', 'copos_maiz',
  'milanesa_carne_horno', 'nuggets_pollo_caseros', 'pure_papa', 'papas_fritas_baston', 'pollo_desmenuzado', 'pizza_muzzarella']

// Lo escrito a mano: [día (0 = lunes 7/9), momento, preparación, cuánto, motivo, porción]. Lo nuevo va en porción chica.
const V_ITEMS = [
  // Exposiciones que llegan al repertorio. Lo dulce entra rápido (V1), aunque sea verdura: contradice "no come verduras"
  [1, 'cena', 'pure_zapallo', 'nada'], [4, 'almuerzo', 'pure_zapallo', 'toco'], [7, 'cena', 'pure_zapallo', 'probo'],
  [10, 'almuerzo', 'pure_zapallo', 'poco'], [14, 'cena', 'pure_zapallo', 'mitad'], [16, 'almuerzo', 'pure_zapallo', 'todo'],
  [21, 'cena', 'pure_zapallo', 'todo'], [25, 'almuerzo', 'pure_zapallo', 'mitad', null, 'mediana'], [30, 'cena', 'pure_zapallo', 'todo', null, 'mediana'],
  [36, 'almuerzo', 'pure_zapallo', 'todo', null, 'mediana'], [40, 'cena', 'pure_zapallo', 'todo', null, 'mediana'],
  [2, 'almuerzo', 'bastones_zanahoria_horno', 'toco'], [5, 'almuerzo', 'bastones_zanahoria_horno', 'probo'], [8, 'cena', 'bastones_zanahoria_horno', 'poco'],
  [11, 'almuerzo', 'bastones_zanahoria_horno', 'mitad'], [15, 'cena', 'bastones_zanahoria_horno', 'todo'], [18, 'almuerzo', 'bastones_zanahoria_horno', 'todo'],
  [22, 'cena', 'bastones_zanahoria_horno', 'todo', null, 'mediana'], [29, 'almuerzo', 'bastones_zanahoria_horno', 'todo', null, 'mediana'],
  [35, 'cena', 'bastones_zanahoria_horno', 'mitad', null, 'mediana'], [39, 'almuerzo', 'bastones_zanahoria_horno', 'todo', null, 'mediana'],
  [3, 'merienda', 'frutilla_pisada', 'toco'], [6, 'colacion', 'frutilla_pisada', 'probo'], [9, 'merienda', 'frutilla_pisada', 'mitad'],
  [12, 'desayuno', 'frutilla_pisada', 'todo'], [15, 'merienda', 'frutilla_pisada', 'todo'], [19, 'colacion', 'frutilla_pisada', 'todo'],
  [24, 'merienda', 'frutilla_pisada', 'mitad'], [29, 'merienda', 'frutilla_pisada', 'todo', null, 'mediana'], [34, 'desayuno', 'frutilla_pisada', 'todo', null, 'mediana'],
  [39, 'merienda', 'frutilla_pisada', 'todo', null, 'mediana'],
  [11, 'merienda', 'licuado_banana_leche', 'poco', 'cantidad', 'mediana'], [19, 'merienda', 'licuado_banana_leche', 'todo', null, 'mediana'],
  [27, 'desayuno', 'licuado_banana_leche', 'todo', null, 'mediana'], [33, 'merienda', 'licuado_banana_leche', 'todo', null, 'mediana'],
  [38, 'desayuno', 'licuado_banana_leche', 'todo', null, 'mediana'],
  // Lo salado y crocante también entra, más despacio
  [8, 'almuerzo', 'milanesa_lentejas_horno', 'toco'], [12, 'cena', 'milanesa_lentejas_horno', 'probo'], [16, 'cena', 'milanesa_lentejas_horno', 'poco'],
  [21, 'almuerzo', 'milanesa_lentejas_horno', 'mitad'], [26, 'cena', 'milanesa_lentejas_horno', 'todo'], [31, 'almuerzo', 'milanesa_lentejas_horno', 'todo', null, 'mediana'],
  [37, 'cena', 'milanesa_lentejas_horno', 'mitad', null, 'mediana'], [41, 'almuerzo', 'milanesa_lentejas_horno', 'todo', null, 'mediana'],
  [14, 'almuerzo', 'bastones_boniato_fritos', 'probo'], [18, 'cena', 'bastones_boniato_fritos', 'mitad'], [22, 'almuerzo', 'bastones_boniato_fritos', 'todo'],
  [28, 'cena', 'bastones_boniato_fritos', 'todo'], [35, 'almuerzo', 'bastones_boniato_fritos', 'todo', null, 'mediana'],
  // Exposiciones en curso
  [17, 'cena', 'pure_papa_queso', 'probo'], [23, 'almuerzo', 'pure_papa_queso', 'poco'], [30, 'almuerzo', 'pure_papa_queso', 'mitad'], [37, 'almuerzo', 'pure_papa_queso', 'mitad'],
  [5, 'desayuno', 'tostadas_queso', 'nada'], [9, 'desayuno', 'tostadas_queso', 'toco'], [14, 'merienda', 'tostadas_queso', 'toco'], [20, 'desayuno', 'tostadas_queso', 'probo'],
  [26, 'merienda', 'tostadas_queso', 'probo'], [32, 'desayuno', 'tostadas_queso', 'poco'], [38, 'merienda', 'tostadas_queso', 'mitad'],
  [10, 'cena', 'pure_lentejas', 'nada'], [15, 'almuerzo', 'pure_lentejas', 'nada'], [23, 'cena', 'pure_lentejas', 'toco'], [27, 'cena', 'pure_lentejas', 'nada'],
  [33, 'almuerzo', 'pure_lentejas', 'toco'], [39, 'cena', 'pure_lentejas', 'probo'],
  [18, 'desayuno', 'jugo_naranja_colado', 'toco'], [23, 'merienda', 'jugo_naranja_colado', 'probo'], [30, 'desayuno', 'jugo_naranja_colado', 'poco'],
  [36, 'merienda', 'jugo_naranja_colado', 'probo'], [40, 'desayuno', 'jugo_naranja_colado', 'mitad'],
  [22, 'merienda', 'galletitas_integrales', 'aparto', 'color'], [29, 'colacion', 'galletitas_integrales', 'toco'], [35, 'merienda', 'galletitas_integrales', 'probo'],
  [41, 'colacion', 'galletitas_integrales', 'poco'],
  [6, 'merienda', 'yogur_bebible', 'aparto', 'marca'], [20, 'colacion', 'yogur_bebible', 'probo'], [27, 'merienda', 'yogur_bebible', 'poco'], [34, 'colacion', 'yogur_bebible', 'mitad'],
  [12, 'almuerzo', 'hamburguesa_casera', 'probo', 'textura'], [30, 'almuerzo', 'hamburguesa_casera', 'poco'],
  [3, 'cena', 'bastones_queso_horno', 'nada'], [11, 'almuerzo', 'bastones_queso_horno', 'toco'], [22, 'cena', 'bastones_queso_horno', 'probo'], [36, 'cena', 'bastones_queso_horno', 'poco'],
  // Trabada: el brócoli, 11 veces y nunca pasó de tocarlo. Recién con 10 exposiciones cuenta como rechazo (§8)
  [2, 'cena', 'brocoli_hervido', 'aparto', 'sabor_olor'], [6, 'cena', 'brocoli_hervido', 'nada'], [10, 'almuerzo', 'brocoli_hervido', 'nada'],
  [13, 'cena', 'brocoli_hervido', 'aparto', 'sabor_olor'], [17, 'almuerzo', 'brocoli_hervido', 'toco'], [20, 'cena', 'brocoli_hervido', 'nada'],
  [24, 'almuerzo', 'brocoli_hervido', 'nada'], [27, 'cena', 'brocoli_hervido', 'aparto', 'sabor_olor'], [31, 'cena', 'brocoli_hervido', 'toco'],
  [34, 'cena', 'brocoli_hervido', 'nada'], [38, 'almuerzo', 'brocoli_hervido', 'nada'],
  // Lo blando y caliente (V2)
  [3, 'almuerzo', 'papa_hervida', 'aparto', 'textura'], [19, 'almuerzo', 'papa_hervida', 'aparto', 'textura'], [32, 'cena', 'papa_hervida', 'nada'],
  [7, 'almuerzo', 'papas_horno_cubos', 'nada', 'textura'], [25, 'cena', 'papas_horno_cubos', 'aparto', 'temperatura'], [37, 'cena', 'papas_horno_cubos', 'nada'],
  [11, 'cena', 'chauchas_hervidas', 'nada'], [24, 'cena', 'chauchas_hervidas', 'toco'], [34, 'almuerzo', 'chauchas_hervidas', 'nada'],
  [4, 'cena', 'fideos_manteca_queso', 'nada', 'mezcla'], [16, 'cena', 'fideos_manteca_queso', 'toco'], [30, 'cena', 'fideos_manteca_queso', 'probo'],
  // Lo que viene en granos (V3), aunque sea dulce
  [4, 'almuerzo', 'arvejas_enteras', 'aparto', 'forma'], [18, 'almuerzo', 'arvejas_enteras', 'aparto', 'forma'], [29, 'cena', 'arvejas_enteras', 'nada'],
  [9, 'almuerzo', 'lentejas_guisadas', 'nada', 'color'], [26, 'almuerzo', 'lentejas_guisadas', 'aparto', 'color'],
  [8, 'merienda', 'arroz_con_leche', 'probo', 'forma'], [21, 'merienda', 'arroz_con_leche', 'nada'], [34, 'merienda', 'arroz_con_leche', 'toco'],
  [12, 'desayuno', 'avena_con_leche', 'nada', 'forma'], [28, 'desayuno', 'avena_con_leche', 'toco'],
  [15, 'cena', 'arroz_con_pollo', 'aparto', 'mezcla'],
  // Con salsa, en lo de la abuela
  [20, 'almuerzo', 'fideos_con_salsa', 'aparto', 'mezcla'], [32, 'almuerzo', 'milanesa_napolitana', 'aparto', 'mezcla'],
  // Lo seguro, en un mal día
  [9, 'cena', 'pure_papa', 'poco', 'temperatura', 'mediana'], [17, 'almuerzo', 'papas_fritas_baston', 'mitad', 'cantidad', 'grande'],
  // Después de que se tocaron (día 33), los nuggets vuelven a salir bien: siguen en su repertorio
  [36, 'cena', 'nuggets_pollo_caseros', 'todo', null, 'mediana'], [38, 'cena', 'nuggets_pollo_caseros', 'todo', null, 'mediana'],
  [40, 'almuerzo', 'nuggets_pollo_caseros', 'todo', null, 'mediana'],
]

// Comidas en las que la comida se tocó (V4, la regla que contó la familia): aparta hasta lo que come siempre
const V_TOCANDOSE = {
  '5-cena': [['milanesa_carne_horno', 'aparto', 'se_tocaban'], ['pure_papa', 'nada']],
  '13-almuerzo': [['nuggets_pollo_caseros', 'toco', 'se_tocaban'], ['papas_fritas_baston', 'aparto', 'se_tocaban']],
  '19-cena': [['pollo_desmenuzado', 'nada'], ['pure_papa', 'aparto', 'se_tocaban']],
  '27-almuerzo': [['milanesa_carne_horno', 'aparto', 'se_tocaban'], ['papas_fritas_baston', 'toco']],
  '33-cena': [['nuggets_pollo_caseros', 'aparto', 'se_tocaban'], ['pure_papa', 'nada']],
}
const V_CONDUCTA = {
  '5-cena': ['angustia'], '13-almuerzo': ['pidio_otra_cosa'], '19-cena': ['angustia', 'se_levanto'], '27-almuerzo': ['se_levanto'],
  '33-cena': ['angustia', 'pidio_otra_cosa'], '13-cena': ['arcadas', 'pidio_otra_cosa'], '27-cena': ['arcadas'],
  '2-cena': ['pidio_otra_cosa'], '4-almuerzo': ['se_levanto'], '20-almuerzo': ['pidio_otra_cosa'], '32-almuerzo': ['pidio_otra_cosa'],
}
const V_NOTAS = {
  '1-cena': 'Le puse el puré de zapallo en la división de al lado, sin decirle nada.',
  '5-cena': 'El puré se pasó por arriba de la división y tocó la milanesa: ya no la quiso.',
  '6-almuerzo': 'Domingo en lo de la abuela, en plato playo pero con todo separado.',
  '6-merienda': 'Compré otro yogur porque no había el de siempre.',
  '11-almuerzo': 'Los bastones de zanahoria le salieron dulces, bien dorados.',
  '13-almuerzo': 'En lo de la abuela le sirvieron todo junto en un plato playo y se tocaban.',
  '13-cena': 'Con el olor del brócoli tuvo arcadas; se lo saqué y se calmó.',
  '16-almuerzo': 'Primera vez que se terminó el puré de zapallo. Dijo que es dulce.',
  '17-almuerzo': 'Le serví muchas papas, más de lo que suele comer.',
  '19-cena': 'Se mezcló el puré con el pollo al servir.',
  '20-almuerzo': 'La abuela hizo fideos con tuco para todos.',
  '22-merienda': 'Dijo que las galletitas integrales estaban quemadas.',
  '25-cena': 'Las papas salieron muy calientes del horno.',
  '27-almuerzo': 'En lo de la abuela otra vez se tocaban la milanesa y las papas.',
  '27-cena': 'Volvió a tener arcadas con el brócoli. Se lo saqué del plato.',
  '33-cena': 'El puré tocó los nuggets y lloró un rato.',
  '38-merienda': 'Las tostadas con queso las mordió sola, sin que le dijéramos nada.',
  '41-almuerzo': 'En lo de la abuela, cada cosa en su lugar.',
}
const V_NOTAS_SUELTAS = [
  'Venía cansada de natación.', 'Comimos todos juntos en la mesa.', 'Hoy comió mirando por la ventana, tranquila.',
  'Le serví en su plato con divisiones, como siempre.', 'Estaba con hambre, comió rápido.', 'Hoy estaba un poco resfriada.',
]
// Horarios reales por comida: [desde, hasta] en minutos, días de semana y fin de semana
const V_HORARIOS = {
  desayuno: [[430, 470], [540, 600]], colacion: [[615, 660], [630, 690]], almuerzo: [[735, 790], [780, 840]],
  merienda: [[1005, 1065], [1020, 1080]], cena: [[1200, 1260], [1215, 1275]],
}
const V_BASE = {
  desayuno: { bebida: ['leche_chocolatada', 'leche_chocolatada', 'leche_chocolatada', 'yogur_vainilla'], solido: ['tostadas', 'tostadas', 'copos_maiz', 'copos_maiz', 'galletitas_agua', 'banana_pisada'] },
  merienda: { bebida: ['leche_chocolatada', 'leche_chocolatada', 'yogur_vainilla'], solido: ['galletitas_agua', 'galletitas_agua', 'tostadas', 'manzana_bastones', 'banana_pisada'] },
  colacion: { solido: ['manzana_bastones', 'banana_pisada', 'yogur_vainilla', 'galletitas_agua'] },
  almuerzo: { proteina: ['milanesa_carne_horno', 'milanesa_carne_horno', 'nuggets_pollo_caseros', 'pollo_desmenuzado'], guarnicion: ['pure_papa', 'papas_fritas_baston', 'papas_fritas_baston'] },
}
V_BASE.cena = V_BASE.almuerzo

function planValentina() {
  const azar = mulberry32(20261018)
  const elegir = (xs) => xs[Math.floor(azar() * xs.length)]
  const hhmm = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
  const comidas = []
  for (let d = 0; d < V_DIAS; d++) {
    const finde = d % 7 >= 5
    const domingo = d % 7 === 6
    const clave = (m) => `${d}-${m}`
    const forzados = new Set([...V_ITEMS.filter((x) => x[0] === d).map((x) => x[1]), ...Object.keys(V_TOCANDOSE).filter((k) => k.startsWith(`${d}-`)).map((k) => k.split('-')[1])])
    let momentos
    if (d === V_DIAS - 1) momentos = ['desayuno', 'colacion', 'almuerzo'] // hoy: hasta el almuerzo
    else {
      const salteada = azar() < 0.22 ? elegir(['desayuno', 'almuerzo', 'merienda', 'cena']) : null
      const colacion = azar() < (finde ? 0.45 : 0.3)
      momentos = ORDEN_MOMENTOS.filter((m) => forzados.has(m) || (m === 'colacion' ? colacion : m !== salteada))
    }
    for (const momento of momentos) {
      const k = clave(momento)
      const [desde, hasta] = V_HORARIOS[momento][finde ? 1 : 0]
      const hora = hhmm(desde + 5 * Math.floor(azar() * ((hasta - desde) / 5 + 1)))
      const enAbuela = domingo && momento === 'almuerzo'
      const opciones = { hora, plato: enAbuela ? 'playo' : 'con_divisiones', fuente: azar() < 0.7 ? 'voz' : 'texto', ...(enAbuela && { comentario: 'En lo de la abuela' }) }
      let items
      if (V_TOCANDOSE[k]) {
        items = V_TOCANDOSE[k].map(([id, cuanto, motivo]) => [id, cuanto, 'mediana', ...(motivo ? [motivo] : [])])
        opciones.distribucion = 'tocandose'
      } else {
        const escritos = V_ITEMS.filter((x) => x[0] === d && x[1] === momento)
          .map(([, , id, cuanto, motivo, porcion]) => [id, cuanto, porcion ?? (V_SEGURAS.includes(id) ? 'mediana' : 'chica'), ...(motivo ? [motivo] : [])])
        const b = V_BASE[momento]
        const base = []
        if (momento === 'cena' && d % 7 === 4) base.push('pizza_muzzarella') // los viernes, pizza
        else if (b.proteina) base.push(elegir(b.proteina), ...(escritos.length < 2 ? [elegir(b.guarnicion)] : []))
        else base.push(...(b.bebida && !escritos.some(([id]) => /licuado|jugo|yogur_bebible|avena/.test(id)) ? [elegir(b.bebida)] : []), elegir(b.solido))
        const deBase = [...new Set(base)].filter((id) => !escritos.some(([e]) => e === id)).map((id) => {
          const dulce = P[id].atributos.sabor === 'dulce'
          const r = azar()
          const cuanto = dulce ? (r < 0.9 ? 'todo' : 'mitad') : r < 0.45 ? 'todo' : r < 0.82 ? 'mitad' : 'poco'
          return [id, cuanto, 'mediana']
        })
        items = [...deBase, ...escritos]
      }
      const aparta = items.some(([, cuanto]) => cuanto === 'aparto')
      const r = azar()
      const conducta = V_CONDUCTA[k] ?? (aparta && r < 0.5 ? ['pidio_otra_cosa'] : r < 0.1 ? ['se_levanto'] : ['tranquilo'])
      const nota = V_NOTAS[k] ?? (azar() < 0.1 ? elegir(V_NOTAS_SUELTAS) : null)
      if (nota) opciones.nota = nota
      comidas.push([diaV(d), momento, items, conducta, opciones])
    }
  }
  return comidas
}

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
  {
    // v5.4 · La del ejemplo completo: 6 semanas, todas las comidas del día, reglas de la familia de contexto (plato y
    // distribución) y una de atributo que los datos contradicen. Alergia al pescado: ninguna comida lo usa.
    ninoId: 'valentina',
    estricto: true, // cada preparación solo en una comida que lista en `momentos` (data/preparaciones.json)
    datos: { nombre: 'Valentina', edad: 8, sexo: 'femenino', pesoKg: 25, tallaCm: 127, alergias: ['pescado'], alertas: [], dieta: 'ninguna' },
    acepta: V_SEGURAS,
    marcas: { leche_chocolatada: 'Conaprole', yogur_vainilla: 'Conaprole', galletitas_agua: 'Maestro Cubano', copos_maiz: "Kellogg's", tostadas: 'Bimbo' },
    // Cómo los nombra la familia en la nota de voz (con la marca, como en la vida real)
    corto: {
      leche_chocolatada: 'la chocolatada Conaprole', yogur_vainilla: 'el yogur de vainilla Conaprole', galletitas_agua: 'las Maestro Cubano',
      copos_maiz: "los copos Kellogg's", tostadas: 'las tostadas de pan Bimbo', nuggets_pollo_caseros: 'los nuggets caseros',
    },
    porMotivo: { color: 'dice que ese color no le gusta', mezcla: 'estaba todo mezclado' },
    rechaza: [['papa_hervida', 'textura'], ['fideos_con_salsa', 'mezcla'], ['brocoli_hervido', 'sabor_olor'], ['arvejas_enteras', 'forma'], ['lentejas_guisadas', 'color']],
    reglas: [
      { texto: 'Come solo en su plato con divisiones', condiciones: [{ tipo: 'plato', valor: 'con_divisiones' }], efecto: 'requiere' },
      { texto: 'Que las comidas no se toquen', condiciones: [{ tipo: 'distribucion', valor: 'tocandose' }], efecto: 'rechaza' },
      { texto: 'No come verduras', condiciones: [{ tipo: 'grupo', valor: 'verdura' }], efecto: 'rechaza' },
    ],
    reglasOcultas: [
      { id: 'V1', texto: 'Lo dulce lo acepta rápido, aunque sea verdura: los bastones de zanahoria y el puré de zapallo entran por el dulce (contradice "no come verduras")', condiciones: [{ tipo: 'sabor', valor: 'dulce' }], resultado: 'acepta', declarada: false },
      { id: 'V2', texto: 'Lo blando y caliente lo rechaza (papa hervida, papas al horno en cubos, brócoli, chauchas, fideos); el pollo desmenuzado, blando pero tibio, sí lo come', condiciones: [{ tipo: 'textura', valor: 'blando' }, { tipo: 'temperatura', valor: 'caliente' }], resultado: 'rechaza', declarada: false },
      { id: 'V3', texto: 'Lo que viene en granos lo rechaza (arvejas, lentejas, arroz, avena), aunque sea dulce como el arroz con leche; las lentejas en milanesa sí', condiciones: [{ tipo: 'forma', valor: 'granos' }], resultado: 'rechaza', declarada: false },
      { id: 'V4', texto: 'Si las comidas se tocan, aparta hasta lo que come siempre (la milanesa, el puré)', condiciones: [{ tipo: 'distribucion', valor: 'tocandose' }], resultado: 'rechaza', declarada: true },
    ],
    comidas: planValentina(),
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
  sabor_olor: 'no le gusta el olor',
  forma: 'dice que las bolitas se le escapan',
  temperatura: 'estaba muy caliente',
  se_tocaban: 'se tocaba con otra comida',
  marca: 'no era la marca de siempre',
  cantidad: 'le serví demasiado',
}
const FRASE_CONDUCTA = {
  tranquilo: 'La comida fue tranquila.',
  se_levanto: 'Se levantó varias veces de la mesa.',
  angustia: 'Se angustió y lloró un rato.',
  pidio_otra_cosa: 'Pidió su comida de siempre.',
  arcadas: 'Tuvo arcadas.',
}
const PRONOMBRE = { el: 'lo', la: 'la', los: 'los', las: 'las' }

// `nino.corto` y `nino.porMotivo` cambian cómo lo dice cada familia (la marca, el porqué); si no hay, el de siempre
const cortoDe = (nino, p) => nino.corto?.[p.id] ?? p.corto
const porMotivoDe = (nino, motivo) => nino.porMotivo?.[motivo] ?? POR_MOTIVO[motivo]

function frase(nino, p, cuanto, motivo) {
  const corto = cortoDe(nino, p)
  const pron = PRONOMBRE[corto.split(' ')[0]]
  const texto = FRASE[cuanto].replaceAll('{lo}', pron) + (motivo ? `, porque ${porMotivoDe(nino, motivo)}` : '')
  return `${corto[0].toUpperCase()}${corto.slice(1)}: ${texto}.`
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
    itemIdTmp: `i${i + 1}`, cuanto, porcion, ...(motivo && { motivo }), cita: frase(nino, P[prepId], cuanto, motivo),
  }))
  // `opciones.nota`: lo que la familia agrega en la nota de voz además de cada ítem (Valentina)
  const transcripcion = [...respuestas.map((r) => r.cita), ...conducta.map((c) => FRASE_CONDUCTA[c]), ...(opciones.nota ? [opciones.nota] : [])].join(' ')
  return {
    ninoId: nino.ninoId,
    dia,
    fechaISO: `${dia}T${opciones.hora ?? HORA[momento]}:00-03:00`,
    momento,
    ...(opciones.comentario && { comentario: opciones.comentario }),
    analisis: {
      analisisId: `sint-${nino.ninoId}-${String(n + 1).padStart(nino.comidas.length > 99 ? 3 : 2, '0')}`,
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
    relato: { transcripcion, fuente: opciones.fuente ?? 'texto' },
  }
}

function armarNino(nino) {
  const conAtributos = (id) => ({ nombre: P[id].nombre, preparacionId: id, ...(nino.marcas?.[id] && { marca: nino.marcas[id] }), atributos: P[id].atributos })
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
// Si el catálogo de la app cambió los atributos o los ingredientes de una preparación, avisar (lo observado manda en la
// minería, pero la app y los tests tienen que ver lo mismo): se corrige acá, copiando lo del catálogo
for (const p of Object.values(P)) {
  const c = CATALOGO.get(p.id)
  if (!c) continue
  const distinto = Object.keys(ATRIBUTOS).filter((k) => c.atributos?.[k] !== p.atributos[k])
  if (distinto.length) console.warn(`Aviso: ${p.id} tiene otros atributos en data/preparaciones.json (${distinto.join(', ')})`)
  if (JSON.stringify(c.ingredientes) !== JSON.stringify(p.ingredientes)) console.warn(`Aviso: ${p.id} tiene otros ingredientes en data/preparaciones.json`)
}
for (const nino of NINOS) {
  for (const corto of Object.values(nino.corto ?? {})) exigir(corto.split(' ')[0] in PRONOMBRE, `${nino.ninoId}: "${corto}" tiene que empezar con el, la, los o las`)
}

const salida = NINOS.map(armarNino)

for (const nino of salida) {
  const alergias = nino.datos.alergias
  for (const c of nino.comidas) {
    const donde = `${nino.ninoId} ${c.dia} ${c.momento}`
    exigir(c.momento in HORA, `${donde}: momento desconocido`)
    exigir(!Number.isNaN(Date.parse(c.fechaISO)), `${donde}: fecha inválida`)
    for (const x of c.conducta) exigir(CONDUCTA.includes(x) && x in FRASE_CONDUCTA, `${donde}: conducta ${x}`)
    for (const it of c.analisis.items) {
      exigir(it.preparacionId in P, `${donde}: preparación ${it.preparacionId} desconocida`)
      for (const ing of it.ingredientes) {
        const alergenos = ALIMENTOS.get(ing.alimentoId)?.alergenos ?? []
        exigir(!alergias.some((a) => ing.alimentoId.includes(a) || alergenos.includes(a)), `${donde}: ${ing.alimentoId} choca con la alergia`)
      }
      // La app usa data/preparaciones.json: la preparación tiene que estar ahí (y, si el chico es estricto, ir en esa comida)
      const enCatalogo = CATALOGO.get(it.preparacionId)
      if (CATALOGO.size) exigir(enCatalogo, `${donde}: ${it.preparacionId} no está en data/preparaciones.json`)
      if (enCatalogo && NINOS.find((n) => n.ninoId === nino.ninoId)?.estricto) {
        exigir(enCatalogo.momentos?.includes(c.momento), `${donde}: ${it.preparacionId} no va en ${c.momento} (momentos: ${enCatalogo.momentos?.join(', ')})`)
      }
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
    const contexto = { distribucion: c.analisis.distribucion.estado, plato: c.analisis.distribucion.plato, momento: c.momento }
    return { prepId: item.preparacionId, atributos: item.atributos, contexto, cuanto: r.cuanto, o: O[r.cuanto] }
  }))
  const global = media(obs.map((x) => x.o))
  console.log(`\n${nino.datos.nombre}: ${nino.comidas.length} comidas, ${obs.length} observaciones, media global ${fmt(global)}`)
  for (const regla of nino.reglasOcultas) {
    const cumple = (x) => regla.condiciones.every(({ tipo, valor }) => (x.atributos[tipo] ?? x.contexto[tipo]) === valor)
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
const preparaciones = [...usadas].sort().map((id) => ({
  id, nombre: P[id].nombre, atributos: P[id].atributos, ingredientes: P[id].ingredientes,
  ...(CATALOGO.get(id)?.momentos && { momentos: CATALOGO.get(id).momentos }),
}))
escribir('preparaciones.json', preparaciones)
escribir('indice.json', {
  _nota: 'Ids que usan los chicos sintéticos: tienen que existir en data/alimentos.json (A3) y data/preparaciones.json (B11), o renombrarse en el generador.',
  ninos: salida.map((n) => ({ ninoId: n.ninoId, nombre: n.datos.nombre, comidas: n.comidas.length, desde: n.comidas[0].dia, hasta: n.comidas.at(-1).dia })),
  preparacionIds: preparaciones.map((p) => p.id),
  alimentoIds: [...new Set(preparaciones.flatMap((p) => p.ingredientes.map((i) => i.alimentoId)))].sort(),
})
console.log(`\nEscrito en data/sinteticos/: ${salida.map((n) => `${n.ninoId}.json`).join(', ')}, preparaciones.json, indice.json`)
