export type ExecutionEducationRow = { label: string; meaning: string }

export type ExecutionEducationBlock = {
  title: string
  simple: string
  why: string
  howToRead: ExecutionEducationRow[]
  takeaway: string
}

export const executionEducation = {
  recommendedPosition: {
    title: '추천 비중',
    simple: '현재 조건에서 계좌의 몇 %를 이 종목에 넣을지 제안하는 값입니다.',
    why: '좋은 종목이어도 과열이거나 손익비가 나쁘면 비중을 줄여야 합니다.',
    howToRead: [
      { label: '0~3%', meaning: '관망 또는 아주 소액 관찰 구간입니다.' },
      { label: '5~8%', meaning: '조건은 애매하지만 관심을 둘 수 있는 구간입니다.' },
      { label: '10~12%', meaning: '분할 진입을 고려할 수 있는 보통 이상의 구간입니다.' },
      { label: '15~20%', meaning: '강한 확신이 있을 때만 가능한 집중 구간입니다.' },
    ],
    takeaway: '추천 비중은 수익보다 리스크 관리를 먼저 반영합니다.',
  },
  riskAmount: {
    title: '1R 손실',
    simple: '손절했을 때 계좌 전체에서 잃게 되는 예상 손실률입니다.',
    why: '종목 손절률보다 중요한 것은 계좌 전체가 얼마나 다치는지입니다.',
    howToRead: [
      { label: '0.3% 이하', meaning: '매우 보수적인 리스크입니다.' },
      { label: '0.3~0.7%', meaning: '일반적인 단기 투자 리스크 범위입니다.' },
      { label: '0.7~1.0%', meaning: '다소 공격적인 리스크입니다.' },
      { label: '1.0% 이상', meaning: '한 번 틀렸을 때 계좌 타격이 커질 수 있습니다.' },
    ],
    takeaway: '1R 손실을 작게 유지하면 여러 번 틀려도 회복이 쉽습니다.',
  },
  baseExecution: {
    title: '기본 실행',
    simple: '매수 후 언제 손절하고 언제 익절할지 정해둔 기본 규칙입니다.',
    why: '진입 전에 손절·익절 규칙이 없으면 감정적으로 매매하기 쉽습니다.',
    howToRead: [
      { label: '타임스탑', meaning: '정해진 기간 안에 움직이지 않으면 정리하는 규칙입니다.' },
      { label: '손절', meaning: '예상과 다르게 움직일 때 손실을 제한하는 기준입니다.' },
      { label: '익절', meaning: '수익이 났을 때 일부를 확정하는 기준입니다.' },
    ],
    takeaway: '실행 규칙은 매수 전에 정해져 있어야 합니다.',
  },
  stopLoss: {
    title: 'Stop 가격',
    simple: '예상과 다르게 움직일 때 손실을 제한하기 위해 미리 정해두는 손절 가격입니다.',
    why: '매수 전에 손절선을 정해두면 감정적으로 버티다가 큰 손실을 보는 일을 줄일 수 있습니다.',
    howToRead: [
      { label: '-5% 근처', meaning: '시장이나 종목이 불안할 때 짧게 대응하는 손절입니다.' },
      { label: '-6% 근처', meaning: '일반적인 단기 스윙 기준 손절입니다.' },
      { label: '-7% 근처', meaning: '변동성이 큰 종목이나 강한 종목에 조금 더 여유를 주는 손절입니다.' },
    ],
    takeaway: 'Stop은 예측이 틀렸을 때 계좌를 지키는 안전장치입니다.',
  },
  maxPosition: {
    title: '최대 비중',
    simple: '아무리 좋아 보여도 이 종목에 넣을 수 있는 최대 한도입니다.',
    why: '한 종목에 너무 많이 넣으면 예상이 틀렸을 때 계좌가 크게 흔들립니다.',
    howToRead: [
      { label: '0~5%', meaning: '관망 또는 리스크가 큰 구간입니다.' },
      { label: '10%', meaning: '일반적인 후보 종목의 최대 비중입니다.' },
      { label: '15%', meaning: '강한 후보일 때 가능한 비중입니다.' },
      { label: '20%', meaning: '매우 강한 확신이 있을 때만 허용하는 상한입니다.' },
    ],
    takeaway: '최대 비중은 욕심을 제한하는 안전장치입니다.',
  },
  addBuyRule: {
    title: '추가매수 규칙',
    simple: '처음 산 뒤 어떤 조건에서 더 살 수 있는지 정한 규칙입니다.',
    why: '무조건 물타기하거나 추격매수하면 손실이 커질 수 있습니다.',
    howToRead: [
      { label: '수익 확인 후 추가', meaning: '내 판단이 맞는 방향일 때만 비중을 늘립니다.' },
      { label: '눌림에서만 추가', meaning: '비싼 가격을 따라 사지 않기 위한 규칙입니다.' },
      { label: '추가매수 금지', meaning: '현재는 리스크가 커서 비중을 늘리지 않는 구간입니다.' },
    ],
    takeaway: '추가매수는 손실을 만회하는 행동이 아니라 확률이 높아졌을 때만 해야 합니다.',
  },
  planSummary: {
    title: '요약',
    simple: '위 숫자와 규칙을 한 줄로 정리한 것입니다.',
    why: '항목이 많을 때 핵심만 기억하면 실행이 쉬워집니다.',
    howToRead: [
      { label: '관망 쪽 요약', meaning: '비중 0에 가깝거나 경고가 많을 때 자주 나옵니다.' },
      { label: '분할 진입', meaning: '한 번에 몰지 말고 나누어 사라는 뜻에 가깝습니다.' },
      { label: '경고 칩', meaning: '과열·수급·손익비 등 지금 조심할 점입니다.' },
    ],
    takeaway: '요약과 경고는 참고용이며, 최종 판단은 본인 책임입니다.',
  },
} as const

export type ExecutionEducationKey = keyof typeof executionEducation
