import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import {
  bootstrapCapacitorStandaloneSession,
  readStandaloneDeviceStatusFallback,
  resolveStandaloneDeviceLocked,
} from './capacitor-standalone-bootstrap'
import {
  getDirectIotaSessionSigner,
  getDirectIotaSessionSignerAddress,
} from '@/frontend/lib/direct-iota-mnemonic-session'

vi.mock('@/frontend/lib/capacitor-platform', () => ({
  isCapacitorNativePlatform: () => true,
}))

vi.mock('@/frontend/lib/direct-iota-mnemonic-session', () => ({
  getDirectIotaSessionSigner: vi.fn(() => null),
  getDirectIotaSessionSignerAddress: vi.fn(() => ''),
  hasPersistedDirectIotaSessionSigner: vi.fn(() => false),
}))

describe('capacitor-standalone-bootstrap', () => {
  const store: Record<string, string> = {}

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
      },
    } as Window & typeof globalThis)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('setzt beim ersten APK-Start Autarkie-Defaults', () => {
    bootstrapCapacitorStandaloneSession()
    expect(store['morgendrot.autarkyMode']).toBe('1')
    expect(store['morgendrot.directMailboxDrain']).toBe('1')
    expect(store['morgendrot.capacitorStandaloneBootstrapped.v1']).toBe('1')
    bootstrapCapacitorStandaloneSession()
    expect(store['morgendrot.autarkyMode']).toBe('1')
  })

  it('liefert Status-Fallback ohne API-Basis bei Handoff + RPC', () => {
    const pkg = '0x' + 'a'.repeat(64)
    const mb = '0x' + 'b'.repeat(64)
    store['morgendrot.handoff.localApplied.v1'] = JSON.stringify({
      savedAtMs: Date.now(),
      handoffLabel: 'Feld',
      role: 'arbeiter',
      packageId: pkg,
      mailboxId: mb,
      transportProfile: 'mesh-first',
    })
    store['morgendrot.directIotaRpcUrl'] = 'https://rpc.example'
    store['morgendrot.directChain.packageId'] = pkg
    store['morgendrot.directChain.mailboxId'] = mb
    store['morgendrot.autarkyMode'] = '1'

    const fb = readStandaloneDeviceStatusFallback()
    expect(fb?.status.fromLocalHandoff).toBe(true)
    expect(fb?.status.role).toBe('arbeiter')
    expect(fb?.status.packageId).toBe(pkg)
  })

  it('liefert Erststart-Status auf nativer Plattform ohne Handoff', () => {
    store['morgendrot.autarkyMode'] = '1'
    const fb = readStandaloneDeviceStatusFallback()
    expect(fb?.status.signer).toBe('sdk')
    expect(fb?.status.role).toBe('messenger')
    expect(resolveStandaloneDeviceLocked()).toBe(false)
    expect(fb?.status.configHints?.[0]).toBeTruthy()
    expect(String(fb?.status.configHints?.[0]).length).toBeGreaterThan(12)
  })

  it('Standalone locked im Solo-Pfad ohne Session-Signer', () => {
    store['morgendrot.autarkyMode'] = '1'
    store['morgendrot.standaloneOnboardingPath.v1'] = 'solo'
    store['morgendrot.handoff.localApplied.v1'] = JSON.stringify({
      savedAtMs: Date.now(),
      handoffLabel: 'Privat / Solo',
      deploymentProfile: 'consumer',
      role: 'messenger',
    })
    expect(resolveStandaloneDeviceLocked()).toBe(true)
    const fb = readStandaloneDeviceStatusFallback()
    expect(fb?.status.deploymentProfile).toBe('consumer')
    expect(fb?.status.locked).toBe(true)
  })

  it('Standalone locked wenn Handoff da, aber kein Session-Signer', () => {
    store['morgendrot.handoff.localApplied.v1'] = JSON.stringify({
      savedAtMs: Date.now(),
      role: 'arbeiter',
      packageId: '0x' + 'a'.repeat(64),
      mailboxId: '0x' + 'b'.repeat(64),
    })
    store['morgendrot.autarkyMode'] = '1'
    expect(resolveStandaloneDeviceLocked()).toBe(true)
  })

  it('hasKeys=true wenn Direkt-Session-Signer aktiv (Standalone-Fallback)', () => {
    const pkg = '0x' + 'a'.repeat(64)
    const mb = '0x' + 'b'.repeat(64)
    const addr = '0x' + 'c'.repeat(64)
    store['morgendrot.handoff.localApplied.v1'] = JSON.stringify({
      savedAtMs: Date.now(),
      role: 'arbeiter',
      packageId: pkg,
      mailboxId: mb,
    })
    store['morgendrot.directIotaRpcUrl'] = 'https://rpc.example'
    store['morgendrot.directChain.packageId'] = pkg
    store['morgendrot.directChain.mailboxId'] = mb
    store['morgendrot.autarkyMode'] = '1'
    vi.mocked(getDirectIotaSessionSigner).mockReturnValue({} as never)
    vi.mocked(getDirectIotaSessionSignerAddress).mockReturnValue(addr)

    const fb = readStandaloneDeviceStatusFallback()
    expect(fb?.status.hasKeys).toBe(true)
    expect(fb?.status.locked).toBe(false)
    expect(fb?.status.capabilities?.transport.iota.write).toBe(true)
  })
})
