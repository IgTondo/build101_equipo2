// Formato de la salida de las evals: Markdown por stdout, para la diapositiva y el artefacto de Actions (evals.yml).
// Números con coma decimal, como se leen en Uruguay.

export function tabla(encabezados: string[], filas: (string | number)[][]): string {
  const celda = (x: string | number) => String(x).replace(/\|/g, '\\|').replace(/\n/g, ' ')
  return [
    `| ${encabezados.map(celda).join(' | ')} |`,
    `|${encabezados.map(() => '---').join('|')}|`,
    ...filas.map((f) => `| ${f.map(celda).join(' | ')} |`),
  ].join('\n')
}

/** 0,833 → "83%"; null (no había nada que medir) → "—". */
export function porcentaje(valor: number | null): string {
  return valor === null ? '—' : `${Math.round(valor * 100)}%`
}

/** "5/6 (83%)": la fracción y el porcentaje, para que se vea de cuántos casos sale. */
export function deTotal(ok: number, total: number): string {
  return total ? `${ok}/${total} (${porcentaje(ok / total)})` : '—'
}

export function segundos(ms: number | null): string {
  return ms === null ? '—' : `${(ms / 1000).toFixed(1).replace('.', ',')} s`
}

export function lista(xs: string[]): string {
  return xs.length ? xs.join(', ') : '—'
}

/** "17/10/2026 21:30", en hora de Uruguay (Actions corre en UTC). */
export function fechaUY(fecha = new Date()): string {
  const p = Object.fromEntries(new Intl.DateTimeFormat('es-UY', {
    timeZone: 'America/Montevideo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(fecha).map((x) => [x.type, x.value]))
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`
}

/** El mensaje de un error para la tabla; si es un ErrorIA, con su { motivo, detalle }. */
export function mensajeError(e: unknown): string {
  if (!(e instanceof Error)) return String(e)
  const detalle = (e as { detalle?: unknown }).detalle
  return detalle === undefined ? e.message : `${e.message} ${JSON.stringify(detalle)}`
}
