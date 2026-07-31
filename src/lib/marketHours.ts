function kstMinutes(now: Date): { day: number; time: number } {
  const kst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
  return { day: kst.getDay(), time: kst.getHours() * 60 + kst.getMinutes() }
}

/** KRX 정규장(09:00~15:30) — 실시간 폴링 주기 제한용 */
export function isKrxMarketOpen(now = new Date()): boolean {
  const { day, time } = kstMinutes(now)
  if (day === 0 || day === 6) return false
  return time >= 9 * 60 && time <= 15 * 60 + 30
}

/**
 * 표시 시세가 움직이는 전체 구간 (KRX 정규장 + NXT 프리마켓 08:00~, 애프터마켓 ~20:00).
 * 현재가를 KRX·NXT 통합으로 조회하므로 이 시간대에는 폴링할 값이 있다.
 */
export function isDomesticTradingHours(now = new Date()): boolean {
  const { day, time } = kstMinutes(now)
  if (day === 0 || day === 6) return false
  return time >= 8 * 60 && time <= 20 * 60
}

/**
 * 표시 가격에 붙일 시점 라벨. 정규장 중에는 빈 문자열.
 * NXT 시간외에는 종가가 아니라 시간외 체결가이므로 구분해서 보여준다.
 */
export function priceTimeLabel(now = new Date()): '' | '시간외' | '종가' {
  if (isKrxMarketOpen(now)) return ''
  return isDomesticTradingHours(now) ? '시간외' : '종가'
}

/** 배지용 라벨. NXT 시간외가 아니면 null */
export function nxtOffHoursLabel(now = new Date()): string | null {
  return priceTimeLabel(now) === '시간외' ? 'NXT 시간외' : null
}
