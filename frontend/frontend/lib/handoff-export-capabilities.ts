import type { HandoffHelperRole, HandoffTransportProfile } from '@/frontend/lib/handoff-export-presets'
import {
  resolveMessengerCapabilities,
  type MessengerCapabilitiesMatrix,
  type MessengerCapabilitiesOverride,
} from '@morgendrot/shared/messenger-capabilities-matrix'

export type HandoffExportCapabilityContext = {
  roleId: number
  simpleMode: boolean
  transportProfile: HandoffTransportProfile
  helperRole: HandoffHelperRole
}

export function resolveHandoffExportCapabilities(
  ctx: HandoffExportCapabilityContext,
  override: MessengerCapabilitiesOverride | null
): MessengerCapabilitiesMatrix {
  return resolveMessengerCapabilities({
    roleId: ctx.roleId,
    simpleMode: ctx.simpleMode,
    transportProfile: ctx.transportProfile,
    hierarchyRole: ctx.helperRole,
    override: override ?? undefined,
  })
}
