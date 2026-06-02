import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import {
  canUseDirectEncryptedMailboxDrain,
  canUseDirectPlaintextMailboxDrain,
  DIRECT_CHAIN_SNAPSHOT_STALE_MS,
  formatDirectChainSnapshotStatusLine,
  getDirectChainIdsReadiness,
  getDirectChainSnapshotMeta,
  getDirectMailboxChainSnapshot,
  persistDirectChainFieldIds,
  setDirectChainOptimisticFlagsEnabled,
  persistDirectMailboxChainSnapshot,
} from './direct-iota-chain-context'

describe('direct-iota-chain-context snapshot meta (H.15 B.1)', () => {
  const store: Record<string, string> = {}
  const pkg = '0x' + '11'.repeat(32)
  const mb = '0x' + '22'.repeat(32)
  const addr = '0x' + '33'.repeat(32)

  beforeEach(() => {
    Object.keys(store).forEach((k) => delete store[k])
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k: string) => (k in store ? store[k] : null),
        setItem: (k: string, v: string) => {
          store[k] = v
        },
        removeItem: (k: string) => {
          delete store[k]
        },
      } as Storage,
    } as Window & typeof globalThis)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('ohne Snapshot: stale und klare Meldung', () => {
    const meta = getDirectChainSnapshotMeta()
    expect(meta.hasSnapshot).toBe(false)
    expect(meta.stale).toBe(true)
    expect(formatDirectChainSnapshotStatusLine(meta)).toMatch(/Kein Ketten-Snapshot/)
  })

  it('frischer Snapshot: nicht stale', () => {
    const now = 1_700_000_000_000
    persistDirectMailboxChainSnapshot({
      packageId: pkg,
      mailboxId: mb,
      senderAddress: addr,
      ttlDays: BigInt(30),
      flags: { useMailbox: true, mailboxStorePlaintext: true, messengerCreditsConfigured: false },
    })
    store['morgendrot.directChain.savedAtMs'] = String(now)
    const meta = getDirectChainSnapshotMeta(now)
    expect(meta.hasSnapshot).toBe(true)
    expect(meta.stale).toBe(false)
    expect(meta.mailboxTtlDays).toBe(30)
    expect(formatDirectChainSnapshotStatusLine(meta)).toMatch(/nutzbar/)
  })

  it('Snapshot älter als Cache-TTL: stale', () => {
    const now = 1_700_000_000_000
    persistDirectMailboxChainSnapshot({
      packageId: pkg,
      mailboxId: mb,
      senderAddress: addr,
      ttlDays: BigInt(7),
      flags: { useMailbox: true, mailboxStorePlaintext: true, messengerCreditsConfigured: false },
    })
    store['morgendrot.directChain.savedAtMs'] = String(now - DIRECT_CHAIN_SNAPSHOT_STALE_MS - 60_000)
    const meta = getDirectChainSnapshotMeta(now)
    expect(meta.stale).toBe(true)
    expect(formatDirectChainSnapshotStatusLine(meta)).toMatch(/Veraltet/)
  })

  it('resolve Snapshot aus einzelnen LS-Feldern ohne flagsJson (optimistic)', () => {
    store['morgendrot.directChain.packageId'] = pkg
    store['morgendrot.directChain.mailboxId'] = mb
    store['morgendrot.directChain.senderAddress'] = addr
    store['morgendrot.directIotaRpcUrl'] = 'https://rpc.test'
    setDirectChainOptimisticFlagsEnabled(true)
    const snap = getDirectMailboxChainSnapshot()
    expect(snap?.packageId).toBe(pkg)
    expect(canUseDirectPlaintextMailboxDrain()).toBe(true)
    expect(canUseDirectEncryptedMailboxDrain()).toBe(true)
    const readiness = getDirectChainIdsReadiness()
    expect(readiness.ready).toBe(true)
    expect(readiness.missing).toEqual([])
  })

  it('persistDirectChainFieldIds schreibt nur gültige Hex-Felder', () => {
    persistDirectChainFieldIds({ packageId: pkg, mailboxId: 'bad', senderAddress: addr })
    expect(store['morgendrot.directChain.packageId']).toBe(pkg)
    expect(store['morgendrot.directChain.senderAddress']).toBe(addr)
    expect(store['morgendrot.directChain.mailboxId']).toBeUndefined()
  })

  it('optimistic flags erlauben Direct-Drain ohne API-Flags', () => {
    persistDirectMailboxChainSnapshot({
      packageId: pkg,
      mailboxId: mb,
      senderAddress: addr,
      ttlDays: BigInt(30),
      flags: { useMailbox: false, mailboxStorePlaintext: false, messengerCreditsConfigured: true },
    })
    expect(canUseDirectPlaintextMailboxDrain()).toBe(false)
    setDirectChainOptimisticFlagsEnabled(true)
    expect(canUseDirectPlaintextMailboxDrain()).toBe(true)
  })
})
