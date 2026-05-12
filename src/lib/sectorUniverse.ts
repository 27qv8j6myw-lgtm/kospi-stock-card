import type { ScreenerSectorKey } from './sectorDefinitions'

export type SectorStock = {
  code: string
  name: string
}

export const sectorUniverse: Record<ScreenerSectorKey, SectorStock[]> = {
  ai_semiconductor: [
    { code: '005930', name: '삼성전자' },
    { code: '000660', name: 'SK하이닉스' },
    { code: '042700', name: '한미반도체' },
    { code: '058470', name: '리노공업' },
    { code: '039030', name: '이오테크닉스' },
  ],
  it_components: [
    { code: '009150', name: '삼성전기' },
    { code: '011070', name: 'LG이노텍' },
    { code: '353200', name: '대덕전자' },
    { code: '222800', name: '심텍' },
    { code: '007810', name: '코리아써키트' },
    { code: '195870', name: '해성디에스' },
    { code: '007660', name: '이수페타시스' },
    { code: '090460', name: '비에이치' },
    { code: '051370', name: '인터플렉스' },
    { code: '091700', name: '파트론' },
    { code: '033240', name: '자화전자' },
    { code: '122990', name: '와이솔' },
  ],
  defense: [
    { code: '012450', name: '한화에어로스페이스' },
    { code: '272210', name: '한화시스템' },
    { code: '079550', name: 'LIG넥스원' },
    { code: '047810', name: '한국항공우주' },
    { code: '064350', name: '현대로템' },
  ],
  shipbuilding: [
    { code: '042660', name: '한화오션' },
    { code: '329180', name: 'HD현대중공업' },
    { code: '010140', name: '삼성중공업' },
    { code: '082740', name: '한화엔진' },
    { code: '267250', name: 'HD현대미포' },
  ],
  power_equipment: [
    { code: '062040', name: '산일전기' },
    { code: '010120', name: 'LS일렉트릭' },
    { code: '103590', name: '일진전기' },
    { code: '298040', name: '효성중공업' },
    { code: '267260', name: 'HD현대일렉트릭' },
  ],
  automobile: [
    { code: '005380', name: '현대차' },
    { code: '000270', name: '기아' },
    { code: '307950', name: '현대오토에버' },
    { code: '012330', name: '현대모비스' },
    { code: '161390', name: '한국타이어앤테크놀로지' },
  ],
  construction: [
    { code: '028260', name: '삼성물산' },
    { code: '000720', name: '현대건설' },
    { code: '047040', name: '대우건설' },
    { code: '375500', name: 'DL이앤씨' },
    { code: '006360', name: 'GS건설' },
  ],
  secondary_battery: [
    { code: '373220', name: 'LG에너지솔루션' },
    { code: '006400', name: '삼성SDI' },
    { code: '066970', name: '엘앤에프' },
    { code: '247540', name: '에코프로비엠' },
    { code: '005490', name: 'POSCO홀딩스' },
  ],
}
