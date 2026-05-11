import { Sparkles } from 'lucide-react'
import type { DetailedInvestmentMemoResult, NewsItem, NewsSentiment } from '../types/aiBriefing'
import { sortNewsByDateDesc } from '../lib/newsAnalyzer'

type AIBriefingPanelProps = {
  memo: DetailedInvestmentMemoResult | null
  news: NewsItem[]
  loading?: boolean
  briefingSource?: 'gpt' | 'local'
}

function sentimentBadgeClass(s: NewsSentiment) {
  if (s === 'positive') return 'border-rose-200 bg-rose-50 text-rose-700'
  if (s === 'negative') return 'border-sky-200 bg-sky-50 text-sky-700'
  return 'border-slate-200 bg-slate-100 text-slate-600'
}

function sentimentLabel(s: NewsSentiment) {
  if (s === 'positive') return '호재'
  if (s === 'negative') return '부담'
  return '중립'
}

const categoryLabel: Record<string, string> = {
  earnings: '실적',
  target: '목표가',
  order: '수주',
  macro: '매크로',
  supply: '수급',
  sector: '섹터',
  valuation: '밸류',
}

function toneChip(tone: DetailedInvestmentMemoResult['tone']) {
  if (tone === 'bullish') return 'border-emerald-200 bg-emerald-50 text-emerald-800'
  if (tone === 'caution') return 'border-amber-200 bg-amber-50 text-amber-900'
  return 'border-slate-200 bg-slate-100 text-slate-700'
}

function toneLabel(tone: DetailedInvestmentMemoResult['tone']) {
  if (tone === 'bullish') return '상방 요인 우위'
  if (tone === 'caution') return '변동·리스크 점검'
  return '중립'
}

const sectionLabels = [
  '1. 가격·차트 상황',
  '2. 최근 주가 트리거',
  '3. 펀더멘털·컨센서스',
  '4. 수급·리스크',
  '5. 지금 전략',
]

export function AIBriefingPanel({ memo, news, loading, briefingSource }: AIBriefingPanelProps) {
  const sorted = sortNewsByDateDesc(news)
  const tone = memo?.tone ?? 'neutral'
  const loadingDots = (
    <span className="inline-flex items-center gap-1">
      <span>로딩중</span>
      <span className="size-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:0ms]" />
      <span className="size-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:120ms]" />
      <span className="size-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:240ms]" />
    </span>
  )

  return (
    <section className="border-t border-slate-200 bg-white px-6 py-5 sm:px-8 sm:py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-100 to-cyan-100 ring-1 ring-violet-200/60">
            <Sparkles className="size-3.5 text-violet-600" aria-hidden />
          </span>
          <div>
            <h3 className="text-[15px] font-bold tracking-tight text-slate-900 sm:text-base">AI 투자 메모</h3>
            <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
              숫자·수급·컨센서스를 반영한 요약입니다.{' '}
              {briefingSource === 'gpt'
                ? 'OpenAI(GPT)로 생성되었습니다.'
                : briefingSource === 'local'
                  ? '로컬 규칙으로 생성되었으며, GPT 연결 시에도 동일한 형식을 사용합니다.'
                  : '로컬 또는 GPT로 제공됩니다.'}
            </p>
          </div>
        </div>
        <span
          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${toneChip(tone)}`}
        >
          {toneLabel(tone)}
        </span>
      </div>

      <div
        className={`mt-4 space-y-5 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm sm:p-5 ${loading ? 'opacity-70' : ''}`}
      >
        <div>
          <p className="text-sm font-extrabold uppercase tracking-[0.08em] text-violet-700 sm:text-base">
            Executive Summary
          </p>
          <div className="mt-2 rounded-xl border-2 border-violet-200 bg-violet-50/90 px-3.5 py-3 text-[13px] font-medium leading-relaxed text-slate-900 shadow-sm">
            {memo ? memo.strategyComment : loadingDots}
          </div>
        </div>

        {(memo?.paragraphs ?? []).map((p, i) => (
          <div key={i} className={i > 0 ? 'border-t border-slate-200 pt-4' : ''}>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {sectionLabels[i] ?? `문단 ${i + 1}`}
            </p>
            <p className="mt-2 whitespace-pre-line text-[13px] leading-[1.65] text-slate-800">{p}</p>
          </div>
        ))}
        {!memo ? (
          <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-500">
            {loadingDots}
          </div>
        ) : null}

        <div className="border-t border-slate-200 pt-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">핵심 수치·체크</p>
          {memo ? (
            <ul className="mt-2 list-inside list-disc space-y-1.5 text-[13px] leading-relaxed text-slate-800 marker:text-slate-400">
              {memo.keyPoints.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-slate-500">{loadingDots}</p>
          )}
        </div>

        <div className="border-t border-slate-200 pt-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">리스크</p>
          {memo ? (
            <ul className="mt-2 list-inside list-disc space-y-1.5 text-[13px] leading-relaxed text-sky-950 marker:text-sky-500">
              {memo.risks.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-slate-500">{loadingDots}</p>
          )}
        </div>

        <div className="border-t border-slate-200 pt-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">참고 뉴스</p>
          <div className="mt-3 space-y-2">
            {sorted.slice(0, 6).map((n) => (
              <article
                key={`${n.publishedAt}-${n.title}`}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold ${sentimentBadgeClass(n.sentiment)}`}
                  >
                    {sentimentLabel(n.sentiment)}
                  </span>
                  <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] text-slate-600">
                    {categoryLabel[n.category] ?? n.category}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {n.publishedAt} · {n.source}
                  </span>
                </div>
                <p className="mt-1.5 text-xs font-medium leading-snug text-slate-900">{n.title}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-600">{n.summary}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
