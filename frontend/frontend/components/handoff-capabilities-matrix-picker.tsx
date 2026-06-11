'use client'

import {
  HANDOFF_CAPABILITY_PRESETS,
  type HandoffCapabilityPreset,
} from '@/frontend/lib/handoff-capability-presets'
import type {
  MessengerCapabilitiesMatrix,
  MessengerCapabilitiesOverride,
  TransportChannel,
} from '@morgendrot/shared/messenger-capabilities-matrix'
import { cn } from '@/lib/utils'

const PRIMARY_CHANNELS: { key: TransportChannel; label: string }[] = [
  { key: 'lora', label: 'Funk' },
  { key: 'telegram', label: 'Telegram' },
  { key: 'iota', label: 'IOTA' },
]

const EXTRA_CHANNELS: { key: TransportChannel; label: string }[] = [
  { key: 'ble', label: 'BLE' },
  { key: 'streams', label: 'Streams' },
]

export type HandoffCapabilitiesMatrixPickerProps = {
  effective: MessengerCapabilitiesMatrix
  capabilitiesOverride: MessengerCapabilitiesOverride | null
  onCapabilitiesOverrideChange: (override: MessengerCapabilitiesOverride | null) => void
  onApplyCapabilityPreset: (preset: HandoffCapabilityPreset) => void
  className?: string
  minimal?: boolean
}

export function HandoffCapabilitiesMatrixPicker(p: HandoffCapabilitiesMatrixPickerProps) {
  const setTransport = (channel: TransportChannel, patch: Partial<{ read: boolean; write: boolean }>) => {
    const current = p.effective.transport[channel]
    const next = { read: patch.read ?? current.read, write: patch.write ?? current.write }
    p.onCapabilitiesOverrideChange({
      ...p.capabilitiesOverride,
      transport: {
        ...p.capabilitiesOverride?.transport,
        [channel]: next,
      },
    })
  }

  const setProduct = (key: keyof MessengerCapabilitiesMatrix['product'], checked: boolean) => {
    p.onCapabilitiesOverrideChange({
      ...p.capabilitiesOverride,
      product: {
        ...p.capabilitiesOverride?.product,
        [key]: checked,
      },
    })
  }

  const setSecurity = (key: keyof MessengerCapabilitiesMatrix['security'], checked: boolean) => {
    p.onCapabilitiesOverrideChange({
      ...p.capabilitiesOverride,
      security: {
        ...p.capabilitiesOverride?.security,
        [key]: checked,
      },
    })
  }

  const renderChannelRow = (channel: TransportChannel, label: string) => {
    const access = p.effective.transport[channel]
    return (
      <tr key={channel} className="border-b border-border/40 last:border-0">
        <td className="py-1.5 pr-2 font-medium text-foreground">{label}</td>
        <td className="py-1.5 text-center">
          <input
            type="checkbox"
            aria-label={`${label} lesen`}
            checked={access.read}
            onChange={(e) => setTransport(channel, { read: e.target.checked })}
          />
        </td>
        <td className="py-1.5 text-center">
          <input
            type="checkbox"
            aria-label={`${label} schreiben`}
            checked={access.write}
            onChange={(e) => setTransport(channel, { write: e.target.checked })}
          />
        </td>
      </tr>
    )
  }

  return (
    <div className={cn(p.minimal ? 'space-y-2' : 'space-y-3 rounded-lg border border-emerald-600/25 bg-emerald-950/10 p-3', p.className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {HANDOFF_CAPABILITY_PRESETS.map((quick) => (
            <button
              key={quick.id}
              type="button"
              title={quick.hint}
              onClick={() => p.onApplyCapabilityPreset(quick)}
              className="rounded-md border border-border bg-muted/30 px-2 py-0.5 text-[11px] font-medium hover:bg-muted/50"
            >
              {quick.label}
            </button>
          ))}
        </div>
        {p.capabilitiesOverride != null ? (
          <button
            type="button"
            className="text-[11px] text-muted-foreground hover:text-foreground"
            onClick={() => p.onCapabilitiesOverrideChange(null)}
          >
            Zurücksetzen
          </button>
        ) : null}
      </div>

      <table className="w-full text-xs">
        <thead>
          <tr className="text-muted-foreground">
            <th className="pb-1 text-left font-medium">Kanal</th>
            <th className="pb-1 w-14 text-center font-medium">L</th>
            <th className="pb-1 w-14 text-center font-medium">S</th>
          </tr>
        </thead>
        <tbody>
          {PRIMARY_CHANNELS.map((c) => renderChannelRow(c.key, c.label))}
        </tbody>
      </table>

      <details className="text-xs">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Mehr</summary>
        <div className="mt-2 space-y-2">
          <table className="w-full text-xs">
            <tbody>
              {EXTRA_CHANNELS.map((c) => renderChannelRow(c.key, c.label))}
            </tbody>
          </table>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <label className="flex cursor-pointer items-center gap-1.5">
              <input
                type="checkbox"
                checked={p.effective.product.canCreateGroup}
                onChange={(e) => setProduct('canCreateGroup', e.target.checked)}
              />
              <span>Gruppe</span>
            </label>
            <label className="flex cursor-pointer items-center gap-1.5">
              <input
                type="checkbox"
                checked={p.effective.product.canInviteMembers}
                onChange={(e) => setProduct('canInviteMembers', e.target.checked)}
              />
              <span>Einladen</span>
            </label>
            <label className="flex cursor-pointer items-center gap-1.5">
              <input
                type="checkbox"
                checked={p.effective.product.canExportData}
                onChange={(e) => setProduct('canExportData', e.target.checked)}
              />
              <span>Export</span>
            </label>
            <label className="flex cursor-pointer items-center gap-1.5">
              <input
                type="checkbox"
                checked={p.effective.security.forceEncryptionOnly}
                onChange={(e) => setSecurity('forceEncryptionOnly', e.target.checked)}
              />
              <span>Nur E2EE (Funk)</span>
            </label>
          </div>
        </div>
      </details>
    </div>
  )
}
