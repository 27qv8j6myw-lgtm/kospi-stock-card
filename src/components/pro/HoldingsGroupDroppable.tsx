'use client'

import { useEffect, useRef, useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Pencil, Plus, Sparkles, Trash2 } from 'lucide-react'
import { authFetch } from '@/lib/api'
import { apiUrl } from '@/lib/apiBase'
import { friendlyProChatError } from '@/lib/friendlyAnthropicError'
import { GroupDiagnosisModal } from './GroupDiagnosisModal'
import { SortableHoldingRow } from './SortableHoldingRow'

function formatAmountInput(raw: string, allowNegative = false): string {
  const trimmed = raw.trim()
  const negative = allowNegative && trimmed.startsWith('-')
  const digits = trimmed.replace(/[^\d]/g, '')
  if (!digits) return negative ? '-' : ''
  const formatted = Number(digits).toLocaleString('ko-KR')
  return negative ? `-${formatted}` : formatted
}

function amountToInput(n: number | null | undefined, allowNegative = false): string {
  const num = Number(n) || 0
  if (!num) return ''
  if (num < 0 && allowNegative) {
    return `-${Math.abs(Math.round(num)).toLocaleString('ko-KR')}`
  }
  return Math.round(num).toLocaleString('ko-KR')
}

export type HoldingsGroupInfo = {
  id: string
  name: string
  initial_capital?: number | null
  cash_balance?: number | null
  realized_profit?: number | null
}

export type HoldingDnDRow = {
  id: string
  code: string
  name: string
  quantity: number
  avg_price: number
  group_id: string | null
  currentPrice: number
  profit: number
  profitPct: number
  weight?: number
}

export type GroupSubtotal = {
  evalSum: number
  profit: number
  profitPct: number
  initialCapital: number
  cashBalance: number
  realizedProfit: number
  totalValue: number
  capitalProfit: number
  capitalProfitPct: number | null
}

type Props = {
  group: HoldingsGroupInfo
  items: HoldingDnDRow[]
  sub: GroupSubtotal
  formatKRW: (n: number) => string
  changeClass: (n: number) => string
  onDeleteGroup: (id: string) => void
  onRenameGroup: (id: string, name: string) => void
  onSetCapital: (groupId: string, capital: number, cash: number, realizedProfit: number) => void
  onAddStock: () => void
  onNavigate: (path: string) => void
  onDeleteHolding: (holdingId: string) => void
  disclosures?: Record<string, { count: number; hasMajor: boolean }>
}

export function HoldingsGroupDroppable({
  group,
  items,
  sub,
  formatKRW,
  changeClass,
  onDeleteGroup,
  onRenameGroup,
  onSetCapital,
  onAddStock,
  onNavigate,
  onDeleteHolding,
  disclosures,
}: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: group.id })

  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(group.name)
  const [editingCapital, setEditingCapital] = useState(false)
  const [capitalInput, setCapitalInput] = useState('')
  const [cashInput, setCashInput] = useState('')
  const [realizedProfitInput, setRealizedProfitInput] = useState('')
  const capitalInputRef = useRef<HTMLInputElement | null>(null)
  const cashInputRef = useRef<HTMLInputElement | null>(null)
  const realizedProfitInputRef = useRef<HTMLInputElement | null>(null)
  const [showDiagnosis, setShowDiagnosis] = useState(false)
  const [diagnosis, setDiagnosis] = useState<string | null>(null)
  const [diagLoading, setDiagLoading] = useState(false)

  useEffect(() => {
    if (!editing) setEditName(group.name)
  }, [group.name, editing])

  const saveRename = () => {
    const trimmed = editName.trim()
    if (trimmed && trimmed !== group.name) {
      onRenameGroup(group.id, trimmed)
    }
    setEditing(false)
  }

  const openCapitalEdit = (focus?: 'capital' | 'cash' | 'realized') => {
    setCapitalInput(amountToInput(group.initial_capital))
    setCashInput(amountToInput(group.cash_balance))
    setRealizedProfitInput(amountToInput(group.realized_profit, true))
    setEditingCapital(true)
    if (focus) {
      requestAnimationFrame(() => {
        if (focus === 'capital') capitalInputRef.current?.focus()
        else if (focus === 'cash') cashInputRef.current?.focus()
        else realizedProfitInputRef.current?.focus()
      })
    }
  }

  const saveCapital = () => {
    const cap = parseFloat(capitalInput.replace(/,/g, '')) || 0
    const cash = parseFloat(cashInput.replace(/,/g, '')) || 0
    const realizedProfit = parseFloat(realizedProfitInput.replace(/,/g, '')) || 0
    onSetCapital(group.id, cap, cash, realizedProfit)
    setEditingCapital(false)
  }

  const runDiagnosis = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowDiagnosis(true)
    setDiagnosis(null)
    setDiagLoading(true)
    try {
      const r = await authFetch(apiUrl('/api/pro-group-opus'), {
        method: 'POST',
        body: JSON.stringify({ groupId: group.id }),
      })
      if (r.ok) {
        const d = (await r.json()) as { analysis?: string }
        setDiagnosis(d.analysis || '')
      } else {
        const err = (await r.json().catch(() => ({}))) as { error?: string }
        setDiagnosis(friendlyProChatError(err.error || '분석에 실패했습니다'))
      }
    } catch {
      setDiagnosis('분석 요청에 실패했습니다')
    } finally {
      setDiagLoading(false)
    }
  }

  return (
    <>
      <div
        ref={setNodeRef}
        className={`flex h-full flex-col overflow-hidden rounded-2xl border transition-colors ${
          isOver ? 'border-blue-400 bg-blue-50/30' : 'border-gray-200 bg-white'
        }`}
      >
        <div className="flex min-w-0 items-center gap-1.5 border-b border-gray-100 bg-gray-50 px-3 py-2">
          {editing ? (
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={saveRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveRename()
                if (e.key === 'Escape') {
                  setEditName(group.name)
                  setEditing(false)
                }
              }}
              autoFocus
              className="min-w-0 flex-1 rounded border border-gray-300 px-1.5 py-0.5 text-[13px] font-bold"
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                setEditName(group.name)
                setEditing(true)
              }}
              className="min-w-0 truncate text-left text-[13px] font-bold text-gray-900 hover:text-blue-600"
            >
              <span className="inline-flex items-center gap-1">
                <span className="truncate">{group.name}</span>
                <Pencil size={11} className="text-gray-400" strokeWidth={1.9} aria-hidden />
              </span>
            </button>
          )}
          <span className="flex-shrink-0 text-[10px] text-gray-400">{items.length}</span>

          <div className="ml-auto flex flex-shrink-0 items-center gap-1">
            <span className="text-[12px] font-bold tabular-nums text-gray-900">
              {formatKRW(sub.evalSum)}
            </span>

            {items.length > 0 ? (
              <button
                type="button"
                onClick={(e) => void runDiagnosis(e)}
                className="flex flex-shrink-0 items-center gap-0.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 hover:bg-amber-200"
              >
                <Sparkles size={10} strokeWidth={2} aria-hidden />
                진단
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => onDeleteGroup(group.id)}
              className="flex-shrink-0 rounded p-0.5 text-gray-400 hover:text-red-500"
              aria-label={`${group.name} 그룹 삭제`}
            >
              <Trash2 size={11} strokeWidth={1.8} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 border-b border-gray-100 bg-gray-50/50 px-3 py-1.5 text-[11px]">
          <div className="flex items-center gap-1">
            <span className="text-gray-400">평단</span>
            <span className={`font-bold tabular-nums ${changeClass(sub.profit)}`}>
              {sub.profit >= 0 ? '+' : ''}
              {sub.profitPct.toFixed(1)}%
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-gray-400">원금</span>
            {sub.capitalProfitPct !== null ? (
              <span className={`font-bold tabular-nums ${changeClass(sub.capitalProfit)}`}>
                {sub.capitalProfit >= 0 ? '+' : ''}
                {sub.capitalProfitPct.toFixed(1)}%
              </span>
            ) : (
              <button
                type="button"
                onClick={() => openCapitalEdit()}
                className="text-blue-500 underline"
              >
                그룹 설정
              </button>
            )}
          </div>
          {!editingCapital ? (
            <button
              type="button"
              onClick={() => openCapitalEdit()}
              className="ml-auto flex flex-shrink-0 cursor-pointer items-center gap-1"
              aria-label="원금/예수금/수익 수정"
            >
              <span className="text-[11px] text-gray-500">원금/예수금/수익</span>
              <Pencil
                size={11}
                className="text-gray-400 hover:text-gray-600"
                strokeWidth={1.9}
                aria-hidden
              />
            </button>
          ) : null}
        </div>

        {editingCapital ? (
          <div className="space-y-2 border-b border-blue-100 bg-blue-50 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <span className="w-20 text-[11px] text-gray-600">총 투입원금</span>
              <input
                ref={capitalInputRef}
                type="text"
                inputMode="numeric"
                value={capitalInput}
                onChange={(e) => setCapitalInput(formatAmountInput(e.target.value))}
                placeholder="10,000,000"
                className="flex-1 rounded border border-gray-300 px-2 py-1 text-[12px] tabular-nums"
              />
              <button
                type="button"
                onClick={() => capitalInputRef.current?.focus()}
                aria-label="총 투입원금 수정"
              >
                <Pencil
                  size={11}
                  className="cursor-pointer text-gray-400 hover:text-gray-600"
                  strokeWidth={1.9}
                  aria-hidden
                />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-20 text-[11px] text-gray-600">예수금</span>
              <input
                ref={cashInputRef}
                type="text"
                inputMode="numeric"
                value={cashInput}
                onChange={(e) => setCashInput(formatAmountInput(e.target.value))}
                placeholder="0"
                className="flex-1 rounded border border-gray-300 px-2 py-1 text-[12px] tabular-nums"
              />
              <button type="button" onClick={() => cashInputRef.current?.focus()} aria-label="예수금 수정">
                <Pencil
                  size={11}
                  className="cursor-pointer text-gray-400 hover:text-gray-600"
                  strokeWidth={1.9}
                  aria-hidden
                />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-20 text-[11px] text-gray-600">실현수익(출금)</span>
              <input
                ref={realizedProfitInputRef}
                type="text"
                inputMode="numeric"
                value={realizedProfitInput}
                onChange={(e) => setRealizedProfitInput(formatAmountInput(e.target.value, true))}
                placeholder="0"
                className="flex-1 rounded border border-gray-300 px-2 py-1 text-[12px] tabular-nums"
              />
              <button
                type="button"
                onClick={() => realizedProfitInputRef.current?.focus()}
                aria-label="실현수익(출금) 수정"
              >
                <Pencil
                  size={11}
                  className="cursor-pointer text-gray-400 hover:text-gray-600"
                  strokeWidth={1.9}
                  aria-hidden
                />
              </button>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingCapital(false)}
                className="px-2 text-[11px] text-gray-400"
              >
                취소
              </button>
              <button
                type="button"
                onClick={saveCapital}
                className="rounded bg-gray-900 px-3 py-1 text-[11px] font-bold text-white"
              >
                저장
              </button>
            </div>
            <p className="text-[10px] text-gray-400">
              누적수익 = 평가손익 + 실현수익(출금), 수익률 = 누적수익 / 총 투입원금
            </p>
          </div>
        ) : null}

        <SortableContext items={items.map((h) => h.id)} strategy={verticalListSortingStrategy}>
          {items.length === 0 ? (
            <div className="py-4 text-center text-[11px] text-gray-300">여기로 드래그</div>
          ) : (
            items.map((h) => (
              <SortableHoldingRow
                key={h.code}
                holding={h}
                formatKRW={formatKRW}
                changeClass={changeClass}
                onNavigate={onNavigate}
                onDelete={() => onDeleteHolding(h.id)}
                disclosure={disclosures?.[h.code]}
              />
            ))
          )}
        </SortableContext>

        <button
          type="button"
          onClick={onAddStock}
          className="mt-auto flex w-full items-center justify-center gap-1 border-t border-gray-100 py-2.5 text-[12px] font-bold text-gray-400 hover:bg-gray-50"
        >
          <Plus size={13} strokeWidth={2} aria-hidden />
          종목 추가
        </button>
      </div>

      {showDiagnosis ? (
        <GroupDiagnosisModal
          groupName={group.name}
          loading={diagLoading}
          analysis={diagnosis}
          onClose={() => {
            setShowDiagnosis(false)
            setDiagnosis(null)
          }}
        />
      ) : null}
    </>
  )
}
