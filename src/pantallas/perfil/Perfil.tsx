// Perfil del chico activo (C6): datos, reglas y "Lo que sabemos de <nombre>" (le gusta, está probando, lo que notamos).
// Sin grafo ni números de confianza (C13). Hacia el padre nunca se dice "rechaza".
// Arriba, la inicial del chico en un círculo, su nombre y su edad. La protagonista es "Lo que sabemos": lo que le
// gusta como bocados, lo que está probando con las veces y lo que notamos en sus comidas. Abajo, tranquilos, sus
// reglas, sus alergias y cuidados, y el resumen para el nutricionista.
import { Camera, ShieldCheck, Stethoscope } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { Perfil as PerfilT } from '../../../shared/contratos'
import { Cargando, ErrorConReintento } from '../../componentes/Estados'
import { IconoAlimento } from '../../componentes/IconoAlimento'
import { PlatoVacio } from '../../componentes/Ilustraciones'
import { PerfilNoEncontrado } from '../../componentes/PerfilNoEncontrado'
import { Button } from '../../componentes/ui/button'
import { api } from '../../lib/api'
import { useNinoActivo } from '../../lib/nino'
import { useApi } from '../../lib/useApi'
import { NOMBRE_ALERGENO } from '../../lib/vocabulario'
import { textoVeces } from './borrador'
import { Aviso, ICONO, Inicial, TituloSeccion } from './Piezas'
import { loQueSabemos } from './sabemos'
import { anios, AVISO_DECLARADA, AVISO_DIETA, NOMBRE_DIETA, NOMBRE_SENAL } from './textos'

export function Perfil() {
  const ninoId = useNinoActivo()
  const estado = useApi((s) => api.perfil(ninoId, s), [ninoId])

  if (estado.tipo === 'cargando') {
    return (
      <div className="flex flex-col gap-6" aria-busy="true">
        <div className="flex items-center gap-4 px-1">
          <span aria-hidden="true" className="size-20 shrink-0 animate-pulse rounded-full bg-muted motion-reduce:animate-none" />
          <Cargando texto="Cargando el perfil…" />
        </div>
        <span aria-hidden="true" className="block h-72 animate-pulse rounded-3xl bg-brote motion-reduce:animate-none" />
      </div>
    )
  }
  if (estado.tipo === 'error') {
    if (estado.error.codigo === 'no_encontrado') return <PerfilNoEncontrado />
    return <ErrorConReintento error={estado.error} reintentar={estado.reintentar} />
  }
  return <VistaPerfil perfil={estado.datos} />
}

/** Un dato chico al lado de la edad: el peso, la talla. */
function Dato({ children }: { children: ReactNode }) {
  return <span className="rounded-full bg-muted px-2.5 py-0.5 text-sm text-musgo tabular-nums">{children}</span>
}

/** Una fila de "Alergias y cuidados": lo que es a la izquierda, el valor a la derecha. */
function Fila({ termino, children }: { termino: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[6.5rem_1fr] items-baseline gap-3 py-3 first:pt-0 last:pb-0">
      <dt className="text-musgo">{termino}</dt>
      <dd className="min-w-0 font-bold text-pino">{children}</dd>
    </div>
  )
}

function VistaPerfil({ perfil }: { perfil: PerfilT }) {
  const { ninoId, datos, reglas } = perfil
  const nino = `?nino=${encodeURIComponent(ninoId)}`

  return (
    <div className="flex flex-col gap-7">
      <header className="flex items-center gap-4 px-1">
        <Inicial nombre={datos.nombre} className="size-20 text-4xl" />
        <div className="flex min-w-0 flex-col gap-1.5">
          <h1 className="text-4xl font-black [overflow-wrap:anywhere]">{datos.nombre}</h1>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <span className="mr-1 text-lg font-bold text-pino tabular-nums">{anios(datos.edad)}</span>
            {datos.pesoKg !== undefined && <Dato>{datos.pesoKg.toLocaleString('es-UY')} kg</Dato>}
            {datos.tallaCm !== undefined && <Dato>{datos.tallaCm} cm</Dato>}
          </p>
        </div>
      </header>

      <LoQueSabemos nombre={datos.nombre} perfil={perfil} nino={nino} />

      <section className="flex flex-col gap-3" aria-labelledby="pf-t-reglas">
        <TituloSeccion id="pf-t-reglas" icono={ICONO.reglas}>Sus reglas</TituloSeccion>
        {reglas.length
          ? (
            <ul className="flex flex-col gap-2">
              {reglas.map((r, i) => (
                <li key={i} className="rounded-2xl border bg-card px-4 py-3 font-bold text-pino text-pretty">{r.texto}</li>
              ))}
            </ul>
          )
          : <p className="text-musgo">Todavía no hay reglas anotadas.</p>}
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border bg-card p-5" aria-labelledby="pf-t-cuidados">
        <TituloSeccion id="pf-t-cuidados" icono={ShieldCheck}>Alergias y cuidados</TituloSeccion>
        <dl className="flex flex-col divide-y">
          <Fila termino="Alergias">
            {datos.alergias.length
              ? (
                <span className="flex flex-wrap gap-1.5">
                  {datos.alergias.map((a) => <span key={a} className="rounded-full bg-muted px-3 py-0.5">{NOMBRE_ALERGENO[a]}</span>)}
                </span>
              )
              : <span className="font-normal">Sin alergias marcadas</span>}
          </Fila>
          <Fila termino="Dieta">{NOMBRE_DIETA[datos.dieta]}</Fila>
          {datos.suplementos && (
            <Fila termino="Suplementos">
              {datos.suplementos} <span className="text-sm font-normal text-musgo">(solo registro)</span>
            </Fila>
          )}
        </dl>
        {datos.dieta === 'sin_gluten_caseina' && <Aviso icono={Stethoscope}><p>{AVISO_DIETA}</p></Aviso>}
        {datos.alertas.length > 0 && (
          <Aviso icono={Stethoscope}>
            <p>Nos contaste: {datos.alertas.map((s) => NOMBRE_SENAL[s].toLowerCase()).join('; ')}.</p>
            <p>{AVISO_DECLARADA}</p>
          </Aviso>
        )}
      </section>

      <Button asChild variant="outline" size="lg" className="w-full">
        <Link to={`/resumen${nino}`}>
          <Stethoscope aria-hidden="true" /> Resumen para el nutricionista
        </Link>
      </Button>
    </div>
  )
}

/** La protagonista: lo que aprendió Nibble de sus comidas, en tres grupos que se ven distintos. */
function LoQueSabemos({ nombre, perfil, nino }: { nombre: string; perfil: PerfilT; nino: string }) {
  const { leGusta, leGustaMas, probando, notamos } = loQueSabemos(perfil)
  const vacio = !leGusta.length && !probando.length && !notamos.length
  return (
    <div className="rounded-3xl shadow-flotante">
      <section className="mordisco flex flex-col gap-6 rounded-3xl bg-brote px-4 pt-6 pb-5" aria-labelledby="pf-t-sabemos">
        <h2 id="pf-t-sabemos" className="px-1 pr-10 text-2xl">Lo que sabemos de {nombre}</h2>
        {vacio && (
          <div className="flex flex-col items-center gap-3 px-2 pb-2 text-center">
            <PlatoVacio className="size-24" />
            <p className="text-pino text-pretty">Todavía no hay comidas registradas.</p>
            <Button asChild>
              <Link to={`/registrar${nino}`}><Camera aria-hidden="true" /> Registrá la primera</Link>
            </Button>
          </div>
        )}

        {leGusta.length > 0 && (
          <div className="flex flex-col gap-3">
            <TituloSeccion id="pf-t-gusta" nivel="h3" icono={ICONO.acepta} enBrote className="text-lg">Le gusta</TituloSeccion>
            <ul className="flex flex-wrap gap-2">
              {leGusta.map((p) => (
                <li key={p.id} className="flex items-center gap-2 rounded-[1.4rem] bg-background py-1 pr-4 pl-1 leading-snug font-bold text-pino">
                  <IconoAlimento nombre={p.nombre} tamano="sm" />
                  <span className="py-1 first-letter:uppercase">{p.nombre}</span>
                </li>
              ))}
              {leGustaMas > 0 && (
                <li className="flex items-center px-2 text-musgo">y <span className="mx-1 tabular-nums">{leGustaMas}</span> más</li>
              )}
            </ul>
          </div>
        )}

        {probando.length > 0 && (
          <div className="flex flex-col gap-3">
            <TituloSeccion id="pf-t-probando" nivel="h3" icono={ICONO.probando} enBrote className="text-lg">Está probando</TituloSeccion>
            <ul className="flex flex-col divide-y rounded-2xl bg-background">
              {probando.map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-3 py-2.5">
                  <IconoAlimento nombre={p.nombre} tamano="md" />
                  <span className="min-w-0 flex-1 leading-snug font-bold text-pino first-letter:uppercase">{p.nombre}</span>
                  {p.veces > 0 && (
                    <span className="shrink-0 rounded-full bg-brote px-2.5 py-0.5 text-sm font-bold text-verde-noche tabular-nums">
                      {textoVeces(p.veces)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {notamos.length > 0 && (
          <div className="flex flex-col gap-3">
            <TituloSeccion id="pf-t-notamos" nivel="h3" icono={ICONO.notamos} enBrote className="text-lg">Lo que notamos</TituloSeccion>
            <ul className="flex flex-col gap-2.5 px-1">
              {notamos.map((t) => (
                <li key={t} className="flex gap-3 text-pino text-pretty">
                  <span aria-hidden="true" className="mt-2.5 size-1.5 shrink-0 rounded-full bg-verde" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  )
}
