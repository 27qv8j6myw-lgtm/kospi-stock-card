'use client'

import { useState } from 'react'
import {
  Activity,
  Loader2,
  Minus,
  RefreshCw,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { Card } from '../ui/Card'
import { apiUrl } from '@/lib/apiBase'

type Scenario = {
  name: string
  probability: number
  priceRange: string
  duration: string
  rationale: string
}

type AnalysisResult = {
  scenarios: Scenario[]
  recommendation: {
    action: string
    splitPrices: number[]
    rationale: string
  }
  source?: string
}

type Props = {
  stockCode: string
  stockName?: string
}

/** Vercel·일부 프록시에서 `/api/ai/...` 중첩 경로 404 방지 — `/api/quote` 와 동일 단일 세그먼트 */
const AI_SCENARIO_API = '/api/ai-stock-scenario'

function scenarioIcon(name: string) {
  const s = String(name || '')
  if (s.includes('상승') || s.includes('지속')) {
    return <TrendingUp className="size-5 shrink-0 text-success-text" strokeWidth={2} aria-hidden />
  }
  if (s.includes('반전')) {
    return <TrendingDown className="size-5 shrink-0 text-danger-text" strokeWidth={2} aria-hidden />
  }
  if (s.includes('조정')) {
    return <Activity className="size-5 shrink-0 text-warning-text" strokeWidth={2} aria-hidden />
  }
  if (s.includes('횡보')) {
    return <Minus className="size-5 shrink-0 text-secondary" strokeWidth={2} aria-hidden />
  }
  return <Sparkles className="size-5 shrink-0 text-info-text" strokeWidth={2} aria-hidden />
}

function actionPillClass(action: string): string {
  if (/신규매수|적극/.test(action)) return 'bg-success-bg text-success-text'
  if (/분할매수/.test(action)) return 'bg-info-bg text-info-text'
  if (/조정대기|관망|대기/.test(action)) return 'bg-warning-bg text-warning-text'
  if (/회피/.test(action)) return 'bg-danger-bg text-danger-text'
  if (/보유/.test(action)) return 'bg-neutral-bg text-secondary'
  return 'bg-neutral-bg text-secondary'
}

function ScenarioRow({ scenario }: { scenario: Scenario }) {
  return (
    <div className="flex gap-3 rounded-lg border border-light bg-card px-3 py-3">
      <div className="mt-0.5 shrink-0">{scenarioIcon(scenario.name)}</div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-sm font-semibold text-primary">{scenario.name}</span>
          <span className="font-sans-en text-sm font-bold tabular-nums text-primary">
            {scenario.probability}%
          </span>
        </div>
        <p className="mt-1 text-xs text-secondary">
          {scenario.priceRange} · {scenario.duration}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-primary">{scenario.rationale}</p>
      </div>
    </div>
  )
}

export function AiScenarioCard({ stockCode, stockName }: Props) {
  const [data, setData] = useState<AnalysisResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const analyze = async () => {
    setLoading(true)
    setError(null)
    try {
      const code = String(stockCode || '')
        .replace(/\D/g, '')
        .padStart(6, '0')
        .slice(0, 6)
      const q = new URLSearchParams({ code })
      const url = `${apiUrl(AI_SCENARIO_API)}?${q}`
      const res = await fetch(url)

      if (!res.ok) {
        if (res.status === 404) {
          throw new Error('AI 분석 라우트를 찾을 수 없습니다(404). 서버 배포·프록시에 /api/ai-stock-scenario 등록 여부를 확인하세요.')
        }
        const text = await res.text()
        let errMsg = `HTTP ${res.status}`
        try {
          const j = JSON.parse(text) as { error?: string }
          if (j.error) errMsg = j.error
        } catch {
          if (text.length > 0 && text.length < 200) errMsg = `${errMsg}: ${text}`
        }
        throw new Error(errMsg)
      }

      const text = await res.text()
      let json: { error?: string } & Partial<AnalysisResult>
      try {
        json = JSON.parse(text) as { error?: string } & Partial<AnalysisResult>
      } catch {
        throw new Error('응답이 JSON이 아닙니다. 서버·프록시 설정을 확인하세요.')
      }
      if (json.error) throw new Error(json.error)
      if (!Array.isArray(json.scenarios) || !json.recommendation) {
        throw new Error('응답 형식 오류')
      }
      setData(json as AnalysisResult)
    } catch (e: unknown) {
      console.error('[AiScenarioCard]', e)
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  const reset = () => {
    setData(null)
    setError(null)
  }

  if (!data && !loading && !error) {
    return (
      <Card variant="elevated" padding="lg" radius="xl" className="border border-light">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-primary">
              <Sparkles className="size-5 shrink-0 text-info-text" strokeWidth={2} aria-hidden />
              <h2 className="text-lg font-bold">AI 시나리오 분석</h2>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-secondary">
              매크로·컨센·기술 지표를 종합한 4가지 시나리오와 분할 매수 가격을 제시합니다.
              {stockName ? (
                <>
                  {' '}
                  <span className="font-medium text-primary">{stockName}</span>({stockCode})
                </>
              ) : null}
            </p>
            <p className="mt-2 text-xs text-tertiary">
              Sonnet 4.5 · 종목당 약 $0.02 · 서버 1시간 캐시
            </p>
          </div>
          <button
            type="button"
            onClick={analyze}
            className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-lg bg-info-text px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 sm:min-h-0"
          >
            <Sparkles className="size-4" aria-hidden />
            AI 분석 실행
          </button>
        </div>
      </Card>
    )
  }

  if (loading) {
    return (
      <Card variant="elevated" padding="lg" radius="xl" className="border border-light">
        <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
          <Loader2 className="size-10 animate-spin text-info-text" aria-hidden />
          <p className="text-sm font-semibold text-primary">시나리오 분석 중…</p>
          <p className="text-xs text-secondary">10~20초 소요될 수 있습니다</p>
        </div>
      </Card>
    )
  }

  if (error) {
    return (
      <Card variant="elevated" padding="lg" radius="xl" className="border border-light">
        <p className="text-sm font-medium text-danger-text">AI 분석 실패: {error}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={analyze}
            className="rounded-lg border border-default bg-card px-4 py-2 text-sm font-semibold text-primary hover:bg-neutral-bg"
          >
            다시 시도
          </button>
          <button
            type="button"
            onClick={reset}
            className="rounded-lg px-4 py-2 text-sm font-medium text-secondary hover:text-primary"
          >
            초기화
          </button>
        </div>
      </Card>
    )
  }

  if (!data) return null

  const rec = data.recommendation
  const prices = Array.isArray(rec.splitPrices) ? rec.splitPrices : []

  return (
    <Card variant="elevated" padding="lg" radius="xl" className="border border-light">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-5 shrink-0 text-info-text" strokeWidth={2} aria-hidden />
          <h2 className="text-lg font-bold text-primary">AI 시나리오 분석</h2>
          {data.source === 'cache' ? (
            <span className="rounded-full bg-neutral-bg px-2 py-0.5 text-xxs font-medium text-secondary">
              캐시
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={analyze}
          className="inline-flex items-center gap-1.5 rounded-lg border border-default bg-card px-3 py-1.5 text-xs font-semibold text-primary hover:bg-neutral-bg"
        >
          <RefreshCw className="size-3.5" aria-hidden />
          새로고침
        </button>
      </div>

      <div className="mt-4 space-y-2">
        {data.scenarios.map((s, idx) => (
          <ScenarioRow key={`${s.name}-${idx}`} scenario={s} />
        ))}
      </div>

      <div className="mt-6 rounded-xl border border-light bg-neutral-bg/60 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-primary">종합 권고</span>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${actionPillClass(rec.action)}`}
          >
            {rec.action}
          </span>
        </div>

        {prices.length > 0 ? (
          <div className="mt-3">
            <p className="text-xs font-semibold text-secondary">AI 추천 분할 매수 가격</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {prices.slice(0, 3).map((price, idx) => (
                <div
                  key={idx}
                  className="rounded-lg border border-light bg-card px-2 py-2 text-center"
                >
                  <p className="text-xxs font-medium text-secondary">{idx + 1}차</p>
                  <p className="mt-1 font-sans-en text-sm font-semibold tabular-nums text-primary">
                    {price != null && Number.isFinite(Number(price))
                      ? `${Math.round(Number(price)).toLocaleString('ko-KR')}원`
                      : '—'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {rec.rationale ? (
          <p className="mt-3 text-sm leading-relaxed text-primary">{rec.rationale}</p>
        ) : null}
      </div>
    </Card>
  )
}
