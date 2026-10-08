/**
 * KIS 실행 환경(prod/vps)·인증정보를 Vercel 의 다른 함수들도 웹앱과 같은 값으로 읽게 한다.
 *
 * 웹앱(`server/index.mjs`)은 프로젝트 루트 `.env` 를 override 로 읽지만 `api/mcp.mjs` 같은 별도
 * 함수는 읽지 않는다. 그래서 같은 배포 안에서 웹앱은 실전(prod), MCP 는 모의(vps)로 갈라질 수
 * 있었다. 함수 진입점에서 `loadProjectEnv()` 를 한 번 부르면 `.env` 의 KIS 값이 우선한다.
 * `.env` 가 번들에 없으면 아무것도 바꾸지 않는다 (Vercel 대시보드 환경변수 그대로).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
/** `server/lib/` 의 두 단계 위 = 프로젝트 루트 (실행 cwd 와 무관) */
const PROJECT_ROOT = path.resolve(__dirname, '..', '..')
const ENV_PATH = path.join(PROJECT_ROOT, '.env')
const KIS_KEYS = ['KIS_APP_KEY', 'KIS_APP_SECRET', 'KIS_ENV']

const clean = (v) => String(v ?? '').trim().replace(/^(["'])(.*)\1$/, '$2').trim()

/** @type {{ loaded: boolean, exists: boolean, appliedKeys: string[], error: string | null }} */
let state = { loaded: false, exists: false, appliedKeys: [], error: null }

/**
 * 프로젝트 루트 `.env` 의 KIS 값(KIS_APP_KEY·KIS_APP_SECRET·KIS_ENV)을 process.env 에 덮어쓴다.
 * 키와 시크릿이 둘 다 있을 때만 세트로 덮는다 — 환경만 바뀌고 키가 그대로면 도메인과 키가 어긋난다.
 * 다른 변수(PORT 등)는 건드리지 않는다.
 * @param {{ envPath?: string, force?: boolean }} [opts]
 */
export function loadProjectEnv({ envPath = ENV_PATH, force = false } = {}) {
  if (state.loaded && !force) return state
  const next = { loaded: true, exists: false, appliedKeys: [], error: null }
  try {
    if (fs.existsSync(envPath)) {
      next.exists = true
      const parsed = dotenv.parse(fs.readFileSync(envPath))
      if (clean(parsed.KIS_APP_KEY) && clean(parsed.KIS_APP_SECRET)) {
        for (const key of KIS_KEYS) {
          if (!clean(parsed[key])) continue
          process.env[key] = parsed[key]
          next.appliedKeys.push(key)
        }
      }
    }
  } catch (e) {
    next.error = e instanceof Error ? e.message : String(e)
  }
  state = next
  return state
}

/** 앱 전체가 쓰는 판정과 같다: 값이 정확히 `prod` 일 때만 실전 */
export function resolveKisEnv() {
  return process.env.KIS_ENV === 'prod' ? 'prod' : 'vps'
}

/**
 * 비밀값 없이 연결 상태만 돌려준다 (`get_server_status` 용).
 * `kisEnvValue` 는 값이 prod/vps 가 아닐 때 원인을 구분하려고 종류만 알려준다.
 */
export function kisEnvStatus() {
  const raw = process.env.KIS_ENV
  const text = raw == null ? '' : String(raw)
  const kisEnvValue = text === '' ? 'empty' : text === 'prod' || text === 'vps' ? 'exact'
    : ['prod', 'vps'].includes(clean(text).toLowerCase()) ? 'needs-trim' : 'other'
  return {
    kisEnv: resolveKisEnv(),
    kisEnvValue,
    credentialsConfigured: Boolean(clean(process.env.KIS_APP_KEY) && clean(process.env.KIS_APP_SECRET)),
    envFile: { loaded: state.loaded, exists: state.exists, appliedKeys: [...state.appliedKeys], error: state.error },
  }
}
