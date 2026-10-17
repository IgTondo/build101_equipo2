// Pantalla Registrar (C2 + C5 + estados de C9): foto → chequeo de movida → análisis → ítems editables →
// "¿cómo le fue?" (voz o botones) → guardar → resultado. Una sola pantalla con una máquina de pasos.
// Nada se guarda sin que el padre confirme (§9).
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { MOMENTO, type Momento, type RegistrarComidaRes } from '../../../shared/contratos'
import { Cargando, ErrorConReintento } from '../../componentes/Estados'
import { api, type ErrorDeApi } from '../../lib/api'
import { diaUruguay, NINO_DEMO, useNino } from '../../lib/nino'
import { aErrorDeApi } from '../../lib/useApi'
import { NOMBRE_MOMENTO } from '../../lib/vocabulario'
import { ChipsConducta, EscaleraItem, PreguntaIA } from './Escalera'
import { estaMovida, prepararFoto, type FotoLista } from './imagen'
import { FotoConCajas, ListaItems } from './Items'
import {
  analisisEditado, aplicarRelato, armarRegistro, borradorInicial, faltanMarcar, horaUruguay, itemsVivos,
  marcarCuanto, marcarMotivo, momentoPorHora, preguntasVivas, puedeGuardar, type Borrador, type ItemEdit,
} from './modelo'
import { NotaDeVoz } from './NotaDeVoz'
import { Resultado } from './Resultado'
import './registrar.css'

type Paso =
  | { tipo: 'foto' }
  | { tipo: 'procesando' }
  | { tipo: 'movida' }
  | { tipo: 'analizando' }
  | { tipo: 'error_analisis'; error: ErrorDeApi }
  | { tipo: 'sin_comida' }
  | { tipo: 'items' }
  | { tipo: 'como' }
  | { tipo: 'resultado'; res: RegistrarComidaRes }

function IconoCamara() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
      <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.6l1.3-2h5.2l1.3 2h1.6A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="12" cy="12.5" r="3.5" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

function AvisoDemo() {
  return (
    <p className="rg-demo">
      Estás registrando en Tomás, el perfil de ejemplo. <Link to="/perfil/nuevo">Crear el perfil de tu hijo</Link>
    </p>
  )
}

export function Registrar() {
  const ninoId = useNino()
  const [paso, setPaso] = useState<Paso>({ tipo: 'foto' })
  const [momento, setMomento] = useState<Momento>(() => momentoPorHora(horaUruguay()))
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
      setPaso({ tipo: 'resultado', res })
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

  const esDemo = ninoId === NINO_DEMO

  return (
    <div className="rg" ref={raiz}>
      {/* Siempre montados, para que "Sacar otra" abra la cámara desde cualquier paso. */}
      <input
        ref={camara} type="file" accept="image/*" capture="environment" className="rg-oculto"
        tabIndex={-1} aria-hidden="true" onChange={(e) => void alElegirArchivo(e.currentTarget)}
      />
      <input
        ref={galeria} type="file" accept="image/*" className="rg-oculto"
        tabIndex={-1} aria-hidden="true" onChange={(e) => void alElegirArchivo(e.currentTarget)}
      />

      {esDemo && paso.tipo !== 'resultado' && <AvisoDemo />}

      {paso.tipo === 'foto' && (
        <section className="rg-paso" aria-labelledby="rg-t-foto">
          <h1 id="rg-t-foto" tabIndex={-1} data-foco>Registrar una comida</h1>
          <p className="nb-suave">Sacale una foto al plato que le serviste. Después nos contás cómo le fue.</p>
          <fieldset className="rg-grupo">
            <legend className="rg-leyenda">¿Qué comida es?</legend>
            <div className="rg-chips">
              {MOMENTO.map((m) => (
                <label key={m} className="rg-chip rg-chip-check">
                  <input type="radio" name="rg-momento" value={m} checked={momento === m} onChange={() => setMomento(m)} />
                  <span>{NOMBRE_MOMENTO[m]}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <button type="button" className="nb-boton rg-boton-grande" onClick={sacarOtra}>
            <IconoCamara /> Sacar foto del plato
          </button>
          <button type="button" className="nb-boton nb-boton-secundario" onClick={() => galeria.current?.click()}>
            Elegir de la galería
          </button>
          <p className="rg-pista">Mejor desde arriba, con buena luz y el plato entero a la vista.</p>
          {errorFoto && <div className="nb-tarjeta nb-aviso" role="alert"><p>{errorFoto}</p></div>}
        </section>
      )}

      {paso.tipo === 'procesando' && (
        <section className="rg-paso" aria-labelledby="rg-t-proc">
          <h1 id="rg-t-proc" tabIndex={-1} data-foco>Registrar una comida</h1>
          <Cargando texto="Preparando la foto…" />
        </section>
      )}

      {paso.tipo === 'movida' && foto && (
        <section className="rg-paso" aria-labelledby="rg-t-movida">
          <h1 id="rg-t-movida" tabIndex={-1} data-foco>La foto salió movida</h1>
          <img className="rg-previa" src={foto.dataUrl} alt="La foto que sacaste" />
          <p>Con una foto más nítida reconocemos mejor la comida. Si no se puede, seguimos con esta.</p>
          <button type="button" className="nb-boton" onClick={sacarOtra}>Sacar otra</button>
          <button type="button" className="nb-boton nb-boton-secundario" onClick={() => void analizar(foto)}>Usar igual</button>
        </section>
      )}

      {paso.tipo === 'analizando' && foto && (
        <section className="rg-paso" aria-labelledby="rg-t-anal">
          <h1 id="rg-t-anal" tabIndex={-1} data-foco>Mirando el plato</h1>
          <img className="rg-previa rg-previa-esperando" src={foto.dataUrl} alt="" />
          <Cargando texto="Analizando la comida…" />
        </section>
      )}

      {paso.tipo === 'error_analisis' && foto && (
        <section className="rg-paso" aria-labelledby="rg-t-err">
          <h1 id="rg-t-err" tabIndex={-1} data-foco>No pudimos analizar la foto</h1>
          <ErrorConReintento error={paso.error} reintentar={() => void analizar(foto)} />
          <button type="button" className="nb-boton nb-boton-secundario" onClick={sacarOtra}>Sacar otra foto</button>
        </section>
      )}

      {paso.tipo === 'sin_comida' && (
        <section className="rg-paso" aria-labelledby="rg-t-sin">
          <div className="nb-tarjeta nb-vacio">
            <h1 id="rg-t-sin" tabIndex={-1} data-foco>No encontramos comida en la foto</h1>
            <p className="nb-suave">Puede pasar si el plato quedó cortado o con poca luz. ¿Probás con otra, desde arriba?</p>
          </div>
          {foto && <img className="rg-previa" src={foto.dataUrl} alt="La foto que sacaste" />}
          <button type="button" className="nb-boton" onClick={sacarOtra}>Sacar otra foto</button>
          <button type="button" className="nb-boton nb-boton-secundario" onClick={() => galeria.current?.click()}>Elegir de la galería</button>
        </section>
      )}

      {paso.tipo === 'items' && borrador && foto && (
        <section className="rg-paso" aria-labelledby="rg-t-items">
          <h1 id="rg-t-items" tabIndex={-1} data-foco>¿Esto le serviste?</h1>
          <p className="nb-suave">Corregí lo que no esté bien. Nada se guarda hasta que lo confirmes.</p>
          <FotoConCajas src={foto.dataUrl} items={borrador.items} original={borrador.analisis.items} />
          <ListaItems items={borrador.items} original={borrador.analisis.items} alCambiar={cambiarItem} />
          {itemsVivos(borrador).length === 0 ? (
            <div className="nb-tarjeta nb-aviso" role="status">
              <p>Sacaste todos los alimentos. Podés deshacer, o sacar otra foto.</p>
              <button type="button" className="nb-boton nb-boton-secundario" onClick={sacarOtra}>Sacar otra foto</button>
            </div>
          ) : (
            <button type="button" className="nb-boton rg-boton-grande" onClick={() => setPaso({ tipo: 'como' })}>
              Seguir: ¿cómo le fue?
            </button>
          )}
          <button type="button" className="rg-boton-texto" onClick={sacarOtra}>Sacar otra foto</button>
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

      {paso.tipo === 'resultado' && <Resultado res={paso.res} alOtra={otra} />}
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
  const numero = new Map(borrador.items.map((i, k) => [i.idTmp, k + 1]))

  return (
    <section className="rg-paso" aria-labelledby="rg-t-como">
      <h1 id="rg-t-como" tabIndex={-1} data-foco>¿Cómo le fue?</h1>
      <p className="nb-suave">
        Contalo con una nota de voz y marcamos los botones por vos, o tocalos directamente.
        Lo dejó en el plato, lo tocó, lo probó: todo cuenta.
      </p>

      <NotaDeVoz
        ninoId={ninoId}
        analisis={analisisEditado(borrador)}
        transcripcion={borrador.relato?.transcripcion}
        alRelato={(relato, fuente) => actualizar((b) => aplicarRelato(b, relato, fuente))}
      />

      <h2 className="rg-subtitulo">Con cada alimento</h2>
      {itemsVivos(borrador).map((it) => (
        <div key={it.idTmp} className="nb-tarjeta">
          <EscaleraItem
            item={it}
            n={numero.get(it.idTmp) ?? 0}
            respuesta={borrador.respuestas[it.idTmp]}
            sinMencion={borrador.sinMencion.includes(it.idTmp)}
            alCuanto={(c) => actualizar((b) => marcarCuanto(b, it.idTmp, c))}
            alMotivo={(m) => actualizar((b) => marcarMotivo(b, it.idTmp, m))}
          />
        </div>
      ))}

      <ChipsConducta
        marcadas={borrador.conducta}
        deIA={borrador.conductaIA}
        alCambiar={(conducta) => actualizar((b) => ({ ...b, conducta }))}
      />

      {preguntas.length > 0 && (
        <section className="nb-tarjeta rg-preguntas" aria-labelledby="rg-t-preg">
          <h2 id="rg-t-preg">Unas preguntas</h2>
          <p className="rg-pista">Nos ayudan a entender mejor el plato. Son opcionales.</p>
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

      <div className="rg-guardar">
        {errorGuardar && <ErrorConReintento error={errorGuardar} reintentar={alGuardar} />}
        {guardando ? (
          <Cargando texto="Guardando…" />
        ) : (
          <button
            type="button"
            className="nb-boton rg-boton-grande"
            disabled={!listo}
            aria-describedby={listo ? undefined : 'rg-falta'}
            onClick={alGuardar}
          >
            Guardar
          </button>
        )}
        {!listo && faltan.length > 0 && (
          <p id="rg-falta" className="rg-pista">
            Para guardar, marcá cómo le fue con: {faltan.map((i) => i.preparacion).join(', ')}.
          </p>
        )}
        <button type="button" className="rg-boton-texto" onClick={alVolver}>Volver a los alimentos</button>
      </div>
    </section>
  )
}
