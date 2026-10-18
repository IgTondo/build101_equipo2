// Alta por voz (§5.2) · /api/perfil-inicial con progreso → "Esto entendí": una sola pantalla para confirmar y corregir
// los datos básicos (con la cita de lo que dijo), las alergias a confirmar tocándolas, lo vital que falta (`faltan`),
// lo que come, lo que no y sus reglas.
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode, type Ref } from 'react'
import {
  DIETA, MOTIVO, type CampoVital, type DatosBasicos, type DatosExtraidos, type Motivo, type PerfilBorrador,
} from '../../../shared/contratos'
import { Cargando, ErrorConReintento } from '../../componentes/Estados'
import { api, type ErrorDeApi } from '../../lib/api'
import { useApi } from '../../lib/useApi'
import { NOMBRE_MOTIVO } from '../../lib/vocabulario'
import { Alergias } from './Alergias'
import {
  citaVigente, ORDEN_ALTA, pedidoPerfilInicial, pideDatosManuales, revisarAlta, textoFaltan, type Alta, type CampoAlta,
} from './alta'
import {
  agregarAcepta, agregarRechaza, agregarRegla, alternarSenal, cambiarMotivo, clave, quitarAcepta, quitarRechaza, quitarRegla,
  renombrarAcepta, SENALES, type FormDatos,
} from './borrador'
import { Campo, ChipAlternar, OpcionUnica } from './Controles'
import { IconoEditar, IconoMas, IconoQuitar } from './Iconos'
import { AVISO_ATRAGANTAMIENTO, AVISO_DECLARADA, AVISO_DIETA, NOMBRE_DIETA, NOMBRE_SENAL, NOMBRE_SEXO } from './textos'

const ETAPAS = ['Leyendo lo que contaste…', 'Anotando sus datos…', 'Buscando lo que come seguro…', 'Anotando lo que por ahora no come…', 'Juntando sus reglas…', 'Ya casi…']
const SEXOS = ['femenino', 'masculino'] as const

/**
 * Llama a /api/perfil-inicial al montarse, solo con el texto (§5.2), y muestra el progreso en una región viva.
 * `datos` solo viene en la transición hasta A8b (el back pidió los datos básicos a mano): ver pideDatosManuales().
 */
export function PasoEntendiendo({ texto, datos, alListo, alPedirDatos, alVolver }: {
  texto: string; datos?: DatosBasicos; alListo: (b: PerfilBorrador) => void; alPedirDatos: () => void; alVolver: () => void
}) {
  const estado = useApi((s) => api.perfilInicial(pedidoPerfilInicial(texto, datos), s), [])
  const [etapa, setEtapa] = useState(0)
  const avisos = useRef({ alListo, alPedirDatos })
  avisos.current = { alListo, alPedirDatos }
  // TRANSICIÓN hasta A8b: si el back todavía exige `datos`, se piden a mano en lugar de mostrar el error.
  const pedirDatos = estado.tipo === 'error' && !datos && pideDatosManuales(estado.error)

  useEffect(() => {
    if (estado.tipo !== 'cargando') return
    setEtapa(0)
    const t = window.setInterval(() => setEtapa((e) => Math.min(e + 1, ETAPAS.length - 1)), 2200)
    return () => window.clearInterval(t)
  }, [estado.tipo])

  useEffect(() => {
    if (estado.tipo === 'ok') avisos.current.alListo(estado.datos)
    else if (pedirDatos) avisos.current.alPedirDatos()
  }, [estado, pedirDatos])

  if (estado.tipo === 'error' && !pedirDatos) {
    return (
      <div className="pf-form">
        <ErrorConReintento error={estado.error} reintentar={estado.reintentar} />
        <button type="button" className="nb-boton nb-boton-secundario" onClick={alVolver}>Volver a lo que contaste</button>
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

/** "Dijiste: «…»", a pedido: de dónde sacamos el dato. Si el padre corrige el valor, la cita deja de mostrarse. */
function Cita({ cita }: { cita?: string }) {
  if (!cita) return null
  return (
    <details className="pf-cita">
      <summary>De dónde lo sacamos</summary>
      <p>Dijiste: «{cita}»</p>
    </details>
  )
}

/** Las citas de los datos básicos, juntas en un solo "de dónde lo sacamos" (uno por campo recarga la tarjeta). */
function Citas({ lista }: { lista: [string, string | undefined][] }) {
  const con = lista.filter((x): x is [string, string] => !!x[1])
  if (!con.length) return null
  return (
    <details className="pf-cita">
      <summary>De dónde lo sacamos</summary>
      <dl className="pf-citas">
        {con.map(([que, cita]) => <div key={que}><dt>{que}</dt><dd>«{cita}»</dd></div>)}
      </dl>
    </details>
  )
}

interface Props {
  borrador: PerfilBorrador
  setBorrador: (b: PerfilBorrador) => void
  alta: Alta
  setAlta: (a: Alta) => void
  /** Lo que dijo del chico, con citas (ya saneado). undefined en la transición o si A no lo mandó. */
  extraidos: DatosExtraidos | undefined
  faltan: CampoVital[]
  creando: boolean
  errorCrear: ErrorDeApi | null
  alConfirmar: (datos: DatosBasicos) => void
  alVolver: () => void
}

export function PasoEntendi({ borrador: b, setBorrador, alta, setAlta, extraidos: ex, faltan, creando, errorCrear, alConfirmar, alVolver }: Props) {
  const [intentado, setIntentado] = useState(false)
  const f = alta.form
  const nombre = f.nombre.trim() || 'tu hijo'
  const revision = revisarAlta(alta, b, nombre)
  // Los errores se muestran recién después de tocar "crear", y se recalculan en vivo mientras corrige.
  const errores = intentado && !revision.ok ? revision.errores : {}
  const falta = (c: CampoVital) => faltan.includes(c)
  const pendiente = textoFaltan(faltan)

  const refs = {
    nombre: useRef<HTMLInputElement>(null), edad: useRef<HTMLInputElement>(null), sexo: useRef<HTMLInputElement>(null),
    pesoKg: useRef<HTMLInputElement>(null), tallaCm: useRef<HTMLInputElement>(null),
    alergias: useRef<HTMLButtonElement>(null), acepta: useRef<HTMLInputElement>(null),
  } satisfies Record<CampoAlta, unknown>
  const refTitulos = { acepta: useRef<HTMLHeadingElement>(null), rechaza: useRef<HTMLHeadingElement>(null), reglas: useRef<HTMLHeadingElement>(null) }

  const cambiar = <K extends keyof FormDatos>(k: K, v: FormDatos[K]) => setAlta({ ...alta, form: { ...f, [k]: v } })

  // Al quitar un ítem, el foco vuelve al título de su lista (el botón que lo tenía desaparece).
  const quitando = (lista: keyof typeof refTitulos, nuevo: PerfilBorrador) => {
    setBorrador(nuevo)
    refTitulos[lista].current?.focus()
  }

  const confirmar = () => {
    if (revision.ok) return alConfirmar(revision.datos)
    setIntentado(true)
    const primero = ORDEN_ALTA.find((c) => revision.errores[c])
    if (primero) refs[primero].current?.focus()
  }

  const ayudaFalta = (c: CampoVital) => (falta(c) ? 'No lo mencionaste: completalo acá.' : undefined)
  const alertasCitadas = (ex?.alertas ?? []).filter((a) => f.alertas.includes(a.valor))

  return (
    <div className="pf-form">
      <p>Esto es lo que entendimos. Revisalo y cambiá lo que no esté bien: vos lo conocés mejor que nadie.</p>
      {pendiente && <p className="pf-aviso-suave">No nos contaste {pendiente}. Completalo acá abajo.</p>}

      <section className="nb-tarjeta pf-seccion" aria-labelledby="pf-t-datos">
        <h2 id="pf-t-datos">Sus datos</h2>
        <Campo
          ref={refs.nombre} etiqueta="Nombre" valor={f.nombre} alCambiar={(v) => cambiar('nombre', v)} ayuda={ayudaFalta('nombre')}
          error={errores.nombre} autoComplete="off" autoCapitalize="words" enterKeyHint="next" required
        />
        <Campo
          ref={refs.edad} etiqueta="Edad (años)" valor={f.edad} alCambiar={(v) => cambiar('edad', v)} ayuda={ayudaFalta('edad')}
          error={errores.edad} inputMode="numeric" pattern="[0-9]*" maxLength={2} className="pf-input pf-input-corto" required
        />
        <OpcionUnica
          leyenda="Sexo" nombre="sexo" opciones={SEXOS} etiquetas={NOMBRE_SEXO} valor={f.sexo}
          alCambiar={(v) => cambiar('sexo', v)} error={errores.sexo} refPrimera={refs.sexo}
          ayuda={falta('sexo') ? 'No lo mencionaste. Lo usamos solo para las referencias de nutrientes de su edad.' : 'Solo para usar las referencias de nutrientes de su edad.'}
        />
        <div className="pf-dos-columnas">
          <Campo
            ref={refs.pesoKg} etiqueta={<>Peso (kg) <span className="pf-opcional">opcional</span></>}
            valor={f.pesoKg} alCambiar={(v) => cambiar('pesoKg', v)} error={errores.pesoKg} inputMode="decimal"
          />
          <Campo
            ref={refs.tallaCm} etiqueta={<>Talla (cm) <span className="pf-opcional">opcional</span></>}
            valor={f.tallaCm} alCambiar={(v) => cambiar('tallaCm', v)} error={errores.tallaCm} inputMode="numeric"
          />
        </div>
        <Citas lista={[
          ['Nombre', citaVigente(ex?.nombre, f.nombre)], ['Edad', citaVigente(ex?.edad, f.edad)], ['Sexo', citaVigente(ex?.sexo, f.sexo)],
          ['Peso', citaVigente(ex?.pesoKg, f.pesoKg)], ['Talla', citaVigente(ex?.tallaCm, f.tallaCm)],
        ]} />
      </section>

      <section className="nb-tarjeta pf-seccion" aria-label="Alergias">
        <Alergias
          alta={alta} setAlta={setAlta} extraidos={ex} nombre={nombre} falta={falta('alergias')}
          error={errores.alergias} refPrimera={refs.alergias}
        />
      </section>

      <section className="nb-tarjeta pf-seccion" aria-labelledby="pf-t-cuidados">
        <h2 id="pf-t-cuidados">Dieta y cuidados</h2>
        <OpcionUnica
          leyenda="¿Sigue alguna dieta?" nombre="dieta" opciones={DIETA} etiquetas={NOMBRE_DIETA} valor={f.dieta}
          alCambiar={(v) => cambiar('dieta', v)} pie={<Cita cita={citaVigente(ex?.dieta, f.dieta)} />}
        />
        {f.dieta === 'sin_gluten_caseina' && <p className="pf-aviso-suave" role="status">{AVISO_DIETA}</p>}

        <fieldset className="pf-grupo">
          <legend>¿Algo de esto pasa con {nombre}?</legend>
          <p className="pf-ayuda">Marcá solo lo que corresponda. Nos ayuda a avisarte cuándo conviene consultar.</p>
          <div className="pf-chips pf-chips-columna">
            {SENALES.map((s) => (
              <ChipAlternar key={s} activo={f.alertas.includes(s)} alTocar={() => cambiar('alertas', alternarSenal(f.alertas, s))}>
                {NOMBRE_SENAL[s]}
              </ChipAlternar>
            ))}
          </div>
          {alertasCitadas.map((a) => <p key={a.valor} className="pf-cita-linea">Dijiste: «{a.cita}»</p>)}
          {f.alertas.length > 0 && <p className="pf-aviso-suave" role="status">{AVISO_DECLARADA}</p>}
        </fieldset>

        {ex?.atragantamiento && (
          <div className="pf-aviso-suave">
            <p>Nos contaste que tose o se atraganta al comer: «{ex.atragantamiento.cita}».</p>
            <p>{AVISO_ATRAGANTAMIENTO}</p>
          </div>
        )}

        <Campo
          etiqueta={<>Suplementos <span className="pf-opcional">opcional</span></>}
          ayuda="Solo para el registro: la app nunca sugiere suplementos."
          valor={f.suplementos} alCambiar={(v) => cambiar('suplementos', v)} autoComplete="off"
          placeholder="Por ejemplo, vitamina D en gotas" pie={<Cita cita={citaVigente(ex?.suplementos, f.suplementos)} />}
        />
      </section>

      <section className="nb-tarjeta pf-seccion" aria-labelledby="pf-t-acepta">
        <h2 id="pf-t-acepta" ref={refTitulos.acepta} tabIndex={-1}>Lo que come seguro</h2>
        {b.acepta.length === 0 && (
          <p className="pf-ayuda">No encontramos alimentos seguros en lo que contaste. Sumá al menos uno: es el punto de partida de lo que te vamos a sugerir.</p>
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
          alAgregar={(n) => setBorrador(agregarAcepta(b, n))} refInput={refs.acepta} error={errores.acepta}
        />
      </section>

      <section className="nb-tarjeta pf-seccion" aria-labelledby="pf-t-rechaza">
        <h2 id="pf-t-rechaza" ref={refTitulos.rechaza} tabIndex={-1}>Lo que por ahora no come</h2>
        {b.rechaza.length === 0 && <p className="pf-ayuda">No mencionaste nada. Si hay algo, sumalo acá; si no, podés seguir.</p>}
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

      {intentado && !revision.ok && (
        <p className="pf-error" role="alert">Para crear el perfil falta completar lo que está marcado arriba.</p>
      )}
      {errorCrear && <ErrorConReintento error={errorCrear} reintentar={confirmar} />}
      {creando ? (
        <Cargando texto={`Creando el perfil de ${nombre}…`} />
      ) : (
        <div className="pf-botones">
          <button type="button" className="nb-boton" onClick={confirmar}>
            {f.nombre.trim() ? `Listo, crear el perfil de ${nombre}` : 'Listo, crear su perfil'}
          </button>
          <button type="button" className="nb-boton nb-boton-secundario" onClick={alVolver}>Volver a lo que contaste</button>
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
