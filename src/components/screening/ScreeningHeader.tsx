import { RefreshCw, Play } from 'lucide-react'

export type ScreeningHeaderProps = {
  title?: string
  subtitle: string
  refreshedAt: Date
  onRefresh: () => void
  /** 캐시/신규 생성 구분 한 줄 (예: 오늘 분석 시각) */
  cacheHint?: string | null
  /** 개발용: ADMIN_SECRET 으로 강제 재생성 */
  showForceRefresh?: boolean
  forceBusy?: boolean
  onForceRefresh?: () => Promise<void>
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
}

export function ScreeningHeader({
  title = '섹터 스크리닝',
  subtitle,
  refreshedAt,
  onRefresh,
  cacheHint = null,
  showForceRefresh = false,
  forceBusy = false,
  onForceRefresh,
}: ScreeningHeaderProps) {
  return (
    <div className="rounded-2xl border border-default bg-card px-4 py-4 shadow-sm sm:px-6 sm:py-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="text-lg font-semibold tracking-tight text-primary sm:text-xl">{title}</h1>
            <span className="text-xs text-secondary sm:text-sm">마지막 갱신: {formatTime(refreshedAt)}</span>
          </div>
          {cacheHint ? <p className="text-xs text-secondary sm:text-sm">{cacheHint}</p> : null}
          <p className="text-sm font-medium text-secondary sm:text-base">{subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {showForceRefresh && onForceRefresh ? (
            <button
              type="button"
              disabled={forceBusy}
              onClick={() => void onForceRefresh()}
              className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-950 transition hover:bg-amber-100 disabled:opacity-50"
            >
              <Play className="size-4" strokeWidth={2} aria-hidden />
              {forceBusy ? '강제 갱신 중…' : '강제 갱신 (관리자)'}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-xl border border-default bg-neutral-bg px-4 py-2.5 text-sm font-medium text-primary transition hover:bg-app"
          >
            <RefreshCw className="size-4" strokeWidth={2} aria-hidden />
            새로고침
          </button>
        </div>
      </div>
    </div>
  )
}
