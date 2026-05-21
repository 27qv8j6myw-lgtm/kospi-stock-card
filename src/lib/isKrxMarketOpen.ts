const SESSION_START_MIN = 9 * 60
const SESSION_END_MIN = 15 * 60 + 30

function kstWeekday(now: Date): number {
  const wd = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', weekday: 'short' }).format(now)
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return map[wd] ?? 1
}

function kstMinutes(now: Date): number {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const [hh, mm] = fmt.format(now).split(':').map((x) => parseInt(x, 10))
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return 12 * 60
  return hh * 60 + mm
}

/** KRX 정규장(09:00~15:30 KST, 월~금) 개장 여부 */
export function isKrxMarketOpen(now = new Date()): boolean {
  const day = kstWeekday(now)
  if (day === 0 || day === 6) return false
  const mins = kstMinutes(now)
  return mins >= SESSION_START_MIN && mins <= SESSION_END_MIN
}
