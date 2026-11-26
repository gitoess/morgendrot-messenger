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

  it('Legacy allein schaltet nicht an (Default aus)', () => {
    localStorage.setItem(LEGACY_DEV_EXPERT_TOOLS_LS, '1')
    expect(isMessengerClientExpertModeEnabled()).toBe(false)
  })

  it('explizit aus trotz Legacy=1', () => {
    localStorage.setItem(LEGACY_DEV_EXPERT_TOOLS_LS, '1')
    setMessengerClientExpertModeEnabled(false)
    expect(localStorage.getItem(MESSENGER_CLIENT_EXPERT_MODE_LS)).toBe('0')
    expect(isMessengerClientExpertModeEnabled()).toBe(false)
  })

  it('an schreibt neuen Key', () => {
    setMessengerClientExpertModeEnabled(true)
    expect(localStorage.getItem(MESSENGER_CLIENT_EXPERT_MODE_LS)).toBe('1')
    expect(isMessengerClientExpertModeEnabled()).toBe(true)
  })
})
