'use client'

import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { authFetch } from '@/lib/api'
import { apiUrl } from '@/lib/apiBase'
import { supabase } from '@/lib/supabase'

type SyncResult = {
  success: boolean
  message: string
}

type StockRow = { code: string; name: string; corp_code?: string }

const BATCH_SIZE = 500

const SYNC_TITLE = '사전 빌드 종목 파일 → DB 반영 (약 2,500개, 30초)'

function useStocksMasterSync() {
  const [syncing, setSyncing] = useState(false)
  const [phase, setPhase] = useState<'fetch' | 'batch' | null>(null)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [result, setResult] = useState<SyncResult | null>(null)
  const [stockCount, setStockCount] = useState<number | null>(null)

  const loadStockCount = useCallback(async () => {
    const { count, error } = await supabase
      .from('stocks_master')
      .select('*', { count: 'exact', head: true })
    if (!error && count != null) setStockCount(count)
  }, [])

  useEffect(() => {
    void loadStockCount()
  }, [loadStockCount])

  const sync = useCallback(async () => {
    if (
      !confirm(
        '사전 빌드 종목 파일을 stocks_master에 반영합니다 (약 30초).\n계속할까요?',
      )
    ) {
      return
    }

    setSyncing(true)
    setPhase('fetch')
    setProgress({ done: 0, total: 0 })
    setResult(null)

    try {
      const r1 = await authFetch(apiUrl('/api/admin-sync-stocks-fetch'), { method: 'POST' })
      const d1 = (await r1.json()) as {
        error?: string
        stocks?: StockRow[]
        total?: number
        updatedAt?: string
      }

      if (!r1.ok) {
        throw new Error(d1.error || `다운로드 실패 HTTP ${r1.status}`)
      }

      const stocks = d1.stocks ?? []
      const total = d1.total ?? stocks.length
      setPhase('batch')
      setProgress({ done: 0, total })

      let inserted = 0
      const batchErrors: string[] = []

      for (let i = 0; i < stocks.length; i += BATCH_SIZE) {
        const batch = stocks.slice(i, i + BATCH_SIZE)
        const r2 = await authFetch(apiUrl('/api/admin-sync-stocks-batch'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stocks: batch }),
        })
        const d2 = (await r2.json()) as { error?: string; inserted?: number }

        if (r2.ok) {
          inserted += d2.inserted ?? batch.length
          setProgress({ done: inserted, total })
        } else {
          batchErrors.push(d2.error || `배치 ${i} HTTP ${r2.status}`)
        }
      }

      const errNote = batchErrors.length ? ` · 오류 ${batchErrors.length}건` : ''
      setResult({
        success: batchErrors.length === 0,
        message: `${inserted.toLocaleString()}/${total.toLocaleString()}개 동기화 완료${errNote}`,
      })
      await loadStockCount()
    } catch (e) {
      setResult({
        success: false,
        message: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setSyncing(false)
      setPhase(null)
    }
  }, [loadStockCount])

  const buttonLabel =
    syncing && phase === 'fetch'
      ? '로딩…'
      : syncing && phase === 'batch' && progress.total > 0
        ? `${progress.done.toLocaleString()}/${progress.total.toLocaleString()}`
        : syncing
          ? '동기화 중...'
          : `종목 동기화${stockCount != null ? ` (${stockCount.toLocaleString()})` : ''}`

  return { syncing, sync, result, buttonLabel }
}

/** 관리자 페이지 헤더 — 제목 옆 동기화 버튼 */
export function AdminDashboardHeader() {
  const { syncing, sync, result, buttonLabel } = useStocksMasterSync()

  return (
    <div className="mb-4">
      <div className="mb-1 flex flex-wrap items-center gap-3">
        <h1 className="text-[22px] font-bold text-gray-900">관리자 대시보드</h1>
        <button
          type="button"
          onClick={() => void sync()}
          disabled={syncing}
          className="flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-1.5 text-[12px] font-bold text-white hover:bg-gray-800 disabled:opacity-50"
          title={SYNC_TITLE}
        >
          <RefreshCw
            size={13}
            strokeWidth={2}
            className={syncing ? 'animate-spin' : ''}
            aria-hidden
          />
          {buttonLabel}
        </button>
      </div>
      {result ? (
        <p
          className={`mt-2 text-[12px] ${result.success ? 'text-green-700' : 'text-red-700'}`}
          role="status"
        >
          {result.message}
        </p>
      ) : null}
    </div>
  )
}
