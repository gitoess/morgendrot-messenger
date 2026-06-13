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
    title: 'Scan peering QR',
    description: 'Hold the partner QR in the frame.',
  })

  const addrOk = /^0x[a-fA-F0-9]{64}$/i.test(myAddress.trim())

  const loadMyQr = useCallback(async () => {
    setBuildErr('')
    setQrText('')
    setQrDataUrl('')
    if (!addrOk) {
      setBuildErr('Your 0x address is missing (status / chain IDs).')
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
      if (s.error !== 'Scan cancelled.') {
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
      onStatus?.('No peering or contact QR recognized.')
      return
    }
    let applyNetwork = false
    if (peeringQrHasNetworkHints(parsed) && typeof window !== 'undefined') {
      const parts: string[] = []
      if (parsed.rpcUrl) parts.push(`RPC: ${parsed.rpcUrl}`)
      if (parsed.packageId) parts.push(`Package: ${parsed.packageId.slice(0, 14)}…`)
      applyNetwork = window.confirm(
        `Apply network from QR?\n${parts.join('\n')}\nOnly scan from a trusted partner.`
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
      r.networkApplied?.length ? ` Network: ${r.networkApplied.join(', ')}.` : ''
    const hint = r.peerPubStored
      ? `Peering applied: ${maskWalletAddress(r.address)} + peer pub stored.${netNote}`
      : `Address applied: ${maskWalletAddress(r.address)} (no ECDH pub in QR).${netNote}`
    onStatus?.(hint)
  }

  const hintLine = useMemo(() => {
    if (!addrOk) return 'Address required from status.'
    return 'For encrypted online chat: exchange partner address (QR or 0x only).'
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
          My peering QR
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 text-xs"
          disabled={disabled}
          onClick={() => void handleScan()}
        >
          Scan peering QR
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 text-xs"
          disabled={disabled}
          onClick={() => setPasteOpen(true)}
        >
          Paste QR text
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
            <summary className="cursor-pointer text-[10px] font-medium text-muted-foreground">Technical QR text</summary>
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
            <DialogTitle>Paste peering QR</DialogTitle>
            <DialogDescription>Paste wallet JSON from QR or the 0x address only.</DialogDescription>
          </DialogHeader>
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={6}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-[11px]"
            placeholder='{"v":2,"k":"mp","a":"0x…","e":"BAA…"}'
          />
          <Button type="button" className="w-full" onClick={() => applyRaw(pasteText)}>
            Apply
          </Button>
        </DialogContent>
      </Dialog>
    </>
  )
}
