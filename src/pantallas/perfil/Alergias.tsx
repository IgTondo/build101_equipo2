// "¿Tiene alergias?" en "Esto entendí" (§5.2, v5 · 17): las alergias las escucha la IA pero las confirma el padre.
// Una alergia mencionada aparece como sugerencia SIN marcar; recién cuenta cuando el padre la toca. "No tiene
// alergias" también se toca (si lo dijo, aparece sugerido). Sin una de las dos respuestas no se crea el perfil.
import { useId, type Ref } from 'react'
import { ALERGENO, type DatosExtraidos } from '../../../shared/contratos'
import { NOMBRE_ALERGENO } from '../../lib/vocabulario'
import { tocarAlergia, tocarSinAlergias, type Alta } from './alta'
import { ChipAlternar } from './Controles'
import { ALERGENO_CON_ARTICULO, alergico } from './textos'

interface Props {
  alta: Alta
  setAlta: (a: Alta) => void
  extraidos: DatosExtraidos | undefined
  nombre: string
  falta: boolean
  error?: string
  refPrimera?: Ref<HTMLButtonElement>
}

export function Alergias({ alta, setAlta, extraidos, nombre, falta, error, refPrimera }: Props) {
  const id = useId()
  const mencionadas = extraidos?.alergiasMencionadas ?? []
  const dijoQueNo = extraidos?.sinAlergias
  const otras = ALERGENO.filter((a) => !mencionadas.some((m) => m.valor === a))
  const confirmadas = alta.form.alergias
  const es = alergico(alta.form.sexo)
  const primera = mencionadas.length ? 'mencionada' : 'otra'

  const estado = alta.sinAlergias
    ? 'Confirmaste que no tiene alergias.'
    : confirmadas.length
      ? `Confirmaste: ${confirmadas.map((a) => NOMBRE_ALERGENO[a].toLowerCase()).join(', ')}.`
      : 'Todavía no nos dijiste si tiene alergias.'

  return (
    <fieldset className="pf-grupo" aria-describedby={`${id}-nota${error ? ` ${id}-error` : ''}`}>
      <legend>¿Tiene alergias?</legend>
      <p id={`${id}-nota`} className="pf-nota">
        Las alergias las confirmás vos: Nibble no guarda ninguna sin que la toques.
        {falta && ' No las mencionaste en el audio.'}
      </p>

      {mencionadas.length > 0 && (
        <div className="pf-sugeridas">
          <p className="pf-pregunta">
            {mencionadas.length === 1
              ? `¿${nombre} es ${es} ${ALERGENO_CON_ARTICULO[mencionadas[0].valor]}? Tocalo para confirmar.`
              : `Mencionaste estas alergias. Tocá las que tiene ${nombre} para confirmarlas.`}
          </p>
          {mencionadas.map((m, i) => {
            const activa = confirmadas.includes(m.valor)
            return (
              <div key={m.valor} className="pf-sugerida">
                <ChipAlternar
                  ref={i === 0 && primera === 'mencionada' ? refPrimera : undefined}
                  activo={activa} alTocar={() => setAlta(tocarAlergia(alta, m.valor))} variante="sugerida" describe={`${id}-cita-${m.valor}`}
                >
                  {NOMBRE_ALERGENO[m.valor]}
                  <span className="pf-chip-estado">{activa ? 'Confirmada' : 'Sin confirmar'}</span>
                </ChipAlternar>
                <p id={`${id}-cita-${m.valor}`} className="pf-cita-linea">Dijiste: «{m.cita}»</p>
              </div>
            )
          })}
        </div>
      )}

      <p className="pf-etiqueta-chica">{mencionadas.length ? 'Otras alergias' : 'Tocá las que tiene'}</p>
      <div className="pf-chips">
        {otras.map((a, i) => (
          <ChipAlternar
            key={a} ref={i === 0 && primera === 'otra' ? refPrimera : undefined}
            activo={confirmadas.includes(a)} alTocar={() => setAlta(tocarAlergia(alta, a))}
          >
            {NOMBRE_ALERGENO[a]}
          </ChipAlternar>
        ))}
      </div>

      <div className="pf-sugerida">
        <ChipAlternar
          activo={alta.sinAlergias} alTocar={() => setAlta(tocarSinAlergias(alta))}
          variante={dijoQueNo && !alta.sinAlergias ? 'sugerida' : undefined} describe={dijoQueNo ? `${id}-cita-no` : undefined}
        >
          No tiene alergias
          {dijoQueNo && !alta.sinAlergias && <span className="pf-chip-estado">Tocalo para confirmar</span>}
        </ChipAlternar>
        {dijoQueNo && <p id={`${id}-cita-no`} className="pf-cita-linea">Dijiste: «{dijoQueNo.cita}»</p>}
      </div>

      <p className="pf-ayuda" role="status">{estado}</p>
      {error && <p id={`${id}-error`} className="pf-error">{error}</p>}
    </fieldset>
  )
}
