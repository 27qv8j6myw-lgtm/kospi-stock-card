'use client'

import { X } from 'lucide-react'

type InfoModalProps = {
  title: string
  content: string
  onClose: () => void
}

export function InfoModal({ title, content, onClose }: InfoModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="info-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 id="info-modal-title" className="text-[15px] font-bold text-gray-900">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 hover:bg-gray-100"
            aria-label="닫기"
          >
            <X size={18} className="text-gray-500" strokeWidth={2} />
          </button>
        </div>

        <p className="text-[13px] leading-relaxed whitespace-pre-line text-gray-700">{content}</p>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-lg bg-gray-900 py-2 text-[13px] font-bold text-white hover:bg-gray-800"
        >
          확인
        </button>
      </div>
    </div>
  )
}
