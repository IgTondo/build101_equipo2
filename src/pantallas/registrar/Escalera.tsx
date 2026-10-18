// Los botones de "¿cómo le fue?" (§5.1): la escalera por ítem, el motivo opcional, la conducta y las preguntas de la IA.
// Lo que marcó la IA con la nota se resalta y muestra la cita; el padre siempre puede corregir.
import { useId } from 'react'
import { CONDUCTA, CUANTO, MOTIVO, type Conducta, type Cuanto, type Motivo, type Pregunta } from '../../../shared/contratos'
import { BOTON_CUANTO, CHIP_CONDUCTA, ESCALON, NOMBRE_MOTIVO } from '../../lib/vocabulario'
import { CON_MOTIVO, esDeIA, type ItemEdit, type RespuestaEdit } from './modelo'

const mayuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** Una línea de aliento según el escalón: cada paso cuenta, nunca se premia "comer todo". */
function aliento(c: Cuanto): string | null {
  if (c === 'nada') return 'Que esté en el plato ya es un avance.'
  if (c === 'toco' || c === 'probo') return `${mayuscula(ESCALON[c])}: cada paso cuenta.`
  if (c === 'aparto') return 'Queda anotado. Otro día se vuelve a ofrecer, sin presión.'
  return null
}

interface EscaleraProps {
  item: ItemEdit
  n: number
  respuesta?: RespuestaEdit
  sinMencion: boolean
  alCuanto: (c: Cuanto) => void
  alMotivo: (m: Motivo | undefined) => void
}

export function EscaleraItem({ item, n, respuesta, sinMencion, alCuanto, alMotivo }: EscaleraProps) {
  const id = useId()
  const deIA = esDeIA(respuesta)
  const cuanto = respuesta?.cuanto
  const verMotivo = !!cuanto && (CON_MOTIVO.includes(cuanto) || !!respuesta?.motivo)
  const frase = cuanto ? aliento(cuanto) : null
  const ayudaId = `${id}-ayuda`

  return (
    <fieldset className={`rg-escalera${deIA ? ' rg-escalera-ia' : ''}`} aria-describedby={ayudaId}>
      <legend className="rg-escalera-titulo">
        <span className="rg-numero" aria-hidden="true">{n}</span> {item.preparacion}
      </legend>
      <div id={ayudaId}>
        {deIA && respuesta?.ia?.cita && (
          <p className="rg-cita">
            <span className="rg-insignia">De tu nota</span>{' '}
            Dijiste: «{respuesta.ia.cita}»
          </p>
        )}
        {!cuanto && sinMencion && <p className="rg-pista">No lo nombraste en la nota: marcalo vos.</p>}
      </div>
      <div className="rg-escalones">
        {CUANTO.map((c) => (
          <label key={c} className={`rg-escalon${deIA && cuanto === c ? ' rg-marcado-ia' : ''}`}>
            <input type="radio" name={`${id}-cuanto`} value={c} checked={cuanto === c} onChange={() => alCuanto(c)} />
            <span>{BOTON_CUANTO[c]}</span>
          </label>
        ))}
      </div>
      {frase && <p className="rg-aliento" aria-live="polite">{frase}</p>}
      {verMotivo && (
        <div className="rg-motivo" role="group" aria-labelledby={`${id}-motivo`}>
          <p id={`${id}-motivo`} className="rg-leyenda-chica">¿Te parece que fue por algo? <span className="nb-suave">(opcional)</span></p>
          <div className="rg-chips">
            {MOTIVO.map((m) => (
              <button
                key={m}
                type="button"
                className="rg-chip"
                aria-pressed={respuesta?.motivo === m}
                onClick={() => alMotivo(respuesta?.motivo === m ? undefined : m)}
              >
                {mayuscula(NOMBRE_MOTIVO[m])}
              </button>
            ))}
          </div>
        </div>
      )}
    </fieldset>
  )
}

export function ChipsConducta({ marcadas, deIA, alCambiar }: {
  marcadas: Conducta[]
  deIA: Conducta[]
  alCambiar: (c: Conducta[]) => void
}) {
  const id = useId()
  return (
    <div className="nb-tarjeta">
    <fieldset className="rg-conducta">
      <legend className="rg-leyenda">¿Cómo estuvo en la mesa? <span className="rg-opcional">(opcional)</span></legend>
      <div className="rg-chips">
        {CONDUCTA.map((c) => {
          const on = marcadas.includes(c)
          return (
            <label key={c} className={`rg-chip rg-chip-check${on && deIA.includes(c) ? ' rg-marcado-ia' : ''}`}>
              <input
                type="checkbox"
                name={`${id}-conducta`}
                checked={on}
                onChange={() => alCambiar(on ? marcadas.filter((x) => x !== c) : [...marcadas, c])}
              />
              <span>{CHIP_CONDUCTA[c]}</span>
            </label>
          )
        })}
      </div>
      {deIA.length > 0 && <p className="rg-pista"><span className="rg-insignia">De tu nota</span> lo resaltado.</p>}
    </fieldset>
    </div>
  )
}

export function PreguntaIA({ pregunta, respuesta, deIA, alResponder }: {
  pregunta: Pregunta
  respuesta?: string
  deIA: boolean
  alResponder: (r: string) => void
}) {
  const id = useId()
  return (
    <fieldset className="rg-pregunta">
      <legend className="rg-leyenda-chica">{pregunta.texto}</legend>
      <div className="rg-chips">
        {pregunta.opciones.map((o) => (
          <label key={o} className={`rg-chip rg-chip-check${deIA && respuesta === o ? ' rg-marcado-ia' : ''}`}>
            <input type="radio" name={`${id}-pregunta`} value={o} checked={respuesta === o} onChange={() => alResponder(o)} />
            <span>{o}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
