// Alta por voz (§5.2) · /api/perfil-inicial con progreso → "Esto entendí": una sola pantalla para confirmar y corregir
// lo que come, lo que no y sus reglas, los datos básicos (con la cita de lo que dijo), las alergias a confirmar
// tocándolas y lo vital que falta (`faltan`).
// La protagonista es lo que come seguro: sus alimentos como bocados (IconoAlimento con el color de su grupo), que es
// de donde Nibble parte para proponerle algo nuevo. Lo demás queda tranquilo: lo que todavía no y sus reglas sin caja,
// los datos, las alergias y los cuidados en tarjetas.
import { cn } from 'cn'
import { ChevronDown, MessageCircleQuestionMark, Pencil, Quote, ShieldCheck, Stethoscope, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import {
  DIETA, MOTIVO, type CampoVital, type DatosBasicos, type DatosExtraidos, type Grupo, type Motivo, type PerfilBorrador,
} from '../../../shared/contratos'
import { Bocaditos, Cargando, ErrorConReintento } from '../../componentes/Estados'
import { IconoAlimento } from '../../componentes/IconoAlimento'
import { Button } from '../../componentes/ui/button'
import { Input } from '../../componentes/ui/input'
import { api, type ErrorDeApi } from '../../lib/api'
import { useApi } from '../../lib/useApi'
import { NOMBRE_MOTIVO } from '../../lib/vocabulario'
import { Alergias } from './Alergias'
import {
  alergiasRespondidas, citaVigente, ORDEN_ALTA, pedidoPerfilInicial, pideDatosManuales, revisarAlta, textoFaltan,
  type Alta, type CampoAlta,
} from './alta'
import {
  agregarAcepta, agregarRechaza, agregarRegla, alternarSenal, cambiarMotivo, clave, quitarAcepta, quitarRechaza, quitarRegla,
  renombrarAcepta, SENALES, type FormDatos,
} from './borrador'
import { Agregar, Campo, ChipAlternar, CLASE_INPUT, OpcionUnica } from './Controles'
import { Aviso, Cita, Falta, ICONO, Inicial, RESORTE, SALIDA, TituloSeccion } from './Piezas'
import { AVISO_ATRAGANTAMIENTO, AVISO_DECLARADA, AVISO_DIETA, NOMBRE_DIETA, NOMBRE_SENAL, NOMBRE_SEXO } from './textos'

const ETAPAS = ['Leyendo lo que contaste…', 'Anotando sus datos…', 'Buscando lo que come seguro…', 'Anotando lo que por ahora no come…', 'Juntando sus reglas…', 'Ya casi…']
const SEXOS = ['femenino', 'masculino'] as const

/**
 * Llama a /api/perfil-inicial al montarse, solo con el texto (§5.2), y muestra el progreso en una región viva.
 * `datos` solo viene en la transición hasta A8b (el back pidió los datos básicos a mano): ver pideDatosManuales().
 * Mientras, lo que contó el padre se ve como una cita: es lo que estamos leyendo.
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
      <div className="flex flex-col gap-4">
        <ErrorConReintento error={estado.error} reintentar={estado.reintentar} />
        <Button variant="outline" size="lg" className="w-full" onClick={alVolver}>Volver a lo que contaste</Button>
      </div>
    )
  }
  return (
    <div className="mordisco flex flex-col items-center gap-4 rounded-3xl bg-brote px-6 pt-8 pb-7 text-center [--mordisco:26px]">
      <span className="grid size-28 place-items-center rounded-full bg-background" aria-hidden="true">
        <Bocaditos />
      </span>
      <p className="min-h-7 font-titulo text-xl font-extrabold text-pino" role="status" aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={etapa}
            className="inline-block"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25, ease: SALIDA }}
          >
            {ETAPAS[etapa]}
          </motion.span>
        </AnimatePresence>
      </p>
      {texto && (
        <blockquote aria-hidden="true" className="line-clamp-4 max-w-80 text-musgo italic text-pretty">«{texto}»</blockquote>
      )}
    </div>
  )
}

/** "De dónde lo sacamos", a pedido: lo que dijo el padre, como cita. Cerrado, para no recargar la tarjeta. */
function DeDonde({ children }: { children: ReactNode }) {
  return (
    <details className="group flex flex-col">
      <summary className="inline-flex min-h-12 w-fit cursor-pointer list-none items-center gap-1.5 rounded-full font-bold text-primary [&::-webkit-details-marker]:hidden">
        <Quote className="size-4" strokeWidth={2.25} aria-hidden="true" />
        De dónde lo sacamos
        <ChevronDown className="size-4 transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none" strokeWidth={2.25} aria-hidden="true" />
      </summary>
      {children}
    </details>
  )
}

/** La cita de un dato, a pedido. Si el padre corrige el valor, la cita deja de mostrarse. */
function CitaDeDonde({ cita }: { cita?: string }) {
  if (!cita) return null
  return <DeDonde><Cita cita={cita} /></DeDonde>
}

/** Las citas de los datos básicos, juntas en un solo "de dónde lo sacamos" (uno por campo recarga la tarjeta). */
function Citas({ lista }: { lista: [string, string | undefined][] }) {
  const con = lista.filter((x): x is [string, string] => !!x[1])
  if (!con.length) return null
  return (
    <DeDonde>
      <dl className="flex flex-col gap-2 rounded-2xl rounded-tl-md bg-brote px-4 py-3 text-sm text-pino">
        {con.map(([que, cita]) => (
          <div key={que} className="flex flex-wrap gap-x-2">
            <dt className="font-bold">{que}</dt>
            <dd className="italic [overflow-wrap:anywhere]">«{cita}»</dd>
          </div>
        ))}
      </dl>
    </DeDonde>
  )
}

/** Lo que se suma a una lista entra con un resorte; lo que ya estaba al abrir la pantalla queda quieto. */
function useNuevos(largo: number) {
  const vistos = useRef(largo)
  useEffect(() => { vistos.current = largo })
  return (i: number) => i >= vistos.current
}
const entrada = (nuevo: boolean) => (nuevo ? { opacity: 0, scale: 0.92 } : false)

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
  const nuevaAcepta = useNuevos(b.acepta.length)
  const nuevaRechaza = useNuevos(b.rechaza.length)
  const nuevaRegla = useNuevos(b.reglas.length)

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
    <div className="flex flex-col gap-7">
      {pendiente && (
        <Aviso icono={MessageCircleQuestionMark} className="-mb-2">
          <p>No nos contaste {pendiente}. Completalo acá abajo.</p>
        </Aviso>
      )}

      {/* La protagonista: sus alimentos seguros. La sombra va afuera: el mordisco la recortaría. */}
      <div className="rounded-3xl shadow-flotante">
        <section aria-labelledby="pf-t-acepta" className="mordisco flex flex-col gap-4 rounded-3xl bg-brote px-4 pt-5 pb-5">
          <TituloSeccion id="pf-t-acepta" ref={refTitulos.acepta} icono={ICONO.acepta} enBrote className="pr-5 text-[1.4rem] min-[380px]:text-2xl">
            Lo que come seguro
          </TituloSeccion>
          {b.acepta.length === 0 && (
            <p className="px-1 text-pino">No encontramos alimentos seguros en lo que contaste. Sumá al menos uno.</p>
          )}
          {b.acepta.length > 0 && (
            <ul className="flex flex-col gap-2">
              {b.acepta.map((a, i) => (
                <FilaAcepta
                  // Clave por posición: al renombrar, la fila sigue montada y el foco vuelve a su botón de editar.
                  key={i} nombre={a.nombre} marca={a.marca} grupo={a.atributos.grupo} nueva={nuevaAcepta(i)}
                  alRenombrar={(n) => setBorrador(renombrarAcepta(b, i, n))}
                  alQuitar={() => quitando('acepta', quitarAcepta(b, i))}
                />
              ))}
            </ul>
          )}
          <Agregar
            etiqueta="Sumar algo que come seguro" ejemplo="Ej.: galletitas de arroz"
            alAgregar={(n) => setBorrador(agregarAcepta(b, n))} refInput={refs.acepta} error={errores.acepta}
          />
        </section>
      </div>

      <section aria-labelledby="pf-t-rechaza" className="flex flex-col gap-3">
        <TituloSeccion id="pf-t-rechaza" ref={refTitulos.rechaza} icono={ICONO.rechaza}>Lo que por ahora no come</TituloSeccion>
        {b.rechaza.length === 0 && <p className="text-musgo">No mencionaste nada. Es opcional.</p>}
        {b.rechaza.length > 0 && (
          <ul className="flex flex-col gap-2">
            {b.rechaza.map((r, i) => (
              <FilaRechaza
                key={`${i}:${clave(r.nombre)}`} nombre={r.nombre} motivo={r.motivo} nueva={nuevaRechaza(i)}
                alCambiarMotivo={(m) => setBorrador(cambiarMotivo(b, i, m))}
                alQuitar={() => quitando('rechaza', quitarRechaza(b, i))}
              />
            ))}
          </ul>
        )}
        <Agregar etiqueta="Sumar algo que por ahora no come" ejemplo="Ej.: tomate" alAgregar={(n) => setBorrador(agregarRechaza(b, n))} />
      </section>

      <section aria-labelledby="pf-t-reglas" className="flex flex-col gap-3">
        <TituloSeccion id="pf-t-reglas" ref={refTitulos.reglas} icono={ICONO.reglas}>Sus reglas</TituloSeccion>
        {b.reglas.length === 0 && <p className="text-musgo">No encontramos reglas. Es opcional.</p>}
        {b.reglas.length > 0 && (
          <ul className="flex flex-col gap-2">
            {b.reglas.map((r, i) => (
              <motion.li
                key={`${i}:${clave(r.texto)}`}
                className="flex items-center gap-2 rounded-[1.75rem] border bg-card p-1 pl-4"
                initial={entrada(nuevaRegla(i))} animate={{ opacity: 1, scale: 1 }} transition={RESORTE}
              >
                <span className="min-w-0 flex-1 py-2 leading-snug font-bold text-pino [overflow-wrap:anywhere]">{r.texto}</span>
                <BotonQuitar que={r.texto} alQuitar={() => quitando('reglas', quitarRegla(b, i))} />
              </motion.li>
            ))}
          </ul>
        )}
        <Agregar etiqueta="Sumar una regla" ejemplo="Ej.: que no se toquen" alAgregar={(t) => setBorrador(agregarRegla(b, t))} />
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border bg-card p-5" aria-labelledby="pf-t-datos">
        <div className="flex items-center gap-3">
          <Inicial nombre={f.nombre} className="size-11 text-2xl" />
          <h2 id="pf-t-datos" className="text-xl">Sus datos</h2>
        </div>
        <Campo
          ref={refs.nombre} etiqueta="Nombre" valor={f.nombre} alCambiar={(v) => cambiar('nombre', v)} ayuda={ayudaFalta('nombre')}
          error={errores.nombre} autoComplete="off" autoCapitalize="words" enterKeyHint="next" required
        />
        <Campo
          ref={refs.edad} etiqueta="Edad (años)" valor={f.edad} alCambiar={(v) => cambiar('edad', v)} ayuda={ayudaFalta('edad')}
          error={errores.edad} inputMode="numeric" pattern="[0-9]*" maxLength={2} className="w-24 text-center tabular-nums" required
        />
        <OpcionUnica
          leyenda="Sexo" nombre="sexo" opciones={SEXOS} etiquetas={NOMBRE_SEXO} valor={f.sexo}
          alCambiar={(v) => cambiar('sexo', v)} error={errores.sexo} refPrimera={refs.sexo}
          ayuda={falta('sexo') ? 'No lo mencionaste. Lo usamos solo para las referencias de nutrientes de su edad.' : 'Solo para usar las referencias de nutrientes de su edad.'}
        />
        <div className="grid grid-cols-2 gap-3">
          <Campo
            ref={refs.pesoKg} etiqueta={<>Peso (kg) <span className="text-sm font-normal text-musgo">opcional</span></>}
            valor={f.pesoKg} alCambiar={(v) => cambiar('pesoKg', v)} error={errores.pesoKg} inputMode="decimal" className="tabular-nums"
          />
          <Campo
            ref={refs.tallaCm} etiqueta={<>Talla (cm) <span className="text-sm font-normal text-musgo">opcional</span></>}
            valor={f.tallaCm} alCambiar={(v) => cambiar('tallaCm', v)} error={errores.tallaCm} inputMode="numeric" className="tabular-nums"
          />
        </div>
        <Citas lista={[
          ['Nombre', citaVigente(ex?.nombre, f.nombre)], ['Edad', citaVigente(ex?.edad, f.edad)], ['Sexo', citaVigente(ex?.sexo, f.sexo)],
          ['Peso', citaVigente(ex?.pesoKg, f.pesoKg)], ['Talla', citaVigente(ex?.tallaCm, f.tallaCm)],
        ]} />
      </section>

      <section className="flex flex-col rounded-2xl border bg-card p-5" aria-label="Alergias">
        <Alergias
          alta={alta} setAlta={setAlta} extraidos={ex} nombre={nombre} falta={falta('alergias')}
          error={errores.alergias} refPrimera={refs.alergias}
        />
      </section>

      <section className="flex flex-col gap-5 rounded-2xl border bg-card p-5" aria-labelledby="pf-t-cuidados">
        <h2 id="pf-t-cuidados" className="text-xl">Dieta y cuidados</h2>
        <OpcionUnica
          leyenda="¿Sigue alguna dieta?" nombre="dieta" opciones={DIETA} etiquetas={NOMBRE_DIETA} valor={f.dieta}
          alCambiar={(v) => cambiar('dieta', v)} pie={<CitaDeDonde cita={citaVigente(ex?.dieta, f.dieta)} />}
        />
        {f.dieta === 'sin_gluten_caseina' && <Aviso icono={Stethoscope} rol="status"><p>{AVISO_DIETA}</p></Aviso>}

        <fieldset className="flex min-w-0 flex-col gap-2">
          <legend className="mb-1.5 font-bold text-pino">¿Algo de esto pasa con {nombre}?</legend>
          {SENALES.map((s) => (
            <ChipAlternar
              key={s} className="w-full rounded-2xl py-3" activo={f.alertas.includes(s)}
              alTocar={() => cambiar('alertas', alternarSenal(f.alertas, s))}
            >
              {NOMBRE_SENAL[s]}
            </ChipAlternar>
          ))}
          {alertasCitadas.map((a) => <Cita key={a.valor} cita={a.cita} />)}
          {f.alertas.length > 0 && <Aviso icono={Stethoscope} rol="status" className="mt-1"><p>{AVISO_DECLARADA}</p></Aviso>}
        </fieldset>

        {ex?.atragantamiento && (
          <Aviso icono={Stethoscope}>
            <p>Nos contaste que tose o se atraganta al comer: «{ex.atragantamiento.cita}».</p>
            <p>{AVISO_ATRAGANTAMIENTO}</p>
          </Aviso>
        )}

        <Campo
          etiqueta={<>Suplementos <span className="text-sm font-normal text-musgo">opcional</span></>}
          ayuda="Solo para el registro: la app nunca sugiere suplementos."
          valor={f.suplementos} alCambiar={(v) => cambiar('suplementos', v)} autoComplete="off"
          placeholder="Por ejemplo, vitamina D en gotas" pie={<CitaDeDonde cita={citaVigente(ex?.suplementos, f.suplementos)} />}
        />
      </section>

      <div className="flex flex-col gap-3">
        {intentado && !revision.ok && (
          <Falta rol="alert">Para crear el perfil falta completar lo que está marcado arriba.</Falta>
        )}
        {errorCrear && <ErrorConReintento error={errorCrear} reintentar={confirmar} />}
        {creando ? (
          <Cargando texto={`Creando el perfil de ${nombre}…`} className="justify-center py-3" />
        ) : (
          <>
            {!intentado && !alergiasRespondidas(alta) && (
              <p className="flex items-start gap-2 px-1 text-sm text-musgo">
                <ShieldCheck className="mt-px size-4 shrink-0" strokeWidth={2.25} aria-hidden="true" />
                Para crear el perfil, contanos si tiene alergias.
              </p>
            )}
            <Button size="lg" className="h-auto min-h-14 w-full py-3 whitespace-normal text-balance" onClick={confirmar}>
              {f.nombre.trim() ? `Listo, crear el perfil de ${nombre}` : 'Listo, crear su perfil'}
            </Button>
            <Button variant="ghost" className="self-center text-musgo" onClick={alVolver}>Volver a lo que contaste</Button>
          </>
        )}
      </div>
    </div>
  )
}

function BotonQuitar({ que, alQuitar }: { que: string; alQuitar: () => void }) {
  return (
    <Button variant="ghost" size="icon" className="shrink-0 rounded-full text-musgo" aria-label={`Quitar “${que}”`} onClick={alQuitar}>
      <X aria-hidden="true" />
    </Button>
  )
}

/** Un alimento seguro como un bocado: su ícono, el nombre (al tocarlo se corrige) y la marca si la dijo. */
function FilaAcepta({ nombre, marca, grupo, nueva, alRenombrar, alQuitar }: {
  nombre: string; marca?: string; grupo?: Grupo; nueva: boolean; alRenombrar: (n: string) => void; alQuitar: () => void
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

  return (
    <motion.li
      className="flex items-center gap-1 rounded-[1.75rem] bg-background p-1.5"
      initial={entrada(nueva)} animate={{ opacity: 1, scale: 1 }} transition={RESORTE}
    >
      {editando ? (
        <form className="flex min-w-0 flex-1 gap-2" onSubmit={guardar}>
          <label htmlFor={id} className="sr-only">Nuevo nombre para {nombre}</label>
          <Input
            ref={refInput} id={id} className={cn(CLASE_INPUT, 'min-w-0 flex-1 rounded-full')} value={valor}
            onChange={(e) => setValor(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') { setValor(nombre); cerrar() } }} enterKeyHint="done"
          />
          <Button type="submit">Guardar</Button>
        </form>
      ) : (
        <>
          <button
            ref={refEditar} type="button" aria-label={`Cambiar el nombre de “${nombre}”`}
            aria-describedby={marca ? `${id}-marca` : undefined}
            onClick={() => { setValor(nombre); setEditando(true) }}
            className="flex min-h-12 min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-[1.4rem] pr-2 text-left transition-colors duration-150 hover:bg-muted/70"
          >
            <IconoAlimento nombre={nombre} grupo={grupo} tamano="md" />
            <span className="flex min-w-0 flex-1 flex-col py-1">
              <span className="leading-snug font-bold text-pino first-letter:uppercase [overflow-wrap:anywhere]">{nombre}</span>
              {marca && <span id={`${id}-marca`} className="text-sm text-musgo">Marca: {marca}</span>}
            </span>
            <Pencil className="size-4 shrink-0 text-musgo" strokeWidth={2.25} aria-hidden="true" />
          </button>
          <BotonQuitar que={nombre} alQuitar={alQuitar} />
        </>
      )}
    </motion.li>
  )
}

/** Lo que por ahora no come, con el porqué: nada de rojo, es "todavía". */
function FilaRechaza({ nombre, motivo, nueva, alCambiarMotivo, alQuitar }: {
  nombre: string; motivo: Motivo; nueva: boolean; alCambiarMotivo: (m: Motivo) => void; alQuitar: () => void
}) {
  const id = useId()
  return (
    <motion.li
      className="flex flex-col gap-1 rounded-2xl border bg-card p-1.5 pl-2"
      initial={entrada(nueva)} animate={{ opacity: 1, scale: 1 }} transition={RESORTE}
    >
      <div className="flex items-center gap-3">
        <IconoAlimento nombre={nombre} tamano="md" />
        <span className="min-w-0 flex-1 leading-snug font-bold text-pino first-letter:uppercase [overflow-wrap:anywhere]">{nombre}</span>
        <BotonQuitar que={nombre} alQuitar={alQuitar} />
      </div>
      <div className="flex flex-wrap items-center gap-2 pb-1 pl-14">
        <label htmlFor={id} className="text-musgo">Por<span className="sr-only"> qué no come {nombre}</span></label>
        <span className="relative min-w-0">
          <select
            id={id} value={motivo} onChange={(e) => alCambiarMotivo(e.target.value as Motivo)}
            className="h-12 max-w-full cursor-pointer appearance-none rounded-full border border-input bg-background pr-10 pl-4 text-base font-bold text-pino transition-colors outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {MOTIVO.map((m) => <option key={m} value={m}>{NOMBRE_MOTIVO[m]}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-musgo" strokeWidth={2.25} aria-hidden="true" />
        </span>
      </div>
    </motion.li>
  )
}
