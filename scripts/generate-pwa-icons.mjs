/**
 * PWA 아이콘 — 6개 섹터 3×2, 흰 배경 (`LoginSectorIconGrid` · 원자력·2차전지 제외)
 * @example npm run generate:pwa-icons
 */
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = join(__dirname, '..', 'public')

const BG = '#ffffff'

/** @type {Record<string, { fg: string }>} — `src/styles/tokens.css` icon pastels (fg만 사용, 셀 배경은 흰색) */
const TONE = {
  blue: { fg: '#2563eb' },
  yellow: { fg: '#d97706' },
  teal: { fg: '#0284c7' },
  orange: { fg: '#ea580c' },
  green: { fg: '#059669' },
  rose: { fg: '#e11d48' },
}

/** 6섹터 — `LoginSectorIconGrid` LOGIN_SECTOR_ORDER 와 동일 */
const SECTOR_TILES = [
  { lucide: 'cpu', tone: 'blue' },
  { lucide: 'zap', tone: 'yellow' },
  { lucide: 'ship', tone: 'teal' },
  { lucide: 'building-2', tone: 'orange' },
  { lucide: 'car', tone: 'green' },
  { lucide: 'shield', tone: 'rose' },
]

/** @param {string} name */
async function loadIconNode(name) {
  const mod = await import(`lucide-react/dist/esm/icons/${name}.mjs`)
  return mod.__iconNode
}

/**
 * @param {Array<[string, Record<string, string>]>} node
 * @param {string} fg
 */
function renderLucideNode(node, fg) {
  const stroke = `stroke="${fg}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`
  return node
    .map(([tag, attrs]) => {
      const { key: _k, ...rest } = attrs
      const parts = Object.entries(rest)
        .map(([k, v]) => `${k}="${String(v).replace(/"/g, '&quot;')}"`)
        .join(' ')
      if (tag === 'path') return `<path ${parts} fill="none" ${stroke}/>`
      if (tag === 'rect') return `<rect ${parts} fill="none" ${stroke}/>`
      if (tag === 'circle') return `<circle ${parts} fill="none" ${stroke}/>`
      if (tag === 'line') return `<line ${parts} fill="none" ${stroke}/>`
      if (tag === 'polyline') return `<polyline ${parts} fill="none" ${stroke}/>`
      if (tag === 'polygon') return `<polygon ${parts} fill="none" ${stroke}/>`
      return ''
    })
    .join('\n')
}

/**
 * @param {number} x
 * @param {number} y
 * @param {number} cellW
 * @param {number} cellH
 * @param {string} fg
 * @param {Array<[string, Record<string, string>]>} iconNode
 */
function sectorCell(x, y, cellW, cellH, fg, iconNode) {
  const iconBox = Math.min(cellW, cellH) * 0.82
  const scale = iconBox / 24
  const tx = x + cellW / 2 - 12 * scale
  const ty = y + cellH / 2 - 12 * scale
  return `
  <g transform="translate(${tx}, ${ty}) scale(${scale})">
    ${renderLucideNode(iconNode, fg)}
  </g>`
}

/**
 * @param {number} size
 * @param {boolean} maskable
 * @param {Array<Array<[string, Record<string, string>]>>} iconNodes
 */
function buildSvg(size, maskable, iconNodes) {
  const pad = maskable ? Math.round(size * 0.1) : 0
  const inner = size - pad * 2
  const outerR = maskable ? Math.round(inner * 0.12) : Math.round(inner * 0.18)

  const cols = 3
  const rows = 2
  const gap = inner * 0.032
  const gridPad = inner * 0.06
  const cellW = (inner - gridPad * 2 - gap * (cols - 1)) / cols
  const cellH = (inner - gridPad * 2 - gap * (rows - 1)) / rows
  const gridW = cols * cellW + gap * (cols - 1)
  const gridH = rows * cellH + gap * (rows - 1)
  const startX = pad + (inner - gridW) / 2
  const startY = pad + (inner - gridH) / 2

  let cells = ''
  for (let i = 0; i < SECTOR_TILES.length; i++) {
    const col = i % cols
    const row = Math.floor(i / cols)
    const x = startX + col * (cellW + gap)
    const y = startY + row * (cellH + gap)
    const { tone } = SECTOR_TILES[i]
    const fg = TONE[tone]?.fg ?? TONE.blue.fg
    cells += sectorCell(x, y, cellW, cellH, fg, iconNodes[i])
  }

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect x="${pad}" y="${pad}" width="${inner}" height="${inner}" rx="${outerR}" fill="${BG}"/>
  ${cells}
</svg>`
}

const iconNodes = await Promise.all(SECTOR_TILES.map((t) => loadIconNode(t.lucide)))

/** @type {Array<[string, number, boolean]>} */
const targets = [
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['icon-maskable-512.png', 512, true],
]

for (const [name, size, maskable] of targets) {
  const svg = buildSvg(size, maskable, iconNodes)
  const out = join(publicDir, name)
  await sharp(Buffer.from(svg)).png().toFile(out)
  console.log('wrote', out)
}
