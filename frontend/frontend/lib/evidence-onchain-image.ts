/**
 * Evidenz-Bild aus On-Chain-Objekt — Parser + Auto-Erkennung + Owner-Liste.
 * Experiment; Move-Modul nicht im Morgendrot-Repo.
 * docs/EVIDENCE-IMAGE-AND-NFT-ATTRIBUTES.md
 *
 * Wichtig: Galerie listet nur `::image_nft::ImageNFT` des bekannten Packages —
 * keine Tickets/TXT/AccessKeys. „Mehr Bilder erwartet“ ≠ andere Objekttypen.
 */

import { isEvidenceImageEncryptedBlob } from '@/frontend/lib/evidence-image-crypto'

/** ~100 KB Rohdaten — Puffer für Overhead unter typischen TX-Limits. */
export const EVIDENCE_IMAGE_MAX_RAW_BYTES = 100_000

export const EVIDENCE_IMAGE_OWNER_PAGE_SIZE = 10

/**
 * Bekannte ImageNFT-Packages (Hinweis / Typ-Filter).
 * Nicht als Object-ID für ein Bild verwenden — das ist das Package.
 */
export const KNOWN_IMAGE_NFT_PACKAGE_IDS = [
  '0x236609dff5ad4a4e118bf29c0df1a9013ca4585348d4b2d94a3028c505d106c7',
] as const

/** URL-NFTs (ohne image_data), die die Besitzer-Galerie per StructType findet. */
export const KNOWN_URL_NFT_STRUCT_TYPES = [
  '0xb800e7cf19a2d63d3f5f4e857d4cf20c685d4768c71b04a3d803b09b48ab53f8::nft::SimpleNFT',
] as const

/** Nur Package-Hex normalisieren — Modul/Struct bleiben case-sensitiv (SimpleNFT ≠ simplenft). */
export function normalizeMoveStructType(typeString: string): string {
  const t = typeString.trim()
  const i = t.indexOf('::')
  if (i <= 0) return t
  return `${t.slice(0, i).toLowerCase()}${t.slice(i)}`
}

export function knownImageNftStructTypes(): string[] {
  return KNOWN_IMAGE_NFT_PACKAGE_IDS.map((p) => `${p.toLowerCase()}::image_nft::ImageNFT`)
}

/** ImageNFT + bekannte URL-NFT-Typen für parallele StructType-Queries. */
export function knownOwnerGalleryStructTypes(): string[] {
  return [
    ...knownImageNftStructTypes(),
    ...KNOWN_URL_NFT_STRUCT_TYPES.map((t) => normalizeMoveStructType(t)),
  ]
}

const HEX_OBJECT_ID = /^0x[a-f0-9]{64}$/i

export function isPlausibleIotaObjectId(id: string): boolean {
  return HEX_OBJECT_ID.test(id.trim())
}

export function isKnownImageNftPackageId(id: string): boolean {
  const n = id.trim().toLowerCase()
  return KNOWN_IMAGE_NFT_PACKAGE_IDS.some((p) => p.toLowerCase() === n)
}

export type EvidenceImageParseOk = {
  ok: true
  bytes: Uint8Array
  mime: string
  /** Move-Flag — ohne MORGIMGE1-Blob oft nur Metadaten, Bytes Klartext. */
  encryptedFlag: boolean
  /** Echte Client-Verschlüsselung (Magic MORGIMGE1) — Passphrase nötig. */
  needsPassphrase: boolean
  ciphertext?: Uint8Array
}

export type EvidenceImageParseErr = {
  ok: false
  error: string
  needsPassphrase?: boolean
  ciphertext?: Uint8Array
  encryptedFlag?: boolean
}

export type EvidenceImageFields = {
  imageData?: Uint8Array | number[] | string | null
  mime?: string | null
  encrypted?: boolean | null
  name?: string | null
  description?: string | null
  classification?: string | null
  hash?: string | null
  /** Externe Bild-URL (IPFS/HTTP) — z. B. SimpleNFT.url / Description. */
  mediaUrl?: string | null
}

export type EvidenceObjectTypeMatch = {
  typeString: string
  isImageNftType: boolean
  packageId: string | null
  isKnownPackage: boolean
  hasImageDataField: boolean
  hasMediaUrl: boolean
  isPackageObject: boolean
}

const NFT_URL_FIELD_KEYS = [
  'url',
  'image_url',
  'imageUrl',
  'uri',
  'media_url',
  'mediaUrl',
  'img_url',
  'imgUrl',
  'image',
  'link',
] as const

const HTTP_URL_IN_TEXT = /https?:\/\/[^\s"'<>\\]+/i
const IPFS_URL_IN_TEXT = /ipfs:\/\/[^\s"'<>\\]+/i
const IPFS_CID_RE = /^(bafy[a-z0-9]+|Qm[1-9A-HJ-NP-Za-km-z]{44,88})$/i

/**
 * `<img src>` braucht echte Bild-Bytes.
 * inbrowser.link liefert nur HTML+Service-Worker → kaputtes Bild-Icon.
 * Pinata/Filebase liefern für typische NFT-CIDs `image/*`.
 */
export function ipfsCidToDisplayUrl(cid: string): string {
  return `https://gateway.pinata.cloud/ipfs/${cid.trim()}`
}

/** Menschliche Ansicht im Tab (HTML-Gateway) — nicht für `<img>`. */
export function ipfsCidToBrowserViewUrl(cid: string): string {
  return `https://${cid.trim()}.ipfs.inbrowser.link/`
}

/** Alternative Gateways für onError-Fallback im Viewer. */
export function ipfsCidDisplayUrlFallbacks(cid: string): string[] {
  const c = cid.trim()
  return [
    `https://gateway.pinata.cloud/ipfs/${c}`,
    `https://ipfs.filebase.io/ipfs/${c}`,
    `https://${c}.ipfs.dweb.link/`,
    `https://nftstorage.link/ipfs/${c}`,
  ]
}

/** CID aus ipfs://, path-Gateway oder Subdomain-Gateway. */
export function extractIpfsCid(raw: string): string | null {
  const t = raw.trim().replace(/[.,;)\]]+$/g, '')
  if (!t) return null
  if (IPFS_CID_RE.test(t)) return t
  const ipfsProto = t.match(/^ipfs:\/\/(?:ipfs\/)?([a-z0-9]+)/i)
  if (ipfsProto?.[1] && IPFS_CID_RE.test(ipfsProto[1])) return ipfsProto[1]
  const pathGw = t.match(/\/ipfs\/([a-z0-9]+)(?:[/?#]|$)/i)
  if (pathGw?.[1] && IPFS_CID_RE.test(pathGw[1])) return pathGw[1]
  const subGw = t.match(/^https?:\/\/([a-z0-9]+)\.ipfs\./i)
  if (subGw?.[1] && IPFS_CID_RE.test(subGw[1])) return subGw[1]
  return null
}

/** ipfs:// / Gateway-URL / bare CID → Pinata-Pfad für `<img>`; sonst http(s) unverändert. */
export function normalizeNftMediaUrl(raw: string): string | null {
  const t = raw.trim().replace(/[.,;)\]]+$/g, '')
  if (!t) return null
  const cid = extractIpfsCid(t)
  if (cid) return ipfsCidToDisplayUrl(cid)
  if (/^https?:\/\//i.test(t)) return t
  return null
}

export function firstNftMediaUrlInText(text: string): string | null {
  const ipfs = text.match(IPFS_URL_IN_TEXT)
  if (ipfs?.[0]) return normalizeNftMediaUrl(ipfs[0])
  const http = text.match(HTTP_URL_IN_TEXT)
  if (http?.[0]) return normalizeNftMediaUrl(http[0])
  return null
}

function stringFromNftFieldValue(v: unknown): string | null {
  if (typeof v === 'string' && v.trim()) return v.trim()
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const o = v as Record<string, unknown>
    for (const k of ['url', 'Url', 'href', 'uri', 'value']) {
      if (typeof o[k] === 'string' && (o[k] as string).trim()) return String(o[k]).trim()
    }
  }
  return null
}

/**
 * URL-NFTs (SimpleNFT u. a.): dedizierte Felder oder URL in description/anderen Strings.
 */
export function extractNftMediaUrlFromFields(
  rawFields: Record<string, unknown>,
  description?: string | null
): string | null {
  for (const key of NFT_URL_FIELD_KEYS) {
    const asStr = stringFromNftFieldValue(rawFields[key])
    if (!asStr) continue
    const direct = normalizeNftMediaUrl(asStr)
    if (direct) return direct
    const nested = firstNftMediaUrlInText(asStr)
    if (nested) return nested
  }
  for (const v of Object.values(rawFields)) {
    const asStr = stringFromNftFieldValue(v)
    if (!asStr) continue
    const nested = firstNftMediaUrlInText(asStr)
    if (nested) return nested
  }
  if (description?.trim()) {
    const nested = firstNftMediaUrlInText(description)
    if (nested) return nested
  }
  return null
}

function bytesFromUnknown(raw: unknown): Uint8Array | null {
  if (raw == null) return null
  if (raw instanceof Uint8Array) return raw
  if (Array.isArray(raw) && raw.every((n) => typeof n === 'number')) {
    return Uint8Array.from(raw.map((n) => n & 0xff))
  }
  if (typeof raw === 'string') {
    const t = raw.trim()
    if (!t) return null
    if (/^[0-9a-fA-F]+$/.test(t) && t.length % 2 === 0) {
      const out = new Uint8Array(t.length / 2)
      for (let i = 0; i < out.length; i++) out[i] = parseInt(t.slice(i * 2, i * 2 + 2), 16)
      return out
    }
    try {
      const bin = atob(t)
      const out = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
      return out
    } catch {
      return null
    }
  }
  return null
}

function sniffMime(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return 'image/png'
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp'
  }
  return null
}

export function packageIdFromMoveType(typeString: string): string | null {
  const t = typeString.trim()
  const i = t.indexOf('::')
  if (i <= 0) return null
  const pkg = t.slice(0, i).toLowerCase()
  return HEX_OBJECT_ID.test(pkg) ? pkg : null
}

export function isImageNftMoveType(typeString: string): boolean {
  return /::image_nft::imagenft$/i.test(typeString.trim())
}

/**
 * Move `encrypted` allein verschlüsselt nichts. Echte Ciphertexts tragen Magic MORGIMGE1.
 * Klartext-Bild trotz Flag → anzeigen + Warnung. Ciphertext → Passphrase nötig.
 */
export function parseEvidenceImageFields(fields: EvidenceImageFields): EvidenceImageParseOk | EvidenceImageParseErr {
  const encryptedFlag = fields.encrypted === true
  const bytes = bytesFromUnknown(fields.imageData ?? null)
  if (!bytes || bytes.length === 0) {
    return { ok: false, error: 'Kein image_data im Objektinhalt.' }
  }
  if (bytes.length > EVIDENCE_IMAGE_MAX_RAW_BYTES) {
    return {
      ok: false,
      error: `Bild zu groß (${bytes.length} B, max. ${EVIDENCE_IMAGE_MAX_RAW_BYTES} B).`,
    }
  }
  if (isEvidenceImageEncryptedBlob(bytes)) {
    return {
      ok: false,
      error: 'Bild ist mit Passphrase verschlüsselt (MORGIMGE1). Passphrase eingeben.',
      needsPassphrase: true,
      ciphertext: bytes,
      encryptedFlag: true,
    }
  }
  const sniffed = sniffMime(bytes)
  const mime = (fields.mime || '').trim() || sniffed || ''
  if (!mime.startsWith('image/')) {
    if (encryptedFlag && !sniffed) {
      return {
        ok: false,
        error:
          'Flag encrypted=true, aber kein MORGIMGE1-Blob und kein Bildformat — kein Schlüssel on-chain. Ohne Client-Verschlüsselung beim Mint nicht entschlüsselbar.',
        encryptedFlag: true,
      }
    }
    return {
      ok: false,
      error: sniffed
        ? `Unbekanntes MIME (${mime || 'leer'}).`
        : 'Kein erkanntes Bildformat (JPEG/PNG/WebP) und kein content_type/mime.',
    }
  }
  return { ok: true, bytes, mime, encryptedFlag, needsPassphrase: false }
}

export function evidenceImageBytesToObjectUrl(bytes: Uint8Array, mime: string): string {
  const blob = new Blob([bytes], { type: mime })
  return URL.createObjectURL(blob)
}

export function extractEvidenceFieldsFromMoveContent(content: unknown): EvidenceImageFields & {
  rawFields: Record<string, unknown>
} {
  const rawFields: Record<string, unknown> = {}
  if (!content || typeof content !== 'object') return { rawFields }
  const c = content as Record<string, unknown>
  if (c.dataType === 'package' || String(c.dataType || '') === 'package') {
    return { rawFields }
  }
  const fields =
    c.fields && typeof c.fields === 'object' && !Array.isArray(c.fields)
      ? (c.fields as Record<string, unknown>)
      : c
  Object.assign(rawFields, fields)

  const imageData = fields.image_data ?? fields.imageData ?? null
  const mime =
    typeof fields.content_type === 'string'
      ? fields.content_type
      : typeof fields.mime === 'string'
        ? fields.mime
        : null
  let encrypted: boolean | null = null
  if (typeof fields.encrypted === 'boolean') encrypted = fields.encrypted
  else if (fields.encrypted === 0 || fields.encrypted === 1) encrypted = fields.encrypted === 1
  const name = typeof fields.name === 'string' ? fields.name : null
  const description = typeof fields.description === 'string' ? fields.description : null
  const classification = typeof fields.classification === 'string' ? fields.classification : null
  const hash = typeof fields.hash === 'string' ? fields.hash : null
  const mediaUrl = extractNftMediaUrlFromFields(rawFields, description)

  return {
    imageData: imageData as EvidenceImageFields['imageData'],
    mime,
    encrypted,
    name,
    description,
    classification,
    hash,
    mediaUrl,
    rawFields,
  }
}

export function classifyEvidenceObjectType(
  typeString: string,
  fields: EvidenceImageFields,
  contentDataType?: string | null
): EvidenceObjectTypeMatch {
  const type = typeString.trim()
  const isPackageObject =
    type.toLowerCase() === 'package' || String(contentDataType || '').toLowerCase() === 'package'
  const packageId = isPackageObject
    ? null
    : packageIdFromMoveType(type) || (isKnownImageNftPackageId(type) ? type.toLowerCase() : null)
  const isImageNftType = isImageNftMoveType(type)
  const isKnownPackage = Boolean(
    (packageId && KNOWN_IMAGE_NFT_PACKAGE_IDS.some((p) => p.toLowerCase() === packageId)) ||
      isKnownImageNftPackageId(type)
  )
  const hasImageDataField = bytesFromUnknown(fields.imageData ?? null) != null
  const hasMediaUrl = Boolean(fields.mediaUrl && String(fields.mediaUrl).trim())
  return {
    typeString: type,
    isImageNftType,
    packageId,
    isKnownPackage,
    hasImageDataField,
    hasMediaUrl,
    isPackageObject,
  }
}

export function shouldAttemptEvidenceImageRender(match: EvidenceObjectTypeMatch): boolean {
  if (match.isPackageObject) return false
  return match.isImageNftType || match.hasImageDataField || match.hasMediaUrl
}

export type FetchEvidenceImageResult =
  | {
      ok: true
      objectId: string
      match: EvidenceObjectTypeMatch
      /** Eingebettetes image_data (Morgendrot ImageNFT). */
      parsed?: EvidenceImageParseOk
      /** Externes Bild (HTTP/IPFS), z. B. SimpleNFT. */
      displayUrl?: string
      source: 'embedded' | 'url'
      name?: string
      description?: string
      classification?: string
    }
  | {
      ok: false
      error: string
      objectId?: string
      match?: EvidenceObjectTypeMatch
      needsPassphrase?: boolean
      ciphertext?: Uint8Array
      name?: string
      description?: string
      classification?: string
    }

type GetObjectClient = {
  getObject: (input: {
    id: string
    options?: { showContent?: boolean; showType?: boolean }
  }) => Promise<{
    data?: {
      objectId?: string
      type?: string | null
      content?: unknown
    } | null
    error?: unknown
  }>
}

type OwnedObjectsFilter =
  | { StructType: string }
  | { MatchAny: Array<{ StructType: string }> }

type OwnedObjectsClient = GetObjectClient & {
  getOwnedObjects: (input: {
    owner: string
    cursor?: string | null
    limit?: number
    filter?: OwnedObjectsFilter
    options?: { showContent?: boolean; showType?: boolean }
  }) => Promise<{
    data?: Array<{ data?: { objectId?: string; type?: string | null; content?: unknown } | null }>
    nextCursor?: string | null
    hasNextPage?: boolean
  }>
}

export async function fetchEvidenceImageByObjectId(
  client: GetObjectClient,
  objectIdRaw: string
): Promise<FetchEvidenceImageResult> {
  const objectId = objectIdRaw.trim().toLowerCase()
  if (!isPlausibleIotaObjectId(objectId)) {
    return { ok: false, error: 'Object-ID: 0x + 64 Hex nötig.' }
  }
  if (isKnownImageNftPackageId(objectId)) {
    return {
      ok: false,
      objectId,
      error:
        'Das ist die ImageNFT-Package-ID, kein Bild-Objekt.\n' +
        'Bitte die Object-ID eines geminteten ImageNFT eingeben — oder die Besitzer-Adresse und „Bilder des Besitzers“ nutzen.',
    }
  }

  let res: Awaited<ReturnType<GetObjectClient['getObject']>>
  try {
    res = await client.getObject({
      id: objectId,
      options: { showContent: true, showType: true },
    })
  } catch (e) {
    return {
      ok: false,
      objectId,
      error: e instanceof Error ? e.message : 'getObject fehlgeschlagen.',
    }
  }
  if (!res?.data) {
    return { ok: false, objectId, error: 'Objekt nicht gefunden oder RPC ohne data.' }
  }
  const typeString = String(res.data.type || '').trim()
  const content = res.data.content
  const contentDataType =
    content && typeof content === 'object'
      ? String((content as { dataType?: string }).dataType || '')
      : ''
  const extracted = extractEvidenceFieldsFromMoveContent(content)
  const match = classifyEvidenceObjectType(typeString, extracted, contentDataType)

  if (match.isPackageObject || typeString.toLowerCase() === 'package') {
    return {
      ok: false,
      objectId,
      match,
      error:
        'Dieses Objekt ist ein Move-Package, kein ImageNFT.\n' +
        'Object-ID eines Bild-NFTs oder Besitzer-Adresse verwenden.',
    }
  }

  const mediaUrl =
    extracted.mediaUrl ||
    extractNftMediaUrlFromFields(extracted.rawFields, extracted.description) ||
    undefined
  const matchWithUrl: EvidenceObjectTypeMatch = {
    ...match,
    hasMediaUrl: match.hasMediaUrl || Boolean(mediaUrl),
  }

  if (!shouldAttemptEvidenceImageRender(matchWithUrl)) {
    return {
      ok: false,
      objectId,
      match: matchWithUrl,
      error: typeString
        ? `Kein ImageNFT / image_data / Bild-URL (Typ: ${typeString}).`
        : 'Objekt ohne Typ, ohne image_data und ohne Bild-URL.',
    }
  }

  if (matchWithUrl.hasImageDataField || matchWithUrl.isImageNftType) {
    const parsed = parseEvidenceImageFields(extracted)
    if (parsed.ok) {
      return {
        ok: true,
        objectId,
        match: matchWithUrl,
        parsed,
        source: 'embedded',
        name: extracted.name || undefined,
        description: extracted.description || undefined,
        classification: extracted.classification || undefined,
      }
    }
    if (parsed.needsPassphrase) {
      return {
        ok: false,
        objectId,
        match: matchWithUrl,
        error: parsed.error,
        needsPassphrase: parsed.needsPassphrase,
        ciphertext: parsed.ciphertext,
        name: extracted.name || undefined,
        description: extracted.description || undefined,
        classification: extracted.classification || undefined,
      }
    }
    if (mediaUrl) {
      return {
        ok: true,
        objectId,
        match: matchWithUrl,
        displayUrl: mediaUrl,
        source: 'url',
        name: extracted.name || undefined,
        description: extracted.description || undefined,
        classification: extracted.classification || undefined,
      }
    }
    return {
      ok: false,
      objectId,
      match: matchWithUrl,
      error: parsed.error,
      name: extracted.name || undefined,
      description: extracted.description || undefined,
      classification: extracted.classification || undefined,
    }
  }

  if (mediaUrl) {
    return {
      ok: true,
      objectId,
      match: matchWithUrl,
      displayUrl: mediaUrl,
      source: 'url',
      name: extracted.name || undefined,
      description: extracted.description || undefined,
      classification: extracted.classification || undefined,
    }
  }

  return {
    ok: false,
    objectId,
    match: matchWithUrl,
    error: typeString
      ? `Kein ImageNFT / image_data / Bild-URL (Typ: ${typeString}).`
      : 'Objekt ohne Bilddaten.',
  }
}

export type EvidenceOwnerListItem = {
  objectId: string
  name?: string
  description?: string
  classification?: string
  match: EvidenceObjectTypeMatch
  parsed?: EvidenceImageParseOk
  displayUrl?: string
  source?: 'embedded' | 'url'
  error?: string
  needsPassphrase?: boolean
  ciphertext?: Uint8Array
}

export type FetchEvidenceImagesByOwnerResult =
  | {
      ok: true
      owner: string
      items: EvidenceOwnerListItem[]
      nextCursor: string | null
      hasNextPage: boolean
      /** Aktive / genutzte RPC-URL (für UI-Hinweis). */
      rpcUrl?: string
      /** z. B. Treffer nur auf dem anderen Netz. */
      networkNote?: string
    }
  | { ok: false; error: string }

/** Eine Owned-Object-Zeile → Galerie-Eintrag oder null (Coins o. Ä. ohne Bild). */
export function evidenceOwnerItemFromObjectData(d: {
  objectId?: string
  type?: string | null
  content?: unknown
}): EvidenceOwnerListItem | null {
  if (!d?.objectId) return null
  const objectId = String(d.objectId).toLowerCase()
  const typeString = String(d.type || '').trim()
  const extracted = extractEvidenceFieldsFromMoveContent(d.content)
  const match = classifyEvidenceObjectType(typeString, extracted)
  const meta = {
    name: extracted.name || undefined,
    description: extracted.description || undefined,
    classification: extracted.classification || undefined,
  }
  const mediaUrl =
    extracted.mediaUrl ||
    extractNftMediaUrlFromFields(extracted.rawFields, extracted.description) ||
    undefined
  const matchWithUrl: EvidenceObjectTypeMatch = {
    ...match,
    hasMediaUrl: match.hasMediaUrl || Boolean(mediaUrl),
  }
  if (!shouldAttemptEvidenceImageRender(matchWithUrl)) return null

  if (matchWithUrl.hasImageDataField || matchWithUrl.isImageNftType) {
    const parsed = parseEvidenceImageFields(extracted)
    if (parsed.ok) {
      return { objectId, match: matchWithUrl, ...meta, parsed, source: 'embedded' }
    }
    if (parsed.needsPassphrase) {
      return {
        objectId,
        match: matchWithUrl,
        ...meta,
        error: parsed.error,
        needsPassphrase: parsed.needsPassphrase,
        ciphertext: parsed.ciphertext,
      }
    }
    if (mediaUrl) {
      return { objectId, match: matchWithUrl, ...meta, displayUrl: mediaUrl, source: 'url' }
    }
    return { objectId, match: matchWithUrl, ...meta, error: parsed.error }
  }
  if (mediaUrl) {
    return { objectId, match: matchWithUrl, ...meta, displayUrl: mediaUrl, source: 'url' }
  }
  return null
}

/**
 * Besitzer-Adresse → Bild-NFTs.
 * Default: **parallele StructType-Queries** (ImageNFT + bekannte URL-NFTs).
 * MatchAny ist im SDK/RPC teils unzuverlässig; Coin-Scan versinkt in großen Wallets.
 */
export async function fetchEvidenceImagesByOwner(
  client: OwnedObjectsClient,
  ownerRaw: string,
  opts?: { cursor?: string | null; limit?: number; structType?: string | null }
): Promise<FetchEvidenceImagesByOwnerResult> {
  const owner = ownerRaw.trim().toLowerCase()
  if (!isPlausibleIotaObjectId(owner)) {
    return { ok: false, error: 'Besitzer-Adresse: 0x + 64 Hex.' }
  }
  const limit = Math.min(Math.max(opts?.limit ?? EVIDENCE_IMAGE_OWNER_PAGE_SIZE, 1), 50)
  const explicitStruct =
    opts?.structType != null && String(opts.structType).trim()
      ? String(opts.structType).trim()
      : ''

  const byId = new Map<string, EvidenceOwnerListItem>()

  const ingestPage = (page: Awaited<ReturnType<OwnedObjectsClient['getOwnedObjects']>>): boolean => {
    for (const row of page.data || []) {
      const item = evidenceOwnerItemFromObjectData(row?.data || {})
      if (!item) continue
      if (!byId.has(item.objectId)) byId.set(item.objectId, item)
    }
    return Boolean(page.hasNextPage)
  }

  const types = explicitStruct ? [explicitStruct] : knownOwnerGalleryStructTypes()
  if (types.length === 0) {
    return { ok: false, error: 'Keine NFT-StructTypes für Besitzer-Galerie konfiguriert.' }
  }

  try {
    // Cursor nur bei einem Typ sinnvoll; Multi-Typ = erste Seite je Typ parallel.
    const cursor = types.length === 1 ? (opts?.cursor ?? null) : null
    const pages = await Promise.all(
      types.map((StructType) =>
        client.getOwnedObjects({
          owner,
          cursor,
          limit,
          filter: { StructType },
          options: { showType: true, showContent: true },
        })
      )
    )
    let hasNextPage = false
    for (const page of pages) {
      if (ingestPage(page)) hasNextPage = true
    }
    return {
      ok: true,
      owner,
      items: [...byId.values()],
      nextCursor: types.length === 1 ? (pages[0]?.nextCursor ?? null) : null,
      hasNextPage: types.length === 1 ? hasNextPage : false,
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'getOwnedObjects fehlgeschlagen.',
    }
  }
}
