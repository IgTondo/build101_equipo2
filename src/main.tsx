import { MotionConfig } from 'motion/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import { Toaster } from './componentes/ui/sonner'
import { TooltipProvider } from './componentes/ui/tooltip'
import './index.css'
import './legado.css'

// MotionConfig: si el sistema pide menos movimiento, motion apaga los desplazamientos y deja solo los fundidos.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <MotionConfig reducedMotion="user">
        <TooltipProvider delayDuration={300}>
          <App />
          <Toaster position="top-center" />
        </TooltipProvider>
      </MotionConfig>
    </BrowserRouter>
  </StrictMode>,
)
