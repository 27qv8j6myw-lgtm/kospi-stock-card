import serverless from 'serverless-http'
import app from '../server/index.mjs'

const handler = serverless(app)

export default async function vercelHandler(req, res) {
  return handler(req, res)
}
