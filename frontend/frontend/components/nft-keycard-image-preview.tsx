'use client'

/**
 * Optionale Bildvorschau einer NFT-Schlüsselkarte (Object-ID).
 */

import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { decryptEvidenceImageBytes } from '@/frontend/lib/evidence-image-crypto'
import {
  evidenceImageBytesToObjectUrl,
  extractIpfsCid,
  ipfsCidDisplayUrlFallbacks,
} from '@/frontend/lib/evidence-onchain-image'
import { loadEvidenceImageFromObjectId } from '@/frontend/lib/evidence-onchain-image-fetch'
import { lookupEvidencePassphrase } from '@/frontend/lib/evidence-passphrase-local-store'
import { lookupPassphraseForNftKeycard } from '@/frontend/lib/nft-keycard-local-store'

const LS_SHOW = 'morgendrot.nftKeycard.showImage.v1'

export function readNftKeycardShowImage(): boolean {
  if (typeof window === 'undefined') return true
  try {
    const v = window.localStorage.getItem(LS_SHOW)
    if (v === '0') return false
    if (v === '1') return true
  } catch {
    /* ignore */
  }
  return true
}

export function writeNftKeycardShowImage(on: boolean): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LS_SHOW, on ? '1' : '0')
  } catch {
    /* ignore */
  }
}

function revokeIfBlob(u: string | null | undefined) {
  if (!u || !u.startsWith('blob:')) return
  try {
    URL.revokeObjectURL(u)
  } catch {
    /* ignore */
  }
}

export function NftKeycardImagePreview(p: {
  objectId: string
  /** Bereits bekannte Preview-URL (z. B. aus Galerie) — spart RPC. */
  hintUrl?: string | null
  disabled?: boolean
  compact?: boolean
  className?: string
}) {
  const [show, setShow] = useState(true)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [url, setUrl] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [reloadTick, setReloadTick] = useState(0)
  const ownsUrlRef = useRef(false)
  const urlRef = useRef<string | null>(null)

  const replaceUrl = (next: string | null, owned: boolean) => {
    if (ownsUrlRef.current) revokeIfBlob(urlRef.current)
    ownsUrlRef.current = owned
    urlRef.current = next
    setUrl(next)
  }

  useEffect(() => {
    setShow(readNftKeycardShowImage())
  }, [])

  useEffect(() => {
    if (!show) {
      replaceUrl(null, false)
      setErr('')
      setBusy(false)
      return
    }

    const oid = p.objectId.trim().toLowerCase()
    if (!/^0x[0-9a-f]{64}$/.test(oid)) {
      setErr('')
      replaceUrl(null, false)
      return
    }

    let cancelled = false
    const hint = (p.hintUrl || '').trim()

    void (async () => {
      setBusy(true)
      setErr('')
      setName('')
      replaceUrl(null, false)

      if (hint) {
        if (!cancelled) {
          replaceUrl(hint, false)
          setBusy(false)
        }
        return
      }

      try {
        const r = await loadEvidenceImageFromObjectId(oid)
        if (cancelled) return

        if (r.ok) {
          setName(r.name || '')
          if (r.source === 'embedded' && r.parsed) {
            replaceUrl(evidenceImageBytesToObjectUrl(r.parsed.bytes, r.parsed.mime), true)
            return
          }
          if (r.displayUrl) {
            const cid = extractIpfsCid(r.displayUrl)
            replaceUrl(cid ? ipfsCidDisplayUrlFallbacks(cid)[0]! : r.displayUrl, false)
            return
          }
          setErr('Kein Bild in diesem NFT.')
          return
        }

        if (r.needsPassphrase && r.ciphertext) {
          const pass =
            lookupPassphraseForNftKeycard({ objectId: oid }) ||
            lookupEvidencePassphrase({ objectId: oid, allowDefault: true }) ||
            ''
          if (pass.length >= 8) {
            try {
              const dec = await decryptEvidenceImageBytes(r.ciphertext, pass)
              if (cancelled) return
              setName(r.name || '')
              replaceUrl(evidenceImageBytesToObjectUrl(dec.bytes, dec.contentType), true)
              return
            } catch {
              setErr('Verschlüsselt — Passphrase in der Galerie entsperren oder Slot prüfen.')
              return
            }
          }
          setErr('Verschlüsselt — zuerst in der Galerie entsperren (Passphrase).')
          return
        }

        setErr(r.error || 'Bild nicht ladbar.')
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e))
      } finally {
        if (!cancelled) setBusy(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [p.objectId, p.hintUrl, show, reloadTick])

  useEffect(() => {
    return () => {
      if (ownsUrlRef.current) revokeIfBlob(urlRef.current)
      ownsUrlRef.current = false
      urlRef.current = null
    }
  }, [])

  return (
    <div className={p.className || 'space-y-1.5'}>
      <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <input
          type="checkbox"
          className="rounded border-border"
          checked={show}
          disabled={p.disabled}
          onChange={(e) => {
            const on = e.target.checked
            setShow(on)
            writeNftKeycardShowImage(on)
          }}
        />
        <span className="text-foreground">Schlüsselkarte als Bild anzeigen</span>
      </label>

      {show ? (
        <div className="overflow-hidden rounded-md border border-border/70 bg-muted/20">
          {busy ? (
            <div className="flex h-28 items-center justify-center gap-2 text-[11px] text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Bild laden…
            </div>
          ) : url ? (
            <div className="space-y-1 p-1.5">
              {name ? <p className="truncate px-1 text-[10px] text-muted-foreground">{name}</p> : null}
              <img
                src={url}
                alt={name || 'Schlüsselkarte'}
                className={
                  p.compact
                    ? 'mx-auto max-h-36 w-full object-contain'
                    : 'mx-auto max-h-48 w-full object-contain'
                }
              />
            </div>
          ) : (
            <div className="space-y-1.5 p-2.5">
              <p className="text-[11px] text-muted-foreground">{err || 'Kein Vorschaubild.'}</p>
              {err ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-[10px]"
                  disabled={p.disabled || busy}
                  onClick={() => setReloadTick((n) => n + 1)}
                >
                  Erneut laden
                </Button>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
