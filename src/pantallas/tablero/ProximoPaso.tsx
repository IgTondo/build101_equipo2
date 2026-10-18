// Próximo paso (§8 "explotar o explorar"): la protagonista de la pantalla. El pasito (food chaining) va grande, en
// verde, con el mordisco y la única sombra, y muestra la cadena: de qué parte, qué cambia y qué se mantiene. Las otras
// dos opciones quedan debajo, calladas. Las que exploran abren la receta.
import { Footprints, Heart, Repeat2, Sprout, type LucideIcon } from 'lucide-react'
import { useId } from 'react'
import { Link } from 'react-router-dom'
import type { Candidato, Motor, Nutriente, Sugerencia } from '../../../shared/contratos'
import { IconoAlimento } from '../../componentes/IconoAlimento'
import { Button } from '../../componentes/ui/button'
import { sugerenciasDe } from '../../lib/proximaComida'
import { NOMBRE_CAMBIO } from '../../lib/vocabulario'
import { rutaReceta, valorAtributo } from './calculos'
import { SwitchMotor } from './SwitchMotor'
import { grupoDe } from './visual'

const TITULO: Record<Sugerencia['tipo'], string> = { segura: 'Va a gustarle', un_paso: 'Un pasito', mas_nutritiva: 'Más nutritiva' }
const ICONO: Record<Sugerencia['tipo'], LucideIcon> = { segura: Heart, un_paso: Footprints, mas_nutritiva: Sprout }

interface Props {
  ninoId: string
  sugerencias?: Sugerencia[]
  proximoPaso?: Candidato
  nutriente?: Nutriente
  motor: Motor
  onMotor: (m: Motor) => void
  recargando: boolean
}

export function ProximoPaso({ ninoId, sugerencias, proximoPaso, nutriente, motor, onMotor, recargando }: Props) {
  const id = useId()
  const tarjetas = sugerenciasDe({ sugerencias, proximoPaso })
  // La protagonista es el pasito; si no vino, la primera que abre una receta; si tampoco, la primera.
  const principal = tarjetas.find((s) => s.tipo === 'un_paso') ?? tarjetas.find((s) => s.tipo !== 'segura') ?? tarjetas[0]
  const resto = tarjetas.filter((s) => s !== principal)
  const ruta = (s: Sugerencia) => rutaReceta(ninoId, s.candidato?.preparacionId ?? s.preparacionId, nutriente, motor)

  return (
    <section className="flex flex-col gap-3.5" aria-labelledby={`${id}-t`} aria-busy={recargando}>
      <h2 id={`${id}-t`} className="text-xl">Próximo paso</h2>

      {!principal ? (
        <p className="rounded-2xl bg-muted px-4 py-3.5 text-musgo text-pretty">
          Todavía no tenemos una sugerencia. Con algunas comidas más registradas, vamos a poder proponerte una.
        </p>
      ) : (
        <ul className={`flex flex-col gap-3 transition-opacity duration-200 motion-reduce:transition-none ${recargando ? 'opacity-55' : ''}`}>
          <Protagonista s={principal} ruta={ruta(principal)} />
          {resto.map((s) => <Otra key={`${s.tipo}-${s.preparacionId}`} s={s} ruta={ruta(s)} />)}
        </ul>
      )}

      <SwitchMotor motor={motor} onCambio={onMotor} />
    </section>
  )
}

function Protagonista({ s, ruta }: { s: Sugerencia; ruta: string }) {
  const Icono = ICONO[s.tipo]
  return (
    // La sombra va en el padre (drop-shadow): la máscara del mordisco recorta las sombras del propio elemento.
    <li className="drop-shadow-[0_14px_22px_rgb(35_97_64/0.30)]">
      <div className="mordisco flex flex-col gap-4 rounded-3xl bg-primary p-5 pt-6 text-primary-foreground">
        <p className="flex items-center gap-2 text-sm font-bold text-white/85">
          <Icono className="size-4.5" strokeWidth={2.25} aria-hidden="true" />
          {TITULO[s.tipo]}
        </p>
        <div className="flex items-center gap-3.5">
          <IconoAlimento nombre={s.nombre} grupo={s.grupo ?? grupoDe(s.preparacionId, s.nombre)} tamano="lg" className="ring-4 ring-white/15" />
          <h3 className="text-2xl leading-tight text-primary-foreground">{s.nombre}</h3>
        </div>
        <p className="text-pretty text-white/90">{s.porQue}</p>
        {s.tipo === 'un_paso' && s.candidato && <Cadena candidato={s.candidato} />}
        {s.tipo !== 'segura' && (
          <Button asChild size="lg" className="bg-background text-verde-noche hover:bg-brote">
            <Link to={ruta} aria-label={`Ver la receta: ${s.nombre}`}>Ver la receta</Link>
          </Button>
        )}
      </div>
    </li>
  )
}

/** La cadena del pasito, de arriba hacia abajo: lo que ya come → lo único que cambia → lo que se mantiene. */
function Cadena({ candidato: c }: { candidato: Candidato }) {
  return (
    <dl className="flex flex-col rounded-2xl bg-white/10 p-3.5">
      <div className="flex items-center gap-3">
        <IconoAlimento nombre={c.camino.desde} grupo={grupoDe(c.desdeId, c.camino.desde)} tamano="md" />
        <div className="min-w-0 leading-snug">
          <dt className="text-sm text-white/80">Parte de</dt>
          <dd className="font-bold text-pretty">{c.camino.desde}</dd>
        </div>
      </div>
      <span className="ml-[21px] h-3 w-0.5 rounded-full bg-white/35" aria-hidden="true" />
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white/15" aria-hidden="true">
          <Repeat2 className="size-5" strokeWidth={2.25} />
        </span>
        <div className="min-w-0 leading-snug">
          <dt className="text-sm text-white/80">Cambia</dt>
          <dd className="font-bold">{NOMBRE_CAMBIO[c.cambio]}</dd>
        </div>
      </div>
      {c.seMantiene.length > 0 && (
        <div className="mt-3.5 border-t border-white/15 pt-3">
          <dt className="text-sm text-white/80">Se mantiene</dt>
          <dd className="mt-1.5 flex flex-wrap gap-1.5">
            {c.seMantiene.map((par, i) => (
              <span key={par} className="rounded-full bg-white/15 px-2.5 py-1 text-sm font-bold">
                {valorAtributo(par)}
                {i < c.seMantiene.length - 1 && <span className="sr-only">,</span>}
              </span>
            ))}
          </dd>
        </div>
      )}
    </dl>
  )
}

function Otra({ s, ruta }: { s: Sugerencia; ruta: string }) {
  const Icono = ICONO[s.tipo]
  return (
    <li className="flex gap-3.5 rounded-2xl border bg-card p-4">
      <IconoAlimento nombre={s.nombre} grupo={s.grupo ?? grupoDe(s.preparacionId, s.nombre)} tamano="md" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="flex items-center gap-1.5 text-sm font-bold text-musgo">
          <Icono className="size-4" strokeWidth={2.25} aria-hidden="true" />
          {TITULO[s.tipo]}
        </p>
        <h3 className="text-lg leading-snug">{s.nombre}</h3>
        <p className="text-sm text-musgo text-pretty">{s.porQue}</p>
        {s.tipo !== 'segura' && (
          <Button asChild variant="secondary" className="mt-2 self-start">
            <Link to={ruta} aria-label={`Ver la receta: ${s.nombre}`}>Ver la receta</Link>
          </Button>
        )}
      </div>
    </li>
  )
}
