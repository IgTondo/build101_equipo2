// buscarCandidato(): el de la tarjeta "Más nutritiva" aunque no esté entre los 3 de la evidencia. Sin Mongo: Tomás del
// dataset sintético (§10.5) con los catálogos reales, como lo cargaría cargarNino().
import { describe, expect, it } from 'vitest'
import type { Atributos, RegistrarComidaReq } from '../../shared/contratos.js'
import { alimentosCatalogo, preparacionesCatalogo } from '../datos/catalogos.js'
import { type Cargado, objetivoDe } from '../datos/cargar.js'
import { comidasSinteticas, ninoDoc, sintetico } from '../datos/prueba/catalogos.js'
import { resolverComida } from '../datos/resolver.js'
import { evidenciaDe } from '../grafo/evidencia.js'
import { candidatoEn, preparacionesEn } from './candidato.js'

const HOY = '2026-10-16' // el último día del dataset
const AHORA = new Date('2026-10-16T20:00:00-03:00')

function tomas(): Cargado {
  const catalogo = new Map(preparacionesCatalogo())
  const alimentos = new Map(alimentosCatalogo())
  const nino = ninoDoc(sintetico('tomas'))
  return { nino, comidas: comidasSinteticas(sintetico('tomas'), alimentos, catalogo), catalogo, alimentos, objetivo: objetivoDe(nino) }
}

describe('candidatoEn', () => {
  const c = tomas()
  const evidencia = evidenciaDe(c, { nutriente: 'calcio_mg', hoy: HOY, ahora: AHORA })
  const enEvidencia = new Set(evidencia.candidatos.map((x) => x.preparacionId))

  // Cada candidatoEn() recalcula la recomendación entera: se corta en el primero que aparece (con la suite en paralelo,
  // recorrer el catálogo completo pasaba el timeout por defecto).
  it('encuentra un candidato que no está entre los 3 de la evidencia', { timeout: 20_000 }, () => {
    expect(evidencia.candidatos).toHaveLength(3)
    let fuera: ReturnType<typeof candidatoEn>
    for (const id of c.catalogo.keys()) {
      if (enEvidencia.has(id)) continue
      fuera = candidatoEn(c, id, { nutriente: 'calcio_mg', hoy: HOY, ahora: AHORA })
      if (fuera) break
    }
    expect(fuera).toBeDefined()
    expect(fuera).toMatchObject({ cambio: expect.any(String), desdeId: expect.any(String), seMantiene: expect.any(Array) })
    expect(fuera?.aportePorcion.calcio_mg).toBeGreaterThan(0)
  })

  it('el mismo candidato que trae la evidencia sale igual', () => {
    const primero = evidencia.candidatos[0]
    expect(candidatoEn(c, primero.preparacionId, { nutriente: 'calcio_mg', hoy: HOY, ahora: AHORA })).toEqual(primero)
  })

  it('algo que no es candidato (lo que ya acepta, o un id que no existe) → undefined', () => {
    expect(candidatoEn(c, 'papas_fritas_baston', { nutriente: 'calcio_mg', hoy: HOY, ahora: AHORA })).toBeUndefined()
    expect(candidatoEn(c, 'no_existe', { nutriente: 'calcio_mg', hoy: HOY, ahora: AHORA })).toBeUndefined()
  })
})

describe('preparacionesEn (DepsReceta.preparaciones)', () => {
  const MANDIOCA: Atributos = {
    textura: 'crocante', forma: 'baston', color: 'beige', sabor: 'salado', temperatura: 'caliente', presentacion: 'separado', grupo: 'cereal_almidon', coccion: 'frito',
  }
  // Lo que registra el padre con una foto: la visión no lo reconoció en el catálogo (preparacionId null → slug del nombre)
  const comida = (nombre: string, atributos: Atributos, dia: string): RegistrarComidaReq => ({
    ninoId: 'tomas', dia, fechaISO: `${dia}T12:30:00-03:00`, momento: 'almuerzo', conducta: ['tranquilo'], respuestasPreguntas: [],
    analisis: {
      analisisId: `a-${dia}`, sinComida: false, preguntas: [], modelo: 'prueba', ms: 0,
      distribucion: { estado: 'separados', cantidadItems: 1, plato: 'playo' },
      items: [{ idTmp: 'i0', preparacion: nombre, preparacionId: null, porcion: 'mediana', caja: null, confianza: 0.9, atributos, ingredientes: [{ alimentoId: 'papa', gramosEst: 100 }] }],
    },
    respuestas: [{ itemIdTmp: 'i0', cuanto: 'todo', porcion: 'mediana' }],
  })

  function conPropias(): Cargado {
    const c = tomas()
    const { coccion: _, ...sinCoccion } = MANDIOCA
    void _
    const extras = [comida('Bastones de mandioca fritos', MANDIOCA, '2026-10-15'), comida('Papines dorados', sinCoccion, '2026-10-15')]
      .map((req, i) => resolverComida(req, { id: `extra-${i}`, creadoISO: req.fechaISO, alimentos: c.alimentos, catalogo: c.catalogo }))
    const borrador = { ...c.nino.borrador, acepta: [...c.nino.borrador.acepta, { nombre: 'Nuggets de la abuela', preparacionId: null, atributos: { textura: 'crocante' as const } }] }
    return { ...c, nino: { ...c.nino, borrador }, comidas: [...c.comidas, ...extras] }
  }
  const resolver = preparacionesEn(conPropias())

  it('lo del catálogo sale del catálogo', () => {
    expect(resolver('bastones_queso_horno')).toBe(preparacionesCatalogo().get('bastones_queso_horno'))
  })

  it('lo observado por la visión, con los 8 atributos y sus ingredientes, se usa', () => {
    expect(resolver('bastones_de_mandioca_fritos')).toEqual({
      id: 'bastones_de_mandioca_fritos', nombre: 'Bastones de mandioca fritos', atributos: MANDIOCA,
      ingredientes: [{ alimentoId: 'papa', gramos: 100 }],
    })
  })

  it('lo declarado en el perfil con atributos parciales y sin ingredientes no se usa', () => {
    expect(resolver('nuggets_de_la_abuela')).toBeUndefined()
  })

  it('lo observado sin la cocción tampoco', () => {
    expect(resolver('papines_dorados')).toBeUndefined()
    expect(resolver('no_existe')).toBeUndefined()
  })
})
