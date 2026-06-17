import { describe, expect, it, vi } from 'vitest'
import { recipientChoicesForSendPath } from '@/frontend/lib/messenger-send-path-recipient-options'
import { TEST_API_STATUS_SEND_READY } from '@/frontend/lib/test-fixtures/messenger-capabilities'

describe('recipientChoicesForSendPath', () => {
  it('online: 1:1, Gruppe, Pinnwand', () => {
    const pinnwandAddr = `0x${'c'.repeat(64)}`
    const choices = recipientChoicesForSendPath('internet', 'consumer', {
      ...TEST_API_STATUS_SEND_READY,
      broadcastPinnwand: { enabled: true, address: pinnwandAddr },
    })
    expect(choices.map((c) => (c.kind === 'channel' ? c.label : c.label))).toEqual([
      '1:1',
      'Gruppe',
      'Pinnwand',
    ])
  })

  it('funk: 1:1 und Gruppe', () => {
    const choices = recipientChoicesForSendPath('mesh', 'consumer', TEST_API_STATUS_SEND_READY)
    expect(choices).toHaveLength(2)
  })

  it('telegram: 1:1 und Alle', () => {
    const choices = recipientChoicesForSendPath('telegram', 'consumer', TEST_API_STATUS_SEND_READY)
    expect(choices.map((c) => c.label)).toEqual(['1:1', 'Alle'])
  })
})
