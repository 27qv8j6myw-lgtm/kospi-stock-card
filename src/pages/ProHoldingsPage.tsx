'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { ArrowLeft, Briefcase, Check, Filter, FolderPlus, RotateCw, Sparkles } from 'lucide-react'
import { AddHoldingModal } from '@/components/pro/AddHoldingModal'
import { DragHoldingPreview } from '@/components/pro/DragHoldingPreview'
import { GroupDiagnosisModal } from '@/components/pro/GroupDiagnosisModal'
import { HoldingsGroupDroppable } from '@/components/pro/HoldingsGroupDroppable'
import { GroupSnapshotsChart } from '@/components/pro/GroupSnapshotsChart'
import { PortfolioAnalysis } from '@/components/pro/PortfolioAnalysis'
import { useAppNavigation } from '@/hooks/useAppNavigation'
import { useKrxDataPolling } from '@/hooks/useKrxDataPolling'
import { useVisibilityDataRefresh } from '@/hooks/useVisibilityDataRefresh'
import { authFetch } from '@/lib/api'
import { apiUrl } from '@/lib/apiBase'
import { friendlyProChatError } from '@/lib/friendlyAnthropicError'
import {
  enrichHoldingsWithQuotes,
  fetchProHoldingsQuotes,
  holdingCodeKeys,
  mergeQuoteMaps,
  type HoldingQuote,
  type HoldingWithQuotes,
} from '@/lib/proHoldingsQuotes'
import { PRO_CONTENT_WRAP } from '@/lib/proStockDesign'

type ProGroup = {
  id: string
  name: string
  sort_order?: number
  initial_capital?: number | null
  cash_balance?: number | null
  realized_profit?: number | null
}

type HoldingRow = HoldingWithQuotes

type HoldingDisclosure = { count: number; hasMajor: boolean }

type RawHoldingRow = Omit<HoldingRow, 'evalAmount' | 'costAmount' | 'profit' | 'profitPct' | 'weight'> &
  Partial<Pick<HoldingRow, 'evalAmount' | 'costAmount' | 'profit' | 'profitPct' | 'weight'>>

function changeClass(n: number): string {
  if (n > 0) return 'text-red-600'
  if (n < 0) return 'text-blue-600'
  return 'text-gray-600'
}

function formatFullKRW(n: number): string {
  return `${Math.round(n).toLocaleString('ko-KR')}원`
}

function subtotal(items: HoldingRow[], group?: ProGroup) {
  const evalSum = items.reduce((s, h) => s + (Number(h.evalAmount) || 0), 0)
  const costSum = items.reduce((s, h) => s + (Number(h.costAmount) || 0), 0)
  const profit = evalSum - costSum
  const profitPct = costSum > 0 ? (profit / costSum) * 100 : 0

  const initialCapital = Number(group?.initial_capital) || 0
  const cashBalance = Number(group?.cash_balance) || 0
  const realizedProfit = Number(group?.realized_profit) || 0
  const totalValue = cashBalance + evalSum
  const cumulativeProfit = profit + realizedProfit
  const capitalProfit = cumulativeProfit
  const capitalProfitPct = initialCapital > 0 ? (cumulativeProfit / initialCapital) * 100 : null

  return {
    evalSum,
    profit,
    profitPct,
    initialCapital,
    cashBalance,
    realizedProfit,
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
  const [rawHoldings, setRawHoldings] = useState<RawHoldingRow[]>([])
  const [quotes, setQuotes] = useState<Record<string, HoldingQuote>>({})
  const [groups, setGroups] = useState<ProGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [addToGroupId, setAddToGroupId] = useState<string | null>(null)
  const [portfolioRefreshKey, setPortfolioRefreshKey] = useState(0)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string> | null>(null)
  const [disclosureMap, setDisclosureMap] = useState<Record<string, HoldingDisclosure>>({})
  const [showGroupFilter, setShowGroupFilter] = useState(false)
  const [showPortfolioDiagnosis, setShowPortfolioDiagnosis] = useState(false)
  const [portfolioOpus, setPortfolioOpus] = useState<string | null>(null)
  const [opusLoading, setOpusLoading] = useState(false)
  const rawHoldingsRef = useRef<RawHoldingRow[]>([])
  const quotesPollInFlightRef = useRef(false)
  /** 새로고침 시 필터 유지 — 직전에 알고 있던 그룹 id (새 그룹만 자동 선택) */
  const knownGroupIdsRef = useRef<Set<string> | null>(null)

  const holdings = useMemo(
    () => enrichHoldingsWithQuotes(rawHoldings, quotes),
    [rawHoldings, quotes],
  )

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  )

  const refreshQuotes = useCallback(async (opts?: { fresh?: boolean }) => {
    const codes = rawHoldingsRef.current.map((h) => h.code).filter(Boolean)
    if (codes.length === 0) return
    if (quotesPollInFlightRef.current) return

    quotesPollInFlightRef.current = true
    try {
      const incoming = await fetchProHoldingsQuotes(codes, authFetch, opts)
      if (Object.keys(incoming).length === 0) return
      setQuotes((prev) => mergeQuoteMaps(prev, incoming))
    } catch (e) {
      console.error('[ProHoldings] quote refresh', e)
    } finally {
      quotesPollInFlightRef.current = false
    }
  }, [])

  const load = useCallback(
    async (opts?: { freshQuotes?: boolean; silent?: boolean }) => {
    if (!opts?.silent) setLoading(true)
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
        const d = (await hRes.json()) as { holdings?: RawHoldingRow[] }
        const rows = d.holdings || []
        setRawHoldings(rows)
        rawHoldingsRef.current = rows

        const seeded: Record<string, HoldingQuote> = {}
        for (const h of rows) {
          const price = Number(h.currentPrice)
          if (price > 0) {
            for (const key of holdingCodeKeys(h.code)) {
              seeded[key] = {
                currentPrice: price,
                changePct: Number(h.changePct) || 0,
              }
            }
          }
        }
        if (Object.keys(seeded).length > 0) {
          setQuotes((prev) => mergeQuoteMaps(prev, seeded))
        }

        setPortfolioRefreshKey((k) => k + 1)
        if (rows.length > 0) {
          void refreshQuotes({ fresh: opts?.freshQuotes ?? false })
        }
      }
    } catch (e) {
      console.error('[ProHoldings]', e)
    } finally {
      setLoading(false)
    }
  },
    [refreshQuotes],
  )

  useEffect(() => {
    void load()
  }, [load])

  useVisibilityDataRefresh(refreshQuotes)
  useKrxDataPolling(refreshQuotes)

  useEffect(() => {
    rawHoldingsRef.current = rawHoldings
  }, [rawHoldings])

  // 보유종목 최근 7일 공시 배지 (보유 코드 목록이 바뀔 때만 재조회)
  const holdingCodesKey = useMemo(
    () => [...new Set(rawHoldings.map((h) => String(h.code)))].sort().join(','),
    [rawHoldings],
  )
  useEffect(() => {
    if (!holdingCodesKey) return
    let cancelled = false
    void (async () => {
      try {
        const r = await authFetch(apiUrl('/api/pro-holdings-disclosures'))
        if (!r.ok) return
        const d = (await r.json()) as { disclosures?: Record<string, HoldingDisclosure> }
        if (!cancelled && d.disclosures) setDisclosureMap(d.disclosures)
      } catch {
        // 공시 배지는 부가 정보 — 실패해도 무시
      }
    })()
    return () => {
      cancelled = true
    }
  }, [holdingCodesKey])

  useEffect(() => {
    if (groups.length === 0) return
    const allIds = groups.map((g) => g.id)
    const known = knownGroupIdsRef.current
    knownGroupIdsRef.current = new Set(allIds)
    setSelectedGroupIds((prev) => {
      if (prev === null) return new Set(allIds)
      const next = new Set(prev)
      // 새로 생성된 그룹만 자동 선택 — 기존 선택 해제 상태는 새로고침해도 유지
      for (const id of allIds) {
        if (!known?.has(id)) next.add(id)
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
    const totalCostBasis = visibleHoldings.reduce(
      (sum, h) => sum + Number(h.avg_price || 0) * Number(h.quantity || 0),
      0,
    )
    const stockEval = visibleHoldings.reduce((sum, h) => {
      const price = Number(
        (h as HoldingRow & { price?: number; stck_prpr?: number }).currentPrice ??
          (h as HoldingRow & { price?: number; stck_prpr?: number }).price ??
          (h as HoldingRow & { price?: number; stck_prpr?: number }).stck_prpr ??
          0,
      )
      return sum + price * Number(h.quantity || 0)
    }, 0)
    const profit = stockEval - totalCostBasis
    const profitPct = totalCostBasis > 0 ? (profit / totalCostBasis) * 100 : null

    const initialCapital = visibleGroups.reduce((s, g) => s + (Number(g.initial_capital) || 0), 0)
    const cashBalance = visibleGroups.reduce((s, g) => s + (Number(g.cash_balance) || 0), 0)
    const realizedProfit = visibleGroups.reduce((s, g) => s + (Number(g.realized_profit) || 0), 0)
    const accountTotalAssets = stockEval + cashBalance
    const cumulativeProfit = profit + realizedProfit
    const cumulativeProfitPct = initialCapital > 0 ? (cumulativeProfit / initialCapital) * 100 : null
    const capitalProfit = cumulativeProfit
    const capitalProfitPct = cumulativeProfitPct

    return {
      totalEval: stockEval,
      totalCost: costSum,
      totalCostBasis,
      totalProfit: profit,
      totalProfitPct: profitPct,
      realizedProfit,
      cumulativeProfit,
      cumulativeProfitPct,
      accountTotalAssets,
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

  const portfolioDiagnosisTitle = useMemo(() => {
    if (!groups.length || !selectedGroupIds || allSelected) {
      return '포트폴리오 전체 진단'
    }
    return '선택 그룹 진단'
  }, [groups.length, selectedGroupIds, allSelected])

  const runPortfolioOpus = async () => {
    if (visibleHoldings.length === 0) return

    setShowPortfolioDiagnosis(true)
    setOpusLoading(true)
    setPortfolioOpus(null)

    const groupIds =
      selectedGroupIds && selectedGroupIds.size > 0 && !allSelected
        ? Array.from(selectedGroupIds)
        : null

    try {
      const r = await authFetch(apiUrl('/api/pro-portfolio-opus'), {
        method: 'POST',
        body: JSON.stringify({ groupIds }),
      })
      if (r.ok) {
        const d = (await r.json()) as { analysis?: string }
        setPortfolioOpus(d.analysis || '')
      } else {
        const err = (await r.json().catch(() => ({}))) as { error?: string }
        setPortfolioOpus(friendlyProChatError(err.error || '진단에 실패했습니다'))
      }
    } catch (e) {
      console.error('[ProHoldings] portfolio opus', e)
      setPortfolioOpus('진단 요청에 실패했습니다')
    } finally {
      setOpusLoading(false)
    }
  }

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

    setRawHoldings((prev) =>
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

  const setCapital = async (
    groupId: string,
    capital: number,
    cash: number,
    realizedProfit: number,
  ) => {
    const r = await authFetch(apiUrl('/api/pro-groups'), {
      method: 'PATCH',
      body: JSON.stringify({
        id: groupId,
        initialCapital: capital,
        cashBalance: cash,
        realizedProfit,
      }),
    })
    if (!r.ok) {
      const err = (await r.json().catch(() => ({}))) as { error?: string }
      window.alert(err.error || '그룹 설정 저장에 실패했습니다')
      return
    }
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

  const handleManualRefresh = async () => {
    if (refreshing) return
    setRefreshing(true)
    try {
      await load({ freshQuotes: true, silent: true })
    } finally {
      setRefreshing(false)
    }
  }

  const activeHolding = activeId ? holdings.find((h) => h.id === activeId) : undefined

  return (
    <div className="min-h-screen w-full min-w-0 max-w-full bg-gray-50">
      <div className="max-md:min-h-[calc(100dvh-2rem)] max-md:overflow-y-auto">
        <div className={`${PRO_CONTENT_WRAP} min-w-0 py-4 pb-12`}>
        <div className="mb-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/pro')}
            className="flex-shrink-0 rounded-lg p-1.5 hover:bg-gray-100"
            aria-label="Pro 홈"
          >
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <Briefcase
            size={22}
            className="flex-shrink-0 text-amber-600"
            strokeWidth={1.8}
            aria-hidden
          />
          <h1 className="min-w-0 truncate text-[16px] font-bold text-gray-900 sm:text-[20px]">
            내 보유종목
          </h1>
          <button
            type="button"
            onClick={() => void handleManualRefresh()}
            disabled={refreshing}
            aria-label="새로고침"
            title="새로고침"
            className="flex-shrink-0 rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
          >
            <RotateCw
              size={16}
              strokeWidth={2}
              className={refreshing ? 'animate-spin' : undefined}
              aria-hidden
            />
          </button>

          <div className="ml-auto flex flex-shrink-0 items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={() => void runPortfolioOpus()}
              disabled={opusLoading || visibleHoldings.length === 0}
              aria-label={opusLoading ? '진단 중' : '전체 진단'}
              className="flex flex-shrink-0 items-center gap-1 rounded-lg bg-amber-100 px-2 py-1.5 text-[12px] font-bold text-amber-700 hover:bg-amber-200 disabled:opacity-50 sm:px-3"
            >
              <Sparkles size={14} strokeWidth={2} aria-hidden />
              <span className="hidden sm:inline">
                {opusLoading ? '진단 중...' : '전체 진단'}
              </span>
            </button>

            <div className="relative flex-shrink-0">
              <button
                type="button"
                onClick={() => setShowGroupFilter((v) => !v)}
                aria-label="그룹 보기"
                className="flex flex-shrink-0 items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-[12px] font-bold text-gray-700 hover:border-gray-400 sm:px-3"
              >
                <Filter size={14} strokeWidth={2} aria-hidden />
                <span className="hidden sm:inline">
                  그룹 보기
                  {!allSelected && selectedGroupIds ? (
                    <span className="text-[10px] text-blue-600"> ({selectedGroupIds.size})</span>
                  ) : null}
                </span>
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
              aria-label="그룹 추가"
              className="flex flex-shrink-0 items-center gap-1 rounded-lg bg-gray-900 px-2 py-1.5 text-[12px] font-bold text-white hover:bg-gray-800 sm:px-3"
            >
              <FolderPlus size={14} strokeWidth={2} aria-hidden />
              <span className="hidden sm:inline">그룹 추가</span>
            </button>
          </div>
        </div>

        {holdings.length > 0 ? (
          <>
            <PortfolioAnalysis
              refreshKey={portfolioRefreshKey}
              holdingsSummary={vSummary}
              capitalSummary={capitalSummary}
              filterHoldings={visibleHoldings}
            />
            <GroupSnapshotsChart selectedGroupIds={selectedGroupIds} allSelected={allSelected} />
          </>
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
            <div className="grid min-w-0 grid-cols-1 items-start gap-3 md:grid-cols-2">
              {visibleGroups.map((group) => {
                const items = visibleHoldings.filter((h) => h.group_id === group.id)
                return (
                  <HoldingsGroupDroppable
                    key={group.id}
                    group={group}
                    items={items}
                    sub={subtotal(items, group)}
                    formatKRW={formatFullKRW}
                    changeClass={changeClass}
                    onDeleteGroup={deleteGroup}
                    onRenameGroup={renameGroup}
                    onSetCapital={setCapital}
                    onAddStock={() => openAddModal(group.id)}
                    onNavigate={navigate}
                    onDeleteHolding={handleDeleteHolding}
                    disclosures={disclosureMap}
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

      {showPortfolioDiagnosis ? (
        <GroupDiagnosisModal
          groupName="포트폴리오"
          title={portfolioDiagnosisTitle}
          loading={opusLoading}
          analysis={portfolioOpus}
          onClose={() => {
            setShowPortfolioDiagnosis(false)
            setPortfolioOpus(null)
          }}
        />
      ) : null}
    </div>
  )
}
