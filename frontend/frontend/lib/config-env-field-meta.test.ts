import { describe, expect, it } from 'vitest'
import {
  CONFIG_KEYS_MESSENGER,
  getConfigFieldMeta,
  shouldShowConfigKeyInMessenger,
} from './config-env-field-meta'

describe('config-env-field-meta messenger filter', () => {
  it('zeigt Messenger-Kernkeys', () => {
    expect(shouldShowConfigKeyInMessenger('MAILBOX_ID')).toBe(true)
    expect(shouldShowConfigKeyInMessenger('ROLE')).toBe(true)
    expect(shouldShowConfigKeyInMessenger('USE_MAILBOX')).toBe(true)
  })

  it('blendet oben editierte Keys aus', () => {
    expect(shouldShowConfigKeyInMessenger('RPC_URL')).toBe(false)
    expect(shouldShowConfigKeyInMessenger('PACKAGE_ID')).toBe(false)
  })

  it('blendet Projekt-Keys aus (Shop, Lock, Monitor)', () => {
    expect(shouldShowConfigKeyInMessenger('SHOP_CHECKOUT_RATE_LIMIT_PER_MINUTE')).toBe(false)
    expect(shouldShowConfigKeyInMessenger('ENABLE_SHOP_API')).toBe(false)
    expect(shouldShowConfigKeyInMessenger('STRIPE_SECRET_KEY')).toBe(false)
    expect(shouldShowConfigKeyInMessenger('LOCK_ID')).toBe(false)
    expect(shouldShowConfigKeyInMessenger('OPEN_COMMAND')).toBe(false)
    expect(shouldShowConfigKeyInMessenger('ENABLE_MONITOR')).toBe(false)
    expect(shouldShowConfigKeyInMessenger('MONITOR_DEVICES')).toBe(false)
    expect(shouldShowConfigKeyInMessenger('UI_PORT')).toBe(false)
    expect(shouldShowConfigKeyInMessenger('API_PORT')).toBe(false)
  })

  it('blendet Legacy-Partner standardmäßig aus', () => {
    expect(shouldShowConfigKeyInMessenger('PARTNER_ADDRESS')).toBe(false)
    expect(shouldShowConfigKeyInMessenger('PARTNER_ADDRESS', { showLegacy: true })).toBe(false)
  })

  it('blendet abgeleitete und unbekannte Keys aus', () => {
    expect(shouldShowConfigKeyInMessenger('(abgeleitet)')).toBe(false)
    expect(shouldShowConfigKeyInMessenger('SOME_FUTURE_KEY')).toBe(false)
  })

  it('Whitelist deckt keine Shop-Keys ab', () => {
    for (const k of ['SHOP_CHECKOUT_RATE_LIMIT_PER_MINUTE', 'ENABLE_VOUCHER_CLAIM_API']) {
      expect(CONFIG_KEYS_MESSENGER.has(k)).toBe(false)
    }
  })

  it('jeder Messenger-Whitelist-Key hat einen UI-Hilfetext in META', () => {
    for (const k of CONFIG_KEYS_MESSENGER) {
      const desc = getConfigFieldMeta(k).description
      expect(desc.length).toBeGreaterThan(10)
      expect(desc).not.toMatch(/^Konfigurationsschlüssel /)
    }
  })
})
