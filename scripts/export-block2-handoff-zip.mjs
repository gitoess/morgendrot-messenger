/**
 * Block-2-Handoff-ZIP vom laufenden Boss-API exportieren.
 * Usage: node scripts/export-block2-handoff-zip.mjs [outZip]
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const API = (process.env.MORGENDROT_API_URL || 'http://127.0.0.1:3342').replace(/\/$/, '')
const OUT = process.argv[2] || join(ROOT, 'exports', 'block2-handoff-smoke.zip')

const stRes = await fetch(`${API}/api/status`, { signal: AbortSignal.timeout(15_000) })
if (!stRes.ok) throw new Error(`Boss-API /api/status: HTTP ${stRes.status}`)
const st = await stRes.json()
const boss = String(st.myAddressFull || '').trim()
const mailboxId = String(st.mailboxId || '').trim()
if (!/^0x[a-fA-F0-9]{64}$/i.test(boss)) throw new Error('Boss MY_ADDRESS fehlt — Tresor entsperren?')

const body = {
  packageSource: 'boss',
  bossAddress: boss,
  mailboxId,
  rpcUrl: 'https://api.testnet.iota.cafe',
  transportProfile: 'iota-anchored',
  helperRole: 'messenger',
  roleId: 14,
  handoffLabel: 'Block2 Helfer Smoke',
  einsatzChainMode: 'testnet-direct',
}

const zipRes = await fetch(`${API}/api/standalone-smartphone-handoff-zip`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
  signal: AbortSignal.timeout(60_000),
})
if (!zipRes.ok) {
  const text = await zipRes.text()
  throw new Error(`Handoff-ZIP HTTP ${zipRes.status}: ${text.slice(0, 300)}`)
}
const buf = Buffer.from(await zipRes.arrayBuffer())
mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, buf)
console.log('Wrote', OUT, `(${buf.length} bytes)`)
console.log('packageId', st.packageId)
console.log('mailboxId', mailboxId)
console.log('boss', boss.slice(0, 12) + '…')
