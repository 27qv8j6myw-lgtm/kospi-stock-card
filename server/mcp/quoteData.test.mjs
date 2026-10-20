import { describe, it, expect } from 'vitest'
import { seoulClock, isAfterRegularClose } from './quoteData.mjs'

describe('MCP quote close window', () => {
  it('attaches the regular close only on weekdays after 15:30 KST', () => {
    // 2026-10-16(금) 15:29 / 15:30 / 17:06 KST, 2026-10-17(토) 17:00 KST, 2026-10-19(월) 08:31 KST
    expect(isAfterRegularClose(new Date('2026-10-16T06:29:00Z'))).toBe(false)
    expect(isAfterRegularClose(new Date('2026-10-16T06:30:00Z'))).toBe(true)
    expect(isAfterRegularClose(new Date('2026-10-16T08:06:00Z'))).toBe(true)
    expect(isAfterRegularClose(new Date('2026-10-17T08:00:00Z'))).toBe(false)
    expect(isAfterRegularClose(new Date('2026-10-18T23:31:00Z'))).toBe(false)
    expect(seoulClock(new Date('2026-10-16T08:06:00Z'))).toEqual({ weekday: 'Fri', hhmm: '1706' })
  })
})
