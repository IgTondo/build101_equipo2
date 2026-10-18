// Datos básicos a mano (las alergias las marca el padre, §5). TRANSICIÓN hasta A8b: en el alta por voz solo aparece si
// /api/perfil-inicial todavía exige `datos` (ver pideDatosManuales en alta.ts). Borrar cuando A8b esté en main.
import { useRef, useState, type FormEvent } from 'react'
import { ALERGENO, DIETA, type DatosBasicos } from '../../../shared/contratos'
import { NOMBRE_ALERGENO } from '../../lib/vocabulario'
import {
  alternarAlergia, alternarSenal, ORDEN_CAMPOS, SENALES, validarDatos,
  type CampoDatos, type ErroresDatos, type FormDatos,
} from './borrador'
import { Campo, ChipAlternar, OpcionUnica } from './Controles'
import { AVISO_DECLARADA, AVISO_DIETA, NOMBRE_DIETA, NOMBRE_SENAL, NOMBRE_SEXO } from './textos'

const SEXOS = ['femenino', 'masculino'] as const

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
    <form className="pf-form" onSubmit={enviar} noValidate>
      <Campo
        ref={refs.nombre} etiqueta="Nombre" valor={form.nombre} alCambiar={(v) => cambiar('nombre', v)}
        error={errores.nombre} autoComplete="off" autoCapitalize="words" enterKeyHint="next" required
      />
      <Campo
        ref={refs.edad} etiqueta="Edad (años)" valor={form.edad} alCambiar={(v) => cambiar('edad', v)}
        error={errores.edad} inputMode="numeric" pattern="[0-9]*" maxLength={2} className="pf-input pf-input-corto" required
      />
      <OpcionUnica
        leyenda="Sexo" nombre="sexo" opciones={SEXOS} etiquetas={NOMBRE_SEXO} valor={form.sexo}
        alCambiar={(v) => cambiar('sexo', v)} error={errores.sexo} refPrimera={refs.sexo}
        ayuda="Solo para usar las referencias de nutrientes de su edad."
      />
      <div className="pf-dos-columnas">
        <Campo
          ref={refs.pesoKg} etiqueta={<>Peso (kg) <span className="pf-opcional">opcional</span></>}
          valor={form.pesoKg} alCambiar={(v) => cambiar('pesoKg', v)} error={errores.pesoKg} inputMode="decimal"
        />
        <Campo
          ref={refs.tallaCm} etiqueta={<>Talla (cm) <span className="pf-opcional">opcional</span></>}
          valor={form.tallaCm} alCambiar={(v) => cambiar('tallaCm', v)} error={errores.tallaCm} inputMode="numeric"
        />
      </div>

      {!compacto && <>
      <fieldset className="pf-grupo" aria-describedby="pf-nota-alergias">
        <legend>Alergias</legend>
        <p id="pf-nota-alergias" className="pf-nota">Las alergias las marcás vos; la app nunca las adivina.</p>
        <div className="pf-chips">
          {ALERGENO.map((a) => (
            <ChipAlternar key={a} activo={form.alergias.includes(a)} alTocar={() => cambiar('alergias', alternarAlergia(form.alergias, a))}>
              {NOMBRE_ALERGENO[a]}
            </ChipAlternar>
          ))}
        </div>
        <p className="pf-ayuda">
          {form.alergias.length ? `Marcaste: ${form.alergias.map((a) => NOMBRE_ALERGENO[a]).join(', ')}.` : 'Sin alergias marcadas.'}
        </p>
      </fieldset>

      <OpcionUnica
        leyenda="¿Sigue alguna dieta?" nombre="dieta" opciones={DIETA} etiquetas={NOMBRE_DIETA} valor={form.dieta}
        alCambiar={(v) => cambiar('dieta', v)}
      />
      {form.dieta === 'sin_gluten_caseina' && <p className="pf-aviso-suave" role="status">{AVISO_DIETA}</p>}

      <fieldset className="pf-grupo">
        <legend>¿Algo de esto pasa con {nombre}?</legend>
        <p className="pf-ayuda">Marcá solo lo que corresponda. Nos ayuda a avisarte cuándo conviene consultar.</p>
        <div className="pf-chips pf-chips-columna">
          {SENALES.map((s) => (
            <ChipAlternar key={s} activo={form.alertas.includes(s)} alTocar={() => cambiar('alertas', alternarSenal(form.alertas, s))}>
              {NOMBRE_SENAL[s]}
            </ChipAlternar>
          ))}
        </div>
        {form.alertas.length > 0 && <p className="pf-aviso-suave" role="status">{AVISO_DECLARADA}</p>}
      </fieldset>

      <Campo
        etiqueta={<>Suplementos <span className="pf-opcional">opcional</span></>}
        ayuda="Solo para el registro: la app nunca sugiere suplementos."
        valor={form.suplementos} alCambiar={(v) => cambiar('suplementos', v)} autoComplete="off"
        placeholder="Por ejemplo, vitamina D en gotas"
      />
      </>}

      <button type="submit" className="nb-boton">{textoSeguir}</button>
    </form>
  )
}
