import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { TooltipProvider } from './components/ui/tooltip'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TooltipProvider delayDuration={200} skipDelayDuration={100}>
      <App />
    </TooltipProvider>
  </StrictMode>,
)
