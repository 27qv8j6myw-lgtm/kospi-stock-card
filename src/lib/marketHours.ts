/** KRX 정규장(09:00~15:30) — 실시간 폴링 주기 제한용 */
export function isKrxMarketOpen(now = new Date()): boolean {
  const kst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
  const day = kst.getDay()
  if (day === 0 || day === 6) return false

  const time = kst.getHours() * 60 + kst.getMinutes()
  return time >= 9 * 60 && time <= 15 * 60 + 30
}
