// buscarCandidato(): el de la tarjeta "Más nutritiva" aunque no esté entre los 3 de la evidencia. Sin Mongo: Tomás del
// dataset sintético (§10.5) con los catálogos reales, como lo cargaría cargarNino().
import { describe, expect, it } from 'vitest'
import { alimentosCatalogo, preparacionesCatalogo } from '../datos/catalogos.js'
import { type Cargado, objetivoDe } from '../datos/cargar.js'
import { comidasSinteticas, ninoDoc, sintetico } from '../datos/prueba/catalogos.js'
import { evidenciaDe } from '../grafo/evidencia.js'
import { candidatoEn } from './candidato.js'

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
