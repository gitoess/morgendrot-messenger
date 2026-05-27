import { describe, expect, it } from 'vitest'
import { canTransportWrite } from './messenger-capability-gates'
import type { ApiStatus } from '@/frontend/lib/api/status'

describe('messenger-capability-gates', () => {
  it('nutzt capabilities wenn gesetzt', () => {
    const status = {
      roleId: 12,
      capabilities: {
        version: 1 as const,
        roleId: 12,
        simpleMode: true,
        product: {
          canCreateGroup: false,
          canInviteMembers: false,
          canExportData: false,
          canManageEinsatzTemplates: false,
        },
        transport: {
          lora: { read: true, write: true },
          telegram: { read: true, write: false },
          iota: { read: false, write: false },
          ble: { read: true, write: false },
          streams: { read: true, write: false },
        },
        security: { forceEncryptionOnly: true, allowPlaintextFallback: false },
      },
    } as ApiStatus
    expect(canTransportWrite(status, 'lora')).toBe(true)
    expect(canTransportWrite(status, 'telegram')).toBe(false)
  })

  it('legacy fallback: S-Bit', () => {
    expect(canTransportWrite({ roleId: 14 }, 'lora')).toBe(true)
    expect(canTransportWrite({ roleId: 12 }, 'lora')).toBe(false)
  })
})
