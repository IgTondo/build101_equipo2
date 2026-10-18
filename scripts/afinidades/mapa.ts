// v5.10 · Ingredientes del dataset de Ahn et al. (2011) → nuestros alimentoId (data/alimentos.json). A mano y con
// criterio: solo lo que es el mismo alimento o su forma de cocina (beef es la carne y la carne picada, tomato es el
// tomate y la salsa, milk es la leche entera, descremada o deslactosada). Lo dudoso queda afuera, aunque sea frecuente:
//  - fish: en buena parte es salsa de pescado (anda con soy_sauce, ginger y scallion); cod y haddock sí son merluza.
//  - meat, vegetable, fruit, nut, seed, cereal: genéricos, no dicen cuál.
//  - buttermilk, milk_fat: no son leche ni yogur.
//  - chicken_broth, beef_broth: el caldo no es el pollo ni la carne (daría pollo–arroz por un risotto).
//  - grape_juice y tomato_juice: el primero es vino o aceto (anda con olive_oil, garlic, basil), el segundo, bebida.
//  - smoked_salmon (bagels con queso crema, no salmón), cured_pork (jamón crudo, salame o panceta: no dice cuál).
//  - cayenne (junta ají, chile y pimentón) y pepper (genérico: pimienta o ají); black_pepper sí es la pimienta.
//  - fennel: acá es sobre todo la semilla (anda con pork_sausage, tomato, basil y macaroni), no el bulbo de hinojo.
//  - soybean (tofu, miso y salsa, de cocina asiática), pecan (no es la nuez común), shiitake y porcini (no son
//    champiñones).
//  - Preparaciones del catálogo (papas_fritas, pure_papa, huevo_frito, compota_manzana, choclo_cremoso…): no combinan
//    como su ingrediente (las papas fritas no van con la zanahoria de un guiso).
// Notas: cane_molasses es el azúcar (Ahn lo representa así: anda con wheat, butter, egg y vanilla), wheat es la
// harina y macaroni la pasta seca. chicory es de ensalada (anda con olive_oil, vinegar, mustard y lettuce): radicheta.
// palm anda con avocado, corn y tomato en ensaladas latinas: palmitos. coconut es de repostería: coco rallado.
// El dataset no tiene espinaca, acelga, berenjena, chauchas, rúcula, repollo colorado, habas, quinoa, cuscús,
// granada, caqui, níspero, ciruela pasa, sardinas, corvina, lenguado, pejerrey, chía, lino, ni ricota: cottage cheese
// es lo más cercano a la ricota y es lo que usan sus lasañas.
// Para extenderlo: sumar el id al ingrediente. Si el id todavía no está en data/alimentos.json el script lo ignora (y
// lo avisa), así que se pueden dejar ids del catálogo que viene (la tanda 3, con los ids del carril de ingredientes).
export const MAPA: Record<string, readonly string[]> = {
  // Cereales, panes y almidones
  rice: ['arroz'],
  brown_rice: ['arroz_integral'],
  macaroni: ['fideos'],
  egg_noodle: ['fideos_huevo'],
  bread: ['pan_blanco'],
  white_bread: ['pan_blanco'],
  wheat_bread: ['pan_integral'],
  wheat: ['harina_trigo'],
  whole_grain_wheat_flour: ['harina_integral'],
  oat: ['avena'],
  oatmeal: ['avena'],
  corn_flake: ['cereal_fortificado'],
  corn_grit: ['polenta', 'harina_maiz'], // grits: la sémola de maíz
  corn: ['choclo'], // granos, tortillas y harina de maíz: anda con onion, tomato, cayenne y bean como el choclo
  barley: ['cebada'],
  popcorn: ['pororo'],
  potato: ['papa'],
  baked_potato: ['papa'],
  sweet_potato: ['boniato'],
  yam: ['boniato'], // en EE.UU. "yam" es casi siempre el boniato
  cassava: ['mandioca'],
  starch: ['maicena'],

  // Proteínas
  beef: ['carne_vacuna', 'carne_picada'], // ground beef también es beef
  roasted_beef: ['carne_vacuna'],
  veal: ['carne_vacuna'],
  liver: ['higado'],
  beef_liver: ['higado'],
  chicken: ['pollo', 'muslo_pollo'],
  chicken_liver: ['higado_pollo'],
  turkey: ['pavo'],
  pork: ['carne_cerdo'],
  roasted_pork: ['carne_cerdo'],
  ham: ['jamon'],
  bacon: ['panceta'],
  pork_sausage: ['chorizo'],
  frankfurter: ['salchicha'],
  lamb: ['cordero'],
  mutton: ['cordero'],
  egg: ['huevo', 'huevo_enriquecido'],
  cod: ['merluza'],
  haddock: ['merluza'],
  tuna: ['atun'],
  salmon: ['salmon'],
  mackerel: ['caballa'],
  shrimp: ['camarones'],
  prawn: ['camarones'],
  lentil: ['lentejas'],
  chickpea: ['garbanzos'],
  bean: ['porotos'], // anda con tomato, cayenne, beef y corn: los porotos (el chili), no las chauchas
  black_bean: ['porotos', 'porotos_negros'],
  kidney_bean: ['porotos', 'porotos_rojos'],
  red_kidney_bean: ['porotos', 'porotos_rojos'],
  red_bean: ['porotos', 'porotos_rojos'],
  lima_bean: ['porotos', 'porotos_manteca'],
  peanut_butter: ['pasta_mani'],

  // Verduras
  carrot: ['zanahoria'],
  pumpkin: ['zapallo'],
  squash: ['zapallo'],
  zucchini: ['zapallito'],
  broccoli: ['brocoli'],
  cauliflower: ['coliflor'],
  pea: ['arvejas'],
  tomato: ['tomate', 'salsa_tomate'], // Ahn junta el tomate fresco, el de lata y la salsa
  lettuce: ['lechuga'],
  onion: ['cebolla'],
  scallion: ['cebolla_verdeo'],
  leek: ['puerro'],
  celery: ['apio'],
  bell_pepper: ['morron', 'morron_amarillo'],
  green_bell_pepper: ['morron_verde'],
  pimento: ['morron'],
  cucumber: ['pepino'],
  beet: ['remolacha'],
  cabbage: ['repollo'], // no dice si es el colorado
  brussels_sprout: ['repollitos_bruselas'],
  kale: ['kale'],
  watercress: ['berro'],
  chicory: ['radicheta'],
  asparagus: ['esparragos'],
  artichoke: ['alcaucil'],
  mushroom: ['champinones'],
  radish: ['rabanito'],
  turnip: ['nabo'],
  palm: ['palmitos'],
  avocado: ['palta'],

  // Frutas
  banana: ['banana'],
  apple: ['manzana'],
  pear: ['pera'],
  bartlett_pear: ['pera'],
  orange: ['naranja'],
  orange_juice: ['jugo_naranja'],
  mandarin: ['mandarina'],
  tangerine: ['mandarina'],
  grapefruit: ['pomelo'],
  strawberry: ['frutilla'],
  kiwi: ['kiwi'],
  peach: ['durazno'],
  nectarine: ['pelon'],
  apricot: ['damasco'],
  plum: ['ciruela'],
  cherry: ['cereza'],
  grape: ['uva'],
  raisin: ['pasas_uva'],
  fig: ['higo'],
  blueberry: ['arandanos'],
  raspberry: ['frambuesa'],
  blackberry: ['mora'],
  watermelon: ['sandia'],
  melon: ['melon'],
  pineapple: ['anana'],
  mango: ['mango'],
  papaya: ['mamon'],
  passion_fruit: ['maracuya'],

  // Lácteos
  milk: ['leche', 'leche_vitamina_d', 'leche_descremada', 'leche_deslactosada'],
  yogurt: ['yogur', 'yogur_vitamina_d', 'yogur_natural', 'yogur_griego'],
  cream: ['crema_leche'],
  cheese: ['queso_dambo'],
  cheddar_cheese: ['queso_dambo', 'queso_cheddar'],
  swiss_cheese: ['queso_colonia'],
  mozzarella_cheese: ['queso_muzzarella'],
  parmesan_cheese: ['queso_rallado'],
  romano_cheese: ['queso_rallado'],
  cream_cheese: ['queso_crema'],
  cottage_cheese: ['ricota', 'queso_cottage'],

  // Frutos secos y semillas
  walnut: ['nueces'],
  almond: ['almendras'],
  roasted_almond: ['almendras'],
  peanut: ['mani'],
  roasted_peanut: ['mani'],
  cashew: ['castanas_caju'],
  hazelnut: ['avellanas'],
  roasted_hazelnut: ['avellanas'],
  coconut: ['coco_rallado'],
  sesame_seed: ['semillas_sesamo'],
  roasted_sesame_seed: ['semillas_sesamo'],
  black_sesame_seed: ['semillas_sesamo'],

  // Grasas, dulces y otros
  olive_oil: ['aceite_oliva'],
  vegetable_oil: ['aceite_girasol', 'aceite_canola'],
  sunflower_oil: ['aceite_girasol'],
  butter: ['manteca'],
  cane_molasses: ['azucar'],
  honey: ['miel'],
  cocoa: ['chocolate', 'cacao_azucarado', 'cacao_amargo'],
  cacao: ['chocolate'],
  potato_chip: ['papas_chips'],
  olive: ['aceitunas'],

  // Condimentos (los ids de server/ia/condimentos.ts)
  garlic: ['ajo'],
  parsley: ['perejil'],
  basil: ['albahaca'],
  oregano: ['oregano'],
  cinnamon: ['canela'],
  vanilla: ['vainilla'],
  cumin: ['comino'],
  nutmeg: ['nuez_moscada'],
  thyme: ['tomillo'],
  bay: ['laurel'],
  turmeric: ['curcuma'],
  rosemary: ['romero'],
  black_pepper: ['pimienta'],
  vinegar: ['vinagre'],
  lemon_juice: ['jugo_limon'],
  lemon: ['jugo_limon'], // el limón del catálogo es jugo_limon ("limón")
}
