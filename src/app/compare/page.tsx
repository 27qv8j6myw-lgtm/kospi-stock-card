'use client'

import { StrictMode } from 'react'
import App from '@/App'
import { TooltipProvider } from '@/components/ui/tooltip'

/** 클라이언트 라우터(`/compare`) 새로고침 시에도 동일 셸 제공 */
export default function CompareAppPage() {
  return (
    <StrictMode>
      <TooltipProvider delayDuration={200} skipDelayDuration={200}>
        <App />
      </TooltipProvider>
    </StrictMode>
  )
}
