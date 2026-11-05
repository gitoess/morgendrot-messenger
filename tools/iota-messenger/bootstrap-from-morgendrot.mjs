/**
 * Re-Sync aus Morgendrot-Repo in dieses Projekt (überschreibt src/frontend/packages).
 * Aufruf aus iota-messenger-Root:
 *   node scripts/bootstrap-from-morgendrot.mjs "C:\Users\damast\Desktop\morgendrot"
 */
import { spawnSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const upstream = process.argv[2]
if (!upstream) {
  console.error('Usage: node scripts/bootstrap-from-morgendrot.mjs <path-to-morgendrot-repo>')
  process.exit(1)
}

const dest = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const bootstrap = path.join(upstream, 'tools', 'iota-messenger', 'bootstrap-desktop.mjs')
const r = spawnSync(process.execPath, [bootstrap, dest], { stdio: 'inherit' })
process.exit(r.status ?? 1)
