'use client'

import { useState, useEffect } from 'react'
import { Settings, Copy, Check, KeyRound, Radio, Send, Globe } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import {
  getStatus,
  fetchStatus,
  revealVaultSignerImport,
  type ApiStatus,
} from '@/frontend/lib/api'
import Link from 'next/link'
import { LazyHandoffImportPanel } from '@/frontend/components/lazy/messenger-scope-b'
import { EinsatzEndPanel } from '@/frontend/components/einsatz-end-panel'
import { ActiveProfilePanel } from '@/frontend/components/active-profile-panel'
import { SettingsTelegramIntegration } from '@/frontend/components/views/settings-telegram-integration'
import { SettingsTelegramEinsatzGroup } from '@/frontend/components/views/settings-telegram-einsatz-group'
import { SettingsTelegramAlarmGroupJoin } from '@/frontend/components/views/settings-telegram-alarm-group-join'
import { SettingsTelegramNotifyOnSend } from '@/frontend/components/views/settings-telegram-notify-on-send'
import { SettingsSystemIdentitySection } from '@/frontend/components/views/settings-system-identity-section'
import { SettingsNetworkProfilesSection } from '@/frontend/components/settings-network-profiles-section'
import { SettingsMyMailboxesSection } from '@/frontend/components/views/settings-my-mailboxes-section'
import { SettingsVaultBackupSection } from '@/frontend/components/views/settings-vault-backup-section'
import { SettingsVaultPasswordSection } from '@/frontend/components/views/settings-vault-password-section'
import { SettingsEmergencyPurgeSection } from '@/frontend/components/views/settings-emergency-purge-section'
import { SettingsFunkSection } from '@/frontend/components/views/settings-funk-section'
import { ChatViewShadowSweep } from '@/frontend/components/chat-view-shadow-sweep'
import { SettingsOnboardingSection } from '@/frontend/components/views/settings-onboarding-section'
import { SettingsLanguageSection } from '@/frontend/components/settings-language-section'
import { SettingsAppearanceSection } from '@/frontend/components/settings-appearance-section'
import { SettingsExpertModeSection } from '@/frontend/components/settings-expert-mode-section'
import { CapacitorApiBaseCard } from '@/frontend/components/capacitor-api-base-card'
import { SettingsSectionHeading } from '@/frontend/components/settings-section-heading'
import { useAppTranslation } from '@/frontend/lib/i18n/hooks'

interface SettingsViewProps {
  onOpenConfig?: () => void
  showAllTiles?: boolean
  onShowAllTilesChange?: (value: boolean) => void
  canToggleFullTiles?: boolean
  slimMessengerEinsatz?: boolean
  vaultLocked?: boolean
  onRequestVaultUnlock?: () => void
}

export function SettingsView({
  onOpenConfig,
  showAllTiles = false,
  onShowAllTilesChange,
  canToggleFullTiles = false,
  slimMessengerEinsatz = false,
  vaultLocked = false,
  onRequestVaultUnlock,
}: SettingsViewProps) {
  const { t } = useAppTranslation('dashboard')
  const [status, setStatus] = useState<{
    network: string
    address: string
    packageId: string
    backendOnline: boolean
    chatConnected: boolean
    signer?: string
    vaultHasLocal?: boolean
    role?: string
  } | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [recoveryPw, setRecoveryPw] = useState('')
  const [recoveryBusy, setRecoveryBusy] = useState(false)
  const [recoveryErr, setRecoveryErr] = useState('')
  const [revealedSigner, setRevealedSigner] = useState<string | null>(null)
  const [advancedIotaStatus, setAdvancedIotaStatus] = useState<ApiStatus | null>(null)

  const isBossRole =
    (advancedIotaStatus?.role || status?.role || '').trim().toLowerCase() === 'boss'
  const isKommandant =
    (advancedIotaStatus?.role || status?.role || '').trim().toLowerCase() === 'kommandant'
  const managedNetwork = isBossRole || isKommandant

  const backendOnline =
    status?.backendOnline === true ||
    advancedIotaStatus?.backendRunning === true ||
    advancedIotaStatus?.backendOnline === true

  const loadStatus = async () => {
    const res = await getStatus()
    if (res.ok && res.data) setStatus(res.data)
    const adv = await fetchStatus()
    if ('pollClockHint' in adv) setAdvancedIotaStatus(adv)
    else setAdvancedIotaStatus(null)
  }

  useEffect(() => {
    void loadStatus()
  }, [])

  const handleRevealSignerImport = async () => {
    setRecoveryErr('')
    if (!recoveryPw.trim()) {
      setRecoveryErr('Vault-Passwort eingeben.')
      return
    }
    setRecoveryBusy(true)
    try {
      const res = await revealVaultSignerImport(recoveryPw.trim())
      if (res.ok && res.signerImport) {
        setRevealedSigner(res.signerImport)
        setRecoveryPw('')
      } else {
        setRecoveryErr(res.error || res.message || 'Anzeige fehlgeschlagen.')
      }
    } finally {
      setRecoveryBusy(false)
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <Settings className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">{t('views.settings')}</h2>
          <p className="text-sm text-muted-foreground">
            {slimMessengerEinsatz ? t('settings.subtitleSlim') : t('settings.subtitleDefault')}
          </p>
        </div>
      </div>

      <section className="space-y-4">
        <SettingsSectionHeading
          title="Allgemein"
          description="Sprache, Profil, Gerät und Import — unabhängig vom Sendeweg."
          icon={<Globe className="h-5 w-5" />}
        />
        <SettingsLanguageSection />
        <SettingsOnboardingSection apiStatus={advancedIotaStatus} />
        <SettingsAppearanceSection />
        <SettingsExpertModeSection apiStatus={advancedIotaStatus} />
        <ActiveProfilePanel status={advancedIotaStatus} />
        <CapacitorApiBaseCard />
        {(!slimMessengerEinsatz || !isBossRole) ? (
          <LazyHandoffImportPanel backendOnline={backendOnline} />
        ) : null}
        <EinsatzEndPanel apiStatus={advancedIotaStatus} backendOnline={backendOnline} />
        {canToggleFullTiles && onShowAllTilesChange ? (
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h4 className="font-semibold text-foreground">Volle Oberfläche</h4>
                <p className="mt-1 text-sm text-muted-foreground">
                  Alle Funktions-Kacheln anzeigen — wird in diesem Browser gespeichert.
                </p>
              </div>
              <Switch checked={showAllTiles} onCheckedChange={onShowAllTilesChange} aria-label="Alle Kacheln anzeigen" />
            </div>
          </div>
        ) : null}
      </section>

      <section className="space-y-4">
        <SettingsSectionHeading
          title="IOTA (Online / Chain)"
          description="Netzwerk, Package, Mailbox, Tresor sichern/laden — Testnet/Mainnet wird automatisch aus Deploy-Dateien übernommen."
          icon={<Send className="h-5 w-5" />}
        />
        {managedNetwork ? (
          <SettingsNetworkProfilesSection
            apiStatus={advancedIotaStatus}
            backendOnline={backendOnline}
            onApplied={() => void loadStatus()}
          />
        ) : null}
        <SettingsSystemIdentitySection
          apiStatus={advancedIotaStatus}
          managedNetwork={managedNetwork}
          vaultLocked={vaultLocked}
          onRequestVaultUnlock={onRequestVaultUnlock}
          onApplied={() => void loadStatus()}
        />
        <SettingsVaultPasswordSection vaultLocked={vaultLocked} />
        <SettingsVaultBackupSection vaultLocked={vaultLocked} onRequestVaultUnlock={onRequestVaultUnlock} />
        <SettingsMyMailboxesSection
          apiStatus={advancedIotaStatus}
          myAddress={
            (advancedIotaStatus?.myAddressFull || advancedIotaStatus?.myAddress || status?.address || '').trim()
          }
        />
        {backendOnline ? (
          <div className="rounded-xl border border-border bg-card p-4">
            <ChatViewShadowSweep />
          </div>
        ) : null}
        {!slimMessengerEinsatz && status?.backendOnline && status.signer === 'sdk' ? (
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <KeyRound className="h-5 w-5" aria-hidden />
              </div>
              <div>
                <h4 className="font-semibold text-foreground">Wallet-Recovery (SIGNER=sdk)</h4>
                <p className="text-sm text-muted-foreground">Signer-Import aus der Vault-Datei anzeigen.</p>
              </div>
            </div>
            {!status.vaultHasLocal ? (
              <p className="mb-3 text-sm text-muted-foreground">Keine lokale Vault-Datei — zuerst unter „Lokal sichern“.</p>
            ) : null}
            <div className="space-y-3">
              <label className="block text-sm">
                <span className="text-muted-foreground">Vault-Passwort</span>
                <input
                  type="password"
                  autoComplete="off"
                  value={recoveryPw}
                  onChange={(e) => setRecoveryPw(e.target.value)}
                  className="mt-1 w-full max-w-md rounded-lg border border-border bg-input px-3 py-2"
                />
              </label>
              {recoveryErr ? <p className="text-sm text-destructive">{recoveryErr}</p> : null}
              <button
                type="button"
                disabled={recoveryBusy || !status.vaultHasLocal}
                onClick={() => void handleRevealSignerImport()}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {recoveryBusy ? 'Lade…' : 'Recovery / Signer-Import anzeigen'}
              </button>
              {revealedSigner ? (
                <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all rounded border border-border bg-muted/50 p-3 font-mono text-xs">
                  {revealedSigner}
                </pre>
              ) : null}
              {revealedSigner ? (
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(revealedSigner)
                    setCopied('signerImport')
                    setTimeout(() => setCopied(null), 2000)
                  }}
                  className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  {copied === 'signerImport' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  Kopieren
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>

      <section className="space-y-4">
        <SettingsSectionHeading
          title="Funk (Meshtastic)"
          description="Puls, Heartbeat und Funk-Geräte — getrennt von IOTA/Online."
          icon={<Radio className="h-5 w-5" />}
        />
        <SettingsFunkSection apiStatus={advancedIotaStatus} managedNetwork={managedNetwork} />
      </section>

      <section className="space-y-4">
        <SettingsSectionHeading
          title="Telegram"
          description="Bot, Relay und Benachrichtigung beim Senden — nur für den Telegram-Sendeweg im Chat."
        />
        <SettingsTelegramNotifyOnSend />
        <SettingsTelegramAlarmGroupJoin backendOnline={backendOnline} />
        <SettingsTelegramEinsatzGroup
          backendOnline={backendOnline}
          apiStatus={advancedIotaStatus}
          isBossRole={isBossRole || isKommandant}
        />
        <SettingsTelegramIntegration backendOnline={backendOnline} />
      </section>

      <section className="space-y-4">
        <SettingsSectionHeading title="Sicherheit & Notfall" description="Unwiderrufliche Chain-Löschung und Sitzung sperren." />
        <SettingsEmergencyPurgeSection />
      </section>

      {onOpenConfig ? (
        <p className="text-xs text-muted-foreground">
          Erweiterte .env-Konfiguration:{' '}
          <button type="button" className="text-primary underline" onClick={onOpenConfig}>
            Konfiguration öffnen
          </button>
        </p>
      ) : null}
    </div>
  )
}
