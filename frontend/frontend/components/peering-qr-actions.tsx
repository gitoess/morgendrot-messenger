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
import { exportDirectChatEcdhPublicKeyRawBase64 } from '@/frontend/lib/direct-chat-ecdh-session'
import { useMeshQrCameraScan } from '@/frontend/hooks/use-mesh-qr-camera-scan'
import { getDirectMailboxChainSnapshot } from '@/frontend/lib/direct-iota-chain-context'
import { getConfiguredDirectIotaRpcUrl } from '@/frontend/lib/direct-iota-rpc'
import {
  applyPeeringQrImport,
  buildPeeringQrPayload,
  parsePeeringQrPayload,
  peeringQrHasNetworkHints,
} from '@/frontend/lib/peering-qr'
import { maskWalletAddress } from '@/frontend/lib/contact-phonebook-format'
import QRCode from 'qrcode'

export type PeeringQrActionsProps = {
  myAddress: string
  displayName?: string
  disabled?: boolean
  className?: string
  /** Nach erfolgreichem Scan (Partner-Adresse + ggf. Pub). */
  onImported?: (r: {
    address: string
    displayName?: string
    peerPubStored: boolean
    networkApplied?: string[]
  }) => void
  /** RPC + Package-ID ins Peering-QR (Boss-LAN / Helfer ohne Handoff-ZIP). */
  includeNetworkInQr?: boolean
  onStatus?: (msg: string) => void
}

export function PeeringQrActions(p: PeeringQrActionsProps) {
  const {
    myAddress,
    displayName,
    disabled = false,
    className,
    onImported,
    onStatus,
    includeNetworkInQr = false,
  } = p
  const [showOpen, setShowOpen] = useState(false)
  const [qrText, setQrText] = useState('')
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [buildErr, setBuildErr] = useState('')
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const { startScan, cameraDialog } = useMeshQrCameraScan({
    title: 'Peering-QR scannen',
    description: 'Partner-QR in den Rahmen halten.',
  })

  const addrOk = /^0x[a-fA-F0-9]{64}$/i.test(myAddress.trim())

  const loadMyQr = useCallback(async () => {
    setBuildErr('')
    setQrText('')
    setQrDataUrl('')
    if (!addrOk) {
      setBuildErr('Eigene 0x-Adresse fehlt (Status / Ketten-IDs).')
      return
    }
    const snap = getDirectMailboxChainSnapshot()
    const net =
      includeNetworkInQr
        ? {
            rpcUrl: getConfiguredDirectIotaRpcUrl() ?? undefined,
            packageId: snap?.packageId?.trim() || undefined,
          }
        : {}

    const pub = await exportDirectChatEcdhPublicKeyRawBase64()
    if (!pub.ok) {
      setBuildErr(pub.error)
      try {
        const fallback = buildPeeringQrPayload({
          address: myAddress.trim(),
          displayName,
          ...net,
        })
        setQrText(fallback)
        const url = await QRCode.toDataURL(fallback, { width: 220, margin: 2 })
        setQrDataUrl(url)
      } catch (e) {
        setBuildErr(e instanceof Error ? e.message : String(e))
      }
      return
    }
    try {
      const text = buildPeeringQrPayload({
        address: myAddress.trim(),
        ecdhPubB64: pub.b64,
        displayName,
        ...net,
      })
      setQrText(text)
      const url = await QRCode.toDataURL(text, { width: 220, margin: 2 })
      setQrDataUrl(url)
    } catch (e) {
      setBuildErr(e instanceof Error ? e.message : String(e))
    }
  }, [addrOk, myAddress, displayName, includeNetworkInQr])

  useEffect(() => {
    if (showOpen) void loadMyQr()
  }, [showOpen, loadMyQr])

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

  const applyRaw = (raw: string) => {
    const parsed = parsePeeringQrPayload(raw)
    if (!parsed) {
      onStatus?.('Kein Peering- oder Kontakt-QR erkannt.')
      return
    }
    let applyNetwork = false
    if (peeringQrHasNetworkHints(parsed) && typeof window !== 'undefined') {
      const parts: string[] = []
      if (parsed.rpcUrl) parts.push(`RPC: ${parsed.rpcUrl}`)
      if (parsed.packageId) parts.push(`Package: ${parsed.packageId.slice(0, 14)}…`)
      applyNetwork = window.confirm(
        `Netzwerk aus QR übernehmen?\n${parts.join('\n')}\nNur von vertrauenswürdigem Partner scannen.`
      )
    }
    const r = applyPeeringQrImport(parsed, { applyNetworkHints: applyNetwork })
    if (!r.ok) {
      onStatus?.(r.error)
      return
    }
    setPasteOpen(false)
    onImported?.({
      address: r.address,
      displayName: r.displayName,
      peerPubStored: r.peerPubStored,
      networkApplied: r.networkApplied,
    })
    const netNote =
      r.networkApplied?.length ? ` Netzwerk: ${r.networkApplied.join(', ')}.` : ''
    const hint = r.peerPubStored
      ? `Peering übernommen: ${maskWalletAddress(r.address)} + Peer-Pub gespeichert.${netNote}`
      : `Adresse übernommen: ${maskWalletAddress(r.address)} (ohne ECDH-Pub im QR).${netNote}`
    onStatus?.(hint)
  }

  const hintLine = useMemo(() => {
    if (!addrOk) return 'Adresse aus Status nötig.'
    return 'Für verschlüsselten Online-Chat: Partner-Adresse austauschen (QR oder nur 0x).'
  }, [addrOk])

  return (
    <>
      <div className={className ?? 'flex flex-wrap gap-2'}>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="h-8 text-xs"
          disabled={disabled || !addrOk}
          onClick={() => setShowOpen(true)}
        >
          <QrCode className="mr-1.5 h-3.5 w-3.5" aria-hidden />
          Mein Peering-QR
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 text-xs"
          disabled={disabled}
          onClick={() => void handleScan()}
        >
          Peering-QR scannen
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 text-xs"
          disabled={disabled}
          onClick={() => setPasteOpen(true)}
        >
          QR-Text einfügen
        </Button>
      </div>

      <Dialog open={showOpen} onOpenChange={setShowOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Peering-QR</DialogTitle>
            <DialogDescription>{hintLine}</DialogDescription>
          </DialogHeader>
          <p className="text-xs leading-relaxed text-muted-foreground">
            <strong className="text-foreground">Wofür?</strong> Partner für <strong className="text-foreground">verschlüsselten IOTA-Chat</strong>{' '}
            kennenlernen — QR scannen reicht oft ohne laufende Morgendrot-Basis. Danach online: Handshake / Connect.
            <br />
            <strong className="text-foreground">Nicht</strong> LoRa-Funk und <strong className="text-foreground">nicht</strong> Team-Mailbox-ID: nur die{' '}
            <strong className="text-foreground">Wallet (0x)</strong>. Wenn der QR zusätzlich einen Schlüssel enthält, kann die App sofort
            verschlüsseln; sonst nur die Adresse (wie „nur 0x weitergeben“).
          </p>
          {buildErr ? (
            <p className="text-xs text-amber-800 dark:text-amber-200">{buildErr}</p>
          ) : null}
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="Peering QR" className="mx-auto rounded-lg border border-border" />
          ) : null}
          <details className="rounded-lg border border-border/60 bg-muted/20 px-2 py-1.5">
            <summary className="cursor-pointer text-[10px] font-medium text-muted-foreground">Technischer QR-Text</summary>
            <textarea
              readOnly
              value={qrText}
              rows={4}
              className="mt-2 w-full rounded border-0 bg-transparent px-1 py-1 font-mono text-[10px]"
            />
          </details>
        </DialogContent>
      </Dialog>

      {cameraDialog}

      <Dialog open={pasteOpen} onOpenChange={setPasteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Peering-QR einfügen</DialogTitle>
            <DialogDescription>Wallet-JSON aus QR oder nur die 0x-Adresse einfügen.</DialogDescription>
          </DialogHeader>
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={6}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-[11px]"
            placeholder='{"v":2,"k":"mp","a":"0x…","e":"BAA…"}'
          />
          <Button type="button" className="w-full" onClick={() => applyRaw(pasteText)}>
            Übernehmen
          </Button>
        </DialogContent>
      </Dialog>
    </>
  )
}
