'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Sparkles, Archive } from 'lucide-react'
import { TradeHistorySection } from '@/components/pro/TradeHistorySection'
import { ProOpusSection } from '@/components/stock/pro/ProOpusSection'
import { ProStickySearch } from '@/components/stock/pro/ProStickySearch'
import { useAppNavigation } from '@/hooks/useAppNavigation'
import { useResumeAiResult } from '@/hooks/useResumeAiResult'
import { authFetch } from '@/lib/api'
import { apiUrl } from '@/lib/apiBase'
import { PRO_CONTENT_WRAP, PRO_STOCK_SCROLL_OFFSET } from '@/lib/proStockDesign'

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
  model?: string
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
  const [needsGenerate, setNeedsGenerate] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MESSAGES[0])
  const [detailRefreshKey, setDetailRefreshKey] = useState(0)
  /** Opus 진단 캐시 조회는 종목당 1회만 (자동 생성은 하지 않음) */
  const opusRanForRef = useRef<string | null>(null)

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
  }, [holdingId, detailRefreshKey])

  /** 복귀 조회 — 서버가 백그라운드로 끝낸 진단이 캐시에 있을 때만 반환 (재계산 없음) */
  const fetchCachedOpus = useCallback(async () => {
    if (!holdingId) return null
    const r = await authFetch(apiUrl('/api/pro-holding-opus'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ holdingId, cachedOnly: true }),
    })
    const d = (await r.json().catch(() => null)) as (OpusPayload & { pending?: boolean }) | null
    if (!r.ok || !d?.analysis) return null
    return d
  }, [holdingId])

  const {
    pending: opusResuming,
    start: markOpusStarted,
    finish: markOpusFinished,
  } = useResumeAiResult<OpusPayload>({
    key: `holding-opus:${holdingId ?? ''}`,
    enabled: Boolean(holdingId),
    fetchCached: fetchCachedOpus,
    onResolved: (d) => {
      setOpus(d)
      setNeedsGenerate(false)
      setOpusLoading(false)
    },
  })

  // 진단 생성(온디맨드) — 사용자가 버튼을 눌렀을 때만 유료 호출
  const generateDiagnosis = useCallback(() => {
    if (!holdingId) return
    markOpusStarted()
    setNeedsGenerate(false)
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
        setOpus(d)
        markOpusFinished()
      })
      .catch((e) => {
        // 표식은 유지 — 화면이 꺼져 끊긴 경우 복귀 시 캐시에서 결과를 살린다
        console.error('[ProHolding OPUS]', e)
        setNeedsGenerate(true)
      })
      .finally(() => {
        setOpusLoading(false)
        clearInterval(msgInterval)
      })
  }, [holdingId, markOpusFinished, markOpusStarted])

  // 진입 시: 캐시만 조회(cachedOnly) — 있으면 표시, 없으면 생성 버튼 노출(자동 비용 방지)
  useEffect(() => {
    if (!holdingId || !holding) return
    if (opusRanForRef.current === holdingId) return
    opusRanForRef.current = holdingId

    let cancelled = false
    setOpus(null)
    setNeedsGenerate(false)
    setOpusLoading(true)

    void authFetch(apiUrl('/api/pro-holding-opus'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ holdingId, cachedOnly: true }),
    })
      .then(async (r) => {
        const d = (await r.json()) as (OpusPayload & { pending?: boolean; error?: string }) | null
        if (!r.ok) throw new Error(d?.error || `HTTP ${r.status}`)
        return d
      })
      .then((d) => {
        if (cancelled) return
        if (d && d.analysis) {
          setOpus(d)
        } else {
          setNeedsGenerate(true)
        }
      })
      .catch((e) => {
        if (cancelled) return
        console.error('[ProHolding OPUS cache]', e)
        setNeedsGenerate(true)
      })
      .finally(() => {
        if (!cancelled) setOpusLoading(false)
      })

    return () => {
      cancelled = true
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
      <ProStickySearch currentCode={code} />

      <div className={`${PRO_CONTENT_WRAP} ${PRO_STOCK_SCROLL_OFFSET} space-y-4 pb-12`}>
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

        {holding?.group_id ? (
          <TradeHistorySection
            code={holding.code}
            name={holding.name || holding.code}
            groupId={holding.group_id}
            heldQuantity={Number(holding.quantity) || 0}
            currentPrice={currentPrice}
            onChanged={() => setDetailRefreshKey((k) => k + 1)}
          />
        ) : null}

        {opusLoading && !opus?.analysis ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 py-10 text-center">
            <div className="mx-auto mb-3 size-6 animate-spin rounded-full border-2 border-amber-600 border-t-transparent" />
            <div className="text-[13px] font-medium text-amber-800">{loadingMsg}</div>
          </div>
        ) : opusResuming && !opus?.analysis ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-8 text-center">
            <div className="mx-auto mb-3 size-6 animate-spin rounded-full border-2 border-amber-600 border-t-transparent" />
            <div className="mb-1 text-[14px] font-bold text-amber-900">백그라운드에서 진단 중</div>
            <p className="mx-auto max-w-xs text-[12px] leading-relaxed text-amber-700">
              화면이 꺼져도 서버에서 계속 진행됩니다. 완료되면 자동으로 표시됩니다.
            </p>
          </div>
        ) : needsGenerate && !opus?.analysis ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-8 text-center">
            <Sparkles className="mx-auto mb-2 size-6 text-amber-500" aria-hidden />
            <div className="mb-1 text-[14px] font-bold text-amber-900">AI 심층 진단</div>
            <p className="mx-auto mb-4 max-w-xs text-[12px] leading-relaxed text-amber-700">
              이 종목의 뉴스·공시·수급·재무·차트를 종합한 AI 진단을 실행합니다.
            </p>
            <button
              type="button"
              onClick={generateDiagnosis}
              className="inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-5 py-2 text-[13px] font-bold text-white transition-colors hover:bg-amber-600"
            >
              <Sparkles className="size-4" aria-hidden />
              AI 진단 실행
            </button>
          </div>
        ) : (
          <ProOpusSection analysis={opus?.analysis || ''} loading={opusLoading} model={opus?.model} />
        )}

        {holding?.code ? (
          <button
            type="button"
            onClick={() => navigate(`/pro/archive?code=${encodeURIComponent(holding.code)}`)}
            className="inline-flex items-center gap-1.5 self-start rounded-full border border-amber-200 bg-white px-4 py-1.5 text-[12px] font-semibold text-amber-700 transition-colors hover:bg-amber-50"
          >
            <Archive className="size-3.5" aria-hidden />
            과거 진단 보기
          </button>
        ) : null}
      </div>
    </div>
  )
}
