import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { loadProjectEnv, resolveKisEnv, kisEnvStatus } from './kisEnv.mjs'

let dir
const write = (text) => { const p = path.join(dir, '.env'); fs.writeFileSync(p, text); return p }
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kisenv-'))
  process.env.KIS_APP_KEY = 'dash-key'; process.env.KIS_APP_SECRET = 'dash-secret'; process.env.KIS_ENV = 'vps'; delete process.env.PORT
})
afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }) })

describe('KIS env loader', () => {
  it('switches key, secret and env together when the bundled .env has real credentials', () => {
    const out = loadProjectEnv({ envPath: write('KIS_APP_KEY=file-key\nKIS_APP_SECRET="file-secret"\nKIS_ENV=prod\nPORT=8787\n'), force: true })
    expect(out).toMatchObject({ loaded: true, exists: true, appliedKeys: ['KIS_APP_KEY', 'KIS_APP_SECRET', 'KIS_ENV'], error: null })
    expect([process.env.KIS_APP_KEY, process.env.KIS_APP_SECRET, process.env.KIS_ENV]).toEqual(['file-key', 'file-secret', 'prod'])
    expect(process.env.PORT).toBeUndefined()
    expect(resolveKisEnv()).toBe('prod')
  })
  it('changes nothing when the file is missing or has no credentials', () => {
    expect(loadProjectEnv({ envPath: path.join(dir, 'nope.env'), force: true })).toMatchObject({ exists: false, appliedKeys: [] })
    expect(loadProjectEnv({ envPath: write('KIS_ENV=prod\nKIS_APP_KEY=\n'), force: true })).toMatchObject({ exists: true, appliedKeys: [] })
    expect([process.env.KIS_APP_KEY, process.env.KIS_ENV]).toEqual(['dash-key', 'vps'])
    expect(resolveKisEnv()).toBe('vps')
  })
  it('keeps the dashboard env when the file gives credentials but no KIS_ENV, and loads only once unless forced', () => {
    const p = write('KIS_APP_KEY=file-key\nKIS_APP_SECRET=file-secret\n')
    expect(loadProjectEnv({ envPath: p, force: true }).appliedKeys).toEqual(['KIS_APP_KEY', 'KIS_APP_SECRET'])
    expect(process.env.KIS_ENV).toBe('vps')
    process.env.KIS_APP_KEY = 'changed-later'
    loadProjectEnv({ envPath: p })
    expect(process.env.KIS_APP_KEY).toBe('changed-later')
  })
  it('reports status without leaking secret values', () => {
    loadProjectEnv({ envPath: write('KIS_APP_KEY=file-key\nKIS_APP_SECRET=file-secret\nKIS_ENV=prod\n'), force: true })
    const status = kisEnvStatus()
    expect(status).toEqual({ kisEnv: 'prod', kisEnvValue: 'exact', credentialsConfigured: true,
      envFile: { loaded: true, exists: true, appliedKeys: ['KIS_APP_KEY', 'KIS_APP_SECRET', 'KIS_ENV'], error: null } })
    expect(JSON.stringify(status)).not.toMatch(/file-key|file-secret/)
    process.env.KIS_ENV = ' prod\n'; expect(kisEnvStatus()).toMatchObject({ kisEnv: 'vps', kisEnvValue: 'needs-trim' })
    process.env.KIS_ENV = 'real'; expect(kisEnvStatus().kisEnvValue).toBe('other')
    delete process.env.KIS_ENV; expect(kisEnvStatus()).toMatchObject({ kisEnv: 'vps', kisEnvValue: 'empty' })
  })
})
