/**
 * 당일 차트 = Yahoo 정규장 분봉 + KIS 통합(UN) 시간외 분봉.
 *
 * x 는 09:00 기준 경과 분이라 프리마켓은 음수(-60~0), 애프터마켓은 390 초과가 된다.
 * 시간외 체결이 아예 없는 종목(NXT 미상장 등)은 구간을 만들지 않아 기존 차트와 같다.
 */
import { getIntradayChart } from '../yahooIntraday.mjs'
import {
  AFTER_CLOSE_MIN,
  PRE_OPEN_MIN,
  SESSION_END_MIN,
  SESSION_START_MIN,
  fetchExtendedIntradayPoints,
  seoulMinutes,
} from './intradayExtended.mjs'

const REGULAR_MAX_OFFSET = SESSION_END_MIN - SESSION_START_MIN

/** @param {number} offset 09:00 기준 경과 분 */
function offsetToClock(offset) {
  const total = SESSION_START_MIN + offset
  const hh = String(Math.floor(total / 60)).padStart(2, '0')
  const mm = String(total % 60).padStart(2, '0')
  return `${hh}:${mm}`
}

/**
 * 체결 포인트를 슬롯 간격으로 전방 채움한다.
 * @param {Array<{ minute: number, price: number }>} points
 * @param {{ fromOffset: number, toOffset: number, step: number, seed: number | null }} range
 */
function fillSlots(points, { fromOffset, toOffset, step, seed }) {
  const sorted = [...points].sort((a, b) => a.minute - b.minute)
  /** @type {Array<{ x: number, time: string, value: number | null }>} */
  const slots = []
  let carry = seed
  let i = 0

  for (let off = fromOffset; off <= toOffset; off += step) {
    while (i < sorted.length && sorted[i].minute - SESSION_START_MIN <= off) {
      carry = sorted[i].price
      i += 1
    }
    slots.push({ x: off, time: offsetToClock(off), value: carry })
  }
  return slots
}

/** 슬롯 경계에 맞춘 값 (step 배수) */
function alignUp(offset, step) {
  return Math.ceil(offset / step) * step
}

function alignDown(offset, step) {
  return Math.floor(offset / step) * step
}

/**
 * @param {string} code6
 * @param {'1m'|'5m'|'15m'} interval
 * @param {'KS'|'KQ'} suffix
 */
export async function getIntradayChartWithExtended(code6, interval = '5m', suffix = 'KS') {
  const base = await getIntradayChart(code6, interval, suffix)
  const step = Number(base.stepMinutes) > 0 ? Number(base.stepMinutes) : 5

  /** @type {{ pre: Array<{minute:number,price:number}>, after: Array<{minute:number,price:number}> }} */
  let ext = { pre: [], after: [] }
  try {
    ext = await fetchExtendedIntradayPoints(code6)
  } catch (e) {
    console.warn('[intraday] 시간외 구간 조회 실패:', e instanceof Error ? e.message : String(e))
  }

  const nowMin = seoulMinutes()
  const baseSeries = Array.isArray(base.series) ? base.series : []
  const lastRegular = [...baseSeries].reverse().find((p) => p.value != null)?.value ?? null

  /** @type {Array<{ x: number, time: string, value: number | null }>} */
  let preSlots = []
  if (ext.pre.length > 0) {
    const firstOffset = ext.pre[0].minute - SESSION_START_MIN
    const lastOffset = ext.pre[ext.pre.length - 1].minute - SESSION_START_MIN
    preSlots = fillSlots(ext.pre, {
      fromOffset: Math.max(PRE_OPEN_MIN - SESSION_START_MIN, alignDown(firstOffset, step)),
      toOffset: Math.min(0, alignUp(lastOffset, step)),
      step,
      seed: null,
    })
  }

  /** @type {Array<{ x: number, time: string, value: number | null }>} */
  let afterSlots = []
  if (ext.after.length > 0) {
    const lastMinute = Math.min(
      AFTER_CLOSE_MIN,
      Math.max(ext.after[ext.after.length - 1].minute, Math.min(nowMin, AFTER_CLOSE_MIN)),
    )
    afterSlots = fillSlots(ext.after, {
      fromOffset: REGULAR_MAX_OFFSET + step,
      toOffset: alignUp(lastMinute - SESSION_START_MIN, step),
      step,
      // 정규장 마지막 값에서 이어 붙여 종가 대비 움직임이 한 선으로 보이게 한다
      seed: lastRegular,
    })
  }

  const series = [...preSlots, ...baseSeries, ...afterSlots]
  const xMin = series.length ? series[0].x : 0
  const xMax = series.length ? series[series.length - 1].x : REGULAR_MAX_OFFSET

  return {
    ...base,
    series,
    xMin,
    xMax,
    extended: {
      pre: preSlots.length > 0,
      after: afterSlots.length > 0,
      sessionEndX: REGULAR_MAX_OFFSET,
    },
  }
}
