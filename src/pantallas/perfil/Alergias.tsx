// "¿Tiene alergias?" en "Esto entendí" (§5.2, v5 · 17): las alergias las escucha la IA pero las confirma el padre.
// Una alergia mencionada aparece como sugerencia SIN marcar; recién cuenta cuando el padre la toca. "No tiene
// alergias" también se toca (si lo dijo, aparece sugerido). Sin una de las dos respuestas no se crea el perfil.
// Se ve como interruptores grandes: lo sugerido con el borde Zapallo punteado (falta confirmarlo) y la cita debajo;
// abajo de todo, en qué quedó la respuesta.
import { cn } from 'cn'
import { CircleCheck, CircleDashed, ShieldCheck } from 'lucide-react'
import { useId, type Ref } from 'react'
import { ALERGENO, type DatosExtraidos } from '../../../shared/contratos'
import { NOMBRE_ALERGENO } from '../../lib/vocabulario'
import { alergiasRespondidas, tocarAlergia, tocarSinAlergias, type Alta } from './alta'
import { ChipAlternar } from './Controles'
import { Cita, Falta } from './Piezas'
import { ALERGENO_CON_ARTICULO, alergico } from './textos'

/** El estado de un interruptor sugerido: en Musgo, y blanco cuando el interruptor está marcado (verde). */
const ESTADO = 'text-sm font-normal text-musgo group-aria-pressed:text-primary-foreground/90'

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
  const respondidas = alergiasRespondidas(alta)

  const estado = alta.sinAlergias
    ? 'Confirmaste que no tiene alergias.'
    : confirmadas.length
      ? `Confirmaste: ${confirmadas.map((a) => NOMBRE_ALERGENO[a].toLowerCase()).join(', ')}.`
      : 'Todavía no nos dijiste si tiene alergias.'

  return (
    <fieldset className="flex min-w-0 flex-col gap-4" aria-describedby={`${id}-nota${error ? ` ${id}-error` : ''}`}>
      <legend className="mb-1 flex items-center gap-2.5 font-titulo text-xl font-extrabold text-pino">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brote text-verde-hondo" aria-hidden="true">
          <ShieldCheck className="size-[1.15rem]" strokeWidth={2.25} />
        </span>
        ¿Tiene alergias?
      </legend>
      <p id={`${id}-nota`} className="-mt-1 text-musgo text-pretty">
        Las alergias las confirmás vos: Nibble no guarda ninguna sin que la toques.
        {falta && ' No las mencionaste en el audio.'}
      </p>

      {mencionadas.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="font-bold text-pino text-pretty">
            {mencionadas.length === 1
              ? `¿${nombre} es ${es} ${ALERGENO_CON_ARTICULO[mencionadas[0].valor]}? Tocalo para confirmar.`
              : `Mencionaste estas alergias. Tocá las que tiene ${nombre} para confirmarlas.`}
          </p>
          {mencionadas.map((m, i) => {
            const activa = confirmadas.includes(m.valor)
            return (
              <div key={m.valor} className="flex flex-col gap-2">
                <ChipAlternar
                  ref={i === 0 && primera === 'mencionada' ? refPrimera : undefined}
                  activo={activa} alTocar={() => setAlta(tocarAlergia(alta, m.valor))} variante="sugerida" describe={`${id}-cita-${m.valor}`}
                  className="min-h-16 w-full rounded-2xl pl-3 text-lg"
                >
                  <span className="flex flex-col leading-tight">
                    {NOMBRE_ALERGENO[m.valor]}
                    <span className={ESTADO}>{activa ? 'Confirmada' : 'Sin confirmar'}</span>
                  </span>
                </ChipAlternar>
                <Cita id={`${id}-cita-${m.valor}`} cita={m.cita} />
              </div>
            )
          })}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <p className="font-bold text-pino">{mencionadas.length ? 'Otras alergias' : 'Tocá las que tiene'}</p>
        <div className="flex flex-wrap gap-2">
          {otras.map((a, i) => (
            <ChipAlternar
              key={a} ref={i === 0 && primera === 'otra' ? refPrimera : undefined}
              activo={confirmadas.includes(a)} alTocar={() => setAlta(tocarAlergia(alta, a))}
              className="min-h-14 pr-5"
            >
              {NOMBRE_ALERGENO[a]}
            </ChipAlternar>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 text-sm text-musgo" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />o<span className="h-px flex-1 bg-border" />
      </div>

      <div className="flex flex-col gap-2">
        <ChipAlternar
          activo={alta.sinAlergias} alTocar={() => setAlta(tocarSinAlergias(alta))}
          variante={dijoQueNo && !alta.sinAlergias ? 'sugerida' : undefined} describe={dijoQueNo ? `${id}-cita-no` : undefined}
          className="min-h-16 w-full rounded-2xl pl-3 text-lg"
        >
          <span className="flex flex-col leading-tight">
            No tiene alergias
            {dijoQueNo && !alta.sinAlergias && <span className={ESTADO}>Tocalo para confirmar</span>}
          </span>
        </ChipAlternar>
        {dijoQueNo && <Cita id={`${id}-cita-no`} cita={dijoQueNo.cita} />}
      </div>

      {/* Con el error a la vista (falta contestar), el estado no se repite: el error dice qué hacer. */}
      {error ? <Falta id={`${id}-error`}>{error}</Falta> : (
        <p
          role="status"
          className={cn('flex items-start gap-2 rounded-xl px-3 py-2 text-sm font-bold text-pino', respondidas ? 'bg-brote' : 'bg-zapallo-claro')}
        >
          {respondidas
            ? <CircleCheck className="mt-px size-4 shrink-0 text-verde-hondo" strokeWidth={2.25} aria-hidden="true" />
            : <CircleDashed className="mt-px size-4 shrink-0" strokeWidth={2.25} aria-hidden="true" />}
          {estado}
        </p>
      )}
    </fieldset>
  )
}
