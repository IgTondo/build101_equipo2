import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { Estado } from './pantallas/Estado'
import { Inicio } from './pantallas/Inicio'
import { Pendiente } from './pantallas/Pendiente'

// Las pantallas de C2–C8 reemplazan a <Pendiente>. La navegación conserva ?nino= (§9).
const NAV = [
  { a: '/registrar', texto: 'Registrar' },
  { a: '/tablero', texto: 'Tablero' },
  { a: '/perfil', texto: 'Perfil' },
]

export function App() {
  const { search } = useLocation()
  return (
    <div className="nb-app">
      <header className="nb-cabecera">
        <Link to={{ pathname: '/', search }} aria-label="Nibble, inicio">
          <img src="/nibble-logo.svg" alt="Nibble" height={32} />
        </Link>
      </header>
      <main className="nb-contenido">
        <Routes>
          <Route path="/" element={<Inicio />} />
          <Route path="/registrar" element={<Pendiente titulo="Registrar una comida" tarea="C2" />} />
          <Route path="/tablero" element={<Pendiente titulo="¿Está comiendo bien?" tarea="C3" />} />
          <Route path="/perfil" element={<Pendiente titulo="Perfil" tarea="C6" />} />
          <Route path="/receta" element={<Pendiente titulo="Receta" tarea="C7" />} />
          <Route path="/resumen" element={<Pendiente titulo="Resumen para el nutricionista" tarea="C8" />} />
          <Route path="/estado" element={<Estado />} />
          <Route path="*" element={<Pendiente titulo="No encontramos esta página" />} />
        </Routes>
      </main>
      <nav className="nb-nav" aria-label="Principal">
        {NAV.map((n) => (
          <NavLink key={n.a} to={{ pathname: n.a, search }}>{n.texto}</NavLink>
        ))}
      </nav>
    </div>
  )
}
