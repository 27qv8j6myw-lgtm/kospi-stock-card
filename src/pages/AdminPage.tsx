'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Activity, BarChart3, Crown, Loader2, Lock, LogIn } from 'lucide-react'
import { authFetch } from '@/lib/api'
import { apiUrl } from '@/lib/apiBase'
import { supabase } from '@/lib/supabase'
import { blockUser, unblockUser } from '@/lib/blockUser'
import { useAuth } from '@/hooks/useAuth'
import { useIsAdmin } from '@/hooks/useIsAdmin'
import { useAppNavigation } from '@/hooks/useAppNavigation'
import { ProAdminStats } from '@/components/admin/ProAdminStats'
import { ProViewStockLogs } from '@/components/admin/ProViewStockLogs'
import { StocksMasterSync } from '@/components/admin/StocksMasterSync'

export type UserSummaryRow = {
  user_id?: string
  id?: string
  email?: string | null
  full_name?: string | null
  display_name?: string | null
  avatar_url?: string | null
  holdings_count?: number | null
  last_activity_at?: string | null
  is_blocked?: boolean | null
  ai_model?: string | null
  ai_enabled?: boolean | null
  pro_enabled?: boolean | null
}

export type ActivityLogRow = {
  id: string
  user_id: string
  action: string
  metadata: Record<string, unknown> | null
  created_at: string
  is_pro?: boolean | null
}

export type UserStockViewRow = {
  user_id: string
  code: string | null
  name: string | null
  view_count: number | null
  last_viewed_at: string | null
  first_viewed_at: string | null
}

function seoulTodayStartMs(): number {
  const key = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
  return new Date(`${key}T00:00:00+09:00`).getTime()
}

function formatSeoul(iso: string): string {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return iso
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(d)
}

function userIdOfRow(r: UserSummaryRow): string {
  return String(r.user_id ?? r.id ?? '')
}

function displayNameRow(r: UserSummaryRow): string {
  const n = (r.display_name || r.full_name || '').trim()
  if (n) return n
  return r.email?.split('@')[0] || userIdOfRow(r).slice(0, 8)
}

/** 활동 로그 행용 — 이메일 전체 대신 표시명 */
function displayUserName(userInfo: any, userId: string): string {
  if (userInfo?.full_name) return userInfo.full_name
  if (userInfo?.email) return userInfo.email.split('@')[0]
  return userId.slice(0, 6)
}

function isAdminEmail(email: string | null | undefined): boolean {
  const e = (email || '').toLowerCase().trim()
  if (e === 'joongsuc@me.com') return true
  const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '')
    .split(',')
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean)
  return adminEmails.includes(e)
}

function actionLabel(action: string, metadata: Record<string, unknown> | null | undefined): string {
  const m = metadata ?? {}
  const code = m.code != null ? String(m.code) : ''
  const name = m.name != null ? String(m.name) : ''
  switch (action) {
    case 'login':
      return '로그인'
    case 'view_stock':
      return `조회: ${name || code || ''}`
    case 'add_holding':
      return `종목 추가 (${code})`
    case 'update_holding':
      return '종목 수정'
    case 'remove_holding':
      return '종목 제거'
    default:
      return action
  }
}

export default function AdminPage() {
  const { user } = useAuth()
  const { replace } = useAppNavigation()
  const { isAdmin, ready: adminRoleReady } = useIsAdmin(user)

  const [users, setUsers] = useState<UserSummaryRow[]>([])
  const [logs, setLogs] = useState<ActivityLogRow[]>([])
  const [stockViews, setStockViews] = useState<UserStockViewRow[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [dataLoading, setDataLoading] = useState(true)

  useEffect(() => {
    if (!adminRoleReady) return
    if (!isAdmin) {
      replace('/stocks/000660')
    }
  }, [isAdmin, adminRoleReady, replace])

  const load = useCallback(async () => {
    setDataLoading(true)
    setLoadError(null)
    const [uRes, sRes, lRes, vRes] = await Promise.all([
      supabase.from('user_summary').select('*').order('last_activity_at', { ascending: false, nullsFirst: false }),
      supabase.from('user_settings').select('user_id, pro_enabled, ai_enabled'),
      supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('user_stock_views').select('*').order('view_count', { ascending: false }),
    ])
    let errMsg = ''
    if (uRes.error) errMsg = uRes.error.message
    if (sRes.error) errMsg = errMsg ? `${errMsg}; ${sRes.error.message}` : sRes.error.message
    if (lRes.error) errMsg = errMsg ? `${errMsg}; ${lRes.error.message}` : lRes.error.message
    if (vRes.error) errMsg = errMsg ? `${errMsg}; ${vRes.error.message}` : vRes.error.message
    setLoadError(errMsg || null)

    const settingsByUser = new Map(
      ((sRes.data as Array<{ user_id: string; pro_enabled?: boolean; ai_enabled?: boolean }>) ?? []).map(
        (s) => [s.user_id, s],
      ),
    )
    const mergedUsers = ((uRes.data as UserSummaryRow[]) ?? []).map((row) => {
      const id = userIdOfRow(row)
      const st = id ? settingsByUser.get(id) : undefined
      return {
        ...row,
        ai_enabled: row.ai_enabled ?? st?.ai_enabled ?? false,
        pro_enabled: row.pro_enabled ?? st?.pro_enabled ?? false,
      }
    })
    setUsers(mergedUsers)
    setLogs((lRes.data as ActivityLogRow[]) ?? [])
    setStockViews((vRes.data as UserStockViewRow[]) ?? [])
    setDataLoading(false)
  }, [])

  useEffect(() => {
    if (!adminRoleReady || !isAdmin) return
    void load()
  }, [isAdmin, adminRoleReady, load])

  const handleBlock = async (userId: string, email: string) => {
    if (!confirm(`${email} 계정을 차단할까요?\n차단 시 로그인 후 서비스 접근이 막힙니다. (복구 가능)`)) return
    try {
      await blockUser(userId)
      await load()
    } catch (e: unknown) {
      alert('차단 실패: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  const handleUnblock = async (userId: string) => {
    if (!confirm('이 계정 차단을 해제할까요?')) return
    try {
      await unblockUser(userId)
      await load()
    } catch (e: unknown) {
      alert('해제 실패: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  /** 활동 로그 이름 표시용 (full_name 우선은 헬퍼에서 처리) */
  const userInfoByUserId = useMemo(() => {
    const m = new Map<string, { full_name: string | null; email: string | null }>()
    for (const r of users) {
      const id = userIdOfRow(r)
      if (!id) continue
      const combined = (r.full_name || r.display_name || '').trim() || null
      m.set(id, { full_name: combined, email: r.email ?? null })
    }
    return m
  }, [users])

  const loginLogs = useMemo(
    () => logs.filter((a) => a.action === 'login').slice(0, 20),
    [logs],
  )
  const otherLogs = useMemo(
    () => logs.filter((a) => a.action !== 'login').slice(0, 20),
    [logs],
  )

  const stats = useMemo(() => {
    const totalUsers = users.length
    const totalHoldings = users.reduce((s, r) => s + (Number(r.holdings_count) || 0), 0)
    const t0 = seoulTodayStartMs()
    const activeToday = new Set(
      logs.filter((l) => new Date(l.created_at).getTime() >= t0).map((l) => l.user_id),
    ).size
    return { totalUsers, totalHoldings, activeToday }
  }, [users, logs])

  const stockViewsByUser = useMemo(() => {
    const acc: Record<string, UserStockViewRow[]> = {}
    for (const v of stockViews) {
      const uid = String(v.user_id ?? '')
      if (!uid) continue
      if (!acc[uid]) acc[uid] = []
      acc[uid].push(v)
    }
    return acc
  }, [stockViews])

  if (!adminRoleReady) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center text-sm text-secondary">
        확인 중…
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center text-sm text-secondary">
        이동 중…
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <h1 className="text-xl font-bold text-primary">관리자 대시보드</h1>
      <p className="mt-1 text-xs text-secondary">
        집계는 user_summary 기준입니다. 보유 평단·수량·평가금은 조회하지 않습니다.
      </p>

      {loadError ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{loadError}</p>
      ) : null}

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <StatCard label="총 사용자" value={stats.totalUsers} />
        <StatCard label="오늘 활성(서울일)" value={stats.activeToday} />
        <StatCard label="총 보유 종목 수" value={stats.totalHoldings} />
      </div>

      <ProAdminStats />

      <div className="mt-6">
        <StocksMasterSync />
      </div>

      {dataLoading ? (
        <div className="mt-10 flex justify-center text-secondary">
          <Loader2 className="size-8 animate-spin" aria-hidden />
        </div>
      ) : (
        <>
          <section className="mt-10">
            <h2 className="text-sm font-bold text-primary">사용자</h2>
            <ul className="mt-3 divide-y divide-default rounded-2xl border border-default bg-card">
              {users.length === 0 ? (
                <li className="px-4 py-6 text-sm text-secondary">데이터 없음</li>
              ) : (
                users.map((r) => {
                  const id = userIdOfRow(r)
                  const label = displayNameRow(r)
                  const initials = (label.slice(0, 2) || '??').toUpperCase()
                  const last = r.last_activity_at ? formatSeoul(r.last_activity_at) : '—'
                  const blocked = Boolean(r.is_blocked)
                  const showBlockControls =
                    Boolean(user?.id) && id && user != null && id !== user.id && !isAdminEmail(r.email)
                  const aiTier = r.ai_model === 'opus' ? 'opus' : 'sonnet'
                  const lockAiUi = isAdminEmail(r.email) || id === user?.id
                  const isSelf = Boolean(user?.id && id === user.id)
                  const adminOwnRow = isSelf && isAdmin
                  const aiOn = r.ai_enabled === true
                  const proOn = r.pro_enabled === true

                  return (
                    <li
                      key={id || label}
                      className={`flex items-center gap-3.5 px-[18px] py-3.5 ${blocked ? 'bg-neutral-bg/80 opacity-90' : ''}`}
                    >
                      {r.avatar_url ? (
                        <img
                          src={r.avatar_url}
                          alt=""
                          className="size-9 shrink-0 rounded-full bg-neutral-bg object-cover"
                        />
                      ) : (
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[11px] font-bold text-blue-800">
                          {initials}
                        </div>
                      )}
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-semibold tracking-tight text-gray-900">
                            {label}
                          </span>
                          {blocked ? (
                            <span className="shrink-0 rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-700">
                              차단됨
                            </span>
                          ) : null}
                          {adminOwnRow ? (
                            <span className="shrink-0 rounded bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
                              AI 활성 (관리자)
                            </span>
                          ) : blocked ? (
                            <>
                              <span
                                className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                                  aiOn ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-600'
                                }`}
                              >
                                {aiOn ? 'AI ON' : 'AI OFF'}
                              </span>
                              <span
                                className={`inline-flex shrink-0 items-center gap-0.5 rounded-md px-2 py-0.5 text-[10px] font-bold ${
                                  proOn ? 'bg-amber-500 text-white' : 'bg-gray-200 text-gray-500'
                                }`}
                              >
                                <Crown size={10} strokeWidth={2} aria-hidden />
                                PRO {proOn ? 'ON' : 'OFF'}
                              </span>
                            </>
                          ) : (
                            <>
                              <AiEnableToggle userId={id} enabled={aiOn} aiModel={aiTier} onUpdated={load} />
                              <ProEnableToggle userId={id} enabled={proOn} onUpdated={load} />
                            </>
                          )}
                        </div>
                        <span className="truncate text-xs tracking-tight text-gray-400">{r.email || '—'}</span>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <div className="flex items-center gap-2">
                          {lockAiUi ? (
                            <div
                              className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-600"
                              title="관리자 계정은 Opus 고정"
                            >
                              <Lock className="size-2.5 shrink-0" aria-hidden />
                              <span>Opus</span>
                            </div>
                          ) : blocked ? (
                            <span className="text-[11px] font-medium text-gray-400">
                              {aiTier === 'opus' ? 'Opus' : 'Sonnet'}
                            </span>
                          ) : aiOn ? (
                            <ModelToggle userId={id} currentModel={aiTier} onUpdated={load} />
                          ) : null}
                          {showBlockControls ? (
                            blocked ? (
                              <button
                                type="button"
                                onClick={() => void handleUnblock(id)}
                                className="rounded-md border border-green-300 bg-white px-3 py-1 text-[11px] font-medium text-green-700 hover:bg-green-50"
                              >
                                해제
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => void handleBlock(id, r.email || id)}
                                className="rounded-md border border-red-300 bg-white px-3 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50"
                              >
                                차단
                              </button>
                            )
                          ) : null}
                        </div>
                        <span className="text-[10px] tabular-nums tracking-tight text-gray-400">
                          마지막 {last}
                        </span>
                      </div>
                    </li>
                  )
                })
              )}
            </ul>
          </section>

          <section className="mt-10">
            <div className="flex items-center gap-2">
              <BarChart3 className="size-4 text-secondary" aria-hidden />
              <h2 className="text-sm font-bold text-primary">사용자별 종목 조회 (최근 7일)</h2>
            </div>
            <p className="mt-0.5 text-xs text-secondary">activity_logs · user_stock_views 집계</p>
            <div className="mt-3 space-y-3">
              {users
                .filter((u) => (stockViewsByUser[userIdOfRow(u)]?.length ?? 0) > 0)
                .map((u) => {
                  const id = userIdOfRow(u)
                  const userViews = stockViewsByUser[id] ?? []
                  const totalStocks = userViews.length
                  const totalViews = userViews.reduce((sum, v) => sum + (Number(v.view_count) || 0), 0)
                  const label = displayNameRow(u)
                  return (
                    <div
                      key={id || label}
                      className="rounded-2xl border border-default bg-card px-4 py-3 shadow-sm"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="truncate font-medium text-primary">{label}</span>
                          {isAdminEmail(u.email) ? (
                            <span className="shrink-0 rounded-full border border-default bg-neutral-bg px-2 py-0.5 text-[10px] font-medium text-secondary">
                              관리자
                            </span>
                          ) : null}
                        </div>
                        <span className="shrink-0 text-xs tabular-nums text-secondary">
                          {totalStocks}종목 · {totalViews}회
                        </span>
                      </div>
                      <ul className="mt-2 flex flex-wrap gap-1.5">
                        {userViews.slice(0, 10).map((v, i) => {
                          const vc = Number(v.view_count) || 0
                          const title = (v.name || v.code || '').trim() || '—'
                          return (
                            <li
                              key={`${v.code ?? ''}-${v.name ?? ''}-${i}`}
                              className="inline-flex max-w-full items-center gap-1 rounded-full bg-neutral-bg px-2.5 py-1 text-xs text-primary"
                            >
                              <span className="truncate">{title}</span>
                              {vc > 1 ? (
                                <span className="shrink-0 font-sans-en font-semibold tabular-nums text-secondary">
                                  {vc}
                                </span>
                              ) : null}
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  )
                })}
              {users.filter((u) => (stockViewsByUser[userIdOfRow(u)]?.length ?? 0) > 0).length === 0 ? (
                <p className="rounded-2xl border border-dashed border-default px-4 py-6 text-center text-sm text-secondary">
                  최근 7일간 종목 조회 기록 없음
                </p>
              ) : null}
            </div>
          </section>

          <ProViewStockLogs />

          <section className="mt-10">
            <h2 className="text-sm font-bold text-primary">최근 활동</h2>
            <p className="mt-0.5 text-xs text-secondary">카드별 최대 20건 · 전체는 최근 100건까지 조회</p>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <ActivityLogColumn
                title="로그인"
                icon={<LogIn size={14} className="text-blue-600" aria-hidden />}
                rows={loginLogs}
                userInfoByUserId={userInfoByUserId}
                describeAction={(a) => actionLabel(a.action, a.metadata)}
              />
              <ActivityLogColumn
                title="기타 활동"
                icon={<Activity size={14} className="text-gray-500" aria-hidden />}
                rows={otherLogs}
                userInfoByUserId={userInfoByUserId}
                describeAction={(a) => actionLabel(a.action, a.metadata)}
              />
            </div>
          </section>
        </>
      )}
    </div>
  )
}

function ActivityLogColumn({
  title,
  icon,
  rows,
  userInfoByUserId,
  describeAction,
}: {
  title: string
  icon: ReactNode
  rows: ActivityLogRow[]
  userInfoByUserId: Map<string, { full_name: string | null; email: string | null }>
  describeAction?: (a: ActivityLogRow) => string
}) {
  const count = rows.length
  return (
    <div className="rounded-2xl border border-default bg-card shadow-sm">
      <div className="flex items-center gap-2 border-b border-default px-4 py-3">
        {icon}
        <h3 className="text-sm font-bold text-primary">{title}</h3>
        <span className="ml-auto rounded-full bg-neutral-bg px-2 py-0.5 text-xs font-semibold tabular-nums text-secondary">
          {count}
        </span>
      </div>
      <ul className="divide-y divide-default">
        {rows.length === 0 ? (
          <li className="px-4 py-6 text-sm text-secondary">로그 없음</li>
        ) : (
          rows.map((a) => {
            const info = userInfoByUserId.get(a.user_id)
            return (
              <li key={a.id} className="flex items-baseline gap-2 px-4 py-2.5 text-sm">
                <span className="shrink-0 tabular-nums text-tertiary">{formatSeoul(a.created_at)}</span>
                <span className="min-w-0 flex-1 truncate font-medium text-primary">
                  {displayUserName(info, a.user_id)}
                </span>
                <span className="shrink-0 text-secondary">{describeAction ? describeAction(a) : a.action}</span>
              </li>
            )
          })
        )}
      </ul>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-default bg-card p-4 shadow-sm">
      <p className="text-xs font-medium text-secondary">{label}</p>
      <p className="mt-1 font-sans-en text-2xl font-bold tabular-nums text-primary">{value}</p>
    </div>
  )
}

type AiTier = 'opus' | 'sonnet'

function AiEnableToggle({
  userId,
  enabled,
  aiModel,
  onUpdated,
}: {
  userId: string
  enabled: boolean
  aiModel: AiTier
  onUpdated: () => Promise<void>
}) {
  const { user: actor } = useAuth()
  const [updating, setUpdating] = useState(false)

  const toggle = async () => {
    if (updating) return
    setUpdating(true)
    try {
      const next = !enabled
      const { error } = await supabase.from('user_settings').upsert(
        {
          user_id: userId,
          ai_enabled: next,
          ai_model: aiModel,
          set_by: actor?.id ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      )
      if (error) throw error
      await onUpdated()
    } catch (e: unknown) {
      alert('변경 실패: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setUpdating(false)
    }
  }

  return (
    <button
      type="button"
      disabled={updating}
      onClick={() => void toggle()}
      className={`rounded-full px-2 py-0.5 text-[10px] font-bold transition-opacity disabled:opacity-50 ${
        enabled ? 'bg-green-100 text-green-800 hover:bg-green-200' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
      }`}
    >
      {enabled ? 'AI ON' : 'AI OFF'}
    </button>
  )
}

function ProEnableToggle({
  userId,
  enabled,
  onUpdated,
}: {
  userId: string
  enabled: boolean
  onUpdated: () => Promise<void>
}) {
  const [updating, setUpdating] = useState(false)

  const toggle = async () => {
    if (updating) return
    setUpdating(true)
    try {
      const r = await authFetch(apiUrl('/api/admin-pro-toggle'), {
        method: 'POST',
        body: JSON.stringify({ userId, enabled: !enabled }),
      })
      if (!r.ok) {
        const body = (await r.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error || r.statusText)
      }
      await onUpdated()
    } catch (e: unknown) {
      alert('PRO 변경 실패: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setUpdating(false)
    }
  }

  return (
    <button
      type="button"
      disabled={updating}
      onClick={() => void toggle()}
      className={`inline-flex shrink-0 items-center gap-1 rounded-md px-2.5 py-1 text-[10px] font-bold transition-colors disabled:opacity-50 ${
        enabled ? 'bg-amber-500 text-white hover:bg-amber-600' : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
      }`}
    >
      <Crown size={11} strokeWidth={2} aria-hidden />
      <span>PRO {enabled ? 'ON' : 'OFF'}</span>
    </button>
  )
}

function ModelToggle({
  userId,
  currentModel,
  onUpdated,
}: {
  userId: string
  currentModel: AiTier
  onUpdated: () => Promise<void>
}) {
  const { user: actor } = useAuth()
  const [updating, setUpdating] = useState(false)

  const handleChange = async (newModel: AiTier) => {
    if (newModel === currentModel || updating) return
    setUpdating(true)
    try {
      const { error } = await supabase.from('user_settings').upsert(
        {
          user_id: userId,
          ai_model: newModel,
          set_by: actor?.id ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      )
      if (error) throw error
      await onUpdated()
    } catch (e: unknown) {
      alert('변경 실패: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setUpdating(false)
    }
  }

  return (
    <div className="inline-flex shrink-0 rounded-md border border-default bg-neutral-bg p-px">
      <button
        type="button"
        disabled={updating}
        onClick={() => void handleChange('opus')}
        className={`rounded px-2 py-0.5 text-[10px] transition-all ${
          currentModel === 'opus' ? 'bg-card font-medium text-primary shadow-sm' : 'text-secondary'
        }`}
      >
        Opus
      </button>
      <button
        type="button"
        disabled={updating}
        onClick={() => void handleChange('sonnet')}
        className={`rounded px-2 py-0.5 text-[10px] transition-all ${
          currentModel === 'sonnet' ? 'bg-card font-medium text-primary shadow-sm' : 'text-secondary'
        }`}
      >
        Sonnet
      </button>
    </div>
  )
}
