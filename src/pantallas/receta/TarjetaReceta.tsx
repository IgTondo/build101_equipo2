// La receta de food chaining. La protagonista es el plato: la imagen a sangre, mordida, con el nombre de la receta.
// Debajo, la cadena (de qué parte y qué cambia), qué aporta, por qué esta, cómo se hace, cómo servirla y cómo ofrecerla.
import { cn } from 'cn'
import { Info, Leaf, ShieldCheck } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Momento, Receta, Regla } from '../../../shared/contratos'
import { Anillo } from '../../componentes/Anillo'
import { IconoAlimento } from '../../componentes/IconoAlimento'
import { NumeroAnimado } from '../../componentes/NumeroAnimado'
import { COLOR_GRUPO, VISUAL_MOMENTO } from '../../lib/colores'
import { formatoNutriente, porcentaje, textoParaPadres } from '../../lib/vocabulario'
import { Cadena } from './Cadena'
import { grupoDePreparacion } from './catalogo'
import { ImagenPlato } from './ImagenPlato'
import { alergenoEnFrase, nutrienteEnFrase } from './legible'

const mayuscula = (s: string) => s[0].toLocaleUpperCase('es') + s.slice(1)
const enteroPorciento = (v: number) => `${Math.round(v)}%`

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
  const cubre = Math.min(receta.coberturaDeLoQueFalta, 1)
  const alergias = evidencia.alergias.map(alergenoEnFrase)
  const grupoNuevo = grupoDePreparacion(receta.preparacionBaseId)
  const grupoDesde = grupoDePreparacion(receta.desde.preparacionId)
  const visualMomento = momento ? VISUAL_MOMENTO[momento] : null
  const IconoMomento = visualMomento?.icono

  return (
    <article aria-labelledby="rc-titulo" className="flex flex-col gap-9">
      <header className="flex flex-col gap-3">
        {para && (
          <p className={cn('inline-flex h-9 items-center gap-2 self-start rounded-full px-3.5 text-sm font-bold text-pino', visualMomento?.claseClaro ?? 'bg-brote')}>
            {IconoMomento && <IconoMomento className="size-4" strokeWidth={2.25} aria-hidden="true" />}
            {mayuscula(para)}
          </p>
        )}
        {/* La máscara del mordisco recorta la sombra: la sombra va en el padre (rc-sombra, con drop-shadow). */}
        <div className="rc-sombra">
          <div className={cn('mordisco overflow-hidden rounded-3xl [--mordisco:36px]', grupoNuevo ? COLOR_GRUPO[grupoNuevo].claseClaro : 'bg-brote')}>
            <ImagenPlato receta={receta} reglas={reglas} />
            <h1 id="rc-titulo" className="px-5 pt-4 pb-6 text-[1.75rem] leading-[1.12] font-black">{receta.nombre}</h1>
          </div>
        </div>
      </header>

      <Cadena
        desde={{ nombre: receta.desde.nombre, grupo: grupoDesde }}
        hacia={{ nombre: candidato?.nombre ?? receta.nombre, grupo: grupoNuevo }}
        cambio={receta.cambio}
        seMantiene={receta.seMantiene}
        aceptacion={candidato?.camino.aceptacion}
      />

      <section aria-labelledby="rc-aporta" className="flex flex-col gap-4 rounded-2xl border bg-card p-5">
        <h2 id="rc-aporta" className="text-xl">Qué aporta</h2>
        <div className="flex items-center gap-5">
          {/* El verde llena lo que le falta hoy (la pista Zapallo). El número se lee en el texto de abajo. */}
          <div aria-hidden="true">
            <Anillo valor={cubre} tamano={96} grosor={10} pista="var(--nb-zapallo-claro)" retraso={0.2}>
              <NumeroAnimado
                valor={receta.coberturaDeLoQueFalta * 100}
                formato={enteroPorciento}
                className="font-titulo text-xl font-black text-pino"
              />
            </Anillo>
          </div>
          <p className="flex flex-col">
            <NumeroAnimado
              valor={receta.aporte[n]}
              formato={(v) => formatoNutriente(n, v)}
              className="font-titulo text-[2.25rem] leading-none font-black text-verde-hondo"
            />
            <span className="mt-1.5">de {nutrienteEnFrase(n)} por porción</span>
          </p>
        </div>
        <p className="text-sm text-musgo text-pretty">
          Cubre <strong className="text-pino tabular-nums">{porcentaje(receta.coberturaDeLoQueFalta)}</strong> de lo que le falta hoy
          de {nutrienteEnFrase(n)}. Esta semana va por el <span className="tabular-nums">{porcentaje(evidencia.coberturaSemana)}</span> de
          la referencia para su edad.
        </p>
      </section>

      <Seccion id="rc-porque" titulo="Por qué esta">
        <p className="text-pretty">{receta.porQue}</p>
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
      </Seccion>

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

      <Seccion id="rc-servir" titulo="Cómo servirlo">
        <p className="text-pretty">{receta.presentacion}</p>
      </Seccion>

      <section aria-labelledby="rc-ofrecer" className="flex flex-col gap-3 rounded-2xl bg-brote p-5">
        <h2 id="rc-ofrecer" className="text-xl">Cómo ofrecerlo</h2>
        <p className="text-lg text-pretty">{receta.comoOfrecer}</p>
      </section>

      {receta.transparencia && (
        <Seccion id="rc-transparencia" titulo="Lo que va adentro">
          <p className="text-pretty">{receta.transparencia}</p>
        </Seccion>
      )}

      {receta.validacion.ok ? (
        <p className="-mt-3 flex items-start gap-2 text-sm text-musgo">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-verde-hondo" strokeWidth={2.25} aria-hidden="true" />
          <span>Validada por código: alergias{alergias.length > 0 && ` (sin ${alergias.join(' ni ')})`}, un solo cambio y lenguaje.</span>
        </p>
      ) : (
        <div className="flex flex-col gap-2 rounded-2xl bg-zapallo-claro p-4 text-sm text-pino">
          <p className="flex items-start gap-2">
            <Info className="mt-0.5 size-4 shrink-0" strokeWidth={2.25} aria-hidden="true" />
            La revisión automática encontró esto; tenelo en cuenta antes de prepararla:
          </p>
          <ul className="list-disc pl-10">{receta.validacion.problemas.map((p) => <li key={p}>{p}</li>)}</ul>
        </div>
      )}
    </article>
  )
}
