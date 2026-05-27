'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { ArrowLeft, Briefcase, FolderPlus } from 'lucide-react'
import { MarketIndicesStrip } from '@/components/home/MarketIndicesStrip'
import { AddHoldingModal } from '@/components/pro/AddHoldingModal'
import { DragHoldingPreview } from '@/components/pro/DragHoldingPreview'
import { HoldingsGroupDroppable } from '@/components/pro/HoldingsGroupDroppable'
import { PortfolioAnalysis } from '@/components/pro/PortfolioAnalysis'
import { useAppNavigation } from '@/hooks/useAppNavigation'
import { authFetch } from '@/lib/api'
import { apiUrl } from '@/lib/apiBase'
import { formatKRWCompact } from '@/lib/format'
import { PRO_CONTENT_WRAP } from '@/lib/proStockDesign'

type ProGroup = {
  id: string
  name: string
  sort_order?: number
  initial_capital?: number | null
  cash_balance?: number | null
}

type HoldingRow = {
  id: string
  code: string
  name: string
  quantity: number
  avg_price: number
  group_id: string | null
  currentPrice: number
  evalAmount: number
  costAmount: number
  profit: number
  profitPct: number
  weight?: number
}

type Summary = {
  totalEval: number
  totalCost: number
  totalProfit: number
  totalProfitPct: number
  count: number
}

function changeClass(n: number): string {
  if (n > 0) return 'text-red-600'
  if (n < 0) return 'text-blue-600'
  return 'text-gray-600'
}

function subtotal(items: HoldingRow[], group?: ProGroup) {
  const evalSum = items.reduce((s, h) => s + (Number(h.evalAmount) || 0), 0)
  const costSum = items.reduce((s, h) => s + (Number(h.costAmount) || 0), 0)
  const profit = evalSum - costSum
  const profitPct = costSum > 0 ? (profit / costSum) * 100 : 0

  const initialCapital = Number(group?.initial_capital) || 0
  const cashBalance = Number(group?.cash_balance) || 0
  const totalValue = cashBalance + evalSum
  const capitalProfit = initialCapital > 0 ? totalValue - initialCapital : 0
  const capitalProfitPct = initialCapital > 0 ? (capitalProfit / initialCapital) * 100 : null

  return {
    evalSum,
    profit,
    profitPct,
    initialCapital,
    cashBalance,
    totalValue,
    capitalProfit,
    capitalProfitPct,
  }
}

function resolveTargetGroupId(
  overId: string,
  groups: ProGroup[],
  holdings: HoldingRow[],
): string | undefined {
  const targetGroup = groups.find((g) => g.id === overId)
  if (targetGroup) return targetGroup.id

  const overHolding = holdings.find((h) => h.id === overId)
  if (overHolding?.group_id) return overHolding.group_id

  return undefined
}

export default function ProHoldingsPage() {
  const { navigate } = useAppNavigation()
  const [holdings, setHoldings] = useState<HoldingRow[]>([])
  const [groups, setGroups] = useState<ProGroup[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [addToGroupId, setAddToGroupId] = useState<string | null>(null)
  const [portfolioRefreshKey, setPortfolioRefreshKey] = useState(0)
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [hRes, gRes] = await Promise.all([
        authFetch(apiUrl('/api/pro-holdings')),
        authFetch(apiUrl('/api/pro-groups')),
      ])

      let gs: ProGroup[] = []
      if (gRes.ok) {
        const d = (await gRes.json()) as { groups?: ProGroup[] }
        gs = d.groups || []
      }

      if (gs.length === 0) {
        const r = await authFetch(apiUrl('/api/pro-groups'), {
          method: 'POST',
          body: JSON.stringify({ name: '기본1' }),
        })
        if (r.ok) {
          const created = (await r.json()) as { group?: ProGroup }
          if (created.group) gs = [created.group]
        }
      }

      setGroups(gs)

      if (hRes.ok) {
        const d = (await hRes.json()) as { holdings?: HoldingRow[]; summary?: Summary | null }
        setHoldings(d.holdings || [])
        setSummary(d.summary ?? null)
        setPortfolioRefreshKey((k) => k + 1)
      }
    } catch (e) {
      console.error('[ProHoldings]', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const groupedSections = useMemo(
    () =>
      groups.map((g) => ({
        group: g,
        items: holdings.filter((h) => h.group_id === g.id),
      })),
    [groups, holdings],
  )

  const capitalSummary = useMemo(() => {
    const totalInitialCapital = groups.reduce((s, g) => s + (Number(g.initial_capital) || 0), 0)
    const totalCash = groups.reduce((s, g) => s + (Number(g.cash_balance) || 0), 0)
    const totalEval = summary?.totalEval || 0
    const totalValue = totalCash + totalEval
    const capitalProfit = totalInitialCapital > 0 ? totalValue - totalInitialCapital : 0
    const capitalProfitPct =
      totalInitialCapital > 0 ? (capitalProfit / totalInitialCapital) * 100 : null
    return { totalInitialCapital, totalCash, capitalProfit, capitalProfitPct }
  }, [groups, summary?.totalEval])

  const addToGroupName = groups.find((g) => g.id === addToGroupId)?.name

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)
    if (!over) return

    const holdingId = String(active.id)
    const overId = String(over.id)
    const targetGroupId = resolveTargetGroupId(overId, groups, holdings)
    if (!targetGroupId) return

    const dragged = holdings.find((h) => h.id === holdingId)
    if (!dragged) return

    if (dragged.group_id === targetGroupId) return

    const conflict = holdings.find(
      (h) => h.code === dragged.code && h.group_id === targetGroupId && h.id !== holdingId,
    )
    if (conflict) {
      window.alert('대상 그룹에 이미 같은 종목이 있습니다')
      return
    }

    setHoldings((prev) =>
      prev.map((h) => (h.id === holdingId ? { ...h, group_id: targetGroupId } : h)),
    )

    try {
      const r = await authFetch(apiUrl('/api/pro-holdings-group'), {
        method: 'PATCH',
        body: JSON.stringify({ holdingId, groupId: targetGroupId }),
      })
      if (!r.ok) {
        const err = (await r.json().catch(() => ({}))) as { error?: string }
        if (r.status === 409) {
          window.alert(err.error || '대상 그룹에 이미 같은 종목이 있습니다')
        }
        void load()
      }
    } catch {
      void load()
    }
  }

  const addGroup = async () => {
    const name = window.prompt('그룹 이름 (예: 단기 스윙, 장기 보유)')
    if (!name?.trim()) return
    await authFetch(apiUrl('/api/pro-groups'), {
      method: 'POST',
      body: JSON.stringify({ name: name.trim() }),
    })
    void load()
  }

  const renameGroup = async (id: string, newName: string) => {
    await authFetch(apiUrl('/api/pro-groups'), {
      method: 'PATCH',
      body: JSON.stringify({ id, name: newName }),
    })
    void load()
  }

  const setCapital = async (groupId: string, capital: number, cash: number) => {
    await authFetch(apiUrl('/api/pro-groups'), {
      method: 'PATCH',
      body: JSON.stringify({ id: groupId, initialCapital: capital, cashBalance: cash }),
    })
    void load()
  }

  const deleteGroup = async (id: string) => {
    if (groups.length <= 1) {
      window.alert('마지막 그룹은 삭제할 수 없습니다')
      return
    }
    if (!window.confirm('그룹을 삭제할까요? 종목은 다른 그룹으로 이동됩니다')) return

    const targetGroup = groups.find((g) => g.id !== id)
    if (!targetGroup) return

    const items = holdings.filter((h) => h.group_id === id)
    for (const h of items) {
      const conflict = holdings.find(
        (x) => x.code === h.code && x.group_id === targetGroup.id && x.id !== h.id,
      )
      if (conflict) {
        window.alert(
          `「${targetGroup.name}」에 이미 ${h.name || h.code}이(가) 있어 그룹을 삭제할 수 없습니다`,
        )
        return
      }
    }

    for (const h of items) {
      await authFetch(apiUrl('/api/pro-holdings-group'), {
        method: 'PATCH',
        body: JSON.stringify({ holdingId: h.id, groupId: targetGroup.id }),
      })
    }

    await authFetch(apiUrl(`/api/pro-groups?id=${encodeURIComponent(id)}`), {
      method: 'DELETE',
    })
    void load()
  }

  const handleDeleteHolding = async (holdingId: string) => {
    if (!window.confirm('이 종목을 삭제할까요?')) return
    await authFetch(apiUrl(`/api/pro-holdings?id=${encodeURIComponent(holdingId)}`), {
      method: 'DELETE',
    })
    void load()
  }

  const openAddModal = (groupId: string) => {
    setAddToGroupId(groupId)
    setShowAdd(true)
  }

  const activeHolding = activeId ? holdings.find((h) => h.id === activeId) : undefined

  return (
    <div className="min-h-screen bg-gray-50">
      <MarketIndicesStrip variant="pro" className="mb-0 w-full" />

      <div className={`${PRO_CONTENT_WRAP} py-4 pb-12`}>
        <div className="mb-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/pro')}
            className="rounded-lg p-1.5 hover:bg-gray-100"
            aria-label="Pro 홈"
          >
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <Briefcase size={24} className="text-amber-600" strokeWidth={1.8} aria-hidden />
          <h1 className="text-[20px] font-bold text-gray-900">내 보유종목</h1>

          <div className="ml-auto">
            <button
              type="button"
              onClick={() => void addGroup()}
              className="flex items-center gap-1 rounded-lg bg-gray-900 px-3 py-1.5 text-[12px] font-bold text-white hover:bg-gray-800"
            >
              <FolderPlus size={14} strokeWidth={2} aria-hidden />
              그룹 추가
            </button>
          </div>
        </div>

        {holdings.length > 0 ? (
          <PortfolioAnalysis
            refreshKey={portfolioRefreshKey}
            holdingsSummary={summary}
            capitalSummary={capitalSummary}
          />
        ) : null}

        {loading ? (
          <div className="py-12 text-center text-[13px] text-gray-400">로딩 중...</div>
        ) : groups.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white py-12 text-center text-[13px] text-gray-400">
            그룹을 준비하는 중…
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={(e) => setActiveId(String(e.active.id))}
            onDragCancel={() => setActiveId(null)}
            onDragEnd={(e) => void handleDragEnd(e)}
          >
            <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-2">
              {groupedSections.map(({ group, items }) => (
                <HoldingsGroupDroppable
                  key={group.id}
                  group={group}
                  items={items}
                  sub={subtotal(items, group)}
                  formatKRW={formatKRWCompact}
                  changeClass={changeClass}
                  onDeleteGroup={deleteGroup}
                  onRenameGroup={renameGroup}
                  onSetCapital={setCapital}
                  onAddStock={() => openAddModal(group.id)}
                  onNavigate={navigate}
                  onDeleteHolding={handleDeleteHolding}
                />
              ))}
            </div>

            <DragOverlay>
              <DragHoldingPreview holding={activeHolding} />
            </DragOverlay>
          </DndContext>
        )}
      </div>

      {showAdd && addToGroupId ? (
        <AddHoldingModal
          groupId={addToGroupId}
          groupName={addToGroupName}
          onClose={() => {
            setShowAdd(false)
            setAddToGroupId(null)
          }}
          onAdded={() => {
            setShowAdd(false)
            setAddToGroupId(null)
            void load()
          }}
        />
      ) : null}
    </div>
  )
}
