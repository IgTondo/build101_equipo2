// Perfil del chico activo (C6): datos, reglas y "Lo que sabemos de <nombre>" (le gusta, está probando, lo que notamos).
// Sin grafo ni números de confianza (C13). Hacia el padre nunca se dice "rechaza".
import { Link } from 'react-router-dom'
import type { Perfil as PerfilT } from '../../../shared/contratos'
import { Cargando, ErrorConReintento } from '../../componentes/Estados'
import { PerfilNoEncontrado } from '../../componentes/PerfilNoEncontrado'
import { api } from '../../lib/api'
import { useNinoActivo } from '../../lib/nino'
import { useApi } from '../../lib/useApi'
import { NOMBRE_ALERGENO } from '../../lib/vocabulario'
import { textoVeces } from './borrador'
import { loQueSabemos } from './sabemos'
import { anios, AVISO_DECLARADA, AVISO_DIETA, NOMBRE_DIETA, NOMBRE_SENAL } from './textos'
import './perfil.css'

export function Perfil() {
  const ninoId = useNinoActivo()
  const estado = useApi((s) => api.perfil(ninoId, s), [ninoId])

  if (estado.tipo === 'cargando') return <Cargando texto="Cargando el perfil…" />
  if (estado.tipo === 'error') {
    if (estado.error.codigo === 'no_encontrado') return <PerfilNoEncontrado />
    return <ErrorConReintento error={estado.error} reintentar={estado.reintentar} />
  }
  return <VistaPerfil perfil={estado.datos} />
}

function VistaPerfil({ perfil }: { perfil: PerfilT }) {
  const { ninoId, datos, reglas } = perfil
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

      <LoQueSabemos nombre={datos.nombre} perfil={perfil} nino={nino} />

      <section className="nb-tarjeta pf-seccion" aria-labelledby="pf-t-reglas">
        <h2 id="pf-t-reglas">Sus reglas</h2>
        {reglas.length
          ? <ul className="pf-lista-simple">{reglas.map((r, i) => <li key={i}>{r.texto}</li>)}</ul>
          : <p className="nb-suave">Todavía no hay reglas anotadas.</p>}
      </section>

      <div className="pf-botones">
        <Link className="nb-boton" to={`/resumen${nino}`}>Resumen para el nutricionista</Link>
      </div>
    </div>
  )
}

function LoQueSabemos({ nombre, perfil, nino }: { nombre: string; perfil: PerfilT; nino: string }) {
  const { leGusta, leGustaMas, probando, notamos } = loQueSabemos(perfil)
  const vacio = !leGusta.length && !probando.length && !notamos.length
  return (
    <section className="nb-tarjeta pf-seccion pf-sabemos" aria-labelledby="pf-t-sabemos">
      <h2 id="pf-t-sabemos">Lo que sabemos de {nombre}</h2>
      {vacio && <p className="nb-suave">Todavía no hay comidas registradas. <Link to={`/registrar${nino}`}>Registrá la primera</Link>.</p>}
      {leGusta.length > 0 && (
        <div className="pf-bloque">
          <h3>Le gusta</h3>
          <ul className="pf-gusta">
            {leGusta.map((p) => <li key={p.id}>{p.nombre}</li>)}
            {leGustaMas > 0 && <li className="pf-gusta-mas">y <span className="nb-numero">{leGustaMas}</span> más</li>}
          </ul>
        </div>
      )}
      {probando.length > 0 && (
        <div className="pf-bloque">
          <h3>Está probando</h3>
          <ul className="pf-prep">
            {probando.map((p) => (
              <li key={p.id}>
                <span>{p.nombre}</span>
                {p.veces > 0 && <span className="pf-meta nb-numero">{textoVeces(p.veces)}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {notamos.length > 0 && (
        <div className="pf-bloque">
          <h3>Lo que notamos</h3>
          <ul className="pf-lista-simple">{notamos.map((t) => <li key={t}>{t}</li>)}</ul>
        </div>
      )}
    </section>
  )
}
