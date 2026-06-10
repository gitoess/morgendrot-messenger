import { beforeEach, describe, expect, it } from 'vitest'
import {
  isMessengerClientExpertModeEnabled,
  LEGACY_DEV_EXPERT_TOOLS_LS,
  MESSENGER_CLIENT_EXPERT_MODE_LS,
  setMessengerClientExpertModeEnabled,
} from './messenger-client-expert-mode'

describe('messenger-client-expert-mode', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('default aus', () => {
    expect(isMessengerClientExpertModeEnabled()).toBe(false)
  })

  it('explizit aus trotz Legacy=1', () => {
    localStorage.setItem(LEGACY_DEV_EXPERT_TOOLS_LS, '1')
    setMessengerClientExpertModeEnabled(false)
    expect(localStorage.getItem(MESSENGER_CLIENT_EXPERT_MODE_LS)).toBe('0')
    expect(localStorage.getItem(LEGACY_DEV_EXPERT_TOOLS_LS)).toBe('0')
    expect(isMessengerClientExpertModeEnabled()).toBe(false)
  })

  it('Legacy-Fallback nur ohne expliziten Key', () => {
    localStorage.setItem(LEGACY_DEV_EXPERT_TOOLS_LS, '1')
    expect(isMessengerClientExpertModeEnabled()).toBe(true)
  })

  it('an schreibt beide Keys', () => {
    setMessengerClientExpertModeEnabled(true)
    expect(isMessengerClientExpertModeEnabled()).toBe(true)
  })
})
