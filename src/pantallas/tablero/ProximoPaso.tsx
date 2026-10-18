// Próximo paso (§8 "explotar o explorar"): tres opciones cortas (qué, por qué en una línea); las dos que exploran abren
// la receta, que tiene el porqué completo y la cadena "Parte de / Cambia". La protagonista de la pantalla es el pasito
// (food chaining): grande, en verde, con el mordisco y la única sombra. Las otras dos quedan debajo, calladas.
import { Footprints, Heart, Sprout, type LucideIcon } from 'lucide-react'
import { useId } from 'react'
import { Link } from 'react-router-dom'
import type { Candidato, Nutriente, Sugerencia } from '../../../shared/contratos'
import { IconoAlimento } from '../../componentes/IconoAlimento'
import { Button } from '../../componentes/ui/button'
import { lineaPorQue, sugerenciasDe } from '../../lib/proximaComida'
import { rutaReceta } from './calculos'
import { grupoDe } from './visual'

const TITULO: Record<Sugerencia['tipo'], string> = { segura: 'Va a gustarle', un_paso: 'Un pasito', mas_nutritiva: 'Más nutritiva' }
const ICONO: Record<Sugerencia['tipo'], LucideIcon> = { segura: Heart, un_paso: Footprints, mas_nutritiva: Sprout }

interface Props {
  ninoId: string
  sugerencias?: Sugerencia[]
  proximoPaso?: Candidato
  nutriente?: Nutriente
  recargando: boolean
}

export function ProximoPaso({ ninoId, sugerencias, proximoPaso, nutriente, recargando }: Props) {
  const id = useId()
  const tarjetas = sugerenciasDe({ sugerencias, proximoPaso })
  // La protagonista es el pasito; si no vino, la primera que abre una receta; si tampoco, la primera.
  const principal = tarjetas.find((s) => s.tipo === 'un_paso') ?? tarjetas.find((s) => s.tipo !== 'segura') ?? tarjetas[0]
  const resto = tarjetas.filter((s) => s !== principal)
  const ruta = (s: Sugerencia) => rutaReceta(ninoId, s.candidato?.preparacionId ?? s.preparacionId, nutriente)

  return (
    <section className="flex flex-col gap-3.5" aria-labelledby={`${id}-t`} aria-busy={recargando}>
      <h2 id={`${id}-t`} className="text-xl">Próximo paso</h2>

      {!principal ? (
        <p className="rounded-2xl bg-muted px-4 py-3.5 text-musgo text-pretty">Todavía sin ideas: registrá algunas comidas más.</p>
      ) : (
        <ul className={`flex flex-col gap-3 transition-opacity duration-200 motion-reduce:transition-none ${recargando ? 'opacity-55' : ''}`}>
          <Protagonista s={principal} ruta={ruta(principal)} />
          {resto.map((s) => <Otra key={`${s.tipo}-${s.preparacionId}`} s={s} ruta={ruta(s)} />)}
        </ul>
      )}
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
        {s.porQue && <p className="text-pretty text-white/90">{lineaPorQue(s.porQue)}</p>}
        {s.tipo !== 'segura' && (
          <Button asChild size="lg" className="bg-background text-verde-noche hover:bg-brote">
            <Link to={ruta} aria-label={`Ver la receta: ${s.nombre}`}>Ver la receta</Link>
          </Button>
        )}
      </div>
    </li>
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
        {s.porQue && <p className="text-sm text-musgo text-pretty">{lineaPorQue(s.porQue)}</p>}
        {s.tipo !== 'segura' && (
          <Button asChild variant="secondary" className="mt-2 self-start">
            <Link to={ruta} aria-label={`Ver la receta: ${s.nombre}`}>Ver la receta</Link>
          </Button>
        )}
      </div>
    </li>
  )
}
