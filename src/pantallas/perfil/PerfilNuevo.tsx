// Alta desde cero por voz (C6, PLAN §5.2). La primera vez que se abre la app (no hay chico activo) y con "Agregar otro
// hijo" (desde "Tus hijos" del inicio, con otro chico activo). Una pantalla con una máquina de pasos:
//   bienvenida → relato (audio de hasta 3 min con la guía → /api/transcribir → texto editable)
//   → entendiendo (/api/perfil-inicial solo con el texto) → "Esto entendí" (datos con citas, alergias a confirmar,
//   lo que falta) → POST /api/perfil → el chico nuevo pasa a ser el activo y entra a "Tus hijos" (src/lib/familia.ts)
//   → un festejo corto → registrar su primera comida.
// TRANSICIÓN hasta A8b: si /api/perfil-inicial todavía exige `datos` (400 entrada_invalida), se piden a mano (PasoDatos)
// y se reenvía con ellos. Borrar el paso 'datos' cuando A8b esté en main.
// Arriba, un indicador de los dos pasos (contarlo y revisarlo) que se llena al avanzar. La bienvenida es la primera
// impresión de Nibble: un plato con el micrófono y los bocados alrededor.
import { cn } from 'cn'
import { Check } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CampoVital, DatosBasicos, DatosExtraidos, PerfilBorrador } from '../../../shared/contratos'
import { Celebracion } from '../../componentes/Celebracion'
import { Bocaditos } from '../../componentes/Estados'
import { Button } from '../../componentes/ui/button'
import { api, type ErrorDeApi } from '../../lib/api'
import { recordarHijo } from '../../lib/familia'
import { guardarNino } from '../../lib/nino'
import { aErrorDeApi } from '../../lib/useApi'
import { altaInicial, faltanDe, sanearExtraidos, type Alta } from './alta'
import { armarCrearPerfilReq, formVacio, type FormDatos } from './borrador'
import { PasoDatos } from './PasoDatos'
import { PasoEntendi, PasoEntendiendo } from './PasoEntendi'
import { PasoRelato } from './PasoRelato'
import { Inicial, PlatoBienvenida, SALIDA, SIN_ANILLO, TildeListo } from './Piezas'

type Paso = 'bienvenida' | 'relato' | 'entendiendo' | 'datos' | 'entendi' | 'creado'

const TITULO: Record<Exclude<Paso, 'creado'>, string> = {
  bienvenida: 'Contanos de tu hijo',
  relato: 'Contanos de tu hijo',
  entendiendo: 'Entendiendo lo que contaste',
  datos: 'Antes, sus datos básicos',
  entendi: 'Esto entendimos',
}
const NUMERO: Record<Paso, number> = { bienvenida: 0, relato: 1, entendiendo: 2, datos: 2, entendi: 2, creado: 0 }
/** Los pasos del indicador de arriba. */
const PASOS = ['Contalo', 'Revisalo']
const TOTAL = PASOS.length
/** La bienvenida cuenta lo que va a pasar, en orden. */
const QUE_SIGUE = ['Nos contás de tu hijo', 'Revisás lo que entendimos', 'Registrás su primera comida']
/** Cuánto dura el festejo antes de pasar a registrar. Con movimiento reducido no hay ráfaga: es más corto. */
const FESTEJO_MS = 2200
const FESTEJO_REDUCIDO_MS = 1200

/** Lo que se arma al recibir el borrador: el estado de "Esto entendí". */
interface Entendido { borrador: PerfilBorrador; extraidos: DatosExtraidos | undefined; faltan: CampoVital[]; alta: Alta }

/** Dos tramos que se llenan al avanzar, con el nombre de cada paso. El hecho lleva un tilde. */
function Pasos({ numero }: { numero: number }) {
  return (
    <>
      <p className="sr-only">Paso {numero} de {TOTAL}</p>
      <ol aria-hidden="true" className="grid gap-2" style={{ gridTemplateColumns: `repeat(${TOTAL}, 1fr)` }}>
        {PASOS.map((nombre, i) => {
          const actual = i === numero - 1
          return (
            <li key={nombre} className="flex flex-col gap-2">
              <span className="relative block h-1.5 overflow-hidden rounded-full bg-muted">
                <motion.span
                  className="absolute inset-0 origin-left rounded-full bg-verde"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: i < numero ? 1 : 0 }}
                  transition={{ duration: 0.6, ease: SALIDA }}
                />
              </span>
              <span className={cn('flex items-center gap-1.5 text-sm', actual ? 'font-bold text-pino' : 'text-musgo')}>
                {i < numero - 1
                  ? <Check className="size-4 text-verde-hondo" strokeWidth={3} />
                  : <span className="tabular-nums">{i + 1}</span>}
                {nombre}
              </span>
            </li>
          )
        })}
      </ol>
    </>
  )
}

export function PerfilNuevo() {
  const navegar = useNavigate()
  const reducir = useReducedMotion()
  const [paso, setPaso] = useState<Paso>('bienvenida')
  const [texto, setTexto] = useState('')
  const [formManual, setFormManual] = useState<FormDatos>(formVacio)
  const [datosManuales, setDatosManuales] = useState<DatosBasicos | undefined>(undefined)
  const [entendido, setEntendido] = useState<Entendido | null>(null)
  const [creando, setCreando] = useState(false)
  const [errorCrear, setErrorCrear] = useState<ErrorDeApi | null>(null)
  const [creado, setCreado] = useState<{ ninoId: string; nombre: string } | null>(null)
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

  // Después del festejo, a registrar su primera comida.
  useEffect(() => {
    if (!creado) return
    const t = window.setTimeout(
      () => navegar(`/registrar?nino=${encodeURIComponent(creado.ninoId)}`),
      reducir ? FESTEJO_REDUCIDO_MS : FESTEJO_MS,
    )
    return () => window.clearTimeout(t)
  }, [creado, navegar, reducir])

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
      recordarHijo(ninoId, datos.nombre)
      setCreado({ ninoId, nombre: datos.nombre })
      setPaso('creado')
    } catch (e) {
      if (!c.signal.aborted) { setErrorCrear(aErrorDeApi(e)); setCreando(false) }
    }
  }

  if (paso === 'creado' && creado) {
    return (
      <section className="flex flex-col items-center gap-3 pt-10 text-center">
        <div className="relative mb-4">
          <Celebracion activo />
          <Inicial nombre={creado.nombre} className="size-32 text-6xl" />
          <TildeListo />
        </div>
        <h1 ref={refTitulo} tabIndex={-1} className={cn('text-3xl', SIN_ANILLO)}>El perfil de {creado.nombre} está listo</h1>
        <p className="flex items-center gap-3 text-lg text-musgo" role="status">
          Ahora, su primera comida
          <Bocaditos />
        </p>
      </section>
    )
  }

  if (paso === 'bienvenida') {
    return (
      <div className="flex flex-col gap-6">
        <div className="rounded-3xl shadow-flotante">
          <section className="mordisco flex flex-col items-center gap-3 rounded-3xl bg-brote px-6 pt-5 pb-7 text-center">
            <PlatoBienvenida />
            <h1 ref={refTitulo} tabIndex={-1} className={cn('text-4xl font-black', SIN_ANILLO)}>{TITULO.bienvenida}</h1>
            <p className="max-w-80 text-lg text-pino text-balance">
              Contalo como se lo contarías a su pediatra, en un audio de hasta 3 minutos o por escrito.
            </p>
          </section>
        </div>
        <ol className="flex flex-col gap-3 px-1" aria-label="Cómo sigue">
          {QUE_SIGUE.map((t, i) => (
            <li
              key={t}
              className="relative flex items-center gap-3 not-last:before:absolute not-last:before:top-9 not-last:before:left-[17px] not-last:before:h-3 not-last:before:w-0.5 not-last:before:bg-hoja"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brote font-titulo font-extrabold text-verde-noche tabular-nums">
                {i + 1}
              </span>
              <span className="text-pino">{t}</span>
            </li>
          ))}
        </ol>
        <Button size="lg" className="w-full" onClick={() => setPaso('relato')}>Empezar</Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-4">
        {NUMERO[paso] > 0 && <Pasos numero={NUMERO[paso]} />}
        {paso !== 'creado' && <h1 ref={refTitulo} tabIndex={-1} className={cn('text-3xl', SIN_ANILLO)}>{TITULO[paso]}</h1>}
      </header>

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
        <PasoDatos
          form={formManual} setForm={setFormManual} textoSeguir="Seguir" compacto
          alSeguir={(d) => { setDatosManuales(d); setPaso('entendiendo') }}
        />
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
