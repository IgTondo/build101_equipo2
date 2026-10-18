import { describe, expect, it } from 'vitest'
import type { Progreso, Sugerencia } from '../../shared/contratos'
import progresoFixture from '../../fixtures/progreso.json'
import type { ComponentePlato } from '../../shared/contratos'
import {
  componenteNuevo, enDosRenglones, listaEnCastellano, restoDelPlato, textoArmando,
  comidaRecienPorHora, comidasDelDia, elegirSugerencia, encaja, lineaPorQue, primeraFrase, proximaComida, rutaRecetaComida, rutaRecetaNueva, sugerenciasDe, ultimosSinRepetir,
  type ComidaDelDia,
} from './proximaComida'

const c = (momento: ComidaDelDia['momento'], hora: string): ComidaDelDia => ({ momento, fechaISO: `2026-10-17T${hora}:00-03:00` })
const sig = (comidas: ComidaDelDia[], hora: number) => proximaComida(comidas, hora).etiqueta

describe('proximaComida', () => {
  it('sigue la secuencia desayuno → almuerzo → cena → desayuno de mañana', () => {
    expect(sig([c('desayuno', '08:30')], 9)).toBe('Para el almuerzo')
    expect(sig([c('desayuno', '08:30'), c('almuerzo', '12:30')], 13)).toBe('Para la cena')
    expect(sig([c('desayuno', '08:30'), c('almuerzo', '12:30'), c('cena', '20:30')], 21)).toBe('Para mañana: desayuno')
    expect(proximaComida([c('cena', '20:30')], 21)).toEqual({ momento: 'desayuno', manana: true, etiqueta: 'Para mañana: desayuno' })
  })

  it('la merienda y la colación llevan a la principal que sigue', () => {
    expect(sig([c('merienda', '17:00')], 17)).toBe('Para la cena')
    expect(sig([c('colacion', '10:30')], 10)).toBe('Para el almuerzo')
    expect(sig([c('colacion', '16:30')], 16)).toBe('Para la cena')
  })

  it('cuenta la comida más avanzada del día, no la última en cargarse', () => {
    expect(sig([c('cena', '20:30'), c('colacion', '21:00')], 21)).toBe('Para mañana: desayuno')
    expect(sig([c('almuerzo', '12:30'), c('desayuno', '08:00')], 13)).toBe('Para la cena')
  })

  it('nunca sugiere una comida que ya pasó por la hora', () => {
    expect(sig([c('desayuno', '08:30')], 16)).toBe('Para la cena')
    expect(sig([c('almuerzo', '12:30')], 22)).toBe('Para mañana: desayuno')
  })

  it('sin comidas hoy, por la hora', () => {
    expect([7, 9, 10, 14, 15, 21, 22, 23].map((h) => sig([], h))).toEqual([
      'Para el desayuno', 'Para el desayuno', 'Para el almuerzo', 'Para el almuerzo',
      'Para la cena', 'Para la cena', 'Para mañana: desayuno', 'Para mañana: desayuno',
    ])
  })

  it('preselecciona al registrar la comida que acaba de terminar', () => {
    expect([8, 13, 17, 21].map(comidaRecienPorHora)).toEqual(['desayuno', 'almuerzo', 'merienda', 'cena'])
  })
})

describe('comidasDelDia', () => {
  const dias = [{ dia: '2026-10-17', comidas: [{ id: 'a', momento: 'desayuno', fechaISO: '2026-10-17T08:00:00-03:00', items: [] }] }] as unknown as Progreso['dias']
  it('junta las del progreso con la recién registrada, sin repetir', () => {
    expect(comidasDelDia(dias, '2026-10-17', [{ id: 'a', momento: 'desayuno', fechaISO: 'x' }])).toHaveLength(1)
    expect(comidasDelDia(dias, '2026-10-17', [{ id: 'b', momento: 'almuerzo', fechaISO: 'x' }]).map((x) => x.momento)).toEqual(['desayuno', 'almuerzo'])
    expect(comidasDelDia(dias, '2026-10-18')).toEqual([])
    expect(comidasDelDia(undefined, '2026-10-17')).toEqual([])
  })
})

const s = (tipo: Sugerencia['tipo'], preparacionId: string, grupo?: Sugerencia['grupo']): Sugerencia =>
  ({ tipo, preparacionId, nombre: preparacionId, probAcepta: 0.5, aporte: {}, porQue: '', ...(grupo ? { grupo } : {}) })

describe('elegirSugerencia', () => {
  it('encaja según los momentos del catálogo (v5.2); lo que no está en el catálogo no encaja', () => {
    expect(encaja('desayuno', s('segura', 'leche_chocolatada'))).toBe(true)
    expect(encaja('almuerzo', s('segura', 'leche_chocolatada'))).toBe(false)
    expect(encaja('cena', s('un_paso', 'yogur_vainilla'))).toBe(false)
    expect(encaja('almuerzo', s('un_paso', 'bastones_queso_horno'))).toBe(true)
    for (const id of ['milanesa_carne_horno', 'papas_fritas_baston', 'bastones_queso_horno', 'nuggets_pollo_horno']) {
      expect(encaja('desayuno', s('un_paso', id)), id).toBe(false)
    }
    expect(encaja('cena', s('un_paso', 'algo_nuevo', 'verdura'))).toBe(false)
  })

  it('prefiere un_paso, después mas_nutritiva, después segura, entre las que encajan', () => {
    const lista = [s('segura', 'leche_chocolatada'), s('un_paso', 'nuggets_pollo_horno'), s('mas_nutritiva', 'yogur_vainilla')]
    expect(elegirSugerencia({ sugerencias: lista }, 'almuerzo')?.preparacionId).toBe('nuggets_pollo_horno')
    expect(elegirSugerencia({ sugerencias: lista }, 'desayuno')?.preparacionId).toBe('yogur_vainilla')
    const soloSegura = [s('segura', 'leche_chocolatada'), s('un_paso', 'nuggets_pollo_horno')]
    expect(elegirSugerencia({ sugerencias: soloSegura }, 'desayuno')?.tipo).toBe('segura')
  })

  it('nunca muestra una que no encaja: si ninguna encaja, null (la tarjeta calma); sin sugerencias, null', () => {
    expect(elegirSugerencia({ sugerencias: [s('segura', 'leche_chocolatada'), s('mas_nutritiva', 'yogur_vainilla')] }, 'cena')).toBeNull()
    expect(elegirSugerencia({ sugerencias: [s('un_paso', 'milanesa_carne_horno'), s('segura', 'papas_fritas_baston')] }, 'desayuno')).toBeNull()
    expect(elegirSugerencia({ sugerencias: [] }, 'cena')).toBeNull()
    expect(elegirSugerencia({}, 'cena')).toBeNull()
  })

  it('si B filtró para esta comida (Progreso.momento), confía en B; si filtró para otra, vuelve a mirar el catálogo', () => {
    const lista = [s('segura', 'algo_de_su_casa'), s('mas_nutritiva', 'tostadas_queso')]
    expect(elegirSugerencia({ sugerencias: lista, momento: 'desayuno' }, 'desayuno')?.preparacionId).toBe('tostadas_queso')
    expect(elegirSugerencia({ sugerencias: [s('segura', 'algo_de_su_casa')], momento: 'desayuno' }, 'desayuno')?.preparacionId).toBe('algo_de_su_casa')
    expect(elegirSugerencia({ sugerencias: lista, momento: 'desayuno' }, 'cena')).toBeNull()
  })

  it('con el fixture: bastones de queso para el almuerzo y la cena, el yogur para el desayuno', () => {
    const p = progresoFixture as unknown as Progreso
    expect(elegirSugerencia(p, 'almuerzo')?.preparacionId).toBe('bastones_queso_horno')
    expect(elegirSugerencia(p, 'cena')?.preparacionId).toBe('bastones_queso_horno')
    expect(elegirSugerencia(p, 'desayuno')?.preparacionId).toBe('yogur_vainilla')
  })

  it('sin sugerencias usa el proximoPaso, si encaja', () => {
    const p = progresoFixture as unknown as Progreso
    const una = sugerenciasDe({ proximoPaso: p.proximoPaso })
    expect(una).toHaveLength(1)
    expect(una[0].tipo).toBe('un_paso')
    expect(elegirSugerencia({ proximoPaso: p.proximoPaso }, 'desayuno')).toBeNull()
  })
})

describe('textos y rutas', () => {
  it('primeraFrase deja una línea', () => {
    expect(primeraFrase('Se parece a sus papas: cambia solo el ingrediente. Ya los vio 5 veces')).toBe('Se parece a sus papas: cambia solo el ingrediente.')
    expect(primeraFrase('La come 14 de cada 14 veces')).toBe('La come 14 de cada 14 veces.')
  })

  it('lineaPorQue deja lo principal en una línea', () => {
    expect(lineaPorQue('Se parece a sus papas: cambia solo el ingrediente. Ya los vio 5 veces')).toBe('Se parece a sus papas.')
    expect(lineaPorQue('La come 14 de cada 14 veces y aporta 232 mg de calcio por porción')).toBe('La come 14 de cada 14 veces y aporta 232 mg de calcio por porción.')
  })

  it('la receta lleva el candidato, el nutriente y la comida', () => {
    const r = rutaRecetaComida('tomas', s('un_paso', 'bastones_queso_horno'), 'almuerzo', 'calcio_mg')
    expect(r).toBe('/receta?nino=tomas&preparacionId=bastones_queso_horno&nutriente=calcio_mg&momento=almuerzo')
    expect(rutaRecetaComida('tomas', s('un_paso', 'x'), 'cena')).not.toContain('motor')
  })

  it('Generar receta lleva la comida y nueva=1, sin preparación (la receta creativa, v5.4)', () => {
    expect(rutaRecetaNueva('tomas', 'cena')).toBe('/receta?nino=tomas&momento=cena&nueva=1')
  })
})

describe('ultimosSinRepetir (anteriores de la receta creativa, v5.4)', () => {
  it('saca los repetidos dejando el más nuevo y se queda con los últimos', () => {
    expect(ultimosSinRepetir(['a', 'b', 'a', 'c'])).toEqual(['b', 'a', 'c'])
    expect(ultimosSinRepetir(['a', 'b', 'c', 'd'], 2)).toEqual(['c', 'd'])
    expect(ultimosSinRepetir([])).toEqual([])
  })
})

describe('la comida completa de la tarjeta (v5.7)', () => {
  const comp = (nombre: string, nuevo = false, rol: ComponentePlato['rol'] = 'guarnicion'): ComponentePlato =>
    ({ rol, preparacionId: nuevo ? 'nuevo_x' : nombre, nombre, nuevo, gramos: 100, grupo: 'verdura' })
  const plato = (...componentes: ComponentePlato[]) => ({
    platoCompleto: { componentes, aporte: {} as never, cubreDelDia: {} },
  })

  it('arma la lista en castellano: "a", "a y b", "a, b y c"', () => {
    expect(listaEnCastellano([])).toBe('')
    expect(listaEnCastellano(['puré'])).toBe('puré')
    expect(listaEnCastellano(['puré', 'zanahoria'])).toBe('puré y zanahoria')
    expect(listaEnCastellano(['puré', 'zanahoria', 'pan'])).toBe('puré, zanahoria y pan')
  })

  it('la "y" pasa a "e" antes de "i" o "hi" (no antes de "hie")', () => {
    expect(listaEnCastellano(['papa', 'hinojo'])).toBe('papa e hinojo')
    expect(listaEnCastellano(['arroz', 'Isla flotante'])).toBe('arroz e Isla flotante')
    expect(listaEnCastellano(['agua', 'hielo'])).toBe('agua y hielo')
    expect(listaEnCastellano(['pan', 'yogur'])).toBe('pan y yogur')
  })

  it('lo que completa el plato: sin el nuevo, en minúscula, sin repetir', () => {
    const r = plato(comp('Milanesas de ricota y pollo', true, 'principal'), comp('Puré de papa'), comp('Bastones de zanahoria', false, 'verdura_fruta'))
    expect(restoDelPlato(r)).toBe('con puré de papa y bastones de zanahoria')
    expect(componenteNuevo(r)?.nombre).toBe('Milanesas de ricota y pollo')
    expect(restoDelPlato(plato(comp('Tarta', true), comp('Pan'), comp('Pan'), comp('Leche', false, 'lacteo'), comp('Banana'))))
      .toBe('con pan, leche y banana')
  })

  it('sin platoCompleto o sin nada más, no hay línea (la tarjeta muestra solo el nombre)', () => {
    expect(restoDelPlato({})).toBeNull()
    expect(componenteNuevo({})).toBeNull()
    expect(restoDelPlato(plato(comp('Tarta', true)))).toBeNull()
  })

  it('mientras arma, lo dice con la comida y el nombre', () => {
    expect(textoArmando('cena', 'Valentina')).toBe('Armando la cena de Valentina…')
    expect(textoArmando('desayuno', null)).toBe('Armando el desayuno…')
    expect(textoArmando('almuerzo')).toBe('Armando el almuerzo…')
  })

  it('el mensaje del servidor, en dos renglones por los dos puntos', () => {
    expect(enDosRenglones('Todavía no sabemos qué come Rosario en el desayuno: registrá un desayuno o contanos qué come.'))
      .toEqual(['Todavía no sabemos qué come Rosario en el desayuno:', 'registrá un desayuno o contanos qué come.'])
    expect(enDosRenglones('Esta vez no salió una receta segura. Probá otra idea.')).toEqual(['Esta vez no salió una receta segura. Probá otra idea.', null])
  })
})

describe('(v5.9) la próxima comida no cuenta lo que todavía no pasó', () => {
  it('a las 9:35, un almuerzo cargado para las 13:50 no hace saltar a la cena', () => {
    const ahora = Date.parse('2026-10-18T09:35:00-03:00')
    const dias = [{ dia: '2026-10-18', comidas: [
      { id: 'a', momento: 'desayuno', fechaISO: '2026-10-18T07:13:00-03:00', items: [] },
      { id: 'b', momento: 'almuerzo', fechaISO: '2026-10-18T13:50:00-03:00', items: [] },
    ] }] as unknown as Progreso['dias']
    const hoy = comidasDelDia(dias, '2026-10-18', [], ahora)
    expect(hoy.map((c) => c.momento)).toEqual(['desayuno'])
    expect(proximaComida(hoy, 9).momento).toBe('almuerzo')
  })
})
