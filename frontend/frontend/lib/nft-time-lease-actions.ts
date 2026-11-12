/**
 * B2-P5b — create / cancel / return_early / reclaim signieren + lokalen Index pflegen.
 */

import {
  attachGasPaymentForOwner,
  createDirectIotaClient,
  isDirectChainExecutionSuccess,
  signAndExecuteTransactionWithSigner,
} from '@morgendrot/core/iota'
import { getConfiguredDirectIotaRpcUrl } from '@/frontend/lib/direct-iota-rpc'
import { isIotaRelayOnlyMode } from '@/frontend/lib/direct-iota-plain-submit'
import {
  getDirectIotaSessionSigner,
  getDirectIotaSessionSignerAddress,
} from '@/frontend/lib/direct-iota-mnemonic-session'
import { formatDirectIotaSubmitError } from '@/frontend/lib/direct-iota-error-messages'
import {
  buildCancelNftTimeLeaseReclaimTransaction,
  buildCreateNftTimeLeaseTransaction,
  buildReclaimNftTimeLeaseTransaction,
  buildReturnEarlyNftTimeLeaseTransaction,
} from '@/frontend/lib/nft-time-lease-txb'
import {
  patchNftTimeLeaseLocal,
  upsertNftTimeLeaseLocal,
} from '@/frontend/lib/nft-time-lease-local-store'

export type NftTimeLeaseActionResult =
  | { ok: true; digest: string; leaseObjectId?: string }
  | { ok: false; error: string }

const GAS_BUDGET = 50_000_000n
const HEX64 = /^0x[a-f0-9]{64}$/

async function prepare(): Promise<
  | {
      ok: true
      client: ReturnType<typeof createDirectIotaClient>
      signer: NonNullable<ReturnType<typeof getDirectIotaSessionSigner>>
      sender: string
    }
  | { ok: false; error: string }
> {
  if (isIotaRelayOnlyMode()) {
    return { ok: false, error: 'Braucht Direkt-RPC (nicht „Nur Morgendrot-API“).' }
  }
  const rpc = getConfiguredDirectIotaRpcUrl()
  if (!rpc) return { ok: false, error: 'Keine Direkt-RPC-URL.' }
  const signer = getDirectIotaSessionSigner()
  const sender = getDirectIotaSessionSignerAddress()
  if (!signer || !sender) {
    return { ok: false, error: 'Kein Session-Signer — Vault entsperren.' }
  }
  return { ok: true, client: createDirectIotaClient({ rpcUrl: rpc }), signer, sender }
}

function coerceHex64Id(raw: unknown): string | undefined {
  if (typeof raw === 'string') {
    let t = raw.trim().toLowerCase()
    if (!t.startsWith('0x') && /^[a-f0-9]{64}$/.test(t)) t = `0x${t}`
    return HEX64.test(t) ? t : undefined
  }
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>
    return coerceHex64Id(o.id ?? o.objectId ?? o.bytes ?? o.value)
  }
  return undefined
}

function abortCodeInDetail(d: string, code: number): boolean {
  const c = String(code)
  return (
    d.includes(`abort code: ${c}`) ||
    d.includes(`abort_code: ${c}`) ||
    d.includes(`abort code ${c}`) ||
    d.includes(`, ${c})`) ||
    d.includes(`moveabort(${c}`) ||
    new RegExp(`\\babort(?:ed)?[^0-9]{0,24}${c}\\b`).test(d)
  )
}

/** Lease-Object-ID aus create_lease Effects / objectChanges / Events. */
function pickCreatedLeaseId(
  effects: unknown,
  objectChanges?: unknown,
  events?: unknown
): { leaseObjectId?: string; unlockMs?: number } {
  try {
    const changes = Array.isArray(objectChanges) ? objectChanges : []
    for (const c of changes) {
      const row = c as { type?: string; objectId?: string; objectType?: string }
      if (row.type !== 'created') continue
      const t = (row.objectType || '').toLowerCase()
      if (!t.includes('nft_time_lease')) continue
      const id = coerceHex64Id(row.objectId)
      if (id) return { leaseObjectId: id }
    }
    const e = effects as {
      created?: Array<{ reference?: { objectId?: string }; owner?: unknown }>
    }
    for (const c of e.created || []) {
      const id = coerceHex64Id(c.reference?.objectId)
      if (id) return { leaseObjectId: id }
    }
    const evs = Array.isArray(events) ? events : []
    for (const ev of evs) {
      const row = ev as {
        type?: string
        parsedJson?: { lease_id?: unknown; unlock_ms?: unknown; unlockMs?: unknown }
      }
      if (!row.type?.includes('::nft_time_lease::LeaseCreated')) continue
      const id = coerceHex64Id(row.parsedJson?.lease_id)
      const unlockRaw = row.parsedJson?.unlock_ms ?? row.parsedJson?.unlockMs
      const unlockMs =
        typeof unlockRaw === 'number'
          ? unlockRaw
          : typeof unlockRaw === 'string' && /^\d+$/.test(unlockRaw)
            ? Number(unlockRaw)
            : undefined
      if (id) return { leaseObjectId: id, unlockMs }
    }
  } catch {
    /* ignore */
  }
  return {}
}

function normAddr(a: string): string {
  return a.trim().toLowerCase()
}

function mapLeaseAbortError(op: string, detail: string | undefined): string {
  const d = (detail || '').toLowerCase()
  if (abortCodeInDetail(d, 6) || d.includes('e_bad_borrower')) {
    return (
      'Leihe an die eigene Adresse geht nicht (Abort 6) — Borrower muss eine andere Wallet sein.'
    )
  }
  if (d.includes('e_not_borrower') || abortCodeInDetail(d, 2)) {
    return (
      `${op}: nur der Borrower darf das (Abort 2). Lender: nach Ablauf „Nach Ablauf zurückholen“.`
    )
  }
  if (d.includes('e_too_early') || abortCodeInDetail(d, 3)) {
    return (
      `${op}: noch zu früh (Abort 3) — Chain-Uhr: Unlock abwarten. ` +
      'Feld „Dauer“ ist in Stunden (0,01 Std ≈ 36 s). Borrower kann vorher „Früh zurück“ (nur Borrower-Signer).'
    )
  }
  if (d.includes('e_reclaim_cancelled') || abortCodeInDetail(d, 4)) {
    return `${op}: Timelock widerrufen (Abort 4) — kein permissionless Reclaim mehr; NFT bleibt beim Borrower bis „Früh zurück“.`
  }
  return detail ? `${op} fehlgeschlagen — ${detail}.` : `${op} fehlgeschlagen.`
}

function mapCreateLeaseError(detail: string | undefined): string {
  return mapLeaseAbortError('create_lease', detail)
}

export async function createNftTimeLease(input: {
  messagingPackageId: string
  nftObjectId: string
  borrowerAddress: string
  durationMs: number
  imageNftPackageId?: string
}): Promise<NftTimeLeaseActionResult> {
  const prep = await prepare()
  if (!prep.ok) return prep
  const { client, signer, sender } = prep
  if (normAddr(input.borrowerAddress) === normAddr(sender)) {
    return {
      ok: false,
      error:
        'Leihe an die eigene Adresse geht nicht — bitte eine andere Wallet als Borrower eintragen.',
    }
  }
  if (normAddr(input.borrowerAddress) === '0x' + '0'.repeat(64) || normAddr(input.borrowerAddress) === '0x0') {
    return { ok: false, error: 'Borrower-Adresse ungültig (0x0).' }
  }
  try {
    const txb = buildCreateNftTimeLeaseTransaction({
      messagingPackageId: input.messagingPackageId,
      senderAddress: sender,
      nftObjectId: input.nftObjectId,
      borrowerAddress: input.borrowerAddress,
      durationMs: input.durationMs,
      imageNftPackageId: input.imageNftPackageId,
    })
    await attachGasPaymentForOwner(client, txb, sender, GAS_BUDGET)
    const out = await signAndExecuteTransactionWithSigner({
      client,
      transaction: txb,
      signer,
    })
    if (!isDirectChainExecutionSuccess(out.digest, out.status) || !out.digest) {
      return { ok: false, error: mapCreateLeaseError(out.errorDetail) }
    }
    let leaseObjectId: string | undefined
    let unlockMsFromChain: number | undefined
    try {
      const tx = await client.getTransactionBlock({
        digest: out.digest,
        options: { showEffects: true, showEvents: true, showObjectChanges: true },
      })
      const picked = pickCreatedLeaseId(
        tx.effects,
        (tx as { objectChanges?: unknown }).objectChanges,
        (tx as { events?: unknown }).events
      )
      leaseObjectId = picked.leaseObjectId
      unlockMsFromChain = picked.unlockMs
    } catch {
      /* Lease-ID manuell nachtragen */
    }
    if (leaseObjectId) {
      upsertNftTimeLeaseLocal({
        leaseObjectId,
        nftObjectId: input.nftObjectId,
        lender: sender,
        borrower: input.borrowerAddress,
        unlockMs:
          typeof unlockMsFromChain === 'number' && unlockMsFromChain > 0
            ? unlockMsFromChain
            : Date.now() + Math.max(1, Math.floor(input.durationMs)),
        reclaimCancelled: false,
        status: 'active',
        createDigest: out.digest,
      })
    }
    return { ok: true, digest: out.digest, leaseObjectId }
  } catch (e) {
    return { ok: false, error: formatDirectIotaSubmitError(e) }
  }
}

export async function cancelNftTimeLeaseReclaim(input: {
  messagingPackageId: string
  leaseObjectId: string
}): Promise<NftTimeLeaseActionResult> {
  const prep = await prepare()
  if (!prep.ok) return prep
  const { client, signer, sender } = prep
  try {
    const txb = buildCancelNftTimeLeaseReclaimTransaction({
      messagingPackageId: input.messagingPackageId,
      senderAddress: sender,
      leaseObjectId: input.leaseObjectId,
    })
    await attachGasPaymentForOwner(client, txb, sender, GAS_BUDGET)
    const out = await signAndExecuteTransactionWithSigner({ client, transaction: txb, signer })
    if (!isDirectChainExecutionSuccess(out.digest, out.status) || !out.digest) {
      return { ok: false, error: mapLeaseAbortError('cancel_reclaim', out.errorDetail) }
    }
    patchNftTimeLeaseLocal(input.leaseObjectId, { reclaimCancelled: true, status: 'cancelled' })
    return { ok: true, digest: out.digest, leaseObjectId: input.leaseObjectId }
  } catch (e) {
    return { ok: false, error: formatDirectIotaSubmitError(e) }
  }
}

export async function returnEarlyNftTimeLease(input: {
  messagingPackageId: string
  leaseObjectId: string
  imageNftPackageId?: string
}): Promise<NftTimeLeaseActionResult> {
  const prep = await prepare()
  if (!prep.ok) return prep
  const { client, signer, sender } = prep
  try {
    const txb = buildReturnEarlyNftTimeLeaseTransaction({
      messagingPackageId: input.messagingPackageId,
      senderAddress: sender,
      leaseObjectId: input.leaseObjectId,
      imageNftPackageId: input.imageNftPackageId,
    })
    await attachGasPaymentForOwner(client, txb, sender, GAS_BUDGET)
    const out = await signAndExecuteTransactionWithSigner({ client, transaction: txb, signer })
    if (!isDirectChainExecutionSuccess(out.digest, out.status) || !out.digest) {
      return { ok: false, error: mapLeaseAbortError('return_early', out.errorDetail) }
    }
    patchNftTimeLeaseLocal(input.leaseObjectId, { status: 'returned' })
    return { ok: true, digest: out.digest, leaseObjectId: input.leaseObjectId }
  } catch (e) {
    return { ok: false, error: formatDirectIotaSubmitError(e) }
  }
}

/** Lease-Object von Chain lesen → lokalen Index füllen (wenn Browser-Merker fehlt). */
export async function importNftTimeLeaseFromChain(leaseObjectIdRaw: string): Promise<
  | { ok: true; leaseObjectId: string; nftObjectId: string; unlockMs: number }
  | { ok: false; error: string }
> {
  const leaseObjectId = coerceHex64Id(leaseObjectIdRaw)
  if (!leaseObjectId) return { ok: false, error: 'Lease-Object-ID: 0x + 64 Hex.' }
  const rpc = getConfiguredDirectIotaRpcUrl()
  if (!rpc) return { ok: false, error: 'Keine Direkt-RPC-URL.' }
  if (isIotaRelayOnlyMode()) {
    return { ok: false, error: 'Braucht Direkt-RPC (nicht „Nur Morgendrot-API“).' }
  }
  try {
    const client = createDirectIotaClient({ rpcUrl: rpc })
    const res = await client.getObject({
      id: leaseObjectId,
      options: { showContent: true, showType: true },
    })
    const content = res.data?.content as
      | {
          dataType?: string
          type?: string
          fields?: Record<string, unknown>
        }
      | undefined
    if (!content || content.dataType !== 'moveObject' || !content.fields) {
      return { ok: false, error: 'Objekt nicht gefunden oder kein Move-Objekt.' }
    }
    const typeStr = String(content.type || '')
    if (!typeStr.includes('nft_time_lease::NftTimeLease')) {
      return {
        ok: false,
        error: `Kein NftTimeLease (Typ: ${typeStr.slice(0, 80) || '—'}).`,
      }
    }
    const f = content.fields
    const nftObjectId = coerceHex64Id(f.nft_id)
    const lender = coerceHex64Id(f.lender) || String(f.lender || '').trim().toLowerCase()
    const borrower = coerceHex64Id(f.borrower) || String(f.borrower || '').trim().toLowerCase()
    const unlockRaw = f.unlock_ms ?? f.unlockMs
    const unlockMs =
      typeof unlockRaw === 'number'
        ? unlockRaw
        : typeof unlockRaw === 'string'
          ? Number(unlockRaw)
          : 0
    const reclaimCancelled = Boolean(f.reclaim_cancelled ?? f.reclaimCancelled)
    if (!nftObjectId || !HEX64.test(lender) || !HEX64.test(borrower)) {
      return { ok: false, error: 'Lease-Felder unvollständig (nft_id/lender/borrower).' }
    }
    upsertNftTimeLeaseLocal({
      leaseObjectId,
      nftObjectId,
      lender,
      borrower,
      unlockMs: Number.isFinite(unlockMs) ? unlockMs : 0,
      reclaimCancelled,
      status: 'active',
    })
    return { ok: true, leaseObjectId, nftObjectId, unlockMs: Number.isFinite(unlockMs) ? unlockMs : 0 }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function reclaimNftTimeLease(input: {
  messagingPackageId: string
  leaseObjectId: string
  imageNftPackageId?: string
}): Promise<NftTimeLeaseActionResult> {
  const prep = await prepare()
  if (!prep.ok) return prep
  const { client, signer, sender } = prep
  try {
    const txb = buildReclaimNftTimeLeaseTransaction({
      messagingPackageId: input.messagingPackageId,
      senderAddress: sender,
      leaseObjectId: input.leaseObjectId,
      imageNftPackageId: input.imageNftPackageId,
    })
    await attachGasPaymentForOwner(client, txb, sender, GAS_BUDGET)
    const out = await signAndExecuteTransactionWithSigner({ client, transaction: txb, signer })
    if (!isDirectChainExecutionSuccess(out.digest, out.status) || !out.digest) {
      return { ok: false, error: mapLeaseAbortError('reclaim', out.errorDetail) }
    }
    patchNftTimeLeaseLocal(input.leaseObjectId, { status: 'reclaimed' })
    return { ok: true, digest: out.digest, leaseObjectId: input.leaseObjectId }
  } catch (e) {
    return { ok: false, error: formatDirectIotaSubmitError(e) }
  }
}
