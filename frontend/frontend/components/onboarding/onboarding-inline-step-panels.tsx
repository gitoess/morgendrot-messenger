'use client'

import type { ReactNode } from 'react'
import { useState } from 'react'
import { Check, Copy, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ApiStatus } from '@/frontend/lib/api/status'
import { SettingsNetworkProfilesSection } from '@/frontend/components/settings-network-profiles-section'
import { SettingsMyMailboxesSection } from '@/frontend/components/views/settings-my-mailboxes-section'
import { SettingsTelegramIntegration } from '@/frontend/components/views/settings-telegram-integration'
import { SettingsTelegramEinsatzGroup } from '@/frontend/components/views/settings-telegram-einsatz-group'
import { LazyChatViewPulseSettings } from '@/frontend/components/lazy/messenger-scope-b'
import { HandoffProvisionEntry } from '@/frontend/components/handoff-provision-entry'
import { HelperJoinRequestForm } from '@/frontend/components/onboarding/helper-join-request-form'
import { ChatViewPrivateMailboxCreateButton } from '@/frontend/components/chat-view-private-mailbox-create-button'
import { ChatViewTeamMailboxCreateButton } from '@/frontend/components/chat-view-team-mailbox-create-button'
import type { ContactMeshEntryClient } from '@/frontend/lib/api'
import {
  applyBossHandoffLabel,
  applyBossPackageId,
  applyBossServerMailboxId,
  deployBossMovePackage,
  ensureBossRoleOnServer,
} from '@/frontend/lib/onboarding-boss-bootstrap'
import { getStandaloneHelperReadiness } from '@/frontend/lib/handoff-standalone-ready'
import { readLocalHandoffAppliedSnapshot } from '@/frontend/lib/handoff-local-apply'
import { readTelegramInviteFromHandoffExtras } from '@/frontend/lib/handoff-extras'
import { maskWalletAddress } from '@/frontend/lib/contact-phonebook-format'

type PanelProps = {
  apiSnapshot?: ApiStatus | null
  backendOnline?: boolean
  contactDirectory?: Record<string, ContactMeshEntryClient>
  onActivateWallet?: () => void
  onReload?: () => void
  onOpenHandoffImport?: () => void
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

export function OnboardingBossWalletStep(p: PanelProps) {
  const hasWallet = p.apiSnapshot?.hasKeys === true && p.apiSnapshot?.locked !== true
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Als Einsatzleitung brauchst du zuerst ein Wallet auf diesem Gerät — Seed neu anlegen oder importieren.
      </p>
      <StatusRow ok={hasWallet} label="Wallet entsperrt" />
      {!hasWallet ? (
        <Button type="button" onClick={() => p.onActivateWallet?.()}>
          Wallet einrichten
        </Button>
      ) : null}
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
  const [manualId, setManualId] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const runDeploy = async () => {
    setBusy(true)
    setMsg('')
    try {
      const roleR = await ensureBossRoleOnServer()
      if (!roleR.ok) {
        setMsg(roleR.error || 'Rolle setzen fehlgeschlagen.')
        return
      }
      const r = await deployBossMovePackage()
      if (!r.ok) {
        setMsg(r.error || 'Deploy fehlgeschlagen.')
        return
      }
      setMsg(r.message || 'Package deployt.')
      p.onReload?.()
    } finally {
      setBusy(false)
    }
  }

  const runApplyManual = async () => {
    setBusy(true)
    setMsg('')
    try {
      const r = await applyBossPackageId(manualId)
      setMsg(r.ok ? r.message || 'Gespeichert.' : r.error || 'Speichern fehlgeschlagen.')
      if (r.ok) p.onReload?.()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <StatusRow ok={hasPkg} label="Package-ID gesetzt" />
      <StatusRow ok={hasRpc} label="RPC / Netzwerk erreichbar" />
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={busy || !p.backendOnline} onClick={() => void runDeploy()}>
          {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
          Move-Package deployen
        </Button>
      </div>
      <div className="space-y-2">
        <Label htmlFor="boss-pkg-manual" className="text-xs">
          Oder bestehende Package-ID
        </Label>
        <div className="flex flex-wrap gap-2">
          <Input
            id="boss-pkg-manual"
            className="min-w-[12rem] flex-1 font-mono text-xs"
            placeholder="0x…"
            value={manualId}
            onChange={(e) => setManualId(e.target.value)}
          />
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void runApplyManual()}>
            Übernehmen
          </Button>
        </div>
      </div>
      {msg ? <p className="text-xs text-muted-foreground">{msg}</p> : null}
      <SettingsNetworkProfilesSection
        apiStatus={p.apiSnapshot ?? null}
        backendOnline={p.backendOnline === true}
        onApplied={p.onReload}
      />
    </div>
  )
}

export function OnboardingBossServerMailboxStep(p: PanelProps) {
  const hasMb = Boolean(p.apiSnapshot?.mailboxId?.trim())
  const walletValid = p.apiSnapshot?.hasKeys === true && p.apiSnapshot?.locked !== true
  const [msg, setMsg] = useState('')

  return (
    <div className="space-y-4">
      <StatusRow ok={hasMb} label="Server-Postfach-ID konfiguriert" />
      <p className="text-sm text-muted-foreground">
        Private Mailbox on-chain anlegen — wird als Server-MAILBOX_ID übernommen.
      </p>
      <ChatViewPrivateMailboxCreateButton
        walletValid={walletValid}
        onObjectId={(id) => {
          void applyBossServerMailboxId(id).then((r) => {
            setMsg(r.ok ? r.message || 'Postfach gespeichert.' : r.error || 'Speichern fehlgeschlagen.')
            if (r.ok) p.onReload?.()
          })
        }}
        onStatus={(text, kind) => setMsg(kind === 'error' ? text : text)}
      />
      {msg ? <p className="text-xs text-muted-foreground">{msg}</p> : null}
    </div>
  )
}

export function OnboardingBossTeamStep(p: PanelProps) {
  const hasTeam = Boolean(p.apiSnapshot?.handoffLabel?.trim())
  const walletValid = p.apiSnapshot?.hasKeys === true && p.apiSnapshot?.locked !== true
  const [teamName, setTeamName] = useState(p.apiSnapshot?.handoffLabel?.trim() || '')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const saveTeamName = async () => {
    setBusy(true)
    try {
      const r = await applyBossHandoffLabel(teamName)
      setMsg(r.ok ? r.message || 'Gespeichert.' : r.error || 'Speichern fehlgeschlagen.')
      if (r.ok) p.onReload?.()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <StatusRow ok={hasTeam} label="Einsatz-Name gesetzt" />
      <div className="space-y-2">
        <Label htmlFor="boss-team-name" className="text-xs">
          Einsatz-Name (Handoff-Label)
        </Label>
        <div className="flex flex-wrap gap-2">
          <Input
            id="boss-team-name"
            className="min-w-[10rem] flex-1"
            placeholder="z. B. THW Einsatz Alpha"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
          />
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void saveTeamName()}>
            Speichern
          </Button>
        </div>
      </div>
      <ChatViewTeamMailboxCreateButton
        walletValid={walletValid}
        onObjectId={() => setMsg('Team-Mailbox erstellt — ID unter Postfächer teilen.')}
        onStatus={(text, kind) => setMsg(kind === 'error' ? text : text)}
      />
      {msg ? <p className="text-xs text-muted-foreground">{msg}</p> : null}
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
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Helfer per Handoff provisionieren — Schnell-Assistent oder Experten-Panel (dieselbe Export-Pipeline).
      </p>
      <HandoffProvisionEntry
        apiSnapshot={p.apiSnapshot ?? null}
        contactDirectory={p.contactDirectory}
        showTeamOverview={false}
      />
    </div>
  )
}

export function OnboardingHelperHandoffStep(p: PanelProps) {
  const r = getStandaloneHelperReadiness()
  const backendReady = Boolean(p.apiSnapshot?.packageId?.trim() && p.apiSnapshot?.mailboxId?.trim())
  const hasHandoff = r.hasHandoff || backendReady

  return (
    <div className="space-y-4">
      <StatusRow ok={hasHandoff} label="Handoff übernommen (ZIP oder Server)" />
      {!hasHandoff ? (
        <>
          <p className="text-sm text-muted-foreground">
            ZIP vom Boss unter Einstellungen importieren — Package, Mailbox und Netzwerk werden übernommen.
          </p>
          <Button type="button" onClick={() => p.onOpenHandoffImport?.()}>
            Handoff-ZIP importieren
          </Button>
          <details className="rounded-lg border border-border/70 p-3">
            <summary className="cursor-pointer text-sm font-medium">Noch kein ZIP — beim Boss anfragen</summary>
            <div className="mt-3">
              <HelperJoinRequestForm />
            </div>
          </details>
        </>
      ) : (
        <ul className="space-y-1 text-sm">
          <StepRow ok={r.configuredFromHandoff.packageId || backendReady} label="Package-ID" />
          <StepRow ok={r.configuredFromHandoff.mailboxId || backendReady} label="Mailbox-ID" />
          <StepRow ok={r.configuredFromHandoff.rpcUrl || p.backendOnline === true} label="Fullnode / RPC" />
        </ul>
      )}
    </div>
  )
}

function StepRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2">
      <span className={ok ? 'text-emerald-500' : 'text-muted-foreground'} aria-hidden>
        {ok ? <Check className="h-4 w-4" /> : '○'}
      </span>
      <span className={ok ? 'text-foreground' : 'text-muted-foreground'}>{label}</span>
    </li>
  )
}

export function OnboardingHelperTelegramStep() {
  const invite = readTelegramInviteFromHandoffExtras()
  if (!invite) {
    return <p className="text-sm text-muted-foreground">Kein Telegram-Link im Handoff — Schritt überspringen.</p>
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Optional: Alarmgruppe aus dem Handoff.</p>
      <a href={invite} target="_blank" rel="noreferrer" className="text-sm text-primary underline break-all">
        {invite}
      </a>
    </div>
  )
}

export function OnboardingHelperWalletStep(p: PanelProps) {
  const r = getStandaloneHelperReadiness()
  const hasWallet = p.apiSnapshot?.hasKeys === true && p.apiSnapshot?.locked !== true
  const ready = hasWallet || !r.needsMnemonic
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Seed per QR vom Boss scannen oder Mnemonic eingeben.</p>
      <StatusRow ok={ready} label="Wallet aktiv" />
      {!ready ? (
        <Button type="button" onClick={() => p.onActivateWallet?.()}>
          Seed einrichten
        </Button>
      ) : null}
    </div>
  )
}

export function OnboardingHelperTeamSelfStep(p: PanelProps) {
  const handoff = readLocalHandoffAppliedSnapshot()
  const label = handoff?.handoffLabel || p.apiSnapshot?.handoffLabel?.trim()
  return (
    <div className="space-y-3">
      <StatusRow ok={Boolean(label)} label="Einsatz / Team-Name aus Handoff" />
      {label ? <p className="text-sm text-foreground">{label}</p> : null}
      <OnboardingMeshtasticStep {...p} />
    </div>
  )
}

export function OnboardingHelperPeeringStep(p: PanelProps) {
  const handoff = readLocalHandoffAppliedSnapshot()
  const boss = handoff?.bossAddress?.trim() || ''
  return (
    <div className="space-y-3">
      <StatusRow ok={Boolean(boss)} label="Boss / Einsatzleitung verknüpft" />
      {boss ? (
        <p className="font-mono text-xs text-foreground">{maskWalletAddress(boss)}</p>
      ) : (
        <p className="text-sm text-muted-foreground">Boss-Adresse steht im Handoff — nach Import sichtbar.</p>
      )}
    </div>
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
