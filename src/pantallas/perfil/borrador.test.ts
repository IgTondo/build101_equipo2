import { describe, expect, it } from 'vitest'
import type { DatosBasicos, Perfil, PerfilBorrador } from '../../../shared/contratos'
import lucia from '../../../data/sinteticos/lucia.json'
import tomas from '../../../data/sinteticos/tomas.json'
import perfilFixture from '../../../fixtures/perfil.json'
import {
  agregarAcepta, agregarRechaza, agregarRegla, agruparPreparaciones, alternarAlergia, armarCrearPerfilReq, cambiarMotivo,
  formDesde, formVacio, leerNumero, quitarAcepta, quitarRegla, renombrarAcepta, sumarNota, textoVeces, validarDatos,
} from './borrador'

const borradorTomas = tomas.borrador as PerfilBorrador

describe('datos básicos', () => {
  it('lee números con coma decimal y deja vacío lo opcional', () => {
    expect(leerNumero('')).toBeUndefined()
    expect(leerNumero(' 21,5 ')).toBe(21.5)
    expect(leerNumero('116')).toBe(116)
    expect(leerNumero('12a')).toBeNaN()
  })

  it('valida lo obligatorio con mensajes calmos', () => {
    const v = validarDatos(formVacio())
    expect(v.ok).toBe(false)
    if (!v.ok) expect(Object.keys(v.errores).sort()).toEqual(['edad', 'nombre', 'sexo'])
    const fuera = validarDatos({ ...formVacio(), nombre: 'Ana', edad: '19', sexo: 'femenino', pesoKg: '900' })
    expect(fuera.ok).toBe(false)
    if (!fuera.ok) expect(Object.keys(fuera.errores).sort()).toEqual(['edad', 'pesoKg'])
  })

  it('arma DatosBasicos sin campos opcionales vacíos', () => {
    const v = validarDatos({ ...formVacio(), nombre: '  Ana   Laura ', edad: '7', sexo: 'femenino', suplementos: '  ' })
    expect(v).toEqual({ ok: true, datos: { nombre: 'Ana Laura', edad: 7, sexo: 'femenino', alergias: [], alertas: [], dieta: 'ninguna' } })
  })

  it('ida y vuelta: los datos de Tomás pasan por el formulario sin cambios', () => {
    expect(validarDatos(formDesde(tomas.datos as never))).toEqual({ ok: true, datos: tomas.datos })
    expect(validarDatos(formDesde(lucia.datos as never))).toEqual({ ok: true, datos: lucia.datos })
    // v5.8 · las otras alergias van y vuelven
    const conOtras = { ...(tomas.datos as never as DatosBasicos), alergiasOtras: ['kiwi'] }
    expect(formDesde(conOtras).alergiasOtras).toEqual(['kiwi'])
    expect(validarDatos(formDesde(conOtras))).toEqual({ ok: true, datos: conOtras })
  })

  it('las alergias se alternan en el orden del vocabulario', () => {
    expect(alternarAlergia(['soja'], 'huevo')).toEqual(['huevo', 'soja'])
    expect(alternarAlergia(['huevo', 'soja'], 'huevo')).toEqual(['soja'])
  })
})

describe('"Esto entendí": ediciones del borrador', () => {
  it('quitar y renombrar no mutan el original', () => {
    const b = quitarAcepta(borradorTomas, 0)
    expect(b.acepta).toHaveLength(4)
    expect(borradorTomas.acepta).toHaveLength(5)
  })

  it('renombrar solo de forma conserva la preparación; un nombre nuevo la suelta', () => {
    const forma = renombrarAcepta(borradorTomas, 0, 'papas fritas en BASTONES')
    expect(forma.acepta[0]).toMatchObject({ nombre: 'papas fritas en BASTONES', preparacionId: 'papas_fritas_baston' })
    const otro = renombrarAcepta(borradorTomas, 0, 'Papas noisette')
    expect(otro.acepta[0]).toEqual({ nombre: 'Papas noisette', preparacionId: null, atributos: {} })
    expect(renombrarAcepta(borradorTomas, 0, '   ')).toBe(borradorTomas)
  })

  it('agregar ignora vacíos y repetidos (sin importar tildes)', () => {
    expect(agregarAcepta(borradorTomas, 'pure de papa ').acepta).toHaveLength(6)
    expect(agregarAcepta(borradorTomas, 'Galletitas de AGUA')).toBe(borradorTomas)
    expect(agregarRechaza(borradorTomas, 'Puré de papa')).toBe(borradorTomas)
    expect(agregarRechaza(borradorTomas, 'Tomate').rechaza.at(-1)).toEqual({ nombre: 'Tomate', preparacionId: null, motivo: 'otro' })
  })

  it('cambia el motivo de lo que no come', () => {
    expect(cambiarMotivo(borradorTomas, 1, 'se_tocaban').rechaza[1].motivo).toBe('se_tocaban')
  })

  it('una regla a mano va como rechaza y sin condiciones', () => {
    const b = agregarRegla(borradorTomas, '  que no se   toquen ')
    expect(b.reglas.at(-1)).toEqual({ texto: 'que no se toquen', condiciones: [], efecto: 'rechaza' })
    expect(quitarRegla(b, 0).reglas).toHaveLength(1)
  })
})

describe('armarCrearPerfilReq', () => {
  it('deja el borrador de Lucía igual', () => {
    const req = armarCrearPerfilReq(lucia.datos as never, lucia.borrador as PerfilBorrador)
    expect(req).toEqual({ datos: lucia.datos, borrador: lucia.borrador })
  })

  it('limpia nombres, saca vacíos y repetidos', () => {
    const b: PerfilBorrador = {
      acepta: [
        { nombre: ' Yogur ', preparacionId: null, atributos: {} },
        { nombre: 'yogur', preparacionId: null, atributos: {} },
        { nombre: '  ', preparacionId: null, atributos: {} },
      ],
      rechaza: [], reglas: [{ texto: 'Nada verde', condiciones: [], efecto: 'rechaza' }, { texto: 'nada verde ', condiciones: [], efecto: 'rechaza' }],
      objetivosNutricionista: { calcio_mg: 1000 },
    }
    const { borrador } = armarCrearPerfilReq(lucia.datos as never, b)
    expect(borrador.acepta).toEqual([{ nombre: 'Yogur', preparacionId: null, atributos: {} }])
    expect(borrador.reglas).toHaveLength(1)
    expect(borrador.objetivosNutricionista).toEqual({ calcio_mg: 1000 })
  })
})

describe('vista del perfil', () => {
  const perfil = perfilFixture as Perfil

  it('agrupa las preparaciones por estado, sin perder ninguna', () => {
    const g = agruparPreparaciones(perfil.preparaciones)
    expect(g.acepta.length + g.enProceso.length + g.todaviaNo.length).toBe(perfil.preparaciones.length)
    expect(g.acepta[0].id).toBe('tostadas')
    expect(g.enProceso[0].id).toBe('bastones_queso_horno') // lo más explorado primero
    expect(agruparPreparaciones([{ id: 'x', nombre: 'X', estado: 'rechaza', puntaje: 0, veces: 2 }]).todaviaNo).toHaveLength(1)
  })

  it('cuenta veces en singular y plural', () => {
    expect(textoVeces(1)).toBe('1 vez')
    expect(textoVeces(14)).toBe('14 veces')
  })
})

describe('relato', () => {
  it('el audio nuevo se suma al texto', () => {
    expect(sumarNota('', 'Come fideos.')).toBe('Come fideos.')
    expect(sumarNota('Come arroz. ', 'Y fideos.')).toBe('Come arroz. Y fideos.')
  })
})
