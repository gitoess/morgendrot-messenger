'use client'

import { useEffect, useState } from 'react'
import { Settings, CheckCircle, XCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  getStatus,
  getCurrentIds,
  checkChainReachable,
  getPackageIdHistory,
  executeCommand,
  getConfig,
  setConfig,
} from '@/frontend/lib/api'

function shortRpcUrl(url: string): string {
  const u = (url || '').trim()
  if (!u) return ''
  try {
    const p = new URL(u)
    const path = p.pathname && p.pathname !== '/' ? p.pathname.replace(/\/$/, '') : ''
    const pathShort = path.length > 40 ? `${path.slice(0, 37)}…` : path
    return pathShort ? `${p.host}${pathShort}` : p.host
  } catch {
    return u.length > 48 ? `${u.slice(0, 45)}…` : u
  }
}

interface SystemStatus {
  address?: string
  packageId?: string
  network?: string
  version?: string
  chainReachable?: boolean
}

interface SetupOverlayProps {
  onOpenConfig?: () => void
}

export function SetupOverlay({ onOpenConfig }: SetupOverlayProps) {
  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<SystemStatus>({})
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(false)
  const [packageHistory, setPackageHistory] = useState<{ current?: string; history?: string[] }>({})
  const [selectedPackageId, setSelectedPackageId] = useState('')
  const [settingPackageId, setSettingPackageId] = useState(false)
  const [rpcUrl, setRpcUrl] = useState('')
  const [savingRpc, setSavingRpc] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const fetchStatus = async () => {
    setLoading(true)
    try {
      const [statusRes, idsRes, historyRes] = await Promise.all([
        getStatus(),
        getCurrentIds(),
        getPackageIdHistory(),
      ])
      const st = statusRes.ok && statusRes.data ? statusRes.data : null
      setStatus((prev) => ({
        ...prev,
        address: (st?.address ?? '') || idsRes.myAddress,
        packageId: (st?.packageId ?? '') || idsRes.packageId,
        network: st?.network ?? '—',
        version: st?.version,
      }))
      if (historyRes.ok) {
        setPackageHistory({ current: historyRes.current, history: historyRes.history || [] })
        setSelectedPackageId(historyRes.current ?? '')
      }
      const configRes = await getConfig()
      if (configRes.ok && configRes.config) {
        const rpc = configRes.config.find((c) => c.envKey === 'RPC_URL')?.value ?? ''
        setRpcUrl(rpc)
      }
    } catch {
      // Handle error silently
    }
    setLoading(false)
  }

  const checkNode = async () => {
    setChecking(true)
    try {
      const res = await checkChainReachable()
      setStatus((prev) => ({ ...prev, chainReachable: res.reachable }))
    } catch {
      setStatus((prev) => ({ ...prev, chainReachable: false }))
    }
    setChecking(false)
  }

  useEffect(() => {
    if (open) {
      fetchStatus()
      checkNode()
    }
  }, [open])

  const maskAddress = (addr?: string) => {
    if (!addr) return '-'
    if (addr.length <= 12) return addr
    return `${addr.slice(0, 8)}...${addr.slice(-6)}`
  }

  if (!mounted) {
    return (
      <Button variant="outline" size="sm" className="gap-2" type="button">
        <Settings className="h-4 w-4" />
        <span>Setup</span>
      </Button>
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings className="h-4 w-4" />
          <span>Setup</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            System & Identität
          </DialogTitle>
          <DialogDescription>
            Aktuelle Konfiguration und Netzwerkstatus
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <span className="text-sm text-muted-foreground">Netzwerk (RPC_URL)</span>
                  <span
                    className="max-w-[min(100%,12rem)] truncate font-mono text-sm text-card-foreground"
                    title={rpcUrl || status.network || ''}
                  >
                    {shortRpcUrl(rpcUrl) || status.network || '-'}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <span className="text-sm text-muted-foreground">Meine Adresse</span>
                  <span className="font-mono text-sm text-card-foreground">
                    {maskAddress(status.address)}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <span className="text-sm text-muted-foreground">Package-ID (aktuell)</span>
                  <span className="font-mono text-sm text-card-foreground">
                    {maskAddress(status.packageId)}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <span className="text-sm text-muted-foreground">App/Version</span>
                  <span className="font-mono text-sm text-card-foreground">
                    {status.version || 'Morgendrot v1.0'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-lg border border-border p-3">
                <span className="text-sm text-muted-foreground">Node-Status:</span>
                {checking ? (
                  <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : status.chainReachable ? (
                  <span className="flex items-center gap-1 text-sm text-primary">
                    <CheckCircle className="h-4 w-4" />
                    Erreichbar
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-sm text-destructive">
                    <XCircle className="h-4 w-4" />
                    Nicht erreichbar
                  </span>
                )}
              </div>

              {/* Package-ID Historie + Auswahl */}
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Package-ID wählen</Label>
                <Select
                  value={selectedPackageId || 'current'}
                  onValueChange={(v) => setSelectedPackageId(v === 'current' ? '' : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Aktuell" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="current">Aktuell</SelectItem>
                    {(packageHistory.history || []).map((id) => (
                      <SelectItem key={id} value={id}>
                        {id.length > 16 ? `${id.slice(0, 10)}…${id.slice(-6)}` : id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={settingPackageId || !selectedPackageId || selectedPackageId === (status.packageId || packageHistory.current)}
                  onClick={async () => {
                    if (!selectedPackageId?.trim()) return
                    setSettingPackageId(true)
                    await executeCommand('/set-package-id', [selectedPackageId.trim()])
                    await fetchStatus()
                    setSettingPackageId(false)
                  }}
                >
                  {settingPackageId ? 'Setze…' : 'Package-ID setzen'}
                </Button>
              </div>

              {/* RPC setzen */}
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">RPC_URL</Label>
                <Input
                  placeholder="https://..."
                  value={rpcUrl}
                  onChange={(e) => setRpcUrl(e.target.value)}
                  className="font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={savingRpc}
                  onClick={async () => {
                    setSavingRpc(true)
                    await setConfig('RPC_URL', rpcUrl)
                    setSavingRpc(false)
                  }}
                >
                  {savingRpc ? '…' : 'RPC setzen'}
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                Weitere Keys unter &quot;.env anpassen&quot; (Config-View).
              </p>
            </>
          )}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => {
              setOpen(false)
              onOpenConfig?.()
            }}
          >
            .env anpassen
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={checkNode}
            disabled={checking}
          >
            {checking ? (
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Node prüfen
          </Button>
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Schließen
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
