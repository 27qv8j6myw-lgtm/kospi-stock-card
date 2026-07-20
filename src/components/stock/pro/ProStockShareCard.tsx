import { forwardRef } from 'react'
import { MarkdownMessage } from '@/components/chat/MarkdownMessage'
import { formatModelLabel } from '@/lib/claudeModelDisplay'

export type ProStockShareCardProps = {
  displayName: string
  code: string
  market?: string | null
  sector?: string | null
  price: number | null
  changePct: number
  analysis: string
  model?: string | null
  generatedAt: Date
}

const COLOR = {
  ink: '#111827',
  sub: '#6b7280',
  faint: '#9ca3af',
  line: '#e5e7eb',
  up: '#dc2626',
  down: '#2563eb',
  brand: '#d97706',
  brandBg: '#fef3c7',
  brandInk: '#92400e',
} as const

function changeColor(pct: number): string {
  if (pct > 0) return COLOR.up
  if (pct < 0) return COLOR.down
  return COLOR.sub
}

function formatGeneratedAt(d: Date): string {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

/**
 * 화면 밖에서 캡처되는 Pro 종목카드 공유 전용 카드 (고정 너비 760px).
 * OPUS 종합분석 전문을 그대로 담는다.
 */
export const ProStockShareCard = forwardRef<HTMLDivElement, ProStockShareCardProps>(
  function ProStockShareCard(props, ref) {
    const { displayName, code, market, sector, price, changePct, analysis, model, generatedAt } =
      props

    const subtitleParts = [code, market, sector].filter(Boolean) as string[]
    const modelLabel = formatModelLabel(model)

    return (
      <div
        ref={ref}
        className="pro-share-capture"
        style={{
          width: 760,
          boxSizing: 'border-box',
          backgroundColor: '#ffffff',
          padding: 40,
          overflow: 'hidden',
          fontFamily:
            "'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif",
          color: COLOR.ink,
        }}
      >
        {/* 캡처 시 스크롤바가 이미지에 찍히지 않도록 서브트리 전체에서 숨김 */}
        <style>{`
          .pro-share-capture, .pro-share-capture * { scrollbar-width: none; -ms-overflow-style: none; }
          .pro-share-capture *::-webkit-scrollbar { display: none; width: 0; height: 0; }
          .pro-share-capture .overflow-x-auto { overflow: visible; }
        `}</style>

        {/* 슬림 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <span style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.02em' }}>
            {displayName}
          </span>
          <span
            style={{
              backgroundColor: COLOR.brandBg,
              color: COLOR.brandInk,
              fontSize: 16,
              fontWeight: 800,
              borderRadius: 999,
              padding: '2px 10px',
            }}
          >
            PRO
          </span>
        </div>
        {subtitleParts.length > 0 ? (
          <div style={{ fontSize: 16, color: COLOR.sub, marginBottom: 12 }}>
            {subtitleParts.join(' · ')}
          </div>
        ) : null}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 20 }}>
          <span
            style={{
              fontSize: 40,
              fontWeight: 800,
              letterSpacing: '-0.02em',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {price != null ? `${price.toLocaleString()}원` : '—'}
          </span>
          <span
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: changeColor(changePct),
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {changePct > 0 ? '+' : ''}
            {changePct.toFixed(2)}%
          </span>
        </div>

        {/* OPUS 종합분석 전문 */}
        <div
          style={{
            border: `1px solid ${COLOR.line}`,
            borderRadius: 16,
            padding: 24,
            marginBottom: 20,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: COLOR.brand }}>AI 종합 분석</span>
            {modelLabel ? (
              <span style={{ fontSize: 13, fontWeight: 600, color: COLOR.faint }}>{modelLabel}</span>
            ) : null}
          </div>
          {analysis.trim() ? (
            <MarkdownMessage content={analysis} />
          ) : (
            <div style={{ fontSize: 15, color: COLOR.sub }}>AI 분석을 생성하고 있습니다.</div>
          )}
        </div>

        {/* 푸터 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: `1px solid ${COLOR.line}`,
            paddingTop: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: COLOR.brand }}>SignAI</span>
            <span style={{ fontSize: 14, color: COLOR.faint }}>AI 주식 분석</span>
          </div>
          <div style={{ fontSize: 14, color: COLOR.faint, fontVariantNumeric: 'tabular-nums' }}>
            {formatGeneratedAt(generatedAt)}
          </div>
        </div>
        <div style={{ marginTop: 8, fontSize: 13, color: COLOR.faint }}>
          AI 분석은 투자 참고용이며 투자 결정의 책임은 본인에게 있습니다.
        </div>
      </div>
    )
  },
)
