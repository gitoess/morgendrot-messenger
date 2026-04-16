import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  MORG_ATTESTATION_MANIFEST_V1_PREFIX,
  buildAttestationManifestWire,
  browserAttestationSubmit,
} from '@/frontend/lib/attestation-manifest-anchor'

vi.mock('@/frontend/lib/mailbox-send-hybrid', () => ({
  sendPlaintextMailboxHybrid: vi.fn(),
}))

vi.mock('@/frontend/lib/direct-iota-chain-context', () => ({
  getDirectMailboxChainSnapshot: vi.fn(),
}))

vi.mock('@/frontend/lib/api/offline-queue', () => ({
  nextOfflineMailboxClientOutSeq: vi.fn(() => 7),
}))

import { sendPlaintextMailboxHybrid } from '@/frontend/lib/mailbox-send-hybrid'
import { getDirectMailboxChainSnapshot } from '@/frontend/lib/direct-iota-chain-context'

describe('attestation-manifest-anchor', () => {
  beforeEach(() => {
    vi.mocked(sendPlaintextMailboxHybrid).mockReset()
    vi.mocked(getDirectMailboxChainSnapshot).mockReset()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('buildAttestationManifestWire: Marker + kompaktes JSON', () => {
    const wire = buildAttestationManifestWire({
      manifestVersion: 1,
      canonicalMsgRefHex: 'ab'.repeat(32),
      secondaryCanonicalMsgRefHex: 'cd'.repeat(32),
      imageContentSha256Hex: 'ef'.repeat(32),
      observedAtMs: 1_700_000_000_000,
      timeIsTrusted: true,
    })
    expect(wire.startsWith(MORG_ATTESTATION_MANIFEST_V1_PREFIX)).toBe(true)
    expect(wire).toContain('"ref":"' + 'ab'.repeat(32) + '"')
    expect(wire).toContain('"ref2":"' + 'cd'.repeat(32) + '"')
    expect(wire).toContain('"img":"' + 'ef'.repeat(32) + '"')
    expect(wire).toContain('"tt":true')
  })

  it('browserAttestationSubmit: ohne Snapshot → Fehler', async () => {
    vi.mocked(getDirectMailboxChainSnapshot).mockReturnValue(null)
    const r = await browserAttestationSubmit({
      manifestVersion: 1,
      canonicalMsgRefHex: null,
      observedAtMs: 1,
      timeIsTrusted: false,
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/Absenderadresse/)
    expect(sendPlaintextMailboxHybrid).not.toHaveBeenCalled()
  })

  it('browserAttestationSubmit: Hybrid an eigene Adresse', async () => {
    const addr = '0x' + 'c3'.repeat(32)
    vi.mocked(getDirectMailboxChainSnapshot).mockReturnValue({
      packageId: '0x' + '11'.repeat(32),
      mailboxId: '0x' + '22'.repeat(32),
      senderAddress: addr,
      ttlDays: BigInt(30),
      flags: {
        useMailbox: true,
        mailboxStorePlaintext: true,
        messengerCreditsConfigured: false,
      },
    })
    vi.mocked(sendPlaintextMailboxHybrid).mockResolvedValue({ ok: true })

    const draft = {
      manifestVersion: 1,
      canonicalMsgRefHex: null,
      observedAtMs: 99,
      timeIsTrusted: false,
    } satisfies import('@morgendrot/core/attestation').AttestationManifestDraftV1
    const r = await browserAttestationSubmit(draft)
    expect(r.ok).toBe(true)
    expect(sendPlaintextMailboxHybrid).toHaveBeenCalledTimes(1)
    const [recipient, wire, nonce] = vi.mocked(sendPlaintextMailboxHybrid).mock.calls[0]!
    expect(recipient).toBe(addr)
    expect(wire).toContain(MORG_ATTESTATION_MANIFEST_V1_PREFIX)
    expect(nonce).toBe(BigInt(7))
  })
})
