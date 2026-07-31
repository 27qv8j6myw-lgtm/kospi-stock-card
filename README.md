# React + TypeScript + Vite

## Signal15 MCP 커넥터

Claude가 Supabase의 포트폴리오 데이터를 직접 읽을 수 있는 읽기 전용 MCP 엔드포인트다.

- 엔드포인트: `POST https://signal15.vercel.app/api/mcp` (stateless Streamable HTTP)
- 도구: `get_portfolio`(보유·현금·평가손익), `get_snapshots`(일별 자산 추이), `get_trades`(최근 매매)
- 구현: [api/mcp.mjs](api/mcp.mjs) 인증·트랜스포트, [server/mcp/mcpServer.mjs](server/mcp/mcpServer.mjs) 도구 정의, [server/mcp/portfolioData.mjs](server/mcp/portfolioData.mjs) 조회·집계

### 필요한 Vercel 환경변수

| 이름 | 설명 |
| --- | --- |
| `MCP_TOKEN` | 커넥터 인증 토큰 (`openssl rand -hex 32`) |
| `MCP_USER_ID` | 조회 대상 Supabase user id. 요청으로는 바꿀 수 없다 |

인증은 `Authorization: Bearer <MCP_TOKEN>` 헤더만 받는다. MCP 인증 스펙이 토큰을 URL 쿼리에 넣는 것을 금지하므로 쿼리 파라미터는 지원하지 않는다.

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

claude.ai 웹·모바일 커넥터는 OAuth만 정식 지원하므로(고정 헤더는 베타) 현재는 데스크톱·Claude Code에서만 연결된다.

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
