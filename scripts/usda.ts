// Catálogo de alimentos desde USDA FoodData Central (PLAN.md §7 A3, §10.1).
// Uso: npx tsx scripts/usda.ts [--subir] [--solo-curado]
// Lee los CSV descargados en data/usda/{fndds,sr_legacy,foundation}/ (ignorado; ver DESCARGAS) y genera:
//  (1) data/alimentos.json: el catálogo curado (scripts/usda/curados.ts) con nutrientes reales, según MAPEO (abajo).
//  (2) data/usda/alimentos_fdc.jsonl: todos los alimentos de FNDDS + SR Legacy + Foundation en formato Alimento.
//      Con --subir y MONGODB_URI reemplaza la colección alimentos_fdc y le crea el índice de texto.
//      v5.10 · Con --solo-curado no se escribe (sale solo de los CSV, no de la tabla curada): para regenerar el
//      catálogo desde un worktree que comparte data/usda con otros.
// Sale con código 1 si algo no cierra (un id sin mapeo, un fdcId que no está, un nutriente fuera de rango).
import { createWriteStream, existsSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { esCondimento } from '../server/ia/condimentos.js'
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
  // v5.10 · Más cereales y almidones
  arroz_integral: { fdc: [2708414], porcion: 100 },           // Rice, brown, cooked, no added fat
  fideos_integrales: { fdc: [2708358], porcion: 100 },        // Pasta, whole grain, cooked
  fideos_sin_gluten: { fdc: [168900], porcion: 100 },         // Pasta, gluten-free, corn, cooked (SR)
  pan_sin_gluten: { fdc: [167597], porcion: 30, nota: 'el de FNDDS y el Schär de SR traen calcio agregado (138 y 159 mg): uno sin agregar' }, // Rudi's, Gluten-Free, Original Sandwich Bread (SR)
  cuscus: { fdc: [2708441], porcion: 100 },                   // Couscous, plain, cooked
  quinoa: { fdc: [2708400], porcion: 80 },                    // Quinoa, no added fat
  burgol: { fdc: [2708438], porcion: 80 },                    // Bulgur, no added fat
  cebada: { fdc: [170285], porcion: 60 },                     // Barley, pearled, cooked (SR): la de la sopa
  semola: { fdc: [168933], porcion: 30, nota: 'cruda: se usa como ingrediente' }, // Semolina, unenriched (SR): el Cream of wheat de FNDDS viene con hierro y calcio
  harina_maiz: { fdc: [168929], porcion: 30, nota: 'cruda: se usa como ingrediente' }, // Cornmeal, degermed, unenriched, yellow (SR): acá no se enriquece
  harina_integral: { fdc: [168893], porcion: 30, nota: 'cruda: se usa como ingrediente' }, // Wheat flour, whole-grain (SR)
  harina_arroz: { fdc: [169714], porcion: 30, nota: 'cruda: se usa como ingrediente' }, // Rice flour, white, unenriched (SR)
  maicena: { fdc: [169698], porcion: 10 },                    // Cornstarch (SR)
  salvado_avena: { fdc: [168872], porcion: 15, nota: 'crudo: se usa como ingrediente' }, // Oat bran, raw (SR)
  tortilla_trigo: { fdc: [173242], porcion: 40 },             // Tortillas, flour, without added calcium (SR): la de FNDDS trae 146 mg de calcio
  pan_arabe: { fdc: [2707616], porcion: 50 },                 // Bread, pita
  pan_hamburguesa: { fdc: [172810], porcion: 50, nota: 'el pan de hamburguesa de EE. UU. trae 211 mg de calcio agregado: el pancito casero con leche' }, // Rolls, dinner, plain, prepared from recipe, made with low fat (2%) milk (SR)
  ravioles: { fdc: [2708767], porcion: 120 },                 // Ravioli, cheese-filled, no sauce
  panqueques: { fdc: [2708342], porcion: 50 },                // Crepe, plain (supone la leche de EE. UU.: ~0,6 µg de vitamina D de más cada 100 g)
  torta_frita: { fdc: [167655], porcion: 60, nota: 'USDA no tiene torta frita: frybread (Apache), la misma masa de harina y grasa, frita' },
  mandioca: { fdc: [2709564], porcion: 100 },                 // Cassava, cooked
  papas_fritas: { fdc: [2709458], porcion: 100 },             // Potato, french fries, from fresh, fried
  pure_papa: { fdc: [2709496], porcion: 150 },                // Potato, mashed, from fresh, made with milk
  choclo_cremoso: { fdc: [2709923], porcion: 60 },            // Corn, creamed
  pororo: { fdc: [2708221], porcion: 20 },                    // Popcorn, popped in oil, no butter added
  galletas_arroz: { fdc: [2708162], porcion: 15 },            // Rice cake
  galletitas_rellenas: { fdc: [2707975], porcion: 25 },       // Cookie, vanilla sandwich (la "chocolate sandwich" trae 12 mg de hierro agregado)
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
  // v5.10 · Más carnes, pescados, huevos y legumbres
  muslo_pollo: { fdc: [2706030], porcion: 80 },               // Chicken thigh, baked, broiled, or roasted, skin not eaten, from raw
  pavo: { fdc: [2706109], porcion: 80 },                      // Turkey, light meat, roasted, skin not eaten
  higado: { fdc: [2706153], porcion: 70 },                    // Liver, beef
  higado_pollo: { fdc: [2706154], porcion: 60 },              // Liver, chicken
  asado: { fdc: [168613], porcion: 80, nota: 'asado de tira: las costillas con su grasa (braseadas en USDA; a la parrilla es parecido)' }, // Beef, rib, shortribs, separable lean and fat, cooked, braised (SR)
  carne_guiso: { fdc: [2705849], porcion: 80 },               // Beef, stew meat
  cordero: { fdc: [2705905], porcion: 80 },                   // Lamb, NS as to cut
  panceta: { fdc: [2705889], porcion: 15 },                   // Pork bacon, smoked or cured, cooked
  corvina: { fdc: [2706246], porcion: 90 },                   // Fish, croaker
  lenguado: { fdc: [2706249], porcion: 90 },                  // Fish, flounder, baked or broiled
  pejerrey: { fdc: [175147], porcion: 90, nota: 'USDA no tiene pejerrey: el eperlano (smelt), otro pescado chico de carne magra' }, // Fish, smelt, rainbow, cooked, dry heat (SR)
  sardina: { fdc: [2706293], porcion: 50 },                   // Fish, sardines, canned: en aceite y con las espinas (de ahí el calcio)
  caballa: { fdc: [2706268], porcion: 50 },                   // Fish, mackerel, canned
  camarones: { fdc: [2706363], porcion: 60 },                 // Shrimp, steamed or boiled
  huevo_revuelto: { fdc: [2707200], porcion: 60 },            // Egg omelet or scrambled egg, made with oil
  huevo_frito: { fdc: [2707158], porcion: 50 },               // Egg, whole, fried with oil
  porotos_negros: { fdc: [2707361], porcion: 60 },            // Black beans, from dried, no added fat
  porotos_rojos: { fdc: [2707381], porcion: 60 },             // Kidney beans, from dried, no added fat
  porotos_manteca: { fdc: [2707369], porcion: 60 },           // Lima beans, from dried
  porotos_soja: { fdc: [2707388], porcion: 60 },              // Soybeans, cooked
  arvejas_partidas: { fdc: [2707420], porcion: 80 },          // Split peas, from dried, no added fat
  hummus: { fdc: [2707402], porcion: 30 },                    // Hummus, plain
  tofu: { fdc: [172448], porcion: 60 },                       // Tofu, firm, prepared with calcium sulfate and magnesium chloride (SR)
  harina_garbanzo: { fdc: [174288], porcion: 30, nota: 'cruda: se usa como ingrediente (fainá)' }, // Chickpea flour (besan) (SR)
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
  // v5.10 · Más verduras
  repollo: { fdc: [2709773], porcion: 40 },                   // Cabbage, green, raw: en ensalada
  repollo_colorado: { fdc: [2709775], porcion: 40 },          // Cabbage, red, raw
  repollitos_bruselas: { fdc: [2709881], porcion: 50 },       // Brussels sprouts, fresh, cooked, no added fat
  kale: { fdc: [2709600], porcion: 50 },                      // Kale, fresh, cooked, no added fat
  rucula: { fdc: [169387], porcion: 20 },                     // Arugula, raw (SR: FNDDS no la tiene)
  berro: { fdc: [2709639], porcion: 20 },                     // Watercress, raw
  radicheta: { fdc: [169992], porcion: 20 },                  // Chicory greens, raw (SR)
  apio: { fdc: [2709778], porcion: 30 },                      // Celery, raw
  puerro: { fdc: [168426], porcion: 40 },                     // Leeks, cooked, boiled (SR): el "Leeks" de FNDDS viene con grasa
  hinojo: { fdc: [2709779], porcion: 40 },                    // Fennel bulb, raw
  berenjena: { fdc: [2709929], porcion: 60 },                 // Eggplant, cooked, no added fat
  morron_verde: { fdc: [2709800], porcion: 20 },              // Peppers, sweet, green, raw
  morron_amarillo: { fdc: [169383], porcion: 20 },            // Peppers, sweet, yellow, raw (SR)
  rabanito: { fdc: [2709803], porcion: 20 },                  // Radish
  nabo: { fdc: [2710002], porcion: 50 },                      // Turnip, cooked
  champinones: { fdc: [2709937], porcion: 40 },               // Mushrooms, fresh, cooked, no added fat
  esparragos: { fdc: [2709834], porcion: 50 },                // Asparagus, fresh, cooked, no added fat
  alcaucil: { fdc: [2709766], porcion: 60 },                  // Artichoke
  palmitos: { fdc: [168569], porcion: 40 },                   // Hearts of palm, canned (SR): el de FNDDS viene cocido con grasa
  habas: { fdc: [170378], porcion: 50 },                      // Broadbeans, immature seeds, cooked, boiled (SR): las frescas; las de FNDDS son secas
  jardinera: { fdc: [2710013], porcion: 60 },                 // Classic mixed vegetables, frozen, cooked, no added fat
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
  // v5.10 · Más frutas (crudas, salvo las secas y las listas)
  ciruela: { fdc: [2709265], porcion: 70 },
  damasco: { fdc: [2709221], porcion: 70 },                   // Apricot, raw
  pelon: { fdc: [2709245], porcion: 120 },                    // Nectarine, raw
  cereza: { fdc: [2709231], porcion: 80 },
  higo: { fdc: [2709235], porcion: 50 },
  arandanos: { fdc: [2709275], porcion: 70 },                 // Blueberries, raw
  frambuesa: { fdc: [2709281], porcion: 70 },
  mora: { fdc: [2709273], porcion: 70 },                      // Blackberries, raw
  nispero: { fdc: [169908], porcion: 60 },                    // Loquats, raw (SR)
  caqui: { fdc: [2709259], porcion: 100 },                    // Persimmon, raw
  granada: { fdc: [2709267], porcion: 50 },                   // Pomegranate, raw: los granos
  pomelo: { fdc: [2709165], porcion: 120 },                   // Grapefruit, raw
  mango: { fdc: [2709242], porcion: 100 },
  mamon: { fdc: [2709246], porcion: 100 },                    // Papaya, raw
  maracuya: { fdc: [2709248], porcion: 30 },                  // Passion fruit, raw: la pulpa de una o dos
  palta: { fdc: [2709223], porcion: 40 },                     // Avocado, raw
  pasas_uva: { fdc: [2709212], porcion: 20 },                 // Raisins
  ciruela_pasa: { fdc: [2709211], porcion: 25 },              // Prune, dried
  orejones: { fdc: [2709197], porcion: 25 },                  // Apricot, dried
  compota_manzana: { fdc: [171695], porcion: 120 },           // Applesauce, unsweetened, without added ascorbic acid (SR): la de FNDDS trae 44 mg de vitamina C agregada
  durazno_almibar: { fdc: [2709251], porcion: 120 },          // Peach, canned, in syrup
  ensalada_frutas: { fdc: [2709288], porcion: 150 },          // Fruit salad, fresh or raw, including citrus fruits, no dressing
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
  // v5.10 · Más lácteos, sin la vitamina D que agrega EE. UU. (como la leche y el yogur de arriba)
  leche_polvo: { fdc: [173454], porcion: 25 },                // Milk, dry, whole, without added vitamin D (SR): 25 g para un vaso
  leche_descremada: { fdc: [173432], porcion: 200 },          // Milk, nonfat, fluid, without added vitamin A and vitamin D (SR)
  leche_deslactosada: { fdc: [172217], porcion: 200, nota: 'la misma leche entera sin lactosa: los nutrientes no cambian (la de FNDDS viene con vitamina D)' },
  yogur_natural: { fdc: [171284], porcion: 150 },             // Yogurt, plain, whole milk (SR): el de FNDDS trae 1,2 µg de vitamina D
  yogur_frutas: { fdc: [170889], porcion: 150 },              // Yogurt, fruit, low fat (SR)
  yogur_griego: { fdc: [2705422], porcion: 120 },             // Yogurt, Greek, whole milk, plain
  queso_colonia: { fdc: [2705735], porcion: 20, nota: 'el Colonia es un queso semiduro con ojos, tipo suizo' }, // Cheese, Swiss
  queso_fresco: { fdc: [2705745], porcion: 30 },              // Queso Fresco
  queso_cheddar: { fdc: [2705709], porcion: 20 },             // Cheese, Cheddar
  queso_cottage: { fdc: [2705748], porcion: 50 },             // Cheese, cottage, creamed
  arroz_con_leche: { fdc: [2705685], porcion: 150 },          // Pudding, rice
  flan: { fdc: [167574], porcion: 100 },                      // Desserts, flan, caramel custard, prepared-from-recipe (SR): el de FNDDS supone leche con vitamina D
  postre_chocolate: { fdc: [2705694], porcion: 100 },         // Pudding, chocolate, ready-to-eat
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
  // v5.10 · Más del grupo otro
  crema_leche: { fdc: [2705597], porcion: 15 },               // Cream, heavy
  salsa_blanca: { fdc: [174542], porcion: 50 },               // Sauce, white, thin, prepared-from-recipe, with butter (SR): la de FNDDS supone leche con vitamina D
  dulce_batata: { fdc: [2710308], porcion: 30 },              // Sweet potato paste: el dulce de boniato
  aceitunas: { fdc: [2710089], porcion: 15 },                 // Olives, green
  barra_cereal: { fdc: [2708101], porcion: 25 },              // Cereal or Granola bar, NFS
  jugo_envasado: { fdc: [2709340], porcion: 200 },            // Fruit nectar, NFS
  refresco: { fdc: [2710541], porcion: 200 },                 // Soft drink, cola
  // v5.10 · Frutos secos y semillas: de a puñado o espolvoreados
  mani: { fdc: [2707516], porcion: 20 },                      // Peanuts, roasted, unsalted
  nueces: { fdc: [2707531], porcion: 15 },                    // Walnuts
  almendras: { fdc: [2707485], porcion: 15 },                 // Almonds, NFS
  castanas_caju: { fdc: [2707493], porcion: 15 },             // Cashews, NFS
  avellanas: { fdc: [2707502], porcion: 15 },                 // Hazelnuts
  coco_rallado: { fdc: [170170], porcion: 10 },               // Nuts, coconut meat, dried (desiccated), not sweetened (SR)
  semillas_chia: { fdc: [2707590], porcion: 10 },             // Chia seeds
  semillas_lino: { fdc: [2707588], porcion: 10 },             // Flax seeds
  semillas_girasol: { fdc: [2707582], porcion: 10 },          // Sunflower seeds, plain, unsalted
  semillas_sesamo: { fdc: [2707586], porcion: 5 },            // Sesame seeds: el pelado, 60 mg de calcio (el entero de SR tiene 975)
  semillas_zapallo: { fdc: [2707581], porcion: 10 },          // Pumpkin seeds, unsalted
  // v5.10 · Condimentos y hierbas (server/ia/condimentos.ts), con lo que lleva un plato para un chico. Frescas las que
  // acá se usan frescas (perejil, albahaca, romero, verdeo); secas las de frasco (SR "Spices, …": FNDDS no las tiene)
  oregano: { fdc: [171328], porcion: 1 },                     // Spices, oregano, dried
  pimenton: { fdc: [171329], porcion: 1 },                    // Spices, paprika
  comino: { fdc: [170923], porcion: 1 },                      // Spices, cumin seed
  perejil: { fdc: [2709796, 170416], porcion: 5 },            // Parsley, raw
  albahaca: { fdc: [2709780, 172232], porcion: 3 },           // Basil, raw
  ajo: { fdc: [2709786], porcion: 5 },                        // Garlic, raw: un diente
  cebolla_verdeo: { fdc: [2709794], porcion: 10 },            // Onions, green, raw
  nuez_moscada: { fdc: [171326], porcion: 1 },                // Spices, nutmeg, ground
  canela: { fdc: [171320], porcion: 1 },                      // Spices, cinnamon, ground
  vainilla: { fdc: [172236], porcion: 2 },                    // Vanilla extract, imitation, no alcohol: la esencia de acá
  tomillo: { fdc: [170938], porcion: 1 },                     // Spices, thyme, dried
  laurel: { fdc: [170917], porcion: 1 },                      // Spices, bay leaf
  jugo_limon: { fdc: [2709181, 167747], porcion: 10 },        // Lemon juice, 100%, freshly squeezed
  curcuma: { fdc: [172231], porcion: 1 },                     // Spices, turmeric, ground
  romero: { fdc: [173473], porcion: 2 },                      // Rosemary, fresh (SR)
  pimienta: { fdc: [170931], porcion: 1 },                    // Spices, pepper, black
  vinagre: { fdc: [2709351], porcion: 10 },
  cacao_amargo: { fdc: [2705587, 169593], porcion: 5 },       // Cocoa powder, not reconstituted: sin azúcar, para repostería
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
  // v5.10 · Sin los condimentos: un "otro alimento" del plato no es una especia (le subían el calcio y el hierro)
  const genericos = GRUPO.map((g): Alimento => {
    const delGrupo = curados.filter((a) => a.grupo === g && !esCondimento(a.id))
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

// Topes cada 100 g para detectar unidades mal leídas (µg por mg, kJ por kcal): ningún curado se les acerca.
// v5.10 · B12 hasta 100 (el hígado vacuno tiene 82 µg) y omega-3 hasta 25 (las semillas de lino, 19 g). Los condimentos
// secos concentran (tomillo: 1890 mg de calcio y 124 mg de hierro; canela: 53 g de fibra) y tienen su propio tope.
const TOPE: Nutrientes = {
  energia_kcal: 900, proteina_g: 100, calcio_mg: 1500, vitamina_d_ug: 50, hierro_mg: 60, fibra_g: 50, omega3_g: 25, b12_ug: 100, vitamina_c_mg: 200,
}
const TOPE_CONDIMENTO: Nutrientes = { ...TOPE, calcio_mg: 2500, hierro_mg: 150, fibra_g: 70 }

function controlar(lista: Alimento[]): void {
  for (const a of lista) {
    const tope = esCondimento(a.id) ? TOPE_CONDIMENTO : TOPE
    for (const n of NUTRIENTE) {
      const x = a.por100g[n]
      if (!Number.isFinite(x) || x < 0 || x > tope[n]) fallar(`${a.id}: ${n} = ${x} fuera de rango`)
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
    const db = cliente.db(process.env.MONGODB_DB || 'nibble') // la misma base que lee B (server/datos/mongo.ts)
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

  if (process.argv.includes('--solo-curado')) return // v5.10
  const todos = [...foods.values()].map((f) => aAlimentoFdc(f, nutrientes.get(f.fdcId), porciones.get(f.fdcId) ?? []))
  const salida = createWriteStream(SALIDA_FDC)
  for (const a of todos) salida.write(JSON.stringify(a) + '\n')
  await new Promise<void>((ok, mal) => salida.on('error', mal).end(ok))
  const porGrupo = Object.fromEntries(GRUPO.map((g) => [g, todos.filter((a) => a.grupo === g).length]))
  console.log(`usda: ${SALIDA_FDC}: ${todos.length} alimentos ${JSON.stringify(porGrupo)}`)

  if (process.argv.includes('--subir')) await subir(todos)
}

main().catch((e: unknown) => fallar(e instanceof Error ? e.stack ?? e.message : String(e)))
