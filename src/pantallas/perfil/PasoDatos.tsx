// Datos básicos a mano (las alergias las marca el padre, §5). TRANSICIÓN hasta A8b: en el alta por voz solo aparece si
// /api/perfil-inicial todavía exige `datos` (ver pideDatosManuales en alta.ts). Borrar cuando A8b esté en main.
// Se ve como la tarjeta "Sus datos" de "Esto entendimos": la inicial se arma mientras escribe el nombre.
import { Stethoscope } from 'lucide-react'
import { useRef, useState, type FormEvent } from 'react'
import { ALERGENO, DIETA, type DatosBasicos } from '../../../shared/contratos'
import { Button } from '../../componentes/ui/button'
import { NOMBRE_ALERGENO } from '../../lib/vocabulario'
import {
  alternarAlergia, alternarSenal, ORDEN_CAMPOS, SENALES, validarDatos,
  type CampoDatos, type ErroresDatos, type FormDatos,
} from './borrador'
import { Campo, ChipAlternar, OpcionUnica } from './Controles'
import { Aviso, Inicial } from './Piezas'
import { AVISO_DECLARADA, AVISO_DIETA, NOMBRE_DIETA, NOMBRE_SENAL, NOMBRE_SEXO } from './textos'

const SEXOS = ['femenino', 'masculino'] as const
const OPCIONAL = <span className="text-sm font-normal text-musgo">opcional</span>

interface Props {
  form: FormDatos
  setForm: (f: FormDatos) => void
  alSeguir: (datos: DatosBasicos) => void
  textoSeguir?: string
  /** Solo nombre, edad, sexo, peso y talla: alergias, dieta y señales se confirman después en "Esto entendí". */
  compacto?: boolean
}

export function PasoDatos({ form, setForm, alSeguir, textoSeguir = 'Seguir', compacto = false }: Props) {
  const [errores, setErrores] = useState<ErroresDatos>({})
  const refs = {
    nombre: useRef<HTMLInputElement>(null), edad: useRef<HTMLInputElement>(null), sexo: useRef<HTMLInputElement>(null),
    pesoKg: useRef<HTMLInputElement>(null), tallaCm: useRef<HTMLInputElement>(null),
  } satisfies Record<CampoDatos, unknown>

  const cambiar = <K extends keyof FormDatos>(k: K, v: FormDatos[K]) => {
    setForm({ ...form, [k]: v })
    if (k in errores) setErrores(({ [k as CampoDatos]: _, ...resto }) => resto)
  }

  const enviar = (e: FormEvent) => {
    e.preventDefault()
    const v = validarDatos(form)
    if (v.ok) return alSeguir(v.datos)
    setErrores(v.errores)
    const primero = ORDEN_CAMPOS.find((c) => v.errores[c])
    if (primero) refs[primero].current?.focus()
  }

  const nombre = form.nombre.trim() || 'tu hijo o hija'

  return (
    <form className="flex flex-col gap-5" onSubmit={enviar} noValidate>
      <div className="flex flex-col gap-4 rounded-2xl border bg-card p-5">
        <Inicial nombre={form.nombre} className="size-14 text-3xl" />
        <Campo
          ref={refs.nombre} etiqueta="Nombre" valor={form.nombre} alCambiar={(v) => cambiar('nombre', v)}
          error={errores.nombre} autoComplete="off" autoCapitalize="words" enterKeyHint="next" required
        />
        <Campo
          ref={refs.edad} etiqueta="Edad (años)" valor={form.edad} alCambiar={(v) => cambiar('edad', v)}
          error={errores.edad} inputMode="numeric" pattern="[0-9]*" maxLength={2} className="w-24 text-center tabular-nums" required
        />
        <OpcionUnica
          leyenda="Sexo" nombre="sexo" opciones={SEXOS} etiquetas={NOMBRE_SEXO} valor={form.sexo}
          alCambiar={(v) => cambiar('sexo', v)} error={errores.sexo} refPrimera={refs.sexo}
          ayuda="Solo para usar las referencias de nutrientes de su edad."
        />
        <div className="grid grid-cols-2 gap-3">
          <Campo
            ref={refs.pesoKg} etiqueta={<>Peso (kg) {OPCIONAL}</>}
            valor={form.pesoKg} alCambiar={(v) => cambiar('pesoKg', v)} error={errores.pesoKg} inputMode="decimal" className="tabular-nums"
          />
          <Campo
            ref={refs.tallaCm} etiqueta={<>Talla (cm) {OPCIONAL}</>}
            valor={form.tallaCm} alCambiar={(v) => cambiar('tallaCm', v)} error={errores.tallaCm} inputMode="numeric" className="tabular-nums"
          />
        </div>
      </div>

      {!compacto && (
        <div className="flex flex-col gap-5 rounded-2xl border bg-card p-5">
          <fieldset className="flex min-w-0 flex-col gap-2" aria-describedby="pf-nota-alergias">
            <legend className="mb-1.5 font-bold text-pino">Alergias</legend>
            <p id="pf-nota-alergias" className="-mt-0.5 text-sm text-musgo">Las alergias las marcás vos; la app nunca las adivina.</p>
            <div className="flex flex-wrap gap-2">
              {ALERGENO.map((a) => (
                <ChipAlternar
                  key={a} className="min-h-14 pr-5" activo={form.alergias.includes(a)}
                  alTocar={() => cambiar('alergias', alternarAlergia(form.alergias, a))}
                >
                  {NOMBRE_ALERGENO[a]}
                </ChipAlternar>
              ))}
            </div>
            <p className="text-sm text-musgo">
              {form.alergias.length ? `Marcaste: ${form.alergias.map((a) => NOMBRE_ALERGENO[a]).join(', ')}.` : 'Sin alergias marcadas.'}
            </p>
          </fieldset>

          <OpcionUnica
            leyenda="¿Sigue alguna dieta?" nombre="dieta" opciones={DIETA} etiquetas={NOMBRE_DIETA} valor={form.dieta}
            alCambiar={(v) => cambiar('dieta', v)}
          />
          {form.dieta === 'sin_gluten_caseina' && <Aviso icono={Stethoscope} rol="status"><p>{AVISO_DIETA}</p></Aviso>}

          <fieldset className="flex min-w-0 flex-col gap-2">
            <legend className="mb-1.5 font-bold text-pino">¿Algo de esto pasa con {nombre}?</legend>
            {SENALES.map((s) => (
              <ChipAlternar
                key={s} className="w-full rounded-2xl py-3" activo={form.alertas.includes(s)}
                alTocar={() => cambiar('alertas', alternarSenal(form.alertas, s))}
              >
                {NOMBRE_SENAL[s]}
              </ChipAlternar>
            ))}
            {form.alertas.length > 0 && <Aviso icono={Stethoscope} rol="status" className="mt-1"><p>{AVISO_DECLARADA}</p></Aviso>}
          </fieldset>

          <Campo
            etiqueta={<>Suplementos {OPCIONAL}</>}
            ayuda="Solo para el registro: la app nunca sugiere suplementos."
            valor={form.suplementos} alCambiar={(v) => cambiar('suplementos', v)} autoComplete="off"
            placeholder="Por ejemplo, vitamina D en gotas"
          />
        </div>
      )}

      <Button type="submit" size="lg" className="w-full">{textoSeguir}</Button>
    </form>
  )
}
