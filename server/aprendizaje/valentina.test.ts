// v5.4 · Valentina, el tercer chico sintético (PLAN.md §10.5): 6 semanas de comidas (del 7/9 al 18/10), todas las comidas
// del día, reglas de la familia de contexto y una que los datos contradicen. El aprendizaje tiene que encontrar solo sus
// reglas ocultas, y la base de conocimiento de la receta creativa tiene que tener con qué trabajar en cada comida.
import { describe, expect, it } from 'vitest'
import { MOMENTO } from '../../shared/contratos.js'
import { progresoDe } from '../datos/tablero.js'
import { alimentosPrueba, catalogoPrueba, comidasSinteticas, ninoDoc, sintetico } from '../datos/prueba/catalogos.js'
import { conocimientoDe } from '../grafo/conocimiento.js'
import { objetivosPara } from '../nutricion/objetivos.js'
import { exposiciones } from './aceptacion.js'
import { queAprendi } from './aprendi.js'
import { cumple } from './condiciones.js'
import { calcularEstado } from './estado.js'

const catalogo = catalogoPrueba()
const alimentos = alimentosPrueba()
const HOY = '2026-10-18' // el último día de su historial
const s = sintetico('valentina')
const nino = ninoDoc(s, '2026-09-07T07:00:00-03:00')
const comidas = comidasSinteticas(s, alimentos, catalogo)
const estado = calcularEstado(nino, comidas, catalogo)
const cargado = { nino, comidas, catalogo, alimentos, objetivo: objetivosPara(s.datos.edad, s.datos.sexo) }
const estadoDe = (prep: string) => estado.estados.get(prep)

describe('Valentina: el historial', () => {
  it('6 semanas, del lunes 7/9 a hoy (18/10), con 3 a 5 comidas por día y todas las comidas del día', () => {
    expect(s.comidas[0]?.dia).toBe('2026-09-07')
    expect(s.comidas.at(-1)?.dia).toBe(HOY)
    const porDia = new Map<string, number>()
    for (const c of s.comidas) porDia.set(c.dia, (porDia.get(c.dia) ?? 0) + 1)
    expect(porDia.size).toBe(42)
    for (const [dia, n] of porDia) expect(n, dia).toBeGreaterThanOrEqual(3)
    for (const [dia, n] of porDia) expect(n, dia).toBeLessThanOrEqual(5)
    expect(new Set(s.comidas.map((c) => c.momento))).toEqual(new Set(MOMENTO))
  })

  it('ninguna comida tiene pescado (su alergia) y cada preparación va en una comida que el catálogo le permite', () => {
    expect(s.datos.alergias).toEqual(['pescado'])
    for (const c of comidas) {
      for (const it of c.items) {
        for (const i of it.ingredientes) expect(alimentos.get(i.alimentoId)?.alergenos, `${c.dia} ${i.alimentoId}`).not.toContain('pescado')
        expect(catalogo.get(it.preparacionId)?.momentos, `${c.dia} ${c.momento} ${it.preparacionId}`).toContain(c.momento)
      }
    }
  })

  it('cada respuesta tiene su cita en el relato, y la familia cuenta las marcas', () => {
    for (const c of s.comidas) for (const r of c.respuestas) expect(c.relato?.transcripcion).toContain(r.cita)
    expect(s.borrador.acepta.find((a) => a.preparacionId === 'leche_chocolatada')?.marca).toBe('Conaprole')
    expect(s.comidas.some((c) => c.relato?.transcripcion.includes('Maestro Cubano'))).toBe(true)
  })
})

describe('Valentina: reglas ocultas', () => {
  const cobertura = (condiciones: Parameters<typeof cumple>[0]) =>
    estado.observaciones.flatMap((x, i) => (cumple(condiciones, x.atributos, x.contexto) ? [i] : [])).join(',')

  it.each(s.reglasOcultas.map((r) => [r.id, r] as const))('encuentra %s', (_, regla) => {
    const objetivo = cobertura(regla.condiciones)
    const hallado = estado.aprendidos.find(
      (p) =>
        p.resultado === regla.resultado &&
        (cobertura(p.condiciones) === objetivo ||
          (p.condiciones.length === regla.condiciones.length && regla.condiciones.every((c) => p.condiciones.some((d) => d.tipo === c.tipo && d.valor === c.valor)))),
    )
    expect(hallado, `${regla.id}: ${regla.texto}`).toBeDefined()
  })

  it('lo que se muestra incluye las cuatro (dulce, blando y caliente, en granos, cuando se tocan)', () => {
    const mostrados = estado.patrones.map((p) => p.clave)
    for (const clave of ['sabor=dulce → acepta', 'textura=blando ∧ temperatura=caliente → rechaza', 'forma=granos → rechaza', 'distribucion=tocandose → rechaza']) {
      expect(mostrados).toContain(clave)
    }
  })

  it('sus datos confirman la investigación de lo mezclado y de la comida que se toca (y no borran nada)', () => {
    expect(estado.confirmados.map((p) => p.clave)).toEqual(expect.arrayContaining(['presentacion=mezclado → rechaza', 'distribucion=tocandose → rechaza']))
    expect(estado.borrados).toEqual([])
  })

  it('el pollo desmenuzado es blando pero tibio: lo come (manda la combinación, no lo blando solo)', () => {
    expect(estadoDe('pollo_desmenuzado')?.estado).toBe('acepta')
    expect(estado.patrones.map((p) => p.clave)).not.toContain('textura=blando → rechaza')
  })
})

describe('Valentina: repertorio y exposiciones', () => {
  it('repertorio al final: sus 13 seguros + 6 que entraron en estas semanas', () => {
    const acepta = [...estado.estados.values()].filter((e) => e.estado === 'acepta').map((e) => e.prepId).sort()
    expect(acepta).toEqual([
      'banana_pisada', 'bastones_boniato_fritos', 'bastones_zanahoria_horno', 'copos_maiz', 'frutilla_pisada', 'galletitas_agua',
      'leche_chocolatada', 'licuado_banana_leche', 'manzana_bastones', 'milanesa_carne_horno', 'milanesa_lentejas_horno',
      'nuggets_pollo_caseros', 'papas_fritas_baston', 'pizza_muzzarella', 'pollo_desmenuzado', 'pure_papa', 'pure_zapallo', 'tostadas', 'yogur_vainilla',
    ])
    expect(s.borrador.acepta).toHaveLength(13)
  })

  it('la escalera completa: el puré de zapallo, de "lo dejó en el plato" a comerlo todo', () => {
    expect(estadoDe('pure_zapallo')?.pasos.slice(0, 6)).toEqual(['nada', 'toco', 'probo', 'poco', 'mitad', 'todo'])
    expect(estadoDe('pure_zapallo')?.estado).toBe('acepta')
  })

  it('exposiciones en curso, cada una en su escalón (tostadas con queso, puré de lentejas, jugo de naranja…)', () => {
    const expo = exposiciones(estado.estados)
    expect(expo.find((e) => e.preparacionId === 'tostadas_queso')).toMatchObject({ veces: 7, mejorPaso: 'mitad' })
    expect(expo.find((e) => e.preparacionId === 'pure_lentejas')).toMatchObject({ veces: 6, mejorPaso: 'probo' })
    expect(expo.find((e) => e.preparacionId === 'jugo_naranja_colado')).toMatchObject({ veces: 5, mejorPaso: 'mitad' })
    expect(expo.length).toBeGreaterThanOrEqual(10)
  })

  it('trabada: el brócoli, 11 veces sin pasar de tocarlo, recién ahí cuenta como rechazo (§8: 10 exposiciones)', () => {
    expect(estadoDe('brocoli_hervido')).toMatchObject({ veces: 11, estado: 'rechaza', mejorPaso: 'toco' })
    const brocoliAl = (hasta: string) => calcularEstado(nino, comidas, catalogo, { hasta }).estados.get('brocoli_hervido')
    expect(brocoliAl('2026-10-10')).toMatchObject({ veces: 9, estado: 'en_proceso' })
    expect(brocoliAl('2026-10-11')).toMatchObject({ veces: 10, estado: 'rechaza' })
  })

  it('contradicción: contaron "no come verduras", pero los bastones de zanahoria y el puré de zapallo entran por lo dulce', () => {
    const hasta = comidas.filter((c) => c.dia <= '2026-09-18')
    const textos = hasta.flatMap((c, i) =>
      queAprendi(calcularEstado(nino, hasta.slice(0, i), catalogo), calcularEstado(nino, hasta.slice(0, i + 1), catalogo), c, nino.reglas)
        .filter((a) => a.tipo === 'contradiccion')
        .map((a) => `${c.dia} ${a.texto}`),
    )
    expect(textos[0]).toBe(
      '2026-09-18 Contaste: "No come verduras". Pero esta vez comió bastones de zanahoria horneados, y ya van 3 veces que come algo así. ¿Actualizo la regla?',
    )
  })
})

describe('Valentina: tablero', () => {
  it('19 preparaciones, sin alerta de repertorio chico; la semana tiene comidas hasta hoy', () => {
    const p = progresoDe(cargado, { hasta: HOY })
    expect(p.aceptadas).toBe(19)
    expect(p.alertas.map((a) => a.tipo)).not.toContain('repertorio_chico')
    expect(p.frase).toMatch(/^Esta semana Valentina cubrió \d de 8 nutrientes\./)
    expect(p.dias.at(-1)?.dia ?? HOY).toBe(HOY)
    expect(p.proximoPaso).toBeTruthy()
  })
})

describe('Valentina: la base de conocimiento de la receta creativa (conocimientoDe)', () => {
  const conocimiento = (momento?: (typeof MOMENTO)[number]) => conocimientoDe(cargado, { hoy: HOY, azar: () => 0.4, ...(momento ? { momento } : {}) })

  it.each(MOMENTO)('%s: tiene alimentos seguros que van en esa comida, y el foco parte de uno de ellos', (momento) => {
    const k = conocimiento(momento)
    const paraLaComida = k.seguros.filter((p) => p.momentos?.includes(momento))
    expect(paraLaComida.length).toBeGreaterThanOrEqual(3)
    expect(paraLaComida.map((p) => p.id)).toContain(k.foco.desdeId)
  })

  it('le faltan al menos 2 nutrientes y ninguno de los ricos que propone tiene pescado', () => {
    const k = conocimiento('cena')
    expect(k.nutrientes.length).toBeGreaterThanOrEqual(2)
    for (const n of k.nutrientes) for (const r of n.ricos) expect(alimentos.get(r.alimentoId)?.alergenos).not.toContain('pescado')
  })

  it('el texto para el LLM trae lo que rechaza, lo que está en exposición, sus patrones y las reglas de la familia', () => {
    const { texto, alergias, reglas } = conocimiento('almuerzo')
    expect(alergias).toEqual(['pescado'])
    expect(reglas.map((r) => r.texto)).toEqual(['Come solo en su plato con divisiones', 'Que las comidas no se toquen', 'No come verduras'])
    expect(texto).toContain('Alergias: pescado')
    expect(texto).toContain('Brócoli hervido (sabor_olor)')
    expect(texto).toMatch(/En exposición .*Tostadas con queso gratinado, bien doradas \(7 veces\)/)
    expect(texto).toContain('Lo blando y caliente todavía no lo acepta')
    expect(texto).toContain('Reglas de la familia: Come solo en su plato con divisiones · Que las comidas no se toquen · No come verduras.')
  })
})
