import { Sparkles } from 'lucide-react'
import { MarkdownMessage } from '@/components/chat/MarkdownMessage'
import { ProProfileSetupHint } from '@/components/pro/ProProfileSetupHint'
import { formatModelLabel } from '@/lib/claudeModelDisplay'
import { ProSectionHeader } from './ProSectionHeader'

type Props = {
  analysis: string
  loading: boolean
  model?: string | null
}

export function ProOpusSection({ analysis, loading, model }: Props) {
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
        ) : (
          <div className="flex h-16 items-center justify-center">
            <div className="size-5 animate-spin rounded-full border-2 border-amber-600 border-t-transparent" />
          </div>
        )}
      </div>
    </section>
  )
}
