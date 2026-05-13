export type StructureStateResult = {
  primary: string
  line: string
  sub: string
}

export function computeStructureStateLabel(
  structureScore: number,
  atrGapAbs: number,
): StructureStateResult {
  let primary = '혼조 / 박스권 매매'
  let sub = '박스권 내 분할·손절 엄수'
  if (structureScore >= 80) {
    if (atrGapAbs <= 2.0) {
      primary = '상승장 / 진입 가능'
      sub = '추세 유지 중 · 진입 구간 탐색'
    } else if (atrGapAbs <= 3.5) {
      primary = '상승장 / 눌림 대기'
      sub = '+3~5% 조정 시 진입 검토'
    } else {
      primary = '상승장 / 과열 (익절 검토)'
      sub = '분할 익절·트레일링 스탑 검토'
    }
  } else if (structureScore >= 60) {
    primary = '혼조 / 박스권 매매'
    sub = '박스 상단·하단 확인 후 소액 대응'
  } else {
    primary = '약세 / 관망'
    sub = '신규 진입 자제·방어 우선'
  }
  const line = primary.replace(' / ', ' / ')
  return { primary, line, sub }
}
