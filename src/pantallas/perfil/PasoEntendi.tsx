// Paso 3 · /api/perfil-inicial con progreso → "Esto entendí": chips editables del borrador → confirmar.
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode, type Ref } from 'react'
import { MOTIVO, type DatosBasicos, type Motivo, type PerfilBorrador } from '../../../shared/contratos'
import { Cargando, ErrorConReintento } from '../../componentes/Estados'
import { api, type ErrorDeApi } from '../../lib/api'
import { useApi } from '../../lib/useApi'
import { NOMBRE_ALERGENO, NOMBRE_MOTIVO } from '../../lib/vocabulario'
import {
  agregarAcepta, agregarRechaza, agregarRegla, cambiarMotivo, clave, quitarAcepta, quitarRechaza, quitarRegla, renombrarAcepta,
} from './borrador'
import { IconoEditar, IconoMas, IconoQuitar } from './Iconos'

const ETAPAS = ['Leyendo lo que contaste…', 'Buscando lo que come seguro…', 'Anotando lo que por ahora no come…', 'Juntando sus reglas…', 'Ya casi…']

/** Llama a /api/perfil-inicial al montarse; muestra el progreso por etapas en una región viva. */
export function PasoEntendiendo({ datos, texto, alListo, alVolver }: {
  datos: DatosBasicos; texto: string; alListo: (b: PerfilBorrador) => void; alVolver: () => void
}) {
  const estado = useApi((s) => api.perfilInicial({ datos, texto }, s), [])
  const [etapa, setEtapa] = useState(0)
  const listo = useRef(alListo)
  listo.current = alListo

  useEffect(() => {
    if (estado.tipo !== 'cargando') return
    setEtapa(0)
    const t = window.setInterval(() => setEtapa((e) => Math.min(e + 1, ETAPAS.length - 1)), 2200)
    return () => window.clearInterval(t)
  }, [estado.tipo])

  useEffect(() => {
    if (estado.tipo === 'ok') listo.current(estado.datos)
  }, [estado])

  if (estado.tipo === 'error') {
    return (
      <div className="pf-form">
        <ErrorConReintento error={estado.error} reintentar={estado.reintentar} />
        <button type="button" className="nb-boton nb-boton-secundario" onClick={alVolver}>Volver al relato</button>
      </div>
    )
  }
  return (
    <div className="nb-tarjeta pf-progreso">
      <Cargando texto={ETAPAS[etapa]} />
      <p className="pf-ayuda">Suele tardar unos segundos.</p>
    </div>
  )
}

interface Props {
  datos: DatosBasicos
  borrador: PerfilBorrador
  setBorrador: (b: PerfilBorrador) => void
  creando: boolean
  errorCrear: ErrorDeApi | null
  alConfirmar: () => void
  alVolver: () => void
}

export function PasoEntendi({ datos, borrador: b, setBorrador, creando, errorCrear, alConfirmar, alVolver }: Props) {
  const [faltaSeguro, setFaltaSeguro] = useState(false)
  const refAgregarSeguro = useRef<HTMLInputElement>(null)
  const refTitulos = { acepta: useRef<HTMLHeadingElement>(null), rechaza: useRef<HTMLHeadingElement>(null), reglas: useRef<HTMLHeadingElement>(null) }

  // Al quitar un ítem, el foco vuelve al título de su lista (el botón que lo tenía desaparece).
  const quitando = (lista: keyof typeof refTitulos, nuevo: PerfilBorrador) => {
    setBorrador(nuevo)
    refTitulos[lista].current?.focus()
  }

  const confirmar = () => {
    if (!b.acepta.length) {
      setFaltaSeguro(true)
      refAgregarSeguro.current?.focus()
      return
    }
    alConfirmar()
  }

  return (
    <div className="pf-form">
      <p>Esto es lo que entendimos de tu relato. Si algo no está bien, cambialo o sacalo: vos conocés a {datos.nombre}.</p>

      <section className="nb-tarjeta pf-seccion" aria-labelledby="pf-t-acepta">
        <h2 id="pf-t-acepta" ref={refTitulos.acepta} tabIndex={-1}>Lo que come seguro</h2>
        {b.acepta.length === 0 && (
          <p className="pf-ayuda">No encontramos alimentos seguros en el relato. Sumá al menos uno: es el punto de partida de lo que te vamos a sugerir.</p>
        )}
        <ul className="pf-lista">
          {b.acepta.map((a, i) => (
            <FilaAcepta
              // Clave por posición: al renombrar, la fila sigue montada y el foco vuelve a su botón de editar.
              key={i} nombre={a.nombre} marca={a.marca}
              alRenombrar={(n) => setBorrador(renombrarAcepta(b, i, n))}
              alQuitar={() => quitando('acepta', quitarAcepta(b, i))}
            />
          ))}
        </ul>
        <Agregar
          etiqueta="Sumar algo que come seguro" ejemplo="Ej.: galletitas de arroz"
          alAgregar={(n) => { setBorrador(agregarAcepta(b, n)); setFaltaSeguro(false) }} refInput={refAgregarSeguro}
          error={faltaSeguro ? `Sumá al menos un alimento que ${datos.nombre} coma seguro.` : undefined}
        />
      </section>

      <section className="nb-tarjeta pf-seccion" aria-labelledby="pf-t-rechaza">
        <h2 id="pf-t-rechaza" ref={refTitulos.rechaza} tabIndex={-1}>Lo que por ahora no come</h2>
        {b.rechaza.length === 0 && <p className="pf-ayuda">No mencionaste nada. Si hay algo, sumalo acá.</p>}
        <ul className="pf-lista">
          {b.rechaza.map((r, i) => (
            <FilaRechaza
              key={`${i}:${clave(r.nombre)}`} nombre={r.nombre} motivo={r.motivo}
              alCambiarMotivo={(m) => setBorrador(cambiarMotivo(b, i, m))}
              alQuitar={() => quitando('rechaza', quitarRechaza(b, i))}
            />
          ))}
        </ul>
        <Agregar etiqueta="Sumar algo que por ahora no come" ejemplo="Ej.: tomate" alAgregar={(n) => setBorrador(agregarRechaza(b, n))} />
      </section>

      <section className="nb-tarjeta pf-seccion" aria-labelledby="pf-t-reglas">
        <h2 id="pf-t-reglas" ref={refTitulos.reglas} tabIndex={-1}>Sus reglas</h2>
        {b.reglas.length === 0 && <p className="pf-ayuda">No encontramos reglas. Si las hay, como “que no se toquen”, sumalas.</p>}
        <ul className="pf-lista">
          {b.reglas.map((r, i) => (
            <Fila key={`${i}:${clave(r.texto)}`} acciones={<BotonQuitar que={r.texto} alQuitar={() => quitando('reglas', quitarRegla(b, i))} />}>
              <span className="pf-fila-nombre">{r.texto}</span>
            </Fila>
          ))}
        </ul>
        <Agregar etiqueta="Sumar una regla" ejemplo="Ej.: que no se toquen" alAgregar={(t) => setBorrador(agregarRegla(b, t))} />
      </section>

      <p className="pf-ayuda">
        {datos.alergias.length
          ? `Alergias, como las marcaste vos: ${datos.alergias.map((a) => NOMBRE_ALERGENO[a]).join(', ')}.`
          : 'No marcaste alergias.'}
      </p>

      {errorCrear && <ErrorConReintento error={errorCrear} reintentar={alConfirmar} />}
      {creando ? (
        <Cargando texto={`Creando el perfil de ${datos.nombre}…`} />
      ) : (
        <div className="pf-botones">
          <button type="button" className="nb-boton" onClick={confirmar}>Listo, crear el perfil de {datos.nombre}</button>
          <button type="button" className="nb-boton nb-boton-secundario" onClick={alVolver}>Volver al relato</button>
        </div>
      )}
    </div>
  )
}

function Fila({ children, acciones }: { children: ReactNode; acciones: ReactNode }) {
  return (
    <li className="pf-fila">
      <div className="pf-fila-cuerpo">{children}</div>
      <div className="pf-fila-acciones">{acciones}</div>
    </li>
  )
}

function BotonQuitar({ que, alQuitar }: { que: string; alQuitar: () => void }) {
  return (
    <button type="button" className="pf-boton-icono" aria-label={`Quitar “${que}”`} onClick={alQuitar}>
      <IconoQuitar />
    </button>
  )
}

function FilaAcepta({ nombre, marca, alRenombrar, alQuitar }: {
  nombre: string; marca?: string; alRenombrar: (n: string) => void; alQuitar: () => void
}) {
  const id = useId()
  const [editando, setEditando] = useState(false)
  const [valor, setValor] = useState(nombre)
  const refEditar = useRef<HTMLButtonElement>(null)
  const refInput = useRef<HTMLInputElement>(null)

  useEffect(() => { if (editando) refInput.current?.select() }, [editando])

  const cerrar = () => { setEditando(false); requestAnimationFrame(() => refEditar.current?.focus()) }
  const guardar = (e: FormEvent) => {
    e.preventDefault()
    if (valor.trim()) alRenombrar(valor)
    cerrar()
  }

  if (editando) {
    return (
      <li className="pf-fila pf-fila-editando">
        <form className="pf-agregar" onSubmit={guardar}>
          <label htmlFor={id} className="pf-oculto">Nuevo nombre para {nombre}</label>
          <input
            ref={refInput} id={id} className="pf-input" value={valor} onChange={(e) => setValor(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') { setValor(nombre); cerrar() } }} enterKeyHint="done"
          />
          <button type="submit" className="nb-boton">Guardar</button>
        </form>
      </li>
    )
  }
  return (
    <Fila acciones={<>
      <button ref={refEditar} type="button" className="pf-boton-icono" aria-label={`Cambiar el nombre de “${nombre}”`}
        onClick={() => { setValor(nombre); setEditando(true) }}>
        <IconoEditar />
      </button>
      <BotonQuitar que={nombre} alQuitar={alQuitar} />
    </>}>
      <span className="pf-fila-nombre">{nombre}</span>
      {marca && <span className="pf-marca">Marca: {marca}</span>}
    </Fila>
  )
}

function FilaRechaza({ nombre, motivo, alCambiarMotivo, alQuitar }: {
  nombre: string; motivo: Motivo; alCambiarMotivo: (m: Motivo) => void; alQuitar: () => void
}) {
  const id = useId()
  return (
    <Fila acciones={<BotonQuitar que={nombre} alQuitar={alQuitar} />}>
      <span className="pf-fila-nombre">{nombre}</span>
      <span className="pf-motivo">
        <label htmlFor={id}>Por<span className="pf-oculto"> qué no come {nombre}</span></label>
        <select id={id} className="pf-select" value={motivo} onChange={(e) => alCambiarMotivo(e.target.value as Motivo)}>
          {MOTIVO.map((m) => <option key={m} value={m}>{NOMBRE_MOTIVO[m]}</option>)}
        </select>
      </span>
    </Fila>
  )
}

function Agregar({ etiqueta, ejemplo, alAgregar, refInput, error }: {
  etiqueta: string; ejemplo: string; alAgregar: (v: string) => void; refInput?: Ref<HTMLInputElement>; error?: string
}) {
  const id = useId()
  const [valor, setValor] = useState('')
  const enviar = (e: FormEvent) => {
    e.preventDefault()
    if (!valor.trim()) return
    alAgregar(valor)
    setValor('')
  }
  return (
    <form className="pf-campo" onSubmit={enviar}>
      <label htmlFor={id} className="pf-etiqueta-chica">{etiqueta}</label>
      <div className="pf-agregar">
        <input
          ref={refInput} id={id} className="pf-input" value={valor} onChange={(e) => setValor(e.target.value)}
          placeholder={ejemplo} enterKeyHint="done" autoComplete="off"
          aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : undefined}
        />
        <button type="submit" className="nb-boton nb-boton-secundario pf-boton-agregar" aria-label={etiqueta}>
          <IconoMas /> <span aria-hidden="true">Sumar</span>
        </button>
      </div>
      {error && <p id={`${id}-error`} className="pf-error" role="alert">{error}</p>}
    </form>
  )
}
