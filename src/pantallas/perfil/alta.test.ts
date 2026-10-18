import { describe, expect, it } from 'vitest'
import type { DatosBasicos, ErrorApi, PerfilBorrador } from '../../../shared/contratos'
import tomas from '../../../data/sinteticos/tomas.json'
import fixture from '../../../fixtures/perfil-inicial.json'
import {
  agregarAlergiaOtra, alergenoDeTexto, alergiasRespondidas, altaInicial, citaVigente, faltanDe, pedidoPerfilInicial, pideDatosManuales,
  quitarAlergiaOtra, revisarAlta, sanearExtraidos, textoFaltan, tocarAlergia, tocarAlergiaOtra, tocarSinAlergias,
} from './alta'
import { armarCrearPerfilReq } from './borrador'
import { textoOtrasAlergias } from './textos'

const respuesta = fixture as PerfilBorrador
const datosTomas = tomas.datos as DatosBasicos
const sinDatos: PerfilBorrador = { acepta: respuesta.acepta, rechaza: respuesta.rechaza, reglas: respuesta.reglas }
const error = (status: number, codigo: ErrorApi['error']['codigo'], detalle?: unknown) =>
  ({ status, cuerpo: { error: { codigo, mensaje: '…', reintentable: false, ...(detalle === undefined ? {} : { detalle }) } } })

describe('el pedido a /api/perfil-inicial', () => {
  it('en el alta por voz va solo el texto', () => {
    expect(pedidoPerfilInicial('Tomás tiene 6 años')).toEqual({ texto: 'Tomás tiene 6 años' })
  })
  it('en la transición va con los datos a mano', () => {
    expect(pedidoPerfilInicial('Come papas', datosTomas)).toEqual({ datos: datosTomas, texto: 'Come papas' })
  })
})

describe('transición hasta A8b: ¿pedir los datos a mano?', () => {
  it('sí con 400 entrada_invalida por `datos` (o sin detalle)', () => {
    expect(pideDatosManuales(error(400, 'entrada_invalida', [{ path: ['datos'], message: 'Required' }]))).toBe(true)
    expect(pideDatosManuales(error(400, 'entrada_invalida'))).toBe(true)
  })
  it('no si el problema es otro campo, u otro error', () => {
    expect(pideDatosManuales(error(400, 'entrada_invalida', [{ path: ['texto'], message: 'Required' }]))).toBe(false)
    expect(pideDatosManuales(error(502, 'proveedor_caido'))).toBe(false)
    expect(pideDatosManuales(error(422, 'audio_no_entendido'))).toBe(false)
  })
})

describe('sanearExtraidos', () => {
  it('deja el fixture v5 de Tomás como está', () => {
    expect(sanearExtraidos(respuesta.datos)).toEqual(respuesta.datos)
  })
  it('sin cita no hay dato; fuera del vocabulario, tampoco', () => {
    const d = sanearExtraidos({
      nombre: { valor: 'Ana', cita: '' }, edad: { valor: 40, cita: 'tiene cuarenta' }, sexo: { valor: 'otro', cita: 'x' },
      alergiasMencionadas: [{ valor: 'huevo', cita: 'alérgica al huevo' }, { valor: 'huevo', cita: 'otra vez' }, { valor: 'kiwi', cita: 'kiwi' }],
      alertas: [{ valor: 'bajo_peso' }], dieta: { valor: 'sin_gluten_caseina', cita: 'sin gluten ni caseína' },
    })
    expect(d).toEqual({ alergiasMencionadas: [{ valor: 'huevo', cita: 'alérgica al huevo' }], alertas: [], dieta: { valor: 'sin_gluten_caseina', cita: 'sin gluten ni caseína' } })
  })
  it('una respuesta sin `datos` (A antes de A8b) no tiene nada extraído', () => {
    expect(sanearExtraidos(undefined)).toBeUndefined()
  })
})

describe('"Esto entendí" desde el audio de Tomás', () => {
  const extraidos = sanearExtraidos(respuesta.datos)
  const inicial = altaInicial(extraidos)

  it('prellena los datos básicos, pero NINGUNA alergia', () => {
    expect(inicial.form).toMatchObject({ nombre: 'Tomás', edad: '6', sexo: 'masculino', pesoKg: '21', tallaCm: '116', dieta: 'ninguna', alertas: [] })
    expect(inicial.form.alergias).toEqual([])
    expect(inicial.sinAlergias).toBe(false)
    expect(faltanDe(respuesta, extraidos)).toEqual([])
  })

  it('no se puede crear hasta que el padre toque el huevo', () => {
    const r = revisarAlta(inicial, respuesta)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(Object.keys(r.errores)).toEqual(['alergias'])
    const confirmado = tocarAlergia(inicial, 'huevo')
    expect(revisarAlta(confirmado, respuesta)).toEqual({ ok: true, datos: datosTomas })
  })

  it('el cuerpo de POST /api/perfil no lleva `datos` ni `faltan` del borrador', () => {
    const r = revisarAlta(tocarAlergia(inicial, 'huevo'), respuesta)
    if (!r.ok) throw new Error('debería poder crearse')
    const req = armarCrearPerfilReq(r.datos, respuesta)
    expect(req).toEqual({ datos: tomas.datos, borrador: tomas.borrador })
  })

  it('la cita se muestra mientras el valor sea el que dijo', () => {
    expect(citaVigente(extraidos?.edad, '6')).toBe('Tiene seis años')
    expect(citaVigente(extraidos?.edad, '7')).toBeUndefined()
    expect(citaVigente(extraidos?.pesoKg, '21,0')).toBe('pesa veintiún kilos')
    expect(citaVigente(extraidos?.nombre, ' tomas ')).toBe('te cuento de Tomás')
    expect(citaVigente(undefined, 'x')).toBeUndefined()
  })
})

describe('alergias: respuesta explícita', () => {
  const base = altaInicial(undefined)

  it('"No tiene alergias" cuenta como respuesta y saca las marcadas', () => {
    expect(alergiasRespondidas(base)).toBe(false)
    const con = tocarAlergia(tocarAlergia(base, 'soja'), 'huevo')
    expect(con.form.alergias).toEqual(['huevo', 'soja'])
    const no = tocarSinAlergias(con)
    expect(no).toMatchObject({ sinAlergias: true, form: { alergias: [] } })
    expect(alergiasRespondidas(no)).toBe(true)
  })

  it('marcar una alergia apaga "No tiene alergias"; destocar la última deja sin respuesta', () => {
    const otra = tocarAlergia(tocarSinAlergias(base), 'mani')
    expect(otra).toMatchObject({ sinAlergias: false, form: { alergias: ['mani'] } })
    expect(alergiasRespondidas(tocarAlergia(otra, 'mani'))).toBe(false)
  })

  it('si dijo que no tiene, igual hay que confirmarlo', () => {
    const extraidos = sanearExtraidos({ alergiasMencionadas: [], alertas: [], sinAlergias: { valor: true, cita: 'no tiene alergias' } })
    const a = altaInicial(extraidos)
    expect(a.sinAlergias).toBe(false)
    expect(faltanDe(respuesta, extraidos)).not.toContain('alergias')
    expect(alergiasRespondidas(a)).toBe(false)
  })
})

describe('lo que falta', () => {
  it('una respuesta 200 sin `datos` deja nombre, edad, sexo y alergias en faltan', () => {
    expect(faltanDe(sinDatos, undefined)).toEqual(['nombre', 'edad', 'sexo', 'alergias'])
  })

  it('suma lo que no vino aunque `faltan` no lo diga, y respeta lo que sí dijo', () => {
    const b: PerfilBorrador = { acepta: [], rechaza: [], reglas: [], faltan: ['edad'] }
    const extraidos = sanearExtraidos({ nombre: { valor: 'Ana', cita: 'Ana' }, edad: { valor: 7, cita: 'siete' }, alergiasMencionadas: [], alertas: [] })
    expect(faltanDe(b, extraidos)).toEqual(['edad', 'sexo', 'alergias', 'acepta', 'rechaza'])
    expect(textoFaltan(faltanDe(b, extraidos))).toBe('su edad, su sexo, si tiene alergias y algo que coma seguro')
    expect(textoFaltan(['rechaza'])).toBe('')
  })

  it('con datos a mano (transición) solo puede faltar la respuesta de alergias', () => {
    expect(faltanDe(sinDatos, undefined, { ...datosTomas, alergias: [] })).toEqual(['alergias'])
    expect(faltanDe(sinDatos, undefined, datosTomas)).toEqual([])
    const a = altaInicial(undefined, datosTomas)
    expect(a.form.alergias).toEqual(['huevo']) // las marcó a mano en PasoDatos: ya están confirmadas
    expect(revisarAlta(a, sinDatos)).toEqual({ ok: true, datos: datosTomas })
  })

  it('para crear hacen falta nombre, edad de 1 a 18, sexo, alergias y un alimento seguro', () => {
    const vacio = tocarSinAlergias(altaInicial(undefined))
    const r = revisarAlta(vacio, { acepta: [] }, 'Ana')
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(Object.keys(r.errores).sort()).toEqual(['acepta', 'edad', 'nombre', 'sexo'])
      expect(r.errores.acepta).toContain('Ana')
    }
    const lleno = { ...vacio, form: { ...vacio.form, nombre: 'Ana', edad: '19', sexo: 'femenino' as const } }
    const r2 = revisarAlta(lleno, { acepta: [{ nombre: 'Yogur', preparacionId: null, atributos: {} }] })
    expect(r2.ok).toBe(false)
    if (!r2.ok) expect(Object.keys(r2.errores)).toEqual(['edad'])
    const ok = revisarAlta({ ...lleno, form: { ...lleno.form, edad: '7' } }, { acepta: [{ nombre: 'Yogur', preparacionId: null, atributos: {} }] })
    expect(ok).toEqual({ ok: true, datos: { nombre: 'Ana', edad: 7, sexo: 'femenino', alergias: [], alertas: [], dieta: 'ninguna' } })
  })
})

describe('(v5.8) las otras alergias, las que no están en la lista', () => {
  const extraidos = sanearExtraidos({
    alergiasMencionadas: [],
    otrasAlergiasMencionadas: [
      { valor: 'kiwi', cita: 'es alérgica al kiwi' }, { valor: 'Kiwi', cita: 'el kiwi' }, { valor: 'colorante rojo', cita: 'y al colorante rojo' },
      { valor: 'maní', cita: 'al maní' }, { valor: 'durazno', cita: '' },
    ],
    alertas: [],
  })
  const lista = { ...altaInicial(undefined), form: { ...altaInicial(undefined).form, nombre: 'Ana', edad: '7', sexo: 'femenino' as const } }
  const yogur = { acepta: [{ nombre: 'Yogur', preparacionId: null, atributos: {} }] }

  it('las mencionadas llegan como sugerencias: sin cita no hay, sin repetir y sin las de siempre', () => {
    expect(extraidos?.otrasAlergiasMencionadas).toEqual([
      { valor: 'kiwi', cita: 'es alérgica al kiwi' }, { valor: 'colorante rojo', cita: 'y al colorante rojo' },
    ])
    expect(altaInicial(extraidos).form.alergiasOtras).toEqual([]) // nada se guarda sin que el padre la toque
  })

  it('mencionar una otra cuenta como hablar de alergias (faltan), pero hay que tocarla para que sea respuesta', () => {
    const b: PerfilBorrador = { ...respuesta, faltan: ['alergias'] }
    expect(faltanDe(b, extraidos)).not.toContain('alergias')
    const a = altaInicial(extraidos)
    expect(alergiasRespondidas(a)).toBe(false)
    const tocada = tocarAlergiaOtra(a, 'kiwi')
    expect(tocada.form.alergiasOtras).toEqual(['kiwi'])
    expect(alergiasRespondidas(tocada)).toBe(true)
    expect(tocarAlergiaOtra(tocada, 'Kiwi').form.alergiasOtras).toEqual([])
  })

  it('sumar a mano: sin vacías ni repetidas; si es una de las de siempre, marca esa', () => {
    let a = agregarAlergiaOtra(lista, '  colorante   rojo ')
    a = agregarAlergiaOtra(a, 'Colorante rojo')
    a = agregarAlergiaOtra(a, '   ')
    expect(a.form.alergiasOtras).toEqual(['colorante rojo'])
    const mani = agregarAlergiaOtra(a, 'Maní')
    expect(mani.form).toMatchObject({ alergias: ['mani'], alergiasOtras: ['colorante rojo'] })
    expect(alergenoDeTexto('frutos secos')).toBe('frutos_secos')
    expect(alergenoDeTexto('kiwi')).toBeUndefined()
    expect(quitarAlergiaOtra(a, 'COLORANTE ROJO').form.alergiasOtras).toEqual([])
  })

  it('"No tiene alergias" saca también las otras; sumar una lo apaga', () => {
    const con = agregarAlergiaOtra(lista, 'kiwi')
    const no = tocarSinAlergias(con)
    expect(no).toMatchObject({ sinAlergias: true, form: { alergiasOtras: [] } })
    expect(agregarAlergiaOtra(no, 'durazno')).toMatchObject({ sinAlergias: false, form: { alergiasOtras: ['durazno'] } })
  })

  it('van en datos.alergiasOtras al crear el perfil; sin otras, el campo no va', () => {
    const r = revisarAlta(agregarAlergiaOtra(agregarAlergiaOtra(lista, 'kiwi'), 'colorante rojo'), yogur)
    expect(r).toEqual({ ok: true, datos: { nombre: 'Ana', edad: 7, sexo: 'femenino', alergias: [], alergiasOtras: ['kiwi', 'colorante rojo'], alertas: [], dieta: 'ninguna' } })
    const sinOtras = revisarAlta(tocarAlergia(lista, 'huevo'), yogur)
    expect(sinOtras.ok && 'alergiasOtras' in sinOtras.datos).toBe(false)
  })

  it('con datos a mano (transición), una otra alergia ya es respuesta', () => {
    expect(faltanDe(sinDatos, undefined, { ...datosTomas, alergias: [], alergiasOtras: ['kiwi'] })).toEqual([])
  })

  it('la nota: cuáles revisamos en cada receta y cuáles no', () => {
    expect(textoOtrasAlergias(['kiwi', 'colorante rojo'], ['colorante rojo']))
      .toBe('Kiwi lo revisamos en cada receta. «Colorante rojo» no lo podemos revisar ingrediente por ingrediente: tenelo en cuenta.')
    expect(textoOtrasAlergias(['kiwi', 'durazno'], [])).toBe('Kiwi y durazno los revisamos en cada receta.')
    expect(textoOtrasAlergias(['sal', 'colorante rojo'], ['sal', 'colorante rojo']))
      .toBe('«Sal» y «Colorante rojo» no los podemos revisar ingrediente por ingrediente: tenelo en cuenta.')
    expect(textoOtrasAlergias([], [])).toBe('')
  })
})
