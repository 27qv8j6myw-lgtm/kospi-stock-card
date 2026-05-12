export type ScreenerSectorKey =
  | 'ai_semiconductor'
  | 'it_components'
  | 'defense'
  | 'shipbuilding'
  | 'power_equipment'
  | 'automobile'
  | 'construction'
  | 'secondary_battery'

export type SectorDefinition = {
  key: ScreenerSectorKey
  label: string
  description?: string
  keywords?: string[]
}

export const sectorDefinitions: SectorDefinition[] = [
  { key: 'ai_semiconductor', label: 'AI/반도체' },
  {
    key: 'it_components',
    label: 'IT부품',
    description: 'AI 서버, 스마트폰, FC-BGA, MLCC, PCB, 카메라모듈 등 고부가 전자부품 관련 종목군',
    keywords: [
      'AI 서버',
      'FC-BGA',
      'PCB',
      '패키징',
      '카메라모듈',
      'MLCC',
      '스마트폰',
      '애플 공급망',
      'NVIDIA',
      'HBM',
      '서버 투자',
    ],
  },
  { key: 'defense', label: '방산' },
  { key: 'shipbuilding', label: '조선' },
  { key: 'power_equipment', label: '전력기기' },
  { key: 'automobile', label: '자동차' },
  { key: 'construction', label: '건설' },
  { key: 'secondary_battery', label: '2차전지' },
]
