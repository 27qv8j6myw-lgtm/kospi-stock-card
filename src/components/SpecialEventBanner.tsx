import { AlertTriangle } from 'lucide-react'

type SpecialEventBannerProps = {
  messages: string[]
}

/** KIS 시세·공시 키워드 기반 특이 알림 (거래정지·투자주의 등) */
export function SpecialEventBanner({ messages }: SpecialEventBannerProps) {
  if (!messages.length) return null
  return (
    <div
      className="flex gap-2 border-b border-rose-200 bg-rose-50 px-6 py-2.5 text-xs text-rose-950 sm:px-8"
      role="status"
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-rose-600" aria-hidden />
      <ul className="min-w-0 list-inside list-disc space-y-0.5 leading-snug">
        {messages.map((m) => (
          <li key={m}>{m}</li>
        ))}
      </ul>
    </div>
  )
}
