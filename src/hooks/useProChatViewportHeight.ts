import { useEffect } from 'react'
import { isStandalonePwa } from '@/lib/isStandalonePwa'

const KB_OPEN_THRESHOLD_PX = 80

function keyboardBottomPx(): number {
  const vv = window.visualViewport
  if (!vv) return 0
  return Math.max(0, Math.round(window.innerHeight - vv.offsetTop - vv.height))
}

function isKeyboardOpen(): boolean {
  return keyboardBottomPx() > KB_OPEN_THRESHOLD_PX
}

function isChatComposerFocused(): boolean {
  const el = document.activeElement
  if (!el) return false
  return Boolean(el.closest('.pro-chat-composer-bar'))
}

function syncLayout() {
  const root = document.documentElement
  const kbOpen = isKeyboardOpen() && isChatComposerFocused()

  root.style.setProperty('--pro-chat-app-height', isStandalonePwa() ? '100vh' : '100dvh')
  root.classList.toggle('pro-chat-kb-open', kbOpen)

  if (kbOpen) {
    root.style.setProperty('--pro-chat-kb-bottom', `${keyboardBottomPx()}px`)
  } else {
    root.style.removeProperty('--pro-chat-kb-bottom')
  }
}

function clearLayout() {
  const root = document.documentElement
  root.classList.remove('pro-chat-kb-open')
  root.style.removeProperty('--pro-chat-kb-bottom')
  root.style.removeProperty('--pro-chat-app-height')
}

/** iOS PWA — 키보드 열림: 입력창만 visualViewport 하단 고정 (전체 높이 축소 X) */
export function useProChatViewportHeight(enabled = true) {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return

    const mq = window.matchMedia('(max-width: 767px)')
    const vv = window.visualViewport

    const sync = () => {
      if (!mq.matches) {
        clearLayout()
        return
      }
      syncLayout()
    }

    const onFocusIn = (e: FocusEvent) => {
      if ((e.target as Element | null)?.closest('.pro-chat-composer-bar')) {
        sync()
        for (const ms of [50, 100, 200, 350]) {
          window.setTimeout(sync, ms)
        }
      }
    }

    const onFocusOut = () => {
      for (const ms of [50, 150, 350]) {
        window.setTimeout(sync, ms)
      }
    }

    if (vv) {
      vv.addEventListener('resize', sync)
      vv.addEventListener('scroll', sync)
    }
    document.addEventListener('focusin', onFocusIn)
    window.addEventListener('focusout', onFocusOut)
    window.addEventListener('orientationchange', sync)
    mq.addEventListener('change', sync)

    sync()

    return () => {
      if (vv) {
        vv.removeEventListener('resize', sync)
        vv.removeEventListener('scroll', sync)
      }
      document.removeEventListener('focusin', onFocusIn)
      window.removeEventListener('focusout', onFocusOut)
      window.removeEventListener('orientationchange', sync)
      mq.removeEventListener('change', sync)
      clearLayout()
    }
  }, [enabled])
}

export function scheduleProChatLayoutReset() {
  const run = () => {
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches) {
      syncLayout()
    } else {
      clearLayout()
    }
  }
  run()
  for (const ms of [50, 150, 300, 500]) {
    window.setTimeout(run, ms)
  }
}
