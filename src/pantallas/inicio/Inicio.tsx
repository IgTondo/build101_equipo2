// La pantalla principal (PLAN v5.1, §9): el día se organiza en comidas. De arriba hacia abajo: el nombre del chico,
// "Hoy" (nutrientes del día + una línea de la semana), la próxima comida (el botón grande, abre la receta para esa
// comida), "Registrar comida" (con la comida que acaba de terminar preseleccionada), las alertas si hay y "Ver la semana".
// Un solo pedido a /api/progreso (7 días, con ?momento= de la próxima comida) y el perfil en paralelo, solo por el nombre.
import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { AvisoConsulta } from '../../componentes/AvisoConsulta'
import { Cargando, ErrorConReintento } from '../../componentes/Estados'
import { PerfilNoEncontrado } from '../../componentes/PerfilNoEncontrado'
import { TarjetaProximaComida } from '../../componentes/ProximaComida'
import { api } from '../../lib/api'
import { diaUruguay, useNinoActivo } from '../../lib/nino'
import { comidaRecienPorHora, comidasDelDia, horaUruguay, leerUltimaComida, proximaComida } from '../../lib/proximaComida'
import { useApi } from '../../lib/useApi'
import { hayComidas } from '../tablero/calculos'
import { Hoy } from './Hoy'
import './inicio.css'

export function Inicio() {
  const ninoId = useNinoActivo()
  const { search } = useLocation()
  // El reloj se lee una vez al entrar: la pantalla no cambia de comida mientras el padre la mira.
  const [ahora] = useState(() => ({ dia: diaUruguay(), hora: horaUruguay() }))

  // Antes de tener el progreso, la próxima comida sale de la última registrada en este celular (si fue hoy) y la hora.
  const ultima = leerUltimaComida(ninoId, ahora.dia)
  const estimada = proximaComida(ultima ? [ultima] : [], ahora.hora)
  const progreso = useApi(
    (s) => api.progreso(ninoId, { dias: 7, momento: estimada.momento }, s),
    [ninoId],
  )
  const perfil = useApi((s) => api.perfil(ninoId, s), [ninoId])
  const nombre = perfil.tipo === 'ok' ? perfil.datos.datos.nombre : null

  if (progreso.tipo === 'error' && progreso.error.codigo === 'no_encontrado') return <PerfilNoEncontrado />

  const datos = progreso.tipo === 'ok' ? progreso.datos : null
  const diaHoy = datos?.dias.find((d) => d.dia === ahora.dia) ?? null
  const proxima = datos ? proximaComida(comidasDelDia(datos.dias, ahora.dia), ahora.hora) : estimada

  const registrar = new URLSearchParams(search)
  registrar.set('momento', comidaRecienPorHora(ahora.hora))

  return (
    <div className="in">
      <h1 className="in-nombre">{nombre ?? <span className="nb-oculto">Inicio</span>}</h1>

      {progreso.tipo === 'cargando' && (
        <div className="nb-tarjeta in-hoy in-cargando"><Cargando texto="Mirando cómo viene hoy…" /></div>
      )}
      {progreso.tipo === 'error' && <ErrorConReintento error={progreso.error} reintentar={progreso.reintentar} />}
      {datos && <Hoy dia={diaHoy} semana={datos.semana} hayComidasSemana={hayComidas(datos.dias)} />}

      {progreso.tipo !== 'error' && <TarjetaProximaComida ninoId={ninoId} proxima={proxima} progreso={datos} />}

      <Link className="nb-boton nb-boton-secundario in-registrar" to={{ pathname: '/registrar', search: `?${registrar}` }}>
        <IconoCamara /> Registrar comida
      </Link>

      {datos && <AvisoConsulta alertas={datos.alertas} />}

      <Link className="in-semana-link" to={{ pathname: '/tablero', search }}>Ver la semana</Link>
    </div>
  )
}

function IconoCamara() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
      <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.6l1.3-2h5.2l1.3 2h1.6A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="12" cy="12.5" r="3.5" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}
