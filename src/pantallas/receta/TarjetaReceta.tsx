// La receta de food chaining, para leer con una mano en la cocina: arriba el nombre, "Parte de / Cambia" y la imagen,
// que es la protagonista (a sangre y mordida); después una línea de cómo ofrecerlo (sin presión, siempre a la vista),
// qué aporta, ingredientes y pasos. Lo largo (cómo servirlo, por qué esta con la cadena en su historial, lo que va
// adentro) queda plegado.
import { cn } from 'cn'
import { Check, Info, Leaf, ShieldCheck, Sprout } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import type { Momento, Receta, Regla, Variedad } from '../../../shared/contratos'
import { Anillo } from '../../componentes/Anillo'
import { IconoAlimento } from '../../componentes/IconoAlimento'
import { NumeroAnimado } from '../../componentes/NumeroAnimado'
import { fraccionBarra, porcentajeTope } from '../../lib/cobertura'
import { COLOR_GRUPO, VISUAL_MOMENTO } from '../../lib/colores'
import { NOMBRE_CAMBIO, NOMBRE_GRUPO, formatoNutriente, textoParaPadres } from '../../lib/vocabulario'
import { Cadena } from './Cadena'
import { grupoDePreparacion } from './catalogo'
import { ImagenPlato } from './ImagenPlato'
import { alergenoEnFrase, nutrienteEnFrase, su } from './legible'

/** La línea que siempre se ve (§9, tono): ofrecer sin presión. El texto completo de la receta va en "Ver más". */
export const OFRECER_SIN_PRESION = 'Ofrecelo sin pedirle que lo coma.'

const mayuscula = (s: string) => s[0].toLocaleUpperCase('es') + s.slice(1)
const enteroPorciento = (v: number) => `${Math.round(v)}%`

/** v5.5 · "Suma verduras: hace 6 días que no come." · "Algo nuevo, a un solo cambio de lo que ya come." */
export function textoVariedad(v: Variedad): string {
  if (!v.grupo) return 'Algo nuevo, a un solo cambio de lo que ya come.'
  const grupo = NOMBRE_GRUPO[v.grupo].toLocaleLowerCase('es')
  if (v.diasSinComer === null || v.diasSinComer === undefined) return `Suma ${grupo}: no registramos que coma.`
  return `Suma ${grupo}: hace ${v.diasSinComer} ${v.diasSinComer === 1 ? 'día' : 'días'} que no come.`
}

/** El renglón de un bloque plegado (Por qué esta, Lo que va adentro): se lee como un título y se toca entero. */
const RENGLON = 'flex min-h-14 w-full justify-between rounded-xl font-titulo text-xl font-extrabold text-pino'

function Seccion({ id, titulo, children, className }: { id: string; titulo: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section aria-labelledby={id} className={cn('flex flex-col gap-3', className)}>
      <h2 id={id} className="text-xl">{titulo}</h2>
      {children}
    </section>
  )
}

/** `para`: "para el almuerzo" cuando la receta es para la próxima comida (v5.1); `momento`, esa comida (su ícono y color). */
export function TarjetaReceta({ receta, reglas, para = null, momento }: {
  receta: Receta; reglas: Regla[] | null; para?: string | null; momento?: Momento
}) {
  const { evidencia } = receta
  const n = evidencia.nutriente
  const candidato = evidencia.candidatos.find((c) => c.preparacionId === receta.preparacionBaseId)
  const alergias = evidencia.alergias.map(alergenoEnFrase)
  const cubre = receta.coberturaDeLoQueFalta
  const cubreTodo = cubre >= 1
  // v5.4 · El plato inventado por la receta creativa no está en el catálogo: su grupo viene en receta.plato
  const grupoNuevo = grupoDePreparacion(receta.preparacionBaseId) ?? receta.plato?.atributos.grupo ?? null
  const grupoDesde = grupoDePreparacion(receta.desde.preparacionId)
  const visualMomento = momento ? VISUAL_MOMENTO[momento] : null
  const IconoMomento = visualMomento?.icono
  // La cadena se arma la primera vez que se abre "Por qué esta": es cuando se ve.
  const [cadenaVista, setCadenaVista] = useState(false)

  return (
    <article aria-labelledby="rc-titulo" className="flex flex-col gap-8">
      <div className="flex flex-col gap-5">
        <header className="flex flex-col gap-3">
          {para && (
            <p className={cn('inline-flex h-9 items-center gap-2 self-start rounded-full px-3.5 text-sm font-bold text-pino', visualMomento?.claseClaro ?? 'bg-brote')}>
              {IconoMomento && <IconoMomento className="size-4" strokeWidth={2.25} aria-hidden="true" />}
              {mayuscula(para)}
            </p>
          )}
          <h1 id="rc-titulo" className="text-[1.75rem] leading-[1.12] font-black">{receta.nombre}</h1>
          {/* Dos datos cortos debajo del nombre; el ícono es lo que ya come. */}
          <div className="flex items-center gap-3">
            <IconoAlimento nombre={receta.desde.nombre} grupo={grupoDesde} />
            <dl className="flex min-w-0 flex-col gap-0.5 text-pretty">
              <div>
                <dt className="inline text-musgo after:content-[':']">Parte de</dt>{' '}
                <dd className="inline font-bold">{receta.desde.nombre}</dd>
              </div>
              <div>
                <dt className="inline text-musgo after:content-[':']">Cambia</dt>{' '}
                <dd className="inline font-bold">{NOMBRE_CAMBIO[receta.cambio]}</dd>
              </div>
            </dl>
          </div>
        </header>

        <div className="flex flex-col gap-1">
          {/* La máscara del mordisco recorta la sombra: la sombra va en el padre (rc-sombra, con drop-shadow). */}
          <div className="rc-sombra">
            <div className={cn('mordisco overflow-hidden rounded-3xl [--mordisco:36px]', grupoNuevo ? COLOR_GRUPO[grupoNuevo].claseClaro : 'bg-brote')}>
              <ImagenPlato receta={receta} reglas={reglas} />
            </div>
          </div>
          {/* La imagen muestra el plato nuevo al lado de lo que ya come: se dice siempre, no solo en "Cómo servirlo". */}
          <p className="mt-2 font-bold text-pino text-pretty">Servilo al lado de {su(receta.desde.nombre)}, que ya come.</p>
          <details className="nb-ver-mas">
            <summary className="min-h-12">Cómo servirlo</summary>
            <p className="pb-2 text-pretty">{receta.presentacion}</p>
          </details>
        </div>
      </div>

      <section aria-labelledby="rc-ofrecer" className="flex flex-col rounded-2xl bg-brote px-5 pt-4 pb-1">
        <h2 id="rc-ofrecer" className="sr-only">Cómo ofrecerlo</h2>
        <p className="text-lg font-bold text-pino text-pretty">{OFRECER_SIN_PRESION}</p>
        <details className="nb-ver-mas">
          <summary className="min-h-12">Ver más</summary>
          <p className="pb-4 text-pretty">{receta.comoOfrecer}</p>
        </details>
      </section>

      {/* v5.5 · Si no le falta ningún nutriente, la receta apunta a sumar variedad: se dice eso, sin anillo de nutriente. */}
      {receta.objetivo?.tipo === 'variedad' ? (
        <section aria-labelledby="rc-aporta" className="flex items-center gap-5 rounded-2xl border bg-card p-5">
          <h2 id="rc-aporta" className="sr-only">Qué suma</h2>
          <span aria-hidden="true" className="grid size-[88px] shrink-0 place-items-center rounded-full bg-brote">
            <Sprout className="size-9 text-verde-hondo" strokeWidth={2.25} />
          </span>
          <div className="flex min-w-0 flex-col gap-1.5">
            <p className="font-titulo text-2xl leading-tight font-black text-verde-hondo">Suma variedad</p>
            <p className="text-pretty">{textoVariedad(receta.objetivo)}</p>
            <p className="text-sm text-musgo text-pretty">Esta semana no le falta ningún nutriente clave.</p>
          </div>
        </section>
      ) : (
        <section aria-labelledby="rc-aporta" className="flex items-center gap-5 rounded-2xl border bg-card p-5">
          <h2 id="rc-aporta" className="sr-only">Qué aporta</h2>
          {/* El verde llena lo que le falta hoy (la pista Zapallo) y no pasa del 100%. El número se lee en el texto. */}
          <div aria-hidden="true">
            <Anillo valor={fraccionBarra(cubre)} tamano={88} grosor={10} pista="var(--nb-zapallo-claro)" retraso={0.2}>
              {cubreTodo
                ? <Check className="size-8 text-verde-hondo" strokeWidth={3} />
                : <NumeroAnimado valor={fraccionBarra(cubre) * 100} formato={enteroPorciento} className="font-titulo text-xl font-black text-pino" />}
            </Anillo>
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <p className="flex flex-col">
              <NumeroAnimado
                valor={receta.aporte[n]}
                formato={(v) => formatoNutriente(n, v)}
                className="font-titulo text-[2.25rem] leading-none font-black text-verde-hondo"
              />
              <span className="mt-1.5 text-pretty">de {nutrienteEnFrase(n)} por porción</span>
            </p>
            <p className="text-sm text-musgo text-pretty">
              {cubreTodo
                ? <>Cubre todo lo que le falta hoy.</>
                : <>Cubre <strong className="text-pino tabular-nums">{porcentajeTope(cubre)}</strong> de lo que le falta hoy.</>}
            </p>
          </div>
        </section>
      )}

      <Seccion id="rc-ingredientes" titulo={<>Ingredientes <span className="font-sans text-sm font-normal text-musgo">(una porción)</span></>}>
        <ul role="list" className="flex flex-col divide-y">
          {receta.ingredientes.map((i) => (
            <li key={i.alimentoId} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
              <IconoAlimento nombre={i.nombre} />
              <span className="flex-1">{i.nombre}</span>
              <span className="text-musgo tabular-nums">{i.gramos} g</span>
            </li>
          ))}
        </ul>
      </Seccion>

      <Seccion id="rc-pasos" titulo="Pasos">
        <ol role="list" className="flex flex-col">
          {receta.pasos.map((p, i) => (
            <li key={i} className="relative flex gap-4 pb-5 last:pb-0">
              {i < receta.pasos.length - 1 && (
                <span aria-hidden="true" className="absolute top-11 bottom-1.5 left-[19px] w-0.5 rounded-full bg-hoja/70" />
              )}
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brote font-titulo text-lg font-black text-verde-noche tabular-nums">
                {i + 1}
              </span>
              <p className="pt-2 text-pretty">{p}</p>
            </li>
          ))}
        </ol>
      </Seccion>

      <div className="flex flex-col divide-y border-y">
        <details className="nb-ver-mas" onToggle={(e) => { if (e.currentTarget.open) setCadenaVista(true) }}>
          <summary className={RENGLON}>Por qué esta</summary>
          <div className="flex flex-col gap-5 pt-1 pb-6">
            <p className="text-pretty">{receta.porQue}</p>
            {/* La cadena en su historial: lo que ya come (y cuántas veces lo aceptó) → el paso nuevo, y lo que se mantiene. */}
            {cadenaVista && (
              <Cadena
                desde={{ nombre: receta.desde.nombre, grupo: grupoDesde }}
                hacia={{ nombre: candidato?.nombre ?? receta.nombre, grupo: grupoNuevo }}
                cambio={receta.cambio}
                seMantiene={receta.seMantiene}
                aceptacion={candidato?.camino.aceptacion}
              />
            )}
            {candidato && candidato.patrones.length > 0 && (
              <ul role="list" className="flex flex-col gap-2">
                {candidato.patrones.map((p) => (
                  <li key={p} className="flex items-start gap-2.5 text-musgo">
                    <Leaf className="mt-1 size-4 shrink-0 text-verde" strokeWidth={2.25} aria-hidden="true" />
                    {textoParaPadres(p)}
                  </li>
                ))}
              </ul>
            )}
            <p className="text-sm text-musgo text-pretty">
              Esta semana lleva el <span className="tabular-nums">{porcentajeTope(evidencia.coberturaSemana)}</span> de {nutrienteEnFrase(n)} recomendado
              para su edad.
            </p>
          </div>
        </details>
        {receta.transparencia && (
          <details className="nb-ver-mas">
            <summary className={RENGLON}>Lo que va adentro</summary>
            <p className="pt-1 pb-6 text-pretty">{receta.transparencia}</p>
          </details>
        )}
      </div>

      {receta.validacion.ok ? (
        <p className="-mt-3 flex items-start gap-2 text-sm text-musgo">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-verde-hondo" strokeWidth={2.25} aria-hidden="true" />
          <span>Revisada{alergias.length > 0 ? `: sin ${alergias.join(' ni ')}` : ' por código'}.</span>
        </p>
      ) : (
        <div role="note" className="flex flex-col gap-2 rounded-2xl bg-zapallo-claro p-4 text-sm text-pino">
          <p className="flex items-start gap-2">
            <Info className="mt-0.5 size-4 shrink-0" strokeWidth={2.25} aria-hidden="true" />
            Antes de prepararla, tené en cuenta:
          </p>
          <ul className="list-disc pl-10">{receta.validacion.problemas.map((p) => <li key={p}>{p}</li>)}</ul>
        </div>
      )}
    </article>
  )
}
