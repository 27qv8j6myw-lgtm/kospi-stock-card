/**
 * 8개 섹터 — 코어 종목(항상 포함) + AI 동적 추가 후보.
 * @typedef {object} SectorDefinition
 * @property {string} id
 * @property {string} label
 * @property {string} description
 * @property {string[]} coreCodes
 * @property {string} aiPromptHint
 * @property {string[]} [excludeKeywords]
 */

/** @type {SectorDefinition[]} */
export const SECTOR_DEFINITIONS_LIST = [
  {
    id: 'semi',
    label: '반도체',
    description: '메모리/시스템 반도체, 장비, 후방 기판/소재',
    coreCodes: [
      '005930',
      '000660',
      '042700',
      '058470',
      '011070',
      '240810',
      '095340',
      '036930',
    ],
    aiPromptHint:
      '반도체 제조/장비/소재/패키지 기판 (FC-BGA, HBM) 관련. 가전, 카메라 단순 부품, 보일러 등 무관 종목 제외.',
    excludeKeywords: ['가전', '보일러', '난방', '주방용품'],
  },
  {
    id: 'ai_power',
    label: 'AI 인프라/전력기기',
    description: 'AI 데이터센터 전력 인프라, 변압기, 송배전',
    coreCodes: [
      '267260',
      '062040',
      '010120',
      '298040',
      '103590',
      '042370',
      '033100',
    ],
    aiPromptHint:
      '전력 인프라 (변압기, 차단기, GIS), 산업용 전기장비, 송배전 설비. 가정용 가전/난방기 제외. 데이터센터 전력 솔루션 포함.',
    excludeKeywords: ['가정용', '가전', '보일러', '난방기'],
  },
  {
    id: 'nuclear',
    label: '원자력/SMR',
    description: '원자력 발전, SMR (소형 모듈 원전), 원전 부품/정비',
    coreCodes: ['034020', '052690', '051600', '015760'],
    aiPromptHint:
      '원자력 발전소 EPC, SMR 기술, 원전 핵심 부품, 정비/운영. 일반 발전 (석탄/가스) 제외.',
    excludeKeywords: [],
  },
  {
    id: 'shipbuilding',
    label: '조선',
    description: '조선업, 선박 엔진, 조선 기자재',
    coreCodes: ['009540', '329180', '042660', '010140', '082740', '010620'],
    aiPromptHint:
      '조선업체, 선박 엔진 (디젤/LNG/암모니아), 조선 기자재 (블록, 도장, 의장). LNG 운반선, 컨테이너선 수주 모멘텀 포함.',
    excludeKeywords: [],
  },
  {
    id: 'defense',
    label: '방산',
    description: '방산 무기체계, 항공우주, 군용 차량',
    coreCodes: ['012450', '079550', '047810', '064350', '272210'],
    aiPromptHint:
      '방산 (유도무기, 항공기, 전차, 자주포), K-방산 수출 모멘텀, 우주항공. 민수 제품 위주는 제외.',
    excludeKeywords: [],
  },
  {
    id: 'construction',
    label: '건설/플랜트',
    description: '종합건설, 산업 플랜트, EPC',
    coreCodes: ['375500', '028050', '000720', '047040', '006360'],
    aiPromptHint:
      '종합건설사, 산업/화학 플랜트, 원전 EPC, 해외 건설 수주. 단순 인테리어/주택 시공업체 제외.',
    excludeKeywords: [],
  },
  {
    id: 'battery',
    label: '2차전지',
    description: '배터리 셀, 양극재, 음극재, 분리막, 전해질',
    coreCodes: ['373220', '006400', '003670', '247540', '086520', '051910'],
    aiPromptHint:
      '배터리 셀 제조, 4대 소재 (양극재/음극재/분리막/전해질), ESS. 단순 화학 (석유화학)은 제외.',
    excludeKeywords: [],
  },
  {
    id: 'auto',
    label: '자동차',
    description: '완성차, 자동차 부품, 전장',
    coreCodes: ['005380', '000270', '012330', '204320', '161390', '011210'],
    aiPromptHint:
      '완성차 (전기차 포함), 자동차 부품 (브레이크, 조향, 변속), 전장, 자율주행. 단순 타이어 외 차량 모빌리티 핵심.',
    excludeKeywords: [],
  },
]

/** @type {Record<string, SectorDefinition>} */
export const SECTOR_DEFINITIONS_BY_ID = Object.fromEntries(
  SECTOR_DEFINITIONS_LIST.map((d) => [d.id, d]),
)

/** @type {Record<string, SectorDefinition>} */
export const SECTOR_DEFINITIONS_BY_LABEL = Object.fromEntries(
  SECTOR_DEFINITIONS_LIST.map((d) => [d.label, d]),
)

/** 한글 라벨 키 — 스펙 호환 */
export const SECTOR_DEFINITIONS = SECTOR_DEFINITIONS_BY_LABEL

/** 레거시 id·라벨 → 신규 정의 */
const SECTOR_ALIASES = {
  ai_semi: 'semi',
  it_parts: 'semi',
  'AI/반도체': 'semi',
  power_equip: 'ai_power',
  전력기기: 'ai_power',
  'AI 인프라': 'ai_power',
  건설: 'construction',
  '2차전지': 'battery',
  자동차: 'auto',
}

/**
 * @param {string} code
 */
export function normalizeSectorCode6(code) {
  return String(code ?? '')
    .replace(/\D/g, '')
    .padStart(6, '0')
}

/**
 * @param {string | { id?: string, label?: string }} sectorKey
 * @returns {SectorDefinition | null}
 */
export function getSectorDefinition(sectorKey) {
  if (sectorKey && typeof sectorKey === 'object') {
    const byId = sectorKey.id ? SECTOR_DEFINITIONS_BY_ID[sectorKey.id] : null
    if (byId) return byId
    if (sectorKey.label) return getSectorDefinition(sectorKey.label)
    return null
  }
  const raw = String(sectorKey ?? '').trim()
  if (!raw) return null
  if (SECTOR_DEFINITIONS_BY_ID[raw]) return SECTOR_DEFINITIONS_BY_ID[raw]
  if (SECTOR_DEFINITIONS_BY_LABEL[raw]) return SECTOR_DEFINITIONS_BY_LABEL[raw]
  const aliasId = SECTOR_ALIASES[raw] || SECTOR_ALIASES[raw.replace(/\s/g, '')]
  if (aliasId && SECTOR_DEFINITIONS_BY_ID[aliasId]) return SECTOR_DEFINITIONS_BY_ID[aliasId]
  const norm = raw.replace(/\s/g, '')
  for (const d of SECTOR_DEFINITIONS_LIST) {
    if (d.label.replace(/\s/g, '') === norm) return d
  }
  return null
}

/**
 * @param {string | { id?: string, label?: string }} sectorOrKey
 * @returns {string[]}
 */
export function getSectorCoreCodes(sectorOrKey) {
  const def = getSectorDefinition(sectorOrKey)
  return def ? [...def.coreCodes] : []
}

/**
 * @param {string} code
 * @param {SectorDefinition} definition
 */
export function isAllowedCoreCode(code, definition) {
  const c = normalizeSectorCode6(code)
  return definition.coreCodes.some((x) => normalizeSectorCode6(x) === c)
}
