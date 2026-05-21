export type ScreenerSectorKey =
  | 'semi'
  | 'ai_power'
  | 'nuclear'
  | 'shipbuilding'
  | 'defense'
  | 'construction'
  | 'battery'
  | 'auto'

export type SectorDefinition = {
  key: ScreenerSectorKey
  label: string
  description?: string
}

/** UI·필터용 8개 섹터 (`server/lib/sectorDefinitions.mjs` 와 동기) */
export const sectorDefinitions: SectorDefinition[] = [
  { key: 'semi', label: '반도체', description: '메모리/시스템 반도체, 장비, 후방 기판/소재' },
  {
    key: 'ai_power',
    label: 'AI 인프라/전력기기',
    description: 'AI 데이터센터 전력 인프라, 변압기, 송배전',
  },
  { key: 'nuclear', label: '원자력/SMR', description: '원자력 발전, SMR, 원전 부품/정비' },
  { key: 'shipbuilding', label: '조선', description: '조선업, 선박 엔진, 조선 기자재' },
  { key: 'defense', label: '방산', description: '방산 무기체계, 항공우주, 군용 차량' },
  { key: 'construction', label: '건설/플랜트', description: '종합건설, 산업 플랜트, EPC' },
  { key: 'battery', label: '2차전지', description: '배터리 셀·소재·ESS' },
  { key: 'auto', label: '자동차', description: '완성차, 부품, 전장' },
]
