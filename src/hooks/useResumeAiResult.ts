import { useCallback, useEffect, useRef, useState } from 'react'

const STORAGE_PREFIX = 'aiPending:'
/** 표식 유효기간 — 이보다 오래된 진행중 표식은 결과를 기대하지 않고 폐기 */
const DEFAULT_EXPIRY_MS = 10 * 60 * 1000

function storageKey(key: string) {
  return `${STORAGE_PREFIX}${key}`
}

function readMark(key: string, expiryMs: number): boolean {
  try {
    const raw = localStorage.getItem(storageKey(key))
    if (!raw) return false
    const at = Number(raw)
    if (!Number.isFinite(at) || Date.now() - at > expiryMs) {
      localStorage.removeItem(storageKey(key))
      return false
    }
    return true
  } catch {
    return false
  }
}

/** AI 작업 시작 표식 기록 (탭이 종료돼 state 가 날아가도 복원되도록 localStorage 사용) */
export function markAiTaskPending(key: string) {
  try {
    localStorage.setItem(storageKey(key), String(Date.now()))
  } catch {
    // 사파리 프라이빗 모드 등 — 표식 없이도 동작에는 지장 없음
  }
}

/** AI 작업 진행중 표식 제거 */
export function clearAiTaskPending(key: string) {
  try {
    localStorage.removeItem(storageKey(key))
  } catch {
    // 위와 동일
  }
}

type Options<T> = {
  /** 작업 식별자 (예: 'screener', `holding-opus:${id}`) */
  key: string
  /** 캐시 조회 전용 요청. 아직 결과가 없으면 null 을 반환해야 한다 */
  fetchCached: () => Promise<T | null>
  onResolved: (data: T) => void
  enabled?: boolean
  expiryMs?: number
}

/**
 * 모바일에서 화면이 꺼져 요청이 끊겨도, 서버가 백그라운드로 끝내 캐시에 저장한 결과를
 * 화면 복귀 시 자동으로 가져온다.
 *
 * 시작 시 `start()` 로 진행중 표식을 남기고, 복귀(visibilitychange·focus)와 마운트 시점에
 * `fetchCached` 로 결과를 확인한다. 결과가 있으면 표식을 지우고 `onResolved` 를 호출한다.
 */
export function useResumeAiResult<T>(options: Options<T>) {
  const { key, fetchCached, onResolved, enabled = true, expiryMs = DEFAULT_EXPIRY_MS } = options
  const [pending, setPending] = useState(() => (enabled ? readMark(key, expiryMs) : false))
  const fetchRef = useRef(fetchCached)
  const resolvedRef = useRef(onResolved)
  const runningRef = useRef(false)

  // 렌더 중에는 ref 를 건드리지 않고 커밋 이후에 최신 콜백을 반영
  useEffect(() => {
    fetchRef.current = fetchCached
    resolvedRef.current = onResolved
  })

  const start = useCallback(() => {
    markAiTaskPending(key)
    setPending(true)
  }, [key])

  const finish = useCallback(() => {
    clearAiTaskPending(key)
    setPending(false)
  }, [key])

  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return

    const check = async () => {
      if (runningRef.current) return
      if (!readMark(key, expiryMs)) {
        setPending(false)
        return
      }
      runningRef.current = true
      setPending(true)
      try {
        const data = await fetchRef.current()
        if (data != null) {
          clearAiTaskPending(key)
          setPending(false)
          resolvedRef.current(data)
        }
      } catch {
        // 복귀 조회 실패는 무시 — 다음 복귀 때 다시 확인한다
      } finally {
        runningRef.current = false
      }
    }

    // 앱이 종료됐다 다시 뜬 경우 visibilitychange 가 오지 않으므로 마운트 시에도 확인
    void check()

    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      void check()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [enabled, key, expiryMs])

  return { pending, start, finish }
}
