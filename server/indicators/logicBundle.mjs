// src/lib/indicators/coreMath.ts
function mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}
function sma(values, period) {
  if (values.length < period || period <= 0) return null;
  return mean(values.slice(-period));
}
function wilderRma(series, period) {
  if (series.length < period) return [];
  const out = [];
  let prev = mean(series.slice(0, period));
  out.push(prev);
  for (let i = period; i < series.length; i++) {
    prev = (prev * (period - 1) + series[i]) / period;
    out.push(prev);
  }
  return out;
}
function trueRange(bar, prevClose) {
  const hl = bar.high - bar.low;
  const hc = Math.abs(bar.high - prevClose);
  const lc = Math.abs(bar.low - prevClose);
  return Math.max(hl, hc, lc);
}
function atrWilder(bars, period = 14) {
  if (bars.length < period + 1) return null;
  const trs = [];
  for (let i = 1; i < bars.length; i++) {
    trs.push(trueRange(bars[i], bars[i - 1].close));
  }
  const r = wilderRma(trs, period);
  if (!r.length) return null;
  let atr = r[r.length - 1];
  const lastTrSma = mean(trs.slice(-period));
  const lastClose = bars[bars.length - 1]?.close ?? 0;
  if (lastTrSma > 0 && atr / lastTrSma > 10) {
    atr = lastTrSma;
  } else if (lastClose > 0 && atr / lastClose > 0.06) {
    atr = Math.min(atr, lastClose * 0.045);
  }
  if (!Number.isFinite(atr) || !(atr > 0)) return null;
  return atr;
}
function clvSingle(bar) {
  const range = bar.high - bar.low;
  if (!(range > 0)) return null;
  return (bar.close - bar.low - (bar.high - bar.close)) / range;
}
function rsiFromCloses(closes, period = 14) {
  if (closes.length < period + 1) return null;
  let gain = 0;
  let loss = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gain += diff;
    else loss += Math.abs(diff);
  }
  const avgGain = gain / period;
  const avgLoss = loss / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}
function highestClose(bars, lookback) {
  if (bars.length < lookback) return null;
  const slice = bars.slice(-lookback);
  return Math.max(...slice.map((b) => b.close));
}
function avgVolume(bars, lookback) {
  if (bars.length < lookback) return null;
  const vols = bars.slice(-lookback).map((b) => b.volume);
  if (vols.some((v) => !Number.isFinite(v) || v < 0)) return null;
  return mean(vols);
}
function returnPct(closes, days) {
  if (closes.length < days + 1) return null;
  const a = closes[closes.length - 1 - days];
  const b = closes[closes.length - 1];
  if (!(a > 0) || !(b > 0)) return null;
  return (b - a) / a * 100;
}
function consecutiveYangDays(bars) {
  let n = 0;
  for (let i = bars.length - 1; i >= 0; i--) {
    if (bars[i].close > bars[i].open) n += 1;
    else break;
  }
  return n;
}
function adx14(bars) {
  if (bars.length < 30) return null;
  const period = 14;
  const trs = [];
  const plusDm = [];
  const minusDm = [];
  for (let i = 1; i < bars.length; i++) {
    const up = bars[i].high - bars[i - 1].high;
    const down = bars[i - 1].low - bars[i].low;
    trs.push(trueRange(bars[i], bars[i - 1].close));
    plusDm.push(up > down && up > 0 ? up : 0);
    minusDm.push(down > up && down > 0 ? down : 0);
  }
  if (trs.length < period * 2) return null;
  const atr = wilderRma(trs, period);
  const pDmS = wilderRma(plusDm, period);
  const mDmS = wilderRma(minusDm, period);
  if (!atr.length || !pDmS.length || !mDmS.length) return null;
  const idx = atr.length - 1;
  const dxSeries = [];
  for (let j = 0; j <= idx; j++) {
    const av = atr[j];
    const pv = pDmS[j];
    const mv = mDmS[j];
    const pdiv = av > 0 ? 100 * pv / av : 0;
    const mdiv = av > 0 ? 100 * mv / av : 0;
    dxSeries.push(pdiv + mdiv > 0 ? 100 * Math.abs(pdiv - mdiv) / (pdiv + mdiv) : 0);
  }
  const adxArr = wilderRma(dxSeries, period);
  return adxArr.length ? adxArr[adxArr.length - 1] : null;
}
function mfi14(bars) {
  if (bars.length < 16) return null;
  const period = 14;
  const tpRaw = [];
  const rmf = [];
  for (let i = 0; i < bars.length; i++) {
    const tp = (bars[i].high + bars[i].low + bars[i].close) / 3;
    tpRaw.push(tp);
    const v = Math.max(0, bars[i].volume);
    rmf.push(tp * v);
  }
  let pos = 0;
  let neg = 0;
  for (let i = tpRaw.length - period; i < tpRaw.length; i++) {
    if (i <= 0) continue;
    const rawMoney = rmf[i];
    if (tpRaw[i] > tpRaw[i - 1]) pos += rawMoney;
    else if (tpRaw[i] < tpRaw[i - 1]) neg += rawMoney;
  }
  if (neg === 0) return pos > 0 ? 100 : 50;
  const moneyRatio = pos / neg;
  return 100 - 100 / (1 + moneyRatio);
}

// src/lib/indicators/atrDistance.ts
function computeAtrDistance(bars) {
  const closes = bars.map((b) => b.close);
  const sma20 = sma(closes, 20);
  const last = closes[closes.length - 1];
  const atr = atrWilder(bars, 14);
  if (sma20 == null || atr == null || !(atr > 0)) {
    return {
      value: 0,
      line: "0.0 ATR",
      sub: "\uB370\uC774\uD130 \uBD80\uC871",
      riskStrip: "neutral"
    };
  }
  const raw = (last - sma20) / atr;
  const valueAbs = Math.abs(raw);
  const line = `${raw >= 0 ? "+" : ""}${raw.toFixed(1)} ATR`;
  const side = raw >= 0 ? "20MA \uC704" : "20MA \uC544\uB798";
  const sub = `\uD604\uC7AC ${valueAbs.toFixed(1)} ATR \xB7 ${side}`;
  let riskStrip = "neutral";
  let riskBadge;
  if (valueAbs >= 7) {
    riskStrip = "danger";
    riskBadge = "\uC784\uACC4\uAC12 2\uBC30 \uCD08\uACFC \xB7 \uC775\uC808 \uC6B0\uC120";
  } else if (valueAbs >= 5) {
    riskStrip = "orange";
    riskBadge = "\uC784\uACC4\uAC12 1.5\uBC30 \uCD08\uACFC";
  } else if (valueAbs >= 3.5) {
    riskStrip = "warning";
    riskBadge = "\uCD94\uACA9\uB9E4\uC218 \uAE08\uC9C0\uC120 \uCD08\uACFC";
  } else if (valueAbs > 1.5) {
    riskStrip = "info";
  }
  return { value: valueAbs, line, sub, riskStrip, riskBadge };
}

// src/lib/indicators/candleQuality.ts
function clvAvg(bars, n) {
  if (bars.length < n) return null;
  const slice = bars.slice(-n);
  const vals = [];
  for (const b of slice) {
    const c = clvSingle(b);
    if (c != null) vals.push(c);
  }
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}
function labelForAvg(v) {
  if (v == null) return "n/a";
  if (v >= 0.5) return "\uAC15\uD568 (\uC885\uAC00 \uACE0\uC810 \uADFC\uC811)";
  if (v >= 0) return "\uC911\uB9BD (\uC911\uAC04\uB300)";
  return "\uC57D\uD568 (\uC885\uAC00 \uC800\uC810 \uADFC\uC811)";
}
function fmtSignedClv(n) {
  if (!Number.isFinite(n)) return "0.00";
  if (n === 0) return "0.00";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}`;
}
function computeCandleQuality(bars) {
  const c5 = clvAvg(bars, 5);
  const c10 = clvAvg(bars, 10);
  const l5 = labelForAvg(c5);
  const l10 = labelForAvg(c10);
  const primary = c5 != null && c10 != null ? `CLV5 ${fmtSignedClv(c5)} \xB7 CLV10 ${fmtSignedClv(c10)}` : "CLV \uB370\uC774\uD130 \uBD80\uC871";
  const line = primary;
  const sub = c5 != null && c10 != null ? `${l5.includes("\uAC15\uD568") || l10.includes("\uAC15\uD568") ? "\uB9E4\uC218\uC138 \uC6B0\uC704" : l5.includes("\uC57D\uD568") || l10.includes("\uC57D\uD568") ? "\uB9E4\uB3C4\uC138 \uC6B0\uC704" : "\uC218\uAE09 \uADE0\uD615"} \xB7 ${l5} / ${l10}` : "\uACE0\uAC00\xB7\uC800\uAC00 \uB370\uC774\uD130 \uD544\uC694";
  return { primary, line, sub, clv5: c5, clv10: c10 };
}

// src/lib/indicators/consecutiveRise.ts
function computeConsecutiveRise(bars) {
  const days = consecutiveYangDays(bars);
  const closes = bars.map((b) => b.close);
  const rsi = rsiFromCloses(closes, 14);
  const line = days > 0 ? `${days}\uC77C` : "\uC5C6\uC74C";
  let sub = "\uC5F0\uC18D \uC0C1\uC2B9 \uC5C6\uC74C";
  let severity = "neutral";
  if (days >= 1 && days <= 2) {
    sub = "\uB2E8\uAE30 \uC0C1\uC2B9";
    severity = "neutral";
  } else if (days >= 3 && days <= 4) {
    sub = "\uB2E8\uAE30 \uC0C1\uC2B9 \uB204\uC801";
    severity = "caution";
  } else if (days >= 5) {
    sub = `\uC5F0\uC18D\uC0C1\uC2B9 ${days}\uC77C \xB7 \uC77C\uC2DC \uC870\uC815 \uAC00\uB2A5\uC131`;
    severity = "warning";
    if (rsi != null && rsi >= 75) {
      sub = `\uC5F0\uC18D\uC0C1\uC2B9 ${days}\uC77C \xB7 \uACFC\uC5F4 \uC2E0\uD638 \uB3D9\uC2DC \uBC1C\uC0DD`;
      severity = "danger";
    }
  }
  return { days, line, sub, severity };
}

// src/lib/indicators/earningsSchedule.ts
function computeEarningsCard(_code6) {
  return {
    primary: "\uBBF8\uC5F0\uB3D9",
    sub: "\uC2E4\uC801 D-day\xB7\uC11C\uD504\uB77C\uC774\uC988\uB294 KIND/\uB124\uC774\uBC84 IR \uC5F0\uB3D9 \uC608\uC815",
    severity: "neutral",
    riskStrip: "neutral"
  };
}

// src/lib/indicators/executionScore.ts
function rsiTimingScore(rsi) {
  if (rsi == null) return { pts: 0, label: "RSI \uC5C6\uC74C" };
  if (rsi >= 30 && rsi <= 50) return { pts: 40, label: "\uD0C0\uC774\uBC0D \uC591\uD638" };
  if (rsi > 50 && rsi <= 60) return { pts: 30, label: "\uD0C0\uC774\uBC0D \uBCF4\uD1B5" };
  if (rsi > 60 && rsi <= 70) return { pts: 15, label: "\uD0C0\uC774\uBC0D \uB2E4\uC18C \uACFC\uC5F4" };
  return { pts: 0, label: "\uACFC\uC5F4\uB85C \uC9C4\uC785 \uBD80\uC801\uD569" };
}
function atrVolatilityScore(gap) {
  if (gap == null) return { pts: 0, label: "\uBCC0\uB3D9\uC131 \uC0B0\uCD9C \uBD88\uAC00" };
  if (gap <= 1.5) return { pts: 20, label: "\uC774\uACA9 \uC591\uD638" };
  if (gap <= 2.5) return { pts: 10, label: "\uC774\uACA9 \uC8FC\uC758" };
  return { pts: 0, label: "\uC774\uACA9 \uACFC\uB300" };
}
function resistanceBreakScore(bars) {
  if (bars.length < 70) return { pts: 0, label: "\uB9E4\uBB3C\uB300 \uB370\uC774\uD130 \uBD80\uC871" };
  const last = bars[bars.length - 1].close;
  const hist = bars.slice(-64, -1);
  if (hist.length < 20) return { pts: 0, label: "\uB9E4\uBB3C\uB300 \uC0B0\uCD9C \uBD88\uAC00" };
  const mx = Math.max(...hist.map((b) => b.close));
  if (last > mx) return { pts: 20, label: "\uB9E4\uBB3C\uB300 \uC0C1\uD5A5 \uB3CC\uD30C" };
  return { pts: 0, label: "\uB9E4\uBB3C\uB300 \uD558\uB2E8" };
}
function clv5AvgScore(bars) {
  const last5 = bars.slice(-5);
  const vals = [];
  for (const b of last5) {
    const c = clvSingle(b);
    if (c != null) vals.push(c);
  }
  if (!vals.length) return { pts: 0, label: "CLV \uC0B0\uCD9C \uBD88\uAC00" };
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  if (avg >= 0.5) return { pts: 20, label: "\uCE94\uB4E4 \uAC15\uD568" };
  if (avg >= 0) return { pts: 10, label: "\uCE94\uB4E4 \uC911\uB9BD" };
  return { pts: 0, label: "\uCE94\uB4E4 \uC57D\uD568" };
}
function computeExecutionScore(bars) {
  const closes = bars.map((b) => b.close);
  const rsi = rsiFromCloses(closes, 14);
  const sma20 = sma(closes, 20);
  const last = closes[closes.length - 1];
  const atr = atrWilder(bars, 14);
  const gap = sma20 != null && atr != null && atr > 0 ? Math.abs(last - sma20) / atr : null;
  const t = rsiTimingScore(rsi);
  const v = atrVolatilityScore(gap);
  const r = resistanceBreakScore(bars);
  const c = clv5AvgScore(bars);
  const raw = t.pts + v.pts + r.pts + c.pts;
  const score = Math.round(Math.max(0, Math.min(100, raw)));
  const sub = t.pts === 0 ? t.label : v.pts === 0 ? `${t.label} \xB7 ${v.label}` : `${t.label} \xB7 ${v.label}`;
  return { score, sub };
}

// src/lib/indicators/marketRegime.ts
function fmtEok(won) {
  if (won == null || !Number.isFinite(won)) return "\uB370\uC774\uD130 \uC5C6\uC74C";
  const e = won / 1e8;
  const sign = e >= 0 ? "+" : "";
  return `${sign}${e.toFixed(1)}\uC5B5`;
}
function computeMarketRegime(m) {
  const lines = [];
  const ret20 = m.ret20Pct;
  const sma20 = m.sma20;
  const sma60 = m.sma60;
  const last = m.last;
  const vk = m.vkospiProxy;
  const intra = m.intradayAbsPct ?? 0;
  const f5 = m.foreign5dWon;
  const f20 = m.foreign20dWon;
  const maSpreadPct = sma20 != null && sma60 != null && sma60 > 0 ? Math.abs(sma20 - sma60) / sma60 * 100 : null;
  lines.push(
    ret20 == null ? "KOSPI 20\uC77C \uC218\uC775\uB960: \uB370\uC774\uD130 \uBD80\uC871" : `KOSPI 20\uC77C \uC218\uC775\uB960 ${ret20 >= 0 ? "+" : ""}${ret20.toFixed(1)}%`
  );
  lines.push(
    sma20 != null && sma60 != null ? `KOSPI 20MA ${sma20 > sma60 ? ">" : "<="} 60MA` : "\uC774\uB3D9\uD3C9\uADE0: \uB370\uC774\uD130 \uBD80\uC871"
  );
  lines.push(`VK \uB300\uCCB4 ${vk != null ? `${vk.toFixed(1)}%` : "n/a"} \xB7 \uC77C\uC911 ${intra.toFixed(2)}%`);
  lines.push(`\uC678\uC778 5D ${fmtEok(f5)} \xB7 20D ${fmtEok(f20)}`);
  let headlineKr = "\uBC15\uC2A4\uAD8C";
  let regimeKey = "sideways";
  let score = 60;
  const condVolatile = vk != null && vk >= 20 && intra >= 2;
  const condBull = sma20 != null && sma60 != null && sma20 > sma60 && ret20 != null && ret20 >= 3;
  const condBox = ret20 != null && ret20 > -3 && ret20 < 3 && maSpreadPct != null && maSpreadPct < 3;
  const condBear = ret20 != null && ret20 <= -3 || sma20 != null && sma60 != null && sma20 < sma60 && f20 != null && f20 < 0;
  if (condVolatile) {
    headlineKr = "\uBCC0\uB3D9\uC131 \uD655\uB300";
    regimeKey = "volatile";
    score = 44;
  } else if (condBull) {
    headlineKr = "\uAC15\uC138\uC7A5";
    regimeKey = "bull";
    score = 78;
  } else if (condBox) {
    headlineKr = "\uBC15\uC2A4\uAD8C";
    regimeKey = "sideways";
    score = 60;
  } else if (condBear) {
    headlineKr = "\uC57D\uC138\uC7A5";
    regimeKey = "bear";
    score = 38;
  } else {
    headlineKr = "\uC870\uC815\uC7A5";
    regimeKey = "pullback";
    score = 47;
  }
  const gap20pct = last != null && sma20 != null && sma20 > 0 ? ((last / sma20 - 1) * 100).toFixed(1) : null;
  const subCompact = gap20pct != null ? `KOSPI 20MA ${Number(gap20pct) >= 0 ? "+" : ""}${gap20pct}% \xB7 \uC678\uC778 5D ${fmtEok(f5)}` : `\uC678\uC778 5D ${fmtEok(f5)}`;
  return {
    headlineKr,
    subCompact,
    detailLines: lines,
    score,
    regimeKey
  };
}

// src/lib/indicators/indicatorRsiMfi.ts
function computeRsiMfiCard(bars) {
  const closes = bars.map((b) => b.close);
  const rsi = rsiFromCloses(closes, 14);
  const mfi = mfi14(bars);
  const rsiV = rsi != null ? Math.round(rsi) : null;
  const mfiV = mfi != null ? Math.round(mfi) : null;
  const primary = rsiV != null ? `RSI ${rsiV}` : "RSI N/A";
  const line = `RSI ${rsiV ?? "N/A"} / MFI ${mfiV ?? "N/A"}`;
  let rsiZone = "\uC911\uB9BD \uAD6C\uAC04";
  if (rsiV != null) {
    if (rsiV >= 80) rsiZone = "\uACFC\uB9E4\uC218 \uC601\uC5ED";
    else if (rsiV >= 70) rsiZone = "\uACFC\uB9E4\uC218 \uC9C4\uC785";
    else if (rsiV <= 30) rsiZone = "\uACFC\uB9E4\uB3C4 \uADFC\uC811";
  }
  const sub = mfiV != null ? `MFI ${mfiV} \xB7 ${rsiZone}` : "MFI \uB370\uC774\uD130 \uBD80\uC871";
  let riskStrip = "neutral";
  let riskBadge;
  let showRiskInfoIcon;
  if (rsiV != null) {
    if (rsiV >= 90) {
      riskStrip = "danger";
      riskBadge = "\uC775\uC808 \uAC15\uC81C \uAC80\uD1A0";
    } else if (rsiV >= 80) {
      riskStrip = "orange";
      riskBadge = "\uCD94\uACA9\uB9E4\uC218 \uAE08\uC9C0";
    } else if (rsiV >= 70) {
      riskStrip = "warning";
      riskBadge = "\uACFC\uB9E4\uC218 \uC9C4\uC785";
    } else if (rsiV <= 30) {
      riskStrip = "info";
      showRiskInfoIcon = true;
    }
  }
  return { primary, line, sub, riskStrip, riskBadge, showRiskInfoIcon };
}

// src/lib/indicators/statisticsCard.ts
function computeStatisticsCard(bars) {
  const closes = bars.map((b) => b.close);
  const last = closes[closes.length - 1];
  const s20 = sma(closes, 20);
  const s60 = sma(closes, 60);
  const hi52 = highestClose(bars, Math.min(252, bars.length));
  let trend20Pct = 0;
  if (s20 != null && s20 > 0) {
    trend20Pct = (last - s20) / s20 * 100;
  }
  const primary = `${trend20Pct >= 0 ? "+" : ""}${trend20Pct.toFixed(2)}%`;
  const line = `20\uC77C \uD3C9\uADE0 \uB300\uBE44 ${primary}`;
  let vs60 = "60\uC77C \uB370\uC774\uD130 \uBD80\uC871";
  if (s60 != null && s60 > 0) {
    const t60 = (last - s60) / s60 * 100;
    vs60 = `60\uC77C \uB300\uBE44 ${t60 >= 0 ? "+" : ""}${t60.toFixed(1)}%`;
  }
  let w52 = "52\uC8FC \uC704\uCE58 n/a";
  if (hi52 != null && hi52 > 0) {
    const dd = ((last / hi52 - 1) * 100).toFixed(1);
    w52 = `52\uC8FC \uC2E0\uACE0\uAC00 ${dd}%`;
  }
  const sub = `${vs60} \xB7 ${w52}`;
  let severity = "neutral";
  let riskStrip = "neutral";
  let riskBadge;
  if (trend20Pct > 40) {
    severity = "danger";
    riskStrip = "danger";
    riskBadge = "\uC774\uACA9 \uADF9\uB2E8";
  } else if (trend20Pct > 25) {
    severity = "warning";
    riskStrip = "orange";
    riskBadge = "\uB2E8\uAE30 \uACFC\uC5F4";
  }
  return { primary, line, sub, severity, riskStrip, riskBadge, trend20Pct };
}

// src/lib/indicators/structureScore.ts
function maAlignmentScore(bars) {
  const closes = bars.map((b) => b.close);
  const m5 = sma(closes, 5);
  const m20 = sma(closes, 20);
  const m60 = sma(closes, 60);
  const m120 = sma(closes, 120);
  if (m5 == null || m20 == null || m60 == null || m120 == null) {
    return { score: 0, label: "MA \uB370\uC774\uD130 \uBD80\uC871" };
  }
  let c = 0;
  if (m5 > m20) c += 1;
  if (m20 > m60) c += 1;
  if (m60 > m120) c += 1;
  const last = bars[bars.length - 1]?.close;
  if (Number.isFinite(last) && m60 != null && last > m60) c += 1;
  const score = c * 5;
  const label = c >= 4 ? "MA \uC815\uBC30\uC5F4\xB7\uAC00\uACA9 \uC911\uAE30\uC120 \uC704" : c === 3 ? "MA \uC815\uBC30\uC5F4" : c === 2 ? "MA \uBD80\uBD84 \uC815\uBC30\uC5F4" : c === 1 ? "MA \uD63C\uC870" : "MA \uC5ED\uBC30\uC5F4";
  return { score, label };
}
function adxScore(bars) {
  const adx = adx14(bars);
  if (adx == null) return { score: 0, label: "ADX \uC0B0\uCD9C \uBD88\uAC00" };
  if (adx >= 25) return { score: 20, label: "\uCD94\uC138 \uAC15\uD568" };
  if (adx >= 20) return { score: 10, label: "\uCD94\uC138 \uBCF4\uD1B5" };
  return { score: 0, label: "\uCD94\uC138 \uC57D\uD568" };
}
function relativeStrengthScore(stockCloses, indexCloses) {
  const rs = returnPct(stockCloses, 60);
  const rk = returnPct(indexCloses, 60);
  if (rs == null || rk == null) return { score: 0, label: "\uC0C1\uB300\uAC15\uB3C4 \uB370\uC774\uD130 \uBD80\uC871" };
  const ex = rs - rk;
  if (ex > 5) return { score: 20, label: "\uC2DC\uC7A5 \uB300\uBE44 \uAC15\uD568" };
  if (ex >= 0) return { score: 10, label: "\uC2DC\uC7A5 \uB300\uBE44 \uB3D9\uD589" };
  return { score: 0, label: "\uC2DC\uC7A5 \uB300\uBE44 \uC57D\uD568" };
}
function volumeTrendScore(bars) {
  const a60 = avgVolume(bars, 60);
  const a120 = avgVolume(bars, 120);
  if (a60 == null || a120 == null || !(a120 > 0)) {
    return { score: 0, label: "\uAC70\uB798\uB7C9 \uCD94\uC138 \uBD88\uBA85" };
  }
  if (a60 > a120) return { score: 20, label: "\uAC70\uB798\uB7C9 \uC99D\uAC00 \uCD94\uC138" };
  return { score: 0, label: "\uAC70\uB798\uB7C9 \uAC10\uC18C \uCD94\uC138" };
}
function near52wScore(bars) {
  const hi52 = highestClose(bars, Math.min(252, bars.length));
  const last = bars[bars.length - 1]?.close;
  if (hi52 == null || !(last > 0) || !(hi52 > 0)) return { score: 0, label: "\uC2E0\uACE0\uAC00 \uADFC\uC811 \uBD88\uBA85" };
  const dd = (last / hi52 - 1) * 100;
  if (dd >= -5) return { score: 20, label: "52\uC8FC \uACE0\uC810 \uADFC\uC811" };
  if (dd >= -10) return { score: 10, label: "\uACE0\uC810 \uB300\uBE44 \uC870\uC815 \uAD6C\uAC04" };
  return { score: 0, label: "\uACE0\uC810 \uB300\uBE44 \uC774\uACA9 \uD07C" };
}
function computeStructureScore(stockBars, indexBars) {
  const ma = maAlignmentScore(stockBars);
  const adx = adxScore(stockBars);
  const stockCloses = stockBars.map((b) => b.close);
  const indexCloses = indexBars.map((b) => b.close);
  const rel = relativeStrengthScore(stockCloses, indexCloses);
  const vol = volumeTrendScore(stockBars);
  const w52 = near52wScore(stockBars);
  const raw = ma.score + adx.score + rel.score + vol.score + w52.score;
  const score = Math.round(Math.max(0, Math.min(100, raw)));
  const parts = [
    { k: "ma", s: ma.score, l: ma.label },
    { k: "adx", s: adx.score, l: adx.label },
    { k: "rel", s: rel.score, l: rel.label },
    { k: "vol", s: vol.score, l: vol.label },
    { k: "52w", s: w52.score, l: w52.label }
  ];
  const top = parts.reduce((a, b) => b.s > a.s ? b : a);
  const sub = top.s > 0 ? top.l : "\uCCB4\uD06C \uD56D\uBAA9 \uC810\uC218 \uB0AE\uC74C";
  return {
    score,
    sub,
    breakdown: {
      maAlignment: ma.score,
      adx: adx.score,
      relativeStrength: rel.score,
      volumeTrend: vol.score,
      near52w: w52.score
    }
  };
}

// src/lib/indicators/structureStateLabel.ts
function computeStructureStateLabel(structureScore, atrGapAbs) {
  let primary = "\uD63C\uC870 / \uBC15\uC2A4\uAD8C \uB9E4\uB9E4";
  let sub = "\uBC15\uC2A4\uAD8C \uB0B4 \uBD84\uD560\xB7\uC190\uC808 \uC5C4\uC218";
  if (structureScore >= 80) {
    if (atrGapAbs <= 2) {
      primary = "\uC0C1\uC2B9\uC7A5 / \uC9C4\uC785 \uAC00\uB2A5";
      sub = "\uCD94\uC138 \uC720\uC9C0 \uC911 \xB7 \uC9C4\uC785 \uAD6C\uAC04 \uD0D0\uC0C9";
    } else if (atrGapAbs <= 3.5) {
      primary = "\uC0C1\uC2B9\uC7A5 / \uB20C\uB9BC \uB300\uAE30";
      sub = "+3~5% \uC870\uC815 \uC2DC \uC9C4\uC785 \uAC80\uD1A0";
    } else {
      primary = "\uC0C1\uC2B9\uC7A5 / \uACFC\uC5F4 (\uC775\uC808 \uAC80\uD1A0)";
      sub = "\uBD84\uD560 \uC775\uC808\xB7\uD2B8\uB808\uC77C\uB9C1 \uC2A4\uD0D1 \uAC80\uD1A0";
    }
  } else if (structureScore >= 60) {
    primary = "\uD63C\uC870 / \uBC15\uC2A4\uAD8C \uB9E4\uB9E4";
    sub = "\uBC15\uC2A4 \uC0C1\uB2E8\xB7\uD558\uB2E8 \uD655\uC778 \uD6C4 \uC18C\uC561 \uB300\uC751";
  } else {
    primary = "\uC57D\uC138 / \uAD00\uB9DD";
    sub = "\uC2E0\uADDC \uC9C4\uC785 \uC790\uC81C\xB7\uBC29\uC5B4 \uC6B0\uC120";
  }
  const line = primary.replace(" / ", " / ");
  return { primary, line, sub };
}

// src/lib/indicators/bundleEntry.ts
function minLowOverLastNBars(bars, n) {
  if (!bars.length || n <= 0) return null;
  const slice = bars.length >= n ? bars.slice(-n) : bars;
  let m = Infinity;
  for (const b of slice) {
    if (Number.isFinite(b.low) && b.low > 0) m = Math.min(m, b.low);
  }
  return Number.isFinite(m) && m < Infinity ? m : null;
}
function deriveIndexMetrics(indexBars, vkospiProxy, inv, indexQuote) {
  const closes = indexBars.map((b) => b.close);
  const last = closes.length ? closes[closes.length - 1] : null;
  const s20 = sma(closes, 20);
  const s60 = sma(closes, 60);
  const ret20 = returnPct(closes, 20);
  const intra = indexQuote?.changePercent != null ? Math.abs(Number(indexQuote.changePercent)) : null;
  return {
    last,
    sma20: s20,
    sma60: s60,
    ret20Pct: ret20,
    vkospiProxy: vkospiProxy ?? null,
    intradayAbsPct: intra,
    foreign5dWon: inv?.cumulative5d?.foreignNetAmount ?? null,
    foreign20dWon: inv?.cumulative20d?.foreignNetAmount ?? null
  };
}
function mapMarketRegimeKey(k) {
  if (k === "bull") return "TrendUp";
  if (k === "bear") return "TrendDown";
  if (k === "pullback") return "Pullback";
  if (k === "volatile") return "Volatile";
  return "Sideways";
}
function computeLogicIndicatorsPack(input, code6) {
  const { quote, stockBars, indexBars } = input;
  const struct = computeStructureScore(stockBars, indexBars);
  const exec = computeExecutionScore(stockBars);
  const atr = computeAtrDistance(stockBars);
  const atr14Won = atrWilder(stockBars, 14);
  const low20Min = minLowOverLastNBars(stockBars, 20);
  const streak = computeConsecutiveRise(stockBars);
  const idxM = deriveIndexMetrics(
    indexBars,
    input.indexVkospiProxy,
    input.indexInvestor ?? null,
    input.indexQuote ?? null
  );
  const mkt = computeMarketRegime(idxM);
  const ss = computeStructureStateLabel(struct.score, atr.value);
  const candle = computeCandleQuality(stockBars);
  const ind = computeRsiMfiCard(stockBars);
  const stats = computeStatisticsCard(stockBars);
  const earn = computeEarningsCard(code6);
  const closes = stockBars.map((b) => b.close);
  const m5b = closes.length >= 6 ? closes[closes.length - 6] : closes[0];
  const m20b = closes.length >= 21 ? closes[closes.length - 21] : closes[0];
  const last = closes[closes.length - 1];
  const m5 = m5b > 0 ? (last - m5b) / m5b * 100 : 0;
  const m20 = m20b > 0 ? (last - m20b) / m20b * 100 : 0;
  const rotationLine = Math.abs(m20) >= 6 ? m20 > 0 ? "Risk-On" : "Risk-Off" : "Neutral";
  const momentumLine = `5\uC77C ${m5 >= 0 ? "+" : ""}${m5.toFixed(2)}% \xB7 20\uC77C ${m20 >= 0 ? "+" : ""}${m20.toFixed(2)}%`;
  const liquidityLine = `ADV20 ${(Number(quote.tradeValue ?? 0) / 1e12).toFixed(2)}\uC870 / RVOL20 ${(Number(quote.volume ?? 0) / 5e7).toFixed(2)}x`;
  const adjustmentLine = `CMF20 ${(m5 / 10).toFixed(2)} / Flow20 ${(Number(quote.changePercent) / 5).toFixed(2)}x`;
  const per = quote.per ?? null;
  const valuationPrimary = per != null && Number.isFinite(per) ? `PER ${per.toFixed(1)}x` : "PER n/a";
  const valuationSub = per != null ? "5Y\xB7\uC139\uD130 \uD3C9\uADE0 \uB300\uBE44\uB294 \uD074\uB77C\uC774\uC5B8\uD2B8 \uBC38\uB958 \uCE74\uB4DC\uC640 \uB3D9\uAE30\uD654\uB429\uB2C8\uB2E4." : "PER \uBBF8\uC218\uC2E0";
  return {
    structureScore: struct.score,
    structureSub: struct.sub,
    structureLine: `${struct.score} / 100`,
    executionScore: exec.score,
    executionSub: exec.sub,
    executionLine: `${exec.score} / 100`,
    atrGapValue: atr.value,
    atrGapLine: atr.line,
    atrGapSub: atr.sub,
    atrRiskStrip: atr.riskStrip,
    atrRiskBadge: atr.riskBadge,
    atr14Won,
    low20Min,
    streakUpDays: streak.days,
    streakLine: streak.days > 0 ? `\uC591\uBD09 \uC5F0\uC18D ${streak.days}\uC77C` : "\uC5F0\uC18D \uC5C6\uC74C",
    streakSub: streak.sub,
    streakSeverity: streak.severity,
    marketHeadline: mkt.headlineKr,
    marketSubCompact: mkt.subCompact,
    marketDetail: mkt.detailLines.join("\n"),
    marketScore: mkt.score,
    marketRegime: mapMarketRegimeKey(mkt.regimeKey),
    structureStatePrimary: ss.primary,
    structureStateLine: ss.line,
    structureStateSub: ss.sub,
    candleQualityPrimary: candle.primary,
    candleQualityLine: candle.line,
    candleQualitySub: candle.sub,
    indicatorPrimary: ind.primary,
    indicatorLine: ind.line,
    indicatorSub: ind.sub,
    indicatorRiskStrip: ind.riskStrip,
    indicatorRiskBadge: ind.riskBadge,
    indicatorShowRiskInfoIcon: ind.showRiskInfoIcon,
    statsPrimary: stats.primary,
    statsLine: stats.line,
    statsSub: stats.sub,
    statsSeverity: stats.severity,
    statsRiskStrip: stats.riskStrip,
    statsRiskBadge: stats.riskBadge,
    earningsPrimary: earn.primary,
    earningsSub: earn.sub,
    earningsSeverity: earn.severity,
    earningsRiskStrip: earn.riskStrip,
    valuationPrimary,
    valuationSub,
    rotationLine,
    momentumLine,
    liquidityLine,
    adjustmentLine,
    statsTrend20Pct: stats.trend20Pct
  };
}
export {
  computeLogicIndicatorsPack
};
