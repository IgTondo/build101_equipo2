// Perfil del chico activo (C6): datos, reglas, lo que aprendimos y sus preparaciones por estado.
// Hacia el padre nunca se dice "rechaza": el estado 'rechaza' se muestra como "Todavía no".
import { Link } from 'react-router-dom'
import type { Perfil as PerfilT } from '../../../shared/contratos'
import { Cargando, ErrorConReintento, Vacio } from '../../componentes/Estados'
import { api } from '../../lib/api'
import { NINO_DEMO, useNino } from '../../lib/nino'
import { useApi } from '../../lib/useApi'
import { NOMBRE_ALERGENO } from '../../lib/vocabulario'
import { agruparPreparaciones, separarPatrones, textoConfianza, textoVeces } from './borrador'
import { RUTA_DEMO_JURADO, RUTA_PERFIL_NUEVO } from './rutas'
import { anios, AVISO_DECLARADA, AVISO_DIETA, NOMBRE_DIETA, NOMBRE_SENAL } from './textos'
import './perfil.css'

export function Perfil() {
  const ninoId = useNino()
  const estado = useApi((s) => api.perfil(ninoId, s), [ninoId])

  if (estado.tipo === 'cargando') return <Cargando texto="Cargando el perfil…" />
  if (estado.tipo === 'error') {
    if (estado.error.codigo === 'no_encontrado') {
      return (
        <Vacio titulo="No encontramos este perfil">
          <p className="nb-suave">Puede que se haya creado en otro celular. Podés crear uno nuevo en un par de minutos.</p>
          <div className="pf-botones">
            <Link className="nb-boton" to={RUTA_PERFIL_NUEVO}>Crear un perfil</Link>
            <Link className="nb-boton nb-boton-secundario" to={`/perfil?nino=${NINO_DEMO}`}>Ver el perfil de ejemplo</Link>
          </div>
        </Vacio>
      )
    }
    return <ErrorConReintento error={estado.error} reintentar={estado.reintentar} />
  }
  return <VistaPerfil perfil={estado.datos} />
}

function VistaPerfil({ perfil }: { perfil: PerfilT }) {
  const { ninoId, datos, reglas } = perfil
  const esDemo = ninoId === NINO_DEMO
  const prep = agruparPreparaciones(perfil.preparaciones)
  const patrones = separarPatrones(perfil.patrones)
  const nino = `?nino=${encodeURIComponent(ninoId)}`

  return (
    <div className="pf">
      <section className="nb-tarjeta pf-seccion" aria-labelledby="pf-t-nombre">
        <h1 id="pf-t-nombre">{datos.nombre}</h1>
        <p className="pf-datos-linea">
          <span className="nb-numero">{anios(datos.edad)}</span>
          {datos.pesoKg !== undefined && <span className="nb-numero">{datos.pesoKg.toLocaleString('es-UY')} kg</span>}
          {datos.tallaCm !== undefined && <span className="nb-numero">{datos.tallaCm} cm</span>}
        </p>
        <dl className="pf-dl">
          <dt>Alergias</dt>
          <dd>
            {datos.alergias.length
              ? <span className="pf-etiquetas">{datos.alergias.map((a) => <span key={a} className="nb-chip">{NOMBRE_ALERGENO[a]}</span>)}</span>
              : 'Sin alergias marcadas'}
          </dd>
          <dt>Dieta</dt>
          <dd>{NOMBRE_DIETA[datos.dieta]}</dd>
          {datos.suplementos && (<><dt>Suplementos</dt><dd>{datos.suplementos} <span className="nb-suave">(solo registro)</span></dd></>)}
        </dl>
        {datos.dieta === 'sin_gluten_caseina' && <p className="pf-aviso-suave">{AVISO_DIETA}</p>}
        {datos.alertas.length > 0 && (
          <div className="pf-aviso-suave">
            <p>Nos contaste: {datos.alertas.map((s) => NOMBRE_SENAL[s].toLowerCase()).join('; ')}.</p>
            <p>{AVISO_DECLARADA}</p>
          </div>
        )}
      </section>

      {esDemo && (
        <section className="pf-banner-demo" aria-labelledby="pf-t-demo">
          <h2 id="pf-t-demo">{datos.nombre} es el perfil de ejemplo</h2>
          <p>Podés mirar todo lo que la app aprendió de él. Para probar con tu hijo o hija, creá su perfil: lleva un par de minutos.</p>
          <div className="pf-botones">
            <Link className="nb-boton" to={RUTA_PERFIL_NUEVO}>Crear su perfil</Link>
            <Link className="nb-boton nb-boton-secundario" to={RUTA_DEMO_JURADO}>Probar con un relato de ejemplo</Link>
          </div>
        </section>
      )}

      <section className="nb-tarjeta pf-seccion" aria-labelledby="pf-t-reglas">
        <h2 id="pf-t-reglas">Sus reglas</h2>
        {reglas.length
          ? <ul className="pf-lista-simple">{reglas.map((r, i) => <li key={i}>{r.texto}</li>)}</ul>
          : <p className="nb-suave">Todavía no hay reglas anotadas.</p>}
      </section>

      <section className="nb-tarjeta pf-seccion" aria-labelledby="pf-t-patrones">
        <h2 id="pf-t-patrones">Lo que aprendimos</h2>
        {patrones.aprendidos.length > 0 ? (
          <ul className="pf-lista-simple">
            {patrones.aprendidos.map((p, i) => (
              <li key={i}>
                {p.texto}
                <span className="pf-meta">{textoConfianza(p.confianza)} · en <span className="nb-numero">{p.apoyo}</span> {p.apoyo === 1 ? 'comida' : 'comidas'}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="nb-suave">Con cada comida que registres vamos a ir encontrando sus patrones.</p>
        )}
        {patrones.investigacion.length > 0 && (
          <>
            <h3>De la investigación</h3>
            <p className="pf-ayuda">Son puntos de partida: se confirman o se descartan con sus propias comidas.</p>
            <ul className="pf-lista-simple">
              {patrones.investigacion.map((p, i) => <li key={i}>{p.texto}</li>)}
            </ul>
          </>
        )}
      </section>

      <section className="nb-tarjeta pf-seccion" aria-labelledby="pf-t-prep">
        <h2 id="pf-t-prep">Sus comidas</h2>
        {perfil.preparaciones.length === 0 ? (
          <p className="nb-suave">Todavía no hay comidas registradas. <Link to={`/registrar${nino}`}>Registrá la primera</Link>.</p>
        ) : (
          <>
            <GrupoPrep titulo="Acepta" ayuda="Lo que come con tranquilidad." lista={prep.acepta} />
            <GrupoPrep titulo="En proceso" ayuda="Lo está explorando: cada vez que lo mira, lo toca o lo prueba es un avance." lista={prep.enProceso} />
            <GrupoPrep titulo="Todavía no" ayuda="Por ahora no. Se puede volver a ofrecer más adelante, sin presión." lista={prep.todaviaNo} />
          </>
        )}
      </section>

      <div className="pf-botones">
        <Link className="nb-boton" to={`/resumen${nino}`}>Resumen para el nutricionista</Link>
        <Link className="nb-boton nb-boton-secundario" to={RUTA_PERFIL_NUEVO}>Crear otro perfil</Link>
      </div>
    </div>
  )
}

function GrupoPrep({ titulo, ayuda, lista }: { titulo: string; ayuda: string; lista: PerfilT['preparaciones'] }) {
  if (!lista.length) return null
  return (
    <div className="pf-grupo-prep">
      <h3>{titulo} <span className="pf-cuenta nb-numero">{lista.length}</span></h3>
      <p className="pf-ayuda">{ayuda}</p>
      <ul className="pf-prep">
        {lista.map((p) => (
          <li key={p.id}>
            <span>{p.nombre}</span>
            <span className="pf-meta nb-numero">{textoVeces(p.veces)} en el plato</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
