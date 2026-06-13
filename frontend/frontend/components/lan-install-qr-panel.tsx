'use client'

import { useCallback, useEffect, useState } from 'react'
import { QrCode } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  applyInstallQrApiBase,
  buildInstallQrScanText,
  buildLanInstallUrls,
  parseInstallQrPayload,
  pickBossLanInstallHost,
  writeLanInstallHostOverride,
} from '@/frontend/lib/install-qr'
import { useMeshQrCameraScan } from '@/frontend/hooks/use-mesh-qr-camera-scan'
import QRCode from 'qrcode'

export type LanInstallQrPanelProps = {
  className?: string
  onStatus?: (msg: string) => void
  /** `embedded` = Einsatzleitung-Karte; `inline` = nur Button + Dialoge (neben ZIP/IOTA); `dashboard` = veraltet */
  variant?: 'embedded' | 'inline' | 'dashboard'
}

export function LanInstallQrPanel({
  className,
  onStatus,
  variant = 'embedded',
}: LanInstallQrPanelProps) {
  const [showBossQr, setShowBossQr] = useState(false)
  const [qrText, setQrText] = useState('')
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [buildErr, setBuildErr] = useState('')
  const [hostOptions, setHostOptions] = useState<string[]>([])
  const [selectedHost, setSelectedHost] = useState('')
  const [manualHost, setManualHost] = useState('')
  const [needsManualHost, setNeedsManualHost] = useState(false)
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pendingApi, setPendingApi] = useState('')
  const { startScan, cameraDialog } = useMeshQrCameraScan({ title: 'Install-QR scannen' })

  const renderQrForHost = useCallback(async (host: string, uiPort: number, apiPort: number) => {
    setBuildErr('')
    setQrText('')
    setQrDataUrl('')
    const { pwaUrl, apiBaseUrl } = buildLanInstallUrls(host, uiPort, apiPort)
    try {
      const text = buildInstallQrScanText({ pwaUrl, apiBaseUrl })
      setQrText(text)
      setQrDataUrl(await QRCode.toDataURL(text, { width: 240, margin: 2 }))
      writeLanInstallHostOverride(host)
    } catch (e) {
      setBuildErr(e instanceof Error ? e.message : String(e))
    }
  }, [])

  const loadBossQr = useCallback(
    async (hostOverride?: string) => {
      setBuildErr('')
      const picked = await pickBossLanInstallHost(hostOverride)
      if (!picked) {
        setNeedsManualHost(true)
        setHostOptions([])
        setSelectedHost('')
        setQrText('')
        setQrDataUrl('')
        return
      }
      setNeedsManualHost(false)
      setHostOptions(picked.hosts)
      setSelectedHost(picked.host)
      await renderQrForHost(picked.host, picked.uiPort, picked.apiPort)
    },
    [renderQrForHost]
  )

  useEffect(() => {
    if (showBossQr) void loadBossQr()
  }, [showBossQr, loadBossQr])

  const onHostChange = (host: string) => {
    setSelectedHost(host)
    void (async () => {
      const picked = await pickBossLanInstallHost(host)
      if (picked) await renderQrForHost(picked.host, picked.uiPort, picked.apiPort)
    })()
  }

  const onApplyManualHost = () => {
    const h = manualHost.trim()
    if (!/^\d+\.\d+\.\d+\.\d+$/.test(h)) {
      setBuildErr('IPv4 eingeben (z. B. 192.168.0.10).')
      return
    }
    setBuildErr('')
    void loadBossQr(h)
  }

  const requestApplyApi = (apiBase: string) => {
    setPendingApi(apiBase)
    setConfirmOpen(true)
  }

  const confirmApply = () => {
    const r = applyInstallQrApiBase(pendingApi)
    setConfirmOpen(false)
    setPasteOpen(false)
    if (!r.ok) {
      onStatus?.(r.error)
      return
    }
    onStatus?.(`Basis-URL gespeichert: ${pendingApi}`)
  }

  const applyParsed = (parsed: NonNullable<ReturnType<typeof parseInstallQrPayload>>) => {
    if (parsed.pwaUrl && typeof window !== 'undefined') {
      const open = window.confirm(`PWA öffnen?\n\n${parsed.pwaUrl}`)
      if (open) window.open(parsed.pwaUrl, '_blank', 'noopener,noreferrer')
    }
    if (parsed.apiBaseUrl) {
      requestApplyApi(parsed.apiBaseUrl)
      return
    }
    if (!parsed.pwaUrl) {
      onStatus?.('QR ohne PWA-URL und ohne API-Basis.')
    }
  }

  const applyRaw = (raw: string) => {
    const parsed = parseInstallQrPayload(raw)
    if (!parsed) {
      onStatus?.('Kein Installations-QR (mi) oder http(s)-Link erkannt.')
      return
    }
    applyParsed(parsed)
  }

  const handleScan = async () => {
    const s = await startScan()
    if ('error' in s) {
      if (s.error !== 'Scan abgebrochen.') {
        setPasteOpen(true)
        onStatus?.(s.error)
      }
      return
    }
    applyRaw(s.bundleJson)
  }

  const isEmbedded = variant === 'embedded'
  const isInline = variant === 'inline'

  const hostPicker =
    needsManualHost || hostOptions.length > 1 ? (
      <div className="space-y-2">
        {hostOptions.length > 1 ? (
          <label className="block text-xs">
            <span className="mb-1 block text-muted-foreground">Boss-PC</span>
            <select
              className="w-full rounded-lg border border-border bg-input px-2 py-1.5 text-sm"
              value={selectedHost}
              onChange={(e) => onHostChange(e.target.value)}
            >
              {hostOptions.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {needsManualHost ? (
          <div className="flex gap-2">
            <input
              type="text"
              inputMode="decimal"
              value={manualHost}
              onChange={(e) => setManualHost(e.target.value)}
              placeholder="192.168.0.10"
              className="min-w-0 flex-1 rounded-lg border border-border bg-input px-2 py-1.5 font-mono text-sm"
            />
            <Button type="button" size="sm" variant="secondary" onClick={onApplyManualHost}>
              QR
            </Button>
          </div>
        ) : null}
      </div>
    ) : selectedHost ? (
      <p className="text-center font-mono text-xs text-muted-foreground">{selectedHost}</p>
    ) : null

  const copyInstallLink = async () => {
    if (!qrText) return
    try {
      await navigator.clipboard.writeText(qrText)
      onStatus?.('Link kopiert — im Browser mit http:// öffnen (nicht https).')
    } catch {
      onStatus?.('Kopieren fehlgeschlagen — Link unten manuell markieren.')
    }
  }

  const dialogs = (
    <>
      <Dialog open={showBossQr} onOpenChange={setShowBossQr}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>WLAN-QR</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Helfer: Handy-Kamera → Link antippen → Messenger im Browser → „Zum Home-Bildschirm“. Gleiches WLAN
            wie der Boss-PC (Boss startet normal — kein Extra-Terminal).
          </p>
          <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-950 dark:text-amber-100">
            <strong>Wichtig:</strong> Link beginnt mit <span className="font-mono">http://</span> — kein{' '}
            <span className="font-mono">https://</span>. Wenn das Handy „sichere Verbindung“ verlangt: Link
            kopieren und in Chrome/Safari <strong>manuell</strong> als <span className="font-mono">http://192…:3341</span>{' '}
            eingeben.
          </p>
          {hostPicker}
          {buildErr ? (
            <p className="text-xs text-amber-800 dark:text-amber-200" role="status">
              {buildErr}
            </p>
          ) : null}
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="WLAN Install QR" className="mx-auto rounded-lg border border-border" />
          ) : null}
          {qrText ? (
            <>
              <textarea
                readOnly
                value={qrText}
                rows={2}
                className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 font-mono text-[10px]"
                aria-label="Installations-Link"
              />
              <Button type="button" size="sm" variant="secondary" className="w-full" onClick={() => void copyInstallLink()}>
                Link kopieren
              </Button>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={pasteOpen} onOpenChange={setPasteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Install-QR einfügen</DialogTitle>
          </DialogHeader>
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={6}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-[11px]"
            placeholder='{"v":2,"k":"mi","w":"http://192.168.0.10:3341","b":"http://192.168.0.10:3342"}'
          />
          <Button type="button" className="w-full" onClick={() => applyRaw(pasteText)}>
            Übernehmen
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>API-Basis übernehmen?</DialogTitle>
          </DialogHeader>
          <p className="break-all font-mono text-xs text-foreground">{pendingApi}</p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setConfirmOpen(false)}>
              Abbrechen
            </Button>
            <Button type="button" className="flex-1" onClick={confirmApply}>
              Speichern
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {cameraDialog}
    </>
  )

  if (isInline) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowBossQr(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-violet-500/45 bg-violet-500/15 px-5 py-3 text-sm font-semibold text-foreground hover:bg-violet-500/25 sm:w-auto"
        >
          <QrCode className="h-4 w-4 shrink-0" aria-hidden />
          WLAN-QR
        </button>
        {dialogs}
      </>
    )
  }

  return (
    <div
      id="lan-install-qr"
      className={className ?? 'rounded-xl border border-border bg-card p-4'}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <QrCode className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <h4 className="font-semibold text-foreground">
            {isEmbedded ? 'WLAN-QR' : 'Boss-LAN: PWA per QR'}
          </h4>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="default"
              className="h-9 text-xs"
              onClick={() => setShowBossQr(true)}
            >
              <QrCode className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              QR anzeigen
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-9 text-xs"
              onClick={() => void handleScan()}
            >
              QR scannen
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-9 text-xs"
              onClick={() => setPasteOpen(true)}
            >
              Link einfügen
            </Button>
          </div>
        </div>
      </div>
      {dialogs}
    </div>
  )
}
