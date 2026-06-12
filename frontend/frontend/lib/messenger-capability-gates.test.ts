import { describe, expect, it } from 'vitest'
import {
  activeSendPathWriteDeniedReason,
  canComposerSendPathWrite,
  canExportDataCapability,
  composerSendPathWriteDeniedReason,
  canTransportWrite,
  exportDataDeniedReason,
  inboxSourceFilterReadAllowed,
  isPlaintextSendBlockedByCapabilities,
} from './messenger-capability-gates'
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

  it('composer send path maps transport channels', () => {
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
          iota: { read: true, write: false },
          ble: { read: true, write: false },
          streams: { read: true, write: false },
        },
        security: { forceEncryptionOnly: true, allowPlaintextFallback: false },
      },
    } as ApiStatus
    expect(canComposerSendPathWrite(status, 'mesh')).toBe(true)
    expect(canComposerSendPathWrite(status, 'internet')).toBe(false)
    expect(composerSendPathWriteDeniedReason(status, 'telegram')).toMatch(/Lese-Berechtigung/)
    expect(activeSendPathWriteDeniedReason(status, 'internet', 'chain')).toMatch(/Handoff-Rechte/)
    expect(isPlaintextSendBlockedByCapabilities(status, false, 'mesh')).toBe(true)
    expect(isPlaintextSendBlockedByCapabilities(status, true, 'mesh')).toBe(false)
  })

  it('inbox source filter und export respektieren capabilities', () => {
    const status = {
      roleId: 12,
      role: 'messenger',
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
        security: { forceEncryptionOnly: false, allowPlaintextFallback: true },
      },
    } as ApiStatus
    expect(inboxSourceFilterReadAllowed(status, 'funk')).toBe(true)
    expect(inboxSourceFilterReadAllowed(status, 'mailbox')).toBe(false)
    expect(inboxSourceFilterReadAllowed(status, 'telegram')).toBe(true)
    expect(canExportDataCapability(status)).toBe(false)
    expect(exportDataDeniedReason(status)).toMatch(/Handoff-Rechte/)
  })
})
