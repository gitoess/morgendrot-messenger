import { describe, expect, it } from 'vitest'
import { resolveHandoffExportCapabilities } from './handoff-export-capabilities'
import { HANDOFF_CAPABILITY_PRESETS } from './handoff-capability-presets'

describe('handoff-capability-presets', () => {
  it('Medic-Funker: LoRa write, Telegram read-only', () => {
    const preset = HANDOFF_CAPABILITY_PRESETS.find((x) => x.id === 'medic-funker')!
    const c = resolveHandoffExportCapabilities(
      {
        roleId: preset.apply.roleId ?? 14,
        simpleMode: true,
        transportProfile: 'mesh-first',
        helperRole: 'messenger',
      },
      preset.apply.override
    )
    expect(c.transport.lora.write).toBe(true)
    expect(c.transport.telegram.write).toBe(false)
    expect(c.transport.telegram.read).toBe(true)
    expect(c.transport.iota.write).toBe(false)
    expect(c.security.forceEncryptionOnly).toBe(true)
  })
})
