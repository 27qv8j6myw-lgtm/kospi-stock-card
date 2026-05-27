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
import { ArrowLeft, Briefcase, Check, Filter, FolderPlus } from 'lucide-react'
import { MarketIndicesStrip } from '@/components/home/MarketIndicesStrip'
import { AddHoldingModal } from '@/components/pro/AddHoldingModal'
import { DragHoldingPreview } from '@/components/pro/DragHoldingPreview'
import { HoldingsGroupDroppable } from '@/components/pro/HoldingsGroupDroppable'
import { PortfolioAnalysis } from '@/components/pro/PortfolioAnalysis'
import { useAppNavigation } from '@/hooks/useAppNavigation'
import { authFetch } from '@/lib/api'
import { apiUrl } from '@/lib/apiBase'
import { formatKRWCompact } from '@/lib/format'
import { isKrxMarketOpen } from '@/lib/marketHours'
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
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [addToGroupId, setAddToGroupId] = useState<string | null>(null)
  const [portfolioRefreshKey, setPortfolioRefreshKey] = useState(0)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string> | null>(null)
  const [showGroupFilter, setShowGroupFilter] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  )

  const refreshQuotes = useCallback(async () => {
    if (!isKrxMarketOpen()) return
    try {
      const r = await authFetch(apiUrl('/api/pro-holdings'))
      if (!r.ok) return
      const d = (await r.json()) as { holdings?: HoldingRow[] }
      setHoldings(d.holdings || [])
    } catch (e) {
      console.error('[ProHoldings] quote refresh', e)
    }
  }, [])

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
        const d = (await hRes.json()) as { holdings?: HoldingRow[] }
        setHoldings(d.holdings || [])
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

  useEffect(() => {
    const interval = setInterval(() => void refreshQuotes(), 15_000)
    return () => clearInterval(interval)
  }, [refreshQuotes])

  useEffect(() => {
    if (groups.length === 0) return
    setSelectedGroupIds((prev) => {
      const allIds = groups.map((g) => g.id)
      if (prev === null) return new Set(allIds)
      const next = new Set(prev)
      for (const id of allIds) {
        if (!next.has(id)) next.add(id)
      }
      for (const id of next) {
        if (!allIds.includes(id)) next.delete(id)
      }
      return next
    })
  }, [groups])

  const isGroupVisible = useCallback(
    (groupId: string) => selectedGroupIds === null || selectedGroupIds.has(groupId),
    [selectedGroupIds],
  )

  const visibleGroups = useMemo(
    () => groups.filter((g) => isGroupVisible(g.id)),
    [groups, isGroupVisible],
  )

  const visibleHoldings = useMemo(
    () =>
      holdings.filter(
        (h) => h.group_id != null && (selectedGroupIds === null || selectedGroupIds.has(h.group_id)),
      ),
    [holdings, selectedGroupIds],
  )

  const vSummary = useMemo(() => {
    const evalSum = visibleHoldings.reduce((s, h) => s + (Number(h.evalAmount) || 0), 0)
    const costSum = visibleHoldings.reduce((s, h) => s + (Number(h.costAmount) || 0), 0)
    const profit = evalSum - costSum
    const profitPct = costSum > 0 ? (profit / costSum) * 100 : 0

    const initialCapital = visibleGroups.reduce((s, g) => s + (Number(g.initial_capital) || 0), 0)
    const cashBalance = visibleGroups.reduce((s, g) => s + (Number(g.cash_balance) || 0), 0)
    const totalValue = cashBalance + evalSum
    const capitalProfit = initialCapital > 0 ? totalValue - initialCapital : 0
    const capitalProfitPct = initialCapital > 0 ? (capitalProfit / initialCapital) * 100 : null

    return {
      totalEval: evalSum,
      totalCost: costSum,
      totalProfit: profit,
      totalProfitPct: profitPct,
      count: visibleHoldings.length,
      initialCapital,
      cashBalance,
      capitalProfit,
      capitalProfitPct,
    }
  }, [visibleHoldings, visibleGroups])

  const capitalSummary = useMemo(
    () => ({
      totalInitialCapital: vSummary.initialCapital,
      totalCash: vSummary.cashBalance,
      capitalProfit: vSummary.capitalProfit,
      capitalProfitPct: vSummary.capitalProfitPct,
    }),
    [vSummary],
  )

  const allSelected =
    groups.length > 0 &&
    selectedGroupIds !== null &&
    selectedGroupIds.size === groups.length &&
    groups.every((g) => selectedGroupIds.has(g.id))

  const toggleGroup = (groupId: string) => {
    setSelectedGroupIds((prev) => {
      const base = prev === null ? new Set(groups.map((g) => g.id)) : new Set(prev)
      if (base.has(groupId)) base.delete(groupId)
      else base.add(groupId)
      return base
    })
  }

  const toggleAll = () => {
    if (allSelected) {
      setSelectedGroupIds(new Set())
    } else {
      setSelectedGroupIds(new Set(groups.map((g) => g.id)))
    }
  }

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
        <div className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-2">
          <button
            type="button"
            onClick={() => navigate('/pro')}
            className="shrink-0 rounded-lg p-1.5 hover:bg-gray-100"
            aria-label="Pro 홈"
          >
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <Briefcase
            size={24}
            className="shrink-0 text-amber-600"
            strokeWidth={1.8}
            aria-hidden
          />
          <h1 className="min-w-0 flex-1 truncate text-[20px] font-bold text-gray-900 sm:flex-none">
            내 보유종목
          </h1>

          <div className="flex w-full shrink-0 items-center justify-end gap-2 sm:ml-auto sm:w-auto">
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowGroupFilter((v) => !v)}
                className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[12px] font-bold text-gray-700 hover:border-gray-400"
              >
                <Filter size={14} strokeWidth={2} aria-hidden />
                그룹 보기
                {!allSelected && selectedGroupIds ? (
                  <span className="text-[10px] text-blue-600">({selectedGroupIds.size})</span>
                ) : null}
              </button>

              {showGroupFilter ? (
                <>
                  <button
                    type="button"
                    className="fixed inset-0 z-10"
                    aria-label="그룹 필터 닫기"
                    onClick={() => setShowGroupFilter(false)}
                  />
                  <div className="absolute top-full right-0 z-20 mt-1 min-w-[160px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                    <button
                      type="button"
                      onClick={toggleAll}
                      className="flex w-full items-center gap-2 px-3 py-2 text-[13px] hover:bg-gray-50"
                    >
                      <div
                        className={`flex h-4 w-4 items-center justify-center rounded border ${
                          allSelected ? 'border-gray-900 bg-gray-900' : 'border-gray-300'
                        }`}
                      >
                        {allSelected ? (
                          <Check size={11} className="text-white" strokeWidth={3} aria-hidden />
                        ) : null}
                      </div>
                      <span className="font-bold">전체</span>
                    </button>
                    <div className="my-1 border-t border-gray-100" />
                    {groups.map((g) => {
                      const checked =
                        selectedGroupIds === null || selectedGroupIds.has(g.id)
                      return (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => toggleGroup(g.id)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-[13px] hover:bg-gray-50"
                        >
                          <div
                            className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${
                              checked ? 'border-gray-900 bg-gray-900' : 'border-gray-300'
                            }`}
                          >
                            {checked ? (
                              <Check size={11} className="text-white" strokeWidth={3} aria-hidden />
                            ) : null}
                          </div>
                          <span className="truncate">{g.name}</span>
                        </button>
                      )
                    })}
                  </div>
                </>
              ) : null}
            </div>

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
            holdingsSummary={vSummary}
            capitalSummary={capitalSummary}
            filterHoldings={visibleHoldings}
          />
        ) : null}

        {loading ? (
          <div className="py-12 text-center text-[13px] text-gray-400">로딩 중...</div>
        ) : groups.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white py-12 text-center text-[13px] text-gray-400">
            그룹을 준비하는 중…
          </div>
        ) : visibleGroups.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white py-12 text-center text-[13px] text-gray-400">
            표시할 그룹을 선택해주세요
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
              {visibleGroups.map((group) => {
                const items = visibleHoldings.filter((h) => h.group_id === group.id)
                return (
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
                )
              })}
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
