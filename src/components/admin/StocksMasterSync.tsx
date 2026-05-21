'use client'

import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { authFetch } from '@/lib/api'
import { apiUrl } from '@/lib/apiBase'

type SyncResult = {
  success: boolean
  message: string
}

type StockRow = { code: string; name: string; corp_code?: string }

const BATCH_SIZE = 500

export function StocksMasterSync() {
  const [syncing, setSyncing] = useState(false)
  const [phase, setPhase] = useState<'fetch' | 'batch' | null>(null)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [result, setResult] = useState<SyncResult | null>(null)

  const sync = async () => {
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
    } catch (e) {
      setResult({
        success: false,
        message: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setSyncing(false)
      setPhase(null)
    }
  }

  const pct =
    progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[14px] font-bold text-gray-900">종목 마스터 동기화</h2>
          <p className="mt-1 text-[11px] text-gray-500">
            사전 빌드 종목 파일 → DB 반영 (약 2,500개, 30초). 데이터 갱신은{' '}
            <code className="text-[10px]">npm run fetch-stocks</code> 후 배포.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void sync()}
          disabled={syncing}
          className="flex items-center gap-1.5 rounded-lg bg-gray-900 px-4 py-2 text-[12px] font-bold text-white hover:bg-gray-800 disabled:opacity-50"
        >
          <RefreshCw
            size={13}
            strokeWidth={2}
            className={syncing ? 'animate-spin' : ''}
            aria-hidden
          />
          <span>
            {syncing
              ? phase === 'fetch'
                ? '종목 파일 로딩…'
                : '등록 중…'
              : '동기화'}
          </span>
        </button>
      </div>

      {syncing && phase === 'batch' && progress.total > 0 ? (
        <div className="mb-3">
          <div className="mb-1 flex justify-between text-[10px] text-gray-500">
            <span>
              {progress.done.toLocaleString()} / {progress.total.toLocaleString()}
            </span>
            <span>{pct}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full bg-gray-900 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      ) : null}

      {result ? (
        <div
          className={`rounded-lg border p-3 text-[12px] ${
            result.success
              ? 'border-green-200 bg-green-50 text-green-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {result.message}
        </div>
      ) : null}
    </div>
  )
}
