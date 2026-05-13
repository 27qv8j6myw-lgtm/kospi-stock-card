/** ATR/종가 비율로 60일 연환산 변동성(%) 근사 — 실데이터 없을 때 variance 조정용 */
export function estimateRealizedVol60AnnFromAtr(atr14: number, price: number): number {
  if (!(price > 0) || !(atr14 > 0)) return 20
  return (atr14 / price) * Math.sqrt(252) * 100
}
