// Las últimas comidas registradas, como una línea de tiempo por día: cada comida con el ícono y el color de su momento
// y, si hay, la miniatura de la foto. Lo que aprendimos del chico se muestra, simple, en el Perfil ("Lo que sabemos de…").
import { useId } from 'react'
import type { CoberturaDia } from '../../../shared/contratos'
import { IconoAlimento } from '../../componentes/IconoAlimento'
import { VISUAL_MOMENTO } from '../../lib/colores'
import { diaUruguay } from '../../lib/nino'
import { ESCALON, NOMBRE_MOMENTO } from '../../lib/vocabulario'
import { etiquetaDia, mayuscula, srcMiniatura, ultimasComidas, type ComidaConDia } from './calculos'
import { grupoDe } from './visual'

export function UltimasComidas({ dias }: { dias: CoberturaDia[] }) {
  const id = useId()
  const comidas = ultimasComidas(dias, 5)
  const hoy = diaUruguay()
  if (!comidas.length) return null
  // Las comidas ya vienen de la más nueva a la más vieja: se juntan por día sin reordenar.
  const porDia: [string, ComidaConDia[]][] = []
  for (const c of comidas) {
    const ultimo = porDia.at(-1)
    if (ultimo && ultimo[0] === c.dia) ultimo[1].push(c)
    else porDia.push([c.dia, [c]])
  }

  return (
    <section className="flex flex-col gap-3" aria-labelledby={`${id}-t`}>
      <h2 id={`${id}-t`} className="text-xl">Últimas comidas</h2>
      <ol className="flex flex-col gap-1">
        {porDia.map(([dia, delDia], d) => (
          <li key={dia} className="flex flex-col gap-2">
            <p className="text-sm font-bold text-musgo">{mayuscula(etiquetaDia(dia, hoy))}</p>
            <ol className="flex flex-col">
              {delDia.map((c, i) => {
                const v = VISUAL_MOMENTO[c.momento]
                const Icono = v.icono
                const ultima = d === porDia.length - 1 && i === delDia.length - 1
                return (
                  <li key={c.id} className="relative flex gap-3.5 pb-5">
                    {!ultima && <span className="absolute top-11 bottom-1 left-[19px] w-0.5 rounded-full bg-border" aria-hidden="true" />}
                    <span
                      className={`grid size-10 shrink-0 place-items-center rounded-full ${c.momento === 'cena' ? 'text-white' : 'text-pino'}`}
                      style={{ background: v.color }}
                      aria-hidden="true"
                    >
                      <Icono className="size-5" strokeWidth={2.25} />
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-2 pt-2">
                      <p className="leading-tight font-bold">{NOMBRE_MOMENTO[c.momento]}</p>
                      <ul className="flex flex-col gap-1.5">
                        {c.items.map((it, j) => (
                          <li key={`${it.nombre}-${j}`} className="flex items-center gap-2.5 text-sm leading-snug">
                            <IconoAlimento nombre={it.nombre} grupo={grupoDe(null, it.nombre)} tamano="sm" />
                            <span className="min-w-0 text-pretty">
                              {it.nombre}: <span className="text-musgo">{ESCALON[it.cuanto]}</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    {c.thumbBase64 && (
                      <img
                        className="size-16 shrink-0 rounded-xl object-cover outline-1 -outline-offset-1 outline-black/10"
                        src={srcMiniatura(c.thumbBase64)}
                        alt=""
                        width={64}
                        height={64}
                      />
                    )}
                  </li>
                )
              })}
            </ol>
          </li>
        ))}
      </ol>
    </section>
  )
}
