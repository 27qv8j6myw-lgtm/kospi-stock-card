'use client'

import { useCallback, useEffect, useState } from 'react'
import { ReceiptText, Trash2 } from 'lucide-react'
import { authFetch } from '@/lib/api'
import { apiUrl } from '@/lib/apiBase'
import { TradeModal } from './TradeModal'

type TradeRow = {
  id: string
  side: 'buy' | 'sell'
  quantity: number
  price: number
  traded_at: string
  memo?: string | null
  realized_profit?: number | null
}

type Props = {
  code: string
  name: string
  groupId: string
  heldQuantity?: number
  currentPrice?: number | null
  /** 거래 기록/삭제 후 보유 정보 재조회용 */
  onChanged?: () => void
}

function formatTradeDate(d: string): string {
  // traded_at: YYYY-MM-DD
  if (!d || d.length < 10) return d || '—'
  return `${d.slice(2, 4)}.${d.slice(5, 7)}.${d.slice(8, 10)}`
}

export function TradeHistorySection({
  code,
  name,
  groupId,
  heldQuantity,
  currentPrice,
  onChanged,
}: Props) {
  const [trades, setTrades] = useState<TradeRow[]>([])
  const [loaded, setLoaded] = useState(false)
  const [tableMissing, setTableMissing] = useState(false)
  const [modalSide, setModalSide] = useState<'buy' | 'sell' | null>(null)

  const loadTrades = useCallback(async () => {
    try {
      const r = await authFetch(
        apiUrl(
          `/api/pro-trades?code=${encodeURIComponent(code)}&groupId=${encodeURIComponent(groupId)}`,
        ),
      )
      if (!r.ok) return
      const d = (await r.json()) as { trades?: TradeRow[]; tableMissing?: boolean }
      setTrades(d.trades || [])
      setTableMissing(Boolean(d.tableMissing))
    } catch {
      // 부가 섹션 — 실패 시 비표시
    } finally {
      setLoaded(true)
    }
  }, [code, groupId])

  useEffect(() => {
    void loadTrades()
  }, [loadTrades])

  const deleteTrade = async (id: string) => {
    if (!window.confirm('이 거래 기록을 삭제할까요?\n보유 수량·평단·실현손익이 기록 전 상태로 되돌아갑니다.')) return
    try {
      const r = await authFetch(apiUrl(`/api/pro-trades?id=${encodeURIComponent(id)}`), {
        method: 'DELETE',
      })
      if (!r.ok) {
        const d = (await r.json().catch(() => ({}))) as { error?: string }
        window.alert(d.error || '삭제 실패')
        return
      }
      await loadTrades()
      onChanged?.()
    } catch {
      window.alert('삭제 요청에 실패했습니다')
    }
  }

  if (!loaded || tableMissing) return null

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <div className="mb-3 flex items-center gap-2">
        <ReceiptText size={18} className="text-gray-500" strokeWidth={1.8} aria-hidden />
        <h2 className="text-[14px] font-bold text-gray-900">매매일지</h2>
        <div className="ml-auto flex gap-1.5">
          <button
            type="button"
            onClick={() => setModalSide('buy')}
            className="rounded-lg bg-red-50 px-2.5 py-1 text-[11px] font-bold text-red-600 hover:bg-red-100"
          >
            매수
          </button>
          <button
            type="button"
            onClick={() => setModalSide('sell')}
            className="rounded-lg bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-600 hover:bg-blue-100"
          >
            매도
          </button>
        </div>
      </div>

      {trades.length === 0 ? (
        <p className="py-4 text-center text-[12px] text-gray-400">
          기록된 거래가 없습니다. 매수/매도 버튼으로 기록을 시작해보세요.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {trades.map((t) => {
            const realized = Number(t.realized_profit)
            return (
              <li key={t.id} className="flex items-center gap-2.5 py-2.5">
                <span className="w-14 shrink-0 text-[11px] tabular-nums text-gray-400">
                  {formatTradeDate(t.traded_at)}
                </span>
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                    t.side === 'buy' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
                  }`}
                >
                  {t.side === 'buy' ? '매수' : '매도'}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] tabular-nums text-gray-900">
                    {Number(t.quantity).toLocaleString('ko-KR')}주 ·{' '}
                    {Number(t.price).toLocaleString('ko-KR')}원
                  </div>
                  {t.memo ? (
                    <div className="truncate text-[11px] text-gray-400">{t.memo}</div>
                  ) : null}
                </div>
                {t.side === 'sell' && Number.isFinite(realized) ? (
                  <span
                    className={`shrink-0 text-[12px] font-bold tabular-nums ${
                      realized > 0 ? 'text-red-600' : realized < 0 ? 'text-blue-600' : 'text-gray-600'
                    }`}
                  >
                    {realized >= 0 ? '+' : ''}
                    {Math.round(realized).toLocaleString('ko-KR')}원
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => void deleteTrade(t.id)}
                  className="shrink-0 rounded p-0.5 text-gray-300 hover:text-red-500"
                  aria-label="거래 기록 삭제"
                >
                  <Trash2 size={12} strokeWidth={1.8} />
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {modalSide ? (
        <TradeModal
          code={code}
          name={name}
          groupId={groupId}
          heldQuantity={heldQuantity}
          defaultPrice={currentPrice ?? undefined}
          initialSide={modalSide}
          onClose={() => setModalSide(null)}
          onSaved={() => {
            setModalSide(null)
            void loadTrades()
            onChanged?.()
          }}
        />
      ) : null}
    </div>
  )
}
