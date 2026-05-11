export type MetricSummaryInput = {
  finalScore: number
  structureScore: number
  executionScore: number
  supplyScore: number
  sectorFlowScore: number
  consensusScore: number
  valuationScore: number
  foreignNetAmount3D: number
  institutionNetAmount3D: number
  retailNetAmount3D: number
  indicatorScore: number
  candleQualityScore: number
  marketScore: number
  rsi14: number
  atrDistance: number
  consecutiveRiseDays: number
  strategy: 'BUY' | 'HOLD' | 'WATCH_ONLY' | 'TAKE_PROFIT' | 'REJECT'
  entryStage: 'ACCEPT' | 'CAUTION' | 'REJECT' | 'WATCH'
}

export type MetricSummaryResult = {
  line1: string
  line2: string
  tone: 'positive' | 'neutral' | 'caution' | 'danger'
}

export function generateMetricSummary(input: MetricSummaryInput): MetricSummaryResult {
  if (input.finalScore < 55) {
    return {
      line1: '종합 점수가 낮아 단기 모멘텀 후보로 보기 어렵습니다.',
      line2: '신규진입보다는 제외 후 재평가가 유리합니다.',
      tone: 'danger',
    }
  }

  if (input.marketScore < 45) {
    return {
      line1: '개별 종목보다 시장 리스크가 크게 작용하는 구간입니다.',
      line2: '신규진입보다는 비중 축소와 엄격한 손절이 필요합니다.',
      tone: 'danger',
    }
  }

  if (input.structureScore >= 85 && input.executionScore < 40) {
    return {
      line1: '구조는 매우 강하지만 현재 가격대의 진입 매력은 낮습니다.',
      line2: '추격매수보다 지지선 눌림 확인 후 접근이 유리합니다.',
      tone: 'caution',
    }
  }

  if (
    input.structureScore >= 75 &&
    (input.rsi14 >= 75 || input.atrDistance >= 2.5 || input.consecutiveRiseDays >= 4)
  ) {
    return {
      line1: '추세는 살아있지만 단기 과열 신호가 함께 나타납니다.',
      line2: '신규진입은 비중을 줄이고 눌림 확인이 좋습니다.',
      tone: 'caution',
    }
  }

  if (input.structureScore >= 75 && input.executionScore >= 70 && input.rsi14 < 75) {
    return {
      line1: '상승 구조와 진입 타이밍이 모두 양호한 구간입니다.',
      line2: '손절을 짧게 두고 +8~10% 구간을 우선 노릴 수 있습니다.',
      tone: 'positive',
    }
  }

  if (input.supplyScore < 45) {
    return {
      line1: '차트 구조와 별개로 외국인·기관 수급이 약한 상태입니다.',
      line2: '반등이 나와도 추세 지속성 확인이 필요합니다.',
      tone: 'caution',
    }
  }

  if (input.supplyScore >= 75 && input.sectorFlowScore >= 65) {
    return {
      line1: '수급과 섹터 자금흐름이 상승 모멘텀을 지지하는 구간입니다.',
      line2: '시장만 흔들리지 않으면 보유 관점이 유리합니다.',
      tone: 'positive',
    }
  }

  if (input.sectorFlowScore >= 75) {
    return {
      line1: '해당 섹터가 시장 대비 강해 자금흐름은 우호적입니다.',
      line2: '과열 신호가 겹치면 눌림 후 접근을 고려하는 편이 좋습니다.',
      tone: 'positive',
    }
  }

  if (input.sectorFlowScore < 45) {
    return {
      line1: '섹터 자금흐름이 약해 개별 종목 모멘텀만으로는 힘이 부족할 수 있습니다.',
      line2: '섹터 상대강도가 살아나기 전까지는 비중·속도 조절이 유리합니다.',
      tone: 'caution',
    }
  }

  const fi3 = input.foreignNetAmount3D + input.institutionNetAmount3D
  if (fi3 > 0) {
    return {
      line1: '직전 3거래일 기준 외국인·기관 수급이 유입되고 있습니다.',
      line2: '시장 변동성만 안정적이면 보유 전략이 유리합니다.',
      tone: 'positive',
    }
  }

  if (input.foreignNetAmount3D < 0 && input.institutionNetAmount3D < 0) {
    return {
      line1: '직전 3거래일 기준 외국인과 기관이 동시에 매도 중입니다.',
      line2: '반등이 나와도 지속성은 보수적으로 판단하는 편이 좋습니다.',
      tone: 'caution',
    }
  }

  if (input.retailNetAmount3D > 0 && input.foreignNetAmount3D <= 0 && input.institutionNetAmount3D <= 0) {
    return {
      line1: '개인 매수 중심의 흐름이라 추격매수는 신중하게 볼 필요가 있습니다.',
      line2: '눌림·지지 확인 후 접근하는 편이 안전합니다.',
      tone: 'caution',
    }
  }

  if (input.consensusScore >= 75 && input.structureScore >= 70) {
    return {
      line1: '컨센서스 기준 상승여력도 남아 중기 기대감은 유지됩니다.',
      line2: '단기 변동성은 감안하되 핵심 구간 지지 여부를 보세요.',
      tone: 'positive',
    }
  }

  if (input.consensusScore < 45) {
    return {
      line1: '목표가 대비 상승여력이 제한돼 진입 매력이 약해집니다.',
      line2: '신규진입보다 보유·관망 비중이 더 유리합니다.',
      tone: 'caution',
    }
  }

  if (input.valuationScore >= 75) {
    return {
      line1: '실적 성장 대비 Forward PER 부담도 아직 크지 않습니다.',
      line2: '중기 관점에서 밸류 부담은 제한적인 편입니다.',
      tone: 'positive',
    }
  }

  if (input.valuationScore < 45) {
    return {
      line1: '실적 기대가 선반영되어 밸류에이션 부담이 커집니다.',
      line2: '신규진입 매력은 낮아 보수적 접근이 유리합니다.',
      tone: 'caution',
    }
  }

  return {
    line1: '일부 긍정 신호는 있으나 강한 매수 근거는 부족합니다.',
    line2: '성급한 진입보다 수급·거래량 개선 확인이 유리합니다.',
    tone: 'neutral',
  }
}
