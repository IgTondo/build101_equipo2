// Pantalla Registrar (C2 + C5 + estados de C9): foto → chequeo de movida → análisis → ítems editables →
// "¿cómo le fue?" (voz o botones) → guardar → resultado. Una sola pantalla con una máquina de pasos.
// Nada se guarda sin que el padre confirme (§9).
// La protagonista es la foto del plato: antes de sacarla, su marco (teñido con el color de la comida elegida) es el
// botón de la cámara; mientras se analiza, una banda de luz la recorre; después, las cajas aparecen sobre ella.
import { cn } from 'cn'
import { Camera, Focus, ImageOff, Images, RotateCcw } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { MOMENTO, type Momento, type RegistrarComidaReq, type RegistrarComidaRes } from '../../../shared/contratos'
import { Bocaditos, Cargando, ErrorConReintento } from '../../componentes/Estados'
import { PlatoVacio } from '../../componentes/Ilustraciones'
import { Button } from '../../componentes/ui/button'
import { api, type ErrorDeApi } from '../../lib/api'
import { VISUAL_MOMENTO } from '../../lib/colores'
import { diaUruguay, useNinoActivo } from '../../lib/nino'
import { guardarUltimaComida } from '../../lib/proximaComida'
import { aErrorDeApi } from '../../lib/useApi'
import { NOMBRE_MOMENTO } from '../../lib/vocabulario'
import { ChipsConducta, EscaleraItem, PreguntaIA } from './Escalera'
import { estaMovida, prepararFoto, type FotoLista } from './imagen'
import { FotoConCajas, ListaItems } from './Items'
import {
  analisisEditado, aplicarRelato, armarRegistro, borradorInicial, faltanMarcar, horaUruguay, itemsVivos,
  marcarCuanto, marcarMotivo, momentoDeUrl, momentoPorHora, preguntasVivas, puedeGuardar, type Borrador, type ItemEdit,
} from './modelo'
import { NotaDeVoz } from './NotaDeVoz'
import { Aviso, MarcoFoto, RESORTE, TituloPaso } from './Piezas'
import { Resultado } from './Resultado'

type Paso =
  | { tipo: 'foto' }
  | { tipo: 'procesando' }
  | { tipo: 'movida' }
  | { tipo: 'analizando' }
  | { tipo: 'error_analisis'; error: ErrorDeApi }
  | { tipo: 'sin_comida' }
  | { tipo: 'items' }
  | { tipo: 'como' }
  | { tipo: 'resultado'; res: RegistrarComidaRes; req: RegistrarComidaReq }

/** Cada paso entra con un fundido corto (sin deslizarse): es un cambio de pantalla, no secciones que llegan. */
const PASO = 'flex flex-col gap-5 animate-in fade-in-0 duration-300 motion-reduce:animate-none'

/** Las comidas del día como una fila: la elegida lleva una pastilla con su color que se desliza de una a otra. */
function ElegirMomento({ momento, alElegir }: { momento: Momento; alElegir: (m: Momento) => void }) {
  return (
    <fieldset className="flex min-w-0 flex-col">
      <legend className="mb-2.5 font-titulo text-lg font-extrabold">¿Qué comida es?</legend>
      <div className="grid grid-cols-5 gap-0.5 rounded-[1.5rem] bg-muted p-1">
        {MOMENTO.map((m) => {
          const visual = VISUAL_MOMENTO[m]
          const Icono = visual.icono
          const activo = momento === m
          return (
            <label
              key={m}
              className="relative flex min-h-16 cursor-pointer flex-col items-center justify-center gap-1 rounded-[1.25rem] text-center select-none has-focus-visible:outline-3 has-focus-visible:outline-verde"
            >
              <input type="radio" className="sr-only" name="rg-momento" value={m} checked={activo} onChange={() => alElegir(m)} />
              {activo && (
                <motion.span
                  layoutId="rg-momento"
                  className="absolute inset-0 rounded-[1.25rem] border"
                  style={{ background: visual.claro, borderColor: visual.color }}
                  transition={RESORTE}
                />
              )}
              <Icono className="relative size-5" style={{ color: visual.color }} strokeWidth={2.25} aria-hidden="true" />
              {/* Sin negrita en la elegida: "Almuerzo" en negrita no entra a 360 px (la pastilla ya la marca). */}
              <span className={cn('relative text-xs', activo ? 'text-pino' : 'text-musgo')}>{NOMBRE_MOMENTO[m]}</span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

/**
 * El lugar de la foto antes de sacarla: un plato blanco sobre el color de la comida elegida, con el mordisco de la
 * marca. Con onClick es el botón de la cámara; sin él, muestra lo de adentro (preparando la foto).
 */
function MarcoCamara({ momento, onClick, children }: { momento: Momento; onClick?: () => void; children: ReactNode }) {
  const fondo = (
    <span aria-hidden="true" className="absolute inset-0 drop-shadow-[0_14px_18px_rgb(35_97_64/0.2)]">
      <span
        className="absolute inset-0 rounded-3xl transition-[background-color] duration-500 mordisco [--mordisco:34px]"
        style={{ background: VISUAL_MOMENTO[momento].claro }}
      />
    </span>
  )
  const clase = 'relative flex aspect-[4/3] w-full flex-col items-center justify-center gap-4 rounded-3xl'
  if (!onClick) return <div className={clase}>{fondo}{children}</div>
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(clase, 'group cursor-pointer transition-[scale] duration-150 ease-salida active:scale-[0.98] motion-reduce:active:scale-100')}
    >
      {fondo}
      {children}
    </button>
  )
}

/** El plato blanco con la cámara en el medio. */
function PlatoConCamara() {
  return (
    <span aria-hidden="true" className="relative grid size-36 place-items-center rounded-full bg-background ring-1 ring-black/5">
      <span className="absolute inset-3 rounded-full border-2 border-muted" />
      <span className="relative grid size-16 place-items-center rounded-full bg-primary text-primary-foreground transition-colors duration-150 group-hover:bg-verde-noche">
        <Camera className="size-7" strokeWidth={2.25} />
      </span>
    </span>
  )
}

/** Mientras se analiza: una banda de luz recorre la foto, despacio. Con movimiento reducido, la foto queda quieta. */
function BandaDeLuz() {
  const reducir = useReducedMotion()
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden bg-background/15">
      {!reducir && (
        <motion.span
          className="absolute inset-x-0 top-0 h-2/5"
          style={{ background: 'linear-gradient(to bottom, rgb(255 255 255 / 0), rgb(255 255 255 / 0.55) 50%, rgb(255 255 255 / 0))' }}
          initial={{ y: '-100%' }}
          animate={{ y: '250%' }}
          transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 0.2, ease: 'easeInOut' }}
        />
      )}
    </span>
  )
}

export function Registrar() {
  const ninoId = useNinoActivo()
  const [params] = useSearchParams()
  // La comida que acaba de terminar: la manda el inicio en ?momento= (v5.1); si no, por la hora.
  const momentoInicial = () => momentoDeUrl(params.get('momento')) ?? momentoPorHora(horaUruguay())
  const [paso, setPaso] = useState<Paso>({ tipo: 'foto' })
  const [momento, setMomento] = useState<Momento>(momentoInicial)
  const [foto, setFoto] = useState<FotoLista | null>(null)
  const [errorFoto, setErrorFoto] = useState<string | null>(null)
  const [borrador, setBorrador] = useState<Borrador | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [errorGuardar, setErrorGuardar] = useState<ErrorDeApi | null>(null)

  const camara = useRef<HTMLInputElement>(null)
  const galeria = useRef<HTMLInputElement>(null)
  const control = useRef<AbortController | null>(null)
  const raiz = useRef<HTMLDivElement>(null)
  const pasoAnterior = useRef(paso.tipo)

  useEffect(() => () => control.current?.abort(), [])

  // Al cambiar de paso, el foco va al título del paso nuevo (lectores de pantalla) y la vista vuelve arriba.
  useEffect(() => {
    if (pasoAnterior.current === paso.tipo) return // primer render (y el doble efecto de StrictMode)
    pasoAnterior.current = paso.tipo
    window.scrollTo({ top: 0 })
    raiz.current?.querySelector<HTMLElement>('[data-foco]')?.focus({ preventScroll: true })
  }, [paso.tipo])

  const pedirSenal = () => {
    control.current?.abort()
    control.current = new AbortController()
    return control.current.signal
  }

  async function analizar(f: FotoLista) {
    const senal = pedirSenal()
    setPaso({ tipo: 'analizando' })
    try {
      const a = await api.analizarComida({ ninoId, imagenBase64: f.base64, mime: 'image/jpeg' }, senal)
      if (senal.aborted) return
      if (a.sinComida || a.items.length === 0) return setPaso({ tipo: 'sin_comida' })
      setBorrador(borradorInicial(a))
      setErrorGuardar(null)
      setPaso({ tipo: 'items' })
    } catch (e) {
      if (senal.aborted) return
      const error = aErrorDeApi(e)
      setPaso(error.codigo === 'sin_comida' ? { tipo: 'sin_comida' } : { tipo: 'error_analisis', error })
    }
  }

  async function alElegirArchivo(input: HTMLInputElement) {
    const archivo = input.files?.[0]
    input.value = '' // para poder elegir la misma foto otra vez
    if (!archivo) return
    setErrorFoto(null)
    setPaso({ tipo: 'procesando' })
    try {
      const f = await prepararFoto(archivo)
      setFoto(f)
      if (estaMovida(f.nitidez)) setPaso({ tipo: 'movida' })
      else void analizar(f)
    } catch {
      setErrorFoto('No pudimos abrir esa foto. ¿Probás sacando otra o eligiendo una distinta?')
      setPaso({ tipo: 'foto' })
    }
  }

  const sacarOtra = () => camara.current?.click()
  const elegirDeGaleria = () => galeria.current?.click()

  const cambiarItem = (idTmp: string, cambio: Partial<ItemEdit>) =>
    setBorrador((b) => b && { ...b, items: b.items.map((i) => (i.idTmp === idTmp ? { ...i, ...cambio } : i)) })

  async function guardar() {
    if (!borrador || !puedeGuardar(borrador) || guardando) return
    const req = armarRegistro(borrador, { ninoId, momento, thumbBase64: foto?.thumbBase64, ahora: new Date(), dia: diaUruguay() })
    const senal = pedirSenal()
    setGuardando(true)
    setErrorGuardar(null)
    try {
      const res = await api.registrarComida(req, senal)
      if (senal.aborted) return
      guardarUltimaComida(ninoId, { id: res.comidaId, dia: req.dia, momento: req.momento, fechaISO: req.fechaISO })
      setPaso({ tipo: 'resultado', res, req })
    } catch (e) {
      if (!senal.aborted) setErrorGuardar(aErrorDeApi(e))
    } finally {
      if (!senal.aborted) setGuardando(false)
    }
  }

  function otra() {
    control.current?.abort()
    setFoto(null)
    setBorrador(null)
    setErrorGuardar(null)
    setGuardando(false)
    setMomento(momentoPorHora(horaUruguay()))
    setPaso({ tipo: 'foto' })
  }

  const botonSacarOtra = (texto: string, variante: 'default' | 'outline' = 'default') => (
    <Button size="lg" variant={variante} className="w-full" onClick={sacarOtra}>
      <Camera aria-hidden="true" /> {texto}
    </Button>
  )
  const botonGaleria = (
    <Button size="lg" variant="outline" className="w-full" onClick={elegirDeGaleria}>
      <Images aria-hidden="true" /> Elegir de la galería
    </Button>
  )

  return (
    <div className="flex flex-col text-pretty" ref={raiz}>
      {/* Siempre montados, para que "Sacar otra" abra la cámara desde cualquier paso. */}
      <input
        ref={camara} type="file" accept="image/*" capture="environment" className="sr-only"
        tabIndex={-1} aria-hidden="true" onChange={(e) => void alElegirArchivo(e.currentTarget)}
      />
      <input
        ref={galeria} type="file" accept="image/*" className="sr-only"
        tabIndex={-1} aria-hidden="true" onChange={(e) => void alElegirArchivo(e.currentTarget)}
      />

      {paso.tipo === 'foto' && (
        <section className={PASO} aria-labelledby="rg-t-foto">
          <TituloPaso id="rg-t-foto">Registrar una comida</TituloPaso>
          {errorFoto && (
            <Aviso icono={ImageOff}><p>{errorFoto}</p></Aviso>
          )}
          <ElegirMomento momento={momento} alElegir={setMomento} />
          <div className="flex flex-col gap-3">
            <MarcoCamara momento={momento} onClick={sacarOtra}>
              <PlatoConCamara />
              <span className="relative font-titulo text-xl font-extrabold text-pino">Sacar foto del plato</span>
            </MarcoCamara>
            {botonGaleria}
            <p className="px-1 text-sm text-musgo">Mejor desde arriba, con buena luz y el plato entero a la vista.</p>
          </div>
        </section>
      )}

      {paso.tipo === 'procesando' && (
        <section className={PASO} aria-labelledby="rg-t-proc">
          <TituloPaso id="rg-t-proc">Registrar una comida</TituloPaso>
          <MarcoCamara momento={momento}>
            <span aria-hidden="true" className="relative grid size-36 place-items-center rounded-full bg-background ring-1 ring-black/5">
              <Bocaditos />
            </span>
            <Cargando texto="Preparando la foto…" className="relative" />
          </MarcoCamara>
        </section>
      )}

      {paso.tipo === 'movida' && foto && (
        <section className={PASO} aria-labelledby="rg-t-movida">
          <TituloPaso id="rg-t-movida">La foto salió movida</TituloPaso>
          <MarcoFoto src={foto.dataUrl} alt="La foto que sacaste" chica />
          <Aviso icono={Focus} rol="status">
            <p>Con una foto más nítida reconocemos mejor la comida. Si no se puede, seguimos con esta.</p>
          </Aviso>
          <div className="flex flex-col gap-3">
            {botonSacarOtra('Sacar otra')}
            <Button size="lg" variant="outline" className="w-full" onClick={() => void analizar(foto)}>Usar igual</Button>
          </div>
        </section>
      )}

      {paso.tipo === 'analizando' && foto && (
        <section className={PASO} aria-labelledby="rg-t-anal">
          <TituloPaso id="rg-t-anal">Mirando el plato</TituloPaso>
          <MarcoFoto src={foto.dataUrl} alt="">
            <BandaDeLuz />
          </MarcoFoto>
          <Cargando texto="Analizando la comida…" className="justify-center" />
        </section>
      )}

      {paso.tipo === 'error_analisis' && foto && (
        <section className={PASO} aria-labelledby="rg-t-err">
          <TituloPaso id="rg-t-err">No pudimos analizar la foto</TituloPaso>
          <MarcoFoto src={foto.dataUrl} alt="La foto que sacaste" chica />
          <ErrorConReintento error={paso.error} reintentar={() => void analizar(foto)} />
          {botonSacarOtra('Sacar otra foto', 'outline')}
        </section>
      )}

      {paso.tipo === 'sin_comida' && (
        <section className={PASO} aria-labelledby="rg-t-sin">
          <div className="flex flex-col items-center gap-3 rounded-3xl bg-muted px-6 py-7 text-center">
            <PlatoVacio className="size-24" />
            <TituloPaso id="rg-t-sin" className="text-2xl">No encontramos comida en la foto</TituloPaso>
            <p className="text-musgo">Puede pasar si el plato quedó cortado o con poca luz. ¿Probás con otra, desde arriba?</p>
          </div>
          {foto && <MarcoFoto src={foto.dataUrl} alt="La foto que sacaste" chica />}
          <div className="flex flex-col gap-3">
            {botonSacarOtra('Sacar otra foto')}
            {botonGaleria}
          </div>
        </section>
      )}

      {paso.tipo === 'items' && borrador && foto && (
        <section className={PASO} aria-labelledby="rg-t-items">
          <TituloPaso id="rg-t-items">¿Esto le serviste?</TituloPaso>
          <FotoConCajas src={foto.dataUrl} items={borrador.items} original={borrador.analisis.items} />
          <ListaItems items={borrador.items} original={borrador.analisis.items} alCambiar={cambiarItem} />
          {itemsVivos(borrador).length === 0 ? (
            <Aviso
              icono={RotateCcw}
              rol="status"
              acciones={<Button variant="outline" className="bg-background" onClick={sacarOtra}><Camera aria-hidden="true" /> Sacar otra foto</Button>}
            >
              <p>Sacaste todos los alimentos. Podés deshacer, o sacar otra foto.</p>
            </Aviso>
          ) : (
            <div className="flex flex-col gap-2">
              <Button size="lg" className="w-full" onClick={() => setPaso({ tipo: 'como' })}>
                Seguir: ¿cómo le fue?
              </Button>
              <Button variant="ghost" className="self-center text-primary" onClick={sacarOtra}>
                <Camera aria-hidden="true" /> Sacar otra foto
              </Button>
            </div>
          )}
        </section>
      )}

      {paso.tipo === 'como' && borrador && (
        <PasoComo
          ninoId={ninoId}
          borrador={borrador}
          setBorrador={setBorrador}
          guardando={guardando}
          errorGuardar={errorGuardar}
          alGuardar={() => void guardar()}
          alVolver={() => setPaso({ tipo: 'items' })}
        />
      )}

      {paso.tipo === 'resultado' && (
        <div className={PASO}>
          <Resultado ninoId={ninoId} res={paso.res} req={paso.req} foto={foto?.dataUrl} alOtra={otra} />
        </div>
      )}
    </div>
  )
}

function PasoComo({ ninoId, borrador, setBorrador, guardando, errorGuardar, alGuardar, alVolver }: {
  ninoId: string
  borrador: Borrador
  setBorrador: (f: (b: Borrador | null) => Borrador | null) => void
  guardando: boolean
  errorGuardar: ErrorDeApi | null
  alGuardar: () => void
  alVolver: () => void
}) {
  const actualizar = (f: (b: Borrador) => Borrador) => setBorrador((b) => (b ? f(b) : b))
  const faltan = faltanMarcar(borrador)
  const listo = puedeGuardar(borrador)
  const preguntas = preguntasVivas(borrador)
  const grupo = new Map(borrador.analisis.items.map((i) => [i.idTmp, i.atributos.grupo]))

  return (
    <section className={PASO} aria-labelledby="rg-t-como">
      <TituloPaso id="rg-t-como">¿Cómo le fue?</TituloPaso>

      <NotaDeVoz
        ninoId={ninoId}
        analisis={analisisEditado(borrador)}
        transcripcion={borrador.relato?.transcripcion}
        alRelato={(relato, fuente) => actualizar((b) => aplicarRelato(b, relato, fuente))}
      />

      <div className="flex flex-col gap-3">
        <h2 className="pt-1 text-xl">Con cada alimento</h2>
        {itemsVivos(borrador).map((it) => (
          <EscaleraItem
            key={it.idTmp}
            item={it}
            grupo={grupo.get(it.idTmp)}
            respuesta={borrador.respuestas[it.idTmp]}
            sinMencion={borrador.sinMencion.includes(it.idTmp)}
            alCuanto={(c) => actualizar((b) => marcarCuanto(b, it.idTmp, c))}
            alMotivo={(m) => actualizar((b) => marcarMotivo(b, it.idTmp, m))}
          />
        ))}
      </div>

      <ChipsConducta
        marcadas={borrador.conducta}
        deIA={borrador.conductaIA}
        alCambiar={(conducta) => actualizar((b) => ({ ...b, conducta }))}
      />

      {preguntas.length > 0 && (
        <section className="flex flex-col gap-5 rounded-2xl border bg-card p-4" aria-labelledby="rg-t-preg">
          <h2 id="rg-t-preg" className="text-xl">
            Unas preguntas <span className="font-sans text-sm font-normal text-musgo">(opcionales)</span>
          </h2>
          {preguntas.map((p) => (
            <PreguntaIA
              key={p.id}
              pregunta={p}
              respuesta={borrador.preguntas[p.id]}
              deIA={borrador.preguntasIA[p.id] !== undefined && borrador.preguntasIA[p.id] === borrador.preguntas[p.id]}
              alResponder={(r) => actualizar((b) => ({ ...b, preguntas: { ...b.preguntas, [p.id]: r } }))}
            />
          ))}
        </section>
      )}

      <div className="flex flex-col gap-3 pt-1">
        {errorGuardar && <ErrorConReintento error={errorGuardar} reintentar={alGuardar} />}
        {guardando ? (
          <div className="grid min-h-14 place-items-center">
            <Cargando texto="Guardando…" />
          </div>
        ) : (
          <Button
            size="lg"
            className="w-full"
            disabled={!listo}
            aria-describedby={listo ? undefined : 'rg-falta'}
            onClick={alGuardar}
          >
            Guardar
          </Button>
        )}
        {!listo && faltan.length > 0 && (
          <p id="rg-falta" className="px-1 text-sm text-musgo">
            Para guardar, marcá cómo le fue con: {faltan.map((i) => i.preparacion).join(', ')}.
          </p>
        )}
        <Button variant="ghost" className="self-center text-primary" onClick={alVolver}>Volver a los alimentos</Button>
      </div>
    </section>
  )
}
