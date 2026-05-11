import type { NewsItem } from '../types/aiBriefing'

function pad6(code: string) {
  return String(code).replace(/\D/g, '').padStart(6, '0')
}

const genericFlow: NewsItem[] = [
  {
    title: '거래소 공시 — 주요 경영사항',
    summary: '업종 내 수주·실적 가이던스에 대한 시장의 질문이 이어지는 흐름',
    sentiment: 'neutral',
    category: 'sector',
    publishedAt: '2026-05-09',
    source: '거래소',
  },
  {
    title: '국내 증시 — 변동성 구간 진입',
    summary: '지수 방향성보다 종목별 펀더멘털 차별화가 강해지는 국면으로 읽히는 분위기',
    sentiment: 'neutral',
    category: 'macro',
    publishedAt: '2026-05-08',
    source: '시장',
  },
]

const byCode: Record<string, NewsItem[]> = {
  '005930': [
    {
      title: '파운드리 캐파·선단 가격 논의',
      summary: 'AI·데이터센터 수요가 장비 투자로 이어질지에 대한 기대가 온도차를 만들고 있음',
      sentiment: 'positive',
      category: 'order',
      publishedAt: '2026-05-10',
      source: '전자',
    },
    {
      title: '증권사 리포트 — 목표가 밴드 상향',
      summary: '실적 방어와 배당 매력을 묶어 밸류 리레이팅 논의가 나오는 상황',
      sentiment: 'positive',
      category: 'target',
      publishedAt: '2026-05-09',
      source: '리서치',
    },
    {
      title: '메모리 가격 — 단기 랠리 후 쉼표',
      summary: '공급 조절 기대가 주가에 선반영된 구간이라 변동성에 민감해질 수 있는 쪽',
      sentiment: 'neutral',
      category: 'sector',
      publishedAt: '2026-05-08',
      source: '업계',
    },
    {
      title: '외국인·기관 수급 — 순매수 지속 여부',
      summary: '큰 손의 매집이 이어질 때와 이탈할 때 체결 강도 차이가 크게 벌어지는 종목군',
      sentiment: 'positive',
      category: 'supply',
      publishedAt: '2026-05-07',
      source: '수급',
    },
  ],
  '000660': [
    {
      title: 'HBM 공급 — 할당량 이슈',
      summary: '고부가 제품 믹스가 실적 레버리지로 연결될지가 핵심 쟁점으로 부상',
      sentiment: 'positive',
      category: 'order',
      publishedAt: '2026-05-10',
      source: '반도체',
    },
    {
      title: '실적 프리뷰 — 컨센서스 상향',
      summary: '2Q 가이던스가 시장 기대를 넘길 가능성에 무게를 두는 쪽이 많아짐',
      sentiment: 'positive',
      category: 'earnings',
      publishedAt: '2026-05-09',
      source: '실적',
    },
    {
      title: '밸류에이션 — 고평가 논쟁',
      summary: 'PER 밴드가 역사적 상단에 붙어 있어 조정 시 변동폭이 커질 수 있는 구간',
      sentiment: 'negative',
      category: 'valuation',
      publishedAt: '2026-05-08',
      source: '밸류',
    },
    {
      title: '미국 금리·환율',
      summary: '달러·금리 민감 업종으로 거시 지표 발표일 전후로는 포지션 정리 압력이 생기기 쉬움',
      sentiment: 'neutral',
      category: 'macro',
      publishedAt: '2026-05-06',
      source: '매크로',
    },
  ],
  /** 산일전기 */
  '011090': [
    {
      title: '전력기기·그리드 투자',
      summary: '데이터센터·재생에너지 연계 수주 기대가 테마와 실적을 동시에 끌어올리는 흐름',
      sentiment: 'positive',
      category: 'sector',
      publishedAt: '2026-05-10',
      source: '산업',
    },
    {
      title: '수주 공시 후보',
      summary: '대형 프로젝트 타임라인이 밝혀지면 단기 이벤트 변동성이 커질 수 있음',
      sentiment: 'positive',
      category: 'order',
      publishedAt: '2026-05-09',
      source: '공시',
    },
    {
      title: '단기 급등 — RSI 과열 우려',
      summary: '뉴스 대비 주가가 앞서 간 구간이라 차익 매물이 쏟아질 수 있는 온도',
      sentiment: 'negative',
      category: 'valuation',
      publishedAt: '2026-05-08',
      source: '시장',
    },
  ],
  /** LS일렉트릭 */
  '066570': [
    {
      title: 'LS그룹 — 전기·자동화 시너지',
      summary: '북미·유럽 설비 투자 사이클이 수주 파이프에 반영되는지가 관전 포인트',
      sentiment: 'positive',
      category: 'sector',
      publishedAt: '2026-05-10',
      source: '리서치',
    },
    {
      title: '기관 순매도 구간',
      summary: '지수 조정·리밸런싱 때 기관 매도가 나오면 개인 매수와 엇갈리기 쉬운 구조',
      sentiment: 'negative',
      category: 'supply',
      publishedAt: '2026-05-09',
      source: '수급',
    },
    {
      title: '목표가 상향 리포트',
      summary: '실적 가시성이 좋아지면서 밴드 상단을 열어두는 의견이 늘어남',
      sentiment: 'positive',
      category: 'target',
      publishedAt: '2026-05-07',
      source: '증권',
    },
  ],
  '082220': [
    {
      title: '방산·엔진 수출',
      summary: '지정학 리스크가 수주엔 호재처럼 작용할 수 있으나 납기·원가 리스크도 동반',
      sentiment: 'positive',
      category: 'order',
      publishedAt: '2026-05-10',
      source: '방산',
    },
    {
      title: '환율·원자재',
      summary: '마진 방어가 환율에 묶여 있어 분기 실적 변동성이 큰 편',
      sentiment: 'neutral',
      category: 'macro',
      publishedAt: '2026-05-08',
      source: '실적',
    },
    {
      title: '밸류 부담 논의',
      summary: '기대감이 먼저 반영된 뒤에는 실적이 따라줘야 하는 국면',
      sentiment: 'negative',
      category: 'valuation',
      publishedAt: '2026-05-06',
      source: '밸류',
    },
  ],
  '042660': [
    {
      title: '조선·해양 클린 에너지',
      summary: '친환경 선종 전환이 수주 믹스를 바꿀 가능성에 베팅하는 자금이 유입되는 흐름',
      sentiment: 'positive',
      category: 'sector',
      publishedAt: '2026-05-10',
      source: '조선',
    },
    {
      title: '실적 서프라이즈 가능성',
      summary: '인도·중동 물량이 예상보다 빨리 잡히면 컨센 상향 여지가 있음',
      sentiment: 'positive',
      category: 'earnings',
      publishedAt: '2026-05-09',
      source: '실적',
    },
    {
      title: '경기 민감주 성격',
      summary: '무역·금융 조건이 흔들리면 베타가 커져 조정 폭도 크게 느껴질 수 있음',
      sentiment: 'neutral',
      category: 'macro',
      publishedAt: '2026-05-07',
      source: '매크로',
    },
  ],
}

export function getMockNewsByStockCode(code: string): NewsItem[] {
  const key = pad6(code)
  return byCode[key]?.length ? [...byCode[key]] : [...genericFlow]
}
