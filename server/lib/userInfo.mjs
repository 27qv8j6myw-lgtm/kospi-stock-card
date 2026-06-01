/**
 * Supabase Auth 사용자 → 관리자 UI용 프로필 맵
 * @param {Array<{ id: string, email?: string | null, user_metadata?: Record<string, unknown> | null }>} authUsers
 * @returns {Record<string, { userId: string, name: string, email: string, avatar: string | null }>}
 */
export function buildUserMap(authUsers) {
  /** @type {Record<string, { userId: string, name: string, email: string, avatar: string | null }>} */
  const map = {}
  for (const u of authUsers || []) {
    if (!u.id) continue
    const meta = u.user_metadata && typeof u.user_metadata === 'object' ? u.user_metadata : {}
    const email = String(u.email ?? '').trim()
    const fullName = String(meta.full_name || meta.name || '').trim()
    const avatarRaw = String(meta.avatar_url || meta.picture || meta.avatar || '').trim()
    map[u.id] = {
      userId: u.id,
      name: fullName || email.split('@')[0] || u.id.slice(0, 8),
      email,
      avatar: avatarRaw || null,
    }
  }
  return map
}

/**
 * 관리자 이메일 여부 (프론트 AdminPage.isAdminEmail 과 동일 규칙)
 * @param {string | null | undefined} email
 */
export function isAdminUserEmail(email) {
  const e = String(email ?? '')
    .toLowerCase()
    .trim()
  if (!e) return false
  if (e === 'joongsuc@me.com') return true
  const adminEmails = (process.env.ADMIN_EMAILS || process.env.NEXT_PUBLIC_ADMIN_EMAILS || '')
    .split(',')
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean)
  return adminEmails.includes(e)
}
