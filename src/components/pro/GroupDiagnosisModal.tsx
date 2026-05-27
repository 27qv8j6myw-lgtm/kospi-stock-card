'use client'

import { X, Sparkles } from 'lucide-react'
import { MarkdownMessage } from '@/components/chat/MarkdownMessage'

type Props = {
  groupName: string
  loading: boolean
  analysis: string | null
  onClose: () => void
}

export function GroupDiagnosisModal({ groupName, loading, analysis, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="group-diagnosis-title"
      >
        <div className="sticky top-0 flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-5 py-4">
          <Sparkles size={20} className="text-amber-600" strokeWidth={1.8} aria-hidden />
          <span id="group-diagnosis-title" className="text-[16px] font-bold text-amber-900">
            {groupName} 그룹 진단
          </span>
          <button type="button" onClick={onClose} className="ml-auto" aria-label="닫기">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <div className="p-5">
          {loading ? (
            <div className="py-12 text-center">
              <div className="text-[13px] font-medium text-amber-700">종목 조사 + 종합 분석 중...</div>
              <div className="mt-1 text-[11px] text-gray-400">1~2분 소요될 수 있습니다</div>
            </div>
          ) : analysis ? (
            <MarkdownMessage content={analysis} />
          ) : (
            <div className="py-8 text-center text-[13px] text-gray-400">분석에 실패했습니다</div>
          )}
        </div>
      </div>
    </div>
  )
}
