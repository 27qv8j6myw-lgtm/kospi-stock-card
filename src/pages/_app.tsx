import type { AppProps } from 'next/app'
import { StrictMode } from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'
import '@/index.css'

export default function PagesApp({ Component, pageProps }: AppProps) {
  return (
    <StrictMode>
      <TooltipProvider delayDuration={200} skipDelayDuration={200}>
        <Component {...pageProps} />
      </TooltipProvider>
    </StrictMode>
  )
}
