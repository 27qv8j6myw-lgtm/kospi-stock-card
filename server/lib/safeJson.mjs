/**
 * LLM 응답용 JSON 안전 파싱 (후행 설명·펜스 제거·균형 슬라이스).
 * @param {string} s
 * @param {string} open
 * @param {string} close
 * @returns {string|null}
 */
function extractBalanced(s, open, close) {
  const start = s.indexOf(open)
  if (start === -1) return null
  let depth = 0
  let inStr = false
  let esc = false
  for (let i = start; i < s.length; i++) {
    const c = s[i]
    if (esc) {
      esc = false
      continue
    }
    if (inStr) {
      if (c === '\\') {
        esc = true
        continue
      }
      if (c === '"') inStr = false
      continue
    }
    if (c === '"') {
      inStr = true
      continue
    }
    if (c === open) depth += 1
    else if (c === close) {
      depth -= 1
      if (depth === 0) return s.slice(start, i + 1)
    }
  }
  return null
}

/**
 * ```json ... ``` / ``` ... ``` 제거
 * @param {string} raw
 * @returns {string}
 */
function stripMarkdownFences(raw) {
  let t = String(raw ?? '').trim()
  t = t.replace(/^```(?:json)?\s*/i, '')
  t = t.replace(/\s*```\s*$/i, '')
  return t.trim()
}

/**
 * @param {string} s
 * @returns {unknown|null}
 */
function tryParse(s) {
  try {
    return JSON.parse(s)
  } catch {
    return null
  }
}

/**
 * @param {string} raw
 * @param {{ context?: string }} [opts]
 * @returns {unknown|null}
 */
export function safeJsonParse(raw, opts = {}) {
  const ctx = opts.context || 'safeJson'
  const input = typeof raw === 'string' ? raw : String(raw ?? '')

  if (!input.trim()) {
    console.error(`[${ctx}] safeJsonParse: empty input`)
    return null
  }

  let v = tryParse(input.trim())
  if (v != null) return v

  const fenced = stripMarkdownFences(input)
  v = tryParse(fenced)
  if (v != null) return v

  const work = fenced
  const firstObj = work.indexOf('{')
  const firstArr = work.indexOf('[')

  let balanced = null
  if (firstArr !== -1 && (firstObj === -1 || firstArr < firstObj)) {
    balanced = extractBalanced(work, '[', ']')
  } else if (firstObj !== -1) {
    balanced = extractBalanced(work, '{', '}')
  }

  if (balanced) {
    v = tryParse(balanced)
    if (v != null) {
      console.warn(`[${ctx}] safeJsonParse: attempt 3 (balanced) ok len=${balanced.length}`)
      return v
    }
  }

  if (firstObj !== -1) {
    const lo = firstObj
    const hi = work.lastIndexOf('}')
    if (hi > lo) {
      const slice = work.slice(lo, hi + 1)
      v = tryParse(slice)
      if (v != null) {
        console.warn(`[${ctx}] safeJsonParse: attempt 4 (slice object) ok len=${slice.length}`)
        return v
      }
    }
  }
  if (firstArr !== -1) {
    const lo = firstArr
    const hi = work.lastIndexOf(']')
    if (hi > lo) {
      const slice = work.slice(lo, hi + 1)
      v = tryParse(slice)
      if (v != null) {
        console.warn(`[${ctx}] safeJsonParse: attempt 4 (slice array) ok len=${slice.length}`)
        return v
      }
    }
  }

  console.error(
    `[${ctx}] safeJsonParse: all attempts failed, tail=`,
    input.slice(-200).replace(/\n/g, '\\n'),
  )
  return null
}
