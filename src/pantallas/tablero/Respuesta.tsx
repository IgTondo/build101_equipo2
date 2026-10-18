// La respuesta de un vistazo, debajo de la frase de la semana: el "plato" de los 8 nutrientes (una porción por
// nutriente, llena según lo que cubrió: verde lo cubierto, Zapallo lo que falta) con cuántos cubrió, y lo que más le
// falta. El anillo es decorativo: los números y la lista de nutrientes de abajo dicen lo mismo en texto.
import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'
import type { Nutriente, Progreso } from '../../../shared/contratos'
import { NumeroAnimado } from '../../componentes/NumeroAnimado'
import { NOMBRE_NUTRIENTE } from '../../lib/vocabulario'
import { ordenarNutrientes } from './calculos'
import { EASE_DATOS } from './visual'

export function Respuesta({ semana }: { semana: Progreso['semana'] }) {
  const orden = ordenarNutrientes(semana.faltan)
  const cubiertos = orden.filter((n) => !semana.faltan.includes(n)).length
  const masFalta: Nutriente | undefined = semana.faltan[0]
  const coberturaFalta = masFalta ? semana.cobertura[masFalta] ?? 0 : 0

  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-stretch gap-3.5">
      <div className="flex flex-col items-center gap-1.5">
        <Plato semana={semana} orden={orden}>
          <NumeroAnimado valor={cubiertos} className="font-titulo text-5xl leading-none font-black text-pino" duracion={0.9} />
          <span className="text-sm font-bold text-musgo">de {orden.length}</span>
        </Plato>
        <span className="text-sm text-musgo">nutrientes cubiertos</span>
      </div>

      {masFalta ? (
        <div className="flex flex-col justify-between gap-3 rounded-2xl bg-zapallo-claro p-4">
          <p className="text-sm leading-snug font-bold text-pino">Lo que más le falta</p>
          <div className="flex flex-col gap-1">
            <p className="font-titulo text-2xl leading-tight font-extrabold text-pino">{NOMBRE_NUTRIENTE[masFalta]}</p>
            <p className="flex flex-wrap items-baseline gap-x-1.5">
              <NumeroAnimado
                valor={Math.round(coberturaFalta * 100)}
                formato={(x) => `${Math.round(x)}%`}
                className="font-titulo text-3xl leading-none font-black text-pino"
              />
              <span className="text-xs text-pino">de lo recomendado</span>
            </p>
            <span className="mt-1.5 block h-2 overflow-hidden rounded-full bg-background" aria-hidden="true">
              <motion.span
                className="block h-full rounded-full bg-zapallo"
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(coberturaFalta, 1) * 100}%` }}
                transition={{ duration: 0.9, delay: 0.5, ease: EASE_DATOS }}
              />
            </span>
          </div>
        </div>
      ) : <span />}
    </div>
  )
}

// Geometría del plato: 8 porciones con las puntas redondeadas y un hueco entre cada una.
const LADO = 136
const GROSOR = 16
const RADIO = (LADO - GROSOR) / 2
const HUECO = 4 // grados entre porciones
const PUNTA = ((GROSOR / 2) / RADIO) * (180 / Math.PI) // lo que agrega la punta redonda, en grados

function punto(grados: number): [number, number] {
  const a = (grados * Math.PI) / 180
  return [LADO / 2 + RADIO * Math.sin(a), LADO / 2 - RADIO * Math.cos(a)]
}

function arco(desde: number, hasta: number): string {
  const [x0, y0] = punto(desde)
  const [x1, y1] = punto(Math.max(hasta, desde + 0.1))
  return `M${x0.toFixed(2)},${y0.toFixed(2)} A${RADIO},${RADIO} 0 ${hasta - desde > 180 ? 1 : 0} 1 ${x1.toFixed(2)},${y1.toFixed(2)}`
}

function Plato({ semana, orden, children }: { semana: Progreso['semana']; orden: Nutriente[]; children: ReactNode }) {
  const reducir = useReducedMotion()
  // De lo más cubierto a lo que más falta, en el sentido del reloj desde arriba: el plato se "vacía" de a poco.
  const porciones = [...orden].sort((a, b) => (semana.cobertura[b] ?? 0) - (semana.cobertura[a] ?? 0))
  const paso = 360 / porciones.length
  const largo = paso - HUECO - 2 * PUNTA

  return (
    <span className="relative grid shrink-0 place-items-center" style={{ width: LADO, height: LADO }}>
      <svg width={LADO} height={LADO} viewBox={`0 0 ${LADO} ${LADO}`} className="absolute inset-0" aria-hidden="true">
        {porciones.map((n, i) => {
          const inicio = i * paso + HUECO / 2 + PUNTA
          const lleno = Math.max(0, Math.min(1, semana.cobertura[n] ?? 0))
          const falta = semana.faltan.includes(n)
          return (
            <g key={n} strokeWidth={GROSOR} strokeLinecap="round" fill="none">
              <path d={arco(inicio, inicio + largo)} stroke={falta ? 'var(--nb-zapallo-claro)' : 'var(--nb-brote)'} />
              {lleno > 0 && (
                <motion.path
                  d={arco(inicio, inicio + largo * lleno)}
                  stroke={falta ? 'var(--nb-zapallo)' : 'var(--nb-verde)'}
                  initial={reducir ? false : { pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 0.55, delay: 0.15 + i * 0.07, ease: EASE_DATOS }}
                />
              )}
            </g>
          )
        })}
      </svg>
      <span className="relative flex flex-col items-center text-center">{children}</span>
    </span>
  )
}
