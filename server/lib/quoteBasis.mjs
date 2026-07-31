/**
 * 표시용 시세(KRX+NXT 통합)가 정규장 종가와 달라지는 시간대를 판정한다.
 * 정규장(09:00~15:30) 중에는 통합가와 KRX 가격이 사실상 같아 라벨을 붙이지 않는다.
 */

/** NXT 프리마켓 08:00~08:50, 애프터마켓 15:30~20:00 (경계 여유 포함) */
const PRE_MARKET = { from: 8 * 60, to: 9 * 60 }
const AFTER_MARKET = { from: 15 * 60 + 30, to: 20 * 60 }

/**
 * @param {Date} [now]
 * @returns {{ weekday: number, minutes: number }} weekday 는 일요일 0
 */
function seoulClock(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now)

  const get = (type) => parts.find((p) => p.type === type)?.value ?? ''
  const weekdayIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'))
  const hour = Number(get('hour'))
  const minute = Number(get('minute'))

  return {
    weekday: weekdayIndex,
    minutes: (Number.isFinite(hour) ? hour % 24 : 0) * 60 + (Number.isFinite(minute) ? minute : 0),
  }
}

/**
 * 지금이 NXT 시간외 구간인지
 * @param {Date} [now]
 */
export function isNxtOffHours(now = new Date()) {
  const { weekday, minutes } = seoulClock(now)
  if (weekday === 0 || weekday === 6) return false
  const inRange = (r) => minutes >= r.from && minutes < r.to
  return inRange(PRE_MARKET) || inRange(AFTER_MARKET)
}

/**
 * 화면에 붙일 시세 기준 라벨. 정규장 중이거나 KRX 단독 조회면 null.
 * @param {string | null | undefined} marketDiv 실제 조회에 쓰인 시장분류코드
 * @param {Date} [now]
 * @returns {string | null}
 */
export function quoteBasisLabel(marketDiv, now = new Date()) {
  if (!marketDiv || marketDiv === 'J') return null
  return isNxtOffHours(now) ? 'NXT 시간외' : null
}
