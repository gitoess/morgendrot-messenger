'use client'

/**
 * Evidenz-Werkzeug: ImageNFT anzeigen / Owner-Galerie / minten (+ optionale Passphrase).
 * Posteingang-COMPACT_IMG ist ein anderer Kanal — erscheint hier nicht.
 */

import { useCallback, useEffect, useState } from 'react'
import { ImageIcon, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { decryptEvidenceImageBytes } from '@/frontend/lib/evidence-image-crypto'
import { mintEvidenceImageNft } from '@/frontend/lib/evidence-image-mint'
import {
  EVIDENCE_ATTR_MAX_PAIRS,
  unpackEvidenceDescription,
  type EvidenceAttrPair,
} from '@/frontend/lib/evidence-image-attrs'
import { getDirectIotaSessionSignerAddress } from '@/frontend/lib/direct-iota-mnemonic-session'
import {
  EVIDENCE_IMAGE_MAX_RAW_BYTES,
  EVIDENCE_IMAGE_OWNER_PAGE_SIZE,
  evidenceImageBytesToObjectUrl,
  extractIpfsCid,
  ipfsCidDisplayUrlFallbacks,
  ipfsCidToBrowserViewUrl,
  isPlausibleIotaObjectId,
  KNOWN_IMAGE_NFT_PACKAGE_IDS,
  type EvidenceObjectTypeMatch,
  type EvidenceOwnerListItem,
} from '@/frontend/lib/evidence-onchain-image'
import {
  loadEvidenceImageFromObjectId,
  loadEvidenceImagesByOwner,
} from '@/frontend/lib/evidence-onchain-image-fetch'
import {
  collectCompactImagesFromInboxMessages,
  decodeInboxWireImagePage,
  type InboxWireImageCandidate,
  type InboxWireImageRow,
} from '@/frontend/lib/evidence-wire-inbox-images'
import {
  scanMailboxPlaintextForAddress,
  type MailboxPlainScanRow,
} from '@/frontend/lib/evidence-mailbox-plain-scan'
import { getDirectMailboxChainSnapshot } from '@/frontend/lib/direct-iota-chain-context'
import {
  lookupEvidencePassphrase,
  rememberEvidencePassphrase,
} from '@/frontend/lib/evidence-passphrase-local-store'

type Mode = 'object' | 'owner' | 'mint' | 'wire' | 'mailbox'

type PreviewMeta = {
  mime: string
  bytes: number
  match?: EvidenceObjectTypeMatch
  name?: string
  description?: string
  classification?: string
  attrs?: EvidenceAttrPair[]
  encryptedFlag?: boolean
  objectId?: string
  /** embedded = image_data; url = HTTP/IPFS */
  source?: 'embedded' | 'url'
  /** IPFS-CID für Gateway-Fallback / Browser-Link */
  ipfsCid?: string
  browserViewUrl?: string
}

function metaFromDescription(description?: string): { body?: string; attrs: EvidenceAttrPair[] } {
  if (!description) return { attrs: [] }
  const u = unpackEvidenceDescription(description)
  return { body: u.body || undefined, attrs: u.attrs }
}

function isRevocableObjectUrl(u: string): boolean {
  return u.startsWith('blob:') || u.startsWith('object:')
}

function revokeIfObjectUrl(u: string | null | undefined) {
  if (!u || !isRevocableObjectUrl(u)) return
  try {
    URL.revokeObjectURL(u)
  } catch {
    /* ignore */
  }
}

function revokeAll(urls: string[]) {
  for (const u of urls) revokeIfObjectUrl(u)
}

export function ChatViewEvidenceImageViewerButton(p?: {
  triggerClassName?: string
  triggerLabel?: string
  /** Start-Tab beim Öffnen (ohne Auto-Laden). */
  defaultMode?: Mode
  /** Lokaler Posteingang — für Tab „Wire/Posteingang“. */
  messages?: readonly {
    id?: string
    content?: string
    text?: string
    ts?: number
    timestamp?: number
    sender?: string
    recipient?: string
  }[]
}) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<Mode>(p?.defaultMode || 'object')
  const [query, setQuery] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [meta, setMeta] = useState<PreviewMeta | null>(null)
  const [pendingCipher, setPendingCipher] = useState<Uint8Array | null>(null)
  const [pendingMatch, setPendingMatch] = useState<EvidenceObjectTypeMatch | undefined>()
  const [pendingName, setPendingName] = useState<string | undefined>()
  const [pendingObjectId, setPendingObjectId] = useState<string | undefined>()
  const [ownerItems, setOwnerItems] = useState<
    Array<
      EvidenceOwnerListItem & {
        previewUrl?: string
        attrs?: EvidenceAttrPair[]
        rememberedPass?: string
      }
    >
  >([])
  const [ownerCursor, setOwnerCursor] = useState<string | null>(null)
  const [ownerHasNext, setOwnerHasNext] = useState(false)
  const [ownerAddress, setOwnerAddress] = useState('')

  const [mintName, setMintName] = useState('MORGENDROT Evidence')
  const [mintDesc, setMintDesc] = useState('')
  const [mintClassification, setMintClassification] = useState('evidence')
  const [mintContentType, setMintContentType] = useState('image/jpeg')
  const [mintHashPreview, setMintHashPreview] = useState('')
  const [mintAttrs, setMintAttrs] = useState<EvidenceAttrPair[]>([])
  const [mintEncrypt, setMintEncrypt] = useState(true)
  const [mintFile, setMintFile] = useState<File | null>(null)
  const [sharePassphrase, setSharePassphrase] = useState('')
  const [mintDigest, setMintDigest] = useState('')
  const [wireCandidates, setWireCandidates] = useState<InboxWireImageCandidate[]>([])
  const [wireRows, setWireRows] = useState<InboxWireImageRow[]>([])
  const [wireOffset, setWireOffset] = useState(0)
  const [mailboxIdInput, setMailboxIdInput] = useState('')
  const [mailboxAddrInput, setMailboxAddrInput] = useState('')
  const [mailboxPlainRows, setMailboxPlainRows] = useState<MailboxPlainScanRow[]>([])

  const clearSinglePreview = useCallback(() => {
    setPreviewUrl((prev) => {
      revokeIfObjectUrl(prev)
      return null
    })
    setMeta(null)
    setPendingCipher(null)
    setPendingMatch(undefined)
    setPendingName(undefined)
    setPendingObjectId(undefined)
  }, [])

  const clearOwnerGallery = useCallback(() => {
    setOwnerItems((prev) => {
      revokeAll(prev.map((x) => x.previewUrl).filter(Boolean) as string[])
      return []
    })
    setOwnerCursor(null)
    setOwnerHasNext(false)
    setOwnerAddress('')
  }, [])

  const resetAll = useCallback(() => {
    clearSinglePreview()
    clearOwnerGallery()
    setError('')
    setInfo('')
    setPassphrase('')
    setSharePassphrase('')
    setMintDigest('')
    setMintFile(null)
    setMintContentType('image/jpeg')
    setMintHashPreview('')
    setMintAttrs([])
    setWireCandidates([])
    setWireRows([])
    setWireOffset(0)
    setMailboxPlainRows([])
    setMailboxIdInput('')
    setMailboxAddrInput('')
  }, [clearSinglePreview, clearOwnerGallery])

  useEffect(() => {
    return () => {
      revokeIfObjectUrl(previewUrl)
      revokeAll(ownerItems.map((x) => x.previewUrl).filter(Boolean) as string[])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nur unmount
  }, [])

  useEffect(() => {
    if (!mintFile) {
      setMintHashPreview('')
      return
    }
    const ct = mintFile.type || 'image/jpeg'
    setMintContentType(ct)
    let cancelled = false
    void (async () => {
      const buf = new Uint8Array(await mintFile.arrayBuffer())
      const dig = await crypto.subtle.digest('SHA-256', buf)
      const hex = Array.from(new Uint8Array(dig))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
      if (!cancelled) setMintHashPreview(hex)
    })()
    return () => {
      cancelled = true
    }
  }, [mintFile])

  const showDecrypted = useCallback(
    (bytes: Uint8Array, mime: string, extra: Omit<PreviewMeta, 'mime' | 'bytes'>) => {
      const url = evidenceImageBytesToObjectUrl(bytes, mime)
      setPreviewUrl((prev) => {
        revokeIfObjectUrl(prev)
        return url
      })
      setMeta({ mime, bytes: bytes.length, source: 'embedded', ...extra })
      setPendingCipher(null)
    },
    []
  )

  const [urlGatewayIndex, setUrlGatewayIndex] = useState(0)

  const showExternalUrl = useCallback((displayUrl: string, extra: Omit<PreviewMeta, 'mime' | 'bytes'>) => {
    const cid = extra.ipfsCid || extractIpfsCid(displayUrl) || undefined
    const primary = cid ? ipfsCidDisplayUrlFallbacks(cid)[0] || displayUrl : displayUrl
    setUrlGatewayIndex(0)
    setPreviewUrl((prev) => {
      revokeIfObjectUrl(prev)
      return primary
    })
    setMeta({
      ...extra,
      mime: 'image/* (URL)',
      bytes: 0,
      source: 'url',
      ipfsCid: cid,
      browserViewUrl: cid ? ipfsCidToBrowserViewUrl(cid) : extra.browserViewUrl || displayUrl,
    })
    setPendingCipher(null)
  }, [])

  const onDecryptPending = useCallback(async () => {
    if (!pendingCipher) return
    if (passphrase.trim().length < 8) {
      setError('Passphrase mindestens 8 Zeichen.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const dec = await decryptEvidenceImageBytes(pendingCipher, passphrase.trim())
      if (pendingObjectId) {
        rememberEvidencePassphrase({ objectId: pendingObjectId, passphrase: passphrase.trim() })
      }
      setSharePassphrase(passphrase.trim())
      showDecrypted(dec.bytes, dec.contentType, {
        match: pendingMatch,
        name: pendingName,
        encryptedFlag: true,
        objectId: pendingObjectId,
      })
      setInfo('Entschlüsselt mit Passphrase (Schlüssel war nicht on-chain). Lokal gemerkt.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Entschlüsselung fehlgeschlagen.')
    } finally {
      setBusy(false)
    }
  }, [pendingCipher, passphrase, pendingMatch, pendingName, pendingObjectId, showDecrypted])

  const onLoadObject = useCallback(async () => {
    const id = query.trim()
    if (!isPlausibleIotaObjectId(id)) {
      setError('Object-ID: 0x + 64 Hex.')
      return
    }
    setBusy(true)
    setError('')
    setInfo('')
    clearSinglePreview()
    clearOwnerGallery()
    try {
      const r = await loadEvidenceImageFromObjectId(id)
      if (!r.ok) {
        if (r.needsPassphrase && r.ciphertext) {
          const remembered = lookupEvidencePassphrase({ objectId: r.objectId })
          if (remembered) {
            try {
              const dec = await decryptEvidenceImageBytes(r.ciphertext, remembered)
              setPassphrase(remembered)
              setSharePassphrase(remembered)
              showDecrypted(dec.bytes, dec.contentType, {
                match: r.match,
                name: r.name,
                description: metaFromDescription(r.description).body || r.description,
                classification: r.classification,
                attrs: metaFromDescription(r.description).attrs,
                encryptedFlag: true,
                objectId: r.objectId,
              })
              setInfo('Mit lokal gemerkter Passphrase entschlüsselt.')
              return
            } catch {
              /* falsche lokale Passphrase → manuell */
            }
          }
          setPendingCipher(r.ciphertext)
          setPendingMatch(r.match)
          setPendingName(r.name)
          setPendingObjectId(r.objectId)
          setError('')
          setInfo('MORGIMGE1-Ciphertext — Passphrase vom Ersteller eingeben.')
          return
        }
        setError(r.error)
        return
      }
      const descMeta = metaFromDescription(r.description)
      if (r.source === 'url' && r.displayUrl) {
        showExternalUrl(r.displayUrl, {
          match: r.match,
          name: r.name,
          description: descMeta.body || r.description,
          classification: r.classification,
          attrs: descMeta.attrs,
          objectId: r.objectId,
        })
        setInfo(
          'URL-/IPFS-NFT (kein image_data). Vorschau über Bild-Gateway (Pinata); „Im Browser“ öffnet inbrowser.link. RPC-Netz muss zum Objekt passen (z. B. Testnet).'
        )
        return
      }
      if (!r.parsed) {
        setError('Objekt ohne Bilddaten und ohne URL.')
        return
      }
      showDecrypted(r.parsed.bytes, r.parsed.mime, {
        match: r.match,
        name: r.name,
        description: descMeta.body || r.description,
        classification: r.classification,
        attrs: descMeta.attrs,
        encryptedFlag: r.parsed.encryptedFlag,
        objectId: r.objectId,
      })
      if (r.parsed.encryptedFlag) {
        setInfo('Move-Flag encrypted=true, Bytes Klartext (Contract verschlüsselt nicht).')
      }
    } finally {
      setBusy(false)
    }
  }, [query, clearSinglePreview, clearOwnerGallery, showDecrypted, showExternalUrl])

  const onLoadOwnerPage = useCallback(
    async (opts?: { append?: boolean; cursor?: string | null; ownerOverride?: string }) => {
      const owner = (
        opts?.append ? ownerAddress : (opts?.ownerOverride || query).trim()
      ).toLowerCase()
      if (!isPlausibleIotaObjectId(owner)) {
        setError('Besitzer-Adresse: 0x + 64 Hex.')
        return
      }
      setBusy(true)
      setError('')
      setInfo('')
      if (!opts?.append) {
        clearSinglePreview()
        clearOwnerGallery()
      }
      try {
        const r = await loadEvidenceImagesByOwner(owner, {
          cursor: opts?.cursor ?? null,
          limit: EVIDENCE_IMAGE_OWNER_PAGE_SIZE,
        })
        if (!r.ok) {
          setError(r.error)
          return
        }
        setOwnerAddress(r.owner)
        setOwnerCursor(r.nextCursor)
        setOwnerHasNext(r.hasNextPage)
        let unlocked = 0
        const mapped = []
        for (const it of r.items) {
          const attrs = metaFromDescription(it.description).attrs
          if (it.parsed) {
            mapped.push({
              ...it,
              attrs,
              previewUrl: evidenceImageBytesToObjectUrl(it.parsed.bytes, it.parsed.mime),
            })
            continue
          }
          if (it.displayUrl) {
            mapped.push({
              ...it,
              attrs,
              previewUrl: it.displayUrl,
            })
            continue
          }
          if (it.needsPassphrase && it.ciphertext) {
            const remembered = lookupEvidencePassphrase({ objectId: it.objectId })
            if (remembered) {
              try {
                const dec = await decryptEvidenceImageBytes(it.ciphertext, remembered)
                unlocked++
                mapped.push({
                  ...it,
                  attrs,
                  needsPassphrase: false,
                  error: undefined,
                  ciphertext: undefined,
                  rememberedPass: remembered,
                  previewUrl: evidenceImageBytesToObjectUrl(dec.bytes, dec.contentType),
                })
                continue
              } catch {
                /* manuell */
              }
            }
          }
          mapped.push({ ...it, attrs })
        }
        setOwnerItems((prev) => (opts?.append ? [...prev, ...mapped] : mapped))
        const pkgShort = KNOWN_IMAGE_NFT_PACKAGE_IDS[0].slice(0, 10)
        const totalShown = (opts?.append ? ownerItems.length : 0) + mapped.length
        setInfo(
          `${mapped.length} ImageNFT(s) · geladen ${opts?.append ? totalShown : mapped.length}` +
            (unlocked ? ` · ${unlocked} mit lokaler Passphrase` : '') +
            `. Nur ${pkgShort}…::image_nft::ImageNFT. ` +
            (r.hasNextPage ? 'Weitere Seiten möglich.' : 'Keine weitere Seite.')
        )
        if (r.items.length === 0 && !opts?.append) {
          setError('Keine ImageNFTs dieses Packages für die Adresse.')
        }
      } finally {
        setBusy(false)
      }
    },
    [query, ownerAddress, ownerItems.length, clearSinglePreview, clearOwnerGallery]
  )

  const onLoadWire = useCallback(
    async (opts?: { append?: boolean }) => {
      setBusy(true)
      setError('')
      setInfo('')
      try {
        const all = collectCompactImagesFromInboxMessages(p?.messages)
        if (!opts?.append) {
          setWireCandidates(all)
          setWireOffset(0)
          setWireRows([])
        }
        const base = opts?.append ? wireCandidates : all
        const offset = opts?.append ? wireOffset : 0
        if (base.length === 0) {
          setError(
            'Keine MORG_COMPACT_IMG_V1 im geladenen Posteingang. (Anderer Filter? Anderes Gerät? Nur lokal sichtbare Inbox.)'
          )
          setInfo('')
          return
        }
        const page = await decodeInboxWireImagePage(base, offset, EVIDENCE_IMAGE_OWNER_PAGE_SIZE)
        setWireRows((prev) => (opts?.append ? [...prev, ...page] : page))
        const next = offset + page.length
        setWireOffset(next)
        setInfo(
          `${page.length} Wire-Bild(er) · ${next}/${base.length} geladen. ` +
            'Nur lokaler Posteingang — nicht on-chain ImageNFT. Anderes Gerät braucht dieselben Nachrichten oder ein ImageNFT + Passphrase.'
        )
      } finally {
        setBusy(false)
      }
    },
    [p?.messages, wireCandidates, wireOffset]
  )

  const onMint = useCallback(async () => {
    if (!mintFile) {
      setError('Bitte eine Bilddatei wählen.')
      return
    }
    if (!mintName.trim()) {
      setError('Name ist Pflicht.')
      return
    }
    setBusy(true)
    setError('')
    setInfo('')
    setSharePassphrase('')
    setMintDigest('')
    try {
      const buf = new Uint8Array(await mintFile.arrayBuffer())
      const r = await mintEvidenceImageNft({
        plainBytes: buf,
        contentType: mintContentType.trim() || mintFile.type || 'image/png',
        name: mintName,
        description: mintDesc,
        classification: mintClassification,
        attrs: mintAttrs,
        encrypt: mintEncrypt,
      })
      if (!r.ok) {
        setError(r.error)
        return
      }
      setMintDigest(r.digest)
      if (r.passphrase) {
        rememberEvidencePassphrase({
          objectId: r.objectId,
          digest: r.digest,
          contentHashHex: r.contentHashHex,
          passphrase: r.passphrase,
        })
      }
      const resizeNote =
        r.resized && r.originalBytes != null
          ? ` Verkleinert ${r.originalBytes}→${r.onChainBytes} B (wie Nachrichten).`
          : ''
      const oidNote = r.objectId ? ` Object-ID: ${r.objectId.slice(0, 12)}…` : ''
      if (r.passphrase) {
        setSharePassphrase(r.passphrase)
        setInfo(
          `Mint OK (${r.onChainBytes} B on-chain).${resizeNote}${oidNote} Passphrase unten kopieren und separat teilen — lokal gemerkt.`
        )
      } else {
        setInfo(`Mint OK (Klartext on-chain, ${r.onChainBytes} B).${resizeNote}${oidNote} Digest: ${r.digest}`)
      }
    } finally {
      setBusy(false)
    }
  }, [mintFile, mintName, mintDesc, mintClassification, mintContentType, mintAttrs, mintEncrypt])

  const onScanMailboxPlain = useCallback(async () => {
    setBusy(true)
    setError('')
    setInfo('')
    setMailboxPlainRows([])
    clearSinglePreview()
    clearOwnerGallery()
    try {
      const snap = getDirectMailboxChainSnapshot()
      const r = await scanMailboxPlaintextForAddress({
        mailboxObjectId: mailboxIdInput.trim() || snap?.mailboxId,
        packageId: snap?.packageId,
        address: mailboxAddrInput.trim() || getDirectIotaSessionSignerAddress() || '',
      })
      if (!r.ok) {
        setError(r.error)
        return
      }
      setMailboxPlainRows(r.rows)
      if (r.rows.length) {
        setInfo(
          `${r.rows.length} Klartext · DF ${r.dfCount} · Events ${r.eventCount}` +
            (r.mailboxObjectId.startsWith('0x') ? ` · MB ${r.mailboxObjectId.slice(0, 10)}…` : '') +
            (r.hint ? `\n${r.hint}` : '')
        )
      } else {
        setError(r.hint || 'Kein Klartext gefunden.')
        setInfo('')
      }
    } finally {
      setBusy(false)
    }
  }, [mailboxIdInput, mailboxAddrInput, clearSinglePreview, clearOwnerGallery])

  const onPrimary = useCallback(() => {
    if (mode === 'object') void onLoadObject()
    else if (mode === 'owner') void onLoadOwnerPage({ append: false })
    else if (mode === 'wire') void onLoadWire({ append: false })
    else if (mode === 'mailbox') void onScanMailboxPlain()
    else void onMint()
  }, [mode, onLoadObject, onLoadOwnerPage, onLoadWire, onScanMailboxPlain, onMint])

  const loadOwnWalletGallery = useCallback(() => {
    const addr = getDirectIotaSessionSignerAddress()
    if (!addr) {
      setMode('owner')
      setError('Kein Session-Signer — Tresor entsperren.')
      return
    }
    /** Erneuter Klick bei bereits geladener eigener Galerie → ausblenden. */
    if (ownerAddress && addr.toLowerCase() === ownerAddress.toLowerCase()) {
      clearOwnerGallery()
      clearSinglePreview()
      setError('')
      setInfo('')
      return
    }
    setMode('owner')
    setQuery(addr)
    setError('')
    setInfo('')
    setMailboxPlainRows([])
    setWireRows([])
    void onLoadOwnerPage({ append: false, ownerOverride: addr })
  }, [onLoadOwnerPage, ownerAddress, clearOwnerGallery, clearSinglePreview])

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) {
          resetAll()
          return
        }
        /** Nur Tab setzen — keine Galerie laden, bis der Nutzer sucht / „eigene NFT“ drückt. */
        if (p?.defaultMode) setMode(p.defaultMode)
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={
            p?.triggerClassName ||
            'w-full justify-start rounded-md border-0 bg-transparent px-2 py-1.5 text-left text-sm hover:bg-accent'
          }
        >
          <ImageIcon className="mr-2 h-4 w-4 shrink-0" />
          {p?.triggerLabel ?? 'On-Chain Bild / NFT'}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>On-Chain / NFT</DialogTitle>
          <DialogDescription>
            ImageNFT (Object/Besitzer/Mint), Wire aus lokalem Posteingang, optional Klartext an bekannter MAILBOX_ID.
            Mint ~12 KB Ziel, Cap {Math.round(EVIDENCE_IMAGE_MAX_RAW_BYTES / 1024)} KB.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['object', 'Object-ID'],
                ['owner', 'Besitzer'],
                ['wire', 'Wire'],
                ['mailbox', 'Klartext'],
                ['mint', 'Minten'],
              ] as const
            ).map(([id, label]) => (
              <Button
                key={id}
                type="button"
                size="sm"
                variant={mode === id ? 'default' : 'outline'}
                onClick={() => {
                  setMode(id)
                  setError('')
                  setInfo('')
                  clearSinglePreview()
                  clearOwnerGallery()
                  setWireRows([])
                  setWireCandidates([])
                  setWireOffset(0)
                  setMailboxPlainRows([])
                }}
              >
                {label}
              </Button>
            ))}
          </div>

          {mode === 'wire' ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Zeigt MORG_COMPACT_IMG aus dem <strong className="text-foreground">aktuell geladenen</strong>{' '}
                Posteingang. Nicht über fremde Adresse abrufbar.
              </p>
              <Button type="button" onClick={onPrimary} disabled={busy}>
                {busy ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Laden…
                  </>
                ) : (
                  `Wire-Bilder laden (max. ${EVIDENCE_IMAGE_OWNER_PAGE_SIZE})`
                )}
              </Button>
            </div>
          ) : mode === 'mailbox' ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Scannt <strong className="text-foreground">Mailbox-DFs</strong> und{' '}
                <strong className="text-foreground">Chain-Events</strong> (Klartext). Default-Sendepfad „Event“ legt
                oft nur Events an — ohne „Anker/Mailbox“ keine PlainMsgKey-DFs. Kein E2EE.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="mb-scan-id">MAILBOX_ID (optional, für DFs)</Label>
                <Input
                  id="mb-scan-id"
                  value={mailboxIdInput}
                  onChange={(e) => setMailboxIdInput(e.target.value)}
                  placeholder="leer = Snapshot; leer+ohne Snapshot = nur Events"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mb-scan-addr">Adresse Sender/Empfänger (optional)</Label>
                <Input
                  id="mb-scan-addr"
                  value={mailboxAddrInput}
                  onChange={(e) => setMailboxAddrInput(e.target.value)}
                  placeholder="leer = eigene Session, sonst 0x…"
                  spellCheck={false}
                />
              </div>
              <Button type="button" onClick={() => void onScanMailboxPlain()} disabled={busy}>
                {busy ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Scannen…
                  </>
                ) : (
                  'Klartext scannen'
                )}
              </Button>
            </div>
          ) : mode !== 'mint' ? (
            <>
              {mode === 'owner' ? (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => void loadOwnWalletGallery()}
                >
                  {busy ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Laden…
                    </>
                  ) : ownerAddress &&
                    getDirectIotaSessionSignerAddress()?.toLowerCase() === ownerAddress.toLowerCase() ? (
                    'Eigene NFT ausblenden'
                  ) : (
                    'Eigene NFT anzeigen'
                  )}
                </Button>
              ) : null}
              <div className="space-y-1.5">
                <Label htmlFor="evidence-query">{mode === 'object' ? 'Object-ID' : 'Besitzer-Adresse'}</Label>
                <Input
                  id="evidence-query"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="0x…"
                  spellCheck={false}
                  autoComplete="off"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !busy) onPrimary()
                  }}
                />
              </div>
              <Button type="button" onClick={onPrimary} disabled={busy || !query.trim()}>
                {busy ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Laden…
                  </>
                ) : mode === 'object' ? (
                  'Bild laden'
                ) : (
                  `Adresse laden (max. ${EVIDENCE_IMAGE_OWNER_PAGE_SIZE})`
                )}
              </Button>
              {mode === 'owner' && ownerAddress ? (
                <p className="text-[10px] text-muted-foreground break-all">
                  Angezeigt für: {ownerAddress}
                </p>
              ) : null}
            </>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="mint-file">Bilddatei</Label>
                <Input
                  id="mint-file"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => setMintFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mint-name">Name (Pflicht)</Label>
                <Input
                  id="mint-name"
                  value={mintName}
                  onChange={(e) => setMintName(e.target.value)}
                  placeholder="z. B. Evidenz Foto 1"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mint-desc">Beschreibung</Label>
                <Input
                  id="mint-desc"
                  value={mintDesc}
                  onChange={(e) => setMintDesc(e.target.value)}
                  placeholder="Kurzbeschreibung"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mint-class">Klassifikation</Label>
                <select
                  id="mint-class"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  value={mintClassification}
                  onChange={(e) => setMintClassification(e.target.value)}
                >
                  <option value="evidence">evidence</option>
                  <option value="high">high</option>
                  <option value="medium">medium</option>
                  <option value="low">low</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mint-ct">Content-Type</Label>
                <Input
                  id="mint-ct"
                  value={mintContentType}
                  onChange={(e) => setMintContentType(e.target.value)}
                  placeholder="image/jpeg"
                />
              </div>
              <p className="text-[10px] text-muted-foreground break-all">
                Timestamp: automatisch beim Mint · Hash (SHA-256 der Datei)
                {mintHashPreview ? `: ${mintHashPreview.slice(0, 16)}…` : mintFile ? ': …' : ': nach Dateiwahl'}
              </p>

              <div className="space-y-2 rounded-md border border-border p-3">
                <p className="text-sm font-medium">Zusätzliche Attribute (max. {EVIDENCE_ATTR_MAX_PAIRS})</p>
                <p className="text-[10px] text-amber-800 dark:text-amber-200">
                  Zusätzliche Attribute sind öffentlich on-chain sichtbar. Ohne Move-Redeploy landen sie im
                  description-Block [morg-attrs] (keine echten Dynamic Fields am aktuellen Package).
                </p>
                {mintAttrs.map((row, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <Input
                      placeholder="z. B. location, source"
                      value={row.key}
                      onChange={(e) => {
                        const next = [...mintAttrs]
                        next[i] = { ...next[i], key: e.target.value }
                        setMintAttrs(next)
                      }}
                      className="w-[38%]"
                    />
                    <Input
                      placeholder="Wert"
                      value={row.value}
                      onChange={(e) => {
                        const next = [...mintAttrs]
                        next[i] = { ...next[i], value: e.target.value }
                        setMintAttrs(next)
                      }}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      aria-label="Attribut entfernen"
                      onClick={() => setMintAttrs((prev) => prev.filter((_, j) => j !== i))}
                    >
                      ×
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={mintAttrs.length >= EVIDENCE_ATTR_MAX_PAIRS}
                  onClick={() => setMintAttrs((prev) => [...prev, { key: '', value: '' }])}
                >
                  + Attribut hinzufügen
                </Button>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={mintEncrypt}
                  onChange={(e) => setMintEncrypt(e.target.checked)}
                />
                On-chain verschlüsseln (Passphrase nach Mint anzeigen)
              </label>
              <Button type="button" onClick={() => void onMint()} disabled={busy || !mintFile || !mintName.trim()}>
                {busy ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Minte…
                  </>
                ) : (
                  'ImageNFT minten'
                )}
              </Button>
              {sharePassphrase ? (
                <div className="space-y-2 rounded-md border border-amber-600/40 bg-amber-500/10 p-3">
                  <p className="text-xs font-medium">Passphrase — jetzt kopieren & separat teilen</p>
                  <Input readOnly value={sharePassphrase} className="font-mono text-xs" />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void navigator.clipboard.writeText(sharePassphrase)}
                  >
                    Passphrase kopieren
                  </Button>
                  {mintDigest ? (
                    <p className="text-[10px] break-all text-muted-foreground">TX {mintDigest}</p>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}

          {(pendingCipher || ownerItems.some((x) => x.needsPassphrase)) && mode !== 'mint' ? (
            <div className="space-y-2 rounded-md border border-amber-600/40 bg-amber-500/10 p-3">
              <Label htmlFor="evidence-pass">Passphrase</Label>
              <Input
                id="evidence-pass"
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                autoComplete="off"
              />
              {pendingCipher ? (
                <Button type="button" size="sm" disabled={busy} onClick={() => void onDecryptPending()}>
                  Entschlüsseln
                </Button>
              ) : (
                <p className="text-[10px] text-muted-foreground">
                  Galerie-Einträge: Object-ID-Tab + Passphrase, oder lokal gemerkte Keys werden beim Laden genutzt.
                </p>
              )}
            </div>
          ) : null}

          {sharePassphrase && mode !== 'mint' ? (
            <div className="space-y-2 rounded-md border border-amber-600/40 bg-amber-500/10 p-3">
              <p className="text-xs font-medium">Gemerkte / eingegebene Passphrase</p>
              <Input readOnly value={sharePassphrase} className="font-mono text-xs" />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void navigator.clipboard.writeText(sharePassphrase)}
              >
                Passphrase kopieren
              </Button>
            </div>
          ) : null}

          {info ? <p className="text-xs text-muted-foreground whitespace-pre-wrap">{info}</p> : null}
          {error ? <p className="text-sm text-destructive whitespace-pre-wrap">{error}</p> : null}

          {meta && previewUrl ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground break-all">
                {meta.name ? `${meta.name} · ` : ''}
                {meta.classification ? `${meta.classification} · ` : ''}
                {meta.source === 'url'
                  ? 'URL/IPFS'
                  : `${meta.mime} · ${meta.bytes} B`}
                {meta.objectId ? ` · ${meta.objectId.slice(0, 10)}…` : ''}
              </p>
              {meta.description ? (
                <p className="text-xs text-muted-foreground whitespace-pre-wrap">{meta.description}</p>
              ) : null}
              {meta.attrs && meta.attrs.length > 0 ? (
                <ul className="text-xs text-muted-foreground">
                  {meta.attrs.map((a) => (
                    <li key={a.key}>
                      <span className="font-medium text-foreground">{a.key}</span>: {a.value}
                    </li>
                  ))}
                </ul>
              ) : null}
              {meta.source === 'url' && meta.browserViewUrl ? (
                <p className="text-[11px]">
                  <a
                    href={meta.browserViewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline underline-offset-2"
                  >
                    Im Browser öffnen (inbrowser.link)
                  </a>
                </p>
              ) : null}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt={meta.name || 'On-Chain Evidenz-Bild'}
                className="max-h-80 w-full rounded-md border border-border object-contain bg-muted/20"
                onError={() => {
                  if (!meta.ipfsCid) return
                  const list = ipfsCidDisplayUrlFallbacks(meta.ipfsCid)
                  const next = urlGatewayIndex + 1
                  if (next >= list.length) {
                    setError(
                      'Bild-Gateways fehlgeschlagen. Nutze „Im Browser öffnen (inbrowser.link)“.'
                    )
                    return
                  }
                  setUrlGatewayIndex(next)
                  setPreviewUrl(list[next]!)
                  setInfo(`Gateway-Fallback ${next + 1}/${list.length}…`)
                }}
              />
            </div>
          ) : null}

          {ownerItems.length > 0 ? (
            <div className="space-y-3">
              <ul className="space-y-3">
                {ownerItems.map((it) => (
                  <li key={it.objectId} className="space-y-1 rounded-md border border-border p-2">
                    <p className="text-xs break-all text-muted-foreground">
                      {it.name || 'ImageNFT'}
                      {it.classification ? ` · ${it.classification}` : ''} · {it.objectId}
                    </p>
                    {it.attrs && it.attrs.length > 0 ? (
                      <p className="text-[10px] text-muted-foreground">
                        {it.attrs.map((a) => `${a.key}=${a.value}`).join(' · ')}
                      </p>
                    ) : null}
                    {it.needsPassphrase ? (
                      <div className="space-y-1">
                        <p className="text-xs text-amber-800 dark:text-amber-200">Verschlüsselt — Passphrase nötig.</p>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busy || passphrase.trim().length < 8 || !it.ciphertext}
                          onClick={() => {
                            void (async () => {
                              if (!it.ciphertext) return
                              setBusy(true)
                              setError('')
                              try {
                                const dec = await decryptEvidenceImageBytes(it.ciphertext, passphrase.trim())
                                rememberEvidencePassphrase({
                                  objectId: it.objectId,
                                  passphrase: passphrase.trim(),
                                })
                                const url = evidenceImageBytesToObjectUrl(dec.bytes, dec.contentType)
                                setOwnerItems((prev) =>
                                  prev.map((row) =>
                                    row.objectId === it.objectId
                                      ? {
                                          ...row,
                                          needsPassphrase: false,
                                          ciphertext: undefined,
                                          error: undefined,
                                          rememberedPass: passphrase.trim(),
                                          previewUrl: url,
                                        }
                                      : row
                                  )
                                )
                                setSharePassphrase(passphrase.trim())
                              } catch (e) {
                                setError(e instanceof Error ? e.message : String(e))
                              } finally {
                                setBusy(false)
                              }
                            })()
                          }}
                        >
                          Mit Passphrase oben entschlüsseln
                        </Button>
                      </div>
                    ) : null}
                    {it.rememberedPass ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-auto px-0 text-xs"
                        onClick={() => {
                          setSharePassphrase(it.rememberedPass || '')
                          void navigator.clipboard.writeText(it.rememberedPass || '')
                        }}
                      >
                        Passphrase kopieren
                      </Button>
                    ) : null}
                    {it.error && !it.needsPassphrase ? (
                      <p className="text-xs text-destructive">{it.error}</p>
                    ) : null}
                    {it.previewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={it.previewUrl}
                        alt={it.name || it.objectId}
                        className="max-h-48 w-full object-contain bg-muted/20"
                      />
                    ) : null}
                  </li>
                ))}
              </ul>
              {ownerHasNext ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => void onLoadOwnerPage({ append: true, cursor: ownerCursor })}
                >
                  Nächste {EVIDENCE_IMAGE_OWNER_PAGE_SIZE} laden
                </Button>
              ) : null}
            </div>
          ) : null}

          {wireRows.length > 0 ? (
            <div className="space-y-3">
              <ul className="space-y-3">
                {wireRows.map((it) => (
                  <li key={it.messageId} className="space-y-1 rounded-md border border-border p-2">
                    <p className="text-xs break-all text-muted-foreground">
                      {it.ts ? new Date(it.ts).toLocaleString('de-DE') : '—'} · {it.sender.slice(0, 10)}…
                      {it.caption ? ` · ${it.caption}` : ''}
                    </p>
                    {it.error ? <p className="text-xs text-destructive">{it.error}</p> : null}
                    {it.dataUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={it.dataUrl}
                        alt={it.caption || 'Wire-Bild'}
                        className="max-h-48 w-full object-contain bg-muted/20"
                      />
                    ) : null}
                  </li>
                ))}
              </ul>
              {wireOffset < wireCandidates.length ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => void onLoadWire({ append: true })}
                >
                  Nächste {EVIDENCE_IMAGE_OWNER_PAGE_SIZE} Wire-Bilder
                </Button>
              ) : null}
            </div>
          ) : null}

          {mailboxPlainRows.length > 0 ? (
            <ul className="space-y-2">
              {mailboxPlainRows.map((row, i) => (
                <li
                  key={`${row.source}-${row.nonce}-${row.ts ?? 0}-${row.sender}-${row.recipient}-${i}-${row.text.slice(0, 24)}`}
                  className="rounded-md border border-border p-2 text-xs"
                >
                  <p className="text-muted-foreground break-all">
                    {row.source === 'event' ? 'Event' : 'Mailbox-DF'} ·{' '}
                    {row.ts ? new Date(row.ts).toLocaleString('de-DE') : '—'} · {row.sender.slice(0, 10)}… →{' '}
                    {row.recipient.slice(0, 10)}…
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-foreground">{row.text}</p>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
