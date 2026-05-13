/**
 * 실적발표일·서프라이즈 요약 (1순위 KIND / 2순위 네이버 IR — 추후 연동, 현재 시드+회계일 추정)
 */

function pad2(n) {
  return String(n).padStart(2, '0')
}

/** @param {Date} d */
function kstParts(d) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const m = { y: 0, mo: 0, day: 0, wd: '', hh: 0, mi: 0 }
  for (const p of fmt.formatToParts(d)) {
    if (p.type === 'year') m.y = +p.value
    if (p.type === 'month') m.mo = +p.value
    if (p.type === 'day') m.day = +p.value
    if (p.type === 'weekday') m.wd = p.value
    if (p.type === 'hour') m.hh = +p.value
    if (p.type === 'minute') m.mi = +p.value
  }
  return m
}

/** 캘린더 일수 차이 (KST 기준, event 일자 − today 일자) */
function dayDiffKst(now, event) {
  const a = kstParts(now)
  const b = kstParts(event)
  const t0 = Date.UTC(a.y, a.mo - 1, a.day)
  const t1 = Date.UTC(b.y, b.mo - 1, b.day)
  return Math.round((t1 - t0) / 86_400_000)
}

function atKstHm(y, mo, d, hh, mi) {
  return new Date(`${y}-${pad2(mo)}-${pad2(d)}T${pad2(hh)}:${pad2(mi)}:00+09:00`)
}

function addCalendarDaysKst(isoDate, days) {
  const p = kstParts(isoDate)
  const t = Date.UTC(p.y, p.mo - 1, p.day) + days * 86_400_000
  const d = new Date(t)
  const q = kstParts(d)
  return atKstHm(q.y, q.mo, q.day, 15, 30)
}

/** fiscal 12월 결산 가정: 분기말 → 대략 +35일에 발표(추정) */
function estimateNextEarningsFromFiscalDec(now) {
  const { y, mo, day } = kstParts(now)
  const todayUtc = Date.UTC(y, mo - 1, day)
  const ends = [
    [3, 31],
    [6, 30],
    [9, 30],
    [12, 31],
  ]
  for (let yi = y; yi <= y + 1; yi++) {
    for (const [m, d] of ends) {
      const t = Date.UTC(yi, m - 1, d)
      if (t >= todayUtc) {
        const qe = atKstHm(yi, m, d, 15, 30)
        return addCalendarDaysKst(qe, 35)
      }
    }
  }
  return null
}

function mean(arr) {
  if (!arr.length) return null
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

function barDayUtcMs(ts) {
  const s = String(ts ?? '').replace(/\D/g, '')
  if (s.length >= 8) {
    const y = +s.slice(0, 4)
    const m = +s.slice(4, 6)
    const d = +s.slice(6, 8)
    return Date.UTC(y, m - 1, d)
  }
  const t = Date.parse(String(ts))
  return Number.isFinite(t) ? t : NaN
}

function announceDayUtcMs(centerIso) {
  const d = new Date(centerIso)
  if (Number.isNaN(d.getTime())) return NaN
  const p = kstParts(d)
  return Date.UTC(p.y, p.mo - 1, p.day)
}

/**
 * 직전 발표일 전후 window 거래일 구간의 일간 절대수익률 평균(%)
 * @param {{ ts: string, close: number }[]} bars
 */
function avgAbsReturnAroundDate(bars, centerIso, windowDays = 5) {
  if (!bars.length || !centerIso) return null
  const targetDay = announceDayUtcMs(centerIso)
  if (!Number.isFinite(targetDay)) return null
  const withT = bars
    .map((b, i) => {
      const day = barDayUtcMs(b.ts)
      return { i, day, close: b.close }
    })
    .filter((x) => Number.isFinite(x.day) && x.close > 0)
  if (!withT.length) return null
  let best = 0
  let bestDiff = Infinity
  for (let k = 0; k < withT.length; k++) {
    const diff = Math.abs(withT[k].day - targetDay)
    if (diff < bestDiff) {
      bestDiff = diff
      best = k
    }
  }
  const lo = Math.max(0, best - windowDays)
  const hi = Math.min(withT.length - 1, best + windowDays)
  const rets = []
  for (let i = lo + 1; i <= hi; i++) {
    const a = withT[i - 1].close
    const b = withT[i].close
    if (a > 0) rets.push(Math.abs(((b - a) / a) * 100))
  }
  return mean(rets)
}

/** 삼성전자 등 검증용 시드 — 운영 시 KIND/네이버로 교체 */
const EARNINGS_SEED = {
  '005930': {
    /** 다음 실적(2026 Q2 잠정·추정 일정) */
    nextIso: '2026-07-31T15:30:00+09:00',
    timeSlotKo: '장마감 후',
    preferProvisional: true,
    lastAnnounceIso: '2026-04-30T15:30:00+09:00',
    prevQuarterLabel: '2026년 1분기',
    prevSurprise: { pct: 8.2, basis: 'op', miss: false, consensusAvailable: true },
    surpriseHistoryPct: [-2.1, 5.4, 3.0, 8.2],
    nextConsensus: { salesEok: 77, opEok: 6.9, eps: 1050 },
  },
}

function weekdayKo(d) {
  const w = kstParts(d).wd
  const map = { Mon: '월', Tue: '화', Wed: '수', Thu: '목', Fri: '금', Sat: '토', Sun: '일' }
  return map[w] ?? w
}

function formatPrimaryAndStrip(eventDate, now) {
  const d = dayDiffKst(now, eventDate)
  const { mo, day } = kstParts(eventDate)
  const mmdd = `${pad2(mo)}/${pad2(day)}`
  const hm = `${pad2(kstParts(eventDate).hh)}:${pad2(kstParts(eventDate).mi)}`
  const wk = weekdayKo(eventDate)

  if (d < 0) {
    return {
      primary: `${mmdd} 예정`,
      riskStrip: 'neutral',
      riskBadge: undefined,
      valueEmphasis: 'muted',
    }
  }
  if (d === 0) {
    return {
      primary: `오늘 발표 (${hm} · ${wk})`,
      riskStrip: 'danger',
      riskBadge: '발표 임박 · 변동성 주의',
      valueEmphasis: 'danger',
    }
  }
  if (d === 1) {
    return {
      primary: '내일 발표',
      riskStrip: 'danger',
      riskBadge: '발표 임박 · 변동성 주의',
      valueEmphasis: 'danger',
    }
  }
  if (d <= 3) {
    return {
      primary: `D-${d} (${hm} · ${wk})`,
      riskStrip: 'danger',
      riskBadge: '발표 임박 · 변동성 주의',
      valueEmphasis: 'danger',
    }
  }
  if (d <= 14) {
    return {
      primary: `D-${d} (${mmdd})`,
      riskStrip: 'warning',
      riskBadge: undefined,
      valueEmphasis: 'warning',
    }
  }
  if (d <= 30) {
    return {
      primary: `D-${d} (${mmdd})`,
      riskStrip: 'neutral',
      riskBadge: undefined,
      valueEmphasis: 'muted',
    }
  }
  return {
    primary: `${mmdd} 예정`,
    riskStrip: 'neutral',
    riskBadge: undefined,
    valueEmphasis: 'muted',
  }
}

function formatSubLine(seed) {
  if (!seed?.prevSurprise) {
    return { text: '직전 분기 서프라이즈: 증권사 컨센서스 연동 예정', emphasis: 'default' }
  }
  const ps = seed.prevSurprise
  if (ps.consensusAvailable) {
    const basis = ps.basis === 'eps' ? 'EPS' : '영업이익'
    if (ps.miss) {
      const t = `직전 ${ps.pct >= 0 ? '+' : ''}${ps.pct.toFixed(1)}% 미스 (${basis})`
      return { text: t, emphasis: 'danger' }
    }
    const t = `직전 ${ps.pct >= 0 ? '+' : ''}${ps.pct.toFixed(1)}% 서프라이즈 (${basis})`
    return { text: t, emphasis: 'default' }
  }
  if (seed.fallbackNoConsensus) {
    const { opEok, yoyOpPct } = seed.fallbackNoConsensus
    return {
      text: `직전 영업익 ${opEok.toFixed(1)}조 (YoY ${yoyOpPct >= 0 ? '+' : ''}${yoyOpPct.toFixed(1)}%)`,
      emphasis: 'default',
    }
  }
  return { text: '직전 분기: 컨센서스 대비 데이터 연동 예정', emphasis: 'default' }
}

/**
 * @param {string} code6
 * @param {{ ts: string, open: number, high: number, low: number, close: number, volume: number }[]} stockBars
 */
export async function buildEarningsIntel(code6, stockBars) {
  const code = String(code6).replace(/\D/g, '').padStart(6, '0')
  const now = new Date()
  const seed = EARNINGS_SEED[code]
  let eventDate = seed?.nextIso ? new Date(seed.nextIso) : estimateNextEarningsFromFiscalDec(now)
  let sourceLine = seed ? '시드(삼성전자 일정·서프라이즈 예시) + 백테스트 변동성' : '회계 분기말+35일 추정(미공시 대체)'

  if (!eventDate || Number.isNaN(eventDate.getTime())) {
    return {
      earningsPrimary: '예정일 미공시',
      earningsSub: seed ? formatSubLine(seed).text : 'KIND·네이버 IR 연동 시 자동 표시',
      earningsSubEmphasis: 'default',
      earningsRiskStrip: 'neutral',
      earningsRiskBadge: undefined,
      earningsValueEmphasis: 'muted',
      earningsDetailForDrawer: [
        '다음 실적일이 거래소·공시망에 아직 반영되지 않았습니다.',
        '1순위: KIND 공시 캘린더, 2순위: 네이버 금융 IR 일정.',
      ].join('\n'),
      earningsSparkline: seed?.surpriseHistoryPct ?? [],
      earningsSeverity: 'neutral',
    }
  }

  const ui = formatPrimaryAndStrip(eventDate, now)
  const sub = formatSubLine(seed)

  const vol5 = avgAbsReturnAroundDate(stockBars, seed?.lastAnnounceIso ?? null, 5)
  const spark = seed?.surpriseHistoryPct ?? []

  const drawer = [
    `데이터 출처: ${sourceLine}`,
    '',
    '【다음 분기 컨센서스 (참고)】',
    seed?.nextConsensus
      ? `매출 약 ${seed.nextConsensus.salesEok}조원 · 영업이익 약 ${seed.nextConsensus.opEok}조원 · EPS 약 ${seed.nextConsensus.eps.toLocaleString('ko-KR')}원 (증권사 평균 추정치·예시)`
      : 'FnGuide/WiseFn 연동 시 자동 표기',
    '',
    `발표 시간대: ${seed?.timeSlotKo ?? '미정(통상 장마감 후 또는 장중 별도 공지)'}`,
    seed?.preferProvisional ? '잠정실적 공시가 있으면 확정보다 우선 표시하도록 설계(데이터 연동 시).' : '',
    '',
    '【직전 4개 분기 서프라이즈 추이 (컨센 대비 %)】',
    spark.length
      ? spark.map((x) => `${x >= 0 ? '+' : ''}${x.toFixed(1)}%`).join(' → ')
      : '분기별 컨센서스 스냅샷 연동 예정',
    '',
    vol5 != null
      ? `직전 발표 전후 ±5거래일 평균 절대일간 변동: ${vol5.toFixed(2)}% (차트 기반 백테스트)`
      : '발표 전후 변동성: 차트·발표일 매칭 후 표시',
  ]
    .filter(Boolean)
    .join('\n')

  return {
    earningsPrimary: ui.primary,
    earningsSub: sub.text,
    earningsSubEmphasis: sub.emphasis,
    earningsRiskStrip: ui.riskStrip,
    earningsRiskBadge: ui.riskBadge,
    earningsValueEmphasis: ui.valueEmphasis,
    earningsDetailForDrawer: drawer,
    earningsSparkline: spark,
    earningsSeverity: ui.riskStrip === 'danger' ? 'danger' : ui.riskStrip === 'warning' ? 'caution' : 'neutral',
  }
}

export function extractSpecialAlertsFromKisRaw(raw) {
  if (!raw || typeof raw !== 'object') return []
  const hay = JSON.stringify(raw)
  const rules = [
    [/거래정지|거래재개|정지\s*종목/i, '시세 필드에 거래정지·재개 관련 표기가 있습니다. 공시 원문을 확인하세요.'],
    [/단기과열|투자주의|투자경고|투자위험/i, '투자주의·단기과열 등 경고 구간 표시가 있습니다.'],
    [/관리종목/i, '관리종목 지정·유사 표시가 있습니다.'],
    [/상장폐지\s*실질|정리매매/i, '상장폐지 실질심사·정리매매 관련 키워드가 감지되었습니다.'],
    [/불성실\s*공시/i, '불성실공시 지정 등 표시가 있습니다.'],
  ]
  const out = []
  for (const [re, msg] of rules) {
    if (re.test(hay)) out.push(msg)
  }
  return [...new Set(out)]
}
