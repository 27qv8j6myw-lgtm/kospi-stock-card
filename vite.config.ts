import fs from 'node:fs'
import path from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import type { Connect } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function spaHtmlPath(url: string | undefined): boolean {
  if (!url) return false
  const u = url.split('?')[0] ?? ''
  if (u === '/design-test' || u.startsWith('/design-test/')) return true
  if (u === '/screening' || u.startsWith('/screening/')) return true
  if (u === '/compare' || u.startsWith('/compare/')) return true
  if (u === '/stocks' || u.startsWith('/stocks/')) return true
  return false
}

/** 클라이언트 라우트 직접 URL에서도 `index.html` 제공 (개발·preview) */
function clientRouteSpaFallback() {
  return {
    name: 'client-route-spa-fallback',
    configureServer(server: { middlewares: Connect.Server }) {
      return () => {
        server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: Connect.NextFunction) => {
          const url = (req.url ?? '').split('?')[0]
          if (req.method === 'GET' && spaHtmlPath(url)) {
            const htmlPath = path.join(__dirname, 'index.html')
            if (fs.existsSync(htmlPath)) {
              const html = fs.readFileSync(htmlPath, 'utf-8')
              res.statusCode = 200
              res.setHeader('Content-Type', 'text/html; charset=utf-8')
              res.end(html)
              return
            }
          }
          next()
        })
      }
    },
    configurePreviewServer(server: { middlewares: Connect.Server }) {
      server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: Connect.NextFunction) => {
        const url = (req.url ?? '').split('?')[0]
        if (req.method === 'GET' && spaHtmlPath(url)) {
          const htmlPath = path.join(__dirname, 'dist', 'index.html')
          if (fs.existsSync(htmlPath)) {
            const html = fs.readFileSync(htmlPath, 'utf-8')
            res.statusCode = 200
            res.setHeader('Content-Type', 'text/html; charset=utf-8')
            res.end(html)
            return
          }
        }
        next()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), clientRouteSpaFallback()],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },
  /** `vite preview`에서도 `/api`가 정적 서버 404로 떨어지지 않도록 dev와 동일 프록시 */
  preview: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },
  build: {
    minify: false,
    sourcemap: true,
  },
})
