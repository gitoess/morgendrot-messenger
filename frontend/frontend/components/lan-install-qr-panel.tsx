'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { QrCode } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  applyInstallQrApiBase,
  buildInstallQrPayload,
  parseInstallQrPayload,
  resolveBossLanInstallUrls,
} from '@/frontend/lib/install-qr'
import { scanMeshBundleQrWithCamera } from '@/frontend/lib/mesh-qr'
import QRCode from 'qrcode'

export type LanInstallQrPanelProps = {
  className?: string
  onStatus?: (msg: string) => void
  /** `embedded` = Einsatzleitung (verständliche Texte); `dashboard` = veraltet, nicht mehr auf Startseite. */
  variant?: 'embedded' | 'dashboard'
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
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pendingApi, setPendingApi] = useState('')

  const urls = useMemo(() => resolveBossLanInstallUrls(), [showBossQr])

  const loadBossQr = useCallback(async () => {
    setBuildErr('')
    setQrText('')
    setQrDataUrl('')
    const { pwaUrl, apiBaseUrl, loopbackWarning } = resolveBossLanInstallUrls()
    if (!pwaUrl) {
      setBuildErr('Keine PWA-URL (nur im Browser).')
      return
    }
    if (loopbackWarning) setBuildErr(loopbackWarning)
    try {
      const text = buildInstallQrPayload({
        pwaUrl,
        apiBaseUrl,
        label: 'Boss-LAN',
      })
      setQrText(text)
      const url = await QRCode.toDataURL(text, { width: 240, margin: 2 })
      setQrDataUrl(url)
    } catch (e) {
      setBuildErr(e instanceof Error ? e.message : String(e))
    }
  }, [])

  useEffect(() => {
    if (showBossQr) void loadBossQr()
  }, [showBossQr, loadBossQr])

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
      const open = window.confirm(
        `PWA-Seite öffnen?\n\n${parsed.pwaUrl}\n\n(Danach im Browser „App installieren“ / Zum Home-Bildschirm.)`
      )
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
    const s = await scanMeshBundleQrWithCamera()
    if ('error' in s) {
      setPasteOpen(true)
      onStatus?.(s.error)
      return
    }
    applyRaw(s.bundleJson)
  }

  const isEmbedded = variant === 'embedded'

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
          <div>
            <h4 className="font-semibold text-foreground">
              {isEmbedded ? 'Helfer per QR einbinden (WLAN)' : 'Boss-LAN: PWA per QR'}
            </h4>
            <p className="mt-1 text-sm text-muted-foreground">
              {isEmbedded ? (
                <>
                  <strong className="text-foreground">Nur Installation im LAN</strong> — kein Handoff-ZIP, keine Kontakte.
                  Am Einsatz-PC Messenger im WLAN starten (<code className="rounded bg-muted px-1 text-xs">npm run dev:lan</code>
                  ), dann QR anzeigen. Helfer scannen → PWA öffnen →{' '}
                  <strong className="text-foreground">zum Home-Bildschirm hinzufügen</strong>. Im QR stecken PWA-URL und
                  API-Basis für dieses Gerät.
                </>
              ) : (
                <>
                  QR für PWA-Installation im lokalen Netz. Am PC zuerst{' '}
                  <code className="rounded bg-muted px-1 text-xs">npm run dev:lan</code> (Firewall 3341/3342).
                </>
              )}
            </p>
          </div>
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
              QR scannen (Helfer-Gerät)
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

      <Dialog open={showBossQr} onOpenChange={setShowBossQr}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>QR für Helfer-Einbindung</DialogTitle>
            <DialogDescription>
              Helfer im gleichen WLAN scannen → Messenger öffnen → App installieren. Technische URLs stehen unten im
              Textfeld.
            </DialogDescription>
          </DialogHeader>
          {buildErr ? (
            <p className="text-xs text-amber-800 dark:text-amber-200" role="status">
              {buildErr}
            </p>
          ) : null}
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="Boss-LAN Install QR" className="mx-auto rounded-lg border border-border" />
          ) : null}
          <textarea
            readOnly
            value={qrText}
            rows={4}
            className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 font-mono text-[10px]"
          />
        </DialogContent>
      </Dialog>

      <Dialog open={pasteOpen} onOpenChange={setPasteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Install-QR einfügen</DialogTitle>
            <DialogDescription>JSON (`mi`) oder http(s)-Link zur PWA.</DialogDescription>
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
            <DialogDescription>
              Speichert die Morgendrot-API-URL für dieses Gerät (APK/PWA). Nur aus vertrauenswürdigem Boss-QR.
            </DialogDescription>
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
    </div>
  )
}
