'use client'

/**
 * Evidenz-Werkzeug: ImageNFT anzeigen / Owner-Galerie / minten (+ optionale Passphrase).
 * Posteingang-COMPACT_IMG ist ein anderer Kanal — erscheint hier nicht.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ImageIcon, Loader2, RefreshCw } from 'lucide-react'
import { useContactDirectory } from '@/frontend/hooks/use-contact-directory'
import { readContactFavorites } from '@/frontend/lib/contact-phonebook-meta-store'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { decryptEvidenceImageBytes } from '@/frontend/lib/evidence-image-crypto'
import { mintEvidenceImageNft } from '@/frontend/lib/evidence-image-mint'
import {
  burnEvidenceImageNft,
  transferEvidenceImageNft,
} from '@/frontend/lib/evidence-image-transfer'
import {
  buildNftVaultHandoffFromLocal,
  nftVaultTransferHint,
} from '@/frontend/lib/nft-vault-handoff'
import {
  nftSpendPolicyBadgeParts,
  syncNftSpendPolicyFromAttrs,
} from '@/frontend/lib/nft-spend-policy-local-store'
import { nftRoleBadgeLabels } from '@/frontend/lib/nft-role-badges'
import {
  nftVaultHandoffToQrDataUrl,
  preferOfflineHandoffText,
} from '@/frontend/lib/nft-vault-handoff-offline'
import { copyTextSafe } from '@/frontend/lib/copy-text-safe'
import {
  explorerObjectUrlFromId,
  explorerTxUrlFromDigest,
} from '@/frontend/lib/iota-tx-explorer-hint'
import { MessengerNftInfoPanel } from '@/frontend/components/messenger-nft-info-panel'
import { NftCardToolsSection } from '@/frontend/components/nft-card-tools-section'
import { NftTimeLeasePanel } from '@/frontend/components/nft-time-lease-panel'
import { countOpenNftTimeLeases } from '@/frontend/components/nft-time-lease-reclaim-hub'
import { requestNftVaultBalanceRefresh } from '@/frontend/components/dashboard-nft-secured-balances'
import {
  findNftTimeLeaseByNft,
  isNftTimeLeaseEscrowActive,
  listNftTimeLeasesLocal,
  NFT_TIME_LEASE_CHANGED,
} from '@/frontend/lib/nft-time-lease-local-store'
import {
  OPEN_ZEITKAPSEL_LEASE_EVENT,
  writePassphraseNftKeycardBindObjectId,
  writePassphraseNftStrongGateEnabled,
  writeZeitkapselLastNftObjectId,
} from '@/frontend/lib/passphrase-message-local-store'
import { generatePassphraseMessageSharePassphrase } from '@/frontend/lib/passphrase-message-crypto'
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
  scanMailboxMessageObjectById,
  scanMailboxPlaintextForAddress,
  type MailboxPlainScanRow,
} from '@/frontend/lib/evidence-mailbox-plain-scan'
import { decryptPastedPassphraseWire } from '@/frontend/lib/wire-paste-import'
import { isPassphraseMessageWire } from '@/frontend/lib/passphrase-message-crypto'
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
  unbindObjectFromNftKeycard,
  unbindWireFromNftKeycard,
  upsertNftKeycardSlot,
} from '@/frontend/lib/nft-keycard-local-store'
import { checkNftKeycardOwnedBySigner } from '@/frontend/lib/nft-keycard-ownership'
import {
  recordNftActivity,
  syncNftOwnedSnapshotAndDetectReceived,
} from '@/frontend/lib/nft-activity-local-log'
import {
  readNftOwnedSnapshot,
  writeNftOwnedSnapshot,
} from '@/frontend/lib/nft-owned-snapshot'
type Mode = 'object' | 'owner' | 'mint' | 'wire' | 'mailbox' | 'guthaben' | 'zeitkapsel'

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
  /** SHA-256 Hex der Bildbytes (Mint/Vorschau). */
  hash?: string
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
  /** Kompaktbilder (MORG_COMPACT_IMG) aus geladenem Posteingang — kein E2EE-Scanner. */
  { id: 'wire', label: 'Posteingang-Bilder' },
  { id: 'mailbox', label: 'Chain-Text' },
  /** Intern: eigene Galerie — UI-Button „Eigene NFT anzeigen“, kein Such-Tab. */
  { id: 'owner', label: 'Eigene NFT anzeigen' },
  { id: 'object', label: 'NFT Suche' },
  { id: 'mint', label: 'Minten' },
  /** Wie Hauptmenü „Gesichert hinter NFT“ — anlegen + verwalten, nicht nur Erstellen. */
  { id: 'guthaben', label: 'NFT gesichert' },
  /** NFT zeitlich verleihen (Escrow / Zurückholen). Leserecht = Composer „NFT-Leserecht“. */
  { id: 'zeitkapsel', label: 'Verleihen / Zurückholen' },
]

/** Nur anschauen / suchen / laden — keine Mint-/Spend-Aktion. */
const BROWSE_MODE_IDS: readonly Mode[] = ['wire', 'mailbox', 'owner', 'object']
/** Aktives On-Chain-Handeln (Mint, Vault, Leihe). */
const ACT_MODE_IDS: readonly Mode[] = ['mint', 'guthaben', 'zeitkapsel']

/** Hauptmenü-Wallet: Galerie + getrennte Karten-Werkzeuge. */
export const NFT_WALLET_MODES: Mode[] = ['owner', 'object', 'mint', 'guthaben', 'zeitkapsel']

export function ChatViewEvidenceImageViewerButton(p?: {
  triggerClassName?: string
  triggerLabel?: string
  /** Kein sichtbarer Trigger — Öffnen nur per openNonce (z. B. Optionen → Wire/Klartext). */
  hideTrigger?: boolean
  /** Start-Tab beim Öffnen. */
  defaultMode?: Mode
  /** Beim Öffnen sofort eigene Wallet-NFTs laden (Besitzer-Tab). */
  autoLoadOwnOnOpen?: boolean
  /**
   * Erlaubte Tabs. Default: alle (Legacy).
   * Posteingang Optionen: `['wire','mailbox']`. Hauptmenü-Wallet: `NFT_WALLET_MODES`.
   */
  allowedModes?: readonly Mode[]
  /** Erhöhen → Dialog öffnen (nutzt defaultMode). */
  openNonce?: number
  /** Dialog offen/zu — z. B. Parent setzt defaultMode zurück. */
  onOpenChange?: (open: boolean) => void
  /** Vorauswahl Object-ID (Zeitkapsel/Guthaben). */
  preferredObjectId?: string
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
  const wireKlartextOnly =
    allowed.length > 0 &&
    allowed.every((m) => m.id === 'wire' || m.id === 'mailbox')
  const onlyWireBrowse = wireKlartextOnly && allowed.length === 1 && allowed[0]?.id === 'wire'
  const onlyMailboxBrowse = wireKlartextOnly && allowed.length === 1 && allowed[0]?.id === 'mailbox'
  const browseDialogTitle = onlyWireBrowse
    ? 'Posteingang-Bilder'
    : onlyMailboxBrowse
      ? 'Chain-Text'
      : wireKlartextOnly
        ? 'Bilder & Klartext'
        : null
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<Mode>(() => {
    const want = p?.defaultMode || (nftWalletUi ? 'owner' : 'object')
    return allowed.some((m) => m.id === want) ? want : allowed[0]?.id || 'object'
  })
  const [leasePreferredOid, setLeasePreferredOid] = useState(
    () => (p?.preferredObjectId || '').trim().toLowerCase()
  )
  /** Galerie: Leihe-Panel unter einer Karte aufklappen. */
  const [galleryLeaseOid, setGalleryLeaseOid] = useState<string | null>(null)
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
  const [mintLocalPreviewUrl, setMintLocalPreviewUrl] = useState<string | null>(null)
  const [mintAttrs, setMintAttrs] = useState<EvidenceAttrPair[]>([])
  const [mintEncrypt, setMintEncrypt] = useState(true)
  /** Gleiche Datei mehrfach minten (1–100). */
  const [mintCount, setMintCount] = useState(1)
  const [mintFile, setMintFile] = useState<File | null>(null)
  const closeResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [sharePassphrase, setSharePassphrase] = useState('')
  const [mintDigest, setMintDigest] = useState('')
  /** P2: Mint-Passphrase an Schlüsselkarte/Slot */
  const [mintKeycardOid, setMintKeycardOid] = useState('')
  const [mintKeycardSlot, setMintKeycardSlot] = useState('img')
  /** Nach Mint: dieses NFT selbst als Schlüsselkarte speichern (Passphrase → Vault). */
  const [mintRememberAsKeycard, setMintRememberAsKeycard] = useState(true)
  const [lastMintObjectId, setLastMintObjectId] = useState('')
  const [gallerySlotId, setGallerySlotId] = useState('default')
  const [keycardTick, setKeycardTick] = useState(0)
  /** Empfänger für ImageNFT-Transfer (Galerie). */
  const [transferToByOid, setTransferToByOid] = useState<Record<string, string>>({})
  /** Passphrase pro NFT (mehrere PWs) — Entsperren nicht nur über globales Feld. */
  const [unlockPassByOid, setUnlockPassByOid] = useState<Record<string, string>>({})
  /** Lokaler Anzeigename/Notiz pro NFT (Schlüsselkarte.label). */
  const [galleryLocalNoteByOid, setGalleryLocalNoteByOid] = useState<Record<string, string>>({})
  const [lightbox, setLightbox] = useState<{ url: string; name: string } | null>(null)
  /** Verhindert: Klick „Vollbild zu“ fällt durch und schließt den NFT-Dialog. */
  const lightboxClickGuardRef = useRef(false)
  const lightboxGuardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [manualBindOid, setManualBindOid] = useState('')
  const { directory: contactDirectory } = useContactDirectory()
  const recipientSelectOptions = useMemo(() => {
    const fav = readContactFavorites()
    const byAddr = new Map<string, { address: string; label: string; favorite: boolean }>()
    for (const [addr, entry] of Object.entries(contactDirectory)) {
      const a = (addr || '').trim()
      if (!/^0x[a-fA-F0-9]{64}$/i.test(a)) continue
      const key = a.toLowerCase()
      byAddr.set(key, {
        address: a,
        label: (entry?.label || '').trim() || `${a.slice(0, 10)}…`,
        favorite: fav.has(key),
      })
    }
    return Array.from(byAddr.values()).sort((a, b) => {
      if (a.favorite !== b.favorite) return a.favorite ? -1 : 1
      return a.label.localeCompare(b.label, 'de')
    })
  }, [contactDirectory])
  const [wireCandidates, setWireCandidates] = useState<InboxWireImageCandidate[]>([])
  const [wireRows, setWireRows] = useState<InboxWireImageRow[]>([])
  const [wireOffset, setWireOffset] = useState(0)
  const [mailboxIdInput, setMailboxIdInput] = useState('')
  const [mailboxAddrInput, setMailboxAddrInput] = useState('')
  /** Chain-Text: Mailbox+Adresse vs. einzelnes Nachrichten-Objekt. */
  const [mailboxScanKind, setMailboxScanKind] = useState<'mailbox-addr' | 'object'>('mailbox-addr')
  const [mailboxObjectIdInput, setMailboxObjectIdInput] = useState('')
  const [mailboxPwPassphrase, setMailboxPwPassphrase] = useState('')
  const [mailboxPwPlainByKey, setMailboxPwPlainByKey] = useState<Record<string, string>>({})
  const showZeitkapselReclaim =
    allowed.some((m) => m.id === 'zeitkapsel') && !wireKlartextOnly
  const [mailboxPlainRows, setMailboxPlainRows] = useState<MailboxPlainScanRow[]>([])
  const [leaseCounts, setLeaseCounts] = useState({ open: 0, ready: 0 })
  const [globalRefreshing, setGlobalRefreshing] = useState(false)

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
    setMintAttrs([])
    setWireCandidates([])
    setWireRows([])
    setWireOffset(0)
    setMailboxPlainRows([])
    setMailboxIdInput('')
    setMailboxAddrInput('')
    setMailboxScanKind('mailbox-addr')
    setMailboxObjectIdInput('')
    setMailboxPwPassphrase('')
    setMailboxPwPlainByKey({})
  }, [clearSinglePreview, clearOwnerGallery])

  useEffect(() => {
    return () => {
      if (closeResetTimerRef.current) clearTimeout(closeResetTimerRef.current)
      revokeIfObjectUrl(previewUrl)
      revokeAll(ownerItems.map((x) => x.previewUrl).filter(Boolean) as string[])
    }
    // Unmount-only cleanup (preview URLs).
  }, [])

  useEffect(() => {
    if (!mintFile) {
      setMintLocalPreviewUrl((prev) => {
        revokeIfObjectUrl(prev)
        return null
      })
      return
    }
    const ct = mintFile.type || 'image/jpeg'
    setMintContentType(ct)
    const localUrl = URL.createObjectURL(mintFile)
    setMintLocalPreviewUrl((prev) => {
      revokeIfObjectUrl(prev)
      return localUrl
    })
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

  const applyLoadedEvidenceObject = useCallback(
    async (r: Awaited<ReturnType<typeof loadEvidenceImageFromObjectId>>) => {
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
              return true
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
          return true
        }
        return false
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
        return true
      }
      if (!r.parsed) {
        setError('Objekt ohne Bilddaten und ohne URL.')
        return true
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
      return true
    },
    [showDecrypted, showExternalUrl]
  )

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
                if (attrs.length) syncNftSpendPolicyFromAttrs(it.objectId, attrs)
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
          if (attrs.length) syncNftSpendPolicyFromAttrs(it.objectId, attrs)
          mapped.push({ ...it, attrs })
        }
        setOwnerItems((prev) => (opts?.append ? [...prev, ...mapped] : mapped))
        let receivedN = 0
        if (!opts?.append) {
          const me = getDirectIotaSessionSignerAddress()?.toLowerCase()
          const owner = (opts?.ownerOverride || query || ownerAddress).trim().toLowerCase()
          if (me && owner && me === owner) {
            const labels: Record<string, string> = {}
            for (const it of mapped) {
              if (it.name) labels[it.objectId.toLowerCase()] = it.name
            }
            receivedN = syncNftOwnedSnapshotAndDetectReceived(
              mapped.map((x) => x.objectId),
              labels
            ).length
          }
        }
        const totalShown = (opts?.append ? ownerItems.length : 0) + mapped.length
        setInfo(
          `${opts?.append ? totalShown : mapped.length} NFT(s)` +
            (unlocked ? ` · ${unlocked} auto-entsperrt` : '') +
            (receivedN > 0 ? ` · ${receivedN} neu` : '') +
            (r.hasNextPage ? ' · mehr ladbar' : '')
        )
        if (mapped.length === 0 && !opts?.append) {
          setError(
            (r.networkNote ? `${r.networkNote}\n` : '') +
              'Keine passenden NFTs. NFT Suche mit Object-ID für andere Packages — oder RPC auf Testnet stellen (SimpleNFT-Demo).'
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

  /** Object-ID und Wallet-Adresse sind beide 0x+64 Hex — zuerst NFT, sonst Galerie. */
  const onSearchNftOrWallet = useCallback(async () => {
    const id = query.trim()
    if (!isPlausibleIotaObjectId(id)) {
      setError('Walletadresse oder Object-ID: 0x + 64 Hex.')
      return
    }
    setBusy(true)
    setError('')
    setInfo('')
    clearSinglePreview()
    clearOwnerGallery()
    let asNft = false
    try {
      const r = await loadEvidenceImageFromObjectId(id)
      asNft = await applyLoadedEvidenceObject(r)
    } finally {
      if (asNft) setBusy(false)
    }
    if (asNft) return
    setInfo('Kein ImageNFT unter dieser ID — lade als Wallet-Galerie…')
    await onLoadOwnerPage({ append: false, ownerOverride: id })
  }, [
    query,
    clearSinglePreview,
    clearOwnerGallery,
    applyLoadedEvidenceObject,
    onLoadOwnerPage,
  ])

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
    const count = Math.max(1, Math.min(100, Math.floor(Number(mintCount) || 1)))
    setBusy(true)
    setError('')
    setInfo(count > 1 ? `Minte 1/${count}…` : '')
    setSharePassphrase('')
    setMintDigest('')
    try {
      const buf = new Uint8Array(await mintFile.arrayBuffer())
      let r: Awaited<ReturnType<typeof mintEvidenceImageNft>> | null = null
      let okCount = 0
      for (let i = 0; i < count; i++) {
        if (count > 1) setInfo(`Minte ${i + 1}/${count}…`)
        const name =
          count > 1 ? `${mintName.trim()} #${i + 1}` : mintName.trim()
        const one = await mintEvidenceImageNft({
          plainBytes: buf,
          contentType: mintContentType.trim() || mintFile.type || 'image/png',
          name,
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
          // Gleiche Passphrase für die Serie (wenn encrypt) — erstes Ergebnis wiederverwenden
          ...(mintEncrypt && r && r.ok && r.passphrase ? { passphrase: r.passphrase } : {}),
        })
        if (!one.ok) {
          setError(
            count > 1
              ? `Abbruch bei ${i + 1}/${count}: ${one.error} (${okCount} bereits gemintet).`
              : one.error
          )
          if (okCount === 0) return
          break
        }
        okCount += 1
        r = one
        if (one.objectId) {
          setLastMintObjectId(one.objectId)
          recordNftActivity({
            kind: 'mint',
            objectId: one.objectId,
            digest: one.digest,
            label: name,
          })
          try {
            writeNftOwnedSnapshot([...readNftOwnedSnapshot(), one.objectId])
          } catch {
            /* ignore */
          }
        }
        setMintDigest(one.digest)
      }
      if (!r || !r.ok) {
        if (okCount === 0) return
        setInfo(`${okCount} von ${count} gemintet — siehe Fehler oben.`)
        return
      }
      if (r.passphrase) {
        rememberEvidencePassphrase({
          objectId: r.objectId,
          digest: r.digest,
          contentHashHex: r.contentHashHex,
          passphrase: r.passphrase,
        })
      }
      let keycardNote = ''
      if (r.objectId && mintRememberAsKeycard) {
        const passForCard =
          r.passphrase && r.passphrase.length >= 8
            ? r.passphrase
            : generatePassphraseMessageSharePassphrase()
        const upSelf = upsertNftKeycardSlot({
          objectId: r.objectId,
          slotId: 'default',
          passphrase: passForCard,
          note: mintName.trim() || 'ImageNFT',
        })
        keycardNote = upSelf.ok
          ? mintEncrypt
            ? ' Als Schlüsselkarte gemerkt (dieses NFT).'
            : ' Als Schlüsselkarte gemerkt (Object-ID für Zeitkapsel; Mint war ohne Enc).'
          : ` Als Schlüsselkarte: ${upSelf.error}`
        if (upSelf.ok) setKeycardTick((n) => n + 1)
      }
      if (r.objectId) {
        writePassphraseNftKeycardBindObjectId(r.objectId)
        writePassphraseNftStrongGateEnabled(true)
        writeZeitkapselLastNftObjectId(r.objectId)
        const me = getDirectIotaSessionSignerAddress()?.trim()
        if (me) void onLoadOwnerPage({ append: false, ownerOverride: me })
      }
      // Sofort lokale Vorschau — Galerie/Indexer kann nachhängen; Activity zeigt kein Bild.
      {
        const mime = mintContentType.trim() || mintFile.type || 'image/png'
        showDecrypted(buf, mime, {
          objectId: r.objectId,
          name: mintName.trim() || undefined,
          description: mintDesc || undefined,
          classification: mintClassification || undefined,
          encryptedFlag: Boolean(r.passphrase),
          hash: r.contentHashHex,
          source: 'embedded',
        })
      }
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
          keycardNote += bind.ok
            ? ` Zusätzlich an Karte ${mintKeycardOid.slice(0, 10)}… Slot „${slotId}“.`
            : ` Slot gespeichert, Objekt-Bindung: ${bind.error}`
          setKeycardTick((n) => n + 1)
        } else {
          keycardNote += ` Fremd-Karte: ${up.error}`
        }
      }
      const resizeNote =
        r.resized && r.originalBytes != null
          ? ` Verkleinert ${r.originalBytes}→${r.onChainBytes} B (wie Nachrichten).`
          : ''
      const oidNote = r.objectId ? ` Object-ID: ${r.objectId.slice(0, 12)}…` : ''
      const batchNote = okCount > 1 ? ` Serie: ${okCount} NFTs.` : ''
      if (r.passphrase) {
        setSharePassphrase(r.passphrase)
        setInfo(
          `Mint OK (${r.onChainBytes} B on-chain).${batchNote}${resizeNote}${oidNote}${keycardNote} Passphrase unten kopieren und separat teilen — für dich auf diesem Gerät im Vault gemerkt.`
        )
      } else {
        setInfo(
          `Mint OK (Klartext on-chain, ${r.onChainBytes} B).${batchNote}${resizeNote}${oidNote} Digest: ${r.digest}`
        )
      }
    } finally {
      setBusy(false)
    }
  }, [
    mintFile,
    mintName,
    mintCount,
    mintDesc,
    mintClassification,
    mintContentType,
    mintAttrs,
    mintEncrypt,
    mintKeycardOid,
    mintKeycardSlot,
    mintRememberAsKeycard,
    onLoadOwnerPage,
    showDecrypted,
  ])

  const onScanMailboxPlain = useCallback(async () => {
    setBusy(true)
    setError('')
    setInfo('')
    setMailboxPlainRows([])
    setMailboxPwPlainByKey({})
    clearSinglePreview()
    clearOwnerGallery()
    try {
      const snap = getDirectMailboxChainSnapshot()
      const r =
        mailboxScanKind === 'object'
          ? await scanMailboxMessageObjectById({ objectId: mailboxObjectIdInput })
          : await scanMailboxPlaintextForAddress({
              mailboxObjectId: mailboxIdInput.trim() || snap?.mailboxId,
              packageId: snap?.packageId,
              address: mailboxAddrInput.trim() || getDirectIotaSessionSignerAddress() || '',
            })
      if (!r.ok) {
        setError(r.error)
        return
      }
      setMailboxPlainRows(r.rows)
      const plainN = r.rows.filter((x) => !x.encrypted).length
      const encN = r.encryptedDfCount || r.rows.filter((x) => x.encrypted).length
      if (r.rows.length) {
        setInfo(
          `${plainN} Klartext · ${encN} Enc · DF ${r.dfCount} · Events ${r.eventCount}` +
            (r.mailboxObjectId.startsWith('0x') ? ` · MB ${r.mailboxObjectId.slice(0, 10)}…` : '') +
            (r.hint ? `\n${r.hint}` : '')
        )
      } else {
        setError(r.hint || 'Nichts gefunden.')
        setInfo('')
      }
    } finally {
      setBusy(false)
    }
  }, [
    mailboxScanKind,
    mailboxObjectIdInput,
    mailboxIdInput,
    mailboxAddrInput,
    clearSinglePreview,
    clearOwnerGallery,
  ])

  const onPrimary = useCallback(() => {
    if (mode === 'object') void onSearchNftOrWallet()
    else if (mode === 'owner') void onLoadOwnerPage({ append: false })
    else if (mode === 'wire') void onLoadWire({ append: false })
    else if (mode === 'mailbox') void onScanMailboxPlain()
    else void onMint()
  }, [mode, onSearchNftOrWallet, onLoadOwnerPage, onLoadWire, onScanMailboxPlain, onMint])

  useEffect(() => {
    const syncLeases = () => {
      setLeaseCounts(countOpenNftTimeLeases())
      /** Während Escrow aus Galerie nehmen; nach Reclaim bleibt Eintrag bis Reload — Dropdown aktualisiert sich. */
      setOwnerItems((prev) =>
        prev.filter((it) => !isNftTimeLeaseEscrowActive(findNftTimeLeaseByNft(it.objectId)))
      )
      setGalleryLeaseOid((cur) => {
        if (!cur) return cur
        return isNftTimeLeaseEscrowActive(findNftTimeLeaseByNft(cur)) ? null : cur
      })
    }
    syncLeases()
    window.addEventListener(NFT_TIME_LEASE_CHANGED, syncLeases)
    const t = window.setInterval(syncLeases, 5000)
    return () => {
      window.removeEventListener(NFT_TIME_LEASE_CHANGED, syncLeases)
      window.clearInterval(t)
    }
  }, [])

  /** Immer erreichbar: aktueller Reiter + Vault-Summen + Lease-Index. */
  const onRefreshEverything = useCallback(async () => {
    setGlobalRefreshing(true)
    setError('')
    try {
      requestNftVaultBalanceRefresh()
      setLeaseCounts(countOpenNftTimeLeases())
      if (mode === 'owner') {
        const addr = (ownerAddress || query || getDirectIotaSessionSignerAddress() || '').trim()
        if (addr) await onLoadOwnerPage({ append: false, ownerOverride: addr })
      } else if (mode === 'object' && query.trim()) {
        await onSearchNftOrWallet()
      } else if (mode === 'wire') {
        await onLoadWire({ append: false })
      } else if (mode === 'mailbox') {
        await onScanMailboxPlain()
      } else if (mode === 'guthaben' || mode === 'zeitkapsel') {
        const addr = getDirectIotaSessionSignerAddress()
        if (addr) {
          try {
            const { syncDiscoveredNftTimeLeasesIntoLocalIndex } = await import(
              '@/frontend/lib/nft-time-lease-discover-onchain'
            )
            const lr = await syncDiscoveredNftTimeLeasesIntoLocalIndex()
            setLeaseCounts(countOpenNftTimeLeases())
            if (lr.ok) {
              setInfo(
                lr.found > 0
                  ? `Vault-/Lease-Index: ${lr.active} offene Leihe(n) von Chain.`
                  : 'Vault-/Lease-Index aktualisiert. Galerie optional über „Eigene NFT“.'
              )
            } else {
              setInfo('Vault-Index aktualisiert. Lease-Scan: ' + lr.error)
            }
          } catch {
            setInfo('Vault-/Lease-Index aktualisiert. Galerie optional über „Eigene NFT“.')
          }
        }
      }
      setInfo((prev) => prev || 'Aktualisiert.')
    } finally {
      setGlobalRefreshing(false)
    }
  }, [
    mode,
    ownerAddress,
    query,
    onLoadOwnerPage,
    onSearchNftOrWallet,
    onLoadWire,
    onScanMailboxPlain,
  ])

  const loadOwnWalletGallery = useCallback(() => {
    const addr = getDirectIotaSessionSignerAddress()
    if (!addr) {
      setMode('owner')
      setError('Kein Session-Signer — Tresor entsperren.')
      return
    }
    const alreadyOwn =
      Boolean(ownerAddress) && addr.toLowerCase() === ownerAddress.toLowerCase()
    /** Nur im Galerie-Tab ausblenden — nicht, wenn Guthaben/Zeitkapsel die Galerie still geladen hat. */
    if (mode === 'owner' && alreadyOwn) {
      clearOwnerGallery()
      clearSinglePreview()
      setError('')
      setInfo('')
      return
    }
    setMode('owner')
    setError('')
    setInfo('')
    setMailboxPlainRows([])
    setWireRows([])
    if (alreadyOwn && ownerItems.length > 0) {
      setQuery(addr)
      return
    }
    setQuery(addr)
    void onLoadOwnerPage({ append: false, ownerOverride: addr })
  }, [
    mode,
    onLoadOwnerPage,
    ownerAddress,
    ownerItems.length,
    clearOwnerGallery,
    clearSinglePreview,
  ])

  useEffect(() => {
    if (!p?.openNonce || p.openNonce < 1) return
    const want = p.defaultMode || (nftWalletUi ? 'owner' : 'object')
    const startMode = allowed.some((m) => m.id === want) ? want : allowed[0]?.id || 'object'
    setMode(startMode)
    setOpen(true)
    p?.onOpenChange?.(true)
    if (p.autoLoadOwnOnOpen && startMode === 'owner') {
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
  }, [p?.openNonce])

  useEffect(() => {
    const onOpenLease = (ev: Event) => {
      const detail = (ev as CustomEvent<{ objectId?: string }>).detail
      const oid = String(detail?.objectId || '')
        .trim()
        .toLowerCase()
      if (!/^0x[a-f0-9]{64}$/.test(oid)) return
      if (allowed.length && !allowed.some((m) => m.id === 'zeitkapsel')) return
      setLeasePreferredOid(oid)
      setMode('zeitkapsel')
      setOpen(true)
      p?.onOpenChange?.(true)
      setError('')
      setInfo(`Verleihen: NFT ${oid.slice(0, 10)}… vorausgewählt — Leihe starten.`)
    }
    window.addEventListener(OPEN_ZEITKAPSEL_LEASE_EVENT, onOpenLease)
    return () => window.removeEventListener(OPEN_ZEITKAPSEL_LEASE_EVENT, onOpenLease)
  }, [allowed, p])

  /** Zeitkapsel/Guthaben: Galerie still nachladen, damit Dropdown nicht leer bleibt. */
  useEffect(() => {
    if (mode !== 'zeitkapsel' && mode !== 'guthaben') return
    if (ownerItems.length > 0 || busy) return
    const me = getDirectIotaSessionSignerAddress()?.trim()
    if (!me || !isPlausibleIotaObjectId(me)) return
    void onLoadOwnerPage({ append: false, ownerOverride: me })
  }, [mode, ownerItems.length, busy, onLoadOwnerPage])

  const dismissLightbox = useCallback(() => {
    lightboxClickGuardRef.current = true
    if (lightboxGuardTimerRef.current) clearTimeout(lightboxGuardTimerRef.current)
    setLightbox(null)
    lightboxGuardTimerRef.current = setTimeout(() => {
      lightboxClickGuardRef.current = false
      lightboxGuardTimerRef.current = null
    }, 400)
  }, [])

  /** Escape schließt nur Vollbild — nicht den NFT-Dialog (sonst Flackern). */
  useEffect(() => {
    if (!lightbox) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopImmediatePropagation()
      dismissLightbox()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [lightbox, dismissLightbox])

  useEffect(() => {
    return () => {
      if (lightboxGuardTimerRef.current) clearTimeout(lightboxGuardTimerRef.current)
    }
  }, [])

  return (
    <>
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v && (lightbox || lightboxClickGuardRef.current)) {
          dismissLightbox()
          return
        }
        setOpen(v)
        p?.onOpenChange?.(v)
        if (!v) {
          setLightbox(null)
          /** Kein resetAll während Close-Animation (Flackern). Cleanup erst lange nach Exit. */
          if (closeResetTimerRef.current) clearTimeout(closeResetTimerRef.current)
          closeResetTimerRef.current = setTimeout(() => {
            closeResetTimerRef.current = null
            resetAll()
          }, 600)
          return
        }
        if (closeResetTimerRef.current) {
          clearTimeout(closeResetTimerRef.current)
          closeResetTimerRef.current = null
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
      {/* Kein DialogTrigger: kontrolliertes open + Trigger toggelt sonst beim X neu auf (Flackern). */}
      {p?.hideTrigger ? null : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={
            p?.triggerClassName ||
            'w-full justify-start rounded-md border-0 bg-transparent px-2 py-1.5 text-left text-sm hover:bg-accent'
          }
          onClick={() => {
            setOpen(true)
            p?.onOpenChange?.(true)
          }}
        >
          <ImageIcon className="mr-2 h-4 w-4 shrink-0" />
          {p?.triggerLabel ?? (browseDialogTitle || 'On-Chain Bild / NFT')}
        </Button>
      )}
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[90vh] max-w-lg flex-col overflow-hidden p-0 sm:max-w-lg"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border/60 px-6 pb-3 pt-6">
          <DialogHeader className="flex-1 text-left">
            <DialogTitle>
              {nftWalletUi
                ? 'NFT & Schlüsselkarte'
                : browseDialogTitle || 'On-Chain / NFT'}
            </DialogTitle>
            {onlyWireBrowse ? (
              <DialogDescription className="sr-only">Posteingang-Bilder</DialogDescription>
            ) : onlyMailboxBrowse ? (
              <DialogDescription className="sr-only">Chain-Text</DialogDescription>
            ) : wireKlartextOnly ? (
              <DialogDescription className="sr-only">Bilder und Klartext</DialogDescription>
            ) : !nftWalletUi ? (
              <DialogDescription className="sr-only">On-Chain / NFT</DialogDescription>
            ) : (
              <DialogDescription className="sr-only">
                Galerie per Wallet-Adresse oder einzelnes NFT per Object-ID; darunter Minten, Guthaben,
                Verleihen.
              </DialogDescription>
            )}
          </DialogHeader>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-0.5 h-8 shrink-0 px-2"
            aria-label="Schließen"
            onClick={() => {
              setOpen(false)
              p?.onOpenChange?.(false)
              if (closeResetTimerRef.current) clearTimeout(closeResetTimerRef.current)
              closeResetTimerRef.current = setTimeout(() => {
                closeResetTimerRef.current = null
                resetAll()
              }, 600)
            }}
          >
            Schließen
          </Button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col px-6 pb-6">
        <div className="shrink-0 space-y-2 border-b border-border/60 bg-background pb-2 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 text-[11px]"
              disabled={busy || globalRefreshing}
              title="Aktuellen Bereich + Purse-Summen + Lease-Index neu laden"
              onClick={() => void onRefreshEverything()}
            >
              <RefreshCw
                className={`mr-1.5 h-3.5 w-3.5 ${globalRefreshing || busy ? 'animate-spin' : ''}`}
                aria-hidden
              />
              Aktualisieren
            </Button>
            {showZeitkapselReclaim ? (
              <Button
                type="button"
                size="sm"
                variant={mode === 'zeitkapsel' ? 'default' : 'outline'}
                className="h-8 min-w-[7.5rem] text-[11px]"
                disabled={leaseCounts.open === 0}
                title={
                  leaseCounts.open === 0
                    ? 'Keine offene Leihe'
                    : 'Offene Verleihungen — Zurückholen unter Verleihen'
                }
                onClick={() => {
                  setMode('zeitkapsel')
                  setError('')
                  setInfo(
                    leaseCounts.ready > 0
                      ? `${leaseCounts.ready} bereit zum Zurückholen — Liste oben unter Verleihen.`
                      : `${leaseCounts.open} offene Leihe(n) — Countdown abwarten oder Entleiher gibt vorzeitig zurück.`
                  )
                }}
              >
                {leaseCounts.open === 0
                  ? 'Zurückholen'
                  : leaseCounts.ready > 0
                    ? `Zurückholen (${leaseCounts.ready})`
                    : `Zurückholen · ${leaseCounts.open}`}
              </Button>
            ) : null}
          </div>
          {(() => {
            const switchMode = (id: Mode) => {
              setMode(id)
              setError('')
              setInfo('')
              clearSinglePreview()
              /**
               * Galerie behalten beim Wechsel innerhalb Wallet-Tabs (sonst springt der Dialog,
               * weil der Inhalt schrumpft). Nur Wire/Klartext leeren die Galerie.
               */
              if (id === 'wire' || id === 'mailbox') {
                clearOwnerGallery()
              }
              setWireRows([])
              setWireCandidates([])
              setWireOffset(0)
              setMailboxPlainRows([])
            }
            const browseTabs = allowed.filter((m) => BROWSE_MODE_IDS.includes(m.id))
            const actTabs = allowed.filter((m) => ACT_MODE_IDS.includes(m.id))
            const showGroups = browseTabs.length > 0 && actTabs.length > 0
            const renderTabs = (tabs: typeof allowed, opts?: { ownFirst?: boolean }) => (
              <div className="flex min-h-9 flex-wrap items-center gap-2">
                {opts?.ownFirst && tabs.some((t) => t.id === 'owner') ? (
                  <Button
                    type="button"
                    size="sm"
                    className="h-8"
                    variant={mode === 'owner' ? 'default' : 'outline'}
                    disabled={busy}
                    title="Eigene NFT laden / anzeigen"
                    onClick={() => void loadOwnWalletGallery()}
                  >
                    {busy && mode === 'owner' ? (
                      <>
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        Laden…
                      </>
                    ) : (
                      'Eigene NFT anzeigen'
                    )}
                  </Button>
                ) : null}
                {tabs
                  .filter((t) => !(opts?.ownFirst && t.id === 'owner'))
                  .map(({ id, label }) => (
                    <Button
                      key={id}
                      type="button"
                      size="sm"
                      className="h-8"
                      variant={mode === id ? 'default' : 'outline'}
                      onClick={() => switchMode(id)}
                    >
                      {label}
                    </Button>
                  ))}
              </div>
            )
            if (!showGroups) {
              return renderTabs(allowed, { ownFirst: true })
            }
            return (
              <div className="space-y-2">
                <div
                  className={`space-y-1 rounded-md p-2 ${
                    BROWSE_MODE_IDS.includes(mode)
                      ? 'bg-muted/40 ring-1 ring-border/60'
                      : 'opacity-90'
                  }`}
                >
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    1 · Schauen / suchen
                  </p>
                  {renderTabs(browseTabs, { ownFirst: true })}
                </div>
                <div
                  className={`space-y-1 rounded-md border-t border-border/50 p-2 pt-2 ${
                    ACT_MODE_IDS.includes(mode)
                      ? 'bg-muted/40 ring-1 ring-border/60'
                      : 'opacity-90'
                  }`}
                >
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    2 · Handeln
                  </p>
                  {renderTabs(actTabs)}
                </div>
              </div>
            )
          })()}
        </div>

        <div className="min-h-[min(52vh,28rem)] flex-1 overflow-y-auto pt-3">
          {mode === 'guthaben' || mode === 'zeitkapsel' ? (
            <NftCardToolsSection
              tool={mode}
              disabled={busy}
              preferredObjectId={leasePreferredOid || p?.preferredObjectId}
              extraOptions={ownerItems.map((it) => ({
                objectId: it.objectId,
                label: it.name || 'NFT',
                previewUrl: it.previewUrl,
              }))}
            />
          ) : mode === 'wire' ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Kompaktbilder</span> aus dem{' '}
                <strong className="text-foreground">aktuell geladenen</strong> Posteingang (MORG_COMPACT_IMG).
                Kein E2EE-Entschlüsseln, kein Mint — nur Anzeigen. Filter „Verschlüsselt“ in der Liste ist etwas
                anderes.
              </p>
              <Button type="button" onClick={onPrimary} disabled={busy}>
                {busy ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Laden…
                  </>
                ) : (
                  `Bilder laden (max. ${EVIDENCE_IMAGE_OWNER_PAGE_SIZE})`
                )}
              </Button>
            </div>
          ) : mode === 'mailbox' ? (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={mailboxScanKind === 'mailbox-addr' ? 'default' : 'outline'}
                  className="h-8"
                  onClick={() => setMailboxScanKind('mailbox-addr')}
                >
                  Mailbox / Adresse
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={mailboxScanKind === 'object' ? 'default' : 'outline'}
                  className="h-8"
                  onClick={() => setMailboxScanKind('object')}
                >
                  Object-ID
                </Button>
              </div>
              {mailboxScanKind === 'mailbox-addr' ? (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="mb-scan-id">Mailbox</Label>
                    <Input
                      id="mb-scan-id"
                      value={mailboxIdInput}
                      onChange={(e) => setMailboxIdInput(e.target.value)}
                      placeholder="0x… Mailbox (leer = Snapshot)"
                      spellCheck={false}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="mb-scan-addr">Adresse</Label>
                    <Input
                      id="mb-scan-addr"
                      value={mailboxAddrInput}
                      onChange={(e) => setMailboxAddrInput(e.target.value)}
                      placeholder="0x… (leer = eigene Session)"
                      spellCheck={false}
                    />
                  </div>
                </>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="mb-scan-oid">Object-ID</Label>
                  <Input
                    id="mb-scan-oid"
                    value={mailboxObjectIdInput}
                    onChange={(e) => setMailboxObjectIdInput(e.target.value)}
                    placeholder="0x… PlainMsgKey / MsgKey"
                    spellCheck={false}
                  />
                </div>
              )}
              <Button type="button" onClick={() => void onScanMailboxPlain()} disabled={busy}>
                {busy ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Scannen…
                  </>
                ) : mailboxScanKind === 'object' ? (
                  'Objekt laden'
                ) : (
                  'Scannen'
                )}
              </Button>
              <div className="space-y-1.5">
                <Label htmlFor="mb-scan-pw">Passphrase (nur PWMSG)</Label>
                <Input
                  id="mb-scan-pw"
                  type="password"
                  value={mailboxPwPassphrase}
                  onChange={(e) => setMailboxPwPassphrase(e.target.value)}
                  placeholder="wenn Wire MORG_PWMSG_V1 ist"
                  autoComplete="off"
                />
              </div>
            </div>
          ) : mode === 'owner' ? (
            ownerAddress ? (
              <p className="text-[10px] text-muted-foreground break-all">
                Angezeigt für: {ownerAddress}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Oben „Eigene NFT anzeigen“ — oder unter NFT Suche eine Walletadresse / Object-ID laden.
              </p>
            )
          ) : mode !== 'mint' ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="evidence-query">Walletadresse oder Object-ID</Label>
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
                {(() => {
                  const hit = recipientSelectOptions.find(
                    (o) => o.address.toLowerCase() === query.trim().toLowerCase()
                  )
                  return hit ? (
                    <p className="text-[10px] text-muted-foreground">Kontakt: {hit.label}</p>
                  ) : null
                })()}
                {recipientSelectOptions.length > 0 ? (
                  <details className="rounded-md border border-border/70 bg-muted/10 px-2 py-1.5">
                    <summary className="cursor-pointer text-[11px] font-medium text-foreground">
                      Aus Telefonbuch wählen
                    </summary>
                    <ul className="mt-1.5 max-h-40 space-y-0.5 overflow-y-auto">
                      {recipientSelectOptions.map((o) => (
                        <li key={o.address}>
                          <button
                            type="button"
                            className="w-full rounded px-2 py-1.5 text-left text-[11px] hover:bg-muted"
                            onClick={() => setQuery(o.address)}
                          >
                            <span className="font-medium text-foreground">
                              {o.favorite ? '★ ' : ''}
                              {o.label}
                            </span>
                            <span className="mt-0.5 block truncate font-mono text-[9px] text-muted-foreground">
                              {o.address}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </div>
              <Button type="button" onClick={onPrimary} disabled={busy || !query.trim()}>
                {busy ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Laden…
                  </>
                ) : (
                  'Suchen / laden'
                )}
              </Button>
              {ownerAddress ? (
                <p className="text-[10px] text-muted-foreground break-all">
                  Galerie für: {ownerAddress}
                </p>
              ) : null}
            </>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="mint-file">Bild (PNG / JPEG / WebP)</Label>
                <Input
                  id="mint-file"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => setMintFile(e.target.files?.[0] ?? null)}
                />
                <p className="text-[10px] text-muted-foreground">
                  Große Dateien werden vor dem Mint automatisch verkleinert (Ziel ~12 KB, hart max. ~98 KB
                  on-chain).
                </p>
                {mintLocalPreviewUrl ? (
                  <img
                    src={mintLocalPreviewUrl}
                    alt={mintFile?.name || 'Mint-Vorschau'}
                    className="mt-1 max-h-40 w-full rounded-md border border-border object-contain bg-muted/20"
                  />
                ) : null}
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
                <Label htmlFor="mint-count">Anzahl gleicher NFTs (1–100)</Label>
                <Input
                  id="mint-count"
                  type="number"
                  min={1}
                  max={100}
                  step={1}
                  value={mintCount}
                  onChange={(e) => {
                    const n = Math.floor(Number(e.target.value))
                    setMintCount(Number.isFinite(n) ? Math.max(1, Math.min(100, n)) : 1)
                  }}
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
              <div className="space-y-2 rounded-md border border-border p-3">
                <p className="text-sm font-medium">Zusätzliche Attribute (max. {EVIDENCE_ATTR_MAX_PAIRS})</p>
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

              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={mintEncrypt}
                  onChange={(e) => setMintEncrypt(e.target.checked)}
                />
                Bild on-chain verschlüsseln
              </label>
              <label className="flex items-start gap-2 text-[11px] text-foreground">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={mintRememberAsKeycard}
                  onChange={(e) => setMintRememberAsKeycard(e.target.checked)}
                />
                <span>
                  Als Schlüsselkarte merken
                  {mintEncrypt
                    ? ' (Passphrase + Object-ID lokal)'
                    : ' (Object-ID für Zeitkapsel/Composer)'}
                </span>
              </label>
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
                ) : mintCount > 1 ? (
                  `${mintCount} ImageNFTs minten`
                ) : (
                  'ImageNFT minten'
                )}
              </Button>
              {lastMintObjectId || sharePassphrase ? (
                <div className="space-y-2 rounded-md border border-emerald-700/40 bg-emerald-950/20 p-3">
                  <p className="text-xs font-medium text-foreground">Mint fertig — das brauchst du als Nächstes</p>
                  {lastMintObjectId ? (
                    <div className="space-y-2">
                      <MessengerNftInfoPanel
                        objectId={lastMintObjectId}
                        digest={mintDigest || undefined}
                        packageId={getDirectMailboxChainSnapshot()?.packageId}
                        name={mintName.trim() || undefined}
                        variant="full"
                        showInfoButton
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            void copyTextSafe(lastMintObjectId)
                            setInfo(`Object-ID kopiert: ${lastMintObjectId}`)
                          }}
                        >
                          Object-ID kopieren
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            writePassphraseNftKeycardBindObjectId(lastMintObjectId)
                            writePassphraseNftStrongGateEnabled(true)
                            writeZeitkapselLastNftObjectId(lastMintObjectId)
                            setInfo(
                              'NFT für NFT-Leserecht übernommen — Composer: Modus an, Object-ID gesetzt. Galerie: Tab „Eigene“ + Laden.'
                            )
                          }}
                        >
                          Für NFT-Leserecht übernehmen
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setMode('object')
                            setQuery(lastMintObjectId)
                            setError('')
                            setInfo('')
                            void (async () => {
                              setBusy(true)
                              try {
                                const r = await loadEvidenceImageFromObjectId(lastMintObjectId)
                                if (!r.ok) {
                                  if (r.needsPassphrase && r.ciphertext) {
                                    setPendingCipher(r.ciphertext)
                                    setPendingObjectId(lastMintObjectId)
                                    setError(
                                      'Verschlüsselt — Passphrase eingeben und entsperren, dann erscheint das Bild.'
                                    )
                                    return
                                  }
                                  setError(r.error || 'Bild nicht ladbar.')
                                  return
                                }
                                if (r.source === 'embedded' && r.parsed) {
                                  showDecrypted(r.parsed.bytes, r.parsed.mime, {
                                    objectId: lastMintObjectId,
                                    name: r.name,
                                    description: r.description,
                                    classification: r.classification,
                                    source: 'embedded',
                                  })
                                  setInfo('Bild vom Mint-Objekt geladen.')
                                  return
                                }
                                if (r.displayUrl) {
                                  showExternalUrl(r.displayUrl, {
                                    objectId: lastMintObjectId,
                                    name: r.name,
                                    description: r.description,
                                    classification: r.classification,
                                  })
                                  setInfo('Bild-URL vom Mint-Objekt geladen.')
                                  return
                                }
                                setError('Kein Bild in diesem NFT.')
                              } catch (e) {
                                setError(e instanceof Error ? e.message : String(e))
                              } finally {
                                setBusy(false)
                              }
                            })()
                          }}
                        >
                          Bild dieses NFT laden
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setMode('owner')
                            setError('')
                            setInfo('')
                            const me = getDirectIotaSessionSignerAddress()?.trim()
                            if (me) void onLoadOwnerPage({ append: false, ownerOverride: me })
                          }}
                        >
                          In Galerie laden
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setMode('guthaben')
                            setError('')
                            setInfo('')
                          }}
                        >
                          Weiter zu NFT gesichert
                        </Button>
                      </div>
                    </div>
                  ) : null}
                  {sharePassphrase ? (
                    <div className="space-y-1 border-t border-border/50 pt-2">
                      <p className="text-xs font-medium">Passphrase — jetzt kopieren & separat teilen</p>
                      <Input readOnly value={sharePassphrase} className="font-mono text-xs" />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void copyTextSafe(sharePassphrase)}
                      >
                        Passphrase kopieren
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}

          {pendingCipher &&
          mode !== 'mint' &&
          mode !== 'guthaben' &&
          mode !== 'zeitkapsel' ? (
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
              <Button type="button" size="sm" disabled={busy} onClick={() => void onDecryptPending()}>
                Entschlüsseln
              </Button>
            </div>
          ) : null}

          {sharePassphrase && mode !== 'mint' && mode !== 'guthaben' && mode !== 'zeitkapsel' ? (
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

          {/* Nur Galerie: sonst wirkt der Block in Wire/Klartext/Minten wie eine weitere Aktion. */}
          {listNftKeycards().length > 0 && (mode === 'owner' || mode === 'object') ? (
            <details className="rounded-md border border-border/70 bg-muted/15 p-2.5">
              <summary className="cursor-pointer text-xs font-medium text-foreground">
                Optional · Lokal ImageNFT an Schlüsselkarte merken
              </summary>
              <div className="mt-2 space-y-2">
              <p className="text-[10px] text-muted-foreground">
                <span className="text-foreground">Nur lokaler Merker</span> — welches andere ImageNFT dieselbe
                Passphrase/Slot nutzt (z. B. Partner-Kopie). Kein Chain-Lock, kein Chat-Senden. PWMSG „an Karte“
                geht im Composer. Erst Galerie laden, dann Object wählen oder ID eintragen → „Lokal zuordnen“.
              </p>
              {listNftKeycards().map(({ objectId, entry }) => (
                <div key={`${objectId}-${keycardTick}`} className="space-y-1 border-t border-border/50 pt-2">
                  <p className="font-mono text-[10px] break-all text-muted-foreground">
                    Karte {entry.label ? `${entry.label} · ` : ''}
                    {objectId.slice(0, 14)}…
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {ownerItems.length > 0 ? (
                      <select
                        className="h-7 min-w-[10rem] flex-1 rounded-md border border-input bg-background px-1.5 font-mono text-[10px]"
                        value={
                          ownerItems.some((it) => it.objectId.toLowerCase() === manualBindOid.trim().toLowerCase())
                            ? manualBindOid.trim().toLowerCase()
                            : ''
                        }
                        onChange={(e) => setManualBindOid(e.target.value)}
                      >
                        <option value="">ImageNFT aus Galerie…</option>
                        {ownerItems.map((it) => (
                          <option key={it.objectId} value={it.objectId.toLowerCase()}>
                            {(it.name || 'NFT') + ' · ' + it.objectId.slice(0, 10) + '…'}
                          </option>
                        ))}
                      </select>
                    ) : null}
                    <Input
                      className="h-7 min-w-[10rem] flex-1 font-mono text-[10px]"
                      value={manualBindOid}
                      onChange={(e) => setManualBindOid(e.target.value)}
                      placeholder="oder Object-ID (0x…)"
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
                        setError('')
                        setManualBindOid('')
                        setKeycardTick((n) => n + 1)
                        setInfo(
                          `ImageNFT ${bound.slice(0, 12)}… lokal an diese Karte (Passphrase-Slot) gebunden — nur Merker, kein Chain-Spend.`
                        )
                      }}
                    >
                      Lokal zuordnen
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
            </details>
          ) : null}

          {meta && previewUrl ? (
            <div className="space-y-2">
              {meta.objectId ? (
                <MessengerNftInfoPanel
                  objectId={meta.objectId}
                  packageId={getDirectMailboxChainSnapshot()?.packageId}
                  name={meta.name}
                  showInfoButton
                  variant="compact"
                />
              ) : null}
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

          {(mode === 'owner' || mode === 'object') && (ownerItems.length > 0 || ownerHasNext) ? (
            <div className="space-y-3">
              {ownerItems.length > 0 ? (
                <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {ownerItems.map((it) => {
                    const storedPass =
                      it.rememberedPass ||
                      lookupEvidencePassphrase({ objectId: it.objectId, allowDefault: false }) ||
                      ''
                    const displayName =
                      (
                        galleryLocalNoteByOid[it.objectId] ||
                        getNftKeycard(it.objectId)?.label ||
                        it.name ||
                        ''
                      ).trim() ||
                      (it.source === 'url' ? 'URL-NFT' : 'ImageNFT')
                    const badges = [
                      ...nftRoleBadgeLabels(it.objectId),
                      ...nftSpendPolicyBadgeParts(it.objectId, it.attrs),
                    ]
                    return (
                    <li key={it.objectId} className="rounded-md border border-border p-2">
                      <div className="flex gap-2">
                        {it.previewUrl ? (
                          <img
                            src={it.previewUrl}
                            alt=""
                            className="h-14 w-14 shrink-0 rounded border border-border object-cover bg-muted/20"
                          />
                        ) : (
                          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded border border-dashed border-border text-[9px] text-muted-foreground">
                            {it.needsPassphrase ? 'PW' : '—'}
                          </div>
                        )}
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <p className="truncate text-sm font-medium text-foreground" title={displayName}>
                            {displayName}
                          </p>
                          {it.classification ? (
                            <p className="text-[10px] text-muted-foreground">{it.classification}</p>
                          ) : null}
                          <p className="truncate font-mono text-[10px] text-muted-foreground" title={it.objectId}>
                            {it.objectId.slice(0, 10)}…{it.objectId.slice(-6)}
                          </p>
                          {badges.length ? (
                            <p className="text-[10px] text-sky-100/90">{badges.join(' · ')}</p>
                          ) : null}
                        </div>
                        <MessengerNftInfoPanel
                          objectId={it.objectId}
                          name={displayName}
                          classification={it.classification}
                          attrsText={
                            it.attrs?.length
                              ? it.attrs.map((a) => `${a.key}=${a.value}`).join(' · ')
                              : undefined
                          }
                          contentHash={it.parsed?.hash || undefined}
                          variant="button"
                          className="shrink-0"
                        />
                      </div>

                      {it.previewUrl ? (
                        <details className="mt-1.5">
                          <summary className="cursor-pointer text-[10px] text-foreground">
                            Bild groß
                          </summary>
                          <button
                            type="button"
                            className="mt-1 block w-full"
                            title="Vollbild"
                            onClick={() => setLightbox({ url: it.previewUrl!, name: displayName })}
                          >
                            <img
                              src={it.previewUrl}
                              alt={displayName}
                              className="max-h-48 w-full rounded border border-border object-contain bg-muted/20"
                            />
                          </button>
                          <p className="mt-0.5 text-[10px] text-muted-foreground">Tippen → Vollbild</p>
                        </details>
                      ) : null}

                      {it.needsPassphrase ? (
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <Input
                            type="password"
                            className="h-8 min-w-[8rem] flex-1 text-[11px]"
                            value={unlockPassByOid[it.objectId] ?? ''}
                            onChange={(e) =>
                              setUnlockPassByOid((m) => ({ ...m, [it.objectId]: e.target.value }))
                            }
                            placeholder="Passphrase (≥8)"
                            autoComplete="off"
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="h-8 text-[11px]"
                            disabled={
                              busy ||
                              !it.ciphertext ||
                              (unlockPassByOid[it.objectId] || passphrase).trim().length < 8
                            }
                            onClick={() => {
                              void (async () => {
                                if (!it.ciphertext) return
                                const pass = (unlockPassByOid[it.objectId] || passphrase).trim()
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
                                  setPassphrase(pass)
                                } catch (e) {
                                  setError(e instanceof Error ? e.message : String(e))
                                } finally {
                                  setBusy(false)
                                }
                              })()
                            }}
                          >
                            Entsperren
                          </Button>
                        </div>
                      ) : null}
                      {it.error && !it.needsPassphrase ? (
                        <p className="mt-1 text-xs text-destructive">{it.error}</p>
                      ) : null}

                      {it.source !== 'url' ? (
                        <details className="mt-1.5">
                          <summary className="cursor-pointer text-[11px] font-medium text-foreground">
                            Senden
                          </summary>
                          <div className="mt-2 space-y-1.5 rounded-md border border-primary/30 bg-primary/5 p-2">
                            <Input
                              className="h-8 w-full font-mono text-[11px]"
                              value={transferToByOid[it.objectId] || ''}
                              onChange={(e) =>
                                setTransferToByOid((m) => ({ ...m, [it.objectId]: e.target.value }))
                              }
                              placeholder="Empfänger 0x…"
                              autoComplete="off"
                              spellCheck={false}
                            />
                            {(() => {
                              const to = (transferToByOid[it.objectId] || '').trim()
                              const hit = recipientSelectOptions.find(
                                (o) => o.address.toLowerCase() === to.toLowerCase()
                              )
                              return hit ? (
                                <p className="text-[10px] text-muted-foreground">Kontakt: {hit.label}</p>
                              ) : null
                            })()}
                            {recipientSelectOptions.length > 0 ? (
                              <details className="rounded border border-border/50 bg-background/40 px-2 py-1">
                                <summary className="cursor-pointer text-[10px] font-medium text-foreground">
                                  Aus Telefonbuch
                                </summary>
                                <ul className="mt-1 max-h-32 space-y-0.5 overflow-y-auto">
                                  {recipientSelectOptions.map((o) => (
                                    <li key={o.address}>
                                      <button
                                        type="button"
                                        className="w-full rounded px-1.5 py-1 text-left text-[11px] hover:bg-muted"
                                        onClick={() =>
                                          setTransferToByOid((m) => ({
                                            ...m,
                                            [it.objectId]: o.address,
                                          }))
                                        }
                                      >
                                        {o.favorite ? '★ ' : ''}
                                        {o.label}
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              </details>
                            ) : null}
                            <Button
                              type="button"
                              size="sm"
                              className="h-8 w-full text-[11px]"
                              disabled={busy}
                              onClick={() => {
                                void (async () => {
                                  const to = (transferToByOid[it.objectId] || '').trim()
                                  if (!/^0x[a-fA-F0-9]{64}$/i.test(to)) {
                                    setError('Empfänger: volle 0x…-Adresse (64 Hex) oder Telefonbuch.')
                                    return
                                  }
                                  const pack = buildNftVaultHandoffFromLocal(it.objectId)
                                  const extra = pack
                                    ? `\n\nGesichertes Guthaben (${pack.kind}): Index (NFT+Vault) wird mitkopiert.`
                                    : ''
                                  if (
                                    !window.confirm(
                                      `ImageNFT an ${to.slice(0, 12)}… senden? Besitz wechselt on-chain.${extra}`
                                    )
                                  ) {
                                    return
                                  }
                                  setBusy(true)
                                  setError('')
                                  try {
                                    let handoffNote = ''
                                    if (pack) {
                                      const { bundle, compact } = preferOfflineHandoffText(pack)
                                      const copied = await copyTextSafe(bundle)
                                      try {
                                        const url = await nftVaultHandoffToQrDataUrl(compact)
                                        window.open(url, '_blank', 'noopener,noreferrer')
                                      } catch {
                                        /* QR optional */
                                      }
                                      handoffNote = copied.ok
                                        ? ' Index in Zwischenablage.'
                                        : ` Index:\n${bundle}`
                                    }
                                    const r = await transferEvidenceImageNft({
                                      objectId: it.objectId,
                                      recipientAddress: to,
                                    })
                                    if (!r.ok) {
                                      setError(r.error)
                                      return
                                    }
                                    setOwnerItems((prev) => prev.filter((x) => x.objectId !== it.objectId))
                                    setInfo(`NFT gesendet · TX ${r.digest.slice(0, 16)}…${handoffNote}`)
                                  } finally {
                                    setBusy(false)
                                  }
                                })()
                              }}
                            >
                              Senden
                            </Button>
                          </div>
                        </details>
                      ) : null}

                      <details className="mt-1.5">
                        <summary className="cursor-pointer text-[11px] font-medium text-foreground">
                          Mehr…
                        </summary>
                        <div className="mt-2 space-y-2">
                          <div className="flex flex-wrap gap-1.5">
                            {it.previewUrl ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 text-[11px]"
                                onClick={() => {
                                  const a = document.createElement('a')
                                  a.href = it.previewUrl!
                                  a.download = `${(displayName || 'nft').replace(/[^\w\-]+/g, '_').slice(0, 48)}.png`
                                  a.click()
                                }}
                              >
                                Bild speichern
                              </Button>
                            ) : null}
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              className="h-7 text-[11px]"
                              disabled={busy}
                              onClick={() => {
                                writeZeitkapselLastNftObjectId(it.objectId)
                                setLeasePreferredOid(it.objectId)
                                setMode('guthaben')
                                setInfo(`NFT gesichert: ${displayName} gewählt.`)
                              }}
                            >
                              NFT gesichert…
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 text-[11px]"
                              disabled={busy}
                              onClick={() => {
                                writeZeitkapselLastNftObjectId(it.objectId)
                                setLeasePreferredOid(it.objectId)
                                setGalleryLeaseOid((cur) =>
                                  cur === it.objectId.toLowerCase() ? null : it.objectId.toLowerCase()
                                )
                              }}
                            >
                              {galleryLeaseOid === it.objectId.toLowerCase()
                                ? 'Leihe ausblenden'
                                : 'Verleihen…'}
                            </Button>
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
                                Passphrase kopieren
                              </Button>
                            ) : null}
                          </div>

                          <div className="space-y-1.5 rounded border border-border/60 bg-muted/10 p-2">
                            <Label className="text-[10px] text-muted-foreground">
                              Lokaler Name / Notiz (nur Gerät)
                            </Label>
                            <Input
                              className="h-7 text-[11px]"
                              value={
                                galleryLocalNoteByOid[it.objectId] ??
                                getNftKeycard(it.objectId)?.label ??
                                it.name ??
                                ''
                              }
                              onChange={(e) =>
                                setGalleryLocalNoteByOid((m) => ({
                                  ...m,
                                  [it.objectId]: e.target.value,
                                }))
                              }
                              placeholder="z. B. Einsatzfoto Tor"
                            />
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 text-[11px]"
                              disabled={busy}
                              title="Speichert Passphrase + Object-ID lokal für Zeitkapsel/Guthaben/PWMSG — kein Chain-Lock"
                              onClick={() => {
                                void (async () => {
                                  const pass =
                                    (storedPass || passphrase.trim() || getDefaultEvidencePassphrase() || '').trim()
                                  if (pass.length < 8) {
                                    setError(
                                      'Schlüsselkarte: zuerst entsperren oder Passphrase (≥8) am Eintrag eingeben.'
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
                                          'Schlüsselkarte: NFT gehört nicht zur aktuellen Signer-Adresse — Abbruch.'
                                        )
                                        return
                                      }
                                    }
                                    const localLabel = (
                                      galleryLocalNoteByOid[it.objectId] ??
                                      getNftKeycard(it.objectId)?.label ??
                                      it.name ??
                                      ''
                                    ).trim()
                                    const r = upsertNftKeycardSlot({
                                      objectId: it.objectId,
                                      label: localLabel || undefined,
                                      slotId: 'default',
                                      passphrase: pass,
                                      note: it.source === 'url' ? 'URL-NFT' : 'ImageNFT',
                                    })
                                    if (!r.ok) {
                                      setError(r.error)
                                      return
                                    }
                                    rememberEvidencePassphrase({ objectId: it.objectId, passphrase: pass })
                                    setKeycardTick((n) => n + 1)
                                    setInfo(
                                      `Als Schlüsselkarte gemerkt${localLabel ? ` („${localLabel}“)` : ''} — lokal für Zeitkapsel/Guthaben.`
                                    )
                                  } finally {
                                    setBusy(false)
                                  }
                                })()
                              }}
                            >
                              {getNftKeycard(it.objectId)
                                ? 'Schlüsselkarte aktualisieren'
                                : 'Als Schlüsselkarte merken'}
                            </Button>
                            <p className="text-[10px] text-muted-foreground">
                              Merkt Passphrase + ID lokal (Zeitkapsel/Guthaben). Entsperren allein reicht zum Anschauen.
                            </p>
                          </div>

                          {it.source !== 'url' ? (
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
                                      'ImageNFT unwiderruflich vernichten (burn)? Storage-Rebate kommt zurück.'
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
                          ) : null}

                          {galleryLeaseOid === it.objectId.toLowerCase() ? (
                            <div className="rounded-md border border-amber-800/30 bg-amber-950/10 px-2 py-2">
                              <p className="mb-1.5 text-[11px] font-medium text-foreground">
                                Verleihen
                              </p>
                              <NftTimeLeasePanel nftObjectId={it.objectId} disabled={busy} />
                            </div>
                          ) : null}
                        </div>
                      </details>
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
              {mailboxPlainRows.map((row, i) => {
                const rowKey = `${row.source}-${row.nonce}-${row.ts ?? 0}-${i}`
                const pwWire = !row.encrypted && isPassphraseMessageWire(row.text)
                const decrypted = mailboxPwPlainByKey[rowKey]
                return (
                <li
                  key={`${rowKey}-${row.sender}-${row.recipient}`}
                  className="rounded-md border border-border p-2 text-xs"
                >
                  <p className="text-muted-foreground break-all">
                    {row.source === 'event'
                      ? 'Event'
                      : row.source === 'object'
                        ? 'Object'
                        : row.encrypted
                          ? 'MsgKey'
                          : 'Mailbox-DF'}
                    {row.encrypted ? ' · Enc' : pwWire ? ' · PWMSG' : ''} ·{' '}
                    {row.ts ? new Date(row.ts).toLocaleString('de-DE') : '—'} · {row.sender.slice(0, 10)}… →{' '}
                    {row.recipient.slice(0, 10)}…
                    {row.objectId ? ` · ${row.objectId.slice(0, 12)}…` : ''}
                  </p>
                  <p
                    className={
                      row.encrypted
                        ? 'mt-1 whitespace-pre-wrap text-amber-800 dark:text-amber-200'
                        : 'mt-1 whitespace-pre-wrap text-foreground'
                    }
                  >
                    {decrypted ?? row.text}
                  </p>
                  {pwWire && !decrypted ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="mt-2 h-7 text-[11px]"
                      disabled={busy || !mailboxPwPassphrase.trim()}
                      onClick={() => {
                        void (async () => {
                          setBusy(true)
                          setError('')
                          try {
                            const r = await decryptPastedPassphraseWire(
                              row.text,
                              mailboxPwPassphrase
                            )
                            if (!r.ok) {
                              setError(r.error)
                              return
                            }
                            setMailboxPwPlainByKey((prev) => ({ ...prev, [rowKey]: r.plain }))
                          } finally {
                            setBusy(false)
                          }
                        })()
                      }}
                    >
                      Mit Passphrase entschlüsseln
                    </Button>
                  ) : null}
                </li>
                )
              })}
            </ul>
          ) : null}
        </div>
        </div>
      </DialogContent>
    </Dialog>

    {typeof document !== 'undefined' && lightbox
      ? createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={lightbox.name || 'NFT-Bild'}
            className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/95 p-3"
            onPointerDownCapture={() => {
              lightboxClickGuardRef.current = true
              if (lightboxGuardTimerRef.current) clearTimeout(lightboxGuardTimerRef.current)
              lightboxGuardTimerRef.current = setTimeout(() => {
                lightboxClickGuardRef.current = false
                lightboxGuardTimerRef.current = null
              }, 400)
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              dismissLightbox()
            }}
          >
            <button
              type="button"
              className="absolute right-3 top-3 z-[10051] rounded-md border border-white/30 bg-black/60 px-3 py-1.5 text-sm text-white hover:bg-black/80"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                dismissLightbox()
              }}
            >
              Schließen
            </button>
            <img
              src={lightbox.url}
              alt={lightbox.name}
              className="max-h-[100vh] max-w-[100vw] object-contain"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            />
          </div>,
          document.body
        )
      : null}
    </>
  )
}
