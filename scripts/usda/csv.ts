// Lectura en streaming de los CSV de FoodData Central (food_nutrient.csv de SR Legacy pesa ~36 MB).
import { createReadStream } from 'node:fs'
import type { Readable } from 'node:stream'
import { parse } from 'csv-parse'
import type { Fila } from './logica.js'

/** Filas como objetos con las columnas del encabezado. Acepta una ruta o un stream (los tests pasan CSV inline). */
export async function* filasCsv(fuente: string | Readable): AsyncGenerator<Fila> {
  const entrada = typeof fuente === 'string' ? createReadStream(fuente) : fuente
  const parser = entrada.pipe(parse({ columns: true, bom: true, relax_column_count: true, skip_empty_lines: true }))
  for await (const fila of parser) yield fila as Fila
}
