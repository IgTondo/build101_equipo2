// La tarjeta grande de una comida (PLAN v5.3, §5.3; antes "Próxima comida", v5.1). Arriba, opcional, el selector
// Desayuno · Almuerzo · Merienda · Cena; debajo, "Para la cena" y el plato: lo seguro (1 a 3), un pasito (el alimento
// nuevo, en porción chica), una línea de qué cubre y dos acciones (la receta del pasito y cómo servir el plato).
// Si B todavía no manda el plato, la sugerencia sola de la v5.2. La usan el inicio (con selector) y el resultado
// del registro (sin selector: el plato de la comida que sigue). Es una idea: el padre puede servir otra cosa.
import { useId, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { MOMENTO, type Momento } from '../../shared/contratos'
import { modeloTarjeta, type ModeloTarjeta } from '../lib/platoComida'
import type { ProgresoComida } from '../lib/progresoComida'
import type { ComidaPlan } from '../lib/proximaComida'
import { Cargando, ErrorConReintento } from './Estados'
import './proxima-comida.css'

interface Props {
  ninoId: string
  /** "Para la cena" · "Para mañana: desayuno" (la comida elegida). */
  etiqueta: string
  progreso: ProgresoComida
  /** El selector de comida, arriba de todo (solo en el inicio). */
  selector?: ReactNode
}

const esComidaPlan = (m: Momento | null): m is ComidaPlan => m !== null && m !== 'colacion' && (MOMENTO as readonly string[]).includes(m)

export function TarjetaComida({ ninoId, etiqueta, progreso, selector }: Props) {
  const titulo = useId()
  const { datos, momentoDatos, cargando, error, reintentar } = progreso
  const modelo = datos && esComidaPlan(momentoDatos) ? modeloTarjeta(ninoId, datos, momentoDatos) : null

  let cuerpo: ReactNode
  if (error) cuerpo = <ErrorConReintento error={error} reintentar={reintentar} />
  else if (!modelo) cuerpo = <Cargando texto="Buscando una idea…" />
  else cuerpo = <Cuerpo modelo={modelo} />

  // Mientras llega otra comida, lo anterior queda a la vista, atenuado y sin poder tocarse.
  const atenuado = cargando && modelo !== null
  return (
    <section className="pc" aria-labelledby={titulo}>
      {selector}
      <h2 id={titulo} className="pc-cuando">{etiqueta}</h2>
      <div className="pc-cuerpo" aria-busy={cargando} data-atenuado={atenuado} inert={atenuado}>
        {cuerpo}
      </div>
    </section>
  )
}

function Cuerpo({ modelo }: { modelo: ModeloTarjeta }) {
  switch (modelo.tipo) {
    case 'vacio':
    case 'sin_idea':
      return <p className="pc-calma">{modelo.texto}</p>
    case 'sugerencia':
      return (
        <>
          <p className="pc-nombre">{modelo.nombre}</p>
          {modelo.porQue && <p className="pc-porque">{modelo.porQue}</p>}
          {modelo.receta && <Link className="nb-boton pc-boton" to={modelo.receta}>Ver la receta <Flecha /></Link>}
        </>
      )
    case 'plato':
      return <Plato modelo={modelo} />
  }
}

function Plato({ modelo }: { modelo: Extract<ModeloTarjeta, { tipo: 'plato' }> }) {
  const { seguros, pasito, cubre } = modelo
  return (
    <>
      {seguros.length > 0 && (
        <div className="pc-grupo">
          <h3 className="pc-rotulo">Lo seguro</h3>
          <ul className="pc-seguros">
            {seguros.map((s) => <li key={s.id}>{s.nombre}</li>)}
          </ul>
        </div>
      )}
      {pasito && (
        <div className="pc-pasito">
          <div className="pc-pasito-cab">
            <h3 className="pc-rotulo"><span aria-hidden="true">+ </span>Un pasito</h3>
            <span className="pc-insignia">nuevo · porción chica</span>
          </div>
          <p className="pc-pasito-nombre">{pasito.nombre}</p>
        </div>
      )}
      {cubre && <p className="pc-cubre">{cubre}</p>}
      {pasito && (
        <div className="pc-acciones">
          <Link className="nb-boton pc-boton" to={pasito.receta}>Ver la receta del pasito <Flecha /></Link>
          <Link className="pc-servir" to={pasito.servir}><IconoImagen /> Ver cómo servirlo</Link>
        </div>
      )}
    </>
  )
}

function Flecha() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M7.5 4.5L13 10l-5.5 5.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconoImagen() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.6" opacity="0.55" />
    </svg>
  )
}
