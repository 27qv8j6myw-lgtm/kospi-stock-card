# Vercel Deployment Guide (Beginner)

## 1) Prerequisites
- GitHub account
- Vercel account (sign in with GitHub recommended)
- This repository pushed to GitHub

## 2) First Deploy (Web UI)
1. Open [https://vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository (`kospi-stock-card`)
3. Framework should be detected as **Vite**
4. Confirm:
   - Build Command: `npm run build`
   - Output Directory: `dist`
5. Click **Deploy**

## 3) Add Environment Variables
After first deploy, open:
- Project -> **Settings** -> **Environment Variables**

Add these keys:
- `KIS_APP_KEY`
- `KIS_APP_SECRET`
- `KIS_ENV` = `prod`
- `ANTHROPIC_API_KEY` (optional — AI 브리핑·스크리너 요약에 사용)
- `ANTHROPIC_MODEL` (optional, 기본 `claude-opus-4-7`)
- `CORS_ORIGINS` = your production URL(s), comma-separated

Then click **Redeploy**.

## 4) Verify API
After deploy, test:
- `https://<your-domain>/api/health`

Expected:
- JSON with `ok: true`
- `kisConfigured: true` (if KIS keys are set)
- `anthropicConfigured: true` (if `ANTHROPIC_API_KEY` is set)

## 5) If You Prefer CLI
Run in project root:

```bash
npx vercel
```

For production:

```bash
npx vercel --prod
```

Note: first run asks login/project-link questions interactively.

## 6) Common Issues
- `KIS_APP_KEY... not set`: check Vercel env vars and redeploy.
- CORS blocked: set `CORS_ORIGINS` to your Vercel domain.
- API 502 from KIS: temporary rate limit; retry later.
