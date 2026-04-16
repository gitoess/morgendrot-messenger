import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  isForensicImageMailboxAttestationEnabled,
  runForensicMailboxAttestationAfterSend,
  sha256HexFromBase64Bytes,
} from '@/frontend/lib/forensic-mailbox-attestation'

vi.mock('@/frontend/lib/api', () => ({
  computeCanonicalMsgRefV1: vi.fn(),
  stableOfflineMailboxThreadId: vi.fn(() => 'thread\nid'),
  nextOfflineMailboxClientOutSeq: vi.fn(() => 1),
  parseMailboxOutNonceMarker: vi.fn(),
  prependMailboxOutNonceMarker: vi.fn((w: string, n: bigint) => `[[NONCE:${n}]]\n${w}`),
}))

vi.mock('@/frontend/lib/attestation-queue', () => ({
  enqueueAttestationManifestDraft: vi.fn(() => ({ ok: true, remaining: 0 })),
  drainAttestationQueue: vi.fn(() => Promise.resolve({ sent: 1, failed: 0, remaining: 0 })),
}))

import { computeCanonicalMsgRefV1 } from '@/frontend/lib/api'
import { enqueueAttestationManifestDraft, drainAttestationQueue } from '@/frontend/lib/attestation-queue'

describe('forensic-mailbox-attestation', () => {
  beforeEach(() => {
    vi.mocked(computeCanonicalMsgRefV1).mockReset()
    vi.mocked(enqueueAttestationManifestDraft).mockReset()
    vi.mocked(drainAttestationQueue).mockReset()
  })

  it('sha256HexFromBase64Bytes: gültige Base64', async () => {
    const h = await sha256HexFromBase64Bytes(btoa('hello'))
    expect(h).toMatch(/^[0-9a-f]{64}$/)
  })

  it('runForensicMailboxAttestationAfterSend: enqueue + drain', async () => {
    vi.mocked(computeCanonicalMsgRefV1).mockResolvedValue('aa'.repeat(32))
    const setStatusMsg = vi.fn()
    const ok = await runForensicMailboxAttestationAfterSend({
      recipient: '0x' + 'bb'.repeat(32),
      senderAddress: '0x' + 'cc'.repeat(32),
      primary: { payloadUtf8: 'wire', messageNonceU64: BigInt(1) },
      imageContentSha256Hex: 'dd'.repeat(32),
      deviceTimeTrustWarn: false,
      baseSuccessMsg: 'OK.',
      setStatusMsg,
      mailboxTxDigest: 'c'.repeat(64),
    })
    expect(ok).toBe(true)
    expect(setStatusMsg).toHaveBeenCalled()
    expect(enqueueAttestationManifestDraft).toHaveBeenCalled()
    expect(drainAttestationQueue).toHaveBeenCalled()
    const last = setStatusMsg.mock.calls.at(-1)?.[0] as string
    expect(last).toContain('Attestation verankert')
    expect(last).toContain('txblock')
  })

  it('isForensicImageMailboxAttestationEnabled: Opt-out 0', () => {
    const store: Record<string, string> = {}
    vi.stubGlobal(
      'window',
      {
        localStorage: {
          getItem: (k: string) => (k in store ? store[k] : null),
          setItem: (k: string, v: string) => {
            store[k] = v
          },
        } as Storage,
      } as Window & typeof globalThis
    )
    expect(isForensicImageMailboxAttestationEnabled()).toBe(true)
    store['morgendrot.forensicImageMailboxAttestation'] = '0'
    expect(isForensicImageMailboxAttestationEnabled()).toBe(false)
    vi.unstubAllGlobals()
  })
})
