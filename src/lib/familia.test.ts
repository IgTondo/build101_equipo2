import { describe, expect, it } from 'vitest'
import { agregar, CLAVE_ACTIVO, CLAVE_LISTA, leerLista, quitar, rutaAlCambiar, siguienteActivo, type Almacen, type ChicoGuardado } from './familia'

const AHORA = '2026-10-18T12:00:00.000Z'

/** Un localStorage de mentira (vitest corre en node, sin storage). */
function almacen(inicial: Record<string, string> = {}): Almacen & { datos: Record<string, string> } {
  const datos = { ...inicial }
  return { datos, getItem: (k) => datos[k] ?? null, setItem: (k, v) => { datos[k] = v } }
}

const valentina: ChicoGuardado = { id: 'sint-valentina', nombre: 'Valentina', agregadoISO: '2026-10-01T10:00:00.000Z' }
const tomas: ChicoGuardado = { id: 'sint-tomas', nombre: 'Tomás', agregadoISO: '2026-10-02T10:00:00.000Z' }

describe('leerLista', () => {
  it('sin nada guardado no hay hijos', () => {
    expect(leerLista(almacen(), AHORA)).toEqual([])
  })

  it('migra: un celular con chico activo y sin lista arranca la lista con él', () => {
    expect(leerLista(almacen({ [CLAVE_ACTIVO]: 'sint-lucia' }), AHORA))
      .toEqual([{ id: 'sint-lucia', nombre: null, agregadoISO: AHORA }])
  })

  it('con lista guardada no migra: la lista manda (aunque esté vacía)', () => {
    expect(leerLista(almacen({ [CLAVE_ACTIVO]: 'sint-lucia', [CLAVE_LISTA]: '[]' }), AHORA)).toEqual([])
    expect(leerLista(almacen({ [CLAVE_ACTIVO]: 'sint-lucia', [CLAVE_LISTA]: JSON.stringify([valentina]) }), AHORA)).toEqual([valentina])
  })

  it('un JSON roto o entradas raras no tiran: se descartan, y los repetidos quedan una vez', () => {
    expect(leerLista(almacen({ [CLAVE_LISTA]: '{roto' }), AHORA)).toEqual([])
    expect(leerLista(almacen({ [CLAVE_LISTA]: '{"id":"x"}' }), AHORA)).toEqual([])
    const sucia = [valentina, { id: '' }, { id: 3 }, null, 'x', { ...valentina, nombre: 'Otra' }, { ...tomas, nombre: '  ' }]
    expect(leerLista(almacen({ [CLAVE_LISTA]: JSON.stringify(sucia) }), AHORA)).toEqual([valentina, { ...tomas, nombre: null }])
  })
})

describe('agregar y quitar', () => {
  it('suma al final con la fecha, y no repite', () => {
    const lista = agregar([valentina], 'sint-tomas', null, AHORA)
    expect(lista).toEqual([valentina, { id: 'sint-tomas', nombre: null, agregadoISO: AHORA }])
    expect(agregar(lista, 'sint-tomas', null, '2030-01-01T00:00:00.000Z')).toBe(lista)
  })

  it('le pone o le actualiza el nombre al que ya estaba, sin cambiar su fecha ni el orden', () => {
    const sinNombre = agregar([valentina], 'sint-tomas', null, AHORA)
    const conNombre = agregar(sinNombre, 'sint-tomas', ' Tomás ', '2030-01-01T00:00:00.000Z')
    expect(conNombre).toEqual([valentina, { id: 'sint-tomas', nombre: 'Tomás', agregadoISO: AHORA }])
    // El mismo nombre o ninguno no cambia nada (misma lista: el store no avisa).
    expect(agregar(conNombre, 'sint-tomas', 'Tomás')).toBe(conNombre)
    expect(agregar(conNombre, 'sint-tomas', null)).toBe(conNombre)
    expect(agregar(conNombre, 'sint-valentina', 'Vale')[0]).toEqual({ ...valentina, nombre: 'Vale' })
  })

  it('quitar saca solo a ese; si no estaba, la misma lista', () => {
    const lista = [valentina, tomas]
    expect(quitar(lista, 'sint-valentina')).toEqual([tomas])
    expect(quitar(lista, 'nadie')).toBe(lista)
  })

  it('al quitar al activo se pasa al primero que queda, o a ninguno', () => {
    expect(siguienteActivo([valentina, tomas], 'sint-valentina')).toBe('sint-tomas')
    expect(siguienteActivo([valentina, tomas], 'sint-tomas')).toBe('sint-valentina')
    expect(siguienteActivo([valentina], 'sint-valentina')).toBeNull()
    expect(siguienteActivo([], 'sint-valentina')).toBeNull()
  })
})

describe('rutaAlCambiar', () => {
  it('el inicio, la semana y el perfil se quedan en la misma pantalla con el otro chico', () => {
    expect(rutaAlCambiar('/', 'sint-tomas')).toBe('/?nino=sint-tomas')
    expect(rutaAlCambiar('/tablero', 'sint-tomas')).toBe('/tablero?nino=sint-tomas')
    expect(rutaAlCambiar('/perfil', 'sint-tomas')).toBe('/perfil?nino=sint-tomas')
  })

  it('registrar, la receta y el resumen vuelven al inicio: sus parámetros eran del otro chico', () => {
    expect(rutaAlCambiar('/receta', 'sint-tomas')).toBe('/?nino=sint-tomas')
    expect(rutaAlCambiar('/registrar', 'sint-tomas')).toBe('/?nino=sint-tomas')
    expect(rutaAlCambiar('/resumen', 'sint-tomas')).toBe('/?nino=sint-tomas')
  })

  it('codifica el id', () => {
    expect(rutaAlCambiar('/', 'a b&c')).toBe('/?nino=a+b%26c')
  })
})
