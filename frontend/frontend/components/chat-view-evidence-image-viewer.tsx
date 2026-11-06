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
  burnEvidenceImageNft,
  transferEvidenceImageNft,
} from '@/frontend/lib/evidence-image-transfer'
import { NftTimeLeasePanel } from '@/frontend/components/nft-time-lease-panel'
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
  getDefaultEvidencePassphrase,
  lookupEvidencePassphrase,
  rememberEvidencePassphrase,
} from '@/frontend/lib/evidence-passphrase-local-store'
import {
  bindObjectToNftKeycard,
  getNftKeycard,
  listNftKeycards,
  lookupPassphraseForNftKeycard,
  normalizeNftKeycardSlotId,
  removeNftKeycardSlot,
  unbindObjectFromNftKeycard,
  unbindWireFromNftKeycard,
  upsertNftKeycardSlot,
} from '@/frontend/lib/nft-keycard-local-store'
import { unpackNftKeycardDescriptionMarker } from '@/frontend/lib/nft-keycard-description-marker'
import { checkNftKeycardOwnedBySigner } from '@/frontend/lib/nft-keycard-ownership'
import {
  recordNftActivity,
  syncNftOwnedSnapshotAndDetectReceived,
} from '@/frontend/lib/nft-activity-local-log'
import { explorerTxUrlFromDigest } from '@/frontend/lib/iota-tx-explorer-hint'

type Mode = 'object' | 'owner' | 'mint' | 'wire' | 'mailbox'

type OwnerGalleryItem = EvidenceOwnerListItem & {
  previewUrl?: string
  attrs?: EvidenceAttrPair[]
  rememberedPass?: string
}

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

const ALL_EVIDENCE_MODES: { id: Mode; label: string }[] = [
  { id: 'object', label: 'Object-ID' },
  { id: 'owner', label: 'Besitzer' },
  { id: 'wire', label: 'Wire' },
  { id: 'mailbox', label: 'Klartext' },
  { id: 'mint', label: 'Minten' },
]

/** Hauptmenü-Wallet: nur NFT-relevante Tabs. */
export const NFT_WALLET_MODES: Mode[] = ['owner', 'object', 'mint']

export function ChatViewEvidenceImageViewerButton(p?: {
  triggerClassName?: string
  triggerLabel?: string
  /** Start-Tab beim Öffnen. */
  defaultMode?: Mode
  /** Beim Öffnen sofort eigene Wallet-NFTs laden (Besitzer-Tab). */
  autoLoadOwnOnOpen?: boolean
  /**
   * Erlaubte Tabs. Default: alle (Posteingang On-Chain).
   * Hauptmenü: `NFT_WALLET_MODES` (Besitzer / Object-ID / Minten).
   */
  allowedModes?: readonly Mode[]
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
  const allowed = p?.allowedModes?.length
    ? p.allowedModes
        .map((id) => ALL_EVIDENCE_MODES.find((m) => m.id === id))
        .filter((m): m is { id: Mode; label: string } => Boolean(m))
    : ALL_EVIDENCE_MODES
  const nftWalletUi = Boolean(
    p?.allowedModes &&
      p.allowedModes.length > 0 &&
      !p.allowedModes.includes('wire') &&
      !p.allowedModes.includes('mailbox')
  )
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<Mode>(() => {
    const want = p?.defaultMode || (nftWalletUi ? 'owner' : 'object')
    return allowed.some((m) => m.id === want) ? want : allowed[0]?.id || 'object'
  })
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
  const [ownerItems, setOwnerItems] = useState<OwnerGalleryItem[]>([])
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
  /** P2: Mint-Passphrase an Schlüsselkarte/Slot */
  const [mintKeycardOid, setMintKeycardOid] = useState('')
  const [mintKeycardSlot, setMintKeycardSlot] = useState('img')
  /** Zweites Enc-NFT minten und an Partner senden (gleiche Passphrase — Komfort-Paar). */
  const [mintPairTo, setMintPairTo] = useState('')
  const [gallerySlotId, setGallerySlotId] = useState('default')
  const [galleryNewSlotId, setGalleryNewSlotId] = useState('img')
  const [keycardTick, setKeycardTick] = useState(0)
  /** Empfänger für ImageNFT-Transfer (Galerie). */
  const [transferToByOid, setTransferToByOid] = useState<Record<string, string>>({})
  const [manualBindOid, setManualBindOid] = useState('')
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
    // Unmount-only cleanup (preview URLs).
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
        const mapped: OwnerGalleryItem[] = []
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
            const cid = extractIpfsCid(it.displayUrl)
            mapped.push({
              ...it,
              attrs,
              previewUrl: cid ? ipfsCidDisplayUrlFallbacks(cid)[0] || it.displayUrl : it.displayUrl,
            })
            continue
          }
          if (it.needsPassphrase && it.ciphertext) {
            const remembered =
              lookupEvidencePassphrase({
                objectId: it.objectId,
                allowDefault: true,
              }) || lookupPassphraseForNftKeycard({ objectId: it.objectId })
            if (remembered) {
              try {
                const dec = await decryptEvidenceImageBytes(it.ciphertext, remembered)
                unlocked++
                rememberEvidencePassphrase({
                  objectId: it.objectId,
                  passphrase: remembered,
                  asDefault: false,
                })
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
        if (!opts?.append) {
          const me = getDirectIotaSessionSignerAddress()?.toLowerCase()
          const owner = (opts?.ownerOverride || query || ownerAddress).trim().toLowerCase()
          if (me && owner && me === owner) {
            const labels: Record<string, string> = {}
            for (const it of mapped) {
              if (it.name) labels[it.objectId.toLowerCase()] = it.name
            }
            const got = syncNftOwnedSnapshotAndDetectReceived(
              mapped.map((x) => x.objectId),
              labels
            )
          }
        }
        const totalShown = (opts?.append ? ownerItems.length : 0) + mapped.length
        const urlN = mapped.filter((x) => x.source === 'url').length
        const embN = mapped.filter((x) => x.source === 'embedded' || x.parsed).length
        const lockedN = mapped.filter((x) => x.needsPassphrase).length
        setInfo(
          `${mapped.length} Bild-NFT(s)` +
            ` (Klartext/eingebettet ${embN}, URL/IPFS ${urlN}, verschlüsselt ${lockedN})` +
            ` · gesamt ${opts?.append ? totalShown : mapped.length}` +
            (unlocked ? ` · ${unlocked} auto-entschlüsselt (lokal gemerkt / Geräte-Standard)` : '') +
            `. Filter: ImageNFT + SimpleNFT.` +
            (r.rpcUrl ? ` RPC: ${r.rpcUrl}` : '') +
            (r.networkNote ? `\n${r.networkNote}` : '') +
            (lockedN
              ? `\n${lockedN} noch gesperrt — Passphrase oben eingeben → „Alle entsperren & merken“.`
              : '') +
            (r.hasNextPage ? ' Weitere Seiten möglich.' : '')
        )
        if (mapped.length === 0 && !opts?.append) {
          setError(
            (r.networkNote ? `${r.networkNote}\n` : '') +
              'Keine passenden NFTs. Object-ID-Tab für andere Packages — oder RPC auf Testnet stellen (SimpleNFT-Demo).'
          )
        } else if (r.networkNote && mapped.length > 0) {
          setError('')
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
        ...(mintEncrypt && mintKeycardOid
          ? {
              keycardHint: {
                cardObjectId: mintKeycardOid,
                slotId: normalizeNftKeycardSlotId(mintKeycardSlot || 'img'),
              },
            }
          : {}),
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
      let keycardNote = ''
      if (r.passphrase && mintKeycardOid && r.objectId) {
        const slotId = normalizeNftKeycardSlotId(mintKeycardSlot || 'img')
        const up = upsertNftKeycardSlot({
          objectId: mintKeycardOid,
          slotId,
          passphrase: r.passphrase,
          note: 'MORGIMGE1',
        })
        if (up.ok) {
          const bind = bindObjectToNftKeycard({
            cardObjectId: mintKeycardOid,
            boundObjectId: r.objectId,
            slotId,
          })
          keycardNote = bind.ok
            ? ` Schlüsselkarte-Slot „${slotId}“ gemerkt.`
            : ` Slot gespeichert, Objekt-Bindung: ${bind.error}`
          setKeycardTick((n) => n + 1)
        } else {
          keycardNote = ` Schlüsselkarte: ${up.error}`
        }
      }
      const resizeNote =
        r.resized && r.originalBytes != null
          ? ` Verkleinert ${r.originalBytes}→${r.onChainBytes} B (wie Nachrichten).`
          : ''
      const oidNote = r.objectId ? ` Object-ID: ${r.objectId.slice(0, 12)}…` : ''
      if (r.objectId) {
        recordNftActivity({
          kind: 'mint',
          objectId: r.objectId,
          digest: r.digest,
          label: mintName.trim() || undefined,
        })
      }
      let pairNote = ''
      const pairTo = mintPairTo.trim()
      if (mintEncrypt && r.passphrase && pairTo && isPlausibleIotaObjectId(pairTo)) {
        const r2 = await mintEvidenceImageNft({
          plainBytes: buf,
          contentType: mintContentType.trim() || mintFile.type || 'image/png',
          name: `${mintName} (Partner)`,
          description: mintDesc,
          classification: mintClassification,
          attrs: mintAttrs,
          encrypt: true,
          passphrase: r.passphrase,
        })
        if (r2.ok && r2.objectId) {
          recordNftActivity({
            kind: 'mint',
            objectId: r2.objectId,
            digest: r2.digest,
            label: `${mintName.trim() || 'NFT'} (Partner)`,
          })
          const sent = await transferEvidenceImageNft({
            objectId: r2.objectId,
            recipientAddress: pairTo,
          })
          pairNote = sent.ok
            ? ` Paar: 2. NFT an ${pairTo.slice(0, 10)}… gesendet (gleiche Passphrase — Komfort, kein starkes Gate).`
            : ` Paar: 2. Mint ok, Transfer fehlgeschlagen: ${sent.error}`
        } else if (!r2.ok) {
          pairNote = ` Paar-Mint fehlgeschlagen: ${r2.error}`
        }
      } else if (mintEncrypt && pairTo && !isPlausibleIotaObjectId(pairTo)) {
        pairNote = ' Paar: Partner-Adresse ungültig (0x + 64 Hex) — übersprungen.'
      }
      if (r.passphrase) {
        setSharePassphrase(r.passphrase)
        setInfo(
          `Mint OK (${r.onChainBytes} B on-chain).${resizeNote}${oidNote}${keycardNote}${pairNote} Passphrase unten kopieren und separat teilen — für dich auf diesem Gerät im Vault gemerkt.`
        )
      } else {
        setInfo(`Mint OK (Klartext on-chain, ${r.onChainBytes} B).${resizeNote}${oidNote} Digest: ${r.digest}`)
      }
    } finally {
      setBusy(false)
    }
  }, [
    mintFile,
    mintName,
    mintDesc,
    mintClassification,
    mintContentType,
    mintAttrs,
    mintEncrypt,
    mintKeycardOid,
    mintKeycardSlot,
  ])

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
        const want = p?.defaultMode || (nftWalletUi ? 'owner' : 'object')
        const startMode = allowed.some((m) => m.id === want) ? want : allowed[0]?.id || 'object'
        setMode(startMode)
        if (p?.autoLoadOwnOnOpen && startMode === 'owner') {
          const addr = getDirectIotaSessionSignerAddress()
          if (!addr) {
            setError('Kein Session-Signer — Tresor entsperren.')
            return
          }
          setQuery(addr)
          setError('')
          setInfo('')
          void onLoadOwnerPage({ append: false, ownerOverride: addr })
        }
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
          <DialogTitle>{nftWalletUi ? 'NFT' : 'On-Chain / NFT'}</DialogTitle>
          <DialogDescription>
            {nftWalletUi
              ? `Eigene NFTs (Besitzer), Object-ID laden oder minten. Cap ${Math.round(EVIDENCE_IMAGE_MAX_RAW_BYTES / 1024)} KB.`
              : `ImageNFT (Object/Besitzer/Mint), Wire aus lokalem Posteingang, optional Klartext an bekannter MAILBOX_ID. Mint ~12 KB Ziel, Cap ${Math.round(EVIDENCE_IMAGE_MAX_RAW_BYTES / 1024)} KB.`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {allowed.map(({ id, label }) => (
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
              {mintEncrypt ? (
                <div className="space-y-1.5 rounded-md border border-border/60 bg-muted/10 px-2.5 py-2">
                  <p className="text-[11px] font-medium text-foreground">Paar für Partner (optional)</p>
                  <p className="text-[10px] text-muted-foreground">
                    Zweites Enc-NFT mit derselben Passphrase minten und an Adresse senden. Beide haben ein Token —
                    lesen können sie mit der Passphrase (Komfort). Starkes „nur NFT-Besitz entschlüsselt“ ist noch
                    nicht gebaut.
                  </p>
                  <Input
                    className="font-mono text-[11px]"
                    value={mintPairTo}
                    onChange={(e) => setMintPairTo(e.target.value)}
                    placeholder="Partner 0x… (leer = kein Paar)"
                    spellCheck={false}
                    autoComplete="off"
                  />
                </div>
              ) : null}
              {mintEncrypt && listNftKeycards().length > 0 ? (
                <div className="space-y-1.5 text-xs">
                  <p className="font-medium text-foreground">Passphrase an Schlüsselkarte-Slot (optional)</p>
                  <select
                    className="w-full rounded border border-border bg-background px-2 py-1.5 text-[11px]"
                    value={mintKeycardOid}
                    onChange={(e) => {
                      const v = e.target.value
                      setMintKeycardOid(v)
                      const card = listNftKeycards().find((c) => c.objectId === v)
                      const prefer =
                        card?.entry.slots.find((s) => s.id === 'img')?.id ||
                        card?.entry.slots[0]?.id ||
                        'img'
                      setMintKeycardSlot(prefer)
                    }}
                  >
                    <option value="">— keine Karte —</option>
                    {listNftKeycards().map(({ objectId, entry }) => (
                      <option key={objectId} value={objectId}>
                        {(entry.label || 'Karte') + ' · ' + objectId.slice(0, 12) + '…'}
                      </option>
                    ))}
                  </select>
                  {mintKeycardOid ? (
                    <div className="flex flex-wrap gap-2">
                      <Input
                        className="font-mono text-[11px]"
                        value={mintKeycardSlot}
                        onChange={(e) => setMintKeycardSlot(e.target.value)}
                        placeholder="Slot-ID (z. B. img)"
                      />
                      <span className="self-center text-[10px] text-muted-foreground">
                        Neu oder bestehend — Mint schreibt Passphrase in diesen Slot.
                      </span>
                    </div>
                  ) : null}
                </div>
              ) : null}
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
                placeholder={getDefaultEvidencePassphrase() ? 'Geräte-Standard vorhanden — oder neu eingeben' : 'mind. 8 Zeichen'}
              />
              {pendingCipher ? (
                <Button type="button" size="sm" disabled={busy} onClick={() => void onDecryptPending()}>
                  Entschlüsseln
                </Button>
              ) : (
                <>
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy || passphrase.trim().length < 8}
                    onClick={() => {
                      void (async () => {
                        const pass = passphrase.trim()
                        if (pass.length < 8) return
                        setBusy(true)
                        setError('')
                        let n = 0
                        try {
                          rememberEvidencePassphrase({ passphrase: pass })
                          const next = []
                          for (const it of ownerItems) {
                            if (!it.needsPassphrase || !it.ciphertext) {
                              next.push(it)
                              continue
                            }
                            try {
                              const dec = await decryptEvidenceImageBytes(it.ciphertext, pass)
                              n++
                              rememberEvidencePassphrase({
                                objectId: it.objectId,
                                passphrase: pass,
                              })
                              next.push({
                                ...it,
                                needsPassphrase: false,
                                error: undefined,
                                ciphertext: undefined,
                                rememberedPass: pass,
                                previewUrl: evidenceImageBytesToObjectUrl(dec.bytes, dec.contentType),
                              })
                            } catch {
                              next.push(it)
                            }
                          }
                          setOwnerItems(next)
                          setSharePassphrase(pass)
                          setInfo(
                            n
                              ? `${n} NFT(s) entschlüsselt und Passphrase lokal gemerkt (pro Object-ID + Geräte-Standard).`
                              : 'Keine Einträge mit dieser Passphrase entschlüsselbar.'
                          )
                        } finally {
                          setBusy(false)
                        }
                      })()
                    }}
                  >
                    Alle entsperren & merken
                  </Button>
                  <p className="text-[10px] text-muted-foreground">
                    Eigene Mints: Passphrase wird beim Minten lokal gespeichert und beim Galerie-Laden auto-versucht.
                    Vault-Lock löscht ImageNFT-Merker nicht — nur Einsatz-Ende.
                  </p>
                </>
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

          {listNftKeycards().length > 0 ? (
            <div className="space-y-2 rounded-md border border-border/70 bg-muted/15 p-2.5">
              <p className="text-xs font-medium text-foreground">Schlüsselkarte — Bindungen</p>
              <p className="text-[10px] text-muted-foreground">
                Chat-Nachrichten (PWMSG) haben keine Object-ID — Bindung = Wire-Fingerprint (Composer beim Senden
                oder in der Bubble „An Schlüsselkarte binden“). Hier „Nachträglich binden“ gilt nur für{' '}
                <span className="text-foreground">ImageNFT-Object-IDs</span>. Mehrere Nachrichten/Objekte pro Karte
                möglich. Lösen = nur lokaler Merker.
              </p>
              {listNftKeycards().map(({ objectId, entry }) => (
                <div key={`${objectId}-${keycardTick}`} className="space-y-1 border-t border-border/50 pt-2">
                  <p className="font-mono text-[10px] break-all text-muted-foreground">
                    Karte {entry.label ? `${entry.label} · ` : ''}
                    {objectId.slice(0, 14)}…
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <Input
                      className="h-7 min-w-[10rem] flex-1 font-mono text-[10px]"
                      value={manualBindOid}
                      onChange={(e) => setManualBindOid(e.target.value)}
                      placeholder="Object-ID nachträglich binden"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-[10px]"
                      disabled={busy}
                      onClick={() => {
                        const bound = manualBindOid.trim()
                        const r = bindObjectToNftKeycard({
                          cardObjectId: objectId,
                          boundObjectId: bound,
                          slotId: gallerySlotId || 'img',
                        })
                        if (!r.ok) {
                          setError(r.error)
                          return
                        }
                        setManualBindOid('')
                        setKeycardTick((n) => n + 1)
                        setInfo(`Objekt ${bound.slice(0, 12)}… an Slot „${normalizeNftKeycardSlotId(gallerySlotId || 'img')}“ gebunden.`)
                      }}
                    >
                      Nachträglich binden
                    </Button>
                  </div>
                  {Object.entries(entry.boundObjects || {}).map(([boundOid, slotId]) => (
                    <div key={boundOid} className="flex flex-wrap items-center gap-2 text-[10px]">
                      <span className="break-all text-muted-foreground">
                        Objekt {boundOid.slice(0, 12)}… → Slot {slotId}
                      </span>
                      <button
                        type="button"
                        className="text-destructive underline"
                        onClick={() => {
                          const r = unbindObjectFromNftKeycard({
                            cardObjectId: objectId,
                            boundObjectId: boundOid,
                          })
                          if (!r.ok) {
                            setError(r.error)
                            return
                          }
                          setKeycardTick((n) => n + 1)
                          setInfo('Objekt-Bindung gelöst.')
                        }}
                      >
                        Lösen
                      </button>
                    </div>
                  ))}
                  {Object.entries(entry.boundWires || {}).map(([fp, slotId]) => (
                    <div key={fp} className="flex flex-wrap items-center gap-2 text-[10px]">
                      <span className="break-all text-muted-foreground">
                        Wire {fp.slice(0, 18)}… → Slot {slotId}
                      </span>
                      <button
                        type="button"
                        className="text-destructive underline"
                        onClick={() => {
                          const r = unbindWireFromNftKeycard({
                            objectId,
                            wireFingerprint: fp,
                          })
                          if (!r.ok) {
                            setError(r.error)
                            return
                          }
                          setKeycardTick((n) => n + 1)
                          setInfo('Wire-Bindung gelöst.')
                        }}
                      >
                        Lösen
                      </button>
                    </div>
                  ))}
                  {!entry.boundObjects && !entry.boundWires ? (
                    <p className="text-[10px] text-muted-foreground">Noch keine Bindungen.</p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

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

          {mode === 'owner' && (ownerItems.length > 0 || ownerHasNext) ? (
            <div className="space-y-3">
              {ownerItems.length > 0 ? (
                <ul className="space-y-3">
                  {ownerItems.map((it) => {
                    const storedPass =
                      it.rememberedPass ||
                      lookupEvidencePassphrase({ objectId: it.objectId, allowDefault: false }) ||
                      ''
                    return (
                    <li key={it.objectId} className="space-y-1 rounded-md border border-border p-2">
                      <p className="text-xs break-all text-muted-foreground">
                        {it.name || (it.source === 'url' ? 'URL-NFT' : 'ImageNFT')}
                        {it.classification ? ` · ${it.classification}` : ''}
                      </p>
                      <p className="font-mono text-[10px] break-all text-muted-foreground">{it.objectId}</p>
                      {it.attrs && it.attrs.length > 0 ? (
                        <p className="text-[10px] text-muted-foreground">
                          {it.attrs.map((a) => `${a.key}=${a.value}`).join(' · ')}
                        </p>
                      ) : null}
                      {(() => {
                        const kh = unpackNftKeycardDescriptionMarker(it.description || '')
                        if (!kh) return null
                        return (
                          <p className="text-[10px] text-muted-foreground break-all">
                            Schlüsselkarte-Hinweis on-chain: {kh.cardObjectId.slice(0, 12)}… · Slot{' '}
                            {kh.slotId}
                          </p>
                        )
                      })()}
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 text-[11px]"
                          onClick={() => void navigator.clipboard.writeText(it.objectId)}
                        >
                          Object-ID kopieren
                        </Button>
                        {it.source !== 'url' ? (
                          <div className="flex w-full flex-wrap items-center gap-2">
                            <Input
                              className="h-7 min-w-[12rem] flex-1 font-mono text-[10px]"
                              value={transferToByOid[it.objectId] || ''}
                              onChange={(e) =>
                                setTransferToByOid((m) => ({ ...m, [it.objectId]: e.target.value }))
                              }
                              placeholder="Empfänger 0x… (NFT senden)"
                              autoComplete="off"
                              spellCheck={false}
                            />
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 text-[11px]"
                              disabled={busy}
                              onClick={() => {
                                void (async () => {
                                  const to = (transferToByOid[it.objectId] || '').trim()
                                  if (!/^0x[a-fA-F0-9]{64}$/i.test(to)) {
                                    setError('Empfänger: volle 0x…-Adresse (64 Hex).')
                                    return
                                  }
                                  if (
                                    !window.confirm(
                                      `ImageNFT an ${to.slice(0, 12)}… senden? Besitz wechselt on-chain. Lokale Merker für dieses Objekt werden gelöscht.`
                                    )
                                  ) {
                                    return
                                  }
                                  setBusy(true)
                                  setError('')
                                  try {
                                    const r = await transferEvidenceImageNft({
                                      objectId: it.objectId,
                                      recipientAddress: to,
                                    })
                                    if (!r.ok) {
                                      setError(r.error)
                                      return
                                    }
                                    setOwnerItems((prev) => prev.filter((x) => x.objectId !== it.objectId))
                                    setInfo(`NFT gesendet · TX ${r.digest.slice(0, 16)}…`)
                                  } finally {
                                    setBusy(false)
                                  }
                                })()
                              }}
                            >
                              NFT senden
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 text-[11px] text-destructive"
                              disabled={busy}
                              onClick={() => {
                                void (async () => {
                                  if (
                                    !window.confirm(
                                      'ImageNFT unwiderruflich vernichten (burn)? Storage-Rebate kommt zurück. Lokale Merker weg.'
                                    )
                                  ) {
                                    return
                                  }
                                  setBusy(true)
                                  setError('')
                                  try {
                                    const r = await burnEvidenceImageNft({ objectId: it.objectId })
                                    if (!r.ok) {
                                      setError(r.error)
                                      return
                                    }
                                    setOwnerItems((prev) => prev.filter((x) => x.objectId !== it.objectId))
                                    setInfo(`NFT vernichtet · TX ${r.digest.slice(0, 16)}…`)
                                  } finally {
                                    setBusy(false)
                                  }
                                })()
                              }}
                            >
                              Vernichten
                            </Button>
                          </div>
                        ) : null}
                        {storedPass ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 text-[11px]"
                            onClick={() => {
                              setSharePassphrase(storedPass)
                              void navigator.clipboard.writeText(storedPass)
                            }}
                          >
                            Passphrase kopieren (teilen)
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 text-[11px]"
                          disabled={busy}
                          title="Passphrase lokal an diese Object-ID als Schlüsselkarte binden (Vault)"
                          onClick={() => {
                            void (async () => {
                              const pass =
                                (storedPass || passphrase.trim() || getDefaultEvidencePassphrase() || '').trim()
                              if (pass.length < 8) {
                                setError(
                                  'Schlüsselkarte: Passphrase oben eingeben (≥8) oder NFT zuerst entsperren.'
                                )
                                return
                              }
                              setBusy(true)
                              setError('')
                              try {
                                const me = getDirectIotaSessionSignerAddress()
                                if (me) {
                                  const own = await checkNftKeycardOwnedBySigner(it.objectId, me)
                                  if (own.ok && !own.owned) {
                                    setError(
                                      'Schlüsselkarte: dieses NFT gehört nicht zur aktuellen Signer-Adresse — trotzdem lokal speichern? Abbruch. Besitz prüfen oder anderes Gerät.'
                                    )
                                    return
                                  }
                                  if (!own.ok) {
                                    setInfo(`Besitz-Check: ${own.error} — speichere lokal ohne Chain-Check.`)
                                  }
                                }
                                const slotId = normalizeNftKeycardSlotId(
                                  getNftKeycard(it.objectId)
                                    ? galleryNewSlotId.trim() || gallerySlotId
                                    : gallerySlotId
                                )
                                const r = upsertNftKeycardSlot({
                                  objectId: it.objectId,
                                  label: it.name || undefined,
                                  slotId,
                                  passphrase: pass,
                                  note: it.source === 'url' ? 'URL-NFT' : 'ImageNFT',
                                })
                                if (!r.ok) {
                                  setError(r.error)
                                  return
                                }
                                rememberEvidencePassphrase({ objectId: it.objectId, passphrase: pass })
                                setGallerySlotId(slotId)
                                setKeycardTick((n) => n + 1)
                                setInfo(
                                  `Schlüsselkarte Slot „${slotId}“ gemerkt (${it.objectId.slice(0, 12)}…) — für dich auf diesem Gerät im Vault.`
                                )
                              } finally {
                                setBusy(false)
                              }
                            })()
                          }}
                        >
                          {getNftKeycard(it.objectId) ? 'Slot speichern / aktualisieren' : 'Als Schlüsselkarte merken'}
                        </Button>
                        {getNftKeycard(it.objectId) ? (
                          <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                            <span>Slots:</span>
                            {(getNftKeycard(it.objectId)?.slots || []).map((s) => (
                              <button
                                key={`${it.objectId}-${s.id}-${keycardTick}`}
                                type="button"
                                className={
                                  gallerySlotId === s.id
                                    ? 'rounded border border-foreground/40 px-1.5 py-0.5 text-foreground'
                                    : 'rounded border border-border px-1.5 py-0.5 hover:bg-muted'
                                }
                                onClick={() => {
                                  setGallerySlotId(s.id)
                                  setGalleryNewSlotId(s.id)
                                }}
                              >
                                {s.id}
                                {s.note ? ` (${s.note})` : ''}
                              </button>
                            ))}
                            <Input
                              className="h-7 w-24 font-mono text-[10px]"
                              value={galleryNewSlotId}
                              onChange={(e) => setGalleryNewSlotId(e.target.value)}
                              placeholder="neuer Slot"
                            />
                            {(getNftKeycard(it.objectId)?.slots.length || 0) > 1 ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-[10px]"
                                disabled={busy}
                                onClick={() => {
                                  const r = removeNftKeycardSlot({
                                    objectId: it.objectId,
                                    slotId: gallerySlotId,
                                  })
                                  if (!r.ok) {
                                    setError(r.error)
                                    return
                                  }
                                  const left = getNftKeycard(it.objectId)?.slots[0]?.id || 'default'
                                  setGallerySlotId(left)
                                  setKeycardTick((n) => n + 1)
                                  setInfo(`Slot „${gallerySlotId}“ entfernt.`)
                                }}
                              >
                                Slot entfernen
                              </Button>
                            ) : null}
                          </div>
                        ) : (
                          <Input
                            className="h-7 max-w-[10rem] font-mono text-[10px]"
                            value={gallerySlotId}
                            onChange={(e) => setGallerySlotId(e.target.value)}
                            placeholder="Slot-ID (default)"
                          />
                        )}
                      </div>
                      <NftTimeLeasePanel nftObjectId={it.objectId} disabled={busy} />
                      {storedPass ? (
                        <p className="text-[10px] text-muted-foreground">
                          Teilen: Object-ID + Passphrase separat (nicht on-chain). Empfänger: Object-ID-Tab → laden →
                          Passphrase.
                        </p>
                      ) : it.needsPassphrase ? (
                        <p className="text-[10px] text-muted-foreground">
                          Keine lokale Passphrase — nach Entsperren hier zum Teilen verfügbar.
                        </p>
                      ) : null}
                      {it.needsPassphrase ? (
                        <div className="space-y-1">
                          <p className="text-xs text-amber-800 dark:text-amber-200">
                            Verschlüsselt — kein Bild bis Passphrase (oben „Alle entsperren & merken“).
                          </p>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={busy || passphrase.trim().length < 8 || !it.ciphertext}
                            onClick={() => {
                              void (async () => {
                                if (!it.ciphertext) return
                                const pass = passphrase.trim()
                                setBusy(true)
                                setError('')
                                try {
                                  const dec = await decryptEvidenceImageBytes(it.ciphertext, pass)
                                  rememberEvidencePassphrase({
                                    objectId: it.objectId,
                                    passphrase: pass,
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
                                            rememberedPass: pass,
                                            previewUrl: url,
                                          }
                                        : row
                                    )
                                  )
                                  setSharePassphrase(pass)
                                } catch (e) {
                                  setError(e instanceof Error ? e.message : String(e))
                                } finally {
                                  setBusy(false)
                                }
                              })()
                            }}
                          >
                            Nur dieses NFT entsperren & merken
                          </Button>
                        </div>
                      ) : null}
                      {it.error && !it.needsPassphrase ? (
                        <p className="text-xs text-destructive">{it.error}</p>
                      ) : null}
                      {it.previewUrl ? (
                        <img
                          src={it.previewUrl}
                          alt={it.name || it.objectId}
                          className="max-h-48 w-full object-contain bg-muted/20"
                        />
                      ) : null}
                    </li>
                    )
                  })}
                </ul>
              ) : null}
              {ownerHasNext ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => void onLoadOwnerPage({ append: true, cursor: ownerCursor })}
                >
                  Mehr laden
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
