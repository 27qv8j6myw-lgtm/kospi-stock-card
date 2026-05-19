export const PRO_USERS = ['joongsuc@me.com']

export function isProUser(email?: string | null): boolean {
  if (!email) return false
  return PRO_USERS.includes(email.toLowerCase().trim())
}
