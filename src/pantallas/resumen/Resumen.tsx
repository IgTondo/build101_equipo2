// C8 · Resumen para el nutricionista (PLAN.md §9). Ruta: /resumen?nino=
// Los números los calcula el servidor; el texto se redacta solo con esos números. Acá se lee, se copia y se imprime.
// Es para otro profesional: "Copiar" primero y una hoja sobria, el texto con sus rótulos y debajo los mismos números
// en tablas.
import { Check, Copy } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState, type RefObject } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import type { ResumenRes } from '../../../shared/contratos'
import { Cargando, ErrorConReintento } from '../../componentes/Estados'
import { PerfilNoEncontrado } from '../../componentes/PerfilNoEncontrado'
import { Button } from '../../componentes/ui/button'
import { Skeleton } from '../../componentes/ui/skeleton'
import { pedirConMeta } from '../../lib/api'
import { useNinoActivo } from '../../lib/nino'
import { useApi } from '../../lib/useApi'
import { NumerosDeLaSemana } from './NumerosDeLaSemana'
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
    if (e === 'copiado') {
      toast.success('Listo para pegar.')
      reloj.current = window.setTimeout(() => setEstado('nada'), 2500)
    } else if (e === 'seleccionado') {
      toast('Texto seleccionado: copialo desde el menú.')
    }
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

  const copiado = estado === 'copiado'
  return (
    <Button size="lg" onClick={copiar} className="w-full print:hidden">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={copiado ? 'si' : 'no'}
          className="inline-flex items-center gap-2.5"
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.6, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 30 }}
        >
          {copiado ? <Check aria-hidden="true" strokeWidth={3} /> : <Copy aria-hidden="true" />}
          {copiado ? 'Copiado' : 'Copiar'}
        </motion.span>
      </AnimatePresence>
    </Button>
  )
}

// "Repertorio: acepta 6…" → el rótulo en negrita. El texto lo redacta el servidor con esos rótulos (server/resumen/texto.ts);
// una línea sin rótulo se muestra tal cual. Se copia el texto original, no esto.
const ROTULO = /^([A-ZÁÉÍÓÚÑ][^:.\n]{2,48}:)\s+(.+)$/

function TextoResumen({ texto }: { texto: string }) {
  const [apertura, ...lineas] = texto.split('\n').map((l) => l.trim()).filter(Boolean)
  return (
    <div className="flex flex-col gap-3.5 text-pino">
      <p className="text-lg leading-snug text-pretty">{apertura}</p>
      {lineas.map((l, i) => {
        if (l === ACLARACION) return <p key={i} className="mt-1 text-sm text-musgo">{l}</p>
        const m = ROTULO.exec(l)
        return (
          <p key={i} className="leading-relaxed text-pretty tabular-nums">
            {m ? <><strong>{m[1]}</strong> {m[2]}</> : l}
          </p>
        )
      })}
    </div>
  )
}

function HojaCargando() {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border p-5" aria-hidden="true">
      <Skeleton className="h-6 w-1/2" />
      <Skeleton className="mt-2 h-4 w-full" />
      <Skeleton className="h-4 w-11/12" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="mt-2 h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
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
      <header className="flex flex-col gap-1.5">
        <h1 className="text-3xl font-black">Resumen para el nutricionista</h1>
        {/* La aclaración va siempre; si el texto ya la trae, no se repite. */}
        {!(estado.tipo === 'ok' && estado.datos.datos.texto.includes(ACLARACION)) && <p className="text-musgo">{ACLARACION}</p>}
      </header>

      {estado.tipo === 'cargando' && (
        <>
          <Cargando texto="Armando el resumen de la semana…" />
          <HojaCargando />
        </>
      )}
      {estado.tipo === 'error' && (estado.error.codigo === 'no_encontrado'
        ? <PerfilNoEncontrado />
        : <ErrorConReintento error={estado.error} reintentar={estado.reintentar} />)}
      {estado.tipo === 'ok' && (
        <>
          {/* Copiar primero: es para lo que se abre la pantalla. El aviso global ya dice si son datos de ejemplo. */}
          <BotonCopiar texto={estado.datos.datos.texto} destino={textoRef} />
          <article className="rs-hoja flex flex-col rounded-2xl border bg-card print:rounded-none print:border-0" aria-label="Resumen de la semana">
            <div ref={textoRef} className="px-5 py-5 select-text print:px-0">
              <TextoResumen texto={estado.datos.datos.texto} />
            </div>
            <div className="border-t px-5 py-5 print:px-0">
              <NumerosDeLaSemana progreso={estado.datos.datos.progreso} />
            </div>
            <p className="border-t px-5 py-3 text-xs text-musgo print:px-0">
              <time dateTime={estado.datos.datos.generadoISO}>{fechaLegible(estado.datos.datos.generadoISO)}</time>
            </p>
          </article>
        </>
      )}

      <Button asChild variant="outline" className="print:hidden">
        <Link to={{ pathname: '/tablero', search }}>Volver a la semana</Link>
      </Button>
    </>
  )
}
