// Catálogo de alimentos desde USDA FoodData Central (PLAN.md §7 A3, §10.1).
// Uso: npx tsx scripts/usda.ts [--subir]
// Lee los CSV descargados en data/usda/{fndds,sr_legacy,foundation}/ (ignorado; ver DESCARGAS) y genera:
//  (1) data/alimentos.json: el catálogo curado (scripts/usda/curados.ts) con nutrientes reales, según MAPEO (abajo).
//  (2) data/usda/alimentos_fdc.jsonl: todos los alimentos de FNDDS + SR Legacy + Foundation en formato Alimento.
//      Con --subir y MONGODB_URI reemplaza la colección alimentos_fdc y le crea el índice de texto.
// Sale con código 1 si algo no cierra (un id sin mapeo, un fdcId que no está, un nutriente fuera de rango).
import { createWriteStream, existsSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ALERGENO, GRUPO, NUTRIENTE, type Alergeno, type Alimento, type Nutrientes } from '../shared/contratos.js'
import { CURADOS, NOMBRE_GENERICO } from './usda/curados.js'
import { filasCsv } from './usda/csv.js'
import {
  aAlimentoFdc, aNutrientes, aPorcion, controlarUnidades, DATASET_DE_TIPO, elegirFdc, fortificar, juntarNutrientes, juntarPorciones,
  mediana, nutrientesMediana, PRIORIDAD, traductorNutrientes, type AlimentoFdc, type Crudos, type Dataset, type Porcion,
} from './usda/logica.js'

// Zips de https://fdc.nal.usda.gov/download-datasets/ (dominio público, sin key). Cada uno se descomprime en
// data/usda/<dataset>/ con los CSV sueltos (sin la carpeta del zip).
const DESCARGAS: Record<Dataset, string> = {
  fndds: 'https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_survey_food_csv_2024-10-31.zip', // FNDDS 2021–2023
  sr_legacy: 'https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip',
  foundation: 'https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_foundation_food_csv_2026-04-30.zip',
}

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const USDA = join(RAIZ, 'data', 'usda')
const SALIDA_CURADO = join(RAIZ, 'data', 'alimentos.json')
const SALIDA_FDC = join(USDA, 'alimentos_fdc.jsonl')

// ---------- Mapeo id curado → fdcId, elegido a mano ----------
// fdc: candidatos; gana el de mejor dataset (FNDDS → SR Legacy → Foundation). porcion: gramos de una porción razonable
// para un chico de 4 a 10 años (cocido, como se sirve). Cuando USDA no tiene el alimento, el más parecido, con nota.
type Mapeo = { fdc: number[]; porcion: number; nota?: string } | { base: string; agregado: Partial<Nutrientes>; porcion: number; nota: string }

// Fortificados. Leche y yogur con vitamina D están en SR Legacy como par exacto del común (mismo alimento, solo cambia
// la fortificación), y el cereal de maíz de FNDDS ya viene fortificado. El único sin equivalente es el huevo enriquecido
// (fuente 'equipo', fdcId null): el huevo de FNDDS + el agregado típico de etiqueta. Gallinas con lino y D3 en la dieta:
// +0,5 g de omega-3 y +2,5 µg de vitamina D cada 100 g, o sea ~250 mg y ~1,25 µg más por huevo de 50 g, la parte baja
// de lo que declaran los huevos "omega 3".
// Ojo con FNDDS: supone los panes, yogures y postres de EE. UU., que vienen con calcio o vitamina D agregados. Donde eso
// infla un nutriente que en Uruguay no viene, se elige otro (comentado en cada caso).
const MAPEO: Record<string, Mapeo> = {
  // Cereales, panes, pastas y tubérculos
  arroz: { fdc: [2708408], porcion: 100 },                    // Rice, white, cooked, no added fat
  fideos: { fdc: [2708357], porcion: 100 },                   // Pasta, cooked
  fideos_huevo: { fdc: [2708352], porcion: 100 },             // Noodles, cooked
  noquis: { fdc: [2708722], porcion: 120 },                   // Gnocchi, potato
  pan_blanco: { fdc: [2707610], porcion: 30 },                // Bread, French or Vienna: el pan flauta ("Bread, white" trae 211 mg de calcio agregado)
  pan_integral: { fdc: [2707711], porcion: 30 },              // Bread, whole wheat, made from home recipe or purchased at bakery (el de molde trae calcio agregado)
  pan_rallado: { fdc: [174928], porcion: 15 },                // Bread, crumbs, dry, grated, plain (SR)
  galletitas_agua: { fdc: [2708167, 172746], porcion: 20 },   // Crackers, saltine ("Crackers, water" trae calcio y hierro en 0 sin marcar)
  galletitas_integrales: { fdc: [172749], porcion: 20 },      // Crackers, whole-wheat (SR)
  galletitas_dulces: { fdc: [2707970], porcion: 20 },         // Cookie, butter or sugar ("Marie biscuit" trae calcio y hierro en 0 sin marcar)
  galletitas_avena: { fdc: [2707945], porcion: 25 },          // Cookie, oatmeal
  grisines: { fdc: [2707690], porcion: 15 },                  // Breadsticks, hard, NFS
  avena: { fdc: [173904], porcion: 30, nota: 'cruda: se usa como ingrediente' }, // Cereals, oats, regular and quick, not fortified, dry (SR)
  cereal_fortificado: { fdc: [2708453], porcion: 30 },        // Cereal, corn flakes, plain (fortificado, como en EE. UU.)
  harina_trigo: { fdc: [168894], porcion: 30, nota: 'enriquecida: en Uruguay la harina de trigo se fortifica con hierro' },
  polenta: { fdc: [2708374], porcion: 150 },                  // Cornmeal mush, no added fat: polenta cocida
  papa: { fdc: [2709388, 170440], porcion: 120 },             // Potato, boiled, from fresh, peel not eaten, no added fat
  boniato: { fdc: [2709702, 168484], porcion: 100 },          // Sweet potato, boiled, no added fat
  choclo: { fdc: [2709910], porcion: 60 },                    // Corn, fresh, cooked, no added fat
  prepizza: { fdc: [2707612], porcion: 80, nota: 'USDA no tiene prepizza: focaccia lisa, la masa horneada más parecida' },
  medialuna: { fdc: [2707678], porcion: 40 },                 // Croissant
  // Carnes, pescados, huevos y legumbres
  carne_vacuna: { fdc: [2705824], porcion: 80 },              // Beef, steak, NFS
  carne_picada: { fdc: [2705854], porcion: 80 },              // Beef, ground
  pollo: { fdc: [2705956], porcion: 80 },                     // Chicken breast, baked, broiled, or roasted, skin not eaten, from raw
  nuggets_pollo: { fdc: [2706096], porcion: 80 },             // Chicken nuggets, from frozen
  hamburguesa_comercial: { fdc: [169447], porcion: 70 },      // Beef, ground, patties, frozen, cooked, broiled (SR): la congelada de paquete
  carne_cerdo: { fdc: [2705866], porcion: 80 },               // Pork, chop, NS as to fat eaten
  salchicha: { fdc: [2706166], porcion: 45 },                 // Hot dog, NFS
  jamon: { fdc: [2706206], porcion: 20 },                     // Ham, prepackaged or deli, luncheon meat
  chorizo: { fdc: [2706179], porcion: 50 },                   // Chorizo
  huevo: { fdc: [2707154], porcion: 50 },                     // Egg, whole, boiled or poached
  huevo_enriquecido: { base: 'huevo', agregado: { omega3_g: 0.5, vitamina_d_ug: 2.5 }, porcion: 50, nota: 'huevo + agregado de etiqueta (arriba)' },
  merluza: { fdc: [2706313, 175161], porcion: 90, nota: 'whiting = Merluccius bilinearis, una merluza' }, // Fish, whiting, baked or broiled
  palitos_pescado: { fdc: [2706231, 174195], porcion: 75 },   // Fish, stick
  atun: { fdc: [2706311, 171986], porcion: 50 },              // Fish, tuna, canned: son los valores del atún light al agua de Foundation (334194)
  salmon: { fdc: [2706286], porcion: 80 },                    // Fish, salmon, baked or broiled
  lentejas: { fdc: [2707425, 172421], porcion: 80 },          // Lentils, from dried, no added fat
  garbanzos: { fdc: [2707416, 173757], porcion: 60 },         // Chickpeas, from dried, no added fat
  porotos: { fdc: [2707355], porcion: 60 },                   // White beans, from dried, no added fat
  pasta_mani: { fdc: [2707537], porcion: 16 },                // Peanut butter
  // Verduras (cocidas sin grasa las que se comen cocidas)
  zanahoria: { fdc: [2709664, 170394], porcion: 50 },         // Carrots, fresh, cooked, no added fat
  zapallo: { fdc: [2709692, 168449], porcion: 80 },           // Pumpkin, cooked
  zapallito: { fdc: [2709991], porcion: 60 },                 // Summer squash, yellow or green, fresh, cooked, no added fat
  brocoli: { fdc: [2709645, 169967], porcion: 50 },           // Broccoli, fresh, cooked, no added fat
  chauchas: { fdc: [2709852], porcion: 50 },                  // Green beans, fresh, cooked, no added fat
  arvejas: { fdc: [2709960], porcion: 50 },                   // Green peas, frozen, cooked, no added fat
  tomate: { fdc: [2709719], porcion: 60 },                    // Tomatoes, raw
  salsa_tomate: { fdc: [170054], porcion: 40 },               // Tomato products, canned, sauce (SR): el FNDDS solo tiene salsas con carne o "for use with vegetables"
  lechuga: { fdc: [2709789], porcion: 20 },                   // Lettuce, raw
  espinaca: { fdc: [2709615, 168463], porcion: 50 },          // Spinach, fresh, cooked, no added fat
  acelga: { fdc: [2709575, 170401], porcion: 50 },            // Chard, cooked
  cebolla: { fdc: [2709795], porcion: 20 },                   // Onions, raw
  morron: { fdc: [2709801], porcion: 20 },                    // Peppers, sweet, red, raw
  pepino: { fdc: [2709784], porcion: 40 },                    // Cucumber, raw
  coliflor: { fdc: [2709897], porcion: 50 },                  // Cauliflower, fresh, cooked, no added fat
  remolacha: { fdc: [2709872, 169146], porcion: 50 },         // Beets, fresh, cooked, no added fat
  // Frutas (crudas)
  banana: { fdc: [2709224], porcion: 100 },
  manzana: { fdc: [2709215], porcion: 120 },
  pera: { fdc: [2709254], porcion: 120 },
  naranja: { fdc: [2709171], porcion: 130 },
  jugo_naranja: { fdc: [2709187], porcion: 200 },             // Orange juice, 100%, freshly squeezed
  mandarina: { fdc: [2709175], porcion: 80 },                 // Tangerine, raw
  frutilla: { fdc: [2709283], porcion: 100 },
  kiwi: { fdc: [2709239], porcion: 70 },
  durazno: { fdc: [2709249], porcion: 120 },
  uva: { fdc: [2709237], porcion: 80 },
  sandia: { fdc: [2709270], porcion: 150 },
  melon: { fdc: [2709226], porcion: 120 },                    // Cantaloupe, raw
  anana: { fdc: [2709260], porcion: 100 },
  // Lácteos. La leche común de Uruguay no viene con vitamina D: la base es la de SR sin vitaminas agregadas y la
  // fortificada es su par de SR con vitamina D (el mismo alimento, solo cambia la fortificación).
  leche: { fdc: [172217], porcion: 200 },                     // Milk, whole, 3.25% milkfat, without added vitamin A and vitamin D (SR)
  leche_vitamina_d: { fdc: [171265], porcion: 200 },          // Milk, whole, 3.25% milkfat, with added vitamin D (SR)
  yogur: { fdc: [170888], porcion: 150 },                     // Yogurt, vanilla, low fat (SR): los yogures de FNDDS traen 1,2 µg de vitamina D agregada
  yogur_vitamina_d: { fdc: [172219], porcion: 150 },          // Yogurt, vanilla, low fat, fortified with vitamin D (SR)
  yogur_bebible: { fdc: [170888], porcion: 200, nota: 'el "Yogurt, liquid" de FNDDS viene con vitamina D: mismo yogur de vainilla' },
  queso_dambo: { fdc: [2705717], porcion: 20, nota: 'el dambo (danbo) es un queso semiduro tipo gouda' }, // Cheese, Gouda or Edam
  queso_muzzarella: { fdc: [2705722], porcion: 30 },          // Cheese, Mozzarella, NFS
  queso_rallado: { fdc: [2705728], porcion: 10 },             // Cheese, Parmesan, dry grated
  queso_crema: { fdc: [2705760], porcion: 20 },               // Cream cheese, regular, plain
  ricota: { fdc: [2705750], porcion: 40 },                    // Cheese, Ricotta
  helado: { fdc: [2705630], porcion: 70 },                    // Ice cream, vanilla
  postre_lacteo: { fdc: [168785], porcion: 100 },             // Puddings, vanilla, dry mix, instant, prepared with whole milk (SR): el listo de EE. UU. tiene la mitad de calcio
  // Otros
  aceite_girasol: { fdc: [2710192, 171025], porcion: 5 },     // Sunflower oil
  aceite_canola: { fdc: [2710188, 172336], porcion: 5 },      // Canola oil
  aceite_oliva: { fdc: [2710186, 171413], porcion: 5 },       // Olive oil
  manteca: { fdc: [2710155], porcion: 5 },                    // Butter, stick
  azucar: { fdc: [2710258], porcion: 10 },                    // Sugar, white, granulated or lump
  cacao_azucarado: { fdc: [174122], porcion: 15 },            // Beverages, Cocoa mix, powder (SR): el de FNDDS viene fortificado (455 mg de calcio)
  dulce_de_leche: { fdc: [2705699, 173461], porcion: 20 },    // Dulce de leche
  alfajor: { fdc: [172719], porcion: 50, nota: 'USDA no tiene alfajor: galletita sándwich con relleno bañada en chocolate (SR)' },
  mermelada: { fdc: [2710301], porcion: 15 },                 // Jam
  mayonesa: { fdc: [2710204], porcion: 10 },                  // Mayonnaise, regular
  ketchup: { fdc: [2709733], porcion: 10 },
  papas_chips: { fdc: [2709422], porcion: 25 },               // Potato chips, plain
  chocolate: { fdc: [167587], porcion: 25 },                  // Candies, milk chocolate (SR): el FNDDS no distingue chocolate con leche
  miel: { fdc: [2710281], porcion: 10 },
  bizcochuelo: { fdc: [2707886], porcion: 50 },               // Cake, sponge
}

// ---------- Lectura de los CSV ----------
const ruta = (d: Dataset, archivo: string) => join(USDA, d, `${archivo}.csv`)

async function mapaCsv(archivo: string, clave: string, valor: string): Promise<Map<string, string>> {
  const m = new Map<string, string>()
  for await (const f of filasCsv(archivo)) m.set(f[clave] ?? '', f[valor] ?? '')
  return m
}

async function leerDataset(d: Dataset) {
  const categorias = d === 'fndds'
    ? await mapaCsv(ruta(d, 'wweia_food_category'), 'wweia_food_category', 'wweia_food_category_description')
    : await mapaCsv(ruta(d, 'food_category'), 'id', 'description')
  const foods = new Map<number, AlimentoFdc>()
  for await (const f of filasCsv(ruta(d, 'food'))) {
    if (DATASET_DE_TIPO[f.data_type ?? ''] !== d) continue // Foundation trae también muestras y sub-muestras
    const fdcId = Number(f.fdc_id)
    foods.set(fdcId, { fdcId, descripcion: f.description?.trim() ?? '', dataset: d, categoria: categorias.get(f.food_category_id ?? '') ?? '' })
  }
  const ids = new Set(foods.keys())
  const filasNutrient = []
  for await (const f of filasCsv(ruta(d, 'nutrient'))) filasNutrient.push(f)
  const problemas = controlarUnidades(filasNutrient)
  if (problemas.length) fallar(`${d}: unidades inesperadas en nutrient.csv: ${problemas.join('; ')}`)
  const nutrientes = await juntarNutrientes(filasCsv(ruta(d, 'food_nutrient')), ids, traductorNutrientes(filasNutrient))
  const unidades = await mapaCsv(ruta(d, 'measure_unit'), 'id', 'name')
  const porciones = new Map<number, Porcion[]>()
  for await (const f of filasCsv(ruta(d, 'food_portion'))) {
    const fdcId = Number(f.fdc_id)
    const p = ids.has(fdcId) ? aPorcion(f, unidades) : null
    if (!p) continue
    const lista = porciones.get(fdcId)
    if (lista) lista.push(p)
    else porciones.set(fdcId, [p])
  }
  for (const [fdcId, lista] of porciones) porciones.set(fdcId, juntarPorciones(lista))
  return { foods, nutrientes, porciones }
}

// ---------- Armado ----------
function fallar(mensaje: string): never {
  console.error(`usda: ${mensaje}`)
  process.exit(1)
}

function curar(foods: Map<number, AlimentoFdc>, nutrientes: Map<number, Crudos>, porciones: Map<number, Porcion[]>): Alimento[] {
  const sinMapeo = CURADOS.filter((c) => !MAPEO[c.id]).map((c) => c.id)
  const deMas = Object.keys(MAPEO).filter((id) => !CURADOS.some((c) => c.id === id))
  if (sinMapeo.length || deMas.length) fallar(`MAPEO no coincide con CURADOS: faltan [${sinMapeo}], sobran [${deMas}]`)

  const porId = new Map<string, Alimento>()
  for (const pasada of ['usda', 'equipo'] as const) { // los fortificados se arman después de su base
    for (const c of CURADOS) {
      const m = MAPEO[c.id]
      const identidad = { id: c.id, nombre: c.nombre, alias: c.alias, grupo: c.grupo, alergenos: c.alergenos }
      if ('fdc' in m && pasada === 'usda') {
        const fdcId = elegirFdc(m.fdc, (id) => foods.get(id)?.dataset) ?? fallar(`${c.id}: ninguno de los fdcId [${m.fdc}] está en los CSV`)
        const { por100g, faltantes } = aNutrientes(nutrientes.get(fdcId) ?? new Map())
        const ps = porciones.get(fdcId) ?? []
        porId.set(c.id, {
          ...identidad, fdcId, dataset: foods.get(fdcId)!.dataset, fuente: 'USDA', porcionMedianaG: m.porcion, por100g,
          ...(faltantes.length ? { faltantes } : {}), ...(ps.length ? { porciones: ps } : {}),
        })
      } else if ('base' in m && pasada === 'equipo') {
        const base = porId.get(m.base) ?? fallar(`${c.id}: la base ${m.base} no está`)
        porId.set(c.id, {
          ...identidad, fdcId: null, fuente: 'equipo', porcionMedianaG: m.porcion, ...fortificar(base, m.agregado),
          ...(base.porciones ? { porciones: base.porciones } : {}),
        })
      }
    }
  }
  const curados = CURADOS.map((c) => porId.get(c.id)!)

  // Genéricos otro_<grupo>: mediana de los curados del grupo; alérgenos, la unión (un "otro" puede ser cualquiera de ellos)
  const genericos = GRUPO.map((g): Alimento => {
    const delGrupo = curados.filter((a) => a.grupo === g)
    const alergenos = new Set<Alergeno>(delGrupo.flatMap((a) => a.alergenos))
    if (g === 'proteina') alergenos.add('mariscos')
    return {
      id: `otro_${g}`, nombre: NOMBRE_GENERICO[g], alias: [], grupo: g, alergenos: ALERGENO.filter((a) => alergenos.has(a)),
      fdcId: null, fuente: 'equipo', porcionMedianaG: Math.round(mediana(delGrupo.map((a) => a.porcionMedianaG))),
      por100g: nutrientesMediana(delGrupo),
    }
  })
  return [...curados, ...genericos]
}

// Topes cada 100 g para detectar unidades mal leídas (µg por mg, kJ por kcal): ningún curado se les acerca
const TOPE: Nutrientes = {
  energia_kcal: 900, proteina_g: 100, calcio_mg: 1500, vitamina_d_ug: 50, hierro_mg: 60, fibra_g: 50, omega3_g: 15, b12_ug: 50, vitamina_c_mg: 200,
}

function controlar(lista: Alimento[]): void {
  for (const a of lista) {
    for (const n of NUTRIENTE) {
      const x = a.por100g[n]
      if (!Number.isFinite(x) || x < 0 || x > TOPE[n]) fallar(`${a.id}: ${n} = ${x} fuera de rango`)
    }
    if (!(a.porcionMedianaG > 0)) fallar(`${a.id}: porcionMedianaG inválida`)
  }
}

async function subir(docs: Alimento[]): Promise<void> {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    console.warn(`usda: sin MONGODB_URI no subo alimentos_fdc (quedó en ${SALIDA_FDC})`)
    return
  }
  const { MongoClient } = await import('mongodb')
  const cliente = new MongoClient(uri)
  try {
    const db = cliente.db(process.env.MONGODB_DB) // sin MONGODB_DB, la base de la URI
    if (await db.listCollections({ name: 'alimentos_fdc' }).hasNext()) await db.collection('alimentos_fdc').drop()
    const col = db.collection<Alimento & { _id: string }>('alimentos_fdc')
    for (let i = 0; i < docs.length; i += 1000) await col.insertMany(docs.slice(i, i + 1000).map((a) => ({ _id: a.id, ...a })))
    await col.createIndex({ nombre: 'text', alias: 'text' }, { name: 'texto_nombre_alias' })
    console.log(`usda: alimentos_fdc reemplazada en Mongo (${docs.length} documentos + índice de texto)`)
  } finally {
    await cliente.close()
  }
}

async function main(): Promise<void> {
  for (const d of PRIORIDAD) if (!existsSync(ruta(d, 'food'))) fallar(`falta ${ruta(d, 'food')}: bajá y descomprimí ${DESCARGAS[d]}`)

  const foods = new Map<number, AlimentoFdc>()
  const nutrientes = new Map<number, Crudos>()
  const porciones = new Map<number, Porcion[]>()
  for (const d of PRIORIDAD) {
    const r = await leerDataset(d)
    for (const [k, v] of r.foods) foods.set(k, v)
    for (const [k, v] of r.nutrientes) nutrientes.set(k, v)
    for (const [k, v] of r.porciones) porciones.set(k, v)
    console.log(`usda: ${d}: ${r.foods.size} alimentos, ${r.nutrientes.size} con nutrientes, ${r.porciones.size} con porciones`)
  }

  const catalogo = curar(foods, nutrientes, porciones)
  controlar(catalogo)
  writeFileSync(SALIDA_CURADO, JSON.stringify(catalogo, null, 2) + '\n')
  const conFaltantes = catalogo.filter((a) => a.faltantes?.length)
  console.log(`usda: ${SALIDA_CURADO}: ${catalogo.length} alimentos (${conFaltantes.length} con faltantes)`)
  for (const a of conFaltantes) console.log(`  ${a.id} (${a.dataset} ${a.fdcId}): sin ${a.faltantes!.join(', ')}`)

  const todos = [...foods.values()].map((f) => aAlimentoFdc(f, nutrientes.get(f.fdcId), porciones.get(f.fdcId) ?? []))
  const salida = createWriteStream(SALIDA_FDC)
  for (const a of todos) salida.write(JSON.stringify(a) + '\n')
  await new Promise<void>((ok, mal) => salida.on('error', mal).end(ok))
  const porGrupo = Object.fromEntries(GRUPO.map((g) => [g, todos.filter((a) => a.grupo === g).length]))
  console.log(`usda: ${SALIDA_FDC}: ${todos.length} alimentos ${JSON.stringify(porGrupo)}`)

  if (process.argv.includes('--subir')) await subir(todos)
}

main().catch((e: unknown) => fallar(e instanceof Error ? e.stack ?? e.message : String(e)))
