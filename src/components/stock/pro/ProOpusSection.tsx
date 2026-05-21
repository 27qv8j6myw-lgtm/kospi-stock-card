import { Sparkles } from 'lucide-react'
import { MarkdownMessage } from '@/components/chat/MarkdownMessage'
import { PRO_ICON } from '@/lib/proStockDesign'

type Props = {
  analysis: string
  loading: boolean
}

export function ProOpusSection({ analysis, loading }: Props) {
  return (
    <section className="border-b border-amber-200 bg-amber-50 px-5 py-4">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles {...PRO_ICON} className="text-amber-600" />
        <span className="text-[16px] font-bold text-amber-900">OPUS 종합 분석</span>
        {loading ? (
          <span className="ml-auto text-[12px] text-amber-700">분석 중...</span>
        ) : null}
      </div>

      <div className="rounded-md border border-gray-200 bg-white p-3">
        {analysis ? (
          <MarkdownMessage content={analysis} />
        ) : (
          <div className="flex h-16 items-center justify-center">
            <div className="size-5 animate-spin rounded-full border-2 border-amber-600 border-t-transparent" />
          </div>
        )}
      </div>
    </section>
  )
}
