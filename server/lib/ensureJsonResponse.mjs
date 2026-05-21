/**
 * Vercel 단독 Serverless 핸들러용 res.status().json() 폴리필 (Express 는 그대로 사용)
 * @param {import('http').ServerResponse} res
 */
export function ensureJsonResponse(res) {
  if (typeof res.json === 'function') return res

  res.status = function status(code) {
    res.statusCode = code
    return {
      json: (data) => {
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(JSON.stringify(data))
      },
    }
  }

  res.json = function json(data) {
    if (!res.statusCode) res.statusCode = 200
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify(data))
  }

  return res
}
