import * as esbuild from 'esbuild'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

await esbuild.build({
  entryPoints: [path.join(root, 'src/lib/indicators/bundleEntry.ts')],
  outfile: path.join(root, 'server/indicators/logicBundle.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  logLevel: 'info',
})
