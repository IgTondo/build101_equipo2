// La receta de food chaining: de qué parte, qué cambia, por qué, qué aporta, cómo se hace, cómo servirla y cómo ofrecerla.
import type { Receta, Regla } from '../../../shared/contratos'
import { NOMBRE_CAMBIO, formatoNutriente, porcentaje, textoParaPadres } from '../../lib/vocabulario'
import { ImagenPlato } from './ImagenPlato'
import { aceptacionLegible, alergenoEnFrase, listaLegible, nutrienteEnFrase } from './legible'

export function TarjetaReceta({ receta, reglas }: { receta: Receta; reglas: Regla[] | null }) {
  const { evidencia } = receta
  const n = evidencia.nutriente
  const candidato = evidencia.candidatos.find((c) => c.preparacionId === receta.preparacionBaseId)
  const cubre = Math.min(receta.coberturaDeLoQueFalta, 1)
  const alergias = evidencia.alergias.map(alergenoEnFrase)

  return (
    <article className="nb-tarjeta rc-tarjeta" aria-labelledby="rc-titulo">
      <dl className="rc-cadena">
        <div><dt>Parte de</dt><dd>{receta.desde.nombre}</dd></div>
        <div><dt>Cambia</dt><dd>{NOMBRE_CAMBIO[receta.cambio]}</dd></div>
        {receta.seMantiene.length > 0 && <div><dt>Se mantiene</dt><dd>{listaLegible(receta.seMantiene)}</dd></div>}
      </dl>

      <h1 id="rc-titulo" className="rc-titulo">{receta.nombre}</h1>

      <section className="rc-seccion" aria-labelledby="rc-porque">
        <h2 id="rc-porque">Por qué esta</h2>
        <p>{receta.porQue}</p>
        {candidato && (
          <p className="rc-camino">
            <span className="rc-camino-rotulo">En su grafo:</span>{' '}
            {candidato.camino.desde} ({aceptacionLegible(candidato.camino.aceptacion)})
            <span aria-hidden="true"> → </span><span className="rc-oculto"> lleva a </span>
            {candidato.nombre}
            {candidato.camino.atributos.length > 0 && <>. Comparten: {listaLegible(candidato.camino.atributos)}.</>}
          </p>
        )}
        {candidato && candidato.patrones.length > 0 && (
          <ul className="rc-patrones">
            {candidato.patrones.map((p) => <li key={p}>{textoParaPadres(p)}</li>)}
          </ul>
        )}
      </section>

      <section className="rc-seccion" aria-labelledby="rc-aporta">
        <h2 id="rc-aporta">Qué aporta</h2>
        <p className="rc-aporte">
          <span className="rc-aporte-valor nb-numero">{formatoNutriente(n, receta.aporte[n])}</span>{' '}
          de {nutrienteEnFrase(n)} por porción
        </p>
        <div className="rc-barra" aria-hidden="true"><span style={{ width: `${Math.round(cubre * 100)}%` }} /></div>
        <p className="nb-suave">
          Cubre <strong className="nb-numero">{porcentaje(receta.coberturaDeLoQueFalta)}</strong> de lo que le falta hoy de {nutrienteEnFrase(n)}.
          {' '}Esta semana va por el <span className="nb-numero">{porcentaje(evidencia.coberturaSemana)}</span> de la referencia para su edad.
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

      <section className="rc-seccion" aria-labelledby="rc-servir">
        <h2 id="rc-servir">Cómo servirlo</h2>
        <p>{receta.presentacion}</p>
        <ImagenPlato receta={receta} reglas={reglas} />
      </section>

      <section className="rc-seccion rc-ofrecer" aria-labelledby="rc-ofrecer">
        <h2 id="rc-ofrecer">Cómo ofrecerlo</h2>
        <p>{receta.comoOfrecer}</p>
      </section>

      {receta.transparencia && (
        <section className="rc-seccion" aria-labelledby="rc-transparencia">
          <h2 id="rc-transparencia">Lo que va adentro</h2>
          <p>{receta.transparencia}</p>
        </section>
      )}

      {receta.validacion.ok ? (
        <p className="rc-validada">
          <span aria-hidden="true">✓ </span>
          Validada por código: alergias{alergias.length > 0 && ` (sin ${alergias.join(' ni ')})`}, un solo cambio y lenguaje.
        </p>
      ) : (
        <div className="rc-problemas">
          <p>La revisión automática encontró esto; tenelo en cuenta antes de prepararla:</p>
          <ul>{receta.validacion.problemas.map((p) => <li key={p}>{p}</li>)}</ul>
        </div>
      )}
    </article>
  )
}
