/**
 * KRX 코스피/코스닥 마스터(zip) → public/kr-stocks.json
 * @see https://github.com/koreainvestment/open-trading-api/tree/main/stocks_info
 */
import AdmZip from 'adm-zip'
import fs from 'node:fs'
import https from 'node:https'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import iconv from 'iconv-lite'
import { convert } from 'hangul-romanization'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const publicDir = path.join(root, 'public')
const tmp = path.join(root, '.tmp-krx')

function fetchBuf(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          const next = res.headers.location
          res.resume()
          if (!next) reject(new Error('redirect without location'))
          else fetchBuf(next).then(resolve).catch(reject)
          return
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} ${url}`))
          return
        }
        const chunks = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => resolve(Buffer.concat(chunks)))
        res.on('error', reject)
      })
      .on('error', reject)
  })
}

function parseMstFile(mstPath, tailLen) {
  const buf = fs.readFileSync(mstPath)
  const text = iconv.decode(buf, 'euc-kr')
  const rows = []
  for (const line of text.split(/\r?\n/)) {
    if (!line.length) continue
    const cut = line.length - tailLen
    if (cut < 22) continue
    const rf1 = line.slice(0, cut)
    const code = rf1.slice(0, 9).trimEnd()
    const nameKr = rf1.slice(21).trim()
    if (!nameKr || !/^\d{1,6}$/.test(code)) continue
    const c = code.padStart(6, '0')
    let r = ''
    try {
      r = convert(nameKr).toLowerCase().replace(/\s+/g, ' ').trim()
    } catch {
      r = ''
    }
    rows.push({ c, n: nameKr, r })
  }
  return rows
}

async function main() {
  fs.mkdirSync(tmp, { recursive: true })
  fs.mkdirSync(publicDir, { recursive: true })

  const kospiZipPath = path.join(tmp, 'kospi_code.mst.zip')
  const kosdaqZipPath = path.join(tmp, 'kosdaq_code.mst.zip')

  fs.writeFileSync(
    kospiZipPath,
    await fetchBuf(
      'https://new.real.download.dws.co.kr/common/master/kospi_code.mst.zip',
    ),
  )
  fs.writeFileSync(
    kosdaqZipPath,
    await fetchBuf(
      'https://new.real.download.dws.co.kr/common/master/kosdaq_code.mst.zip',
    ),
  )

  new AdmZip(kospiZipPath).extractAllTo(tmp, true)
  new AdmZip(kosdaqZipPath).extractAllTo(tmp, true)

  const kospiMst = path.join(tmp, 'kospi_code.mst')
  const kosdaqMst = path.join(tmp, 'kosdaq_code.mst')
  if (!fs.existsSync(kospiMst) || !fs.existsSync(kosdaqMst)) {
    throw new Error('mst 파일 추출 실패')
  }

  const merged = new Map()
  for (const row of parseMstFile(kospiMst, 228)) merged.set(row.c, row)
  for (const row of parseMstFile(kosdaqMst, 222)) merged.set(row.c, row)

  const list = [...merged.values()].sort((a, b) => a.c.localeCompare(b.c))
  const outPath = path.join(publicDir, 'kr-stocks.json')
  fs.writeFileSync(outPath, JSON.stringify(list))
  console.log(`Wrote ${list.length} rows → ${outPath}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
