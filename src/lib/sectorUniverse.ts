import type { ScreenerSectorKey } from './sectorDefinitions'
import { SECTORS, stockNameFromMaster } from '@/data/sectorMaster'

export type SectorStock = {
  code: string
  name: string
}

function coreUniverse(id: string): SectorStock[] {
  const row = SECTORS.find((s) => s.id === id)
  if (!row) return []
  return row.stockCodes.map((code) => ({
    code,
    name: stockNameFromMaster(code),
  }))
}

/** 코어 종목 유니버스 — `server/lib/sectorDefinitions.mjs` 와 동기 */
export const sectorUniverse: Record<ScreenerSectorKey, SectorStock[]> = {
  semi: coreUniverse('semi'),
  ai_power: coreUniverse('ai_power'),
  nuclear: coreUniverse('nuclear'),
  shipbuilding: coreUniverse('shipbuilding'),
  defense: coreUniverse('defense'),
  construction: coreUniverse('construction'),
  battery: coreUniverse('battery'),
  auto: coreUniverse('auto'),
}
