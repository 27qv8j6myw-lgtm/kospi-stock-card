import { useMemo, useState } from 'react'
import { Activity, Target } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { IndicatorCard } from '../components/ui/IndicatorCard'
import { InsightCard } from '../components/ui/InsightCard'
import { MetricCard } from '../components/ui/MetricCard'
import { StatusBadge } from '../components/ui/StatusBadge'
import type { ChartPoint, Timeframe } from '../types/stock'
import { StockHero } from '../components/StockHero'
import { IndicatorGrid } from '../components/IndicatorGrid'
import type { IconColorToken, SeverityToken } from '../components/ui/iconTokens'
import { logicMetrics } from '../lib/mockData'
import { buildLogicIndicatorGridSlots } from '../lib/indicatorGridSlots'

function buildDemoChart(base: number): ChartPoint[] {
  const out: ChartPoint[] = []
  for (let i = 0; i < 32; i++) {
    const t = `D${i + 1}`
    const wobble = Math.sin(i / 4) * base * 0.012 + (i / 32) * base * 0.04
    out.push({ label: t, value: Math.round(base + wobble) })
  }
  return out
}

/**
 * 디자인 토큰 시각화 (라우트: /design-test).
 * 다크모드는 v2 예정 — 현재 라이트 전용.
 */
export default function DesignTestPage() {
  const [heroTf, setHeroTf] = useState<Timeframe>('1M')
  const heroDemoPts = useMemo(() => buildDemoChart(72_000), [])
  const mockLogicIndicatorSlots = useMemo(
    () => buildLogicIndicatorGridSlots(logicMetrics),
    [],
  )

  const swatches = [
    { label: 'bg-app', className: 'bg-app border border-default' },
    { label: 'bg-card', className: 'bg-card border border-default shadow-card' },
    { label: 'bg-card-elevated', className: 'bg-card-elevated border border-default shadow-card-elevated' },
    { label: 'bg-neutral-bg', className: 'bg-neutral-bg border border-default' },
  ]

  const textRow = [
    { label: 'text-primary', className: 'text-primary font-bold' },
    { label: 'text-secondary', className: 'text-secondary' },
    { label: 'text-tertiary', className: 'text-tertiary' },
  ]

  const status = [
    { label: 'success', box: 'bg-success-bg text-success-text' },
    { label: 'warning', box: 'bg-warning-bg text-warning-text' },
    { label: 'danger', box: 'bg-danger-bg text-danger-text' },
    { label: 'info', box: 'bg-info-bg text-info-text' },
    { label: 'neutral', box: 'bg-neutral-bg text-neutral-text' },
  ]

  const icons = [
    { label: 'blue', bg: 'bg-icon-blue-bg', fg: 'text-icon-blue' },
    { label: 'green', bg: 'bg-icon-green-bg', fg: 'text-icon-green' },
    { label: 'orange', bg: 'bg-icon-orange-bg', fg: 'text-icon-orange' },
    { label: 'purple', bg: 'bg-icon-purple-bg', fg: 'text-icon-purple' },
    { label: 'pink', bg: 'bg-icon-pink-bg', fg: 'text-icon-pink' },
    { label: 'yellow', bg: 'bg-icon-yellow-bg', fg: 'text-icon-yellow' },
    { label: 'cyan', bg: 'bg-icon-cyan-bg', fg: 'text-icon-cyan' },
    { label: 'rose', bg: 'bg-icon-rose-bg', fg: 'text-icon-rose' },
  ]

  const sizes = ['text-xxs', 'text-xs', 'text-sm', 'text-base', 'text-md', 'text-lg', 'text-xl', 'text-2xl', 'text-3xl']

  const iconColors: IconColorToken[] = ['blue', 'green', 'orange', 'purple', 'pink', 'yellow', 'cyan', 'rose']
  const severities: SeverityToken[] = ['normal', 'caution', 'warning', 'danger', 'info']

  const badgeStatuses = [
    'BUY',
    'BUY_AGGRESSIVE',
    'BUY_MORE',
    'HOLD',
    'WATCH',
    'TAKE_PROFIT',
    'REJECT',
  ] as const

  return (
    <div className="min-h-svh bg-app p-card-padding font-sans-kr text-base text-primary">
      <header className="mx-auto mb-section-gap max-w-4xl rounded-xl border border-default bg-card p-6 shadow-card">
        <h1 className="text-lg font-bold text-primary">Design tokens</h1>
        <p className="mt-2 text-sm text-secondary">
          tokens.css (:root) + index.css (@theme) + tailwind.config.ts. 폰트: Pretendard Variable + Inter + JetBrains Mono (index.html).
        </p>
        <p className="mt-1 text-xs text-tertiary">다크모드 v2 예정 · 현재 라이트만</p>
        <a href="/" className="mt-4 inline-block text-sm font-medium text-info-text underline">
          ← 앱으로
        </a>
      </header>

      <main className="mx-auto flex max-w-4xl flex-col gap-section-gap">
        <section className="rounded-xl border border-default bg-card p-6 shadow-card">
          <h2 className="text-md font-semibold text-primary">배경</h2>
          <div className="mt-4 grid gap-card-gap sm:grid-cols-2">
            {swatches.map((s) => (
              <div key={s.label} className={`rounded-lg p-4 ${s.className}`}>
                <span className="text-sm font-medium">{s.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-default bg-card p-6 shadow-card">
          <h2 className="text-md font-semibold text-primary">텍스트 위계</h2>
          <div className="mt-4 space-y-2">
            {textRow.map((t) => (
              <p key={t.label} className={t.className}>
                {t.label} — The quick brown fox 점프
              </p>
            ))}
            <p className="text-xl text-primary">
              숫자 Inter: <span className="font-sans-en font-bold">277,000</span>원
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-default bg-card p-6 shadow-card">
          <h2 className="text-md font-semibold text-primary">상태 색</h2>
          <div className="mt-4 flex flex-wrap gap-card-gap">
            {status.map((s) => (
              <div key={s.label} className={`rounded-lg px-4 py-3 text-sm font-medium ${s.box}`}>
                {s.label}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-default bg-card p-6 shadow-card">
          <h2 className="text-md font-semibold text-primary">아이콘 파스텔</h2>
          <div className="mt-4 flex flex-wrap gap-card-gap">
            {icons.map((i) => (
              <div key={i.label} className={`flex size-12 items-center justify-center rounded-full ${i.bg}`}>
                <span className={`text-xs font-bold ${i.fg}`}>{i.label[0]}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-default bg-card p-6 shadow-card">
          <h2 className="text-md font-semibold text-primary">폰트 크기</h2>
          <div className="mt-4 space-y-2">
            {sizes.map((c) => (
              <p key={c} className={`${c} text-primary`}>
                {c} — 본문 샘플 Aa 가나다 0123
              </p>
            ))}
          </div>
          <p className="mt-4 font-mono text-xs text-secondary">font-mono — log_line_001</p>
        </section>

        <section className="rounded-xl border border-default bg-card p-6 shadow-card">
          <h2 className="text-md font-semibold text-primary">UI 카드 (Indicator × severity)</h2>
          <p className="mt-2 text-xs text-secondary">
            8가지 iconColor × 5가지 severity. 동일 레이아웃·고정 높이 96px.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-xs">
              <thead>
                <tr>
                  <th className="border border-light bg-neutral-bg p-2 font-semibold text-secondary">iconColor</th>
                  {severities.map((s) => (
                    <th key={s} className="border border-light bg-neutral-bg p-2 font-semibold text-secondary">
                      {s}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {iconColors.map((c) => (
                  <tr key={c}>
                    <td className="border border-light p-2 font-medium text-primary">{c}</td>
                    {severities.map((sev) => (
                      <td key={`${c}-${sev}`} className="border border-light p-1 align-top">
                        <IndicatorCard
                          icon={<Target className="size-[18px]" aria-hidden />}
                          iconColor={c}
                          label="실행"
                          primary="11/100"
                          sub="샘플"
                          severity={sev}
                          descriptionKey="execution"
                          tooltipColumnIndex={1}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl border border-default bg-card p-6 shadow-card">
          <h2 className="text-md font-semibold text-primary">StatusBadge · MetricCard · InsightCard</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {badgeStatuses.map((s) => (
              <StatusBadge key={s} status={s} size="sm" />
            ))}
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <MetricCard
              icon={<Activity aria-hidden />}
              iconColor="green"
              label="추천 비중"
              value="14%"
              meta="약 4주, $1,369"
            />
            <MetricCard
              icon={<Target aria-hidden />}
              iconColor="rose"
              label="1R 손실금"
              value="-$31"
              valueColor="negative"
            />
            <MetricCard
              icon={<Activity aria-hidden />}
              iconColor="blue"
              label="최대 비중"
              value="15%"
            />
          </div>
          <div className="mt-6">
            <InsightCard
              title="지금은 보류가 더 좋은 구간"
              subtitle="일부 점수는 유지되나 진입 근거는 아직 부족합니다."
              headerTrailing={<StatusBadge status="WATCH" size="sm" />}
              rows={[
                {
                  icon: <span aria-hidden>★</span>,
                  label: 'Final Grade',
                  value: <span className="font-sans-en">C</span>,
                },
                {
                  icon: <span aria-hidden>👁</span>,
                  label: 'Strategy',
                  value: <StatusBadge status="WATCH" size="sm" pill className="scale-90" />,
                },
                {
                  icon: <span aria-hidden>⊖</span>,
                  label: 'Entry Stage',
                  value: <StatusBadge status="REJECT" size="sm" pill className="scale-90" />,
                },
              ]}
            />
          </div>
        </section>

        <section className="rounded-xl border border-default bg-card p-6 shadow-card">
          <h2 className="text-md font-semibold text-primary">Before / After (로직 지표 카드)</h2>
          <div className="mt-4 grid gap-6 md:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-tertiary">Before</p>
              <Card variant="flat" padding="md" radius="lg" className="mt-2 font-mono text-[10px] leading-relaxed text-secondary">
                {`<article className="... h-[120px] ... shadow-sm">\n  <span className="absolute ... w-1 accentBar" />\n  <Icon /> title ...\n</article>`}
              </Card>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-tertiary">After</p>
              <div className="mt-2 max-w-[220px]">
                <IndicatorCard
                  icon={<Activity aria-hidden />}
                  iconColor="blue"
                  label="구조"
                  primary="75/100"
                  sub="차오르는 달"
                  severity="warning"
                  descriptionKey="structure"
                  tooltipColumnIndex={1}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-default bg-app p-6 shadow-card">
          <h2 className="text-md font-semibold text-primary">IndicatorGrid (mockData · 16슬롯)</h2>
          <p className="mt-1 text-xs text-secondary">
            로직 지표 16칸 정렬. 우상단 위험도 텍스트·인포 툴팁·보더 토큰(border-light) 확인.
          </p>
          <div className="mt-4 max-w-5xl rounded-lg border border-dashed border-default/70 p-3">
            <IndicatorGrid slots={mockLogicIndicatorSlots} subtitle="데스크탑 폭" />
          </div>
          <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-tertiary">모바일 폭</p>
          <div className="mx-auto mt-2 max-w-sm rounded-lg border border-dashed border-default/70 p-3">
            <IndicatorGrid slots={mockLogicIndicatorSlots} />
          </div>
        </section>

        <section className="rounded-xl border border-default bg-app p-6 shadow-card">
          <h2 className="text-md font-semibold text-primary">StockHero (삼성전자 테스트 케이스)</h2>
          <p className="mt-1 text-xs text-secondary">
            데스크탑 폭(max-w-5xl)과 모바일 폭(max-w-sm)에서 동일 컴포넌트 렌더링.
          </p>
          <div className="mt-6 max-w-5xl rounded-lg border border-dashed border-default/70 p-3">
            <StockHero
              stock={{
                code: '005930',
                name: '삼성전자',
                subtitle: '005930 · KOSPI200 · 전기·전자',
                market: 'KOSPI200',
                price: 72_000,
                change: 800,
                changePct: 1.12,
              }}
              insight={{
                title: '지금은 익절 우선 구간',
                finalGrade: 'B',
                finalGradeTone: 'caution',
                strategy: 'TAKE_PROFIT',
                entryStageDisplay: '익절',
                entryStageEmphasis: 'danger',
                reason: 'RSI 84 + ATR 이격 7.3 동시 임계 초과',
              }}
              chart={{
                timeframe: heroTf,
                onTimeframeChange: setHeroTf,
                data: heroDemoPts,
                currentPrice: 72_000,
                dayChange: 800,
                status: 'ok',
              }}
            />
          </div>
          <p className="mt-8 text-xs font-semibold uppercase tracking-wide text-tertiary">모바일 폭</p>
          <div className="mx-auto mt-2 max-w-sm rounded-lg border border-dashed border-default/70 p-3">
            <StockHero
              stock={{
                code: '005930',
                name: '삼성전자',
                subtitle: '005930 · KOSPI200 · 전기·전자',
                market: 'KOSPI200',
                price: 72_000,
                change: 800,
                changePct: 1.12,
              }}
              insight={{
                title: '지금은 익절 우선 구간',
                finalGrade: 'B',
                finalGradeTone: 'caution',
                strategy: 'TAKE_PROFIT',
                entryStageDisplay: '익절',
                entryStageEmphasis: 'danger',
                reason: 'RSI 84 + ATR 이격 7.3 동시 임계 초과',
              }}
              chart={{
                timeframe: heroTf,
                onTimeframeChange: setHeroTf,
                data: heroDemoPts,
                currentPrice: 72_000,
                dayChange: 800,
                status: 'ok',
              }}
            />
          </div>
        </section>

        <section className="rounded-xl border border-default bg-card p-6 shadow-card">
          <h2 className="text-md font-semibold text-primary">간격 · 라운딩 · 보더 · 그림자</h2>
          <div className="mt-4 flex flex-wrap gap-card-gap">
            <div className="rounded-sm border border-light bg-neutral-bg px-3 py-2 text-xs">radius-sm</div>
            <div className="rounded-md border border-default bg-neutral-bg px-3 py-2 text-xs">radius-md</div>
            <div className="rounded-lg border border-medium bg-neutral-bg px-3 py-2 text-xs">radius-lg</div>
            <div className="rounded-xl border border-default bg-neutral-bg px-3 py-2 text-xs">radius-xl</div>
            <div className="rounded-2xl border border-default bg-neutral-bg px-3 py-2 text-xs">radius-2xl</div>
          </div>
          <div className="mt-6 flex flex-wrap gap-6">
            <div className="rounded-lg bg-card p-4 shadow-sm">shadow-sm</div>
            <div className="rounded-lg bg-card p-4 shadow-md">shadow-md</div>
            <div className="rounded-lg bg-card p-4 shadow-lg">shadow-lg</div>
            <div className="rounded-lg bg-card p-4 shadow-card">shadow-card</div>
            <div className="rounded-lg bg-card p-4 shadow-hover">shadow-hover</div>
          </div>
        </section>
      </main>
    </div>
  )
}
