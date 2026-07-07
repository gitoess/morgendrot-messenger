import { describe, expect, it } from 'vitest'
import { resolveChatSendEncryption } from '@/frontend/lib/resolve-chat-send-encryption'

describe('resolveChatSendEncryption (H.3n B2.5)', () => {
  it('SOS erzwingt Klartext auch bei aktivem Schloss', () => {
    expect(resolveChatSendEncryption({ encrypted: true, emergencyWire: 'text' })).toBe(false)
    expect(resolveChatSendEncryption({ encrypted: true, emergencyWire: 'voice' })).toBe(false)
  })

  it('normaler Send respektiert Schloss', () => {
    expect(resolveChatSendEncryption({ encrypted: true })).toBe(true)
    expect(resolveChatSendEncryption({ encrypted: false })).toBe(false)
  })
})
