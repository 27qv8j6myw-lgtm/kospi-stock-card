/** Pro 검색창 — iOS/Safari 자동완성·비밀번호 관리자 차단 */
export const proSearchInputProps = {
  type: 'search' as const,
  name: 'stock-search-query',
  autoComplete: 'off',
  autoCorrect: 'off',
  autoCapitalize: 'off',
  spellCheck: false,
  inputMode: 'text' as const,
  'data-lpignore': 'true',
  'data-1p-ignore': 'true',
  'aria-autocomplete': 'none' as const,
}
