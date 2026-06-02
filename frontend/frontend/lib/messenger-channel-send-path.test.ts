import { describe, expect, it } from 'vitest'
import {
  isChannelSendPathCompatible,
  isSendPathAllowedForChannel,
  reconcileChannelSendPath,
  resolveActiveSendPath,
} from './messenger-channel-send-path'

describe('messenger-channel-send-path', () => {
  it('resolveActiveSendPath', () => {
    expect(resolveActiveSendPath('telegram', 'internet')).toBe('telegram')
    expect(resolveActiveSendPath('chain', 'mesh')).toBe('mesh')
  })

  it('online erlaubt alle Kanäle', () => {
    for (const ch of ['private', 'group', 'pinnwand'] as const) {
      expect(isChannelSendPathCompatible(ch, 'chain', 'internet')).toBe(true)
    }
  })

  it('adhoc nur 1:1', () => {
    expect(isChannelSendPathCompatible('private', 'chain', 'adhoc')).toBe(true)
    expect(isChannelSendPathCompatible('group', 'chain', 'adhoc')).toBe(false)
    expect(isChannelSendPathCompatible('pinnwand', 'chain', 'adhoc')).toBe(false)
  })

  it('funk: 1:1 und gruppe, nicht pinnwand', () => {
    expect(isChannelSendPathCompatible('private', 'chain', 'mesh')).toBe(true)
    expect(isChannelSendPathCompatible('group', 'chain', 'mesh')).toBe(true)
    expect(isChannelSendPathCompatible('pinnwand', 'chain', 'mesh')).toBe(false)
  })

  it('telegram nur 1:1', () => {
    expect(isSendPathAllowedForChannel('private', 'telegram')).toBe(true)
    expect(isSendPathAllowedForChannel('group', 'telegram')).toBe(false)
  })

  it('reconcile bei pinnwand+funk → online', () => {
    const r = reconcileChannelSendPath('pinnwand', 'chain', 'mesh')
    expect(r.forcedTransport).toBe('internet')
    expect(r.channel).toBe('pinnwand')
  })
})
