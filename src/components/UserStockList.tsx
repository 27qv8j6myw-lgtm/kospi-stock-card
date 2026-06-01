import { UserBadge } from './UserBadge'

export type UserStockItem = {
  userId?: string
  name?: string
  email?: string
  avatar?: string | null
  isAdmin?: boolean
  stocks: Array<{ code: string; name: string; count: number }>
  stockCount: number
  total: number
}

type UserStockListProps = {
  users?: UserStockItem[]
  emptyMessage?: string
}

export function UserStockList({ users, emptyMessage = '데이터 없음' }: UserStockListProps) {
  if (!users || users.length === 0) {
    return <div className="py-4 text-center text-[12px] text-gray-300">{emptyMessage}</div>
  }

  return (
    <div className="space-y-2">
      {users.map((u, i) => (
        <div
          key={u.userId || u.email || String(i)}
          className="rounded-lg border border-gray-100 p-3"
        >
          <div className="mb-2 flex items-center gap-2">
            <UserBadge
              name={u.name || u.email || '—'}
              email={u.email}
              avatar={u.avatar}
              size={24}
              showName
            />
            {u.isAdmin ? (
              <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold text-gray-500">
                관리자
              </span>
            ) : null}
            <span className="ml-auto shrink-0 text-[10px] text-gray-400">
              {u.stockCount}종목 · {u.total}회
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {u.stocks.map((s) => (
              <span
                key={s.code}
                className="rounded bg-gray-100 px-2 py-0.5 text-[11px] text-gray-700"
              >
                {s.name}
                {s.count > 1 ? <b className="ml-1">{s.count}</b> : null}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
