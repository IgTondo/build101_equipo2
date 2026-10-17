// B14 (PLAN.md §10.5): el aprendizaje tiene que encontrar solo, a partir de las comidas, las reglas ocultas de
// Tomás y Lucía. Las reglas ocultas son la verdad de base: la app nunca las lee; acá solo se comparan.
import { describe, expect, it } from 'vitest'
import type { Motor, Nutriente } from '../../shared/contratos.js'
import { alimentosPrueba, catalogoPrueba, comidasSinteticas, ninoDoc, sintetico } from '../datos/prueba/catalogos.js'
import { sumarDias } from '../datos/fechas.js'
import { faltanSemana } from '../nutricion/calcular.js'
import { objetivosPara } from '../nutricion/objetivos.js'
import { armarProgreso, semana } from '../nutricion/progreso.js'
import { queAprendi } from './aprendi.js'
import { cambios } from './cadena.js'
import { cumple } from './condiciones.js'
import { calcularEstado } from './estado.js'
import { recomendar } from './recomendador.js'

const catalogo = catalogoPrueba()
const alimentos = alimentosPrueba()
const HOY = '2026-10-16' // el último día del dataset

function preparar(id: 'tomas' | 'lucia') {
  const s = sintetico(id)
  const nino = ninoDoc(s)
  const comidas = comidasSinteticas(s, alimentos, catalogo)
  const estado = calcularEstado(nino, comidas, catalogo)
  return { s, nino, comidas, estado }
}

function recomendacion(id: 'tomas' | 'lucia', motor: Motor = 'grafo', nutriente?: Nutriente) {
  const { s, nino, comidas, estado } = preparar(id)
  const objetivo = objetivosPara(s.datos.edad, s.datos.sexo)
  const sem = semana(comidas, HOY, objetivo)
  const entrada = {
    catalogo: [...catalogo.values()], conocidas: estado.conocidas, estados: estado.estados, alergias: s.datos.alergias,
    reglas: nino.reglas, alimentos, objetivo, observaciones: estado.observaciones, patrones: estado.patrones,
    faltan: faltanSemana(sem.cobertura), coberturaSemana: sem.cobertura,
  }
  return { ...preparar(id), objetivo, sem, entrada, rec: recomendar(entrada, motor, nutriente) }
}

describe.each(['tomas', 'lucia'] as const)('reglas ocultas de %s', (id) => {
  const { s, estado } = preparar(id)
  const cobertura = (condiciones: Parameters<typeof cumple>[0]) =>
    estado.observaciones.flatMap((x, i) => (cumple(condiciones, x.atributos, x.contexto) ? [i] : [])).join(',')

  it.each(s.reglasOcultas.map((r) => [r.id, r] as const))('encuentra %s', (_, regla) => {
    // Encontrada = un patrón aprendido con el mismo resultado y las mismas condiciones, o que cubre exactamente
    // las mismas observaciones (con estos datos, "cremoso ∧ verde" y "verde ∧ puré" son indistinguibles).
    const objetivo = cobertura(regla.condiciones)
    const hallado = estado.aprendidos.find(
      (p) =>
        p.resultado === regla.resultado &&
        (cobertura(p.condiciones) === objetivo ||
          (p.condiciones.length === regla.condiciones.length && regla.condiciones.every((c) => p.condiciones.some((d) => d.tipo === c.tipo && d.valor === c.valor)))),
    )
    expect(hallado, `${regla.id}: ${regla.texto}`).toBeDefined()
  })
})

describe('Tomás (6 años, alergia al huevo)', () => {
  const { estado } = preparar('tomas')
  const estadoDe = (prep: string) => estado.estados.get(prep)?.estado

  it('repertorio al final: sus 5 seguros + las papas al horno en bastones', () => {
    const acepta = [...estado.estados.values()].filter((e) => e.estado === 'acepta').map((e) => e.prepId).sort()
    expect(acepta).toEqual(['galletitas_agua', 'leche_chocolatada', 'milanesa_carne_horno', 'papas_fritas_baston', 'papas_horno_baston', 'tostadas'])
  })

  it('la papa del mentor: las de horno en bastones crocantes sí, las de cubos blandos no (manda la textura, no la cocción)', () => {
    expect(estadoDe('papas_horno_baston')).toBe('acepta')
    expect(estadoDe('papas_horno_cubos')).toBe('en_proceso')
  })

  it('la hamburguesa del mentor: la hamburguesa no, la milanesa sí (se aprende por ítem, no por plato)', () => {
    expect(estadoDe('milanesa_carne_horno')).toBe('acepta')
    expect(estadoDe('hamburguesa_casera')).toBe('en_proceso')
  })

  it('exposiciones: bastones de queso, de "lo dejó en el plato" a "comió la mitad"', () => {
    expect(estado.estados.get('bastones_queso_horno')).toMatchObject({ pasos: ['nada', 'toco', 'probo', 'poco', 'mitad'], mejorPaso: 'mitad', estado: 'en_proceso' })
  })

  it('lo que se muestra incluye las cinco reglas ocultas', () => {
    const mostrados = estado.patrones.map((p) => p.clave)
    for (const clave of [
      'textura=crocante → acepta', 'textura=blando → rechaza', 'textura=jugoso → rechaza',
      'presentacion=mezclado → rechaza', 'presentacion=con_salsa → rechaza',
    ]) {
      expect(mostrados).toContain(clave)
    }
  })

  it('la investigación se confirma con sus datos (crocante, mezclado, con salsa, textura mixta)', () => {
    expect(estado.confirmados.map((p) => p.clave)).toEqual(
      expect.arrayContaining(['textura=crocante → acepta', 'presentacion=mezclado → rechaza', 'presentacion=con_salsa → rechaza', 'textura=mixto → rechaza']),
    )
    expect(estado.borrados).toEqual([])
  })
})

describe('Lucía (10 años)', () => {
  const { estado, nino, comidas } = preparar('lucia')

  it('repertorio al final: 7 preparaciones (sus 5 + arvejas en puré + pollo desmenuzado)', () => {
    const acepta = [...estado.estados.values()].filter((e) => e.estado === 'acepta').map((e) => e.prepId).sort()
    expect(acepta).toEqual(['arroz_con_leche', 'banana_pisada', 'fideos_manteca_queso', 'pollo_desmenuzado', 'pure_arvejas', 'pure_papa', 'yogur_vainilla'])
  })

  it('mismo alimento, otro chico: las papas fritas que Tomás come siempre, Lucía las aparta', () => {
    expect(estado.estados.get('papas_fritas_baston')?.pasos).toEqual(['aparto'])
    expect(estado.patrones.map((p) => p.clave)).toContain('textura=crocante → rechaza')
  })

  it('sus datos borran los patrones de investigación que no le cumplen (crocante → acepta, mezclado → rechaza)', () => {
    expect(estado.borrados.map((p) => p.clave).sort()).toEqual(['presentacion=mezclado → rechaza', 'textura=crocante → acepta'])
  })

  it('contradicción: dijo "nada verde", pero las arvejas en puré las acepta → "¿Actualizo la regla?"', () => {
    const textos = comidas.flatMap((c, i) => {
      const antes = calcularEstado(nino, comidas.slice(0, i), catalogo)
      const despues = calcularEstado(nino, comidas.slice(0, i + 1), catalogo)
      return queAprendi(antes, despues, c, nino.reglas).filter((a) => a.tipo === 'contradiccion').map((a) => `${c.dia} ${a.texto}`)
    })
    expect(textos[0]).toBe('2026-10-15 Contaste: "No come nada verde". Pero aceptó 3 veces arvejas en puré. ¿Actualizo la regla?')
  })
})

describe('qué aprendí, comida por comida (Tomás)', () => {
  const { nino, comidas } = preparar('tomas')
  const aprendizajes = comidas.map((c, i) =>
    queAprendi(calcularEstado(nino, comidas.slice(0, i), catalogo), calcularEstado(nino, comidas.slice(0, i + 1), catalogo), c, nino.reglas),
  )

  it('cuenta cada escalón como avance: "2.ª exposición. Esta vez lo tocó (antes lo dejaba en el plato)"', () => {
    expect(aprendizajes.flat().map((a) => a.texto)).toContain(
      'Bastones de queso horneados: 2.ª exposición. Esta vez lo tocó (antes lo dejaba en el plato). Cada paso cuenta.',
    )
  })

  it('avisa cuando una preparación nueva entra al repertorio y cuando aparece un patrón', () => {
    const textos = aprendizajes.flat().map((a) => a.texto)
    expect(textos.some((t) => t.startsWith('Papas al horno en bastones, crocantes ya es parte de su repertorio'))).toBe(true)
    expect(textos.some((t) => t.startsWith('Nuevo patrón: lo crocante lo acepta'))).toBe(true)
  })

  it('nunca usa lenguaje de presión', () => {
    const prohibidas = ['que termine', 'una probadita más', 'premio', 'si come', 'escondé', 'disimulá', 'suplemento']
    for (const a of aprendizajes.flat()) for (const p of prohibidas) expect(a.texto.toLowerCase()).not.toContain(p)
  })
})

describe('sugerencias: explotar o explorar (§8)', () => {
  it('Tomás: falta calcio; "un pasito" sigue con los bastones de queso (exposición en curso, servidos igual)', () => {
    const { rec } = recomendacion('tomas')
    expect(rec.nutriente).toBe('calcio_mg')
    expect(rec.sugerencias.map((s) => s.tipo)).toEqual(['segura', 'un_paso', 'mas_nutritiva'])
    const unPaso = rec.sugerencias[1]
    expect(unPaso?.preparacionId).toBe('bastones_queso_horno')
    expect(unPaso?.porQue).toContain('cambia solo el ingrediente')
    expect(unPaso?.porQue).toContain('Ya se lo ofreciste 5 veces')
    expect(unPaso?.candidato?.desdeId).toBe('papas_horno_baston')
  })

  it.each(['grafo', 'base'] as const)('[%s] cada candidato cambia UNA sola cosa, respeta la alergia al huevo y se sirve separado', (motor) => {
    const { rec, entrada } = recomendacion('tomas', motor)
    expect(rec.candidatos.length).toBeGreaterThan(2)
    for (const c of rec.candidatos) {
      const cand = catalogo.get(c.preparacionId)
      const desde = entrada.conocidas.get(c.desdeId)
      expect(cand && desde).toBeTruthy()
      if (!cand || !desde) continue
      if (c.cambio !== 'fortificar') expect(cambios(desde, cand)).toEqual([c.cambio])
      expect(cand.ingredientes.some((i) => alimentos.get(i.alimentoId)?.alergenos.includes('huevo'))).toBe(false)
      expect(cand.atributos.presentacion).toBe('separado')
      expect(c.aportePorcion.calcio_mg ?? 0).toBeGreaterThanOrEqual(150)
    }
    expect(rec.candidatos.map((c) => c.preparacionId)).not.toContain('milanesa_carne_con_huevo')
  })

  it('la versión fortificada cuenta solo para lo que agrega: la leche con vitamina D sirve para vitamina D, no para calcio', () => {
    expect(recomendacion('tomas', 'grafo', 'calcio_mg').rec.candidatos.map((c) => c.preparacionId)).not.toContain('leche_chocolatada_fortificada')
    const vitD = recomendacion('tomas', 'grafo', 'vitamina_d_ug').rec.candidatos.find((c) => c.preparacionId === 'leche_chocolatada_fortificada')
    expect(vitD?.cambio).toBe('fortificar')
  })

  it('Lucía: casi sin vitamina C → frutillas pisadas, a un cambio de su banana pisada; nada verde mientras rija su regla', () => {
    const { rec } = recomendacion('lucia')
    expect(rec.nutriente).toBe('vitamina_c_mg')
    expect(rec.sugerencias.find((s) => s.tipo === 'un_paso')?.preparacionId).toBe('frutilla_pisada')
    for (const n of ['calcio_mg', 'hierro_mg', 'fibra_g'] as const) {
      for (const c of recomendacion('lucia', 'grafo', n).rec.candidatos) expect(catalogo.get(c.preparacionId)?.atributos.color).not.toBe('verde')
    }
  })

  it('el switch base / grafo cambia el orden de los candidatos (§4.3)', () => {
    const grafo = recomendacion('tomas', 'grafo').rec.candidatos.map((c) => c.preparacionId)
    const base = recomendacion('tomas', 'base').rec.candidatos.map((c) => c.preparacionId)
    expect(new Set(grafo)).toEqual(new Set(base))
    expect(grafo).not.toEqual(base)
  })
})

describe('tablero "¿está comiendo bien?" con el historial sintético', () => {
  function progreso(id: 'tomas' | 'lucia') {
    const { nino, comidas, estado, objetivo, rec } = recomendacion(id)
    return armarProgreso({
      nino, comidas, objetivo, hoy: HOY, dias: 28, estado, recomendacion: rec,
      estadoHace7: calcularEstado(nino, comidas, catalogo, { hasta: sumarDias(HOY, -7) }),
      estadoHace14: calcularEstado(nino, comidas, catalogo, { hasta: sumarDias(HOY, -14) }),
    })
  }

  it('Tomás: frase, alertas de §10.5 y próximo paso', () => {
    const p = progreso('tomas')
    expect(p.frase).toMatch(/^Esta semana Tomás cubrió \d de 8 nutrientes\. Lo que más le falta: calcio \(\d+%\) y vitamina D \(\d+%\)\. Come 6 preparaciones \(1 más que la semana pasada\)\.$/)
    expect(p.alertas.map((a) => a.tipo)).toEqual(['repertorio_chico'])
    expect(p.proximoPaso?.preparacionId).toBe('bastones_queso_horno')
    expect(p.semana.faltan[0]).toBe('calcio_mg')
    expect(p.semana.energiaPromedioKcal).toBeGreaterThan(0)
    expect(p.grupos.find((g) => g.grupo === 'verdura')?.diasSinComer).toBeNull()
    expect(p.exposiciones.find((e) => e.preparacionId === 'bastones_queso_horno')).toMatchObject({ veces: 5, mejorPaso: 'mitad' })
    expect(p.dias).toHaveLength(10)
  })

  it('Lucía: casi sin vitamina C dispara la alerta y va primero en lo que falta', () => {
    const p = progreso('lucia')
    expect(p.alertas.map((a) => a.tipo)).toEqual(['sin_vitamina_c', 'repertorio_chico'])
    expect(p.semana.faltan[0]).toBe('vitamina_c_mg')
    expect(p.aceptadas).toBe(7)
  })
})
