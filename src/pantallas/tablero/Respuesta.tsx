// El plato de la semana, al lado de la respuesta corta: los 8 nutrientes como porciones de un plato, cada una llena
// hasta lo recomendado (no pasa) y del color de su estado (src/lib/cobertura.ts: verde Cubierto, Hoja Casi, Zapallo
// Le falta), con cuántos están cubiertos en el centro. El plato es decorativo: el número y la lista de nutrientes de
// abajo (con la etiqueta de cada estado) dicen lo mismo en texto.
import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'
import type { Nutriente, Progreso } from '../../../shared/contratos'
import { NumeroAnimado } from '../../componentes/NumeroAnimado'
import { contarEstados, estadoCobertura, fraccionBarra, type EstadoCobertura } from '../../lib/cobertura'
import { ordenarNutrientes } from './calculos'
import { EASE_DATOS } from './visual'

export function Respuesta({ semana }: { semana: Progreso['semana'] }) {
  const orden = ordenarNutrientes(semana.faltan)
  const { cubierto } = contarEstados(semana.cobertura, orden)

  return (
    <div className="flex shrink-0 flex-col items-center gap-1">
      <Plato semana={semana} orden={orden}>
        <NumeroAnimado valor={cubierto} className="font-titulo text-4xl leading-none font-black text-pino" duracion={0.9} />
        <span className="text-sm font-bold text-musgo">de {orden.length}</span>
      </Plato>
      <span className="text-sm text-musgo">{cubierto === 1 ? 'cubierto' : 'cubiertos'}</span>
    </div>
  )
}

// Los mismos colores que la barra de cada nutriente (EstadoNutriente): la pista se tiñe solo cuando le falta.
const PISTA: Record<EstadoCobertura, string> = { cubierto: 'var(--nb-brote)', casi: 'var(--nb-brote)', falta: 'var(--nb-zapallo-claro)' }
const RELLENO: Record<EstadoCobertura, string> = { cubierto: 'var(--nb-verde)', casi: 'var(--nb-hoja)', falta: 'var(--nb-zapallo)' }

// Geometría del plato: 8 porciones con las puntas redondeadas y un hueco entre cada una.
const LADO = 120
const GROSOR = 14
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
          const cobertura = semana.cobertura[n] ?? 0
          const lleno = fraccionBarra(cobertura)
          const estado = estadoCobertura(cobertura)
          return (
            <g key={n} strokeWidth={GROSOR} strokeLinecap="round" fill="none">
              <path d={arco(inicio, inicio + largo)} stroke={PISTA[estado]} />
              {lleno > 0 && (
                <motion.path
                  d={arco(inicio, inicio + largo * lleno)}
                  stroke={RELLENO[estado]}
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
