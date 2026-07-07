/**
 * GlobalsCreated für ein Package auf einer IOTA-RPC-URL auflösen.
 * Usage: node scripts/resolve-package-globals.mjs [packageId] [rpcUrl]
 */
import { IotaClient } from '@iota/iota-sdk/client'

const pkg = (process.argv[2] || '').trim().toLowerCase()
const rpc = (process.argv[3] || 'https://api.testnet.iota.cafe').trim()

if (!/^0x[a-f0-9]{64}$/.test(pkg)) {
  console.error('Usage: node scripts/resolve-package-globals.mjs 0x<package64> [rpcUrl]')
  process.exit(1)
}

const client = new IotaClient({ url: rpc })
const eventType = `${pkg}::messaging::GlobalsCreated`

const res = await client.queryEvents({
  query: { MoveEventType: eventType },
  limit: 10,
  order: 'descending',
})

console.log('RPC:', rpc)
console.log('Package:', pkg)
console.log('GlobalsCreated count:', res.data?.length ?? 0)

for (const e of res.data ?? []) {
  const pj = e.parsedJson ?? {}
  console.log(
    JSON.stringify({
      mailbox_id: pj.mailbox_id,
      vault_registry_id: pj.vault_registry_id,
      command_registry_id: pj.command_registry_id,
      by: pj.by,
      txDigest: e.id?.txDigest,
    })
  )
}
