'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { ProOpusSection } from '@/components/stock/pro/ProOpusSection'
import { ProStickySearch } from '@/components/stock/pro/ProStickySearch'
import { useAppNavigation } from '@/hooks/useAppNavigation'
import { authFetch } from '@/lib/api'
import { apiUrl } from '@/lib/apiBase'
import { PRO_CONTENT_WRAP, proDesign } from '@/lib/proStockDesign'

const HOLDING_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type HoldingDetail = {
  id: string
  code: string
  name: string | null
  avg_price: number
  quantity: number
  group_id?: string | null
  currentPrice?: number
  profitPct?: number
  created_at?: string
}

type OpusPayload = {
  holdingId?: string
  code: string
  name: string
  profitPct: number
  isProfit: boolean
  currentPrice: number | null
  analysis: string
  toolsUsed?: Array<{ name: string; input: unknown }>
}

const LOADING_MESSAGES = [
  '종목 데이터 조사 중...',
  '뉴스 조사 중...',
  '수급 동향 확인 중...',
  '재무 데이터 분석 중...',
  '종합 진단 작성 중...',
]

function detectHoldingId(pathname: string): string | undefined {
  const m = pathname.match(/^\/pro\/holdings\/([^/]+)\/?$/)
  const raw = m?.[1]
  if (!raw || !HOLDING_ID_RE.test(raw)) return undefined
  return raw
}

function changeClass(pct: number): string {
  if (pct > 0) return 'text-red-600'
  if (pct < 0) return 'text-blue-600'
  return 'text-gray-600'
}

export default function ProHoldingDetailPage() {
  const { pathname, navigate } = useAppNavigation()
  const holdingId = useMemo(() => detectHoldingId(pathname), [pathname])

  const [holding, setHolding] = useState<HoldingDetail | null>(null)
  const [holdingError, setHoldingError] = useState<string | null>(null)
  const [opus, setOpus] = useState<OpusPayload | null>(null)
  const [opusLoading, setOpusLoading] = useState(true)
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MESSAGES[0])

  useEffect(() => {
    if (!holdingId) return
    let cancelled = false

    void authFetch(apiUrl(`/api/pro-holding-detail?id=${encodeURIComponent(holdingId)}`))
      .then(async (r) => {
        const d = (await r.json()) as { holding?: HoldingDetail; error?: string }
        if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`)
        return d.holding
      })
      .then((row) => {
        if (cancelled) return
        if (!row) {
          setHolding(null)
          setHoldingError('보유 종목을 찾을 수 없습니다')
          return
        }
        setHolding(row)
        setHoldingError(null)
      })
      .catch((e) => {
        if (cancelled) return
        setHolding(null)
        setHoldingError(e instanceof Error ? e.message : '보유 종목을 찾을 수 없습니다')
      })

    return () => {
      cancelled = true
    }
  }, [holdingId])

  useEffect(() => {
    if (!holdingId || !holding) return

    let cancelled = false
    setOpus(null)
    setOpusLoading(true)
    setLoadingMsg(LOADING_MESSAGES[0])

    let idx = 0
    const msgInterval = setInterval(() => {
      idx += 1
      setLoadingMsg(LOADING_MESSAGES[idx % LOADING_MESSAGES.length])
    }, 3000)

    void authFetch(apiUrl('/api/pro-holding-opus'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ holdingId }),
    })
      .then(async (r) => {
        const d = (await r.json()) as OpusPayload & { error?: string }
        if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`)
        return d
      })
      .then((d) => {
        if (!cancelled) setOpus(d)
      })
      .catch((e) => {
        console.error('[ProHolding OPUS]', e)
        if (!cancelled) {
          setOpus({
            code: holding.code,
            name: holding.name || holding.code,
            profitPct: holding.profitPct ?? 0,
            isProfit: true,
            currentPrice: holding.currentPrice ?? null,
            analysis: '',
          })
        }
      })
      .finally(() => {
        if (!cancelled) setOpusLoading(false)
        clearInterval(msgInterval)
      })

    return () => {
      cancelled = true
      clearInterval(msgInterval)
    }
  }, [holdingId, holding])

  if (!holdingId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 text-sm text-gray-500">
        잘못된 보유 종목 링크입니다
      </div>
    )
  }

  const code = holding?.code ?? opus?.code ?? ''
  const avgPrice = holding ? Number(holding.avg_price) : 0
  const currentPrice = opus?.currentPrice ?? holding?.currentPrice ?? null
  const profitPct = opus?.profitPct ?? holding?.profitPct ?? 0

  return (
    <div className="min-h-screen w-full min-w-0 max-w-full bg-gray-50">
      <div className={proDesign.stickyBar}>
        <div className={`${PRO_CONTENT_WRAP} py-3`}>
          <ProStickySearch currentCode={code} />
        </div>
      </div>

      <div className={`${PRO_CONTENT_WRAP} space-y-4 py-4 pb-12`}>
        <button
          type="button"
          onClick={() => navigate('/pro/holdings')}
          className="inline-flex items-center gap-1 text-[12px] font-medium text-gray-500 hover:text-gray-800"
        >
          <ArrowLeft size={14} strokeWidth={2} aria-hidden />
          보유종목
        </button>

        {holdingError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-[13px] text-red-800">
            {holdingError}
          </div>
        ) : holding ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <h1 className="text-[20px] font-bold text-gray-900">
              {holding.name || code}
            </h1>
            <p className="mt-1 text-[11px] tabular-nums text-gray-400">{code}</p>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <div className="text-[10px] text-gray-400">평단가</div>
                <div className="text-[14px] font-bold tabular-nums text-gray-900">
                  {avgPrice.toLocaleString()}원
                </div>
              </div>
              <div>
                <div className="text-[10px] text-gray-400">현재가</div>
                <div className="text-[14px] font-bold tabular-nums text-gray-900">
                  {currentPrice != null ? `${currentPrice.toLocaleString()}원` : '—'}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-gray-400">수익률</div>
                <div className={`text-[14px] font-bold tabular-nums ${changeClass(profitPct)}`}>
                  {profitPct > 0 ? '+' : ''}
                  {profitPct.toFixed(2)}%
                </div>
              </div>
              <div>
                <div className="text-[10px] text-gray-400">보유수량</div>
                <div className="text-[14px] font-bold tabular-nums text-gray-900">
                  {Number(holding.quantity).toLocaleString()}주
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-[12px] text-gray-400">
            보유 정보 로딩 중…
          </div>
        )}

        {opusLoading && !opus?.analysis ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 py-10 text-center">
            <div className="mx-auto mb-3 size-6 animate-spin rounded-full border-2 border-amber-600 border-t-transparent" />
            <div className="text-[13px] font-medium text-amber-800">{loadingMsg}</div>
          </div>
        ) : (
          <ProOpusSection analysis={opus?.analysis || ''} loading={opusLoading} />
        )}
      </div>
    </div>
  )
}
