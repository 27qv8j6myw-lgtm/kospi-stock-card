import type { Config } from 'tailwindcss'

/**
 * Tailwind v4 — 색·그림자·보더 등은 `src/styles/tokens.css` (:root) + `src/index.css` (@theme).
 * 이 파일은 스캔 경로·IDE 연동용이며, 색·간격·폰트 값은 CSS 변수를 단일 출처로 둔다.
 */
export default {
  content: ['./index.html', './app/**/*.{js,ts,jsx,tsx}', './src/**/*.{js,ts,jsx,tsx}'],
} satisfies Config
