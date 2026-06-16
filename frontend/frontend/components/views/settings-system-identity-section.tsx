'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle, ChevronDown, Copy, RefreshCw, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  checkChainReachable,
  fetchPackageIdHistory,
  getConfig,
  getCurrentIds,
  getStatus,
  setConfig,
  setPackageIdCommand,
  type ApiStatus,
} from '@/frontend/lib/api'
import {
  checkStandaloneChainReachable,
  getStandaloneCurrentIds,
  readStandaloneLocalIdentitySnapshot,
} from '@/frontend/lib/standalone-local-identity'
import { shouldPreferStandaloneHandoffStatus } from '@/frontend/lib/capacitor-standalone-bootstrap'
import { ConfigView } from '@/frontend/components/views/config-view'
import { SettingsIotaDirectCard } from '@/frontend/components/views/settings-iota-direct-card'
import { SessionSignerStatusStrip } from '@/frontend/components/session-signer-status-strip'
import { isIotaTransportUiVisible } from '@/frontend/lib/messenger-role-capabilities'

function maskId(id?: string): string {
  if (!id) return '—'
  if (id.length <= 16) return id
  return `${id.slice(0, 10)}…${id.slice(-6)}`
}

type SettingsSystemIdentitySectionProps = {
  onApplied?: () => void
  apiStatus?: ApiStatus | null
  /** Netzwerk-Schalter „Wo senden?“ verwaltet RPC/Package — Duplikate ausblenden */
  managedNetwork?: boolean
  vaultLocked?: boolean
  onRequestVaultUnlock?: () => void
}

export function SettingsSystemIdentitySection({
  onApplied,
  apiStatus,
  managedNetwork,
  vaultLocked,
  onRequestVaultUnlock,
}: SettingsSystemIdentitySectionProps) {
  const [loading, setLoading] = useState(true)
  const [chainReachable, setChainReachable] = useState<boolean | null>(null)
  const [address, setAddress] = useState('')
  const [packageId, setPackageId] = useState('')
  const [version, setVersion] = useState('Morgendrot v1.0')
  const [rpcUrl, setRpcUrl] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [packageDraft, setPackageDraft] = useState('')
  const [historyPick, setHistoryPick] = useState<'__manual__' | string>('__manual__')
  const [settingPackageId, setSettingPackageId] = useState(false)
  const [savingRpc, setSavingRpc] = useState(false)
  const [msg, setMsg] = useState('')
  const [configOpen, setConfigOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const showIotaBlocks =
    isIotaTransportUiVisible(apiStatus ?? null) ||
    apiStatus?.backendOnline === true ||
    apiStatus?.backendRunning === true

  const load = useCallback(async (opts?: { withSpinner?: boolean }) => {
    if (opts?.withSpinner !== false) setLoading(true)
    setMsg('')
    try {
      const [statusRes, idsRes, historyRes, configRes, chainRes] = await Promise.all([
        getStatus(),
        getCurrentIds(),
        fetchPackageIdHistory(),
        getConfig(),
        checkChainReachable(),
      ])
      const localSnap = shouldPreferStandaloneHandoffStatus()
        ? readStandaloneLocalIdentitySnapshot()
        : null
      const standaloneIds = shouldPreferStandaloneHandoffStatus()
        ? await getStandaloneCurrentIds()
        : null
      const st = statusRes.data ?? null
      const addr =
        (statusRes.ok && st?.address ? st.address : '') ||
        standaloneIds?.myAddress ||
        idsRes.myAddress ||
        localSnap?.myAddress ||
        ''
      const pkg =
        (statusRes.ok && st?.packageId ? st.packageId : '') ||
        standaloneIds?.packageId ||
        idsRes.packageId ||
        localSnap?.packageId ||
        ''
      setAddress(addr)
      setPackageId(pkg)
      setPackageDraft(pkg)
      setVersion(st?.version || 'Morgendrot v1.0')
      if (shouldPreferStandaloneHandoffStatus()) {
        const directReach = await checkStandaloneChainReachable()
        setChainReachable(directReach)
      } else {
        setChainReachable(chainRes.reachable ?? null)
      }

      const hist = historyRes.ok
        ? [...new Set([...(historyRes.history ?? []), ...(historyRes.discovered ?? [])])].filter(Boolean)
        : []
      setHistory(hist)
      if (historyRes.ok && historyRes.current) {
        setPackageDraft(historyRes.current)
        setHistoryPick(historyRes.current)
      } else if (pkg) {
        setPackageDraft(pkg)
        setHistoryPick(hist.includes(pkg) ? pkg : '__manual__')
      } else {
        setHistoryPick('__manual__')
      }

      if (configRes.ok && configRes.config) {
        const rpc = configRes.config.find((c) => c.envKey === 'RPC_URL')?.value ?? ''
        setRpcUrl(rpc)
      } else if (localSnap?.rpcUrl) {
        setRpcUrl(localSnap.rpcUrl)
      }
    } catch {
      setMsg('Status konnte nicht geladen werden.')
    }
    if (opts?.withSpinner !== false) setLoading(false)
  }, [])

  useEffect(() => {
    void load({ withSpinner: true })
  }, [load])

  const packageOptions = useMemo(() => {
    const ids = new Set<string>()
    if (packageId) ids.add(packageId)
    for (const id of history) ids.add(id)
    if (packageDraft.trim()) ids.add(packageDraft.trim())
    return [...ids]
  }, [history, packageId, packageDraft])

  const canApplyPackageId = useMemo(() => {
    const next = packageDraft.trim()
    if (!next || settingPackageId) return false
    return next !== (packageId || '').trim()
  }, [packageDraft, packageId, settingPackageId])

  const applyPackageId = async () => {
    const next = packageDraft.trim()
    if (!next) return
    setSettingPackageId(true)
    setMsg('')
    try {
      const res = await setPackageIdCommand(next)
      if (res.ok) {
        setMsg(res.message || 'Package-ID gesetzt.')
        await load({ withSpinner: false })
        onApplied?.()
      } else {
        setMsg(res.error || res.message || 'Package-ID konnte nicht gesetzt werden.')
      }
    } finally {
      setSettingPackageId(false)
    }
  }

  const applyRpc = async () => {
    setSavingRpc(true)
    setMsg('')
    try {
      const res = await setConfig('RPC_URL', rpcUrl.trim())
      if (res.ok) {
        setMsg('RPC_URL gespeichert.')
        await load({ withSpinner: false })
        onApplied?.()
      } else {
        setMsg(res.error || 'RPC konnte nicht gespeichert werden.')
      }
    } finally {
      setSavingRpc(false)
    }
  }

  const rpcStatusLabel =
    chainReachable === null ? null : chainReachable ? (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-500">
        <CheckCircle className="h-3.5 w-3.5" aria-hidden />
        IOTA-RPC erreichbar
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 text-xs text-destructive">
        <XCircle className="h-3.5 w-3.5" aria-hidden />
        IOTA-RPC nicht erreichbar
      </span>
    )

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-4">
        <div>
          <h4 className="font-semibold text-foreground">System & Identität</h4>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {managedNetwork ? 'Adresse · Direkt-Send' : 'Adresse, Package-ID, IOTA/Mailbox, .env'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {rpcStatusLabel}
          <button
            type="button"
            onClick={() => void load({ withSpinner: true })}
            disabled={loading}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            aria-label="Aktualisieren"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Aktualisieren
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-8">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2.5">
            <div>
              <p className="text-xs text-muted-foreground">Meine Adresse</p>
              <p className="break-all font-mono text-sm" title={address}>
                {address || '—'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">{version}</p>
              {address ? (
                <button
                  type="button"
                  className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  onClick={() => {
                    void navigator.clipboard.writeText(address).then(() => {
                      setCopied(true)
                      setTimeout(() => setCopied(false), 2000)
                    })
                  }}
                >
                  <Copy className="h-3 w-3" />
                  {copied ? 'Kopiert' : 'Kopieren'}
                </button>
              ) : null}
            </div>
          </div>

          {!managedNetwork ? (
          <div className="space-y-2 rounded-lg border border-border p-3">
            <Label className="text-sm">Package-ID (Move)</Label>
            <p className="text-[11px] text-muted-foreground">
              Nur nach neuem Move-Deploy ändern — dann ggf. MAILBOX_ID in .env anpassen.
            </p>
            {packageOptions.length > 0 ? (
              <Select
                value={historyPick}
                onValueChange={(v) => {
                  setHistoryPick(v)
                  if (v !== '__manual__') setPackageDraft(v)
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Aus Verlauf wählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__manual__">Manuell eingeben</SelectItem>
                  {packageOptions.map((id) => (
                    <SelectItem key={id} value={id}>
                      {maskId(id)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            <Input
              placeholder="0x…"
              value={packageDraft}
              onChange={(e) => {
                setPackageDraft(e.target.value)
                setHistoryPick('__manual__')
              }}
              className="font-mono text-sm"
              spellCheck={false}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!canApplyPackageId}
              onClick={() => void applyPackageId()}
            >
              {settingPackageId ? 'Setze…' : 'Package-ID setzen'}
            </Button>
          </div>
          ) : (
            <p className="text-xs text-muted-foreground rounded-lg border border-border/60 px-3 py-2">
              Package & RPC: Schalter <strong className="font-medium text-foreground">Wo senden?</strong> oben.
            </p>
          )}

          {showIotaBlocks && apiStatus ? (
            <>
              {!managedNetwork ? (
                <SettingsIotaDirectCard
                  embedded
                  backendOnline={apiStatus.backendOnline ?? apiStatus.backendRunning}
                />
              ) : (
                <SessionSignerStatusStrip
                  locked={vaultLocked}
                  myAddress={
                    apiStatus?.myAddressFull?.trim() ||
                    apiStatus?.myAddress?.trim() ||
                    address
                  }
                  signerMode={apiStatus.signer}
                  onRequestUnlock={onRequestVaultUnlock}
                />
              )}
            </>
          ) : null}

          {msg ? (
            <p className="text-sm text-muted-foreground" role="status">
              {msg}
            </p>
          ) : null}

          <Collapsible open={configOpen} onOpenChange={setConfigOpen}>
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2.5 text-sm font-medium hover:bg-accent/50">
              <span>
                Erweiterte Konfiguration (.env)
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  —{' '}
                  <a
                    href="/handbook?file=ENV-MESSENGER-EINSTELLUNGEN-REFERENZ.md"
                    className="text-primary underline hover:no-underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    alle Keys im Handbuch
                  </a>
                </span>
              </span>
              <ChevronDown className={cn('h-4 w-4 transition-transform', configOpen && 'rotate-180')} />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-4">
              {!managedNetwork ? (
              <div className="space-y-2 rounded-lg border border-border p-3">
                <Label className="text-sm">RPC_URL</Label>
                <p className="text-[11px] text-muted-foreground">
                  Primäre Fullnode — hier bearbeiten; in der Liste unten nicht noch einmal (RPC_URLS = Fallback-URLs).
                </p>
                <Input
                  placeholder="https://…"
                  value={rpcUrl}
                  onChange={(e) => setRpcUrl(e.target.value)}
                  className="font-mono text-sm"
                />
                <Button type="button" variant="outline" size="sm" disabled={savingRpc} onClick={() => void applyRpc()}>
                  {savingRpc ? 'Speichere…' : 'RPC speichern'}
                </Button>
              </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  RPC-URL wird über <strong className="font-medium text-foreground">Wo senden?</strong> gesetzt.
                </p>
              )}
              <ConfigView embedded messengerMode />
            </CollapsibleContent>
          </Collapsible>
        </div>
      )}
    </div>
  )
}
