'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Building2, TrendingUp, User, Users } from 'lucide-react'
import { authFetch } from '@/lib/api'
import { apiUrl } from '@/lib/apiBase'
import { useAppNavigation } from '@/hooks/useAppNavigation'

type Investor = 'foreign' | 'institution' | 'individual'
type TradeType = 'buy' | 'sell'

type TopFlowStock = {
  rank: number
  code: string
  name: string
  currentPrice: number | null
  changePct: number | null
  amount?: number
  amountKrw?: number
  market?: string
}

const INVESTORS: Investor[] = ['foreign', 'institution', 'individual']

const INVESTOR_META: Record<Investor, { label: string; icon: ReactNode }> = {
  foreign: {
    label: '외국인',
    icon: <User size={16} className="text-blue-500" strokeWidth={1.8} />,
  },
  institution: {
    label: '기관',
    icon: <Building2 size={16} className="text-purple-500" strokeWidth={1.8} />,
  },
  individual: {
    label: '개인',
    icon: <Users size={16} className="text-emerald-500" strokeWidth={1.8} />,
  },
}

const EMPTY_DATA: Record<Investor, TopFlowStock[]> = {
  foreign: [],
  institution: [],
  individual: [],
}

function num(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** API/KIS 필드명 차이 흡수 */
function normalizeStocks(raw: unknown): TopFlowStock[] {
  if (!Array.isArray(raw)) return []
  const out: TopFlowStock[] = []
  for (let i = 0; i < raw.length; i++) {
    const row = raw[i] as Record<string, unknown>
    const code = String(row.code ?? row.mksc_shrn_iscd ?? row.stck_shrn_iscd ?? '')
      .replace(/\D/g, '')
      .padStart(6, '0')
    if (!code || code === '000000') continue
    const name = String(row.name ?? row.hts_kor_isnm ?? row.stck_kor_isnm ?? '').trim() || code
    out.push({
      rank: num(row.rank) ?? i + 1,
      code,
      name,
      currentPrice: num(row.currentPrice ?? row.stck_prpr),
      changePct: num(row.changePct ?? row.prdy_ctrt),
      amount: num(row.amount) ?? undefined,
      amountKrw: num(row.amountKrw) ?? undefined,
      market: typeof row.market === 'string' ? row.market : undefined,
    })
  }
  return out
}

function formatTime(iso: string) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function formatAmount(amt: number | null | undefined) {
  if (amt == null || !Number.isFinite(amt) || amt === 0) return '—'
  const abs = Math.abs(amt)
  if (abs >= 1e12) return `${(amt / 1e12).toFixed(1)}조`
  if (abs >= 1e8) return `${(amt / 1e8).toFixed(0)}억`
  if (abs >= 1e4) return `${(amt / 1e4).toFixed(0)}만`
  return amt.toLocaleString()
}

function changePctClass(pct: number | null | undefined) {
  if (pct == null || !Number.isFinite(pct)) return 'text-gray-500'
  if (pct > 0) return 'text-red-600'
  if (pct < 0) return 'text-blue-600'
  return 'text-gray-500'
}

type StockListProps = {
  stocks: TopFlowStock[]
  tradeType: TradeType
  loading: boolean
  compact?: boolean
  onNavigate: (code: string, name: string) => void
}

function StockList({ stocks, tradeType, loading, compact, onNavigate }: StockListProps) {
  const list = stocks.slice(0, 10)

  if (list.length === 0) {
    return (
      <div className="py-8 text-center text-[12px] text-gray-400">
        {loading ? '로딩 중…' : '데이터 없음'}
      </div>
    )
  }

  const rankCls = compact ? 'w-4 text-[10px]' : 'w-5 text-[11px]'
  const nameCls = compact ? 'text-[13px]' : 'text-[14px]'
  const priceCls = compact ? 'text-[10px]' : 'text-[11px]'
  const changeCls = compact ? 'text-[10px]' : 'text-[11px]'
  const amountCls = compact ? 'text-[11px]' : 'text-[13px]'
  const rowPy = compact ? 'py-2' : 'py-2.5'
  const rowPx = compact ? 'px-4' : 'px-4 sm:px-5'

  return (
    <div>
      {list.map((stock, idx) => (
        <button
          key={`${stock.code}-${stock.rank}-${idx}`}
          type="button"
          onClick={() => onNavigate(stock.code, stock.name)}
          className={`flex w-full items-center gap-2 text-left transition-colors hover:bg-gray-50 ${rowPy} ${rowPx} ${
            idx !== list.length - 1 ? 'border-b border-gray-100' : ''
          }`}
        >
          <span className={`${rankCls} flex-shrink-0 font-bold tabular-nums text-gray-400`}>
            {stock.rank}
          </span>

          <div className="min-w-0 flex-1">
            <div className={`truncate font-bold text-gray-900 ${nameCls}`}>{stock.name}</div>
            <div className="mt-0.5 flex items-center gap-1.5">
              <span className={`tabular-nums text-gray-500 ${priceCls}`}>
                {stock.currentPrice != null ? `${stock.currentPrice.toLocaleString()}원` : '—'}
              </span>
              {stock.changePct != null ? (
                <span
                  className={`font-bold tabular-nums ${changeCls} ${changePctClass(stock.changePct)}`}
                >
                  {stock.changePct > 0 ? '+' : ''}
                  {stock.changePct.toFixed(1)}%
                </span>
              ) : null}
            </div>
          </div>

          <span
            className={`flex-shrink-0 font-bold tabular-nums ${amountCls} ${
              tradeType === 'buy' ? 'text-red-600' : 'text-blue-600'
            }`}
          >
            {formatAmount(stock.amountKrw)}
          </span>
        </button>
      ))}
    </div>
  )
}

export function ProTopFlow() {
  const { navigate } = useAppNavigation()
  const loadIdRef = useRef(0)
  const [mobileInvestor, setMobileInvestor] = useState<Investor>('foreign')
  const [tradeType, setTradeType] = useState<TradeType>('buy')
  const [data, setData] = useState<Record<Investor, TopFlowStock[]>>(EMPTY_DATA)
  const [updatedAt, setUpdatedAt] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadId = ++loadIdRef.current

    const fetchOne = async (investor: Investor) => {
      const url = apiUrl(`/api/pro-top-flow?investor=${investor}&type=${tradeType}`)
      const r = await authFetch(url)
      if (!r.ok) {
        return { stocks: [] as TopFlowStock[], updatedAt: '' }
      }
      const d = (await r.json()) as {
        stocks?: unknown
        updatedAt?: string
      }
      return {
        stocks: normalizeStocks(d.stocks),
        updatedAt: d.updatedAt || '',
      }
    }

    const loadAll = async () => {
      setLoading(true)
      try {
        const [foreign, institution, individual] = await Promise.all([
          fetchOne('foreign'),
          fetchOne('institution'),
          fetchOne('individual'),
        ])

        if (loadId !== loadIdRef.current) return

        setData({
          foreign: foreign.stocks,
          institution: institution.stocks,
          individual: individual.stocks,
        })
        setUpdatedAt(
          foreign.updatedAt ||
            institution.updatedAt ||
            individual.updatedAt ||
            new Date().toISOString(),
        )
      } catch (e) {
        console.error('[ProTopFlow]', e)
        if (loadId === loadIdRef.current) {
          setData(EMPTY_DATA)
        }
      } finally {
        if (loadId === loadIdRef.current) {
          setLoading(false)
        }
      }
    }

    void loadAll()
    const interval = setInterval(() => void loadAll(), 5 * 60 * 1000)
    return () => {
      loadIdRef.current += 1
      clearInterval(interval)
    }
  }, [tradeType])

  const goStock = (code: string, name: string) => {
    navigate(`/pro/stock/${code}?name=${encodeURIComponent(name)}`)
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
      <div className="border-b border-gray-100 px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-center gap-2.5">
          <TrendingUp size={24} className="text-blue-500" strokeWidth={1.8} aria-hidden />
          <span className="text-[16px] font-bold text-gray-900 sm:text-[18px]">
            지금 많이 사고팔리는 종목
          </span>

          <span className="hidden text-[11px] tabular-nums text-gray-400 sm:inline">
            {formatTime(updatedAt)} 기준
          </span>

          <div className="ml-auto flex items-center gap-2">
            <span className="text-[10px] tabular-nums text-gray-400 sm:hidden">
              {formatTime(updatedAt)}
            </span>

            <div className="flex gap-0.5 rounded-md bg-gray-100 p-0.5">
              <button
                type="button"
                onClick={() => setTradeType('buy')}
                className={`rounded px-3 py-1 text-[12px] font-bold transition-colors ${
                  tradeType === 'buy' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500'
                }`}
              >
                순매수
              </button>
              <button
                type="button"
                onClick={() => setTradeType('sell')}
                className={`rounded px-3 py-1 text-[12px] font-bold transition-colors ${
                  tradeType === 'sell' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'
                }`}
              >
                순매도
              </button>
            </div>
          </div>
        </div>

        <div className="mt-3 flex gap-1 md:hidden">
          {INVESTORS.map((inv) => (
            <button
              key={inv}
              type="button"
              onClick={() => setMobileInvestor(inv)}
              className={`rounded-md px-3 py-1.5 text-[12px] font-bold transition-colors ${
                mobileInvestor === inv
                  ? 'bg-gray-900 text-white'
                  : 'border border-gray-200 bg-white text-gray-500'
              }`}
            >
              {INVESTOR_META[inv].label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3">
        {INVESTORS.map((inv, colIdx) => (
          <div
            key={inv}
            className={`${colIdx !== 0 ? 'md:border-l md:border-gray-100' : ''} ${
              inv !== mobileInvestor ? 'hidden md:block' : ''
            }`}
          >
            <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
              {INVESTOR_META[inv].icon}
              <span className="text-[13px] font-bold text-gray-900">{INVESTOR_META[inv].label}</span>
            </div>
            <StockList
              stocks={data[inv] ?? []}
              tradeType={tradeType}
              loading={loading}
              compact
              onNavigate={goStock}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
