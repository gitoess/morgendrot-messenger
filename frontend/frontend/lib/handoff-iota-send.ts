import type { ApiStatus } from '@/frontend/lib/api'
import type { StandaloneSmartphoneHandoffZipBody } from '@/frontend/lib/api/standalone-smartphone-handoff'
import { buildHandoffZipPayload } from '@/frontend/lib/handoff-zip-payload'
import { buildHandoffZipWire, handoffZipWireFitsMailbox } from '@/frontend/lib/handoff-iota-wire'
import { ensureHandoffEncryptedPeerReady } from '@/frontend/lib/handoff-iota-peer'
import { sendEncryptedMailboxHybrid } from '@/frontend/lib/mailbox-send-hybrid'

export type SendHandoffViaIotaResult =
  | { ok: true; sent: number; recipients: string[]; failures: { address: string; error: string }[] }
  | { ok: false; error: string }

export async function sendHandoffZipViaIota(opts: {
  body: StandaloneSmartphoneHandoffZipBody
  password?: string
  partnerAddresses: string[]
  handoffLabel?: string
  apiStatus: ApiStatus | null | undefined
  refreshApiStatus?: () => Promise<void>
}): Promise<SendHandoffViaIotaResult> {
  const partners = [
    ...new Set(
      opts.partnerAddresses
        .map((a) => a.trim().toLowerCase())
        .filter((a) => /^0x[a-f0-9]{64}$/.test(a))
    ),
  ]
  if (!partners.length) {
    return { ok: false, error: 'Mindestens einen Partner in der Auswahl — IOTA-Handoff geht an Partner-Adressen (E2EE).' }
  }

  const built = await buildHandoffZipPayload(opts.body, { password: opts.password })
  if (!built.ok) return built

  const wire = buildHandoffZipWire(built.zipBytes, {
    label: opts.handoffLabel,
    protected: built.passwordProtected,
    exportedAt: new Date().toISOString(),
  })
  const fit = handoffZipWireFitsMailbox(wire)
  if (!fit.ok) return fit

  const failures: { address: string; error: string }[] = []
  let sent = 0
  const sentTo: string[] = []

  for (const addr of partners) {
    const ready = await ensureHandoffEncryptedPeerReady(addr, opts.apiStatus, opts.refreshApiStatus)
    if (!ready.ok) {
      failures.push({ address: addr, error: ready.message })
      continue
    }
    const r = await sendEncryptedMailboxHybrid(addr, wire, { timeoutMs: 180_000 })
    if (r.ok) {
      sent++
      sentTo.push(addr)
    } else {
      failures.push({ address: addr, error: r.error || r.message || 'Senden fehlgeschlagen' })
    }
  }

  if (sent === 0) {
    const summary = failures.map((f) => `${f.address.slice(0, 10)}…: ${f.error}`).join(' · ')
    return {
      ok: false,
      error:
        summary ||
        'Handoff konnte an keinen Partner gesendet werden — Handshake prüfen oder ZIP per USB.',
    }
  }

  return { ok: true, sent, recipients: sentTo, failures }
}
