// C8 · Resumen para el nutricionista (PLAN.md §9). Ruta: /resumen?nino=
// Los números los calcula el servidor; el texto se redacta solo con esos números. Acá se lee y se copia.
import { useEffect, useRef, useState, type RefObject } from 'react'
import { Link, useLocation } from 'react-router-dom'
import type { ResumenRes } from '../../../shared/contratos'
import { Cargando, ErrorConReintento } from '../../componentes/Estados'
import { PerfilNoEncontrado } from '../../componentes/PerfilNoEncontrado'
import { pedirConMeta } from '../../lib/api'
import { useNinoActivo } from '../../lib/nino'
import { useApi } from '../../lib/useApi'
import './resumen.css'

const ACLARACION = 'Valores aproximados, no es un diagnóstico.'

function fechaLegible(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('es-UY', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Montevideo' }).format(d)
}

type Copiado = 'nada' | 'copiado' | 'seleccionado'

function BotonCopiar({ texto, destino }: { texto: string; destino: RefObject<HTMLElement | null> }) {
  const [estado, setEstado] = useState<Copiado>('nada')
  const reloj = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(reloj.current), [])

  function avisar(e: Copiado) {
    setEstado(e)
    window.clearTimeout(reloj.current)
    if (e === 'copiado') reloj.current = window.setTimeout(() => setEstado('nada'), 2500)
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto)
      return avisar('copiado')
    } catch { /* sin permiso o sin contexto seguro: se selecciona el texto */ }
    const el = destino.current
    const sel = window.getSelection()
    if (el && sel) {
      const rango = document.createRange()
      rango.selectNodeContents(el)
      sel.removeAllRanges()
      sel.addRange(rango)
      let ok = false
      try { ok = document.execCommand('copy') } catch { ok = false }
      avisar(ok ? 'copiado' : 'seleccionado')
    }
  }

  return (
    <div className="rs-copiar">
      <button type="button" className="nb-boton" onClick={copiar}>
        {estado === 'copiado' ? 'Copiado' : 'Copiar'}
      </button>
      <p className="rs-copiar-aviso" role="status" aria-live="polite">
        {estado === 'copiado' && 'Listo para pegar.'}
        {estado === 'seleccionado' && 'Texto seleccionado: copialo desde el menú.'}
      </p>
    </div>
  )
}

export function Resumen() {
  const ninoId = useNinoActivo()
  const { search } = useLocation()
  const estado = useApi(
    (senal) => pedirConMeta<ResumenRes>(`/api/resumen?${new URLSearchParams({ ninoId })}`, { timeoutMs: 40_000, senal }),
    [ninoId],
  )
  const textoRef = useRef<HTMLDivElement>(null)

  return (
    <>
      <header className="rs-encabezado">
        <h1>Resumen para el nutricionista</h1>
        {/* La aclaración va siempre; si el texto ya la trae, no se repite. */}
        {!(estado.tipo === 'ok' && estado.datos.datos.texto.includes(ACLARACION)) && <p className="nb-suave">{ACLARACION}</p>}
      </header>

      {estado.tipo === 'cargando' && <Cargando texto="Armando el resumen de la semana…" />}
      {estado.tipo === 'error' && (estado.error.codigo === 'no_encontrado'
        ? <PerfilNoEncontrado />
        : <ErrorConReintento error={estado.error} reintentar={estado.reintentar} />)}
      {estado.tipo === 'ok' && (
        <>
          {/* Copiar primero: es para lo que se abre la pantalla. El aviso global ya dice si son datos de ejemplo. */}
          <BotonCopiar texto={estado.datos.datos.texto} destino={textoRef} />
          <article className="nb-tarjeta rs-tarjeta" aria-label="Resumen de la semana">
            <div ref={textoRef} className="rs-texto">{estado.datos.datos.texto}</div>
            <p className="rs-fecha">
              <time dateTime={estado.datos.datos.generadoISO}>{fechaLegible(estado.datos.datos.generadoISO)}</time>
            </p>
          </article>
        </>
      )}

      <Link className="nb-boton nb-boton-secundario" to={{ pathname: '/tablero', search }}>Volver a la semana</Link>
    </>
  )
}
