'use client'

import type { ReactNode } from 'react'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ApiStatus } from '@/frontend/lib/api/status'
import { SettingsNetworkProfilesSection } from '@/frontend/components/settings-network-profiles-section'
import { SettingsSystemIdentitySection } from '@/frontend/components/views/settings-system-identity-section'
import { SettingsMyMailboxesSection } from '@/frontend/components/views/settings-my-mailboxes-section'
import { SettingsTelegramIntegration } from '@/frontend/components/views/settings-telegram-integration'
import { SettingsTelegramEinsatzGroup } from '@/frontend/components/views/settings-telegram-einsatz-group'
import { LazyChatViewPulseSettings } from '@/frontend/components/lazy/messenger-scope-b'
import { BossHandoffExportPanel } from '@/frontend/components/boss-handoff-export-panel'
import type { ContactMeshEntryClient } from '@/frontend/lib/api'

type PanelProps = {
  apiSnapshot?: ApiStatus | null
  backendOnline?: boolean
  contactDirectory?: Record<string, ContactMeshEntryClient>
  onActivateWallet?: () => void
  onReload?: () => void
}

function StatusRow(p: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span
        className={p.ok ? 'text-emerald-500' : 'text-muted-foreground'}
        aria-hidden
      >
        {p.ok ? <Check className="h-4 w-4" /> : '○'}
      </span>
      <span className={p.ok ? 'text-foreground' : 'text-muted-foreground'}>{p.label}</span>
    </div>
  )
}

function AddressBlock(p: { address: string }) {
  const addr = p.address.trim()
  if (!addr) {
    return <p className="text-sm text-amber-600 dark:text-amber-400">Noch keine IOTA-Adresse — Wallet entsperren oder Handoff importieren.</p>
  }
  return (
    <div className="space-y-2">
      <p className="break-all font-mono text-xs text-foreground">{addr}</p>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => void navigator.clipboard.writeText(addr)}
      >
        <Copy className="mr-1.5 h-3.5 w-3.5" />
        Kopieren
      </Button>
    </div>
  )
}

export function OnboardingBossAddressStep(p: PanelProps) {
  const addr = (p.apiSnapshot?.myAddressFull || p.apiSnapshot?.myAddress || '').trim()
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Deine IOTA-Adresse bestätigen — sie identifiziert dieses Gerät auf der Chain.</p>
      <AddressBlock address={addr} />
      <StatusRow ok={Boolean(addr)} label="Adresse vorhanden" />
    </div>
  )
}

export function OnboardingBossPackageStep(p: PanelProps) {
  const hasPkg = Boolean(p.apiSnapshot?.packageId?.trim())
  const hasRpc = Boolean(p.apiSnapshot?.rpcUrlLabel?.trim())
  return (
    <div className="space-y-4">
      <StatusRow ok={hasPkg} label="Package-ID gesetzt" />
      <StatusRow ok={hasRpc} label="RPC / Netzwerk erreichbar" />
      <SettingsNetworkProfilesSection
        apiStatus={p.apiSnapshot ?? null}
        backendOnline={p.backendOnline === true}
        onApplied={p.onReload}
      />
      <SettingsSystemIdentitySection
        apiStatus={p.apiSnapshot ?? null}
        managedNetwork
        vaultLocked={false}
        onApplied={p.onReload}
      />
    </div>
  )
}

export function OnboardingBossServerMailboxStep(p: PanelProps) {
  const hasMb = Boolean(p.apiSnapshot?.mailboxId?.trim())
  return (
    <div className="space-y-4">
      <StatusRow ok={hasMb} label="Server-Postfach-ID konfiguriert" />
      <SettingsMyMailboxesSection
        apiStatus={p.apiSnapshot ?? null}
        myAddress={(p.apiSnapshot?.myAddressFull || p.apiSnapshot?.myAddress || '').trim()}
      />
    </div>
  )
}

export function OnboardingBossTeamStep(p: PanelProps) {
  const hasTeam = Boolean(p.apiSnapshot?.handoffLabel?.trim())
  return (
    <div className="space-y-3">
      <StatusRow ok={hasTeam} label="Team-Name / Handoff-Label" />
      <p className="text-sm text-muted-foreground">
        Team-Mailbox unter Postfächer anlegen oder Helfer per Handoff provisionieren.
      </p>
      <SettingsMyMailboxesSection
        apiStatus={p.apiSnapshot ?? null}
        myAddress={(p.apiSnapshot?.myAddressFull || p.apiSnapshot?.myAddress || '').trim()}
      />
    </div>
  )
}

export function OnboardingBossTelegramBotStep(p: PanelProps) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Bot-Token und deine Admin-Chat-ID für Alarme und Tests.</p>
      <SettingsTelegramIntegration backendOnline={p.backendOnline === true} />
    </div>
  )
}

export function OnboardingBossTelegramGroupStep(p: PanelProps) {
  const isBoss = ['boss', 'kommandant'].includes((p.apiSnapshot?.role || '').toLowerCase())
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Einsatz-Alarmgruppe: Einladungslink und Gruppen-Chat-ID für Fan-out.</p>
      <SettingsTelegramEinsatzGroup
        backendOnline={p.backendOnline === true}
        apiStatus={p.apiSnapshot ?? null}
        isBossRole={isBoss}
      />
    </div>
  )
}

export function OnboardingMeshtasticStep(p: PanelProps) {
  if (!p.apiSnapshot) return null
  return (
    <LazyChatViewPulseSettings
      apiStatus={p.apiSnapshot ?? null}
      allowDevExpertTools={false}
      settingsEmbedded
      networkManaged={false}
    />
  )
}

export function OnboardingBossHelpersStep(p: PanelProps) {
  return (
    <BossHandoffExportPanel
      apiSnapshot={p.apiSnapshot ?? null}
      contactDirectory={p.contactDirectory}
      embedded
      layout="compact"
    />
  )
}

export function OnboardingWandererWalletStep(p: PanelProps) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Wallet anlegen oder Seed importieren — Keys bleiben auf diesem Gerät.</p>
      <Button type="button" onClick={() => p.onActivateWallet?.()}>
        Wallet einrichten
      </Button>
    </div>
  )
}

export function OnboardingWandererAddressStep(p: PanelProps) {
  const addr = (p.apiSnapshot?.myAddressFull || p.apiSnapshot?.myAddress || '').trim()
  return (
    <div className="space-y-3">
      <AddressBlock address={addr} />
      <StatusRow ok={Boolean(addr)} label="Adresse bestätigt" />
    </div>
  )
}

export function OnboardingWandererMailboxStep(p: PanelProps) {
  return (
    <SettingsMyMailboxesSection
      apiStatus={p.apiSnapshot ?? null}
      myAddress={(p.apiSnapshot?.myAddressFull || p.apiSnapshot?.myAddress || '').trim()}
    />
  )
}

export function OnboardingDoneStep(p: { children?: ReactNode }) {
  return (
    <div className="space-y-3 text-sm text-muted-foreground">
      <p className="font-medium text-foreground">Einrichtung abgeschlossen.</p>
      <ul className="list-inside list-disc space-y-1">
        <li>Dashboard und Nachrichten nutzen</li>
        <li>Einstellungen → Wizard jederzeit fortsetzen</li>
      </ul>
      {p.children}
    </div>
  )
}
