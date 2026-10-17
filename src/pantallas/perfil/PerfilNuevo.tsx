// Crear perfil (C6) y modo jurado (C10). Pasos: datos básicos a mano → relato (voz o texto) → "Esto entendí" →
// POST /api/perfil → el chico nuevo pasa a ser el activo y se va a registrar su primera comida.
// Con ?demo=1 (RUTA_DEMO_JURADO, el QR del pitch) arranca con datos y relato de ejemplo editables.
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { DatosBasicos, PerfilBorrador } from '../../../shared/contratos'
import { api, type ErrorDeApi } from '../../lib/api'
import { guardarNino } from '../../lib/nino'
import { aErrorDeApi } from '../../lib/useApi'
import { armarCrearPerfilReq, formDesde, formVacio, type FormDatos } from './borrador'
import { DATOS_DEMO, RELATO_DEMO } from './demo'
import { PasoDatos } from './PasoDatos'
import { PasoEntendi, PasoEntendiendo } from './PasoEntendi'
import { PasoRelato } from './PasoRelato'
import './perfil.css'

type Paso = 'datos' | 'relato' | 'entendiendo' | 'entendi'

const TITULO: Record<Paso, (nombre: string) => string> = {
  datos: () => 'Sus datos básicos',
  relato: (n) => `Contanos cómo come ${n}`,
  entendiendo: (n) => `Contanos cómo come ${n}`,
  entendi: () => 'Esto entendimos',
}
const NUMERO: Record<Paso, number> = { datos: 1, relato: 2, entendiendo: 3, entendi: 3 }
const TOTAL = 3

export function PerfilNuevo() {
  const [params] = useSearchParams()
  const demo = params.get('demo') === '1'
  const navegar = useNavigate()

  const [paso, setPaso] = useState<Paso>('datos')
  const [form, setForm] = useState<FormDatos>(() => (demo ? formDesde(DATOS_DEMO) : formVacio()))
  const [datos, setDatos] = useState<DatosBasicos | null>(null)
  const [texto, setTexto] = useState(() => (demo ? RELATO_DEMO : ''))
  const [borrador, setBorrador] = useState<PerfilBorrador | null>(null)
  const [creando, setCreando] = useState(false)
  const [errorCrear, setErrorCrear] = useState<ErrorDeApi | null>(null)
  const control = useRef<AbortController | null>(null)
  const refTitulo = useRef<HTMLHeadingElement>(null)
  const pasoAnterior = useRef(paso)

  useEffect(() => () => control.current?.abort(), [])

  // Al cambiar de paso: arriba de todo y foco en el título, para que el lector de pantalla anuncie dónde está.
  useEffect(() => {
    if (pasoAnterior.current === paso) return
    pasoAnterior.current = paso
    window.scrollTo({ top: 0 })
    refTitulo.current?.focus({ preventScroll: true })
  }, [paso])

  const nombre = datos?.nombre ?? (form.nombre.trim() || 'tu hijo o hija')

  async function crear() {
    if (!datos || !borrador || creando) return
    control.current?.abort()
    const c = new AbortController()
    control.current = c
    setCreando(true)
    setErrorCrear(null)
    try {
      const { ninoId } = await api.crearPerfil(armarCrearPerfilReq(datos, borrador), c.signal)
      guardarNino(ninoId)
      navegar(`/registrar?nino=${encodeURIComponent(ninoId)}`)
    } catch (e) {
      if (!c.signal.aborted) { setErrorCrear(aErrorDeApi(e)); setCreando(false) }
    }
  }

  return (
    <div className="pf">
      <header className="pf-encabezado">
        <p className="pf-paso nb-suave">
          Crear perfil · Paso <span className="nb-numero">{NUMERO[paso]}</span> de {TOTAL}
        </p>
        <div className="pf-barra" aria-hidden="true">
          {Array.from({ length: TOTAL }, (_, i) => <span key={i} data-hecho={i < NUMERO[paso] || undefined} />)}
        </div>
        <h1 ref={refTitulo} tabIndex={-1}>{TITULO[paso](nombre)}</h1>
      </header>

      {demo && (paso === 'datos' || paso === 'relato') && (
        <p className="pf-banner-demo">
          <strong>Es un ejemplo: cambialo como quieras.</strong> Se crea un perfil nuevo; el de Tomás no se toca.
        </p>
      )}

      {paso === 'datos' && (
        <PasoDatos form={form} setForm={setForm} alSeguir={(d) => { setDatos(d); setPaso('relato') }} />
      )}
      {paso === 'relato' && (
        <PasoRelato
          nombre={nombre} texto={texto} setTexto={setTexto} textoEjemplo={demo ? RELATO_DEMO : undefined}
          alSeguir={() => setPaso('entendiendo')} alVolver={() => setPaso('datos')}
        />
      )}
      {paso === 'entendiendo' && datos && (
        <PasoEntendiendo
          datos={datos} texto={texto.trim()}
          alListo={(b) => { setBorrador(b); setErrorCrear(null); setPaso('entendi') }}
          alVolver={() => setPaso('relato')}
        />
      )}
      {paso === 'entendi' && datos && borrador && (
        <PasoEntendi
          datos={datos} borrador={borrador} setBorrador={setBorrador}
          creando={creando} errorCrear={errorCrear} alConfirmar={() => void crear()} alVolver={() => setPaso('relato')}
        />
      )}
    </div>
  )
}
