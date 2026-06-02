import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import {
  bootstrapCapacitorStandaloneSession,
  readStandaloneDeviceStatusFallback,
} from './capacitor-standalone-bootstrap'

vi.mock('@/frontend/lib/capacitor-platform', () => ({
  isCapacitorNativePlatform: () => true,
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
})
