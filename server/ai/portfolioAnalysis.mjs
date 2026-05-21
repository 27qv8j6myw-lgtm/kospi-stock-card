import Anthropic from '@anthropic-ai/sdk'
import { cleanEnvSecret } from '../aiClient.mjs'
import { getUserModel, resolveModelId } from '../lib/userModel.mjs'

const CACHE_TTL_MS = 30 * 60 * 1000
const cache = new Map()

/**
 * @param {Array<Record<string, unknown>>} holdings
 * @param {string | null | undefined} userId
 * @returns {Promise<(Record<string, unknown> & { source: string }) | null>}
 */
export async function analyzePortfolio(holdings, userId = null) {
  if (!Array.isArray(holdings) || holdings.length === 0) return null

  const apiKey = cleanEnvSecret(process.env.ANTHROPIC_API_KEY)
  if (!apiKey) {
    console.error('[Portfolio AI] ANTHROPIC_API_KEY 없음')
    return null
  }

  const userModel = await getUserModel(userId)
  const envModel = process.env.ANTHROPIC_PORTFOLIO_MODEL?.trim()
  const modelId = envModel || resolveModelId(userModel)
  const maxTokens = userModel === 'opus' ? 4000 : 2500

  const cacheKey = `${userId || 'anon'}|${userModel}|${holdings
    .map((h) => `${h.code}:${h.avgPrice}`)
    .sort()
    .join('|')}|${Math.floor(Date.now() / CACHE_TTL_MS)}`

  const hit = cache.get(cacheKey)
  if (hit) {
    return { ...hit, source: 'cache' }
  }

  console.log('[Portfolio AI] user model:', userModel, '→', modelId)

  const lines = holdings.map((h, i) => {
    const name = String(h.name ?? h.code ?? '')
    const code = String(h.code ?? '')
    const avg = h.avgPrice
    const qty = h.quantity
    const cur = h.currentPrice
    const rp = h.returnPct
    const sl = h.stopLoss
    const ind = h.indicators && typeof h.indicators === 'object' ? h.indicators : {}
    const rsi = ind.rsi
    const atrGap = ind.atrGap
    const r5 = ind.return5D
    const per = ind.per
    const om = ind.operatingMargin

    const avgS = typeof avg === 'number' && Number.isFinite(avg) ? avg.toLocaleString('ko-KR') : String(avg ?? '-')
    const curS = typeof cur === 'number' && Number.isFinite(cur) ? cur.toLocaleString('ko-KR') : String(cur ?? '-')
    const rpN = typeof rp === 'number' && Number.isFinite(rp) ? rp : Number.NaN
    const rpStr = Number.isFinite(rpN) ? `${rpN > 0 ? '+' : ''}${rpN.toFixed(1)}%` : '-'
    const valWon =
      typeof cur === 'number' && typeof qty === 'number' && Number.isFinite(cur) && Number.isFinite(qty)
        ? (cur * qty).toLocaleString('ko-KR')
        : '-'
    const rsiStr =
      typeof rsi === 'number' && Number.isFinite(rsi) ? rsi.toFixed(0) : rsi != null ? String(rsi) : '-'
    const atrStr =
      typeof atrGap === 'number' && Number.isFinite(atrGap) ? atrGap.toFixed(1) : atrGap != null ? String(atrGap) : '-'
    const r5Str =
      typeof r5 === 'number' && Number.isFinite(r5) ? `${r5.toFixed(1)}` : r5 != null ? String(r5) : '-'
    const perStr =
      typeof per === 'number' && Number.isFinite(per) ? `${per.toFixed(1)}` : per != null ? String(per) : '-'
    const omStr =
      typeof om === 'number' && Number.isFinite(om) ? `${om.toFixed(1)}` : om != null ? String(om) : '-'
    const slLine =
      typeof sl === 'number' && Number.isFinite(sl) && sl > 0 ? `사용자 손절선 ${sl.toLocaleString('ko-KR')}원` : ''

    return `${i + 1}. ${name} (${code})
   평단 ${avgS}원, 수량 ${qty}주
   현재가 ${curS}원, 손익률 ${rpStr}
   평가금액 ${valWon}원
   RSI ${rsiStr}, ATR 이격 ${atrStr}
   5일 등락 ${r5Str}%
   PER ${perStr}x, 영업이익률 ${omStr}%
   ${slLine}`
  })

  const prompt = `당신은 한국 주식 단기 트레이딩(1~3개월) 포트폴리오 분석가입니다. 객관적 데이터만으로 보유 종목별 액션을 제안하세요.

[분석 관점]
- 단기·스윙 (1~3개월) 리스크·수익 관리
- 손절·익절은 손익률·RSI·단기 모멘텀 등 수치 기준
- 특정 개인·고정 목표 수익률(+15% 등) 가정 금지

[보유 종목] ${holdings.length}개

${lines.join('\n\n')}

다음 JSON 으로만 응답:
{
  "summary": {
    "headline": "포트 전체 진단 (15자, 명사형)",
    "overview": "포트 종합 분석 (2~3문장)"
  },
  "holdings": [
    {
      "code": "종목코드",
      "status": "보유유지|일부익절|전량익절|트레일링도달|손절근접|손절즉시|평단매수 중 하나",
      "actionPriority": "high|medium|low",
      "recommendation": "구체 액션 1~2문장",
      "reasoning": "근거 1~2문장"
    }
  ],
  "topPriority": {
    "code": "가장 우선 액션 필요한 종목 코드",
    "reason": "왜 우선인지 1문장"
  }
}

상태 판정:
- 손절즉시: 손익률 -7% 이하 OR 사용자 손절선 도달
- 손절근접: 손익률 -5% ~ -7%
- 트레일링도달: 손익률 +10% 이상이고 5일 -3% 이하
- 일부익절: 손익률 +10% 이상 AND RSI 70+
- 전량익절: 손익률 +20% 이상 AND RSI 80+
- 평단매수: 손익률 -3% ~ 0% AND 펀더 강세
- 보유유지: 위 모두 X

⚠️ 절대 금지:
- 추상어: "양호", "관망", "부담"
- 일반론

✅ 좋은 예시:
- recommendation: "260,000원 도달 시 절반 익절, 잔여 트레일링 -5% 적용."
- reasoning: "RSI 73 과열, 평단 +56% 충분히 확보. 리스크 관리 우선."`

  try {
    const client = new Anthropic({ apiKey })
    const response = await client.messages.create({
      model: modelId,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content[0]?.type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null

    const result = JSON.parse(jsonMatch[0])
    const out = { ...result, aiModel: modelId, aiUserModel: userModel }
    cache.set(cacheKey, out)
    return { ...out, source: 'fresh' }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[Portfolio AI]', msg)
    return null
  }
}
