#!/usr/bin/env node
/**
 * Supabase `screening_cache` 전체 삭제.
 * 사용: 프로젝트 루트 `.env` 에 NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 설정 후
 *   node server/scripts/clearScreeningCache.mjs
 */
import dotenv from 'dotenv'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { clearAllScreeningCache } from '../lib/screeningCache.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '../..')

for (const f of ['.env', '.env.local', '.env.vercel.local']) {
  const p = path.join(root, f)
  if (fs.existsSync(p)) dotenv.config({ path: p, override: true })
}

const result = await clearAllScreeningCache()
if (!result.ok) {
  console.error('[clearScreeningCache]', result.error)
  console.error(
    '\nSupabase SQL Editor 에서 실행:\n  delete from screening_cache;\n',
  )
  process.exit(1)
}

console.log(`[clearScreeningCache] 완료 — ${result.deleted}건 삭제`)
