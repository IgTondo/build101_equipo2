// La pantalla principal (PLAN v5.1, §9; v5.3, §5.3): el día se organiza en comidas. De arriba hacia abajo: el nombre
// del chico, "Hoy" (nutrientes del día + una línea de la semana), la tarjeta grande con el selector de comida y el plato
// (marcada la próxima comida), la invitación a registrar con "Registrar comida" (la comida que acaba de terminar
// preseleccionada), las alertas si hay y "Ver la semana".
// Un pedido a /api/progreso por comida (7 días, ?momento=), en caché en memoria, y el perfil en paralelo por el nombre.
// Al elegir otra comida se pide la suya y, mientras llega, la tarjeta anterior queda atenuada. No se guarda la elección.
import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { AvisoConsulta } from '../../componentes/AvisoConsulta'
import { Cargando, ErrorConReintento } from '../../componentes/Estados'
import { PerfilNoEncontrado } from '../../componentes/PerfilNoEncontrado'
import { TarjetaComida } from '../../componentes/ProximaComida'
import { SelectorComida } from '../../componentes/SelectorComida'
import { api } from '../../lib/api'
import { diaUruguay, useNinoActivo } from '../../lib/nino'
import { etiquetaComida, lineaDespues } from '../../lib/platoComida'
import { useProgresoComida } from '../../lib/progresoComida'
import { comidaRecienPorHora, comidasDelDia, horaUruguay, leerUltimaComida, proximaComida, type ComidaPlan } from '../../lib/proximaComida'
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
  // La comida elegida en el selector; sin elegir, la próxima (primero la estimada y, con el progreso, la calculada).
  const [elegida, setElegida] = useState<ComidaPlan | null>(null)
  const [calculada, setCalculada] = useState<{ ninoId: string; proxima: typeof estimada } | null>(null)
  const proxima = calculada?.ninoId === ninoId ? calculada.proxima : estimada
  const momento = elegida ?? proxima.momento
  const progreso = useProgresoComida(ninoId, momento)
  const perfil = useApi((s) => api.perfil(ninoId, s), [ninoId])
  const nombre = perfil.tipo === 'ok' ? perfil.datos.datos.nombre : null

  // Las comidas de hoy son las mismas para cualquier ?momento=: con el primer progreso se corrige la próxima comida.
  const datos = progreso.datos
  if (datos && calculada?.ninoId !== ninoId) {
    setCalculada({ ninoId, proxima: proximaComida(comidasDelDia(datos.dias, ahora.dia), ahora.hora) })
  }

  if (progreso.error?.codigo === 'no_encontrado') return <PerfilNoEncontrado />

  const diaHoy = datos?.dias.find((d) => d.dia === ahora.dia) ?? null

  const registrar = new URLSearchParams(search)
  registrar.set('momento', comidaRecienPorHora(ahora.hora))

  return (
    <div className="in">
      <h1 className="in-nombre">{nombre ?? <span className="nb-oculto">Inicio</span>}</h1>

      {!datos && !progreso.error && (
        <div className="nb-tarjeta in-hoy in-cargando"><Cargando texto="Mirando cómo viene hoy…" /></div>
      )}
      {!datos && progreso.error && <ErrorConReintento error={progreso.error} reintentar={progreso.reintentar} />}
      {datos && <Hoy dia={diaHoy} semana={datos.semana} hayComidasSemana={hayComidas(datos.dias)} />}

      {(datos || !progreso.error) && (
        <TarjetaComida
          ninoId={ninoId}
          etiqueta={etiquetaComida(momento, proxima)}
          progreso={progreso}
          selector={<SelectorComida valor={momento} onCambiar={setElegida} />}
        />
      )}

      <div className="in-registrar-bloque">
        <p className="in-despues">{lineaDespues(momento)}</p>
        <Link className="nb-boton nb-boton-secundario in-registrar" to={{ pathname: '/registrar', search: `?${registrar}` }}>
          <IconoCamara /> Registrar comida
        </Link>
      </div>

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
