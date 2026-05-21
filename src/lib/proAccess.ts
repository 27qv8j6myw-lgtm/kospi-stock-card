/** @deprecated `useIsProUser` 훅 사용 — `user_settings.pro_enabled` 기준 */
export const PRO_USERS = ['joongsuc@me.com']

/** @deprecated `useIsProUser(user)` 사용 */
export function isProUser(_email?: string | null): boolean {
  return false
}
