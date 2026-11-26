import { describe, expect, it } from 'vitest'
import {
  IOTA_MESSENGER_UI,
  isIotaMessengerProduct,
  PRODUCT_DISPLAY_NAME,
  PRODUCT_ID,
} from '@/frontend/lib/product-identity'

describe('product-identity (Morgendrot-Default-Build)', () => {
  it('kein IOTA-Messenger ohne NEXT_PUBLIC_PRODUCT_ID', () => {
    expect(isIotaMessengerProduct()).toBe(false)
    expect(PRODUCT_ID).toBe('morgendrot')
    expect(PRODUCT_DISPLAY_NAME).toBe('Morgendrot')
  })

  it('Hide-Flags aus (volles Morgendrot)', () => {
    expect(IOTA_MESSENGER_UI.hideSos).toBe(false)
    expect(IOTA_MESSENGER_UI.hideEinsatzleitung).toBe(false)
    expect(IOTA_MESSENGER_UI.hideBossHandoff).toBe(false)
    expect(IOTA_MESSENGER_UI.hideHandoffImport).toBe(false)
    expect(IOTA_MESSENGER_UI.hideTelegramMonitor).toBe(false)
    expect(IOTA_MESSENGER_UI.hideTelegramEinsatzAlarm).toBe(false)
    expect(IOTA_MESSENGER_UI.hideBossRolePill).toBe(false)
  })
})
