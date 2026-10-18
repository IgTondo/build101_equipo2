// v5.10 · Platos comunes (server/ia/platos-comunes.ts): los nombres raros que salieron en eval/resultados/variedad-*.md dan
// problema, los platos de cantina, bar, restaurante o cafetería no, y el prompt de la receta creativa los pide.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Momento } from '../../shared/contratos.js'
import { preparacionesCatalogo } from '../datos/catalogos.js'
import { alimentosPrueba, catalogoPrueba, comidasSinteticas, ninoDoc, sintetico } from '../datos/prueba/catalogos.js'
import { conocimientoDe, type Foco } from '../grafo/conocimiento.js'
import { objetivosPara } from '../nutricion/objetivos.js'
import { fijarAlimentos } from './catalogo.js'
import { EJEMPLOS_DE_PLATOS, PLATOS_COMUNES, franjaDe, problemasDePlatoComun, tipoDelNombre } from './platos-comunes.js'
import type { SalidaCreativa } from './prompts/receta-creativa.js'
import { completarCreativa, problemasCreativa } from './receta-creativa.js'

describe('tipoDelNombre', () => {
  it('la entrada de la lista con la que empieza, las de varias palabras primero', () => {
    expect(tipoDelNombre('Arroz con leche y canela')?.entrada).toBe('arroz con leche')
    expect(tipoDelNombre('Arroz con pollo')?.entrada).toBe('arroz')
    expect(tipoDelNombre('Tortilla de papas')?.entrada).toBe('tortilla')
    expect(tipoDelNombre('Ensalada de frutas')?.entrada).toBe('ensalada de frutas')
    expect(tipoDelNombre('Ensalada de lentejas')?.entrada).toBe('ensalada')
    expect(tipoDelNombre('Pan de carne casero')?.entrada).toBe('pan de carne')
  })

  it('sin artículos ni adjetivos adelante, en singular o plural y con diminutivo', () => {
    expect(tipoDelNombre('Mini milanesitas de pollo')?.entrada).toBe('milanesa')
    expect(tipoDelNombre('Las tostaditas con queso')?.entrada).toBe('tostadas')
    expect(tipoDelNombre('Ricos pancitos caseros')?.entrada).toBe('pan')
    expect(tipoDelNombre('Bastoncitos de boniato')?.entrada).toBe('bastones')
    expect(tipoDelNombre('Ñoquis con tuco')?.entrada).toBe('noquis')
    expect(tipoDelNombre('Puré de calabaza')?.entrada).toBe('pure')
  })

  it('si no es ninguno, su primera palabra y sin entrada', () => {
    expect(tipoDelNombre('Hojuelas crocantes de mandioca')).toEqual({ tipo: 'hojuelas', fin: 1 })
  })
})

describe('problemasDePlatoComun', () => {
  // Los que pidió el usuario y los de las corridas de variedad (eval/resultados/variedad-*.md)
  it.each<[string, Momento, RegExp]>([
    ['Pizzetas crocantes de fideos integrales y muzzarella', 'cena', /los fideos son la base o la forma de otro plato/],
    ['Chips de ñoquis crocantes con lino, para el desayuno', 'desayuno', /los ñoquis son la base o la forma de otro plato/],
    ['Crackers de panqueque con nueces', 'merienda', /los panqueques son la base o la forma de otro plato/],
    ['Hojuelas crocantes de mandioca y queso al horno', 'desayuno', /no es un plato común para el desayuno/],
    ['Licuado cremoso de queso dambo y banana', 'desayuno', /no va queso dambo: un licuado, un batido o un jugo lleva fruta/],
    ['Milanesa de yogur al horno, dorada y crocante', 'cena', /no va yogur: una milanesa, unos nuggets o una hamburguesa son de carne/],
    ['Crema fría de ravioles de ricota y cacao, para tomar en vaso', 'desayuno', /los ravioles son la base o la forma de otro plato/],
    ['Licuado de ravioles y banana', 'merienda', /los ravioles son la base o la forma de otro plato/],
    ['Pizza con masa de fideos', 'cena', /los fideos son la base/],
    ['Pizza crocante con base cremosa de yogur y muzzarella', 'cena', /tiene una base rara \(base cremosa de yogur\)/],
    ['Licuado cremoso de tofu y cacao, bien frío', 'desayuno', /no va tofu/],
    ['Tostadas de ñoquis gratinadas', 'desayuno', /los ñoquis son la base/],
  ])('«%s» (%s) da problema', (nombre, momento, esperado) => {
    expect(problemasDePlatoComun(nombre, momento).join('\n')).toMatch(esperado)
  })

  it('el problema dice qué platos sí, de su franja, para el reintento', () => {
    expect(problemasDePlatoComun('Hojuelas crocantes de mandioca y queso al horno', 'desayuno')[0]).toContain(EJEMPLOS_DE_PLATOS.desayuno_merienda)
    expect(problemasDePlatoComun('Pizzetas crocantes de fideos integrales y muzzarella', 'cena')[0]).toContain(EJEMPLOS_DE_PLATOS.almuerzo_cena)
  })

  const ALMUERZO_Y_CENA = [
    'Milanesa de pollo al horno', 'Milanesa de carne', 'Milanesas de berenjena', 'Milanesa de soja', 'Nuggets caseros de pollo',
    'Hamburguesa casera de lentejas', 'Tarta de zapallitos', 'Tortilla de papas', 'Empanadas de carne', 'Fideos con salsa bolognesa',
    'Ravioles de ricota con salsa', 'Arroz con pollo', 'Guiso de lentejas', 'Puré de calabaza', 'Pollo al horno con papas',
    'Pastel de carne', 'Chivito al pan', 'Milanesa al pan con lechuga y tomate', 'Hamburguesa de lentejas en pan casero',
    'Sopa de fideos', 'Polenta con tuco', 'Torta pascualina', 'Buñuelos de acelga', 'Zapallitos rellenos', 'Tomates rellenos de atún',
    'Revuelto gramajo', 'Lasaña de verduras', 'Canelones de verdura', 'Ñoquis de calabaza con tuco', 'Filet de merluza al horno',
    'Pan de carne casero', 'Capeletis a la caruso', 'Mini milanesitas de pollo', 'Bastones de boniato al horno con queso rallado',
    'Papas al horno con queso gratinado', 'Bastones de zanahoria fritos', 'Croquetas de atún y papa, fritas',
    'Milanesa de pollo con rebozado de pan rallado', 'Empanadas de carne con masa casera', 'Ensalada de frutas', 'Manzana asada con canela',
  ]
  const DESAYUNO_Y_MERIENDA = [
    'Tostadas con queso', 'Tostado de jamón y queso', 'Yogur con frutilla y granola', 'Licuado de banana con leche',
    'Avena con leche y manzana', 'Panqueques con dulce de leche', 'Budín de banana', 'Galletitas de avena caseras', 'Arroz con leche',
    'Medialunas con jamón y queso', 'Bizcochos caseros', 'Tortas fritas', 'Pastafrola de membrillo', 'Café con leche con tostadas',
    'Huevos revueltos con tostadas', 'Ensalada de frutas', 'Banana con dulce de leche', 'Chocolatada con galletitas', 'Pancitos caseros',
    'Budincitos de banana', 'Tostaditas con queso', 'Tostadas de pan integral con queso', 'Yogur de vainilla con banana pisada',
    'Licuado de banana con leche de soja', 'Budín de pan', 'Tarta de manzana con base de galletitas', 'Jugo de naranja y zanahoria',
  ]
  it.each(ALMUERZO_Y_CENA.flatMap((n) => [[n, 'almuerzo'], [n, 'cena']] as [string, Momento][]))('«%s» es común para %s', (nombre, momento) => {
    expect(problemasDePlatoComun(nombre, momento)).toEqual([])
  })
  it.each(DESAYUNO_Y_MERIENDA.flatMap((n) => [[n, 'desayuno'], [n, 'merienda'], [n, 'colacion']] as [string, Momento][]))('«%s» es común para %s', (nombre, momento) => {
    expect(problemasDePlatoComun(nombre, momento)).toEqual([])
  })

  it('las preparaciones del catálogo son comunes en sus comidas', () => {
    const conProblema = [...preparacionesCatalogo().values()].flatMap((p) => (p.momentos ?? []).flatMap((m) => problemasDePlatoComun(p.nombre, m)))
    expect(conProblema).toEqual([])
  })

  it('un plato de la otra franja da problema: licuado en la cena, milanesa en el desayuno', () => {
    expect(problemasDePlatoComun('Licuado de banana con leche', 'cena')).toEqual([expect.stringMatching(/^«Licuado de banana con leche» es un plato de desayuno y merienda, no de la cena\. Para la cena, un plato común/)])
    expect(problemasDePlatoComun('Milanesa de pollo al horno', 'desayuno')).toEqual([expect.stringMatching(/^«Milanesa de pollo al horno» es un plato de almuerzo y cena, no del desayuno\./)])
    expect(problemasDePlatoComun('Tostado de jamón y queso', 'almuerzo')).toHaveLength(1)
    expect(problemasDePlatoComun('Arroz con leche', 'cena')).toHaveLength(1)
    expect(problemasDePlatoComun('Arroz con pollo', 'merienda')).toHaveLength(1)
    expect(problemasDePlatoComun('Fideos con manteca', 'colacion')).toHaveLength(1)
  })

  it('sin comida vale cualquiera de las dos franjas; lo que no es común, igual no', () => {
    expect(problemasDePlatoComun('Licuado de banana con leche')).toEqual([])
    expect(problemasDePlatoComun('Milanesa de pollo al horno')).toEqual([])
    expect(problemasDePlatoComun('Hojuelas crocantes de mandioca')).toHaveLength(1)
  })

  it('las franjas: desayuno, merienda y colación; almuerzo y cena. La fruta va en las dos', () => {
    expect(['desayuno', 'merienda', 'colacion', 'almuerzo', 'cena'].map((m) => franjaDe(m as Momento))).toEqual(['desayuno_merienda', 'desayuno_merienda', 'desayuno_merienda', 'almuerzo_cena', 'almuerzo_cena'])
    for (const f of ['desayuno_merienda', 'almuerzo_cena'] as const) expect(PLATOS_COMUNES[f]).toEqual(expect.arrayContaining(['banana', 'ensalada de frutas', 'compota']))
    expect(PLATOS_COMUNES.almuerzo_cena).not.toContain('licuado')
    expect(PLATOS_COMUNES.desayuno_merienda).not.toContain('milanesa')
  })
})

describe('en la receta creativa', () => {
  const catalogo = catalogoPrueba()
  const alimentos = alimentosPrueba()
  const s = sintetico('tomas')
  const cargado = { nino: ninoDoc(s), comidas: comidasSinteticas(s, alimentos, catalogo), catalogo, alimentos, objetivo: objetivosPara(s.datos.edad, s.datos.sexo) }
  const papasHorno = catalogo.get('papas_horno_baston')!
  const zanahoria = catalogo.get('bastones_zanahoria_horno')!
  const FOCO: Foco = { desdeId: 'papas_horno_baston', modo: 'sumar_ingrediente', nutriente: 'calcio_mg', ingrediente: 'queso_muzzarella' }
  const k = (foco: Foco = FOCO) => {
    const c = conocimientoDe(cargado, { hoy: '2026-10-16', momento: 'cena', azar: () => 0.4 })
    return { ...c, seguros: [...c.seguros.filter((x) => x.id !== zanahoria.id), zanahoria], foco, recientes: [] }
  }
  // Sus papas al horno con muzzarella gratinada, como en receta-creativa.test.ts: pasa sin problemas
  const PAPAS_CON_QUESO: SalidaCreativa = {
    desdeId: 'papas_horno_baston',
    nutriente: 'calcio_mg',
    nombre: 'Papas al horno con queso gratinado',
    atributos: { ...papasHorno.atributos, coccion: 'horno' },
    imagen: { uno: 'cheesy oven fry', varios: 'cheesy oven fries', aspecto: 'oven-baked potato sticks with golden melted mozzarella on top' },
    rol: 'principal',
    acompanamientos: [{ preparacionId: 'papas_fritas_baston', rol: 'guarnicion', gramos: 60 }, { preparacionId: 'bastones_zanahoria_horno', rol: 'verdura_fruta', gramos: 60 }],
    ingredientes: [{ alimentoId: 'papa', gramos: 120 }, { alimentoId: 'queso_muzzarella', gramos: 35 }, { alimentoId: 'aceite_girasol', gramos: 5 }],
    pasos: ['Cortá las papas en bastones.', 'Pincelalas con aceite.', 'Horneá 25 minutos hasta que estén crocantes.', 'Poné una feta de muzzarella arriba y gratiná 3 minutos.'],
    porQue: 'Parte de sus papas al horno en bastones, que come siempre; cambia solo el ingrediente: se suma muzzarella, que aporta calcio.',
    presentacion: 'Separado, dos bastones con queso al lado de sus papas fritas, sin tocarse.',
    comoOfrecer: 'Ofrecelo sin pedirle que lo coma; que esté en el plato ya es un avance.',
    transparencia: null,
  }
  const problemas = (nombre: string) => {
    const r = completarCreativa({ ...PAPAS_CON_QUESO, nombre }, k(), papasHorno)
    return problemasCreativa(r, k(), papasHorno, [], r.platoCompleto?.componentes.filter((c) => !c.nuevo))
  }

  beforeAll(() => fijarAlimentos([...alimentos.values()]))
  afterAll(() => fijarAlimentos(null))

  it('problemasCreativa pide reintento si el plato no es común; el mismo plato con un nombre común pasa', () => {
    expect(problemas('Papas al horno con queso gratinado')).toEqual([])
    expect(problemas('Papas gratinadas con muzzarella')).toEqual([])
    expect(problemas('Hojuelas de papa con muzzarella')).toEqual([expect.stringContaining('no es un plato común para la cena')])
    expect(problemas('Licuado de papa y queso')).toContainEqual(expect.stringContaining('es un plato de desayuno y merienda, no de la cena'))
  })

  it('si el nombre no dice qué es el plato, el problema es ese (no se suma el de plato común)', () => {
    expect(problemas('Crocantes como las suyas').join('\n')).not.toMatch(/plato común/)
  })
})
