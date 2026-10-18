// La pantalla principal (PLAN v5.1, §9): el día se organiza en comidas. De arriba hacia abajo: el nombre del chico, la
// próxima comida (la protagonista: abre la receta para esa comida), "Registrar comida" (con la comida que acaba de
// terminar preseleccionada), "Generar receta" (v5.3: para la comida que elija el padre), "Hoy" (nutrientes del día +
// una línea de la semana), las alertas si hay y "Ver la semana".
// El nombre es un botón: abre "Tus hijos" para cambiar de chico o agregar otro (SelectorHijo, src/lib/familia.ts).
// Un solo pedido a /api/progreso (7 días, con ?momento= de la próxima comida; para "Hoy", las alertas y saber cuál es la
// próxima comida) y el perfil en paralelo (el nombre y las reglas). v5.7 · La tarjeta de la próxima comida pide sola su
// comida completa (la receta creativa precargada) cuando la próxima comida ya es segura.
import { CalendarDays, Camera } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
import type { Regla } from '../../../shared/contratos'
import { Link, useLocation } from 'react-router-dom'
import { AvisoConsulta } from '../../componentes/AvisoConsulta'
import { Cargando, ErrorConReintento } from '../../componentes/Estados'
import { GenerarReceta } from '../../componentes/GenerarReceta'
import { PerfilNoEncontrado } from '../../componentes/PerfilNoEncontrado'
import { TarjetaProximaComida } from '../../componentes/ProximaComida'
import { api } from '../../lib/api'
import { diaUruguay, useNinoActivo } from '../../lib/nino'
import { comidaRecienPorHora, comidasDelDia, horaUruguay, leerUltimaComida, proximaComida } from '../../lib/proximaComida'
import { useApi } from '../../lib/useApi'
import { hayComidas } from '../tablero/calculos'
import { Hoy } from './Hoy'
import { SelectorHijo } from './SelectorHijo'

const RESORTE = { type: 'spring', stiffness: 420, damping: 34 } as const
const SIN_REGLAS: Regla[] = []

export function Inicio() {
  const ninoId = useNinoActivo()
  const { search } = useLocation()
  // El reloj se lee una vez al entrar: la pantalla no cambia de comida mientras el padre la mira.
  const [ahora] = useState(() => ({ dia: diaUruguay(), hora: horaUruguay() }))

  // Antes de tener el progreso, la próxima comida sale de la última registrada en este celular (si fue hoy) y la hora.
  const ultima = leerUltimaComida(ninoId, ahora.dia)
  const estimada = proximaComida(ultima ? [ultima] : [], ahora.hora)
  // v5.7 · El progreso ya no da la sugerencia de la tarjeta (las de ?momento=): da "Hoy", las alertas y las comidas de
  // hoy, que dicen cuál es la próxima comida. Se pide para la estimada (las sugerencias que trae no se usan acá).
  const progreso = useApi(
    (s) => api.progreso(ninoId, { dias: 7, momento: estimada.momento }, s),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ninoId],
  )
  const perfil = useApi((s) => api.perfil(ninoId, s), [ninoId])
  const nombre = perfil.tipo === 'ok' ? perfil.datos.datos.nombre : null

  const datos = progreso.tipo === 'ok' ? progreso.datos : null
  const diaHoy = datos?.dias.find((d) => d.dia === ahora.dia) ?? null
  const proxima = datos ? proximaComida(comidasDelDia(datos.dias, ahora.dia), ahora.hora) : estimada
  // La tarjeta arma la comida completa (v5.7) cuando la próxima comida ya es segura (con las comidas de hoy del
  // progreso, o con la hora si el progreso falló) y llegaron las reglas (sin perfil, sin reglas: la receta igual sale).
  const reglas = perfil.tipo === 'ok' ? perfil.datos.reglas : perfil.tipo === 'error' ? SIN_REGLAS : null
  const proximaSegura = progreso.tipo !== 'cargando'

  if (progreso.tipo === 'error' && progreso.error.codigo === 'no_encontrado') return <PerfilNoEncontrado />

  const registrar = new URLSearchParams(search)
  registrar.set('momento', comidaRecienPorHora(ahora.hora))

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col px-1">
        <SelectorHijo ninoId={ninoId} nombre={nombre} />
        <p className="text-sm text-musgo">{fechaLarga(ahora.dia)}</p>
      </header>

      <TarjetaProximaComida ninoId={ninoId} proxima={proxima} reglas={proximaSegura ? reglas : null} nombre={nombre} />

      <div className="flex flex-col gap-3">
        <motion.div whileTap={{ scale: 0.97 }} transition={RESORTE} className="rounded-full">
          <Link
            to={{ pathname: '/registrar', search: `?${registrar}` }}
            className="flex min-h-[76px] items-center gap-4 rounded-full bg-brote py-2.5 pr-6 pl-2.5 transition-colors duration-150 hover:bg-[color-mix(in_oklch,var(--nb-brote),var(--nb-verde)_12%)]"
          >
            <span className="grid size-14 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
              <Camera className="size-6" strokeWidth={2.25} aria-hidden="true" />
            </span>
            <span className="flex flex-col">
              <span className="font-titulo text-xl font-extrabold">Registrar comida</span>
              <span className="text-sm text-musgo">Una foto y contás cómo le fue</span>
            </span>
          </Link>
        </motion.div>

        {/* Debajo de registrar, que es lo que alimenta todo: la receta para otra comida que elige el padre (v5.3). */}
        <GenerarReceta ninoId={ninoId} />
      </div>

      {progreso.tipo === 'cargando' && (
        <div className="flex items-center gap-4 rounded-2xl border bg-card p-4 pr-5">
          <span aria-hidden="true" className="size-20 shrink-0 animate-pulse rounded-full bg-muted motion-reduce:animate-none" />
          <Cargando texto="Mirando cómo viene hoy…" />
        </div>
      )}
      {progreso.tipo === 'error' && <ErrorConReintento error={progreso.error} reintentar={progreso.reintentar} />}
      {datos && <Hoy dia={diaHoy} semana={datos.semana} hayComidasSemana={hayComidas(datos.dias)} />}

      {datos && <AvisoConsulta alertas={datos.alertas} />}

      <Link
        to={{ pathname: '/tablero', search }}
        className="inline-flex h-12 items-center gap-2 self-center rounded-full px-5 font-bold text-primary transition-colors duration-150 hover:bg-brote"
      >
        <CalendarDays className="size-5" strokeWidth={2.25} aria-hidden="true" />
        Ver la semana
      </Link>
    </div>
  )
}

/** '2026-10-18' → "Domingo 18 de octubre". */
function fechaLarga(dia: string): string {
  const texto = new Date(`${dia}T12:00:00Z`).toLocaleDateString('es-UY', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
  return texto.charAt(0).toUpperCase() + texto.slice(1).replace(',', '')
}
