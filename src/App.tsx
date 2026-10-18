import { useEffect, useSyncExternalStore } from 'react'
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { ConNino } from './componentes/ConNino'
import { avisoStubs } from './lib/api'
import { useNino } from './lib/nino'
import { Estado } from './pantallas/Estado'
import { Grafo } from './pantallas/grafo/Grafo'
import { Inicio } from './pantallas/inicio/Inicio'
import { Pendiente } from './pantallas/Pendiente'
import { Perfil } from './pantallas/perfil/Perfil'
import { PerfilNuevo } from './pantallas/perfil/PerfilNuevo'
import { Receta } from './pantallas/receta/Receta'
import { Registrar } from './pantallas/registrar/Registrar'
import { Resumen } from './pantallas/resumen/Resumen'
import { Tablero } from './pantallas/tablero/Tablero'

// Cada pantalla vive en su carpeta de src/pantallas/. La navegación conserva ?nino= (§9). Las que necesitan un chico
// activo van dentro de <ConNino>: sin chico (la primera vez, §5.2) se va al alta por voz y no se muestra la navegación.
// v5.1: registrar se abre desde los botones del inicio (la ruta /registrar sigue igual).
const NAV = [
  { a: '/', texto: 'Inicio' },
  { a: '/tablero', texto: 'Semana' },
  { a: '/perfil', texto: 'Perfil' },
]

// Cómo se llama cada endpoint para el padre, en el aviso de datos de ejemplo.
const QUE_ES: Record<string, string> = {
  'analizar-comida': 'la lectura de la foto', 'relato-comida': 'la nota de voz', transcribir: 'la transcripción',
  'perfil-inicial': 'lo que entendimos del relato', receta: 'la receta', 'imagen-plato': 'la imagen del plato',
  perfil: 'el perfil', 'registrar-comida': 'el registro de la comida', nutricion: 'los nutrientes del día',
  progreso: 'el tablero y la próxima comida', salud: 'el estado de los servicios', resumen: 'los números del resumen',
}

function AvisoDatosDeEjemplo() {
  useSyncExternalStore(avisoStubs.suscribir, avisoStubs.version)
  const lista = avisoStubs.lista()
  if (!lista.length) return null
  const partes = lista.map((e) => QUE_ES[e] ?? e)
  return (
    <p className="nb-aviso-ejemplo" role="note">
      <strong>Datos de ejemplo.</strong> Todavía no está conectado: {partes.join(', ')}.
    </p>
  )
}

export function App() {
  const { search, pathname } = useLocation()
  const nino = useNino()
  const hayNino = nino !== null
  // La navegación lleva solo el chico (y el motor de la demo): no arrastra ?momento= ni ?preparacionId= de otra pantalla.
  const motor = new URLSearchParams(search).get('motor')
  const navSearch = nino ? `?${new URLSearchParams({ nino, ...(motor ? { motor } : {}) })}` : ''
  useEffect(() => avisoStubs.limpiar(), [pathname])
  return (
    <div className="nb-app">
      <header className="nb-cabecera">
        <Link to={{ pathname: '/', search: navSearch }} aria-label="Nibble, inicio">
          <img src="/nibble-logo.svg" alt="Nibble" height={32} />
        </Link>
      </header>
      <main className="nb-contenido">
        <AvisoDatosDeEjemplo />
        <Routes>
          <Route element={<ConNino />}>
            <Route path="/" element={<Inicio />} />
            <Route path="/registrar" element={<Registrar />} />
            <Route path="/tablero" element={<Tablero />} />
            <Route path="/perfil" element={<Perfil />} />
            <Route path="/grafo" element={<Grafo />} />
            <Route path="/receta" element={<Receta />} />
            <Route path="/resumen" element={<Resumen />} />
          </Route>
          <Route path="/perfil/nuevo" element={<PerfilNuevo />} />
          <Route path="/estado" element={<Estado />} />
          <Route path="*" element={<Pendiente titulo="No encontramos esta página" />} />
        </Routes>
      </main>
      {hayNino && (
        <nav className="nb-nav" aria-label="Principal">
          {NAV.map((n) => (
            <NavLink key={n.a} to={{ pathname: n.a, search: navSearch }} end={n.a === '/'}>{n.texto}</NavLink>
          ))}
        </nav>
      )}
    </div>
  )
}
