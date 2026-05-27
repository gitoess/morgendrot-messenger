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
  { key: 'lora', label: 'LoRa / Funk' },
  { key: 'telegram', label: 'Telegram' },
  { key: 'iota', label: 'IOTA / Chain' },
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
}

export function HandoffCapabilitiesMatrixPicker(p: HandoffCapabilitiesMatrixPickerProps) {
  const hasOverride = p.capabilitiesOverride != null

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

  const setSecurity = (
    key: keyof MessengerCapabilitiesMatrix['security'],
    checked: boolean
  ) => {
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
        <td className="py-2 pr-2 font-medium text-foreground">{label}</td>
        <td className="py-2 text-center">
          <input
            type="checkbox"
            aria-label={`${label} lesen`}
            checked={access.read}
            onChange={(e) => setTransport(channel, { read: e.target.checked })}
          />
        </td>
        <td className="py-2 text-center">
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
    <div className={cn('space-y-3 rounded-lg border border-emerald-600/25 bg-emerald-950/10 p-3', p.className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          <strong className="text-foreground">Capabilities</strong> — landen in{' '}
          <span className="font-mono">.morgendrot-runtime-config.json</span> (Transport getrennt von S-Bit).
        </p>
        {hasOverride ? (
          <button
            type="button"
            className="text-[11px] font-medium text-emerald-400 hover:text-emerald-300"
            onClick={() => p.onCapabilitiesOverrideChange(null)}
          >
            Capabilities zurücksetzen
          </button>
        ) : (
          <span className="text-[11px] text-muted-foreground">Standard aus ROLE_ID + Profil</span>
        )}
      </div>

      <div>
        <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Einsatz-Schnellprofile
        </p>
        <div className="flex flex-wrap gap-1.5">
          {HANDOFF_CAPABILITY_PRESETS.map((quick) => (
            <button
              key={quick.id}
              type="button"
              title={quick.hint}
              onClick={() => p.onApplyCapabilityPreset(quick)}
              className="rounded-md border border-emerald-500/40 bg-emerald-500/15 px-2 py-1 text-[11px] font-medium text-foreground hover:bg-emerald-500/25"
            >
              {quick.label}
            </button>
          ))}
        </div>
      </div>

      <table className="w-full text-[11px]">
        <thead>
          <tr className="text-muted-foreground">
            <th className="pb-1 text-left font-medium">Transport</th>
            <th className="pb-1 text-center font-medium w-16">Lesen</th>
            <th className="pb-1 text-center font-medium w-16">Schreiben</th>
          </tr>
        </thead>
        <tbody>
          {PRIMARY_CHANNELS.map((c) => renderChannelRow(c.key, c.label))}
        </tbody>
      </table>

      <details className="text-[11px]">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
          Weitere Kanäle & Produkt
        </summary>
        <div className="mt-2 space-y-3">
          <table className="w-full text-[11px]">
            <tbody>
              {EXTRA_CHANNELS.map((c) => renderChannelRow(c.key, c.label))}
            </tbody>
          </table>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={p.effective.product.canCreateGroup}
                onChange={(e) => setProduct('canCreateGroup', e.target.checked)}
              />
              <span>Gruppe erstellen</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={p.effective.product.canInviteMembers}
                onChange={(e) => setProduct('canInviteMembers', e.target.checked)}
              />
              <span>Mitglieder einladen</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={p.effective.product.canExportData}
                onChange={(e) => setProduct('canExportData', e.target.checked)}
              />
              <span>Daten exportieren</span>
            </label>
          </div>
          <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1.5">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={p.effective.security.forceEncryptionOnly}
              onChange={(e) => setSecurity('forceEncryptionOnly', e.target.checked)}
            />
            <span>
              <span className="font-medium text-foreground">Nur verschlüsselt senden (Funk)</span>
              <span className="mt-0.5 block text-[10px] text-muted-foreground">
                Kein Klartext-LongFast — Team-PSK / E2EE erzwingen (Phase 4 Backend).
              </span>
            </span>
          </label>
        </div>
      </details>

      {p.effective.transport.lora.write && !p.effective.transport.iota.write ? (
        <p className="text-[10px] text-emerald-100/90">
          Typisch Medic-Funker: Funk schreiben, IOTA-Kanal gesperrt — S-Bit kann trotzdem aus sein (Chain send).
        </p>
      ) : null}
    </div>
  )
}
