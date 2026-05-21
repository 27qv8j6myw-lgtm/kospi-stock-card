/**
 * @param {number[]} prices
 * @param {number} [period]
 */
export function calculateRSI(prices, period = 14) {
  if (!prices || prices.length < period + 1) return null

  const recent = prices.slice(-period - 1)
  let gains = 0
  let losses = 0

  for (let i = 1; i < recent.length; i++) {
    const diff = recent[i] - recent[i - 1]
    if (diff > 0) gains += diff
    else losses -= diff
  }

  const avgGain = gains / period
  const avgLoss = losses / period

  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return Number((100 - 100 / (1 + rs)).toFixed(1))
}

/**
 * @param {number[]} data
 * @param {number} period
 */
function calculateEMA(data, period) {
  const k = 2 / (period + 1)
  let ema = data[0]
  for (let i = 1; i < data.length; i++) {
    ema = data[i] * k + ema * (1 - k)
  }
  return ema
}

/**
 * @param {number[]} prices
 */
export function calculateMACD(prices) {
  if (!prices || prices.length < 26) return null

  const last26 = prices.slice(-26)
  const ema12 = calculateEMA(last26.slice(-12), 12)
  const ema26 = calculateEMA(last26, 26)

  return Number((ema12 - ema26).toFixed(0))
}

/**
 * @param {number[]} prices
 * @param {number} [period]
 */
export function calculateBollinger(prices, period = 20) {
  if (!prices || prices.length < period) return null

  const recent = prices.slice(-period)
  const mean = recent.reduce((a, b) => a + b, 0) / period
  const variance = recent.reduce((a, b) => a + (b - mean) ** 2, 0) / period
  const std = Math.sqrt(variance)

  return {
    middle: mean,
    upper: mean + std * 2,
    lower: mean - std * 2,
    current: prices[prices.length - 1],
  }
}
