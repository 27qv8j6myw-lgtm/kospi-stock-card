'use client'

import { StrictMode } from 'react'
import App from '@/App'
import { TooltipProvider } from '@/components/ui/tooltip'

export default function HomePage() {
  return (
    <StrictMode>
      <TooltipProvider delayDuration={200} skipDelayDuration={200}>
        <App />
      </TooltipProvider>
    </StrictMode>
  )
}
