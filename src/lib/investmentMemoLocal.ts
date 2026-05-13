import type {
  DetailedBriefingInput,
  DetailedInvestmentMemoResult,
  NewsItem,
} from '../types/aiBriefing'
import type { AIBriefingTone } from '../types/aiBriefing'
import { formatKrwAmountToEok } from './signalLogic'

export function memoFmtWon(n: number): string {
  if (!Number.isFinite(n)) return '—'
  return `${Math.round(n).toLocaleString('ko-KR')}원`
}

/** 등락률·상승여력 등: +21.51%, -0.75%, 0.00% */
export function memoFmtPctSigned(n: number): string {
  if (!Number.isFinite(n)) return '—'
  if (Math.abs(n) < 1e-6) return '0.00%'
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(2)}%`
}

function memoFmtPer(n: number | undefined): string {
  if (n == null || !Number.isFinite(n)) return '데이터 없음'
  return `${n.toFixed(1)}배`
}

function memoFmtEpsGrowth(n: number | undefined): string {
  if (n == null || !Number.isFinite(n)) return '데이터 없음'
  return memoFmtPctSigned(n)
}

function resolveConsensusUpsides(input: DetailedBriefingInput): {
  avgPct: number
  maxPct: number
} | null {
  const { currentPrice, consensusAvgTargetPrice, consensusMaxTargetPrice } = input
  if (
    !consensusAvgTargetPrice ||
    !consensusMaxTargetPrice ||
    !Number.isFinite(currentPrice) ||
    currentPrice <= 0
  ) {
    return null
  }
  const avgPct =
    input.consensusUpsideAvgPct ??
    ((consensusAvgTargetPrice / currentPrice) - 1) * 100
  const maxPct =
    input.consensusUpsideMaxPct ??
    ((consensusMaxTargetPrice / currentPrice) - 1) * 100
  return {
    avgPct: Number(avgPct.toFixed(2)),
    maxPct: Number(maxPct.toFixed(2)),
  }
}

function sortNewsDesc(news: NewsItem[]): NewsItem[] {
  return [...news].sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)))
}

function buildParagraph1(input: DetailedBriefingInput, ups: ReturnType<typeof resolveConsensusUpsides>): string {
  const {
    stockName,
    stockCode,
    currentPrice,
    previousClose,
    changePct,
    intradayHigh,
    intradayLow,
    high52w,
    isNear52wHigh,
    consensusAvgTargetPrice,
    consensusMaxTargetPrice,
  } = input

  const parts: string[] = []
  parts.push(
    `${stockName}(${stockCode}) 기준 현재가는 ${memoFmtWon(currentPrice)}이고, 전일 대비 등락률은 ${memoFmtPctSigned(changePct)}입니다.`,
  )

  if (typeof previousClose === 'number' && previousClose > 0 && Number.isFinite(previousClose)) {
    parts.push(`직전 종가는 ${memoFmtWon(previousClose)}로 집계됩니다.`)
  }

  if (intradayHigh != null && intradayLow != null && Number.isFinite(intradayHigh) && Number.isFinite(intradayLow)) {
    parts.push(`당일·최근 시세 기준으로 장중 고가 ${memoFmtWon(intradayHigh)}, 저가 ${memoFmtWon(intradayLow)}까지 형성된 구간입니다.`)
  } else if (intradayHigh != null && Number.isFinite(intradayHigh)) {
    parts.push(`장중 고가는 ${memoFmtWon(intradayHigh)}까지 확인됩니다.`)
  }

  if (high52w != null && high52w > 0 && Number.isFinite(high52w)) {
    const gapTo52 = ((high52w - currentPrice) / currentPrice) * 100
    if (isNear52wHigh || gapTo52 <= 2) {
      parts.push(
        `52주 신고가 ${memoFmtWon(high52w)}에 근접해 있어, 박스 상단에서의 체결·차익실현 변동성을 염두에 둘 만한 자리입니다.`,
      )
    } else {
      parts.push(`52주 신고가는 ${memoFmtWon(high52w)} 수준이며, 현재가와의 괴리는 약 ${memoFmtPctSigned(gapTo52)}입니다.`)
    }
  } else {
    parts.push('52주 신고가 원천데이터는 본 패널 입력에 없어, 고가·저가는 당일·최근 시세 범위 안에서만 해석했습니다.')
  }

  if (ups && consensusAvgTargetPrice && consensusMaxTargetPrice) {
    parts.push(
      `증권사 컨센서스는 평균 목표가 ${memoFmtWon(consensusAvgTargetPrice)}, 최고 목표가 ${memoFmtWon(consensusMaxTargetPrice)}로 잡혀 있고, 현재가 대비 평균 목표가까지 상승여력은 약 ${memoFmtPctSigned(ups.avgPct)}, 최고 목표가까지는 약 ${memoFmtPctSigned(ups.maxPct)}로 계산됩니다.`,
    )
    if (currentPrice > consensusAvgTargetPrice) {
      parts.push(
        '현재가는 컨센서스 평균 목표가를 이미 넘어선 상태라, 추가 상승은 실적 서프라이즈나 수급 모멘텀이 필요합니다.',
      )
    } else if (ups.avgPct < 8) {
      parts.push('컨센서스 기준 상승여력은 크지 않아 단기 모멘텀 중심으로 봐야 합니다.')
    } else if (ups.avgPct < 15) {
      parts.push('1개월 +15% 목표 전략 기준으로는 목표 구간에 근접한 상승여력이 남아 있습니다.')
    } else {
      parts.push('컨센서스 기준으로도 15% 이상 여력이 남아 있어 중기 기대감은 유지됩니다.')
    }
  } else {
    parts.push(
      '컨센서스 평균·최고 목표가는 이번 데이터에 포함되어 있지 않습니다. 목표가 밴드·상승여력은 외부 리포트로 별도 확인하시기 바랍니다.',
    )
  }

  return parts.join(' ')
}

function newsCauseSentence(n: NewsItem, stockName: string): string {
  const cat =
    n.category === 'target'
      ? '목표가·리레이팅'
      : n.category === 'earnings'
        ? '실적·가이던스'
        : n.category === 'order'
          ? '수주·백로그'
          : n.category === 'macro'
            ? '매크로·금리·환율'
            : n.category === 'supply'
              ? '수급·대형 매매'
              : n.category === 'sector'
                ? '섹터·업황'
                : n.category === 'valuation'
                  ? '밸류에이션'
                  : '이슈'
  return `${n.publishedAt} 경로의 ${cat} 흐름으로, "${n.summary}" 내용이 ${stockName} 주가 논의에서 변수로 작용했을 가능성이 있습니다.`
}

function buildParagraph2(input: DetailedBriefingInput): string {
  const sorted = sortNewsDesc(input.news)
  if (!sorted.length) {
    return `${input.stockName}에 대해 브리핑용 샘플 뉴스가 연결되어 있지 않아, 최근 주가 트리거는 시세·수급·공시를 별도로 확인해야 합니다.`
  }

  const targetHits = sorted.filter((n) => n.category === 'target')
  const primary = sorted[0]!
  const secondary = sorted[1]

  const chunks: string[] = []
  chunks.push(newsCauseSentence(primary, input.stockName))

  if (secondary && secondary.title !== primary.title) {
    chunks.push(newsCauseSentence(secondary, input.stockName))
  }

  if (targetHits.length) {
    const t = targetHits[0]!
    chunks.push(
      `목표가 상향·밴드 조정 이슈로는 "${t.summary}"가 붙어 있어, 밸류에이션 재평가 기대가 단기 캔들에 반영됐을 여지가 있습니다.`,
    )
  }

  const earn = sorted.find((n) => n.category === 'earnings')
  if (earn && earn !== primary && earn !== secondary) {
    chunks.push(`실적 쪽에서는 "${earn.summary}"가 추가 레이어로 겹친 상태로 읽힙니다.`)
  }

  const macro = sorted.find((n) => n.category === 'macro')
  if (macro) {
    chunks.push(`매크로 측면에서는 "${macro.summary}"가 베타·섹터 로테이션에 영향을 줄 수 있는 요인입니다.`)
  }

  return chunks.join(' ')
}

function buildParagraph3(input: DetailedBriefingInput): string {
  const { trailingPER, forwardPER, forwardEPSGrowthPct, valuationScore } = input
  const parts: string[] = []
  parts.push(
    `밸류에이션은 trailing PER ${memoFmtPer(trailingPER)}, forward PER ${memoFmtPer(forwardPER)} 기준이고, EPS 성장률(가용 시)은 ${memoFmtEpsGrowth(forwardEPSGrowthPct)}로 입력되어 있습니다.`,
  )
  parts.push(`내부 밸류 점수는 ${valuationScore}점대로 분류됩니다.`)

  const ups = resolveConsensusUpsides(input)
  if (ups && input.consensusAvgTargetPrice) {
    parts.push(
      `컨센서스 평균 목표가까지의 여력 ${memoFmtPctSigned(ups.avgPct)}는 실적·수주가 컨센을 따라올지 여부와 맞물려 해석됩니다.`,
    )
  }

  return parts.join(' ')
}

function buildParagraph4(input: DetailedBriefingInput, ups: ReturnType<typeof resolveConsensusUpsides>): string {
  const {
    foreignNetAmount3D,
    institutionNetAmount3D,
    retailNetAmount3D,
    rsi14,
    atrDistance,
    currentPrice,
    consensusAvgTargetPrice,
    changePct,
  } = input

  const f = foreignNetAmount3D ?? 0
  const i = institutionNetAmount3D ?? 0
  const r = retailNetAmount3D ?? 0

  const parts: string[] = []
  parts.push(
    `최근 3거래일 순매수 추정은 외국인 ${formatKrwAmountToEok(f)}, 기관 ${formatKrwAmountToEok(i)}, 개인 ${formatKrwAmountToEok(r)}입니다.`,
  )
  parts.push(`RSI(14)는 ${rsi14.toFixed(1)}이고, ATR 이격 지표는 ${atrDistance.toFixed(2)}로 들어와 있습니다.`)

  if (rsi14 >= 75) {
    parts.push('RSI가 75를 넘어서 단기 과열 부담이 있습니다.')
  }
  if (atrDistance >= 3.5) {
    parts.push('ATR 이격이 커진 상태라 추격매수보다는 눌림 확인이 유리합니다.')
  }

  if (changePct >= 5) {
    parts.push(`전일 대비 ${memoFmtPctSigned(changePct)}로 변동폭이 커서, 단기 차익실현 매물이 나올 수 있는 온도입니다.`)
  }

  if (ups && consensusAvgTargetPrice && currentPrice > consensusAvgTargetPrice) {
    parts.push('가격이 평균 컨센서스 목표가 위에 있어, 밴드 대비 "이미 반영된 기대" 논쟁이 붙기 쉽습니다.')
  }

  return parts.join(' ')
}

function buildParagraph5(input: DetailedBriefingInput): string {
  const { entryDecision, strategy } = input
  const parts: string[] = []
  parts.push(
    `3개월·+15% 전략 카드 기준 진입 판단은 "${entryDecision}"에 가깝고, 시그널 전략 라벨은 ${strategy}로 정리됩니다.`,
  )
  parts.push(
    '손절은 시스템이 제시한 스탑 구간을 먼저 확인하고, +9% 부근 분할익절·최종 +15% 목표는 규칙대로 분리해 관리하는 편이 맞습니다.',
  )

  if (entryDecision === '신규진입 가능' || entryDecision === '신규 매수') {
    parts.push('추격보다는 호가·거래량 확인 후 분할 매수를 염두에 두는 쪽이 리스크 대비 효율이 나을 수 있습니다.')
  } else if (entryDecision === '적극 매수') {
    parts.push('펀더멘털이 견조할 때는 단기 과열 구간에서도 비중 상한 내 분할 적극 진입을 검토할 수 있습니다.')
  } else if (entryDecision === '눌림 대기') {
    parts.push('지지·거래대금이 붙는 눌림이 나올 때까지 기다리는 시나리오가 전제에 가깝습니다.')
  } else if (entryDecision === '분할 매수') {
    parts.push('비중 절반·손절 타이트 전제로 지지 확인 후 분할 접근이 리스크 대비 균형에 맞습니다.')
  } else if (entryDecision === '관망' || entryDecision === '관망 (과열)') {
    parts.push('신규 비중 확대보다는 이벤트·실적 확인 후 재평가 쪽이 메모 톤과 맞습니다.')
  } else if (entryDecision === '분할익절' || entryDecision === '분할 익절' || entryDecision === '전량 익절') {
    parts.push('과열·익절 구간에 가깝다면 신규보다는 보유 비중 정리·분할 매도를 우선 점검할 만합니다.')
  } else if (entryDecision === '보유 유지') {
    parts.push('추가 매수보다는 기존 포지션의 손절·익절 규칙 준수가 중심이 됩니다.')
  } else {
    parts.push('제외·방어 쪽 판단이면 신규 탐색은 보류하고 포트 리스크를 줄이는 쪽이 맞습니다.')
  }

  return parts.join(' ')
}

function deriveTone(input: DetailedBriefingInput): AIBriefingTone {
  const { rsi14, atrDistance, entryDecision, finalScore } = input
  if (
    rsi14 >= 75 ||
    atrDistance >= 3.5 ||
    entryDecision === '분할익절' ||
    entryDecision === '분할 익절' ||
    entryDecision === '전량 익절' ||
    entryDecision === '제외' ||
    entryDecision === '회피' ||
    entryDecision === '관망 (과열)' ||
    (entryDecision === '관망' && finalScore < 65)
  ) {
    return 'caution'
  }
  if (finalScore >= 78 && rsi14 < 73 && (entryDecision === '신규진입 가능' || entryDecision === '보유 유지' || entryDecision === '신규 매수' || entryDecision === '적극 매수')) {
    return 'bullish'
  }
  return 'neutral'
}

function buildKeyPoints(input: DetailedBriefingInput, ups: ReturnType<typeof resolveConsensusUpsides>): string[] {
  const pts: string[] = []
  pts.push(
    `현재가 ${memoFmtWon(input.currentPrice)}, 등락률 ${memoFmtPctSigned(input.changePct)}, RSI ${input.rsi14.toFixed(1)}, ATR 이격 ${input.atrDistance.toFixed(2)}`,
  )
  if (ups) {
    pts.push(`컨센 평균 대비 여력 약 ${memoFmtPctSigned(ups.avgPct)}, 최고 목표 대비 약 ${memoFmtPctSigned(ups.maxPct)}`)
  }
  pts.push(
    `3일 수급: 외인 ${formatKrwAmountToEok(input.foreignNetAmount3D ?? 0)}, 기관 ${formatKrwAmountToEok(input.institutionNetAmount3D ?? 0)}, 개인 ${formatKrwAmountToEok(input.retailNetAmount3D ?? 0)}`,
  )
  pts.push(`점수 요약 — 최종 ${input.finalScore}, 실행 ${input.executionScore}, 수급 ${input.supplyScore}, 밸류 ${input.valuationScore}`)
  pts.push(`Trailing PER ${memoFmtPer(input.trailingPER)}, Forward PER ${memoFmtPer(input.forwardPER)}, EPS 성장률 ${memoFmtEpsGrowth(input.forwardEPSGrowthPct)}`)
  pts.push(`전략 라벨 ${input.strategy}, 3M 진입 "${input.entryDecision}"`)
  return pts.slice(0, 7)
}

function buildRisks(input: DetailedBriefingInput, ups: ReturnType<typeof resolveConsensusUpsides>): string[] {
  const out: string[] = []
  if (input.rsi14 >= 75) out.push(`RSI ${input.rsi14.toFixed(1)} — 단기 과열·되돌림 가능성`)
  if (input.atrDistance >= 3.5) out.push(`ATR 이격 ${input.atrDistance.toFixed(2)} — 변동성 확대 구간`)
  if (input.executionScore < 45) out.push(`실행 점수 ${input.executionScore} — 추격 진입 구조가 불리할 수 있음`)
  if (ups && ups.avgPct < 5 && input.consensusAvgTargetPrice) {
    out.push(`컨센 평균 대비 여력 ${memoFmtPctSigned(ups.avgPct)} — 밴드 상단 여유가 좁음`)
  }
  if (input.changePct >= 6) out.push(`당일·최근 등락 ${memoFmtPctSigned(input.changePct)} — 차익실현 매물 유입 가능`)
  if (input.valuationScore < 48) out.push(`밸류 점수 ${input.valuationScore} — 기대 선반영·실적 부담 논쟁`)
  if (!out.length) out.push('특이 리스크 헤드라인은 제한적이나, 지수·환율 베타는 항상 열어둘 필요가 있음')
  return out.slice(0, 5)
}

function buildStrategyComment(input: DetailedBriefingInput): string {
  const { entryDecision, strategy } = input
  return [
    `지금 시그널은 ${strategy}이며, 3개월 +15% 관점의 진입 메모는 "${entryDecision}"에 가깝습니다.`,
    '손절선 이탈 시에는 규칙대로 정리하고, +9% 부근에서 분할익절·최종 +15% 목표는 별도로 관리하는 흐름이 맞습니다.',
    '확정 매수·매도 판단은 아니며, 체결 호가·체결강도·당일 시세를 함께 확인하신 뒤 판단을 조정하시기 바랍니다.',
  ].join(' ')
}

export function generateDetailedInvestmentMemo(
  input: DetailedBriefingInput,
): DetailedInvestmentMemoResult {
  const ups = resolveConsensusUpsides(input)
  const paragraphs = [
    buildParagraph1(input, ups),
    buildParagraph2(input),
    buildParagraph3(input),
    buildParagraph4(input, ups),
    buildParagraph5(input),
  ]
  const tone = deriveTone(input)
  const title = `${input.stockName} (${input.stockCode}) — 투자 메모`

  return {
    title,
    atAGlanceTitle:
      tone === 'bullish'
        ? '상승 우위 흐름'
        : tone === 'caution'
          ? '변동성 점검 구간'
          : '중립 흐름',
    atAGlanceStrategy:
      input.entryDecision === '분할익절' || input.entryDecision === '분할 익절' || input.entryDecision === '전량 익절'
        ? '분할 익절 중심 대응'
        : input.entryDecision === '관망' || input.entryDecision === '관망 (과열)'
          ? '관망, 신호 확인 후 접근'
          : input.entryDecision === '보유 유지'
            ? '보유 유지, 이탈 시 정리'
            : input.entryDecision === '신규진입 가능' || input.entryDecision === '신규 매수'
              ? '눌림 확인 후 분할 진입'
              : input.entryDecision === '적극 매수'
                ? '펀더 강세, 적극 분할 진입'
                : input.entryDecision === '분할 매수'
                ? '조건부 분할 진입'
                : input.entryDecision === '제외' || input.entryDecision === '회피'
                  ? '제외 관점 유지'
                  : '손절·익절 규칙 준수',
    paragraphs,
    keyPoints: buildKeyPoints(input, ups),
    risks: buildRisks(input, ups),
    strategyComment: buildStrategyComment(input),
    tone,
  }
}
