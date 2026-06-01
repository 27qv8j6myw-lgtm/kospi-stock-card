'use client'

import { Loader2 } from 'lucide-react'
import type { ProInvestProfileField } from '@/hooks/useProInvestProfile'
import type { ProInvestProfile } from '@/lib/proInvestProfile'
import { GOAL_OPTIONS, HORIZON_OPTIONS, RISK_OPTIONS } from '@/lib/proInvestProfile'

function optionClass(selected: boolean) {
  return selected
    ? 'border-amber-400 bg-amber-50 text-gray-900'
    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
}

type Props = {
  profile: ProInvestProfile
  loading: boolean
  saving: ProInvestProfileField | null
  error: string | null
  saveField: (field: ProInvestProfileField, value: string) => Promise<void>
  /** 드롭다운 등 좁은 영역 */
  compact?: boolean
  showHint?: boolean
}

export function ProInvestProfileForm({
  profile,
  loading,
  saving,
  error,
  saveField,
  compact = false,
  showHint = true,
}: Props) {
  if (loading) {
    return (
      <div
        className={`flex items-center justify-center text-gray-400 ${compact ? 'py-6' : 'py-8'}`}
      >
        <Loader2 className="size-5 animate-spin" aria-hidden />
      </div>
    )
  }

  const sectionTitle = compact
    ? 'mb-1.5 text-[12px] font-bold text-gray-800'
    : 'mb-2 text-[13px] font-bold text-gray-800'
  const btnClass = compact
    ? 'rounded-lg border px-2.5 py-1.5 text-left text-[11px] transition-colors'
    : 'rounded-xl border px-3 py-2 text-left text-[12px] transition-colors'

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      {showHint ? (
        <p className="text-[11px] leading-relaxed text-gray-500">
          AI 종목분석·채팅·진단에 반영됩니다. 리스크 경고는 프로필과 무관하게 제공됩니다.
        </p>
      ) : null}

      {error ? <p className="text-[11px] text-red-600">{error}</p> : null}

      {saving ? (
        <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
          <Loader2 className="size-3 animate-spin" aria-hidden />
          저장 중…
        </div>
      ) : null}

      <div>
        <div className={sectionTitle}>투자성향</div>
        <div className="flex flex-col gap-1.5">
          {RISK_OPTIONS.map((o) => (
            <button
              key={o.v}
              type="button"
              disabled={saving !== null}
              onClick={() => void saveField('risk_profile', o.v)}
              className={`${btnClass} ${optionClass(profile.risk_profile === o.v)}`}
            >
              <span className="font-semibold">{o.v}</span>
              <span className="text-gray-500"> · {o.d}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className={sectionTitle}>투자기간</div>
        <div className="flex flex-wrap gap-1.5">
          {HORIZON_OPTIONS.map((o) => (
            <button
              key={o.v}
              type="button"
              disabled={saving !== null}
              onClick={() => void saveField('invest_horizon', o.v)}
              className={`${btnClass} ${optionClass(profile.invest_horizon === o.v)}`}
            >
              {o.v} ({o.d})
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className={sectionTitle}>목표수익</div>
        <div className="flex flex-wrap gap-1.5">
          {GOAL_OPTIONS.map((o) => (
            <button
              key={o.v}
              type="button"
              disabled={saving !== null}
              onClick={() => void saveField('profit_goal', o.v)}
              className={`${btnClass} ${optionClass(profile.profit_goal === o.v)}`}
            >
              <span className="font-semibold">{o.v}</span>
              <span className="text-gray-500"> · {o.d}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
