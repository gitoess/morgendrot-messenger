'use client'

import type { ReactNode } from 'react'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, Copy, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ApiStatus } from '@/frontend/lib/api/status'
import { SettingsMyMailboxesSection } from '@/frontend/components/views/settings-my-mailboxes-section'
import { OnboardingBossTelegramStep } from '@/frontend/components/onboarding/onboarding-boss-telegram-step'
import { OnboardingBossMailboxesStep } from '@/frontend/components/onboarding/onboarding-boss-mailboxes-step'
import { OnboardingFunkStep } from '@/frontend/components/onboarding/onboarding-funk-step'
import { HandoffImportPanel } from '@/frontend/components/handoff-import-panel'
import { HelperJoinRequestForm } from '@/frontend/components/onboarding/helper-join-request-form'
import { BossRegistryBootstrapPanel } from '@/frontend/components/boss-registry-bootstrap-panel'
import { BossWalletGasFundingPanel } from '@/frontend/components/onboarding/boss-wallet-gas-funding-panel'
import {
  BossNetworkDeployIdsPanel,
  buildBossDeployIdExtrasFromApi,
} from '@/frontend/components/onboarding/boss-network-deploy-ids-panel'
import { resolveBossWizardDeployNetwork } from '@/frontend/lib/boss-wizard-package-context'
import {
  getBossMainnetWizardStatus,
  NETWORK_SETUP_PLAN_OPTIONS,
  readBossWizardNetworkSetupPlan,
  syncBossWizardNetworkProfiles,
} from '@/frontend/lib/boss-wizard-network-plan'
import { postDeployMainnetPackage } from '@/frontend/lib/api/einsatz-config'
import { DEFAULT_MAINNET_RPC_URL } from '@morgendrot/shared/einsatz-chain-mode'
import {
  applyActiveNetworkProfile,
  applyBossWizardNetworkSetupPlan,
  EINSATZ_NETWORK_PROFILES_CHANGED,
  notifyNetworkProfilesChanged,
  readNetworkProfilesState,
  type EinsatzNetworkSetupPlan,
  writeNetworkProfilesState,
} from '@/frontend/lib/einsatz-network-profiles'
import { cn } from '@/lib/utils'
import { postApplyEinsatzConfig } from '@/frontend/lib/api/einsatz-config'
import type { ContactMeshEntryClient } from '@/frontend/lib/api'
import {
  applyBossPackageId,
  deployBossMovePackage,
  ensureBossRoleOnServer,
  applyBossMainnetPackageId,
} from '@/frontend/lib/onboarding-boss-bootstrap'
import { getStandaloneHelperReadiness } from '@/frontend/lib/handoff-standalone-ready'
import { isBrowserSessionSignerReady } from '@/frontend/lib/messenger-session-keys-ready'
import { buildBossOnboardingRuntime } from '@/frontend/lib/onboarding-boss-runtime'
import { readLocalHandoffAppliedSnapshot } from '@/frontend/lib/handoff-local-apply'
import { readTelegramInviteFromHandoffExtras } from '@/frontend/lib/handoff-extras'
import { primeSettingsCategory } from '@/frontend/lib/settings-navigation'
import { maskWalletAddress } from '@/frontend/lib/contact-phonebook-format'
import { toast } from 'sonner'

type PanelProps = {
  apiSnapshot?: ApiStatus | null
  backendOnline?: boolean
  contactDirectory?: Record<string, ContactMeshEntryClient>
  sessionLocked?: boolean
  /** Dashboard-Sitzung — gleiche Adresse wie im Header. */
  fallbackMyAddress?: string | null
  onActivateWallet?: () => void
  onReload?: () => void
  onOpenHandoffImport?: () => void
  onRegisterBeforeAdvance?: (fn: (() => Promise<boolean>) | null) => void
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

function bossRuntime(p: PanelProps) {
  return buildBossOnboardingRuntime(p.apiSnapshot, p.sessionLocked ?? false, p.fallbackMyAddress)
}

export function OnboardingBossWalletStep(p: PanelProps) {
  const rt = bossRuntime(p)
  const label = rt.browserWalletReady
    ? 'Wallet bereit (Browser-Sitzung)'
    : rt.needsNewWallet
      ? 'Wallet fehlt — neu anlegen oder importieren'
      : p.apiSnapshot?.hasKeys === true && p.apiSnapshot?.locked !== true
        ? 'Server-Tresor offen — Browser-Signer fehlt noch'
        : 'Server-Wallet vorhanden — Tresor noch entsperren'
  const actionLabel =
    rt.needsNewWallet
      ? 'Wallet einrichten'
      : p.apiSnapshot?.hasKeys === true && p.apiSnapshot?.locked !== true
        ? 'Session-Signer laden'
        : 'Tresor entsperren'
  return (
    <div className="space-y-3">
      <StatusRow ok={rt.browserWalletReady} label={label} />
      {rt.displayAddress && !rt.browserWalletReady ? (
        <p className="text-xs text-muted-foreground">
          Adresse auf dem Server:{' '}
          <span className="font-mono text-foreground/90">{maskWalletAddress(rt.displayAddress)}</span>
        </p>
      ) : null}
      {!rt.browserWalletReady ? (
        <Button type="button" className="w-full sm:w-auto" onClick={() => p.onActivateWallet?.()}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  )
}

export function OnboardingBossAddressStep(p: PanelProps) {
  const rt = bossRuntime(p)
  const addr = rt.displayAddress
  return (
    <div className="space-y-3">
      <AddressBlock address={addr} />
      <StatusRow ok={Boolean(addr)} label={addr ? 'Adresse bestätigt' : 'Adresse fehlt'} />
      {addr && !rt.browserWalletReady ? (
        <p className="text-xs text-muted-foreground">
          {rt.addressFromServer
            ? 'Dieselbe Adresse wie im Header (Server) — Tresor entsperren, um hier zu signieren.'
            : 'Adresse sichtbar — Tresor entsperren für Signieren in diesem Browser.'}
        </p>
      ) : null}
    </div>
  )
}

export function OnboardingBossNetworkPlanStep(p: PanelProps) {
  const [plan, setPlan] = useState<EinsatzNetworkSetupPlan>(() => readBossWizardNetworkSetupPlan())
  const [chosen, setChosen] = useState(() => readNetworkProfilesState().setupPlanChosen === true)

  const pick = (id: EinsatzNetworkSetupPlan) => {
    applyBossWizardNetworkSetupPlan(id)
    setPlan(id)
    setChosen(true)
    const label = NETWORK_SETUP_PLAN_OPTIONS.find((o) => o.id === id)?.title ?? id
    toast.success(`${label} — gespeichert.`)
  }

  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-muted-foreground">
        Wähle, <strong className="font-medium text-foreground">wo du normalerweise sendest</strong> und ob du
        Testnet und Mainnet einrichten willst. Das kannst du später unter{' '}
        <span className="text-foreground/90">Einstellungen → Wo senden?</span> wechseln.
      </p>

      <div className="space-y-2">
        {NETWORK_SETUP_PLAN_OPTIONS.map((opt) => {
          const active = chosen && plan === opt.id
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => pick(opt.id)}
              className={cn(
                'w-full rounded-lg border p-3 text-left transition-colors',
                active
                  ? 'border-primary bg-primary/5 ring-1 ring-primary/25'
                  : 'border-border hover:border-primary/35 hover:bg-muted/40'
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-foreground">{opt.title}</p>
                  <p className="text-xs text-muted-foreground">{opt.subtitle}</p>
                </div>
                {active ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden /> : null}
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{opt.detail}</p>
            </button>
          )
        })}
      </div>

      {!chosen ? (
        <p className="text-xs text-amber-800 dark:text-amber-200">
          Bitte eine Option wählen — dann mit <strong>Weiter</strong>.
        </p>
      ) : (
        <p className="text-xs text-emerald-800 dark:text-emerald-200">
          Gespeichert — im nächsten Schritt richtest du Aufbewahrung und Chain-Anbindung passend ein.
        </p>
      )}
    </div>
  )
}

export function OnboardingBossEinsatzRulesStep(p: PanelProps) {
  const cfg = p.apiSnapshot?.einsatzConfig
  const edition = cfg?.editionLabel?.trim() || 'Morgendrot-Standard (Purge + Rebate)'
  const [ttlDays, setTtlDays] = useState(30)
  const [enablePurge, setEnablePurge] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const ttl = cfg?.defaultTtlDays
    if (ttl != null && Number.isFinite(ttl)) setTtlDays(Math.floor(ttl))
    if (cfg?.enablePurge != null) setEnablePurge(cfg.enablePurge !== false)
  }, [cfg?.defaultTtlDays, cfg?.enablePurge])

  const saveRules = useCallback(async (): Promise<boolean> => {
    if (!p.backendOnline) {
      setMsg('Boss-Server nicht erreichbar — Regeln werden beim Speichern auf dem PC hinterlegt.')
      return true
    }
    setBusy(true)
    setMsg('')
    const r = await postApplyEinsatzConfig({ defaultTtlDays: ttlDays, enablePurge })
    setBusy(false)
    if (!r.ok) {
      setMsg(r.error || 'Speichern fehlgeschlagen.')
      toast.error(r.error || 'Speichern fehlgeschlagen.')
      return false
    }
    setSaved(true)
    setMsg('Einsatz-Regeln gespeichert — gelten für Server und künftige Helfer-Handoffs.')
    toast.success('Einsatz-Regeln gespeichert.')
    p.onReload?.()
    return true
  }, [enablePurge, p.backendOnline, p.onReload, ttlDays])

  useEffect(() => {
    p.onRegisterBeforeAdvance?.(async () => saveRules())
    return () => p.onRegisterBeforeAdvance?.(null)
  }, [p.onRegisterBeforeAdvance, saveRules])

  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-muted-foreground">
        Hier legst du fest, <strong className="font-medium text-foreground">wie lange Nachrichten bleiben</strong> und
        ob alte Einträge gelöscht werden dürfen. Das änderst du jederzeit —{' '}
        <strong className="font-medium text-foreground">ohne neuen Contract</strong>.
      </p>
      <p className="text-xs text-muted-foreground">
        Fest im Blockchain-Programm ({edition}): wer Nachrichten speichern darf und welche Sicherheitsregeln gelten —{' '}
        <Link href="/handbook?file=MOVE-MESSENGER-KONFIGURATION.md" className="text-primary underline-offset-2 hover:underline">
          Kurzüberblick im Handbuch
        </Link>
        .
      </p>

      <div className="grid gap-3 sm:grid-cols-[auto_1fr] sm:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="boss-wizard-ttl" className="text-xs">
            Aufbewahrung (Tage)
          </Label>
          <Input
            id="boss-wizard-ttl"
            type="number"
            min={0}
            max={3650}
            className="w-24 font-mono text-sm"
            value={ttlDays}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10)
              setTtlDays(Number.isFinite(n) ? Math.max(0, Math.min(3650, n)) : 0)
              setSaved(false)
            }}
          />
        </div>
        <div className="flex flex-wrap gap-2 pb-0.5">
          {[7, 30, 90].map((d) => (
            <Button
              key={d}
              type="button"
              size="sm"
              variant={ttlDays === d ? 'secondary' : 'outline'}
              onClick={() => {
                setTtlDays(d)
                setSaved(false)
              }}
            >
              {d} Tage
            </Button>
          ))}
        </div>
      </div>

      <label className="flex cursor-pointer items-start gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={enablePurge}
          onChange={(e) => {
            setEnablePurge(e.target.checked)
            setSaved(false)
          }}
        />
        <span>
          Alte Nachrichten auf der Chain löschen dürfen{' '}
          <span className="text-xs">(empfohlen — spart Speicher und Kosten)</span>
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-2">
        {busy ? (
          <span className="inline-flex items-center text-xs text-muted-foreground">
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            Speichern…
          </span>
        ) : saved ? (
          <StatusRow ok={true} label="Gespeichert" />
        ) : (
          <p className="text-xs text-muted-foreground">
            Mit <strong className="font-medium text-foreground">Weiter</strong> werden die Regeln übernommen.
          </p>
        )}
      </div>

      {!p.backendOnline ? (
        <p className="text-xs text-amber-800 dark:text-amber-200">
          Ohne laufenden Boss-Server kannst du die Werte trotzdem wählen — Speichern erst wenn die Basis läuft.
        </p>
      ) : null}
      {msg ? <p className="text-xs text-muted-foreground">{msg}</p> : null}
    </div>
  )
}

export function OnboardingBossChainStep(p: PanelProps) {
  const plan = readBossWizardNetworkSetupPlan()
  const hasTestnetPkg = Boolean(p.apiSnapshot?.packageId?.trim())
  const net = resolveBossWizardDeployNetwork(p.apiSnapshot)
  const pkgMasked = maskWalletAddress(p.apiSnapshot?.packageId || '')
  const [profileState, setProfileState] = useState(() => syncBossWizardNetworkProfiles(p.apiSnapshot))
  const mainnetStatus = getBossMainnetWizardStatus(p.apiSnapshot)
  const mainnetSendReady = mainnetStatus.sendReady
  const mainnetAnchorReady = mainnetStatus.anchorReady
  const mainnetConfigured = mainnetSendReady || mainnetAnchorReady
  const [manualId, setManualId] = useState('')
  const [manualMainnetId, setManualMainnetId] = useState('')
  const [busy, setBusy] = useState<'testnet' | 'mainnet' | 'manual' | 'manual-mainnet' | null>(null)
  const [msg, setMsg] = useState('')
  const [withGlobals, setWithGlobals] = useState(true)

  const senderAddress =
    p.apiSnapshot?.myAddressFull?.trim() || p.apiSnapshot?.myAddress?.trim() || undefined

  useEffect(() => {
    const refresh = () => {
      const synced = syncBossWizardNetworkProfiles(p.apiSnapshot)
      setProfileState(synced)
      const prev = readNetworkProfilesState()
      if (
        synced.mainnet.packageId !== prev.mainnet.packageId ||
        synced.mainnet.rpcUrl !== prev.mainnet.rpcUrl
      ) {
        writeNetworkProfilesState(synced)
      }
    }
    refresh()
    window.addEventListener(EINSATZ_NETWORK_PROFILES_CHANGED, refresh)
    return () => window.removeEventListener(EINSATZ_NETWORK_PROFILES_CHANGED, refresh)
  }, [p.apiSnapshot?.packageId, p.apiSnapshot?.einsatzConfig?.mainnetPackageId, p.apiSnapshot?.einsatzConfig?.mainnetRpcUrl])

  useEffect(() => {
    const fromApi = p.apiSnapshot?.einsatzConfig?.mainnetPackageId?.trim()
    const fromProfile = profileState.mainnet.packageId?.trim()
    if (fromApi) setManualMainnetId(fromApi)
    else if (fromProfile) setManualMainnetId(fromProfile)
  }, [p.apiSnapshot?.einsatzConfig?.mainnetPackageId, profileState.mainnet.packageId])

  const showTestnet = plan !== 'mainnet-only'
  const showMainnet = plan === 'mainnet-only' || plan === 'both'
  const testnetDone = hasTestnetPkg
  const chainReady = plan === 'mainnet-only' ? mainnetConfigured : testnetDone

  const runTestnetDeploy = async () => {
    setBusy('testnet')
    setMsg('')
    try {
      const roleR = await ensureBossRoleOnServer()
      if (!roleR.ok) {
        setMsg(roleR.error || 'Rolle setzen fehlgeschlagen.')
        return
      }
      const r = await deployBossMovePackage({
        createGlobals: withGlobals,
        forceGlobals: false,
      })
      if (!r.ok) {
        const err = r.error || 'Anlegen fehlgeschlagen.'
        setMsg(err)
        toast.error(err)
        return
      }
      const okMsg = r.message || `Messenger-Contract auf ${net.label} angelegt.`
      setMsg(okMsg)
      toast.success(okMsg)
      p.onReload?.()
    } finally {
      setBusy(null)
    }
  }

  const runMainnetDeploy = async () => {
    if (
      typeof window !== 'undefined' &&
      !window.confirm(
        'Move auf Mainnet deployen?\n\nErzeugt neues Package + Postfach auf Mainnet (Gas nötig). Testnet-IDs bleiben unverändert. Dauert einige Minuten.'
      )
    ) {
      return
    }
    setBusy('mainnet')
    setMsg('Mainnet-Deploy läuft — bitte warten (kann 2–5 Min. dauern)…')
    try {
      const rpcUrl = profileState.mainnet.rpcUrl.trim() || DEFAULT_MAINNET_RPC_URL
      const out = await postDeployMainnetPackage({ rpcUrl })
      if (!out.ok) {
        setMsg(out.error)
        toast.error(out.error)
        return
      }
      const next = {
        ...profileState,
        active: plan === 'mainnet-only' ? ('mainnet' as const) : profileState.active,
        mainnet: {
          rpcUrl: out.mainnetRpcUrl || rpcUrl,
          packageId: out.packageId,
          mailboxId: out.mailboxId || profileState.mainnet.mailboxId,
        },
      }
      setProfileState(next)
      writeNetworkProfilesState(next)
      notifyNetworkProfilesChanged()
      const apply = await applyActiveNetworkProfile({
        state: next,
        backendOnline: p.backendOnline,
        senderAddress,
      })
      if (!apply.ok) {
        const text = `${out.message || 'Deploy OK.'} Profil speichern: ${apply.error}`
        setMsg(text)
        toast.error(text)
        return
      }
      const okMsg = out.mailboxId
        ? 'Mainnet — Package + Postfach angelegt.'
        : 'Mainnet-Package deployt — Postfach fehlt (create_globals prüfen).'
      setMsg(okMsg)
      toast.success(okMsg)
      p.onReload?.()
    } catch (e) {
      const text = e instanceof Error ? e.message : String(e)
      setMsg(text)
      toast.error(text)
    } finally {
      setBusy(null)
    }
  }

  const runApplyManual = async () => {
    setBusy('manual')
    setMsg('')
    try {
      const r = await applyBossPackageId(manualId)
      const text = r.ok ? r.message || 'Testnet Package-ID gespeichert.' : r.error || 'Speichern fehlgeschlagen.'
      setMsg(text)
      if (r.ok) toast.success(text)
      else toast.error(text)
      if (r.ok) p.onReload?.()
    } finally {
      setBusy(null)
    }
  }

  const runApplyManualMainnet = async () => {
    setBusy('manual-mainnet')
    setMsg('')
    try {
      const r = await applyBossMainnetPackageId(manualMainnetId)
      const text = r.ok ? r.message || 'Mainnet Package-ID gespeichert.' : r.error || 'Speichern fehlgeschlagen.'
      setMsg(text)
      if (r.ok) toast.success(text)
      else toast.error(text)
      if (r.ok) {
        setProfileState((prev) => ({
          ...prev,
          mainnet: { ...prev.mainnet, packageId: manualMainnetId.trim() },
        }))
        p.onReload?.()
      }
    } finally {
      setBusy(null)
    }
  }

  const planHint =
    plan === 'both'
      ? 'Zuerst Testnet zum kostenlosen Schreiben — Mainnet optional für Verankerung.'
      : plan === 'mainnet-only'
        ? 'Du hast Produktion (Mainnet) gewählt — hier wird der Contract auf Mainnet angelegt.'
        : 'Du hast Übung (Testnet) gewählt — kostenlos testen und schreiben.'

  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-muted-foreground">
        Hier verbindest du den Messenger mit der Blockchain. Ein Klick legt den{' '}
        <strong className="font-medium text-foreground">Morgendrot-Standard-Contract</strong> an — du brauchst keinen
        eigenen Code.
      </p>
      <p className="text-xs text-muted-foreground">{planHint}</p>

      {showTestnet ? (
        <div className="space-y-3 rounded-md border border-sky-500/35 bg-sky-500/10 px-3 py-2.5">
          <p className="text-sm font-medium text-foreground">Übung (Testnet)</p>
          <p className="font-mono text-xs text-muted-foreground">{net.rpcHint}</p>
          <StatusRow
            ok={testnetDone}
            label={
              testnetDone
                ? `Verbunden${pkgMasked ? ` (${pkgMasked})` : ''}`
                : 'Noch nicht mit Testnet verbunden'
            }
          />
          {!testnetDone ? (
            <p className="text-xs text-muted-foreground">
              Normal vor dem ersten Anlegen — verschwindet nach „Messenger-Contract anlegen (Testnet)“.
            </p>
          ) : null}
          {!testnetDone ? (
            <>
              <BossWalletGasFundingPanel
                network="testnet"
                apiSnapshot={p.apiSnapshot}
                fallbackMyAddress={p.fallbackMyAddress}
                sessionLocked={p.sessionLocked}
                backendOnline={p.backendOnline}
                onActivateWallet={p.onActivateWallet}
                onReload={p.onReload}
              />
              {!p.backendOnline ? (
                <p className="text-xs text-amber-800 dark:text-amber-200">
                  Basis nicht erreichbar — Wallet entsperren und Backend starten (`npm run dm`).
                </p>
              ) : null}
              <label className="flex cursor-pointer items-start gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={withGlobals}
                  onChange={(e) => setWithGlobals(e.target.checked)}
                />
                <span>
                  Server-Postfach und Registries gleich mit anlegen{' '}
                  <span className="text-xs">(empfohlen)</span>
                </span>
              </label>
              <Button
                type="button"
                className="w-full sm:w-auto"
                disabled={busy !== null || !p.backendOnline}
                onClick={() => void runTestnetDeploy()}
              >
                {busy === 'testnet' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                Messenger-Contract anlegen (Testnet)
              </Button>
            </>
          ) : plan === 'both' ? (
            <p className="text-xs text-emerald-800 dark:text-emerald-200">Testnet bereit — zum täglichen Schreiben.</p>
          ) : null}
        </div>
      ) : null}

      {showMainnet ? (
        <div className="space-y-3 rounded-md border border-violet-500/35 bg-violet-500/10 px-3 py-2.5">
          <p className="text-sm font-medium text-foreground">
            Produktion (Mainnet){plan === 'both' ? ' — optional' : ''}
          </p>
          <p className="text-xs text-muted-foreground">
            {plan === 'both'
              ? 'Eigenes Package auf Mainnet — zum Verankern, wenn es fest auf der echten Chain sein soll. Später auch unter Einstellungen.'
              : 'Gas-Kosten — Nachrichten landen direkt auf der echten Chain.'}
          </p>
          <StatusRow
            ok={mainnetConfigured}
            label={
              mainnetSendReady
                ? `Mainnet bereit (${maskWalletAddress(mainnetStatus.packageId)})`
                : mainnetAnchorReady
                  ? `Mainnet-Package verbunden (${maskWalletAddress(mainnetStatus.packageId)}) — Verankern möglich`
                  : mainnetStatus.samePackageAsTestnet
                    ? 'Mainnet braucht eigenes Package (nicht dieselbe ID wie Testnet)'
                    : 'Mainnet noch nicht eingerichtet'
            }
          />
          {!mainnetConfigured ? (
            <>
              <BossWalletGasFundingPanel
                network="mainnet"
                apiSnapshot={p.apiSnapshot}
                fallbackMyAddress={p.fallbackMyAddress}
                sessionLocked={p.sessionLocked}
                backendOnline={p.backendOnline}
                onActivateWallet={p.onActivateWallet}
                onReload={p.onReload}
              />
              <Button
              type="button"
              variant={plan === 'mainnet-only' ? 'default' : 'outline'}
              className="w-full sm:w-auto"
              disabled={busy !== null || !p.backendOnline || (plan === 'both' && !testnetDone)}
              onClick={() => void runMainnetDeploy()}
            >
              {busy === 'mainnet' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                Messenger-Contract anlegen (Mainnet)
              </Button>
            </>
          ) : mainnetSendReady ? (
            <p className="text-xs text-emerald-800 dark:text-emerald-200">Mainnet bereit — unter Einstellungen umschaltbar.</p>
          ) : (
            <p className="text-xs text-emerald-800 dark:text-emerald-200">
              Mainnet-Package vom Boss übernommen — zum Senden auf Mainnet optional noch Postfach unter Einstellungen.
            </p>
          )}
          {plan === 'both' && !testnetDone ? (
            <p className="text-xs text-muted-foreground">Zuerst Testnet verbinden, dann optional Mainnet.</p>
          ) : null}
        </div>
      ) : null}

      {chainReady ? (
        <p className="text-xs text-emerald-800 dark:text-emerald-200">
          Chain-Anbindung für deinen Plan ist bereit — mit <strong>Weiter</strong> zu den Postfächern.
          {plan === 'both' && testnetDone && !mainnetConfigured
            ? ' Mainnet kannst du später in den Einstellungen nachholen.'
            : null}
        </p>
      ) : null}

      {testnetDone || mainnetConfigured ? (
        <BossNetworkDeployIdsPanel
          testnet={{
            packageId:
              profileState.testnet.packageId ||
              (profileState.active !== 'mainnet' ? p.apiSnapshot?.packageId : undefined),
            mailboxId:
              profileState.testnet.mailboxId ||
              (profileState.active !== 'mainnet' ? p.apiSnapshot?.mailboxId : undefined),
          }}
          mainnet={{
            packageId: mainnetStatus.packageId || profileState.mainnet.packageId,
            mailboxId: mainnetStatus.mailboxId || profileState.mainnet.mailboxId,
          }}
          extras={buildBossDeployIdExtrasFromApi(p.apiSnapshot)}
        />
      ) : null}

      {!withGlobals && testnetDone && showTestnet ? (
        <BossRegistryBootstrapPanel
          apiSnapshot={p.apiSnapshot}
          backendOnline={p.backendOnline}
          onReload={p.onReload}
          variant="compact"
        />
      ) : null}

      {msg ? <p className="whitespace-pre-wrap text-xs text-muted-foreground">{msg}</p> : null}

      {(showTestnet || showMainnet) ? (
        <details className="rounded-md border border-border/60 p-3">
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
            Schon verbunden? (Package-ID eintragen)
          </summary>
          <div className="mt-3 space-y-4">
            {showTestnet ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  <strong className="font-medium text-foreground">Testnet</strong> — nur wenn der Contract bereits auf
                  Testnet existiert (sonst oben „anlegen“).
                </p>
                <Label htmlFor="boss-pkg-manual" className="text-xs">
                  Testnet Package-ID (0x…)
                </Label>
                <div className="flex flex-wrap gap-2">
                  <Input
                    id="boss-pkg-manual"
                    className="min-w-[12rem] flex-1 font-mono text-xs"
                    placeholder="0x…"
                    value={manualId}
                    onChange={(e) => setManualId(e.target.value)}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy !== null}
                    onClick={() => void runApplyManual()}
                  >
                    Übernehmen
                  </Button>
                </div>
              </div>
            ) : null}
            {showMainnet ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  <strong className="font-medium text-foreground">Mainnet</strong> — separates Package auf der echten
                  Chain{plan === 'both' ? ' (optional, unabhängig von Testnet)' : ''}.
                </p>
                <Label htmlFor="boss-pkg-manual-mainnet" className="text-xs">
                  Mainnet Package-ID (0x…)
                </Label>
                <div className="flex flex-wrap gap-2">
                  <Input
                    id="boss-pkg-manual-mainnet"
                    className="min-w-[12rem] flex-1 font-mono text-xs"
                    placeholder="0x…"
                    value={manualMainnetId}
                    onChange={(e) => setManualMainnetId(e.target.value)}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy !== null}
                    onClick={() => void runApplyManualMainnet()}
                  >
                    Übernehmen
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </details>
      ) : null}
    </div>
  )
}

export { OnboardingBossMailboxesStep }

/** @deprecated — nutze OnboardingBossMailboxesStep */
export function OnboardingBossServerMailboxStep(p: PanelProps) {
  return <OnboardingBossMailboxesStep {...p} />
}

/** @deprecated — nutze OnboardingBossMailboxesStep */
export function OnboardingBossTeamStep(p: PanelProps) {
  return <OnboardingBossMailboxesStep {...p} />
}

export function OnboardingBossTelegramStepPanel(p: PanelProps) {
  return (
    <OnboardingBossTelegramStep
      backendOnline={p.backendOnline}
      onOpenSettings={() => {
        primeSettingsCategory('telegram')
        p.onOpenHandoffImport?.()
      }}
    />
  )
}

/** @deprecated — nutze OnboardingBossTelegramStepPanel */
export function OnboardingBossTelegramBotStep(p: PanelProps) {
  return <OnboardingBossTelegramStepPanel {...p} />
}

/** @deprecated — nutze OnboardingBossTelegramStepPanel */
export function OnboardingBossTelegramGroupStep(p: PanelProps) {
  return <OnboardingBossTelegramStepPanel {...p} />
}

export function OnboardingMeshtasticStep(p: PanelProps) {
  return (
    <OnboardingFunkStep
      layout="wizard"
      apiSnapshot={p.apiSnapshot}
      backendOnline={p.backendOnline}
      contactDirectory={p.contactDirectory}
      onReload={p.onReload}
      onOpenSettings={() => {
        primeSettingsCategory('funk')
        p.onOpenHandoffImport?.()
      }}
    />
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
          <HandoffImportPanel
            backendOnline={p.backendOnline}
            embedded
            onApplied={() => p.onReload?.()}
          />
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
    return <p className="text-sm text-muted-foreground">Kein Link im Handoff — überspringen.</p>
  }
  return (
    <a href={invite} target="_blank" rel="noreferrer" className="text-sm text-primary underline break-all">
      {invite}
    </a>
  )
}

export function OnboardingHelperWalletStep(p: PanelProps) {
  const r = getStandaloneHelperReadiness()
  const hasWallet = p.apiSnapshot?.hasKeys === true && p.apiSnapshot?.locked !== true
  const ready = hasWallet || !r.needsMnemonic
  return (
    <div className="space-y-3">
      <StatusRow ok={ready} label="Wallet aktiv" />
      {!ready ? (
        <Button type="button" className="w-full sm:w-auto" onClick={() => p.onActivateWallet?.()}>
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
      <StatusRow ok={Boolean(label)} label="Einsatz-Name" />
      {label ? <p className="text-sm font-medium text-foreground">{label}</p> : null}
      <p className="text-xs text-muted-foreground">
        Funk-Stick einrichten? Im nächsten Schritt „Funk“ oder später unter Einstellungen.
      </p>
    </div>
  )
}

export function OnboardingHelperPeeringStep(p: PanelProps) {
  const handoff = readLocalHandoffAppliedSnapshot()
  const boss = handoff?.bossAddress?.trim() || ''
  return (
    <div className="space-y-3">
      <StatusRow ok={Boolean(boss)} label="Boss verknüpft" />
      {boss ? (
        <p className="font-mono text-xs text-foreground">{maskWalletAddress(boss)}</p>
      ) : (
        <p className="text-sm text-muted-foreground">Erscheint nach Handoff-Import.</p>
      )}
    </div>
  )
}

export function OnboardingWandererWalletStep(p: PanelProps) {
  return (
    <Button type="button" className="w-full sm:w-auto" onClick={() => p.onActivateWallet?.()}>
      Wallet einrichten
    </Button>
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
      embedded
      apiStatus={p.apiSnapshot ?? null}
      myAddress={(p.apiSnapshot?.myAddressFull || p.apiSnapshot?.myAddress || '').trim()}
      backendOnline={p.backendOnline}
      onReload={p.onReload}
    />
  )
}

export function OnboardingDoneStep(p: { path?: 'boss' | 'helper' | 'wanderer' }) {
  return (
    <div className="space-y-3 text-sm text-muted-foreground">
      <p className="text-foreground">
        <strong className="font-medium">Dein Messenger ist eingerichtet.</strong>
      </p>
      {p.path === 'boss' ? (
        <p className="text-xs leading-relaxed">
          Helfer-Geräte provisionierst du <strong className="font-medium text-foreground">danach</strong> in der
          Einsatzleitung über <strong className="font-medium text-foreground">Helfer einrichten</strong> — nicht in
          diesem Wizard.
        </p>
      ) : null}
    </div>
  )
}
