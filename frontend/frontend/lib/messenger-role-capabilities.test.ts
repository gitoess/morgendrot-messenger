import { describe, expect, it } from 'vitest'
import {
  canShowInboxPackageExpertMenu,
  canUseMessengerExpertTools,
  getMessengerUiCapabilities,
  isIotaTransportUiVisible,
  isSimpleUiMode,
} from './messenger-role-capabilities'
import type { ApiStatus } from '@/frontend/lib/api/status'

describe('messenger-role-capabilities product profile', () => {
  it('isSimpleUiMode aus status.simpleMode', () => {
    expect(isSimpleUiMode({ simpleMode: true } as ApiStatus)).toBe(true)
    expect(isSimpleUiMode({ simpleMode: false, uiMode: 'expert' } as ApiStatus)).toBe(false)
  })

  it('isIotaTransportUiVisible nur bei iota-*', () => {
    expect(isIotaTransportUiVisible({ transportProfile: 'mesh-first' } as ApiStatus)).toBe(false)
    expect(isIotaTransportUiVisible({ transportProfile: 'iota-anchored' } as ApiStatus)).toBe(true)
  })

  it('canUseMessengerExpertTools false in Simple Mode', () => {
    expect(
      canUseMessengerExpertTools({ simpleMode: true, transportProfile: 'iota-full' } as ApiStatus)
    ).toBe(false)
    expect(
      canUseMessengerExpertTools({ simpleMode: false, transportProfile: 'iota-full' } as ApiStatus)
    ).toBe(true)
  })

  it('canShowInboxPackageExpertMenu braucht Client-Toggle und kein Simple Mode', () => {
    const status = { simpleMode: false, transportProfile: 'iota-full' } as ApiStatus
    expect(canShowInboxPackageExpertMenu(status, false)).toBe(false)
    expect(canShowInboxPackageExpertMenu(status, true)).toBe(true)
    expect(canShowInboxPackageExpertMenu({ simpleMode: true, transportProfile: 'iota-full' } as ApiStatus, true)).toBe(
      false
    )
  })

  it('getMessengerUiCapabilities: mesh-first Helfer ohne IOTA-UI', () => {
    const caps = getMessengerUiCapabilities({
      simpleMode: true,
      transportProfile: 'mesh-first',
      iotaTransportUiEnabled: false,
    } as ApiStatus)
    expect(caps.expertTools).toBe(false)
    expect(caps.showInboxIotaFilter).toBe(false)
    expect(caps.showPackageIdBanner).toBe(false)
    expect(caps.showAdhocTransport).toBe(false)
    expect(caps.showProminentOfflineQueueBanner).toBe(true)
  })
})
