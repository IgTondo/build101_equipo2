// Alta desde cero por voz (C6, PLAN §5.2). La primera vez que se abre la app (no hay chico activo) y con "Agregar otro
// chico". Una pantalla con una máquina de pasos:
//   bienvenida → relato (audio de hasta 3 min con la guía → /api/transcribir → texto editable)
//   → entendiendo (/api/perfil-inicial solo con el texto) → "Esto entendí" (datos con citas, alergias a confirmar,
//   lo que falta) → POST /api/perfil → el chico nuevo pasa a ser el activo → registrar su primera comida.
// TRANSICIÓN hasta A8b: si /api/perfil-inicial todavía exige `datos` (400 entrada_invalida), se piden a mano (PasoDatos)
// y se reenvía con ellos. Borrar el paso 'datos' cuando A8b esté en main.
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CampoVital, DatosBasicos, DatosExtraidos, PerfilBorrador } from '../../../shared/contratos'
import { api, type ErrorDeApi } from '../../lib/api'
import { guardarNino } from '../../lib/nino'
import { aErrorDeApi } from '../../lib/useApi'
import { altaInicial, faltanDe, sanearExtraidos, type Alta } from './alta'
import { armarCrearPerfilReq, formVacio, type FormDatos } from './borrador'
import { PasoDatos } from './PasoDatos'
import { PasoEntendi, PasoEntendiendo } from './PasoEntendi'
import { PasoRelato } from './PasoRelato'
import './perfil.css'

type Paso = 'bienvenida' | 'relato' | 'entendiendo' | 'datos' | 'entendi'

const TITULO: Record<Paso, string> = {
  bienvenida: 'Contanos de tu hijo',
  relato: 'Contanos de tu hijo',
  entendiendo: 'Entendiendo lo que contaste',
  datos: 'Antes, sus datos básicos',
  entendi: 'Esto entendimos',
}
const NUMERO: Record<Paso, number> = { bienvenida: 0, relato: 1, entendiendo: 2, datos: 2, entendi: 2 }
const TOTAL = 2

/** Lo que se arma al recibir el borrador: el estado de "Esto entendí". */
interface Entendido { borrador: PerfilBorrador; extraidos: DatosExtraidos | undefined; faltan: CampoVital[]; alta: Alta }

export function PerfilNuevo() {
  const navegar = useNavigate()
  const [paso, setPaso] = useState<Paso>('bienvenida')
  const [texto, setTexto] = useState('')
  const [formManual, setFormManual] = useState<FormDatos>(formVacio)
  const [datosManuales, setDatosManuales] = useState<DatosBasicos | undefined>(undefined)
  const [entendido, setEntendido] = useState<Entendido | null>(null)
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

  function alEntender(b: PerfilBorrador) {
    // Si la respuesta no trae `datos` (A antes de A8b), no hay nada extraído: faltanDe() pide nombre, edad, sexo y alergias.
    const extraidos = datosManuales ? undefined : sanearExtraidos(b.datos)
    setEntendido({ borrador: b, extraidos, faltan: faltanDe(b, extraidos, datosManuales), alta: altaInicial(extraidos, datosManuales) })
    setErrorCrear(null)
    setPaso('entendi')
  }

  async function crear(datos: DatosBasicos) {
    if (!entendido || creando) return
    control.current?.abort()
    const c = new AbortController()
    control.current = c
    setCreando(true)
    setErrorCrear(null)
    try {
      // armarCrearPerfilReq copia solo acepta, rechaza, reglas y objetivos: `datos` y `faltan` del borrador no viajan.
      const { ninoId } = await api.crearPerfil(armarCrearPerfilReq(datos, entendido.borrador), c.signal)
      guardarNino(ninoId)
      navegar(`/registrar?nino=${encodeURIComponent(ninoId)}`)
    } catch (e) {
      if (!c.signal.aborted) { setErrorCrear(aErrorDeApi(e)); setCreando(false) }
    }
  }

  return (
    <div className="pf">
      <header className="pf-encabezado">
        {NUMERO[paso] > 0 && (
          <>
            <p className="nb-oculto">Paso {NUMERO[paso]} de {TOTAL}</p>
            <div className="pf-barra" style={{ gridTemplateColumns: `repeat(${TOTAL}, 1fr)` }} aria-hidden="true">
              {Array.from({ length: TOTAL }, (_, i) => <span key={i} data-hecho={i < NUMERO[paso] || undefined} />)}
            </div>
          </>
        )}
        <h1 ref={refTitulo} tabIndex={-1}>{TITULO[paso]}</h1>
      </header>

      {paso === 'bienvenida' && (
        <div className="pf-form pf-bienvenida">
          <p className="pf-bajada">Contalo como se lo contarías a su pediatra, en un audio de hasta 3 minutos o por escrito.</p>
          <button type="button" className="nb-boton" onClick={() => setPaso('relato')}>Empezar</button>
        </div>
      )}
      {paso === 'relato' && (
        <PasoRelato texto={texto} setTexto={setTexto} alSeguir={() => setPaso('entendiendo')} alVolver={() => setPaso('bienvenida')} />
      )}
      {paso === 'entendiendo' && (
        <PasoEntendiendo
          texto={texto.trim()} datos={datosManuales} alListo={alEntender}
          alPedirDatos={() => setPaso('datos')} alVolver={() => setPaso('relato')}
        />
      )}
      {paso === 'datos' && (
        <>
          <PasoDatos
            form={formManual} setForm={setFormManual} textoSeguir="Seguir" compacto
            alSeguir={(d) => { setDatosManuales(d); setPaso('entendiendo') }}
          />
        </>
      )}
      {paso === 'entendi' && entendido && (
        <PasoEntendi
          borrador={entendido.borrador} setBorrador={(borrador) => setEntendido((e) => e && { ...e, borrador })}
          alta={entendido.alta} setAlta={(alta) => setEntendido((e) => e && { ...e, alta })}
          extraidos={entendido.extraidos} faltan={entendido.faltan}
          creando={creando} errorCrear={errorCrear} alConfirmar={(d) => void crear(d)} alVolver={() => setPaso('relato')}
        />
      )}
    </div>
  )
}
