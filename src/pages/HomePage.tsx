'use client'

import { useCallback, useEffect, useState } from 'react'
import { Clock, Flame, TrendingUp } from 'lucide-react'
import { useAppNavigation } from '@/hooks/useAppNavigation'
import { StockSearchInput } from '@/components/portfolio/StockSearchInput'
import { MarketIndicesStrip } from '@/components/home/MarketIndicesStrip'
import { StockColumn, type HomeStockRow } from '@/components/home/StockColumn'
import { fetchWithAuth } from '@/lib/api'

export default function HomePage() {
  const { navigate } = useAppNavigation()
  const [topVolume, setTopVolume] = useState<HomeStockRow[]>([])
  const [topMomentum, setTopMomentum] = useState<HomeStockRow[]>([])
  const [recent, setRecent] = useState<HomeStockRow[]>([])
  const [loadingV, setLoadingV] = useState(true)
  const [loadingM, setLoadingM] = useState(true)
  const [loadingR, setLoadingR] = useState(true)

  useEffect(() => {
    fetch('/api/market-top-volume')
      .then((r) => r.json())
      .then((data) => setTopVolume(Array.isArray(data.stocks) ? data.stocks : []))
      .catch(() => {})
      .finally(() => setLoadingV(false))

    fetch('/api/market-top-momentum')
      .then((r) => r.json())
      .then((data) => setTopMomentum(Array.isArray(data.stocks) ? data.stocks : []))
      .catch(() => {})
      .finally(() => setLoadingM(false))

    fetchWithAuth('/api/user-recent-views')
      .then((r) => r.json())
      .then((data) => setRecent(Array.isArray(data.stocks) ? data.stocks : []))
      .catch(() => {})
      .finally(() => setLoadingR(false))
  }, [])

  const handleStockClick = useCallback(
    (code: string, name?: string | null) => {
      const c = String(code || '')
        .replace(/\D/g, '')
        .padStart(6, '0')
      if (!c || c === '000000') return
      const label = String(name || '').trim()
      if (label) {
        try {
          sessionStorage.setItem(`stock-pick:${c}`, label)
        } catch {
          /* ignore */
        }
      }
      navigate(`/stocks/${c}`)
    },
    [navigate],
  )

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-6 sm:px-6">
      <MarketIndicesStrip />

      <div className="mb-8 mt-4 flex flex-col items-center gap-6">
        <div className="text-center">
          <h1 className="mb-1.5 text-xl font-semibold tracking-tight text-gray-900">
            어떤 종목을 분석할까요?
          </h1>
          <p className="text-xs tracking-tight text-gray-400">종목명 또는 코드로 검색하세요</p>
        </div>

        <div className="w-full max-w-[580px]">
          <StockSearchInput
            onSelect={(stock) => {
              console.log('[HomePage] 검색 선택 이동:', stock.code)
              navigate(`/stocks/${stock.code}`)
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StockColumn
          title="거래대금"
          icon={<Flame size={13} style={{ color: '#DC2626' }} strokeWidth={1.8} aria-hidden />}
          subtitle={getCurrentTime()}
          stocks={topVolume}
          showRank
          metaKey="tradingValue"
          metaFormatter={formatVolume}
          onStockClick={handleStockClick}
          loading={loadingV}
        />

        <StockColumn
          title="3일 모멘텀"
          icon={<TrendingUp size={13} style={{ color: '#DC2626' }} strokeWidth={1.8} aria-hidden />}
          subtitle="KOSPI 200"
          stocks={topMomentum}
          showRank
          metaKey="sector"
          changeKey="return3D"
          onStockClick={handleStockClick}
          loading={loadingM}
        />

        <StockColumn
          title="최근 조회"
          icon={<Clock size={13} style={{ color: '#6B7280' }} strokeWidth={1.8} aria-hidden />}
          subtitle="7일"
          stocks={recent}
          showRank={false}
          metaKey="lastViewedAt"
          metaFormatter={formatRelativeTime}
          emptyMessage="아직 조회한 종목이 없습니다"
          onStockClick={handleStockClick}
          loading={loadingR}
        />
      </div>
    </div>
  )
}

function getCurrentTime() {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

function formatVolume(value: unknown) {
  if (value == null || value === '') return ''
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n) || n <= 0) return ''
  if (n >= 1e12) return `${(n / 1e12).toFixed(1)}조`
  if (n >= 1e8) return `${Math.round(n / 1e8).toLocaleString('ko-KR')}억`
  return n.toLocaleString('ko-KR')
}

function formatRelativeTime(iso: unknown) {
  if (iso == null || typeof iso !== 'string' || !iso) return ''
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return ''
  const diff = Math.floor((Date.now() - t) / 60000)
  if (diff < 1) return '방금'
  if (diff < 60) return `${diff}분 전`
  if (diff < 1440) return `${Math.floor(diff / 60)}시간 전`
  return `${Math.floor(diff / 1440)}일 전`
}
