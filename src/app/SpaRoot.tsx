'use client'

import { StrictMode } from 'react'
import App from '@/App'
import { TooltipProvider } from '@/components/ui/tooltip'

/** Next `app/page`·`/stocks/[code]` 등 공통 — 클라이언트에서만 pathname 읽음 */
export default function SpaRoot() {
  return (
    <StrictMode>
      <TooltipProvider delayDuration={200} skipDelayDuration={200}>
        <App />
      </TooltipProvider>
    </StrictMode>
  )
}
