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

function shouldTrackKeyboard(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(max-width: 767px)').matches &&
    isKeyboardOpen() &&
    isChatComposerFocused()
  )
}

function syncLayout() {
  const root = document.documentElement
  const vv = window.visualViewport
  const kbOpen = isKeyboardOpen() && isChatComposerFocused()

  root.classList.toggle('pro-chat-kb-open', kbOpen)

  if (kbOpen && vv) {
    root.style.setProperty('--pro-chat-app-height', `${Math.round(vv.height)}px`)
    root.style.setProperty('--pro-chat-vv-top', `${Math.round(vv.offsetTop)}px`)
  } else {
    root.style.setProperty('--pro-chat-app-height', isStandalonePwa() ? '100vh' : '100dvh')
    root.style.removeProperty('--pro-chat-vv-top')
  }
}

function clearLayout() {
  const root = document.documentElement
  root.classList.remove('pro-chat-kb-open')
  root.style.removeProperty('--pro-chat-app-height')
  root.style.removeProperty('--pro-chat-vv-top')
}

/** iOS PWA·Safari — 키보드 열림: 채팅 컨테이너를 visualViewport(키보드 위 영역)에 고정 */
export function useProChatViewportHeight(enabled = true) {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return

    const mq = window.matchMedia('(max-width: 767px)')
    const vv = window.visualViewport
    let rafId = 0

    const stopRafLoop = () => {
      if (rafId) {
        cancelAnimationFrame(rafId)
        rafId = 0
      }
    }

    const rafLoop = () => {
      if (!shouldTrackKeyboard()) {
        stopRafLoop()
        syncLayout()
        return
      }
      syncLayout()
      rafId = requestAnimationFrame(rafLoop)
    }

    const startRafLoop = () => {
      stopRafLoop()
      if (shouldTrackKeyboard()) {
        syncLayout()
        rafId = requestAnimationFrame(rafLoop)
      }
    }

    const sync = () => {
      if (!mq.matches) {
        stopRafLoop()
        clearLayout()
        return
      }
      syncLayout()
      if (shouldTrackKeyboard()) {
        startRafLoop()
      } else {
        stopRafLoop()
      }
    }

    const onFocusIn = (e: FocusEvent) => {
      if ((e.target as Element | null)?.closest('.pro-chat-composer-bar')) {
        sync()
        startRafLoop()
        for (const ms of [50, 100, 200, 350]) {
          window.setTimeout(sync, ms)
        }
      }
    }

    const onFocusOut = () => {
      stopRafLoop()
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
      stopRafLoop()
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
