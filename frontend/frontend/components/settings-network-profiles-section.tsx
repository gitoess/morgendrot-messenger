'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, ChevronDown, Copy, Globe } from 'lucide-react'
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
import { postDeployMainnetPackage } from '@/frontend/lib/api/einsatz-config'
import { DEFAULT_MAINNET_RPC_URL } from '@morgendrot/shared/einsatz-chain-mode'

type SettingsNetworkProfilesSectionProps = {
    apiStatus?: ApiStatus | null
    backendOnline?: boolean
    onApplied?: () => void | Promise<void>
}

type MainnetDeployResult = {
    packageId: string
    mailboxId?: string
}

function maskId(id: string): string {
    const t = id.trim()
    if (t.length <= 18) return t
    return `${t.slice(0, 10)}…${t.slice(-6)}`
}

function IdRow(p: { label: string; value: string; copyKey: string; copied: string | null; onCopy: (v: string, k: string) => void }) {
    if (!p.value.trim()) return null
    return (
        <div className="space-y-0.5">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{p.label}</p>
            <div className="flex items-start gap-2">
                <p className="min-w-0 flex-1 break-all font-mono text-[11px] text-foreground" title={p.value}>
                    {p.value}
                </p>
                <button
                    type="button"
                    className="inline-flex shrink-0 items-center gap-1 text-[10px] text-primary hover:underline"
                    onClick={() => p.onCopy(p.value, p.copyKey)}
                >
                    {p.copied === p.copyKey ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {p.copied === p.copyKey ? 'Kopiert' : 'Kopieren'}
                </button>
            </div>
        </div>
    )
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
    const [deployResult, setDeployResult] = useState<MainnetDeployResult | null>(null)
    const [copied, setCopied] = useState<string | null>(null)

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
        if (synced.mainnet.packageId && synced.mainnet.mailboxId) {
            setDeployResult({ packageId: synced.mainnet.packageId, mailboxId: synced.mainnet.mailboxId })
        }
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
    const mainnetReady = Boolean(state.mainnet.packageId.trim() && state.mainnet.mailboxId.trim())

    const copyId = (value: string, key: string) => {
        void navigator.clipboard.writeText(value).then(() => {
            setCopied(key)
            setTimeout(() => setCopied(null), 2000)
        })
    }

    const pickNetwork = async (target: EinsatzNetworkId) => {
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
            setDeployResult({
                packageId: synced.mainnet.packageId,
                mailboxId: synced.mainnet.mailboxId || undefined,
            })
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
        setDeployResult(null)
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
            setDeployResult({
                packageId: out.packageId,
                mailboxId: out.mailboxId,
            })
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
            if (state.mainnet.packageId) {
                setDeployResult({
                    packageId: state.mainnet.packageId,
                    mailboxId: state.mainnet.mailboxId || undefined,
                })
            }
            setMsgTone('success')
            setMsg('Mainnet gespeichert.')
            await p.onApplied?.()
        } finally {
            setBusy(false)
        }
    }

    return (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-700 dark:text-sky-300">
                    <Globe className="h-5 w-5" aria-hidden />
                </div>
                <div>
                    <h4 className="font-semibold text-foreground">Wo senden?</h4>
                    <p className={cn('text-sm', summary.activeOk ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-800 dark:text-amber-200')}>
                        {summary.line}
                    </p>
                </div>
            </div>

            <div className="flex rounded-lg border border-border p-1 bg-muted/30">
                <button
                    type="button"
                    disabled={busy || deploying}
                    className={cn(
                        'flex-1 rounded-md py-2.5 text-sm font-medium',
                        state.active === 'testnet' ? 'bg-background shadow-sm' : 'text-muted-foreground'
                    )}
                    onClick={() => void pickNetwork('testnet')}
                >
                    Übung (Testnet)
                </button>
                <button
                    type="button"
                    disabled={busy || deploying}
                    className={cn(
                        'flex-1 rounded-md py-2.5 text-sm font-medium',
                        state.active === 'mainnet' ? 'bg-background shadow-sm' : 'text-muted-foreground'
                    )}
                    onClick={() => void pickNetwork('mainnet')}
                >
                    Produktion (Mainnet)
                </button>
            </div>

            {summary.hint ? <p className="text-xs text-muted-foreground">{summary.hint}</p> : null}

            {(deployResult || mainnetReady) && state.mainnet.packageId ? (
                <div className="rounded-lg border border-emerald-500/35 bg-emerald-500/10 p-3 space-y-2 text-xs">
                    <p className="font-semibold text-emerald-900 dark:text-emerald-200">
                        Mainnet-IDs {mainnetReady ? '(bereit)' : '(Package da, Postfach fehlt)'}
                    </p>
                    <IdRow
                        label="Package"
                        value={deployResult?.packageId || state.mainnet.packageId}
                        copyKey="pkg"
                        copied={copied}
                        onCopy={copyId}
                    />
                    <IdRow
                        label="Mailbox"
                        value={deployResult?.mailboxId || state.mainnet.mailboxId}
                        copyKey="mb"
                        copied={copied}
                        onCopy={copyId}
                    />
                    <p className="text-[10px] text-muted-foreground font-mono">
                        {maskId(deployResult?.packageId || state.mainnet.packageId)}
                        {state.mainnet.mailboxId ? ` · ${maskId(state.mainnet.mailboxId)}` : ''}
                    </p>
                </div>
            ) : null}

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
