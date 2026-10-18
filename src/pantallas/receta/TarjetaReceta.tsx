// La receta de food chaining, para leer con una mano en la cocina: arriba el nombre, "Parte de / Cambia" y la imagen
// (el plato nuevo al lado de su alimento seguro, y una línea que lo dice: la foto no queda sin explicar); después una
// línea de cómo ofrecerlo (sin presión, siempre a la vista), qué aporta, ingredientes y pasos. Lo largo
// (por qué esta, el camino en su historial, cómo servirlo, lo que va adentro) queda detrás de "Ver más".
import type { Receta, Regla } from '../../../shared/contratos'
import { fraccionBarra, porcentajeTope } from '../../lib/cobertura'
import { NOMBRE_CAMBIO, formatoNutriente, textoParaPadres } from '../../lib/vocabulario'
import { ImagenPlato } from './ImagenPlato'
import { aceptacionLegible, alergenoEnFrase, listaLegible, nutrienteEnFrase, su } from './legible'

/** La línea que siempre se ve (§9, tono): ofrecer sin presión. El texto completo de la receta va en "Ver más". */
export const OFRECER_SIN_PRESION = 'Ofrecelo sin pedirle que lo coma.'

/** `para`: "para el almuerzo" cuando la receta es para la próxima comida (v5.1). */
export function TarjetaReceta({ receta, reglas, para = null }: { receta: Receta; reglas: Regla[] | null; para?: string | null }) {
  const { evidencia } = receta
  const n = evidencia.nutriente
  const candidato = evidencia.candidatos.find((c) => c.preparacionId === receta.preparacionBaseId)
  const alergias = evidencia.alergias.map(alergenoEnFrase)

  return (
    <article className="nb-tarjeta rc-tarjeta" aria-labelledby="rc-titulo">
      <header className="rc-cabeza">
        {para && <p className="rc-para">{para[0].toLocaleUpperCase('es') + para.slice(1)}</p>}
        <h1 id="rc-titulo" className="rc-titulo">{receta.nombre}</h1>
        <dl className="rc-cadena">
          <div><dt>Parte de</dt><dd>{receta.desde.nombre}</dd></div>
          <div><dt>Cambia</dt><dd>{NOMBRE_CAMBIO[receta.cambio]}</dd></div>
        </dl>
      </header>

      <div className="rc-servir">
        <ImagenPlato receta={receta} reglas={reglas} />
        <p className="rc-al-lado">Servilo al lado de {su(receta.desde.nombre)}, que ya come.</p>
        <details className="nb-ver-mas rc-mas">
          <summary>Cómo servirlo</summary>
          <p>{receta.presentacion}</p>
        </details>
      </div>

      <section className="rc-ofrecer" aria-labelledby="rc-ofrecer">
        <h2 id="rc-ofrecer" className="nb-oculto">Cómo ofrecerlo</h2>
        <p className="rc-ofrecer-linea">{OFRECER_SIN_PRESION}</p>
        <details className="nb-ver-mas rc-mas">
          <summary>Ver más</summary>
          <p>{receta.comoOfrecer}</p>
        </details>
      </section>

      <section className="rc-seccion rc-aporta" aria-labelledby="rc-aporta">
        <h2 id="rc-aporta" className="nb-oculto">Qué aporta</h2>
        <p className="rc-aporte">
          <span className="rc-aporte-valor nb-numero">{formatoNutriente(n, receta.aporte[n])}</span>{' '}
          de {nutrienteEnFrase(n)} por porción
        </p>
        <div className="rc-barra" aria-hidden="true"><span style={{ width: `${Math.round(fraccionBarra(receta.coberturaDeLoQueFalta) * 100)}%` }} /></div>
        <p className="rc-cubre">
          {receta.coberturaDeLoQueFalta >= 1
            ? <>Cubre todo lo que le falta hoy.</>
            : <>Cubre <strong className="nb-numero">{porcentajeTope(receta.coberturaDeLoQueFalta)}</strong> de lo que le falta hoy.</>}
        </p>
      </section>

      <section className="rc-seccion" aria-labelledby="rc-ingredientes">
        <h2 id="rc-ingredientes">Ingredientes <span className="rc-h2-nota">(una porción)</span></h2>
        <ul className="rc-ingredientes">
          {receta.ingredientes.map((i) => (
            <li key={i.alimentoId}><span>{i.nombre}</span><span className="nb-numero">{i.gramos} g</span></li>
          ))}
        </ul>
      </section>

      <section className="rc-seccion" aria-labelledby="rc-pasos">
        <h2 id="rc-pasos">Pasos</h2>
        <ol className="rc-pasos">
          {receta.pasos.map((p, i) => <li key={i}>{p}</li>)}
        </ol>
      </section>

      <div className="rc-plegables">
        <details className="nb-ver-mas rc-plegable">
          <summary>Por qué esta</summary>
          <p>{receta.porQue}</p>
          {receta.seMantiene.length > 0 && <p><strong>Se mantiene:</strong> {listaLegible(receta.seMantiene)}.</p>}
          {candidato ? (
            <p className="rc-camino">
              {candidato.camino.desde} ({aceptacionLegible(candidato.camino.aceptacion)})
              <span aria-hidden="true"> → </span><span className="nb-oculto"> lleva a </span>
              {candidato.nombre}
            </p>
          ) : receta.plato && (
            // v5.4 · La receta creativa no sale de un candidato del catálogo: el camino es de su alimento seguro al plato
            <p className="rc-camino">
              {receta.desde.nombre}
              <span aria-hidden="true"> → </span><span className="nb-oculto"> lleva a </span>
              {receta.nombre}
            </p>
          )}
          {candidato && candidato.patrones.length > 0 && (
            <ul className="rc-patrones">
              {candidato.patrones.map((p) => <li key={p}>{textoParaPadres(p)}</li>)}
            </ul>
          )}
          <p className="nb-suave">
            Esta semana lleva el <span className="nb-numero">{porcentajeTope(evidencia.coberturaSemana)}</span> de {nutrienteEnFrase(n)} recomendado para su edad.
          </p>
        </details>
        {receta.transparencia && (
          <details className="nb-ver-mas rc-plegable">
            <summary>Lo que va adentro</summary>
            <p>{receta.transparencia}</p>
          </details>
        )}
      </div>

      {receta.validacion.ok ? (
        <p className="rc-validada">
          <span aria-hidden="true">✓ </span>
          Revisada{alergias.length > 0 ? `: sin ${alergias.join(' ni ')}` : ' por código'}.
        </p>
      ) : (
        <div className="rc-problemas" role="note">
          <p>Antes de prepararla, tené en cuenta:</p>
          <ul>{receta.validacion.problemas.map((p) => <li key={p}>{p}</li>)}</ul>
        </div>
      )}
    </article>
  )
}
