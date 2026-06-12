import type { ApiStatus } from '@/frontend/lib/api/status'
import type { MessengerCapabilitiesMatrix } from '@morgendrot/shared/messenger-capabilities-matrix'

/** Vitest/RTL: volle Sende-Rechte — seit Phase-3-Capability-Gates Pflicht in Composer-Smokes. */
export const TEST_MESSENGER_CAPABILITIES_ALL_WRITE: MessengerCapabilitiesMatrix = {
  version: 1,
  roleId: 14,
  simpleMode: false,
  product: {
    canCreateGroup: true,
    canInviteMembers: true,
    canExportData: true,
    canManageEinsatzTemplates: true,
  },
  transport: {
    lora: { read: true, write: true },
    telegram: { read: true, write: true },
    iota: { read: true, write: true },
    ble: { read: true, write: true },
    streams: { read: true, write: true },
  },
  security: { forceEncryptionOnly: false, allowPlaintextFallback: true },
}

export const TEST_API_STATUS_SEND_READY = {
  connected: true,
  hasKeys: true,
  locked: false,
  roleId: 14,
  capabilities: TEST_MESSENGER_CAPABILITIES_ALL_WRITE,
} as const satisfies Partial<ApiStatus>
