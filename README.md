# React + TypeScript + Vite

## Signal15 MCP 커넥터

Claude가 Supabase의 포트폴리오 데이터를 직접 읽을 수 있는 읽기 전용 MCP 엔드포인트다.

- 엔드포인트: `POST https://signal15.vercel.app/api/mcp` (stateless Streamable HTTP)
- 도구: `get_portfolio`(보유·현금·평가손익), `get_snapshots`(일별 자산 추이), `get_trades`(최근 매매), `get_quote`(종목 현재가 — 코드·종목명 모두 가능), `get_watchlist`(관심종목 + 시세)
- 구현: [api/mcp.mjs](api/mcp.mjs) 인증·트랜스포트, [server/mcp/mcpServer.mjs](server/mcp/mcpServer.mjs) 도구 정의, [server/mcp/portfolioData.mjs](server/mcp/portfolioData.mjs) 포트폴리오 집계, [server/mcp/quoteData.mjs](server/mcp/quoteData.mjs) 시세·관심종목

### 필요한 Vercel 환경변수

| 이름 | 설명 |
| --- | --- |
| `MCP_TOKEN` | 데스크톱·Claude Code 용 고정 토큰 (`openssl rand -hex 32`) |
| `MCP_USER_ID` | 조회 대상 Supabase user id. 요청으로는 바꿀 수 없다 |
| `MCP_OAUTH_SECRET` | (선택) 액세스 토큰 서명 키. 없으면 `MCP_TOKEN` 을 쓴다 |
| `MCP_PUBLIC_ORIGIN` | (선택) 외부 origin 고정값. 없으면 요청 헤더에서 유추한다 |

인증은 두 경로를 받는다. 둘 다 `Authorization: Bearer` 헤더만 쓰며, MCP 인증 스펙이 토큰을 URL 쿼리에 넣는 것을 금지하므로 쿼리 파라미터는 지원하지 않는다.

- **고정 토큰** — 데스크톱·Claude Code. `MCP_TOKEN` 을 그대로 헤더에 넣는다.
- **OAuth 2.1** — claude.ai 웹·모바일. 아래 커스텀 커넥터 항목 참고.

### Claude Code 연결

```bash
claude mcp add --transport http signal15 https://signal15.vercel.app/api/mcp \
  --header "Authorization: Bearer $MCP_TOKEN"
```

### Claude 데스크톱 연결

`claude_desktop_config.json`은 stdio만 이해하므로 `mcp-remote` 브리지를 쓴다. 인자 안의 공백이 깨지는 알려진 버그가 있어 토큰은 `env`로 빼고 콜론 뒤 공백을 없앤다.

```json
{
  "mcpServers": {
    "signal15": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://signal15.vercel.app/api/mcp",
        "--header",
        "Authorization:${AUTH_HEADER}"
      ],
      "env": { "AUTH_HEADER": "Bearer 발급받은토큰" }
    }
  }
}
```

### claude.ai 웹·모바일 연결 (OAuth)

claude.ai 커스텀 커넥터는 정적 헤더 입력란이 없고 OAuth 만 받는다. 그래서 같은 프로젝트에 최소 인증 서버를 올려뒀다.

- 디스커버리: `/.well-known/oauth-protected-resource` (RFC 9728), `/.well-known/oauth-authorization-server` (RFC 8414)
- 엔드포인트: [api/oauth/register.mjs](api/oauth/register.mjs) 동적 등록(RFC 7591), [api/oauth/authorize.mjs](api/oauth/authorize.mjs) 로그인·동의, [api/oauth/token.mjs](api/oauth/token.mjs) 토큰 발급·갱신
- 그랜트는 authorization_code + PKCE(S256) 와 refresh_token 만 지원한다. 리프레시 토큰은 사용 시마다 회전한다.
- 승인 화면에서 **Signal15 계정으로 로그인**해야 통과한다. 로그인한 계정의 id 가 `MCP_USER_ID` 와 다르면 거부하므로, 다른 사람이 URL 을 알아도 커넥터를 붙일 수 없다.

준비 작업은 두 개다.

1. Supabase SQL Editor 에서 [scripts/supabase-mcp-oauth.sql](scripts/supabase-mcp-oauth.sql) 실행 (클라이언트·인가코드·리프레시 토큰 테이블)
2. claude.ai → 설정 → 커넥터 → 커스텀 커넥터 추가 → URL 에 `https://signal15.vercel.app/api/mcp` 입력. 클라이언트 ID·시크릿은 비워둔다 (동적 등록으로 처리된다)

연결을 누르면 승인 창이 뜨고, 로그인하면 세 도구가 붙는다. 토큰 수명은 액세스 1시간, 리프레시 30일이다.

---

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
