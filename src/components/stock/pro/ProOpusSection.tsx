import { RotateCw, Sparkles } from 'lucide-react'
import { MarkdownMessage } from '@/components/chat/MarkdownMessage'
import { ProProfileSetupHint } from '@/components/pro/ProProfileSetupHint'
import { formatModelLabel } from '@/lib/claudeModelDisplay'
import { ProSectionHeader } from './ProSectionHeader'

type Props = {
  analysis: string
  loading: boolean
  model?: string | null
  /** 저장된 분석을 재사용한 경우의 생성 시각 */
  generatedAt?: string | null
  /** 있으면 "다시 분석" 버튼 노출 (캐시 무시 재생성) */
  onRegenerate?: () => void
  /** 백그라운드에서 분석이 진행 중 — 복귀 시 자동 표시 예정 */
  resuming?: boolean
}

function formatGeneratedAt(iso: string): string {
  return new Date(iso).toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function ProOpusSection({
  analysis,
  loading,
  model,
  generatedAt,
  onRegenerate,
  resuming,
}: Props) {
  const modelLabel = formatModelLabel(model)
  return (
    <section className="border-b border-amber-200 bg-amber-50 px-5 py-4">
      <ProSectionHeader
        icon={<Sparkles size={24} className="text-amber-600" strokeWidth={1.8} />}
        title="AI 종합 분석"
        titleClassName="text-[18px] font-bold text-amber-900"
        meta={loading ? '분석 중...' : modelLabel || undefined}
      />

      <div className="rounded-md border border-gray-200 bg-white p-3">
        {analysis ? (
          <>
            <MarkdownMessage content={analysis} />
            <ProProfileSetupHint />
          </>
        ) : resuming ? (
          <div className="py-4 text-center text-[12px] leading-relaxed text-amber-800">
            <div className="mx-auto mb-2 size-5 animate-spin rounded-full border-2 border-amber-600 border-t-transparent" />
            백그라운드에서 분석 중입니다. 화면이 꺼져도 계속 진행되며 완료되면 자동으로 표시됩니다.
          </div>
        ) : (
          <div className="flex h-16 items-center justify-center">
            <div className="size-5 animate-spin rounded-full border-2 border-amber-600 border-t-transparent" />
          </div>
        )}
      </div>

      {!loading && analysis && (generatedAt || onRegenerate) ? (
        <div className="mt-2 flex items-center gap-2">
          {generatedAt ? (
            <span className="text-[11px] tabular-nums text-amber-700">
              {formatGeneratedAt(generatedAt)} 분석 결과
            </span>
          ) : null}
          {onRegenerate ? (
            <button
              type="button"
              onClick={onRegenerate}
              className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-amber-800 hover:bg-amber-100"
            >
              <RotateCw size={12} strokeWidth={2.2} aria-hidden />
              다시 분석
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
