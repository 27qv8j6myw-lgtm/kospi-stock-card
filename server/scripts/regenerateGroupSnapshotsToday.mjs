/**
 * 오늘(서울) pro_group_snapshots 삭제 후 재생성
 *
 * 실행: node server/scripts/regenerateGroupSnapshotsToday.mjs
 * 날짜 지정: node server/scripts/regenerateGroupSnapshotsToday.mjs 2026-05-29
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { getSupabaseService } from '../lib/supabaseService.mjs'
import { runProGroupSnapshots, seoulSnapshotDateKey } from '../lib/snapshotProGroups.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.resolve(__dirname, '..', '..')

dotenv.config({ path: path.join(PROJECT_ROOT, '.env'), override: false, quiet: true })
dotenv.config({ path: path.join(PROJECT_ROOT, '.env.local'), override: false, quiet: true })
const envFile = process.env.ENV_FILE?.trim()
if (envFile) {
  dotenv.config({ path: envFile, override: true, quiet: true })
}

const snapshotDate = process.argv[2]?.trim() || seoulSnapshotDateKey()

const supabase = getSupabaseService()
if (!supabase) {
  console.error('Supabase 미설정 (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)')
  process.exit(1)
}

const { count: deletedCount, error: delErr } = await supabase
  .from('pro_group_snapshots')
  .delete({ count: 'exact' })
  .eq('snapshot_date', snapshotDate)

if (delErr) {
  console.error('삭제 실패:', delErr.message)
  process.exit(1)
}

console.log(`삭제: snapshot_date=${snapshotDate}, rows=${deletedCount ?? 0}`)

const payload = await runProGroupSnapshots(supabase, { snapshotDate })
console.log('재생성 완료:', JSON.stringify(payload, null, 2))
