// "¿Tiene alergias?" en "Esto entendí" (§5.2, v5 · 17): las alergias las escucha la IA pero las confirma el padre.
// Una alergia mencionada aparece como sugerencia SIN marcar; recién cuenta cuando el padre la toca. "No tiene
// alergias" también se toca (si lo dijo, aparece sugerido). Sin una de las dos respuestas no se crea el perfil.
// Se ve como interruptores grandes: lo sugerido con el borde Zapallo punteado (falta confirmarlo) y la cita debajo;
// abajo de todo, en qué quedó la respuesta.
// v5.8 · Las que no están en la lista ("kiwi", "colorante rojo"): las mencionadas son sugerencias como las otras (se
// tocan para confirmarlas) y el padre puede sumar las suyas a mano. Abajo, con calma, cuáles revisamos en cada receta
// y cuáles no se pueden revisar ingrediente por ingrediente (no cruzan con ningún alimento: src/lib/alergias.ts).
import { cn } from 'cn'
import { CircleCheck, CircleDashed, ShieldCheck, X } from 'lucide-react'
import { useId, useRef, type Ref } from 'react'
import { ALERGENO, type DatosExtraidos } from '../../../shared/contratos'
import { Button } from '../../componentes/ui/button'
import { useSinCruce } from '../../lib/alergias'
import { NOMBRE_ALERGENO } from '../../lib/vocabulario'
import { agregarAlergiaOtra, alergiasRespondidas, quitarAlergiaOtra, tocarAlergia, tocarAlergiaOtra, tocarSinAlergias, type Alta } from './alta'
import { clave } from './borrador'
import { Agregar, ChipAlternar } from './Controles'
import { Cita, Falta } from './Piezas'
import { ALERGENO_CON_ARTICULO, alergico, textoOtrasAlergias } from './textos'

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
  const refSumar = useRef<HTMLInputElement>(null)
  const mencionadas = extraidos?.alergiasMencionadas ?? []
  const otrasMencionadas = extraidos?.otrasAlergiasMencionadas ?? []
  const dijoQueNo = extraidos?.sinAlergias
  const otras = ALERGENO.filter((a) => !mencionadas.some((m) => m.valor === a))
  const confirmadas = alta.form.alergias
  const confirmadasOtras = alta.form.alergiasOtras
  const esOtraConfirmada = (o: string) => confirmadasOtras.some((c) => clave(c) === clave(o))
  // Las que sumó a mano (las mencionadas ya tienen su interruptor arriba)
  const aMano = confirmadasOtras.filter((o) => !otrasMencionadas.some((m) => clave(m.valor) === clave(o)))
  const sinCruce = useSinCruce(confirmadasOtras)
  const notaOtras = sinCruce ? textoOtrasAlergias(confirmadasOtras, sinCruce) : ''
  const es = alergico(alta.form.sexo)
  const nMencionadas = mencionadas.length + otrasMencionadas.length
  const primera = nMencionadas ? 'mencionada' : 'otra'
  const respondidas = alergiasRespondidas(alta)

  const todas = [...confirmadas.map((a) => NOMBRE_ALERGENO[a].toLowerCase()), ...confirmadasOtras.map((o) => o.toLocaleLowerCase('es'))]
  const estado = alta.sinAlergias
    ? 'Confirmaste que no tiene alergias.'
    : todas.length
      ? `Confirmaste: ${todas.join(', ')}.`
      : 'Todavía no nos dijiste si tiene alergias.'

  const pregunta = nMencionadas === 1 && mencionadas.length === 1
    ? `¿${nombre} es ${es} ${ALERGENO_CON_ARTICULO[mencionadas[0].valor]}? Tocalo para confirmar.`
    : nMencionadas === 1
      ? `Mencionaste esta alergia. Si ${nombre} la tiene, tocala para confirmarla.`
      : `Mencionaste estas alergias. Tocá las que tiene ${nombre} para confirmarlas.`

  // Al quitar una, el foco va al campo para sumar (el botón que lo tenía desaparece)
  const quitar = (o: string) => {
    setAlta(quitarAlergiaOtra(alta, o))
    refSumar.current?.focus()
  }

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

      {nMencionadas > 0 && (
        <div className="flex flex-col gap-3">
          <p className="font-bold text-pino text-pretty">{pregunta}</p>
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
          {otrasMencionadas.map((m, i) => {
            const activa = esOtraConfirmada(m.valor)
            const k = `${id}-cita-otra-${i}`
            return (
              <div key={clave(m.valor)} className="flex flex-col gap-2">
                <ChipAlternar
                  ref={i === 0 && !mencionadas.length ? refPrimera : undefined}
                  activo={activa} alTocar={() => setAlta(tocarAlergiaOtra(alta, m.valor))} variante="sugerida" describe={k}
                  className="min-h-16 w-full rounded-2xl pl-3 text-lg"
                >
                  <span className="flex min-w-0 flex-col leading-tight">
                    <span className="first-letter:uppercase [overflow-wrap:anywhere]">{m.valor}</span>
                    <span className={ESTADO}>{activa ? 'Confirmada' : 'Sin confirmar'}</span>
                  </span>
                </ChipAlternar>
                <Cita id={k} cita={m.cita} />
              </div>
            )
          })}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <p className="font-bold text-pino">{nMencionadas ? 'Otras alergias' : 'Tocá las que tiene'}</p>
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
        {aMano.length > 0 && (
          <ul className="flex flex-wrap gap-2" aria-label="Las que sumaste">
            {aMano.map((o) => (
              <li key={clave(o)} className="flex min-h-14 max-w-full items-center gap-1 rounded-full border border-primary bg-primary py-1 pr-1 pl-4 font-bold text-primary-foreground">
                <span className="min-w-0 first-letter:uppercase [overflow-wrap:anywhere]">{o}</span>
                <Button
                  variant="ghost" size="icon"
                  className="shrink-0 rounded-full text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground"
                  aria-label={`Quitar “${o}”`} onClick={() => quitar(o)}
                >
                  <X aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-1">
          <Agregar
            etiqueta="Sumar otra que no está en la lista" ejemplo="Ej.: kiwi" refInput={refSumar}
            alAgregar={(t) => setAlta(agregarAlergiaOtra(alta, t))}
          />
        </div>
        {notaOtras && (
          <p role="status" className="flex items-start gap-2 px-1 pt-1 text-sm text-musgo text-pretty">
            <ShieldCheck className="mt-px size-4 shrink-0" strokeWidth={2.25} aria-hidden="true" />
            {notaOtras}
          </p>
        )}
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
