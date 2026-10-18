import { cn } from 'cn'
import { FlaskConical } from 'lucide-react'
import { lazy, Suspense, useEffect, useSyncExternalStore } from 'react'
import { Link, Route, Routes, useLocation } from 'react-router-dom'
import { ConNino } from './componentes/ConNino'
import { Cargando } from './componentes/Estados'
import { NavInferior } from './componentes/NavInferior'
import { TransicionPantalla } from './componentes/TransicionPantalla'
import { avisoStubs } from './lib/api'
import { recordarHijo } from './lib/familia'
import { useNino } from './lib/nino'
import { Inicio } from './pantallas/inicio/Inicio'
import { Pendiente } from './pantallas/Pendiente'
import { Perfil } from './pantallas/perfil/Perfil'
import { PerfilNuevo } from './pantallas/perfil/PerfilNuevo'
import { Registrar } from './pantallas/registrar/Registrar'

// Lo que no es del ciclo diario (inicio, registrar, alta) se descarga al abrirlo: la Semana trae Recharts, que pesa.
const Tablero = lazy(() => import('./pantallas/tablero/Tablero').then((m) => ({ default: m.Tablero })))
const Receta = lazy(() => import('./pantallas/receta/Receta').then((m) => ({ default: m.Receta })))
const Resumen = lazy(() => import('./pantallas/resumen/Resumen').then((m) => ({ default: m.Resumen })))
const Estado = lazy(() => import('./pantallas/Estado').then((m) => ({ default: m.Estado })))

// Cada pantalla vive en su carpeta de src/pantallas/. La navegación conserva ?nino= (§9). Las que necesitan un chico
// activo van dentro de <ConNino>: sin chico (la primera vez, §5.2) se va al alta por voz y no se muestra la navegación.
// v5.1: registrar se abre desde los botones del inicio (la ruta /registrar sigue igual).

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
    <p className="flex items-start gap-2.5 rounded-2xl border border-dashed border-input bg-muted px-3.5 py-2.5 text-sm text-musgo print:hidden" role="note">
      <FlaskConical className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span><strong className="text-pino">Datos de ejemplo.</strong> Todavía no está conectado: {partes.join(', ')}.</span>
    </p>
  )
}

export function App() {
  const { pathname } = useLocation()
  const nino = useNino()
  const hayNino = nino !== null
  // La navegación lleva solo el chico: no arrastra ?momento= ni ?preparacionId= de otra pantalla.
  const navSearch = nino ? `?${new URLSearchParams({ nino })}` : ''
  useEffect(() => avisoStubs.limpiar(), [pathname])
  // El chico activo siempre está en "Tus hijos" de este celular: el que llegó por ?nino= o el de antes de la lista.
  useEffect(() => { if (nino) recordarHijo(nino) }, [nino])
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[560px] flex-col">
      {/* Al imprimir (el resumen para el nutricionista) queda solo el contenido: sin cabecera, avisos ni navegación. */}
      <header className="flex items-center px-5 pt-[max(14px,env(safe-area-inset-top))] pb-1 print:hidden">
        <Link to={{ pathname: '/', search: navSearch }} aria-label="Nibble, inicio" className="-mx-1.5 rounded-xl px-1.5 py-1">
          <img src="/nibble-logo.svg" alt="Nibble" className="h-8 w-auto" />
        </Link>
      </header>
      <main className={cn('flex flex-1 flex-col gap-4 px-4 pt-2', hayNino ? 'pb-32' : 'pb-12')}>
        <AvisoDatosDeEjemplo />
        <TransicionPantalla>
          <Suspense fallback={<Cargando />}>
            <Routes>
              <Route element={<ConNino />}>
                <Route path="/" element={<Inicio />} />
                <Route path="/registrar" element={<Registrar />} />
                <Route path="/tablero" element={<Tablero />} />
                <Route path="/perfil" element={<Perfil />} />
                <Route path="/receta" element={<Receta />} />
                <Route path="/resumen" element={<Resumen />} />
              </Route>
              <Route path="/perfil/nuevo" element={<PerfilNuevo />} />
              <Route path="/estado" element={<Estado />} />
              <Route path="*" element={<Pendiente titulo="No encontramos esta página" />} />
            </Routes>
          </Suspense>
        </TransicionPantalla>
      </main>
      {hayNino && <NavInferior search={navSearch} />}
    </div>
  )
}
