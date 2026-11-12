/**
 * Joint Zeitkapsel smoke (W1/W2 lease ops).
 *
 * Env (preferred: *_MNEMONIC_FILE — never logged):
 *   MORG_W1_MNEMONIC_FILE / MORG_W1_MNEMONIC  — lender 0x671b…
 *   MORG_W2_MNEMONIC_FILE / MORG_W2_MNEMONIC  — borrower (default 0x0bbc…)
 *   MORG_BORROWER                             — optional borrower address override
 *   MORG_LEASE_ID / MORG_LEASE_PACKAGE / MORG_NFT_ID / MORG_DURATION_MS / MORG_RPC_URL
 *
 * Commands:
 *   status
 *   return_early     (W2)
 *   cancel_reclaim   (W2)
 *   reclaim          (anyone after unlock; uses W1 mnemonic if set else W2)
 *   create_lease     (W1) — short lease; needs MORG_NFT_ID (free NFT)
 */
import { readFileSync } from 'node:fs'
import { getFullnodeUrl, IotaClient } from '@iota/iota-sdk/client'
import { Ed25519Keypair } from '@iota/iota-sdk/keypairs/ed25519'
import { Transaction } from '@iota/iota-sdk/transactions'

const W1 = '0x671bf669a858c97a1ca7ed3c5c31901ffb671ceea31e8fd706d0b6e2cb8a15c5'
const W2_DEFAULT = '0x0bbc01633b9e794cae495213d0f4aef584f579086cbb8b982557735c85407796'
/** Borrower for create/return_early/cancel — override for ephemeral Abort-4 smoke. */
const W2 = (process.env.MORG_BORROWER || W2_DEFAULT).trim().toLowerCase()
const DEFAULT_LEASE =
  '0xa802b0c0b8c2192bdfc25e57637e2993f5a3f78dfa88f2ce781c761406a7df62'
const DEFAULT_PKG =
  '0x42b10c99f81ecaa885d4a8f05eb933fe9862ca1bdececb2d5b97c628e31de623'
const CLOCK = '0x6'
const DEFAULT_FREE_NFT =
  '0x5ab1b1627e2702a57dc61be00edec884da689241520113533644ca4d5c8a6d97'

const cmd = (process.argv[2] || 'status').trim()
const rpc = process.env.MORG_RPC_URL || process.env.RPC_URL || getFullnodeUrl('testnet')
const leaseId = (process.env.MORG_LEASE_ID || DEFAULT_LEASE).trim().toLowerCase()
const pkg = (process.env.MORG_LEASE_PACKAGE || DEFAULT_PKG).trim().toLowerCase()
const nftId = (process.env.MORG_NFT_ID || DEFAULT_FREE_NFT).trim().toLowerCase()
const durationMs = Math.max(5_000, Number(process.env.MORG_DURATION_MS || 75_000))

function loadMnemonic(which) {
  const fileKey = which === 'w1' ? 'MORG_W1_MNEMONIC_FILE' : 'MORG_W2_MNEMONIC_FILE'
  const memKey = which === 'w1' ? 'MORG_W1_MNEMONIC' : 'MORG_W2_MNEMONIC'
  const defaultFile =
    which === 'w1' ? 'exports/.w1-mnemonic.local' : 'exports/.w2-mnemonic.local'
  const file = process.env[fileKey]?.trim() || defaultFile
  try {
    return readFileSync(file, 'utf8').trim().replace(/\s+/g, ' ')
  } catch {
    /* fall through */
  }
  const m = process.env[memKey]?.trim()
  if (m) return m.replace(/\s+/g, ' ')
  return null
}

function short(id) {
  const t = String(id || '')
  return t.length < 16 ? t : `${t.slice(0, 10)}…${t.slice(-4)}`
}

function keypairFromMnemonic(mnemonic) {
  return Ed25519Keypair.deriveKeypair(mnemonic)
}

async function getLease(client, id = leaseId) {
  const r = await client.getObject({
    id,
    options: { showType: true, showOwner: true, showContent: true },
  })
  const data = r.data
  if (!data) return null
  const fields = data.content?.fields || {}
  return {
    objectId: id,
    type: data.type,
    owner: data.owner,
    borrower: String(fields.borrower || '').toLowerCase(),
    lender: String(fields.lender || '').toLowerCase(),
    nftId: String(fields.nft_id || '').toLowerCase(),
    unlockMs: Number(fields.unlock_ms || 0),
    reclaimCancelled: Boolean(fields.reclaim_cancelled),
  }
}

async function resolveImageNftType(client, id) {
  const forced = process.env.MORG_IMAGE_NFT_PACKAGE?.trim()
  if (forced) return `${forced.toLowerCase()}::image_nft::ImageNFT`
  const r = await client.getObject({ id, options: { showType: true } })
  const t = r.data?.type || ''
  if (!t.includes('::image_nft::ImageNFT')) {
    throw new Error(`Unerwarteter NFT-Typ: ${t || '(leer)'}`)
  }
  return t
}

async function status(client) {
  const lease = await getLease(client)
  if (!lease) {
    console.log(`STATUS  lease ${short(leaseId)} — nicht gefunden (bereits returned?)`)
    return 0
  }
  const now = Date.now()
  console.log(`STATUS  lease ${short(leaseId)}`)
  console.log(`  type     ${lease.type}`)
  console.log(`  lender   ${short(lease.lender)}`)
  console.log(`  borrower ${short(lease.borrower)}`)
  console.log(`  nft      ${short(lease.nftId)}`)
  console.log(
    `  unlock   ${new Date(lease.unlockMs).toISOString()} (in ${Math.max(0, lease.unlockMs - now)} ms)`
  )
  console.log(`  cancelled ${lease.reclaimCancelled}`)
  if (lease.nftId) {
    const nft = await client.getObject({
      id: lease.nftId,
      options: { showOwner: true, showType: true },
    })
    console.log(`  nftOwner ${JSON.stringify(nft.data?.owner)}`)
  }
  return 0
}

async function execMove(client, keypair, sender, build) {
  const txb = new Transaction()
  txb.setSender(sender)
  build(txb)
  const res = await client.signAndExecuteTransaction({
    signer: keypair,
    transaction: txb,
    options: { showEffects: true, showObjectChanges: true, showEvents: true },
  })
  const status = res.effects?.status?.status
  const digest = res.digest
  if (status !== 'success') {
    const err = res.effects?.status?.error || 'unknown'
    console.error(`FAIL  digest=${digest || '-'} status=${status} err=${err}`)
    return { ok: false, digest, error: err }
  }
  console.log(`PASS  digest=${digest}`)
  const created = []
  for (const c of res.objectChanges || []) {
    if (c.type === 'created' && String(c.objectType || '').includes('NftTimeLease')) {
      created.push(String(c.objectId).toLowerCase())
    }
  }
  if (created[0]) console.log(`PASS  leaseCreated=${created[0]}`)
  return { ok: true, digest, leaseObjectId: created[0] }
}

async function requireSigner(which, expectedAddr) {
  const mnemonic = loadMnemonic(which)
  if (!mnemonic) {
    console.error(
      `FAIL  Set MORG_${which.toUpperCase()}_MNEMONIC_FILE (preferred) or MORG_${which.toUpperCase()}_MNEMONIC`
    )
    return null
  }
  const keypair = keypairFromMnemonic(mnemonic)
  const addr = keypair.getPublicKey().toIotaAddress().toLowerCase()
  if (addr !== expectedAddr) {
    console.error(`FAIL  ${which} address ${addr} != expected ${expectedAddr}`)
    return null
  }
  console.log(`OK    ${which} signer ${short(addr)}`)
  return keypair
}

async function main() {
  const client = new IotaClient({ url: rpc })
  if (cmd === 'status') return status(client)

  if (cmd === 'create_lease') {
    const keypair = await requireSigner('w1', W1)
    if (!keypair) return 2
    const nftType = await resolveImageNftType(client, nftId)
    const out = await execMove(client, keypair, W1, (txb) => {
      txb.moveCall({
        target: `${pkg}::nft_time_lease::create_lease`,
        typeArguments: [nftType],
        arguments: [
          txb.object(nftId),
          txb.pure.address(W2),
          txb.pure.u64(BigInt(durationMs)),
          txb.object(CLOCK),
        ],
      })
    })
    return out.ok ? 0 : 1
  }

  if (cmd === 'return_early' || cmd === 'cancel_reclaim') {
    const keypair = await requireSigner('w2', W2)
    if (!keypair) return 2
    const lease = await getLease(client)
    if (!lease) {
      console.error('FAIL  Lease fehlt on-chain')
      return 1
    }
    if (cmd === 'cancel_reclaim') {
      const out = await execMove(client, keypair, W2, (txb) => {
        txb.moveCall({
          target: `${pkg}::nft_time_lease::cancel_reclaim`,
          arguments: [txb.object(lease.objectId)],
        })
      })
      return out.ok ? 0 : 1
    }
    const nftType = await resolveImageNftType(client, lease.nftId)
    const out = await execMove(client, keypair, W2, (txb) => {
      txb.moveCall({
        target: `${pkg}::nft_time_lease::return_early`,
        typeArguments: [nftType],
        arguments: [txb.object(lease.objectId)],
      })
    })
    return out.ok ? 0 : 1
  }

  if (cmd === 'reclaim') {
    const lease = await getLease(client)
    if (!lease) {
      console.error('FAIL  Lease fehlt on-chain')
      return 1
    }
    let keypair = await requireSigner('w1', W1)
    let sender = W1
    if (!keypair) {
      keypair = await requireSigner('w2', W2)
      sender = W2
    }
    if (!keypair) return 2
    const nftType = await resolveImageNftType(client, lease.nftId)
    const out = await execMove(client, keypair, sender, (txb) => {
      txb.moveCall({
        target: `${pkg}::nft_time_lease::reclaim`,
        typeArguments: [nftType],
        arguments: [txb.object(lease.objectId), txb.object(CLOCK)],
      })
    })
    return out.ok ? 0 : 1
  }

  console.error(`FAIL  unknown cmd ${cmd}`)
  return 2
}

process.exit(await main())
