/** 컨센서스 카드 공통 문구 (후행성 안내) */
export const CONSENSUS_LAG_NOTE =
  '컨센서스는 주가 변동을 따라가는 후행 지표입니다. 변화율과 분산도 위주로 참고하세요.'

/** 투자의견(5점 척도) 툴팁 — FnGuide AVG_RECOM_CD 등 */
export const CONSENSUS_RECOMMENDATION_TOOLTIP =
  '5점 만점, 4.0 이상 매수, 3.0 보유, 2.0 이하 매도'

export function formatConsensusTrendPct(pct: number | null | undefined): string {
  if (pct == null || !Number.isFinite(pct)) return '데이터 부족'
  const sign = pct >= 0 ? '+' : ''
  const dir = pct >= 1 ? '상향' : pct <= -1 ? '하향' : '보합'
  return `${sign}${pct.toFixed(1)}% ${dir}`
}

/** 컨센서스 카드 서브 한 줄: 4주 변화 + 투자의견 */
export function formatConsensusCardSubLine(params: {
  trend4wPct: number | null | undefined
  recommendationScore: number | null
  recommendationText: string | null
}): string {
  const { trend4wPct, recommendationScore, recommendationText } = params
  let arrow = '→'
  let mid = '4W 데이터 부족'
  if (trend4wPct != null && Number.isFinite(trend4wPct)) {
    arrow = trend4wPct > 0.5 ? '▲' : trend4wPct < -0.5 ? '▼' : '→'
    const sign = trend4wPct >= 0 ? '+' : ''
    mid = `${arrow} ${sign}${trend4wPct.toFixed(1)}% (4W)`
  }
  const rec =
    recommendationScore != null
      ? `${recommendationText?.trim() || '의견'} ${recommendationScore.toFixed(2)}`
      : recommendationText?.trim() || '의견 없음'
  return `${mid}, ${rec}`
}

/** 컨센서스 카드 보조 한 줄 — 수치 + 값의 해석(후행성) */
export function formatConsensusInterpretSubLine(params: {
  trend4wPct: number | null | undefined
  recommendationScore: number | null
  recommendationText: string | null
}): string {
  return `${formatConsensusCardSubLine(params)} · 후행·분산으로 레벨 확인`
}

export function buildConsensusDrawerBody(params: {
  consensus: {
    maxTargetPrice: number
    minTargetPrice?: number | null
    consensusAvgTrend12wPct?: number | null
    dispersionWidthPct?: number | null
    dispersionHighSkewPct?: number | null
    dispersionLowSkewPct?: number | null
    dispersionLabelKo?: string | null
    revision7dUp?: number | null
    revision7dDown?: number | null
    consensusTrendNote?: string | null
  }
  consensusUpside: { avgUpsidePct: number; maxUpsidePct: number } | null
}): string {
  const { consensus, consensusUpside } = params
  const lines: string[] = []
  if (consensusUpside != null) {
    lines.push(
      `현재가 대비 업사이드: 평균 ${consensusUpside.avgUpsidePct >= 0 ? '+' : ''}${consensusUpside.avgUpsidePct.toFixed(1)}% / 최고 ${consensusUpside.maxUpsidePct >= 0 ? '+' : ''}${consensusUpside.maxUpsidePct.toFixed(1)}%`,
    )
  }
  const hi = consensus.maxTargetPrice
  const lo =
    typeof consensus.minTargetPrice === 'number' && consensus.minTargetPrice > 0
      ? consensus.minTargetPrice
      : null
  if (lo != null && lo < hi) {
    lines.push(`목표가 범위: 최고 ${hi.toLocaleString('ko-KR')}원 · 최저 ${lo.toLocaleString('ko-KR')}원`)
  }
  lines.push(`12주 평균 목표가 변화: ${formatConsensusTrendPct(consensus.consensusAvgTrend12wPct)}`)
  const w = consensus.dispersionWidthPct
  const hiSk = consensus.dispersionHighSkewPct
  const loSk = consensus.dispersionLowSkewPct
  if (
    typeof w === 'number' &&
    w > 0 &&
    typeof hiSk === 'number' &&
    Number.isFinite(hiSk) &&
    typeof loSk === 'number' &&
    Number.isFinite(loSk)
  ) {
    lines.push(
      `최고·최저 편차(평균 대비): +${hiSk.toFixed(1)}% · −${loSk.toFixed(1)}% (전체 폭 ${w.toFixed(1)}%)`,
    )
  }
  if (consensus.dispersionLabelKo) lines.push(consensus.dispersionLabelKo)
  const up = consensus.revision7dUp ?? 0
  const down = consensus.revision7dDown ?? 0
  lines.push(`1주일 내 목표가 상향 ${up}건, 하향 ${down}건`)
  if (consensus.consensusTrendNote) lines.push(consensus.consensusTrendNote)
  lines.push('', CONSENSUS_LAG_NOTE)
  return lines.join('\n').trim()
}

