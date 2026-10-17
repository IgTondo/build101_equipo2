import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { Estado } from './pantallas/Estado'
import { Inicio } from './pantallas/Inicio'
import { Pendiente } from './pantallas/Pendiente'
import { Perfil } from './pantallas/perfil/Perfil'
import { PerfilNuevo } from './pantallas/perfil/PerfilNuevo'
import { Receta } from './pantallas/receta/Receta'
import { Registrar } from './pantallas/registrar/Registrar'
import { Resumen } from './pantallas/resumen/Resumen'
import { Tablero } from './pantallas/tablero/Tablero'

// Cada pantalla vive en su carpeta de src/pantallas/. La navegación conserva ?nino= (§9).
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
          <Route path="/registrar" element={<Registrar />} />
          <Route path="/tablero" element={<Tablero />} />
          <Route path="/perfil" element={<Perfil />} />
          <Route path="/perfil/nuevo" element={<PerfilNuevo />} />
          <Route path="/receta" element={<Receta />} />
          <Route path="/resumen" element={<Resumen />} />
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
