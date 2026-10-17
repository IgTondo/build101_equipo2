// Validación de la receta (PLAN.md §7): cada regla con un caso que pasa y uno que falla. Sin red: catálogo de prueba.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Regla } from '../../shared/contratos.js'
import { fijarAlimentos } from '../ia/catalogo.js'
import { ALIMENTOS, CANDIDATO_PAPAS, CANDIDATO_QUESO, CANDIDATO_YOGUR, PERFIL_TOMAS, prep, recetaDelFixture, recetaQueso } from './ejemplos.js'
import { calcularAporte, cambiosEntre, problemasPorTipo, validarCandidato, validarReceta, type ContextoValidacion } from './receta.js'

beforeAll(() => fijarAlimentos(ALIMENTOS))
afterAll(() => fijarAlimentos(null))

const ctxQueso = (extra: Partial<ContextoValidacion> = {}): ContextoValidacion => ({
  alergias: ['huevo'],
  reglas: PERFIL_TOMAS.reglas,
  desde: prep('papas_horno_baston'),
  base: prep('bastones_queso_horno'),
  ...extra,
})

const problemas = (...args: Parameters<typeof validarReceta>) => validarReceta(...args).problemas
const conTexto = (campo: 'comoOfrecer' | 'presentacion' | 'porQue' | 'nombre', texto: string) => recetaQueso({ [campo]: texto })
const conPaso = (paso: string) => recetaQueso({ pasos: [...recetaQueso().pasos, paso] })

describe('validarReceta: la receta de referencia', () => {
  it('los bastones de queso (desde las papas al horno, con el aceite en 5 g) pasan', () => {
    expect(validarReceta(recetaQueso(), ctxQueso())).toEqual({ ok: true, problemas: [] })
  })

  it('la del fixture no pasa: el aceite va en 2 g (mínimo 5) y su aporte es de otra tabla', () => {
    const p = problemas(recetaDelFixture(), ctxQueso())
    expect(p).toHaveLength(2)
    expect(p[0]).toContain('2 g está fuera de lo razonable')
    expect(p[1]).toContain('El aporte no coincide con la tabla')
  })
})

describe('cambiosEntre (criterio de cadena.ts, §8)', () => {
  it('papas al horno en bastones → bastones de queso: solo el ingrediente principal', () => {
    expect(cambiosEntre(prep('papas_horno_baston'), prep('bastones_queso_horno')).map((d) => d.cambio)).toEqual(['ingrediente'])
  })

  it('papas fritas → papas al horno, las dos en bastones: solo la cocción (v4)', () => {
    expect(cambiosEntre(prep('papas_fritas_baston'), prep('papas_horno_baston')).map((d) => d.cambio)).toEqual(['coccion'])
  })

  it('papas fritas en bastones → bastones de queso al horno: 2 cambios (la cocción y el ingrediente)', () => {
    expect(cambiosEntre(prep('papas_fritas_baston'), prep('bastones_queso_horno')).map((d) => d.cambio)).toEqual(['coccion', 'ingrediente'])
  })

  it('leche chocolatada → yogur de vainilla: la forma y el ingrediente (el fixture lo declara como "forma")', () => {
    expect(cambiosEntre(prep('leche_chocolatada'), prep('yogur_vainilla')).map((d) => d.cambio)).toEqual(['forma', 'ingrediente'])
  })

  it('la versión fortificada (fortificadaDe) es el cambio "fortificar", aunque cambie el alimento', () => {
    expect(cambiosEntre(prep('yogur_vainilla'), prep('yogur_vainilla_d')).map((d) => d.cambio)).toEqual(['fortificar'])
  })

  it('el color no cuenta', () => {
    const verde = { ...prep('papas_horno_baston'), id: 'x', atributos: { ...prep('papas_horno_baston').atributos, color: 'verde' as const } }
    expect(cambiosEntre(prep('papas_horno_baston'), verde)).toEqual([])
  })

  it('la cocción solo cuenta si las dos la tienen', () => {
    const { coccion: _, ...sinCoccion } = prep('papas_horno_baston').atributos
    void _
    const sin = { ...prep('papas_fritas_baston'), id: 'y', atributos: sinCoccion }
    expect(cambiosEntre(prep('papas_fritas_baston'), sin)).toEqual([])
  })
})

describe('validarReceta: un solo cambio, el declarado', () => {
  it('cambio declarado distinto del calculado → falla', () => {
    const p = problemas(recetaQueso({ cambio: 'forma' }), ctxQueso())
    expect(p).toEqual([expect.stringContaining('El cambio declarado es la forma, pero lo que cambia es el ingrediente principal')])
  })

  it('dos cambios → falla aunque declare uno', () => {
    const p = validarCandidato(ctxQueso({ desde: prep('papas_fritas_baston') }), CANDIDATO_QUESO).problemas
    expect(p.some((x) => x.includes('cambian 2 cosas'))).toBe(true)
  })

  it('ningún cambio → falla', () => {
    const p = validarCandidato(ctxQueso({ desde: prep('bastones_queso_horno') }), CANDIDATO_QUESO).problemas
    expect(p[0]).toContain('no cambia nada')
  })

  it('fortificar pasa como un solo cambio', () => {
    const ctx = ctxQueso({ desde: prep('yogur_vainilla'), base: prep('yogur_vainilla_d') })
    expect(validarCandidato(ctx, { cambio: 'fortificar', seMantiene: ['textura=cremoso', 'sabor=dulce'] })).toEqual({ ok: true, problemas: [] })
  })

  it('el candidato de las papas al horno (cocción) pasa', () => {
    expect(validarCandidato(ctxQueso({ desde: prep('papas_fritas_baston'), base: prep('papas_horno_baston') }), CANDIDATO_PAPAS).ok).toBe(true)
  })

  it('el candidato del yogur del fixture no pasa: son 2 cambios', () => {
    const ctx = ctxQueso({ desde: prep('leche_chocolatada'), base: prep('yogur_vainilla') })
    expect(validarCandidato(ctx, CANDIDATO_YOGUR).problemas[0]).toContain('cambian 2 cosas')
  })

  // PENDIENTE (va al reporte): el plan (§0, §8 y la tarjeta "un pasito" del tablero) usa "papas fritas → bastones de queso
  // al horno" como ejemplo de un solo cambio, pero con la cocción como dimensión (v4) son dos: el ingrediente y frito → horno.
  // No se afloja el validador: o el ejemplo parte de las papas al horno en bastones (como fixtures/receta.json), o B decide
  // en cadena.ts que la cocción no cuenta cuando cambia el ingrediente, y entonces se usa ese criterio acá.
  it.skip('el ejemplo del plan: papas fritas en bastones → bastones de queso al horno es un solo cambio', () => {
    const ctx = ctxQueso({ desde: prep('papas_fritas_baston') })
    expect(validarReceta(recetaQueso({ desde: { preparacionId: 'papas_fritas_baston', nombre: 'Papas fritas en bastones' } }), ctx).ok).toBe(true)
  })

  it('lo que dice que se mantiene tiene que ser cierto en las dos preparaciones', () => {
    const p = problemas(recetaQueso({ seMantiene: ['forma=baston', 'coccion=frito'] }), ctxQueso())
    expect(p).toEqual([expect.stringContaining('Dice que se mantiene coccion=frito')])
    expect(problemas(recetaQueso({ seMantiene: [] }), ctxQueso())[0]).toContain('Falta decir qué se mantiene')
  })

  it('preparacionBaseId y desde tienen que ser los del candidato', () => {
    const p = problemas(recetaQueso({ preparacionBaseId: 'yogur_vainilla' }), ctxQueso())
    expect(p[0]).toContain('se arma sobre «yogur_vainilla»')
  })
})

describe('validarReceta: alergias (según data/alimentos.json)', () => {
  const conHuevo = () => recetaQueso({ ingredientes: [...recetaQueso().ingredientes, { alimentoId: 'huevo', nombre: 'Huevo', gramos: 20 }] })

  it('un ingrediente con un alérgeno del chico → falla', () => {
    expect(problemas(conHuevo(), ctxQueso())).toEqual([expect.stringContaining('«Huevo» tiene huevo, y tiene alergia declarada')])
  })

  it('el mismo ingrediente sin esa alergia pasa', () => {
    expect(validarReceta(conHuevo(), ctxQueso({ alergias: [] })).ok).toBe(true)
  })

  it('el queso con alergia a la leche → falla', () => {
    expect(problemas(recetaQueso(), ctxQueso({ alergias: ['leche'] })).filter((x) => x.includes('tiene leche'))).toHaveLength(2)
  })

  it('un paso que nombra el alérgeno (rebozado con huevo) → falla aunque no esté en la lista', () => {
    const p = problemas(conPaso('Pasalos por huevo batido antes del pan rallado.'), ctxQueso())
    expect(p).toEqual([expect.stringContaining('En el paso 7 aparece «huevo» y tiene alergia declarada a huevo')])
  })

  it('"No lleva huevo", "en lugar de huevo", "sin huevo" o "reemplazá el huevo" no cuentan', () => {
    expect(validarReceta(conPaso('Pasalos por leche en lugar de huevo. No lleva huevo. Va sin huevo; reemplazá el huevo por leche.'), ctxQueso()).ok).toBe(true)
  })

  it.each([
    'Cocinalo sin parar y agregá huevo batido.',
    'Sin sal y pasalo por huevo.',
    'No dejes de pasarlo por huevo batido.',
    'No olvides el huevo.',
  ])('una negación lejana no niega el alérgeno: %s', (paso) => {
    expect(problemas(conPaso(paso), ctxQueso()).some((x) => x.includes('alergia declarada a huevo'))).toBe(true)
  })

  it.each([
    'Batí 2 claras a nieve.',
    'Agregá las claras.',
    'Batí unas claras.',
    'Pincelá con clara batida.',
    'Usá un huevito chico.',
  ])('las claras o el huevo con otra forma también: %s', (paso) => {
    expect(problemas(conPaso(paso), ctxQueso()).some((x) => x.includes('alergia declarada a huevo'))).toBe(true)
  })

  it.each(['Seguí estas ideas claras.', 'Con instrucciones claras, es fácil.'])('"claras" como adjetivo no es huevo: %s', (paso) => {
    expect(validarReceta(conPaso(paso), ctxQueso()).ok).toBe(true)
  })

  it.each([
    ['gluten', 'Pasalos por harina.'],
    ['gluten', 'Rallá un poco de pan.'],
    ['gluten', 'Servilos apanados.'],
    ['leche', 'Mojalos en leche de almendras.'],
    ['leche', 'Agregá una cucharada de crema.'],
    ['pescado', 'Usá pescadito blanco.'],
  ])('detección amplia (%s): %s', (alergeno, paso) => {
    const ctx = ctxQueso({ alergias: [alergeno as 'gluten' | 'leche' | 'pescado'] })
    expect(problemas(conPaso(paso), ctx).some((x) => x.startsWith('En el paso 7') && x.includes(`alergia declarada a ${alergeno}`))).toBe(true)
  })

  it('"las yemas de los dedos" no es huevo', () => {
    expect(validarReceta(conPaso('Apretá el pan rallado con las yemas de los dedos.'), ctxQueso()).ok).toBe(true)
  })

  it('un candidato cuyo ingrediente principal tiene un alérgeno no pasa (no se puede reemplazar)', () => {
    expect(validarCandidato(ctxQueso({ alergias: ['leche'] }), CANDIDATO_QUESO).problemas)
      .toContain('El ingrediente principal de «Bastones de queso horneados» (Queso muzzarella) tiene leche, y tiene alergia declarada a eso.')
  })
})

describe('validarReceta: reglas "rechaza" del perfil', () => {
  const noVerde: Regla = { texto: 'No come nada verde', condiciones: [{ tipo: 'color', valor: 'verde' }], efecto: 'rechaza' }

  it('una regla que se cumple sobre los atributos de la base → falla', () => {
    const ctx = ctxQueso({ reglas: [noVerde], desde: prep('chauchas_hervidas'), base: prep('brocoli_hervido') })
    expect(validarCandidato(ctx, { cambio: 'forma', seMantiene: [] }).problemas).toContain('Choca con su regla «No come nada verde» (color=verde).')
  })

  it('la misma regla con una base de otro color pasa', () => {
    expect(validarReceta(recetaQueso(), ctxQueso({ reglas: [noVerde] })).ok).toBe(true)
  })

  it('todas las condiciones tienen que cumplirse', () => {
    const doble: Regla = { texto: 'Lo crocante frío no', condiciones: [{ tipo: 'textura', valor: 'crocante' }, { tipo: 'temperatura', valor: 'frio' }], efecto: 'rechaza' }
    expect(validarReceta(recetaQueso(), ctxQueso({ reglas: [doble] })).ok).toBe(true)
  })

  it('las reglas "requiere" no se validan acá', () => {
    const requiere: Regla = { texto: 'Solo frío', condiciones: [{ tipo: 'temperatura', valor: 'caliente' }], efecto: 'requiere' }
    expect(validarReceta(recetaQueso(), ctxQueso({ reglas: [requiere] })).ok).toBe(true)
  })

  it('una regla sobre el plato se mira contra la presentación', () => {
    const noHondo: Regla = { texto: 'No usa plato hondo', condiciones: [{ tipo: 'plato', valor: 'hondo' }], efecto: 'rechaza' }
    expect(problemas(conTexto('presentacion', 'En su bol, al lado de sus papas.'), ctxQueso({ reglas: [noHondo] })))
      .toContain('Choca con su regla «No usa plato hondo» (plato=hondo).')
    expect(validarReceta(recetaQueso(), ctxQueso({ reglas: [noHondo] })).ok).toBe(true)
  })

  it('"No come nada mezclado" con una base mezclada → falla', () => {
    const ctx = ctxQueso({ desde: prep('pure_papa'), base: prep('fideos_manteca_queso') })
    expect(validarCandidato(ctx, { cambio: 'forma', seMantiene: [] }).problemas).toContain('Choca con su regla «No come nada mezclado» (presentacion=mezclado).')
  })
})

describe('validarReceta: presentación separada y sin mezclas', () => {
  it('una base con salsa → falla si no acepta nada con salsa', () => {
    const ctx = ctxQueso({ reglas: [], desde: prep('milanesa_carne_horno'), base: prep('milanesa_napolitana') })
    expect(validarCandidato(ctx, { cambio: 'textura', seMantiene: [] }).problemas).toContain(
      '«Milanesa a la napolitana (sin huevo)» se sirve con salsa y todavía no acepta nada así: tiene que ir separado.',
    )
  })

  it('la misma base pasa ese chequeo si ya acepta lo que viene con salsa', () => {
    const ctx = ctxQueso({ reglas: [], desde: prep('milanesa_carne_horno'), base: prep('milanesa_napolitana'), presentacionesAceptadas: ['con_salsa'] })
    expect(validarCandidato(ctx, { cambio: 'textura', seMantiene: [] }).problemas.some((x) => x.includes('tiene que ir separado'))).toBe(false)
  })

  it.each([
    ['un relleno', 'Rellená cada bastón con jamón.'],
    ['un guiso', 'Serví todo junto en un guiso.'],
    ['salsa por encima', 'Terminá con salsa de tomate por encima.'],
    ['salsa por encima', 'Bañalos con un poco de salsa.'],
  ])('%s en los pasos → falla', (_que, paso) => {
    expect(problemas(conPaso(paso), ctxQueso()).some((x) => x.includes('todavía no acepta mezclas'))).toBe(true)
  })

  it('"guisantes" y "cazuela" no son un guiso', () => {
    expect(validarReceta(conPaso('Calentá el aceite en una cazuela; si tenés, sumá unos guisantes al costado.'), ctxQueso()).ok).toBe(true)
  })

  it('una negación lejana no niega la mezcla', () => {
    expect(problemas(conPaso('Sin apuro, terminá con salsa por encima.'), ctxQueso()).some((x) => x.includes('todavía no acepta mezclas'))).toBe(true)
  })

  it('"sin salsa por encima" y "las salsas van aparte" pasan', () => {
    expect(validarReceta(conTexto('presentacion', 'Separados, sin salsa por encima; si quiere ketchup, va aparte para mojar.'), ctxQueso()).ok).toBe(true)
  })

  it('si ya acepta lo mezclado, un relleno pasa', () => {
    expect(validarReceta(conPaso('Rellená cada bastón con más queso.'), ctxQueso({ presentacionesAceptadas: ['mezclado'] })).ok).toBe(true)
  })
})

describe('validarReceta: ingredientes y gramos', () => {
  const con = (alimentoId: string, gramos: number) => recetaQueso({
    ingredientes: [{ alimentoId: 'queso_muzzarella', nombre: '', gramos: 40 }, { alimentoId, nombre: '', gramos }],
  })

  it('un alimentoId que no existe → falla', () => {
    expect(problemas(con('queso_dambo', 10), ctxQueso())).toEqual([expect.stringContaining('«queso_dambo» no existe en el catálogo')])
  })

  it('un genérico (otro_<grupo>) → falla', () => {
    expect(problemas(con('otro_lacteo', 10), ctxQueso())).toEqual([expect.stringContaining('es un genérico')])
  })

  it.each([[4], [301], [0], [Number.NaN]])('%s g → falla', (g) => {
    expect(problemas(con('pan_rallado', g), ctxQueso()).some((x) => x.includes('fuera de lo razonable'))).toBe(true)
  })

  it.each([[5], [300]])('%s g pasa', (g) => {
    const r = recetaQueso({ ingredientes: [{ alimentoId: 'queso_muzzarella', nombre: '', gramos: 300 }, { alimentoId: 'pan_rallado', nombre: '', gramos: g }] })
    expect(validarReceta(r, ctxQueso()).ok).toBe(true)
  })

  it('sin ingredientes → falla', () => {
    expect(problemas(recetaQueso({ ingredientes: [] }), ctxQueso())).toContain('La receta no tiene ingredientes.')
  })

  it('el ingrediente principal tiene que ser el de la preparación base', () => {
    const r = recetaQueso({ ingredientes: [{ alimentoId: 'queso_muzzarella', nombre: '', gramos: 20 }, { alimentoId: 'pan_rallado', nombre: '', gramos: 30 }] })
    expect(problemas(r, ctxQueso())).toEqual([expect.stringContaining('tiene que ser «Queso muzzarella»')])
  })
})

describe('problemasPorTipo (el desglose de la eval de recetas)', () => {
  it('separa alergias, cambio, lenguaje y el resto, y validarReceta los devuelve en ese orden', () => {
    const r = recetaQueso({
      cambio: 'forma', comoOfrecer: 'Si come todo, mejor.',
      ingredientes: [...recetaQueso().ingredientes, { alimentoId: 'huevo', nombre: '', gramos: 3 }],
    })
    const p = problemasPorTipo(r, ctxQueso())
    expect(p.cambio).toEqual([expect.stringContaining('El cambio declarado es la forma')])
    expect(p.alergias).toEqual([expect.stringContaining('«Huevo» tiene huevo')])
    expect(p.ingredientes).toEqual([expect.stringContaining('3 g está fuera de lo razonable')])
    expect(p.lenguaje).toEqual([expect.stringContaining('«Si come»')])
    expect([p.reglas, p.mezclas, p.textos, p.aporte]).toEqual([[], [], [], []])
    expect(validarReceta(r, ctxQueso()).problemas).toEqual([...p.cambio, ...p.alergias, ...p.ingredientes, ...p.lenguaje])
  })
})

describe('validarReceta: aporte con la tabla', () => {
  it('calcularAporte: por100g × gramos ÷ 100, sumado y redondeado', () => {
    const a = calcularAporte([{ alimentoId: 'queso_muzzarella', gramos: 40 }, { alimentoId: 'leche', gramos: 10 }])
    expect(a.calcio_mg).toBe(213.3) // 505 × 0,4 + 113 × 0,1
    expect(a.energia_kcal).toBe(126.1)
  })

  it('un aporte que no es el de la tabla (el del LLM) → falla', () => {
    const r = recetaQueso()
    expect(problemas({ ...r, aporte: { ...r.aporte, calcio_mg: 900 } }, ctxQueso())).toEqual([
      expect.stringContaining('calcio_mg: 900 en la receta'),
    ])
  })
})

describe('validarReceta: lenguaje', () => {
  it.each([
    ['que termine', 'Esperá a que termine el plato.'],
    ['que se lo termine', 'Lo importante es que se lo termine.'],
    ['que termine de comer', 'Esperá a que termine de comer.'],
    ['una probadita más', 'Pedile UNA PROBADITA MÁS.'],
    ['un bocado más', 'Si puede, un bocado más.'],
    ['premio', 'Si lo prueba, dale un premio.'],
    ['premialo', 'Premialo cuando lo toque.'],
    ['recompensa', 'Usá una recompensa.'],
    ['si come', 'Si come todo, puede levantarse.'],
    ['si se lo come', 'Si se lo come, festejalo.'],
    ['tiene que comer', 'Tiene que comer al menos dos.'],
    ['obligar', 'No hace falta obligarlo.'],
    ['forzar', 'Sin forzarlo.'],
    ['escondé', 'Escondé el queso adentro.'],
    ['esconder (negado)', 'Nada va escondido.'],
    ['disimulá', 'Disimulá el sabor con ketchup.'],
    ['ocultar', 'El queso queda oculto.'],
    ['que no se dé cuenta', 'Así no se da cuenta… que no se dé cuenta.'],
    ['sin que lo note', 'Servilo sin que lo note.'],
    ['suplemento', 'Sumale un suplemento de calcio.'],
    ['dosis', 'Dale la dosis de siempre.'],
    ['gotas de vitamina', 'Agregá gotas de vitamina D.'],
    ['dieta de eliminación', 'Probá una dieta sin gluten.'],
    ['sin gluten ni caseína', 'Mejor sin gluten ni caseína.'],
    ['juzgar', 'Las papas fritas son comida chatarra.'],
    ['sacar un alimento seguro', 'Dejá de darle papas fritas.'],
  ])('%s → falla', (_que, texto) => {
    const p = problemas(conTexto('comoOfrecer', `Ofrecelo sin pedirle que lo coma. ${texto}`), ctxQueso())
    expect(p.length).toBeGreaterThan(0)
    expect(p.every((x) => x.startsWith('En cómo ofrecerlo aparece «'))).toBe(true)
  })

  it('cita la frase tal como está escrita, con tildes y mayúsculas', () => {
    expect(problemas(conTexto('nombre', 'Bastones para que NO SE DÉ CUENTA'), ctxQueso())[0])
      .toContain('En el nombre aparece «que NO SE DÉ CUENTA»')
  })

  it('mira todos los textos: nombre, pasos, porqué, presentación, cómo ofrecerlo y transparencia', () => {
    const r = recetaQueso({
      nombre: 'Bastones premio', pasos: ['Escondé el queso.'], porQue: 'Tiene que comer calcio.',
      presentacion: 'Disimulado entre las papas.', comoOfrecer: 'Una probadita más.', transparencia: 'Que no se dé cuenta.',
    })
    const lugares = problemas(r, ctxQueso()).map((x) => x.split(' aparece')[0])
    expect(lugares).toEqual(expect.arrayContaining(['En el nombre', 'En el paso 1', 'En el porqué', 'En la presentación', 'En cómo ofrecerlo', 'En la transparencia']))
  })

  it.each([
    'Horneá hasta que termine de dorarse.',
    'Apretá con fuerza para que el pan rallado se pegue.',
    'Si lo toca, lo huele o lo deja, también cuenta.',
    'Ofrecelo sin pedirle que lo coma; que esté en el plato ya es un avance.',
    'Servilo igual de 8 a 15 veces antes de cambiar algo.',
    'Agregá un poco más de queso si se desarma.',
    'Horneá hasta que termine de ablandarse.',
    'Los bastones tienen que terminar de dorarse en el horno.',
    'Hay que probar que estén tibios antes de servir.',
    'Cociná hasta que no se vea el líquido.',
  ])('frase permitida: %s', (texto) => {
    expect(validarReceta(conTexto('comoOfrecer', texto), ctxQueso()).ok).toBe(true)
  })

  it('un texto vacío → falla', () => {
    expect(problemas(conTexto('comoOfrecer', '  '), ctxQueso())).toContain('Falta cómo ofrecerlo.')
  })
})
