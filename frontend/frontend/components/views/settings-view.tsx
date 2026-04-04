'use client'

import { useState, useEffect } from 'react'
import {
  Settings,
  Wifi,
  WifiOff,
  Copy,
  Check,
  RefreshCw,
  RotateCw,
  Globe,
  Package,
  Wallet,
  Server,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Switch } from '@/components/ui/switch'
import { getStatus, transferCoins, restartBackend } from '../../lib/api'

interface SettingsViewProps {
  onOpenConfig?: () => void
  /** Arbeiter/Lock: Kachel-Ansicht dauerhaft (localStorage). */
  showAllTiles?: boolean
  onShowAllTilesChange?: (value: boolean) => void
  canToggleFullTiles?: boolean
}

export function SettingsView({
  onOpenConfig,
  showAllTiles = false,
  onShowAllTilesChange,
  canToggleFullTiles = false,
}: SettingsViewProps) {
  const [status, setStatus] = useState<{
    network: string
    address: string
    packageId: string
    backendOnline: boolean
    chatConnected: boolean
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState<string | null>(null)
  
  // Transfer state
  const [transferTo, setTransferTo] = useState('')
  const [transferAmount, setTransferAmount] = useState('')
  const [transferring, setTransferring] = useState(false)
  const [transferStatus, setTransferStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [transferMsg, setTransferMsg] = useState('')
  const [restarting, setRestarting] = useState(false)
  const [restartMsg, setRestartMsg] = useState('')

  const loadStatus = async () => {
    setLoading(true)
    const res = await getStatus()
    if (res.ok && res.data) {
      setStatus(res.data)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadStatus()
  }, [])

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  const handleTransfer = async () => {
    if (!transferTo || !transferAmount) return
    setTransferring(true)
    setTransferStatus('idle')
    
    const res = await transferCoins(transferTo, parseFloat(transferAmount))
    
    if (res.ok) {
      setTransferStatus('success')
      setTransferMsg('Transfer erfolgreich!')
      setTransferTo('')
      setTransferAmount('')
    } else {
      setTransferStatus('error')
      setTransferMsg(res.error || 'Transfer fehlgeschlagen')
    }
    
    setTransferring(false)
    setTimeout(() => setTransferStatus('idle'), 5000)
  }

  const handleRestart = async () => {
    setRestarting(true)
    setRestartMsg('')
    try {
      const res = await restartBackend()
      if (res.ok) {
        setRestartMsg('Neustart ausgelöst – Verbindung bricht ab; Seite in Kürze neu laden.')
      } else {
        setRestartMsg(res.error || 'Neustart fehlgeschlagen')
      }
    } catch (e) {
      setRestartMsg(String((e as Error)?.message || e))
    }
    setRestarting(false)
  }

  const maskAddress = (addr: string) => {
    if (!addr || addr.length < 16) return addr
    return `${addr.slice(0, 10)}...${addr.slice(-8)}`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <Settings className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">Einstellungen</h2>
          <p className="text-sm text-muted-foreground">Netzwerk-Status und Konfiguration</p>
        </div>
      </div>

      {/* Status Card */}
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h4 className="font-semibold text-foreground">Verbindungsstatus</h4>
          <button
            onClick={loadStatus}
            disabled={loading}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Aktualisieren
          </button>
        </div>
        
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">
            <RefreshCw className="mx-auto mb-2 h-6 w-6 animate-spin" />
            Lade Status...
          </div>
        ) : status ? (
          <div className="divide-y divide-border">
            {/* Backend vs Chat-Partner (connected = nur /connect, nicht „API offline“) */}
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <Server className="h-5 w-5 text-emerald-400/90" />
                <div>
                  <span className="text-foreground">Backend (API)</span>
                  <p className="text-xs text-muted-foreground">Erreichbar, solange diese Seite Status laden kann</p>
                </div>
              </div>
              <span
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-medium',
                  status.backendOnline
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-red-500/10 text-red-400'
                )}
              >
                {status.backendOnline ? 'Online' : 'Offline'}
              </span>
            </div>

            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                {status.chatConnected ? (
                  <Wifi className="h-5 w-5 text-emerald-400" />
                ) : (
                  <WifiOff className="h-5 w-5 text-amber-500/90" />
                )}
                <div>
                  <span className="text-foreground">Chat-Partner</span>
                  <p className="text-xs text-muted-foreground">
                    Nach <code className="rounded bg-muted px-1">/connect</code> mit Messenger-Peer
                  </p>
                </div>
              </div>
              <span
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-medium',
                  status.chatConnected
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-amber-500/10 text-amber-400'
                )}
              >
                {status.chatConnected ? 'Verbunden' : 'Nicht gekoppelt'}
              </span>
            </div>

            {/* Network */}
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <Globe className="h-5 w-5 text-muted-foreground" />
                <span className="text-foreground">Netzwerk (RPC)</span>
              </div>
              <span className="max-w-[min(100%,14rem)] truncate font-mono text-sm text-muted-foreground" title={status.network}>
                {status.network && status.network !== '—' ? status.network : '—'}
              </span>
            </div>

            {/* Address */}
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <Wallet className="h-5 w-5 text-muted-foreground" />
                <span className="text-foreground">Adresse</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-muted-foreground">
                  {maskAddress(status.address)}
                </span>
                <button
                  onClick={() => copyToClipboard(status.address, 'address')}
                  className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  {copied === 'address' ? (
                    <Check className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Package ID */}
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <Package className="h-5 w-5 text-muted-foreground" />
                <span className="text-foreground">Package-ID</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-muted-foreground">
                  {status.packageId ? maskAddress(status.packageId) : '—'}
                </span>
                {!!status.packageId && (
                  <button
                    type="button"
                    onClick={() => copyToClipboard(status.packageId, 'packageId')}
                    className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    {copied === 'packageId' ? (
                      <Check className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-muted-foreground">
            <WifiOff className="mx-auto mb-2 h-8 w-8" />
            Keine Verbindung zum Backend
          </div>
        )}
      </div>

      {canToggleFullTiles && onShowAllTilesChange && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h4 className="font-semibold text-foreground">Volle Oberfläche</h4>
              <p className="mt-1 text-sm text-muted-foreground">
                Alle Funktions-Kacheln anzeigen (wie nach „Alle Funktionen“ auf dem Dashboard). Wird in diesem Browser gespeichert.
              </p>
            </div>
            <Switch
              checked={showAllTiles}
              onCheckedChange={onShowAllTilesChange}
              aria-label="Alle Kacheln anzeigen"
            />
          </div>
        </div>
      )}

      {/* Transfer Card */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h4 className="mb-4 font-semibold text-foreground">IOTA überweisen</h4>
        
        {transferStatus !== 'idle' && (
          <div
            className={cn(
              'mb-4 flex items-center gap-2 rounded-lg p-3 text-sm font-medium',
              transferStatus === 'success'
                ? 'bg-emerald-500/10 text-emerald-400'
                : 'bg-red-500/10 text-red-400'
            )}
          >
            {transferStatus === 'success' ? <Check className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
            {transferMsg}
          </div>
        )}
        
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm text-muted-foreground">Empfänger</label>
            <input
              type="text"
              value={transferTo}
              onChange={(e) => setTransferTo(e.target.value)}
              placeholder="0x..."
              className="w-full rounded-lg border border-border bg-input px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-muted-foreground">Betrag (IOTA)</label>
            <input
              type="number"
              value={transferAmount}
              onChange={(e) => setTransferAmount(e.target.value)}
              placeholder="0.1"
              step="0.01"
              min="0"
              className="w-full rounded-lg border border-border bg-input px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
          </div>
        </div>
        <button
          onClick={handleTransfer}
          disabled={transferring || !transferTo || !transferAmount}
          className="mt-4 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {transferring ? 'Überweise...' : 'Überweisen'}
        </button>
      </div>

      {/* Backend neu starten */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h4 className="mb-2 font-semibold text-foreground">Backend</h4>
        <p className="mb-3 text-sm text-muted-foreground">
          Serverprozess neu starten (z. B. nach .env-Änderungen). Verbindung bricht kurz ab.
        </p>
        <button
          onClick={handleRestart}
          disabled={restarting}
          className="inline-flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-600 hover:bg-amber-500/20 disabled:opacity-50"
        >
          <RotateCw className={cn('h-4 w-4', restarting && 'animate-spin')} />
          {restarting ? 'Starte neu…' : 'Backend neu starten'}
        </button>
        {restartMsg && (
          <p className="mt-2 text-sm text-muted-foreground">{restartMsg}</p>
        )}
      </div>

      {/* .env anpassen */}
      {onOpenConfig && (
        <div className="rounded-xl border border-border bg-card p-4">
          <h4 className="mb-2 font-semibold text-foreground">Konfiguration</h4>
          <p className="mb-3 text-sm text-muted-foreground">
            Alle Umgebungs-Keys anzeigen und setzen (Config-View).
          </p>
          <button
            onClick={onOpenConfig}
            className="rounded-lg border border-border bg-muted px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
          >
            .env anpassen
          </button>
        </div>
      )}

      {/* Lokales Vault-Passwort vergessen */}
      <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4">
        <h4 className="mb-2 font-semibold text-foreground">Lokales Vault-Passwort vergessen?</h4>
        <p className="mb-2 text-sm text-muted-foreground">
          Die Datei <span className="font-mono">.morgendrot-vault</span> (oder <span className="font-mono">VAULT_FILE</span>)
          ist verschlüsselt – ohne Passwort ist der Inhalt nicht wiederherstellbar.
        </p>
        <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
          <li>
            <span className="text-foreground">Neu anlegen:</span> alte Vault-Datei wegsichern/umbenennen, Wallet über
            Mnemonic/Keystore wiederherstellen oder neu erzeugen, <span className="font-mono">MY_ADDRESS</span> in{' '}
            <span className="font-mono">.env</span> anpassen.
          </li>
          <li>
            <span className="text-foreground">PACKAGE_ID:</span> oft gleich lassen, wenn alle dasselbe Move-Paket nutzen;
            sonst neues Paket deployen und überall die neue ID setzen.
          </li>
          <li>
            Nach Handshake/Connect: <span className="font-mono">/vault-save</span> oder Tresor „lokal sichern“ – erzeugt
            eine neue verschlüsselte Datei mit <strong>neuem</strong> Passwort deiner Wahl.
          </li>
          <li>
            War der Tresor nur lokal und nie on-chain: Inhalt ist verloren. War er on-chain: mit <strong>bekanntem</strong>{' '}
            Wallet-Passwort <span className="font-mono">/vault-load-from-chain</span> möglich – nicht mit einem
            erfundenen Passwort.
          </li>
        </ul>
      </div>

      {/* Info */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h4 className="mb-2 font-semibold text-foreground">Hilfe</h4>
        <p className="text-sm text-muted-foreground">
          Next-UI (Kacheln): <span className="font-mono">http://127.0.0.1:3341</span> · Backend-API:{' '}
          <span className="font-mono">http://127.0.0.1:3342</span> (Port kann weichen – in der Kopfzeile „API:…“).
          Lite-UI liegt auf dem API-Port. Start: <code>npm run dev</code>.{' '}
          <span className="font-mono">.env</span> prüfen.
        </p>
      </div>
    </div>
  )
}
