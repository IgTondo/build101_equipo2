// v5.10 · Ingredientes del dataset de Ahn et al. (2011) → nuestros alimentoId (data/alimentos.json). A mano y con
// criterio: solo lo que es el mismo alimento o su forma de cocina (beef es la carne y la carne picada, tomato es el
// tomate y la salsa). Lo dudoso queda afuera, aunque sea frecuente:
//  - fish: en buena parte es salsa de pescado (anda con soy_sauce, ginger y scallion); cod y haddock sí son merluza.
//  - meat, vegetable, fruit, nut, seed, cereal: genéricos, no dicen cuál.
//  - cream, buttermilk, milk_fat: no son leche ni yogur (cream va a crema_leche si el catálogo la suma).
//  - chicken_broth, beef_broth: el caldo no es el pollo ni la carne (daría pollo–arroz por un risotto).
//  - grape_juice y tomato_juice: el primero es vino o aceto (anda con olive_oil, garlic, basil), el segundo, bebida.
//  - turkey (no es pollo), smoked_salmon (bagels con queso crema, no salmón), cured_pork (jamón crudo, panceta).
//  - cayenne (junta ají, chile y pimentón) y pepper (genérico: pimienta o ají); black_pepper sí es la pimienta.
// Notas: cane_molasses es el azúcar (Ahn lo representa así: anda con wheat, butter, egg y vanilla), wheat es la
// harina y macaroni la pasta seca. El dataset no tiene espinaca, acelga, chauchas (green beans) ni ricota: cottage
// cheese es lo más cercano a la ricota y es lo que usan sus lasañas.
// Para extenderlo: sumar el id al ingrediente. Si el id todavía no está en data/alimentos.json el script lo ignora (y
// lo avisa), así que se pueden dejar ids del catálogo que viene; abajo de todo hay un bloque con esos.
export const MAPA: Record<string, readonly string[]> = {
  // Cereales, panes y almidones
  rice: ['arroz'],
  brown_rice: ['arroz'],
  macaroni: ['fideos'],
  egg_noodle: ['fideos_huevo'],
  bread: ['pan_blanco'],
  white_bread: ['pan_blanco'],
  wheat_bread: ['pan_integral'],
  wheat: ['harina_trigo'],
  whole_grain_wheat_flour: ['harina_trigo'],
  oat: ['avena'],
  oatmeal: ['avena'],
  corn_flake: ['cereal_fortificado'],
  corn_grit: ['polenta'],
  corn: ['choclo'], // granos, tortillas y harina de maíz: anda con onion, tomato, cayenne y bean como el choclo
  potato: ['papa'],
  baked_potato: ['papa'],
  sweet_potato: ['boniato'],
  yam: ['boniato'], // en EE.UU. "yam" es casi siempre el boniato

  // Proteínas
  beef: ['carne_vacuna', 'carne_picada'], // ground beef también es beef
  roasted_beef: ['carne_vacuna'],
  veal: ['carne_vacuna'],
  chicken: ['pollo'],
  pork: ['carne_cerdo'],
  roasted_pork: ['carne_cerdo'],
  ham: ['jamon'],
  pork_sausage: ['chorizo'],
  frankfurter: ['salchicha'],
  egg: ['huevo', 'huevo_enriquecido'],
  cod: ['merluza'],
  haddock: ['merluza'],
  tuna: ['atun'],
  salmon: ['salmon'],
  lentil: ['lentejas'],
  chickpea: ['garbanzos'],
  bean: ['porotos'], // anda con tomato, cayenne, beef y corn: los porotos (el chili), no las chauchas
  black_bean: ['porotos'],
  kidney_bean: ['porotos'],
  red_kidney_bean: ['porotos'],
  red_bean: ['porotos'],
  lima_bean: ['porotos'],
  peanut_butter: ['pasta_mani'],

  // Verduras
  carrot: ['zanahoria'],
  pumpkin: ['zapallo'],
  squash: ['zapallo'],
  zucchini: ['zapallito'],
  broccoli: ['brocoli'],
  pea: ['arvejas'],
  tomato: ['tomate', 'salsa_tomate'], // Ahn junta el tomate fresco, el de lata y la salsa
  lettuce: ['lechuga'],
  onion: ['cebolla'],
  bell_pepper: ['morron'],
  green_bell_pepper: ['morron'],
  pimento: ['morron'],
  cucumber: ['pepino'],
  cauliflower: ['coliflor'],
  beet: ['remolacha'],

  // Frutas
  banana: ['banana'],
  apple: ['manzana'],
  pear: ['pera'],
  bartlett_pear: ['pera'],
  orange: ['naranja'],
  orange_juice: ['jugo_naranja'],
  mandarin: ['mandarina'],
  tangerine: ['mandarina'],
  strawberry: ['frutilla'],
  kiwi: ['kiwi'],
  peach: ['durazno'],
  nectarine: ['durazno'],
  grape: ['uva'],
  watermelon: ['sandia'],
  melon: ['melon'],
  pineapple: ['anana'],

  // Lácteos
  milk: ['leche', 'leche_vitamina_d'],
  yogurt: ['yogur', 'yogur_vitamina_d'],
  cheese: ['queso_dambo'],
  cheddar_cheese: ['queso_dambo', 'queso_cheddar'],
  mozzarella_cheese: ['queso_muzzarella'],
  parmesan_cheese: ['queso_rallado'],
  romano_cheese: ['queso_rallado'],
  cream_cheese: ['queso_crema'],
  cottage_cheese: ['ricota'],

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

  // Del catálogo que viene (carril de ingredientes): se ignoran hasta que el id exista. Los condimentos, con los ids de
  // server/ia/condimentos.ts de ese carril.
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
  lemon: ['limon'],
  avocado: ['palta'],
  mushroom: ['champinon'],
  celery: ['apio'],
  cabbage: ['repollo'],
  leek: ['puerro'],
  scallion: ['cebolla_verdeo'],
  cream: ['crema_leche'],
  bacon: ['panceta'],
  turkey: ['pavo'],
  lamb: ['cordero'],
  shrimp: ['camarones'],
  walnut: ['nueces'],
  almond: ['almendras'],
  peanut: ['mani'],
  coconut: ['coco'],
  raisin: ['pasas'],
  olive: ['aceitunas'],
  blueberry: ['arandanos'],
  raspberry: ['frambuesa'],
  cherry: ['cereza'],
  plum: ['ciruela'],
  mango: ['mango'],
  starch: ['maicena'],
}
