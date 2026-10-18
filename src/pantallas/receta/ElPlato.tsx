// v5.7 · La receta creativa es una comida completa (Receta.platoCompleto): lo nuevo (la receta) y lo que ya come que la
// completa, que la familia ya sabe hacer. Dos piezas para la tarjeta de la receta: "El plato" (sus partes, lo nuevo
// primero) y "Qué aporta el plato" (las kcal y lo que cubre del día). Las recetas del catálogo no las usan.
import { cn } from 'cn'
import type { Nutriente, PlatoCompleto } from '../../../shared/contratos'
import { BarraEstado } from '../../componentes/EstadoNutriente'
import { IconoAlimento } from '../../componentes/IconoAlimento'
import { NumeroAnimado } from '../../componentes/NumeroAnimado'
import { fraccionBarra } from '../../lib/cobertura'
import { NOMBRE_NUTRIENTE } from '../../lib/vocabulario'
import { NOMBRE_ROL, nutrientesDelPlato, porcentajeDelDia } from './plato'

/** Las partes del plato, lo nuevo primero (con su marca); las demás, lo que ya come. */
export function ElPlato({ plato }: { plato: PlatoCompleto }) {
  const componentes = [...plato.componentes].sort((a, b) => Number(b.nuevo) - Number(a.nuevo))
  return (
    <section aria-labelledby="rc-plato" className="mt-3 flex flex-col gap-2">
      <h2 id="rc-plato" className="text-xl">El plato</h2>
      <ul role="list" className="flex flex-col gap-1">
        {componentes.map((c) => (
          <li
            key={`${c.rol}-${c.preparacionId}`}
            className={cn('flex items-center gap-3 rounded-2xl px-3 py-2.5', c.nuevo && 'bg-brote')}
          >
            <IconoAlimento nombre={c.nombre} grupo={c.grupo} />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="font-bold text-pretty">{c.nombre}</span>
              {c.nuevo ? (
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-musgo">
                  {NOMBRE_ROL[c.rol]}
                  <span className="inline-flex h-6 items-center rounded-full bg-verde-hondo px-2.5 text-xs font-bold text-white">
                    Lo nuevo
                  </span>
                </span>
              ) : (
                <span className="text-sm text-musgo">{NOMBRE_ROL[c.rol]} · ya lo come</span>
              )}
            </span>
            <span className="text-musgo tabular-nums whitespace-nowrap">{c.gramos} {c.rol === 'bebida' ? 'ml' : 'g'}</span>
          </li>
        ))}
      </ul>
      <p className="px-3 text-sm text-musgo text-pretty">La receta es para lo nuevo. Lo demás, hacelo como siempre.</p>
    </section>
  )
}

/**
 * El plato entero: las kcal y lo que cubre del día de 3 o 4 nutrientes, primero el de la receta. La barra se corta en
 * el 100% y el número es el real. `falta`: el nutriente de la receta es uno que le falta (no el modo variedad).
 */
export function AportaElPlato({ plato, nutriente, falta }: { plato: PlatoCompleto; nutriente: Nutriente; falta: boolean }) {
  const lista = nutrientesDelPlato(plato.cubreDelDia, nutriente)
  const energiaDelDia = plato.cubreDelDia.energia_kcal
  return (
    <section aria-labelledby="rc-aporta-plato" className="flex flex-col gap-4 rounded-2xl border bg-card p-5">
      <div className="flex flex-col gap-2">
        <h2 id="rc-aporta-plato" className="text-xl">Qué aporta el plato</h2>
        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <NumeroAnimado
            valor={plato.aporte.energia_kcal}
            className="font-titulo text-[2.25rem] leading-none font-black text-verde-hondo"
          />
          <span className="font-bold">kcal</span>
          {energiaDelDia !== undefined && energiaDelDia > 0 && (
            <span className="text-sm text-musgo tabular-nums"><span aria-hidden="true">· </span>{porcentajeDelDia(energiaDelDia)}</span>
          )}
        </p>
      </div>
      <ul role="list" className="flex flex-col gap-3.5">
        {lista.map((n) => {
          const destacado = n === nutriente
          const cubre = plato.cubreDelDia[n] ?? 0
          return (
            <li key={n} className="flex flex-col gap-1.5">
              <span className="flex items-baseline justify-between gap-3">
                <span className="font-bold">{NOMBRE_NUTRIENTE[n]}</span>
                <span className={cn('whitespace-nowrap tabular-nums', destacado ? 'font-bold text-pino' : 'text-musgo')}>
                  {porcentajeDelDia(cubre)}
                </span>
              </span>
              {destacado && falta && (
                <span className="inline-flex h-6 items-center self-start rounded-full bg-zapallo-claro px-2.5 text-xs font-bold text-pino">
                  Le falta esta semana
                </span>
              )}
              <BarraEstado estado="cubierto" fraccion={fraccionBarra(cubre)} gruesa={destacado} />
            </li>
          )
        })}
      </ul>
      <p className="text-sm text-musgo text-pretty">De lo que necesita en todo el día, para su edad.</p>
    </section>
  )
}
