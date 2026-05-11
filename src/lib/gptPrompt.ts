import type { DetailedBriefingInput } from '../types/aiBriefing'

/**
 * OpenAI `/api/ai-briefing` 연동용 사용자 프롬프트.
 * 입력 JSON은 서버에서 그대로 해석 가능하게 직렬화한다.
 */
export function buildInvestmentMemoPromptForGPT(input: DetailedBriefingInput): string {
  const payload = {
    ...input,
    news: input.news.slice(0, 14).map((n) => ({
      title: n.title,
      summary: n.summary,
      sentiment: n.sentiment,
      category: n.category,
      publishedAt: n.publishedAt,
      source: n.source,
    })),
  }

  return [
    '역할: 한국 주식 애널리스트 수준의 단기·중기 투자 메모를 작성합니다.',
    '언어: 한국어 존댓말(~습니다/입니다, 권고는 ~하시기 바랍니다 등)로 통일합니다. 숫자·퍼센트·원화·억 단위를 적극 사용합니다.',
    '',
    '금지:',
    '- "긍정적입니다", "모멘텀이 있습니다"처럼 근거 없는 추상 표현만 쓰지 말 것.',
    '- 뉴스 제목만 나열하지 말 것(원인-결과·주가에 미친 의미를 문장으로).',
    '- 매수·매도를 단정하지 말 것. "~일 수 있다", "~여지가 있다" 등 가능성 표현.',
    '- 기사 요약이 아니라 "왜 주가가 움직였는지" 추론을 덧붙일 것.',
    '',
    '출력 JSON 스키마(키만, 순서 무관):',
    '{',
    '  "title": string,',
    '  "atAGlanceTitle": string,     // 한눈에 보기 첫 줄. 종목명 없이 12~20자 내외 상황요약',
    '  "atAGlanceStrategy": string,  // 한눈에 보기 둘째 줄. 14~24자 내외 전략 한 줄',
    '  "paragraphs": string[5],  // 아래 순서 고정',
    '  "keyPoints": string[],   // 4~7개, 숫자 포함 한 줄 팩트',
    '  "risks": string[],       // 2~5개, 구체적',
    '  "strategyComment": string, // 3개월 +15% 전략·손절·익절을 한 문단으로',
    '  "tone": "bullish" | "neutral" | "caution"',
    '}',
    '',
    'paragraphs[0] — 가격·차트: 현재가, 전일 대비 등락률, 장중 고저, 52주 신고가 여부(입력값 기준), 컨센서스 평균·최고 목표가와 평균·최고 대비 상승여력(%).',
    'paragraphs[1] — 최근 주가 트리거: 뉴스 1~2개를 원인-결과로 연결. 목표가 상향·실적·수주·정책·매크로가 있으면 반드시 언급.',
    'paragraphs[2] — 펀더멘털: Trailing/Forward PER, EPS 성장률(있으면), 컨센서스 밴드 해석.',
    'paragraphs[3] — 수급·리스크: 3일 외국인·기관·개인 순매수(원 또는 억 환산), RSI·ATR 이격 과열, 차익실현·컨센서스 초과 여부.',
    'paragraphs[4] — 전략: entryDecision·strategy를 반영해 신규/눌림/보유/익절/관망 중심으로, 3개월 +15% 프레임과 손절·분할익절을 간단히.',
    'atAGlanceTitle — 종목명/코드/괄호 금지. 예: "52주 최고가 갱신 구간", "수급 유입이 이어지는 구간".',
    'atAGlanceStrategy — "전략:" 접두어 없이 짧은 실행 문구. 예: "눌림 확인 후 분할 진입", "분할 익절 중심 대응".',
    '',
    '특수 문구(해당 시 paragraphs 또는 keyPoints에 반영):',
    '- 현재가 > 컨센서스 평균 목표가: "현재가는 컨센서스 평균 목표가를 이미 넘어선 상태라, 추가 상승은 실적 서프라이즈나 수급 모멘텀이 필요합니다."',
    '- 평균 목표가 대비 상승여력 <8%: "컨센서스 기준 상승여력은 크지 않아 단기 모멘텀 중심으로 봐야 합니다."',
    '- 8~15%: "중석님 전략 기준으로는 목표 구간에 근접한 상승여력이 남아 있습니다."',
    '- ≥15%: "컨센서스 기준으로도 15% 이상 여력이 남아 있어 중기 기대감은 유지됩니다."',
    '- RSI≥75: "RSI가 75를 넘어서 단기 과열 부담이 있습니다."',
    '- ATR 이격≥3.5: "ATR 이격이 커진 상태라 추격매수보다는 눌림 확인이 유리합니다."',
    '',
    '입력 데이터(JSON):',
    JSON.stringify(payload, null, 0),
  ].join('\n')
}
