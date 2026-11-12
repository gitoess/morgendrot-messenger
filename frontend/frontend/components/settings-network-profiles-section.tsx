'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, Globe } from 'lucide-react'
import type { ApiStatus } from '@/frontend/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import {
    applyActiveNetworkProfile,
    EINSATZ_NETWORK_PROFILES_CHANGED,
    notifyNetworkProfilesChanged,
    readNetworkProfilesState,
    summarizeNetworkState,
    switchActiveNetwork,
    syncProfilesFromApi,
    type EinsatzNetworkId,
    type EinsatzNetworkProfilesState,
    writeNetworkProfilesState,
} from '@/frontend/lib/einsatz-network-profiles'
import { BossWalletGasFundingPanel } from '@/frontend/components/onboarding/boss-wallet-gas-funding-panel'
import {
    BossNetworkDeployIdsPanel,
    buildBossDeployIdExtrasFromApi,
} from '@/frontend/components/onboarding/boss-network-deploy-ids-panel'
import { postDeployMainnetPackage } from '@/frontend/lib/api/einsatz-config'
import { DEFAULT_MAINNET_RPC_URL } from '@morgendrot/shared/einsatz-chain-mode'
import { SessionSignerStatusStrip } from '@/frontend/components/session-signer-status-strip'

type SettingsNetworkProfilesSectionProps = {
    apiStatus?: ApiStatus | null
    backendOnline?: boolean
    onApplied?: () => void | Promise<void>
    vaultLocked?: boolean
    onRequestVaultUnlock?: () => void
}

export function SettingsNetworkProfilesSection(p: SettingsNetworkProfilesSectionProps) {
    const [state, setState] = useState<EinsatzNetworkProfilesState>(() =>
        syncProfilesFromApi(readNetworkProfilesState(), p.apiStatus)
    )
    const [busy, setBusy] = useState(false)
    const [deploying, setDeploying] = useState(false)
    const [msg, setMsg] = useState('')
    const [msgTone, setMsgTone] = useState<'neutral' | 'error' | 'success'>('neutral')
    const [mainnetSetupOpen, setMainnetSetupOpen] = useState(false)

    const refresh = useCallback(() => {
        setState(syncProfilesFromApi(readNetworkProfilesState(), p.apiStatus))
    }, [p.apiStatus])

    useEffect(() => {
        refresh()
        const onChange = () => refresh()
        window.addEventListener(EINSATZ_NETWORK_PROFILES_CHANGED, onChange)
        return () => window.removeEventListener(EINSATZ_NETWORK_PROFILES_CHANGED, onChange)
    }, [refresh])

    useEffect(() => {
        const synced = syncProfilesFromApi(readNetworkProfilesState(), p.apiStatus)
        setState(synced)
        writeNetworkProfilesState(synced)
    }, [p.apiStatus?.packageId, p.apiStatus?.mailboxId, p.apiStatus?.einsatzConfig?.mainnetPackageId])

    useEffect(() => {
        if (!p.backendOnline || !p.apiStatus?.packageId) return
        const synced = syncProfilesFromApi(readNetworkProfilesState(), p.apiStatus)
        if (synced.active !== 'testnet') return
        if (!summarizeNetworkState(synced).activeOk) return
        void applyActiveNetworkProfile({
            state: synced,
            backendOnline: p.backendOnline,
            senderAddress:
                p.apiStatus?.myAddressFull?.trim() || p.apiStatus?.myAddress?.trim() || undefined,
        }).then((out) => {
            if (out.ok) notifyNetworkProfilesChanged()
        })
    }, [p.backendOnline, p.apiStatus?.packageId])

    useEffect(() => {
        const synced = readNetworkProfilesState()
        if (synced.active !== 'mainnet') return
        if (!summarizeNetworkState(synced).activeOk) return
        void applyActiveNetworkProfile({
            state: synced,
            backendOnline: p.backendOnline,
            senderAddress:
                p.apiStatus?.myAddressFull?.trim() || p.apiStatus?.myAddress?.trim() || undefined,
            clearOfflineQueue: false,
        }).then((out) => {
            if (out.ok) notifyNetworkProfilesChanged()
        })
    }, [])

    const senderAddress =
        p.apiStatus?.myAddressFull?.trim() || p.apiStatus?.myAddress?.trim() || undefined

    const summary = summarizeNetworkState(state)
    const deployExtras = buildBossDeployIdExtrasFromApi(p.apiStatus)

    const pickNetwork = async (target: EinsatzNetworkId) => {
        if (target === state.active && summarizeNetworkState(state).activeOk) {
            setMsgTone('success')
            setMsg(target === 'testnet' ? 'Übung (Testnet) ist bereits aktiv.' : 'Produktion (Mainnet) ist bereits aktiv.')
            return
        }
        if (target === 'mainnet' && !summarizeNetworkState({ ...state, active: 'mainnet' }).activeOk) {
            setMainnetSetupOpen(true)
            setMsgTone('error')
            setMsg('Mainnet zuerst einrichten (eigenes Deploy + Postfach).')
            return
        }
        setBusy(true)
        setMsg('')
        setMsgTone('neutral')
        try {
            const synced = syncProfilesFromApi(state, p.apiStatus)
            writeNetworkProfilesState(synced)
            const out = await switchActiveNetwork(target, {
                backendOnline: p.backendOnline,
                senderAddress,
                apiStatus: p.apiStatus,
            })
            if (!out.ok) {
                setMsgTone('error')
                setMsg(out.error)
                if (target === 'mainnet') setMainnetSetupOpen(true)
                return
            }
            refresh()
            setMsgTone('success')
            const queueNote =
                out.queueCleared > 0
                    ? ` (${out.queueCleared} alte Warteschlangen-Einträge verworfen.)`
                    : ''
            setMsg(
                (target === 'testnet' ? 'Übung (Testnet) aktiv.' : 'Produktion (Mainnet) aktiv.') + queueNote
            )
            await p.onApplied?.()
        } finally {
            setBusy(false)
        }
    }

    const onPullMainnetFromBoss = async () => {
        const synced = syncProfilesFromApi(state, p.apiStatus)
        setState(synced)
        setMainnetSetupOpen(true)
        setMsgTone('neutral')
        setMsg(
            synced.mainnet.packageId
                ? 'Mainnet-Package aus Boss übernommen — Mailbox-ID noch eintragen (Mainnet-Postfach).'
                : 'Boss hat noch kein MAINNET_PACKAGE_ID — „Mainnet deployen“ oder Terminal.'
        )
        if (synced.mainnet.packageId) {
            setMainnetSetupOpen(true)
        }
    }

    const onDeployMainnet = async () => {
        if (
            !window.confirm(
                'Move auf Mainnet deployen?\n\nErzeugt neues Package + Postfach auf Mainnet (Gas nötig). Testnet-IDs bleiben unverändert. Dauert einige Minuten.'
            )
        ) {
            return
        }
        setDeploying(true)
        setMsgTone('neutral')
        setMsg('Mainnet-Deploy läuft — bitte warten (Publish + Postfach, kann 2–5 Min. dauern)…')
        setMainnetSetupOpen(true)
        try {
            const rpcUrl = state.mainnet.rpcUrl.trim() || DEFAULT_MAINNET_RPC_URL
            const out = await postDeployMainnetPackage({ rpcUrl })
            if (!out.ok) {
                setMsgTone('error')
                setMsg(out.error)
                return
            }
            const next: EinsatzNetworkProfilesState = {
                ...state,
                active: 'mainnet',
                mainnet: {
                    rpcUrl: out.mainnetRpcUrl || rpcUrl,
                    packageId: out.packageId,
                    mailboxId: out.mailboxId || state.mainnet.mailboxId,
                },
            }
            setState(next)
            writeNetworkProfilesState(next)
            notifyNetworkProfilesChanged()
            const apply = await applyActiveNetworkProfile({
                state: next,
                backendOnline: p.backendOnline,
                senderAddress,
            })
            if (!apply.ok) {
                setMsgTone('error')
                setMsg(`${out.message || 'Deploy OK.'} Profil speichern: ${apply.error}`)
                return
            }
            setMsgTone('success')
            const queueNote =
                apply.queueCleared > 0
                    ? ` ${apply.queueCleared} alte Warteschlangen-Einträge verworfen.`
                    : ''
            setMsg(
                (out.mailboxId
                    ? 'Mainnet aktiv — Package + Postfach gesetzt.'
                    : 'Package deployt — Postfach fehlt (create_globals prüfen).') + queueNote
            )
            await p.onApplied?.()
        } catch (e) {
            setMsgTone('error')
            setMsg(e instanceof Error ? e.message : String(e))
        } finally {
            setDeploying(false)
        }
    }

    const onSaveMainnet = async () => {
        setBusy(true)
        setMsg('')
        setMsgTone('neutral')
        try {
            writeNetworkProfilesState(state)
            const out = await applyActiveNetworkProfile({
                state,
                backendOnline: p.backendOnline,
                senderAddress,
            })
            if (!out.ok) {
                setMsgTone('error')
                setMsg(out.error)
                return
            }
            setMsgTone('success')
            setMsg('Mainnet gespeichert.')
            await p.onApplied?.()
        } finally {
            setBusy(false)
        }
    }

    const testnetReady = summarizeNetworkState({ ...state, active: 'testnet' }).activeOk
    const mainnetReady = summarizeNetworkState({ ...state, active: 'mainnet' }).activeOk

    return (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-700 dark:text-sky-300">
                    <Globe className="h-5 w-5" aria-hidden />
                </div>
                <div className="min-w-0">
                    <h4 className="font-semibold text-foreground">Wo senden?</h4>
                    <p className="text-xs text-muted-foreground">
                        Ein aktives Netz — Package, Postfach und RPC für direkten IOTA-Versand.
                    </p>
                    <p className={cn('mt-0.5 text-sm', summary.activeOk ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-800 dark:text-amber-200')}>
                        {summary.line}
                    </p>
                </div>
            </div>

            <div
                role="tablist"
                aria-label="Aktives IOTA-Netzwerk"
                className="relative grid grid-cols-2 gap-1 rounded-xl border border-border bg-muted/40 p-1"
            >
                <button
                    type="button"
                    role="tab"
                    aria-selected={state.active === 'testnet'}
                    disabled={busy || deploying}
                    className={cn(
                        'rounded-lg px-2 py-3 text-left transition-all duration-200 ease-out',
                        'active:scale-[0.97]',
                        state.active === 'testnet'
                            ? 'z-[1] scale-[1.02] bg-sky-600 text-white shadow-md shadow-sky-900/25 ring-2 ring-sky-300/80 dark:bg-sky-500 dark:ring-sky-200/50'
                            : 'bg-sky-500/10 text-sky-900/70 hover:bg-sky-500/20 dark:text-sky-200/70'
                    )}
                    onClick={() => void pickNetwork('testnet')}
                >
                    <span className="block text-sm font-semibold">Übung</span>
                    <span className="block text-[11px] opacity-90">Testnet</span>
                    <span className="mt-1 block text-[10px] font-medium opacity-95">
                        {state.active === 'testnet' ? 'aktiv' : testnetReady ? 'bereit' : 'IDs fehlen'}
                    </span>
                </button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={state.active === 'mainnet'}
                    disabled={busy || deploying}
                    className={cn(
                        'rounded-lg px-2 py-3 text-left transition-all duration-200 ease-out',
                        'active:scale-[0.97]',
                        state.active === 'mainnet'
                            ? 'z-[1] scale-[1.02] bg-violet-700 text-white shadow-md shadow-violet-950/30 ring-2 ring-violet-300/80 dark:bg-violet-600 dark:ring-violet-200/50'
                            : 'bg-violet-500/10 text-violet-950/70 hover:bg-violet-500/20 dark:text-violet-200/70'
                    )}
                    onClick={() => void pickNetwork('mainnet')}
                >
                    <span className="block text-sm font-semibold">Produktion</span>
                    <span className="block text-[11px] opacity-90">Mainnet</span>
                    <span className="mt-1 block text-[10px] font-medium opacity-95">
                        {state.active === 'mainnet' ? 'aktiv' : mainnetReady ? 'bereit' : 'einrichten'}
                    </span>
                </button>
            </div>

            {summary.hint ? <p className="text-xs text-muted-foreground">{summary.hint}</p> : null}

            <SessionSignerStatusStrip
                locked={p.vaultLocked}
                myAddress={
                    p.apiStatus?.myAddressFull?.trim() ||
                    p.apiStatus?.myAddress?.trim() ||
                    senderAddress
                }
                signerMode={p.apiStatus?.signer}
                onRequestUnlock={p.onRequestVaultUnlock}
            />

            <div className="space-y-2">
                <BossWalletGasFundingPanel
                    network="testnet"
                    apiSnapshot={p.apiStatus}
                    backendOnline={p.backendOnline}
                    onReload={() => void p.onApplied?.()}
                    compact
                />
                <BossWalletGasFundingPanel
                    network="mainnet"
                    apiSnapshot={p.apiStatus}
                    backendOnline={p.backendOnline}
                    onReload={() => void p.onApplied?.()}
                    compact
                />
            </div>

            <BossNetworkDeployIdsPanel
                testnet={{
                    packageId: state.testnet.packageId,
                    mailboxId: state.testnet.mailboxId,
                }}
                mainnet={{
                    packageId: state.mainnet.packageId,
                    mailboxId: state.mainnet.mailboxId,
                }}
                extras={deployExtras}
            />

            <Collapsible open={mainnetSetupOpen} onOpenChange={setMainnetSetupOpen}>
                <CollapsibleTrigger className="flex w-full items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                    <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', mainnetSetupOpen && 'rotate-180')} />
                    Mainnet einrichten (nur einmal nötig)
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-2 space-y-2">
                    <p className="text-[11px] text-muted-foreground">
                        Mainnet = eigenes Move-Deploy + eigenes Postfach. Nicht dieselben IDs wie Testnet.
                    </p>
                    {!p.backendOnline ? (
                        <p className="text-[11px] text-amber-800 dark:text-amber-200">
                            Boss-Backend wirkt offline — Deploy trotzdem versuchen oder zuerst{' '}
                            <span className="font-mono">npm run dev</span> starten.
                        </p>
                    ) : null}
                    <Button
                        type="button"
                        variant="default"
                        size="sm"
                        disabled={busy || deploying}
                        onClick={() => void onDeployMainnet()}
                    >
                        {deploying ? 'Deploy läuft…' : 'Mainnet deployen (1 Klick)'}
                    </Button>
                    <p className="text-[10px] text-muted-foreground">
                        Boss-PC: IOTA-CLI (<span className="font-mono">iota</span>) + Mainnet-Gas. Nach Erfolg: Package + Mailbox
                        erscheinen oben und in den Feldern.
                    </p>
                    <Button type="button" variant="outline" size="sm" disabled={busy || deploying} onClick={() => void onPullMainnetFromBoss()}>
                        Vom Boss übernehmen
                    </Button>
                    <div className="space-y-1">
                        <Label className="text-[11px]">Package-ID</Label>
                        <Input
                            className="h-8 font-mono text-xs"
                            value={state.mainnet.packageId}
                            placeholder="Mainnet Package-ID 0x…"
                            spellCheck={false}
                            onChange={(e) => setState((s) => ({ ...s, mainnet: { ...s.mainnet, packageId: e.target.value } }))}
                        />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[11px]">Mailbox-ID</Label>
                        <Input
                            className="h-8 font-mono text-xs"
                            value={state.mainnet.mailboxId}
                            placeholder="Mainnet Mailbox-ID 0x…"
                            spellCheck={false}
                            onChange={(e) => setState((s) => ({ ...s, mainnet: { ...s.mainnet, mailboxId: e.target.value } }))}
                        />
                    </div>
                    <Button type="button" size="sm" disabled={busy || deploying} onClick={() => void onSaveMainnet()}>
                        Mainnet speichern
                    </Button>
                </CollapsibleContent>
            </Collapsible>

            {msg ? (
                <p
                    className={cn(
                        'text-xs',
                        msgTone === 'error' && 'text-destructive',
                        msgTone === 'success' && 'text-emerald-700 dark:text-emerald-300',
                        msgTone === 'neutral' && 'text-muted-foreground'
                    )}
                    role="status"
                >
                    {msg}
                </p>
            ) : null}
        </div>
    )
}
