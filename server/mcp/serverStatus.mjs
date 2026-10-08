/**
 * MCP 서버 연결 상태 — KIS 실전/모의, 배포 버전, 등록된 도구.
 * "실전 전용 도구가 모의 서버 오류를 낸다", "새 도구가 안 보인다" 를 추측 없이 가르기 위한 조회다.
 * 비밀값은 넣지 않는다.
 */
import { kisEnvStatus } from '../lib/kisEnv.mjs'

/** @param {string[]} [toolNames] 이 서버에 등록된 도구 이름 */
export function getServerStatus(toolNames = []) {
  const kis = kisEnvStatus()
  const sha = String(process.env.VERCEL_GIT_COMMIT_SHA ?? '').trim()
  const prodOnlyToolsAvailable = kis.kisEnv === 'prod' && kis.credentialsConfigured
  return {
    retrievedAt: new Date().toISOString(),
    timezone: 'Asia/Seoul',
    kis: { ...kis, prodOnlyToolsAvailable },
    deployment: {
      vercelEnv: process.env.VERCEL_ENV || null,
      host: process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || null,
      commit: sha ? sha.slice(0, 7) : null,
      branch: process.env.VERCEL_GIT_COMMIT_REF || null,
      region: process.env.VERCEL_REGION || null,
    },
    tools: { count: toolNames.length, names: [...toolNames] },
    note: prodOnlyToolsAvailable
      ? 'KIS 실전 서버에 연결돼 있습니다.'
      : 'KIS 모의투자 서버에 연결돼 있어 실전 전용 도구(과거 수급·순위·과거 분봉·휴장일·투자의견 등)는 동작하지 않습니다. 이 함수가 읽는 KIS_ENV 가 정확히 prod 인지, 키가 실전 계정 키인지 확인하세요.',
  }
}
