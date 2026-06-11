'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { authFetch } from '@/lib/api'
import { apiUrl } from '@/lib/apiBase'

type Props = {
  code: string
  name: string
  groupId: string
  groupName?: string
  /** 현재 보유 수량 (매도 가능 한도 표시용) */
  heldQuantity?: number
  /** 가격 입력 프리필 (현재가) */
  defaultPrice?: number
  initialSide?: 'buy' | 'sell'
  onClose: () => void
  onSaved: () => void
}

function todayYmd(): string {
  const now = new Date()
  const seoul = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
  return seoul
}

export function TradeModal({
  code,
  name,
  groupId,
  groupName,
  heldQuantity,
  defaultPrice,
  initialSide = 'buy',
  onClose,
  onSaved,
}: Props) {
  const [side, setSide] = useState<'buy' | 'sell'>(initialSide)
  const [quantity, setQuantity] = useState('')
  const [price, setPrice] = useState(
    defaultPrice && defaultPrice > 0 ? String(Math.round(defaultPrice)) : '',
  )
  const [tradedAt, setTradedAt] = useState(todayYmd())
  const [memo, setMemo] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const qtyNum = parseFloat(quantity)
  const priceNum = parseFloat(price)
  const valid =
    Number.isFinite(qtyNum) &&
    qtyNum > 0 &&
    Number.isFinite(priceNum) &&
    priceNum > 0 &&
    (side === 'buy' || heldQuantity == null || qtyNum <= heldQuantity)

  const save = async () => {
    if (!valid || saving) return
    setSaving(true)
    setError(null)
    try {
      const r = await authFetch(apiUrl('/api/pro-trades'), {
        method: 'POST',
        body: JSON.stringify({
          code,
          name,
          groupId,
          side,
          quantity: qtyNum,
          price: priceNum,
          tradedAt,
          memo: memo.trim() || null,
        }),
      })
      if (r.ok) {
        onSaved()
      } else {
        const d = (await r.json().catch(() => ({}))) as { error?: string }
        setError(d.error || '저장 실패')
      }
    } catch {
      setError('저장 요청에 실패했습니다')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-5"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="trade-modal-title"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 id="trade-modal-title" className="min-w-0 truncate text-[16px] font-bold text-gray-900">
            {name}
            {groupName ? (
              <span className="ml-1.5 text-[11px] font-medium text-gray-400">{groupName}</span>
            ) : null}
          </h3>
          <button type="button" onClick={onClose} aria-label="닫기">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <div className="mb-4 flex gap-1 rounded-lg bg-gray-100 p-1">
          <button
            type="button"
            onClick={() => setSide('buy')}
            className={`flex-1 rounded-md py-2 text-[13px] font-bold ${
              side === 'buy' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500'
            }`}
          >
            매수
          </button>
          <button
            type="button"
            onClick={() => setSide('sell')}
            className={`flex-1 rounded-md py-2 text-[13px] font-bold ${
              side === 'sell' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'
            }`}
          >
            매도
          </button>
        </div>

        <label className="mb-1 block text-[12px] font-semibold text-gray-500">
          수량
          {side === 'sell' && heldQuantity != null ? (
            <span className="ml-1 font-normal text-gray-400">
              (보유 {Number(heldQuantity).toLocaleString('ko-KR')}주)
            </span>
          ) : null}
        </label>
        <input
          type="number"
          inputMode="numeric"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          placeholder="10"
          className="mb-3 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-[14px] tabular-nums"
        />

        <label className="mb-1 block text-[12px] font-semibold text-gray-500">
          {side === 'buy' ? '매수 가격 (원)' : '매도 가격 (원)'}
        </label>
        <input
          type="number"
          inputMode="numeric"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="195000"
          className="mb-3 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-[14px] tabular-nums"
        />

        <label className="mb-1 block text-[12px] font-semibold text-gray-500">거래일</label>
        <input
          type="date"
          value={tradedAt}
          max={todayYmd()}
          onChange={(e) => setTradedAt(e.target.value)}
          className="mb-3 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-[14px]"
        />

        <label className="mb-1 block text-[12px] font-semibold text-gray-500">메모 (선택)</label>
        <input
          type="text"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="분할 매수 1차"
          maxLength={200}
          className="mb-4 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-[14px]"
        />

        {side === 'sell' && heldQuantity != null && Number.isFinite(qtyNum) && qtyNum > heldQuantity ? (
          <p className="mb-3 text-[12px] text-red-600">보유 수량보다 많이 매도할 수 없습니다</p>
        ) : null}
        {error ? <p className="mb-3 text-[12px] text-red-600">{error}</p> : null}

        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || !valid}
          className={`w-full rounded-lg py-2.5 text-[14px] font-bold text-white disabled:opacity-50 ${
            side === 'buy' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {saving ? '저장 중...' : side === 'buy' ? '매수 기록' : '매도 기록'}
        </button>
        <p className="mt-2 text-center text-[10px] leading-relaxed text-gray-400">
          {side === 'buy'
            ? '기록 시 보유 수량·평단가가 자동 갱신됩니다'
            : '기록 시 수량 차감, 실현손익이 그룹에 자동 반영됩니다'}
        </p>
      </div>
    </div>
  )
}
