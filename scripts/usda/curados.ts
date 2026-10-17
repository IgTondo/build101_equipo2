// Catálogo curado (data/alimentos.json): identidad de cada alimento, elegida a mano.
// Alérgenos conservadores: si el producto típico puede llevar el alérgeno, va marcado (un falso negativo es peligroso).
import type { Alergeno, Grupo } from '../../shared/contratos.js'

export interface Curado {
  id: string; nombre: string; grupo: Grupo; alergenos: Alergeno[]; alias: string[]
}

const c = (id: string, nombre: string, grupo: Grupo, alergenos: Alergeno[], alias: string[]): Curado => ({ id, nombre, grupo, alergenos, alias })

export const CURADOS: Curado[] = [
  // ---------- Cereales, panes, pastas y tubérculos (papa y boniato van acá, como en la guía uruguaya) ----------
  c('arroz', 'Arroz', 'cereal_almidon', [], ['arroz blanco', 'rice']),
  c('fideos', 'Fideos', 'cereal_almidon', ['gluten'], ['pasta', 'tallarines', 'spaghetti', 'espaguetis', 'macarrones', 'tirabuzones', 'moñitas', 'mostacholes']),
  c('fideos_huevo', 'Fideos al huevo', 'cereal_almidon', ['gluten', 'huevo'], ['pasta al huevo', 'tallarines al huevo', 'egg noodles', 'pasta fresca']),
  c('noquis', 'Ñoquis', 'cereal_almidon', ['gluten', 'huevo', 'leche'], ['ñoqui', 'noquis de papa', 'gnocchi']),
  c('pan_blanco', 'Pan blanco', 'cereal_almidon', ['gluten', 'leche', 'soja'], ['pan', 'pan flauta', 'pan de molde', 'baguette', 'felipe', 'pan francés', 'marraqueta', 'tostada', 'white bread']),
  c('pan_integral', 'Pan integral', 'cereal_almidon', ['gluten', 'leche', 'soja', 'sesamo'], ['pan de salvado', 'pan negro', 'pan de harina integral', 'whole wheat bread']),
  c('pan_rallado', 'Pan rallado', 'cereal_almidon', ['gluten', 'leche', 'soja'], ['pan molido', 'rebozador', 'breadcrumbs', 'panko']),
  c('galletitas_agua', 'Galletitas al agua', 'cereal_almidon', ['gluten', 'leche', 'soja'], ['galletas de agua', 'galletas saladas', 'crackers', 'cracker', 'galletitas saladas']),
  c('galletitas_integrales', 'Galletitas integrales', 'cereal_almidon', ['gluten', 'leche', 'soja'], ['galletas integrales', 'crackers integrales', 'galletitas de salvado', 'whole wheat crackers']),
  c('galletitas_dulces', 'Galletitas dulces', 'cereal_almidon', ['gluten', 'leche', 'huevo', 'soja'], ['galletas dulces', 'galletitas maría', 'galletas maría', 'vainillas', 'cookies', 'galletas']),
  c('galletitas_avena', 'Galletitas de avena', 'cereal_almidon', ['gluten', 'leche', 'huevo', 'soja'], ['galletas de avena', 'oatmeal cookies']),
  c('grisines', 'Grisines', 'cereal_almidon', ['gluten', 'leche', 'sesamo'], ['palitos de pan', 'grissini', 'breadsticks']),
  c('avena', 'Avena', 'cereal_almidon', ['gluten'], ['copos de avena', 'avena arrollada', 'avena instantánea', 'oats', 'oatmeal', 'porridge']),
  c('cereal_fortificado', 'Cereal de desayuno fortificado', 'cereal_almidon', ['gluten', 'leche', 'soja'], ['cereal', 'cereales', 'copos de maíz', 'corn flakes', 'cornflakes', 'hojuelas de maíz', 'cereal de desayuno']),
  c('harina_trigo', 'Harina de trigo', 'cereal_almidon', ['gluten'], ['harina', 'harina 000', 'harina 0000', 'flour']),
  c('polenta', 'Polenta', 'cereal_almidon', [], ['harina de maíz', 'sémola de maíz', 'cornmeal', 'grits']),
  c('papa', 'Papa', 'cereal_almidon', [], ['papas', 'patata', 'patatas', 'potato']),
  c('boniato', 'Boniato', 'cereal_almidon', [], ['batata', 'camote', 'moniato', 'sweet potato']),
  c('choclo', 'Choclo', 'cereal_almidon', [], ['maíz dulce', 'maíz', 'elote', 'jojoto', 'mazorca', 'sweet corn', 'corn']),
  c('prepizza', 'Prepizza', 'cereal_almidon', ['gluten', 'leche', 'soja'], ['masa de pizza', 'base de pizza', 'pizza crust']),
  c('medialuna', 'Medialuna', 'cereal_almidon', ['gluten', 'leche', 'huevo', 'soja'], ['medialunas', 'croissant', 'cuernito', 'bizcocho', 'bizcochos']),

  // ---------- Carnes, pescados, huevos y legumbres ----------
  c('carne_vacuna', 'Carne vacuna', 'proteina', [], ['carne', 'carne de vaca', 'carne roja', 'bife', 'nalga', 'peceto', 'res', 'beef', 'steak']),
  c('carne_picada', 'Carne picada', 'proteina', [], ['carne molida', 'picada', 'molida', 'ground beef']),
  c('pollo', 'Pollo', 'proteina', [], ['pechuga', 'pechuga de pollo', 'suprema', 'muslo', 'chicken']),
  c('nuggets_pollo', 'Nuggets de pollo', 'proteina', ['gluten', 'huevo', 'leche', 'soja'], ['nuggets', 'patitas de pollo', 'formitas de pollo', 'bocaditos de pollo', 'chicken nuggets']),
  c('hamburguesa_comercial', 'Hamburguesa comercial', 'proteina', ['gluten', 'huevo', 'leche', 'soja'], ['hamburguesa congelada', 'medallón de carne', 'hamburguesa de paquete', 'burger', 'patty']),
  c('carne_cerdo', 'Carne de cerdo', 'proteina', [], ['cerdo', 'bondiola', 'chuleta', 'lomo de cerdo', 'pork']),
  c('salchicha', 'Salchicha', 'proteina', ['gluten', 'leche', 'soja'], ['salchichas', 'pancho', 'frankfurt', 'viena', 'hot dog', 'wiener']),
  c('jamon', 'Jamón cocido', 'proteina', ['leche', 'soja'], ['jamón', 'jamón york', 'fiambre', 'ham']),
  c('chorizo', 'Chorizo', 'proteina', ['leche', 'soja'], ['chorizo parrillero', 'longaniza', 'sausage']),
  c('huevo', 'Huevo', 'proteina', ['huevo'], ['huevos', 'huevo duro', 'huevo revuelto', 'huevo frito', 'egg', 'eggs']),
  c('huevo_enriquecido', 'Huevo enriquecido (omega-3 y vitamina D)', 'proteina', ['huevo'], ['huevo omega 3', 'huevo con vitamina d', 'huevos enriquecidos']),
  c('merluza', 'Merluza', 'proteina', ['pescado'], ['pescado', 'pescado blanco', 'filet de merluza', 'filete de pescado', 'hake', 'fish']),
  c('palitos_pescado', 'Palitos de pescado', 'proteina', ['pescado', 'gluten', 'huevo', 'leche', 'soja'], ['palitos de merluza', 'bastones de pescado', 'formitas de pescado', 'medallones de merluza', 'fish sticks']),
  c('atun', 'Atún', 'proteina', ['pescado'], ['atún en lata', 'atún al natural', 'tuna']),
  c('salmon', 'Salmón', 'proteina', ['pescado'], ['salmón rosado', 'salmon']),
  c('lentejas', 'Lentejas', 'proteina', [], ['lenteja', 'lentils']),
  c('garbanzos', 'Garbanzos', 'proteina', [], ['garbanzo', 'chickpeas', 'hummus']),
  c('porotos', 'Porotos', 'proteina', [], ['poroto', 'frijoles', 'frejoles', 'alubias', 'judías secas', 'porotos negros', 'porotos manteca', 'beans']),
  c('pasta_mani', 'Pasta de maní', 'proteina', ['mani'], ['manteca de maní', 'mantequilla de maní', 'crema de cacahuete', 'peanut butter']),

  // ---------- Verduras ----------
  c('zanahoria', 'Zanahoria', 'verdura', [], ['zanahorias', 'carrot']),
  c('zapallo', 'Zapallo', 'verdura', [], ['calabaza', 'zapallo cabutiá', 'zapallo kabutiá', 'zapallo anco', 'auyama', 'ahuyama', 'pumpkin', 'squash']),
  c('zapallito', 'Zapallito', 'verdura', [], ['zucchini', 'calabacín', 'calabacita', 'zapallito de tronco', 'zapallito redondo', 'courgette']),
  c('brocoli', 'Brócoli', 'verdura', [], ['brocoli', 'brécol', 'broccoli']),
  c('chauchas', 'Chauchas', 'verdura', [], ['chaucha', 'judías verdes', 'ejotes', 'vainitas', 'porotos verdes', 'green beans']),
  c('arvejas', 'Arvejas', 'verdura', [], ['arvejitas', 'guisantes', 'chícharos', 'petit pois', 'peas']),
  c('tomate', 'Tomate', 'verdura', [], ['tomates', 'jitomate', 'tomato']),
  c('salsa_tomate', 'Salsa de tomate', 'verdura', [], ['tuco', 'pomarola', 'salsa pomarola', 'passata', 'salsa de tomates', 'tomato sauce']),
  c('lechuga', 'Lechuga', 'verdura', [], ['ensalada verde', 'lettuce']),
  c('espinaca', 'Espinaca', 'verdura', [], ['espinacas', 'spinach']),
  c('acelga', 'Acelga', 'verdura', [], ['acelgas', 'chard']),
  c('cebolla', 'Cebolla', 'verdura', [], ['cebollas', 'onion']),
  c('morron', 'Morrón', 'verdura', [], ['morrón', 'pimiento', 'pimentón', 'ají dulce', 'bell pepper']),
  c('pepino', 'Pepino', 'verdura', [], ['pepinos', 'cucumber']),
  c('coliflor', 'Coliflor', 'verdura', [], ['cauliflower']),
  c('remolacha', 'Remolacha', 'verdura', [], ['betabel', 'beterraga', 'beet', 'beetroot']),

  // ---------- Frutas ----------
  c('banana', 'Banana', 'fruta', [], ['bananas', 'plátano', 'banano', 'cambur', 'guineo']),
  c('manzana', 'Manzana', 'fruta', [], ['manzanas', 'manzana roja', 'manzana verde', 'apple']),
  c('pera', 'Pera', 'fruta', [], ['peras', 'pear']),
  c('naranja', 'Naranja', 'fruta', [], ['naranjas', 'orange']),
  c('jugo_naranja', 'Jugo de naranja', 'fruta', [], ['jugo de naranja exprimido', 'zumo de naranja', 'orange juice']),
  c('mandarina', 'Mandarina', 'fruta', [], ['mandarinas', 'tangerina', 'clementina', 'tangerine']),
  c('frutilla', 'Frutilla', 'fruta', [], ['frutillas', 'fresa', 'fresas', 'strawberry']),
  c('kiwi', 'Kiwi', 'fruta', [], ['kiwis', 'kiwifruit']),
  c('durazno', 'Durazno', 'fruta', [], ['duraznos', 'melocotón', 'peach']),
  c('uva', 'Uva', 'fruta', [], ['uvas', 'grapes']),
  c('sandia', 'Sandía', 'fruta', [], ['sandía', 'patilla', 'watermelon']),
  c('melon', 'Melón', 'fruta', [], ['melón', 'cantaloupe']),
  c('anana', 'Ananá', 'fruta', [], ['ananá', 'piña', 'pineapple']),

  // ---------- Leche, yogur y quesos ----------
  c('leche', 'Leche', 'lacteo', ['leche'], ['leche entera', 'leche de vaca', 'milk']),
  c('leche_vitamina_d', 'Leche fortificada con vitamina D', 'lacteo', ['leche'], ['leche con vitamina d', 'leche fortificada', 'leche enriquecida']),
  c('yogur', 'Yogur', 'lacteo', ['leche'], ['yogurt', 'yoghurt', 'yogur natural', 'yogur de vainilla']),
  c('yogur_vitamina_d', 'Yogur fortificado con vitamina D', 'lacteo', ['leche'], ['yogur con vitamina d', 'yogur fortificado']),
  c('yogur_bebible', 'Yogur bebible', 'lacteo', ['leche'], ['yogur líquido', 'bebida láctea', 'drinkable yogurt']),
  c('queso_dambo', 'Queso dambo', 'lacteo', ['leche'], ['dambo', 'danbo', 'queso danbo', 'queso de máquina', 'queso tybo', 'queso en fetas']),
  c('queso_muzzarella', 'Queso muzzarella', 'lacteo', ['leche'], ['muzzarella', 'mozzarella', 'muzarela', 'mozarela']),
  c('queso_rallado', 'Queso rallado', 'lacteo', ['leche'], ['parmesano', 'queso parmesano', 'sardo', 'reggianito', 'grated cheese']),
  c('queso_crema', 'Queso crema', 'lacteo', ['leche'], ['queso untable', 'philadelphia', 'cream cheese']),
  c('ricota', 'Ricota', 'lacteo', ['leche'], ['requesón', 'ricotta']),
  c('helado', 'Helado de crema', 'lacteo', ['leche', 'huevo', 'soja'], ['helado', 'ice cream']),
  c('postre_lacteo', 'Postre lácteo', 'lacteo', ['leche', 'huevo'], ['postrecito', 'flan', 'natilla', 'pudín', 'budín de vainilla', 'pudding']),

  // ---------- Otros: grasas, azúcares, dulces y snacks ----------
  c('aceite_girasol', 'Aceite de girasol', 'otro', [], ['aceite', 'sunflower oil']),
  c('aceite_canola', 'Aceite de canola', 'otro', [], ['aceite de colza', 'canola oil']),
  c('aceite_oliva', 'Aceite de oliva', 'otro', [], ['olive oil']),
  c('manteca', 'Manteca', 'otro', ['leche'], ['mantequilla', 'butter']),
  c('azucar', 'Azúcar', 'otro', [], ['azúcar blanca', 'sugar']),
  c('cacao_azucarado', 'Cacao en polvo azucarado', 'otro', ['leche', 'soja', 'gluten'], ['cacao', 'cocoa', 'chocolatada en polvo', 'nesquik', 'toddy', 'cola cao']),
  c('dulce_de_leche', 'Dulce de leche', 'otro', ['leche'], ['dulce de leche repostero', 'cajeta', 'arequipe', 'manjar', 'manjar blanco']),
  c('alfajor', 'Alfajor', 'otro', ['gluten', 'leche', 'huevo', 'soja'], ['alfajores', 'alfajor de maicena', 'alfajor de chocolate']),
  c('mermelada', 'Mermelada', 'otro', [], ['dulce de fruta', 'jalea', 'confitura', 'jam']),
  c('mayonesa', 'Mayonesa', 'otro', ['huevo'], ['mayo', 'mayonnaise']),
  c('ketchup', 'Kétchup', 'otro', [], ['ketchup', 'catsup']),
  c('papas_chips', 'Papas chips', 'otro', ['leche', 'soja'], ['papas fritas de paquete', 'chips', 'papitas', 'potato chips']),
  c('chocolate', 'Chocolate', 'otro', ['leche', 'soja', 'frutos_secos', 'mani'], ['chocolate con leche', 'tableta de chocolate', 'bombón', 'chocolatín']),
  c('miel', 'Miel', 'otro', [], ['miel de abeja', 'honey']),
  c('bizcochuelo', 'Bizcochuelo', 'otro', ['gluten', 'huevo', 'leche', 'soja'], ['torta', 'budín', 'queque', 'sponge cake', 'cake']),
]

export const NOMBRE_GENERICO: Record<Grupo, string> = {
  cereal_almidon: 'Otro cereal, pan o almidón',
  proteina: 'Otra carne, pescado, huevo o legumbre',
  verdura: 'Otra verdura',
  fruta: 'Otra fruta',
  lacteo: 'Otro lácteo',
  otro: 'Otro alimento',
}
