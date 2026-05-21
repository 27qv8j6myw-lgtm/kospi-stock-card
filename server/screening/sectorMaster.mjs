/**
 * 8섹터 코어 종목 — `server/lib/sectorDefinitions.mjs` 와 동기.
 * icon 은 클라이언트 `SectorIconKey` 와 동일한 키 문자열.
 */
import {
  SECTOR_DEFINITIONS_LIST,
  getSectorCoreCodes,
  getSectorDefinition,
  normalizeSectorCode6,
} from '../lib/sectorDefinitions.mjs'

const AI_POWER_BLOCKLIST = new Set(['009450'])

/** @param {string} code */
export function normalizeScreeningCode6(code) {
  return normalizeSectorCode6(code)
}

/**
 * @param {string | { id?: string, label?: string }} sectorOrKey
 */
export function isAiPowerSector(sectorOrKey) {
  if (sectorOrKey && typeof sectorOrKey === 'object') {
    return (
      sectorOrKey.id === 'ai_power' ||
      sectorOrKey.id === 'power_equip' ||
      sectorOrKey.label === 'AI 인프라/전력기기' ||
      sectorOrKey.label === '전력기기'
    )
  }
  const raw = String(sectorOrKey ?? '').trim()
  const norm = raw.replace(/\s/g, '')
  return (
    raw === 'ai_power' ||
    raw === 'power_equip' ||
    raw === 'AI 인프라/전력기기' ||
    raw === '전력기기' ||
    norm === 'AI인프라/전력기기'
  )
}

/** @deprecated — `isAiPowerSector` 사용 */
export const isPowerEquipmentSector = isAiPowerSector

/**
 * @param {{ id: string, label: string, stockCodes: string[] }} sector
 * @returns {string[]}
 */
export function getSectorStockCodes(sector) {
  const fromDef = getSectorCoreCodes(sector)
  if (fromDef.length > 0) return fromDef
  return sector.stockCodes
}

/** @param {string} code */
export function isAllowedAiPowerCode(code) {
  const c = normalizeScreeningCode6(code)
  if (AI_POWER_BLOCKLIST.has(c)) return false
  return getSectorCoreCodes('ai_power').some((x) => normalizeScreeningCode6(x) === c)
}

/** @deprecated */
export const isAllowedPowerEquipmentCode = isAllowedAiPowerCode

/**
 * AI 인프라/전력기기 — 코어 + `ai_added` 만 허용 (블록리스트 제외).
 * @param {Array<{ code?: string, sectorId?: string, sectorLabel?: string, sector?: string, source?: string }>} rows
 * @param {string} [forSectorId]
 */
export function filterSectorWhitelistRows(rows, forSectorId = null) {
  if (!Array.isArray(rows)) return []
  const aiPowerCore = new Set(getSectorCoreCodes('ai_power').map(normalizeScreeningCode6))
  return rows.filter((r) => {
    const code = normalizeScreeningCode6(r.code)
    if (AI_POWER_BLOCKLIST.has(code)) return false
    const sid = r.sectorId ?? forSectorId
    const sl = r.sectorLabel ?? r.sector
    const isAiPower =
      sid === 'ai_power' ||
      sid === 'power_equip' ||
      sl === 'AI 인프라/전력기기' ||
      sl === '전력기기' ||
      isAiPowerSector(sid) ||
      isAiPowerSector(sl) ||
      forSectorId === 'ai_power'
    if (!isAiPower) return true
    if (aiPowerCore.has(code)) return true
    if (r.source === 'ai_added') return true
    return false
  })
}

/** @deprecated */
export const filterPowerEquipmentRows = filterSectorWhitelistRows

/**
 * 스크리닝 번들 — AI 전력 섹터 오염·블록리스트 정리.
 * @param {Record<string, unknown>} bundle
 */
export function sanitizePowerEquipmentInBundle(bundle) {
  if (!bundle || typeof bundle !== 'object') return bundle
  /** @type {Record<string, unknown>} */
  const out = { ...bundle }
  const aiPowerCore = new Set(getSectorCoreCodes('ai_power').map(normalizeScreeningCode6))

  if (Array.isArray(out.sectors)) {
    out.sectors = out.sectors.map((s) => {
      if (!s || typeof s !== 'object') return s
      if (s.id !== 'ai_power' && s.id !== 'power_equip') return s
      const topStocks = Array.isArray(s.topStocks)
        ? s.topStocks.filter((t) => {
            if (!t) return false
            const c = normalizeScreeningCode6(t.code)
            if (AI_POWER_BLOCKLIST.has(c)) return false
            return aiPowerCore.has(c)
          })
        : []
      return { ...s, topStocks }
    })
  }

  if (Array.isArray(out.topFive)) {
    out.topFive = out.topFive.filter((t) => {
      if (!t) return false
      const c = normalizeScreeningCode6(t.code)
      if (AI_POWER_BLOCKLIST.has(c)) return false
      if (t.sectorId !== 'ai_power' && t.sectorId !== 'power_equip') return true
      return aiPowerCore.has(c)
    })
  }

  if (out.analysesByCode && typeof out.analysesByCode === 'object') {
    const next = { .../** @type {Record<string, unknown>} */ (out.analysesByCode) }
    for (const blocked of AI_POWER_BLOCKLIST) {
      delete next[blocked]
    }
    out.analysesByCode = next
  }

  return out
}

/** @type {Array<{ id: string, label: string, icon: string, tone: string, stockCodes: string[] }>} */
export const SECTORS = SECTOR_DEFINITIONS_LIST.map((d) => {
  const meta = {
    semi: { icon: 'cpu', tone: 'blue' },
    ai_power: { icon: 'zap', tone: 'yellow' },
    nuclear: { icon: 'circuit', tone: 'cyan' },
    shipbuilding: { icon: 'ship', tone: 'teal' },
    defense: { icon: 'shield', tone: 'rose' },
    construction: { icon: 'building', tone: 'pink' },
    battery: { icon: 'battery', tone: 'green' },
    auto: { icon: 'car', tone: 'orange' },
  }[d.id] || { icon: 'cpu', tone: 'blue' }
  return {
    id: d.id,
    label: d.label,
    icon: meta.icon,
    tone: meta.tone,
    stockCodes: [...d.coreCodes],
  }
})

export const ALL_STOCK_CODES = [...new Set(SECTORS.flatMap((s) => s.stockCodes))]

/** 코어 종목 한글명 — KIS 필드 오인 방지 (`src/data/sectorMaster.ts` 와 동기) */
const SCREENING_STOCK_NAMES_KR = {
  '005930': '삼성전자',
  '000660': 'SK하이닉스',
  '042700': '한미반도체',
  '058470': '리노공업',
  '240810': '원익IPS',
  '011070': 'LG이노텍',
  '095340': 'ISC',
  '036930': '주성엔지니어링',
  '267260': 'HD현대일렉트릭',
  '298040': '효성중공업',
  '010120': 'LS ELECTRIC',
  '062040': '산일전기',
  '103590': '일진전기',
  '042370': '비츠로테크',
  '033100': '제룡전기',
  '034020': '두산에너빌리티',
  '052690': '한전기술',
  '051600': '한전KPS',
  '015760': '한국전력',
  '329180': 'HD현대중공업',
  '009540': 'HD한국조선해양',
  '042660': '한화오션',
  '010140': '삼성중공업',
  '082740': '한화엔진',
  '010620': 'HD현대미포',
  '012450': '한화에어로스페이스',
  '047810': '한국항공우주',
  '272210': '한화시스템',
  '079550': 'LIG넥스원',
  '064350': '현대로템',
  '375500': 'DL이앤씨',
  '028050': '삼성E&A',
  '000720': '현대건설',
  '047040': '대우건설',
  '006360': 'GS건설',
  '373220': 'LG에너지솔루션',
  '006400': '삼성SDI',
  '247540': '에코프로비엠',
  '003670': '포스코퓨처엠',
  '086520': '에코프로',
  '051910': 'LG화학',
  '005380': '현대차',
  '000270': '기아',
  '012330': '현대모비스',
  '204320': 'HL만도',
  '161390': '한국타이어앤테크놀로지',
  '011210': '현대위아',
}

/**
 * @param {string} code6
 * @returns {string}
 */
export function screeningStockNameKr(code6) {
  const c = normalizeScreeningCode6(code6)
  return SCREENING_STOCK_NAMES_KR[c] || ''
}

/**
 * @param {string} code6
 * @param {string|null|undefined} primaryName
 * @param {string|null|undefined} sectorLabel
 * @returns {string}
 */
export function resolveScreeningStockDisplayName(code6, primaryName, sectorLabel) {
  const code = normalizeScreeningCode6(code6)
  const kr = screeningStockNameKr(code)
  if (kr) return kr

  const p = String(primaryName ?? '').trim()
  const sec = String(sectorLabel ?? '').trim()
  const onlySix = /^\d{6}$/.test(p.replace(/\s/g, ''))
  const unusable = !p || p === code || onlySix || (sec && p === sec)

  if (!unusable) return p
  return code
}

export { getSectorDefinition }
