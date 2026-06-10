'use client'

import type { Message } from '@/frontend/lib/types'
import type { TangleInventoryOrigin } from '@/frontend/lib/tangle-inventory'
import { fetchMailboxInboxPage } from '@/frontend/lib/mailbox-inbox-page-fetch'
import type { InboxApiRow } from '@/frontend/features/inbox/inbox-map-messages'

const MAX_PREVIEW_CHARS = 2000
const PAGE_SIZE = 200
const MAX_ROWS = 4000

export function trimTangleContentPreview(text: string): string {
  const t = text.trim()
  if (t.length <= MAX_PREVIEW_CHARS) return t
  return `${t.slice(0, MAX_PREVIEW_CHARS)}…`
}

/** Nonce-Vergleich: "1" und "1n" / BigInt-Strings. */
export function chainNoncesMatch(a: string, b: string): boolean {
  const left = String(a ?? '').trim()
  const right = String(b ?? '').trim()
  if (!left || !right) return false
  if (left === right) return true
  try {
    return BigInt(left) === BigInt(right)
  } catch {
    return false
  }
}

export function findLocalMessageByChainNonce(
  messages: readonly Message[] | undefined,
  nonce: string
): Message | undefined {
  if (!messages?.length) return undefined
  return messages.find((m) => m.chainNonce && chainNoncesMatch(m.chainNonce, nonce))
}

function isEncryptedPlaceholder(text: string): boolean {
  const t = text.trim()
  return t.startsWith('[Verschlüsselt]') || t.startsWith('[Encrypted]')
}

function textFromInboxRow(row: InboxApiRow): string {
  const rawT = row.text != null ? String(row.text) : ''
  const rawC = row.content != null ? String(row.content) : ''
  if (!rawC) return rawT
  if (!rawT) return rawC
  return rawC.length >= rawT.length ? rawC : rawT
}

function textFromMessage(msg: Message): string {
  return String(msg.content ?? '').trim()
}

export type RecoverTangleTextSource = 'preview' | 'local-inbox' | 'mailbox'

export type RecoverTangleTextResult =
  | { ok: true; text: string; source: RecoverTangleTextSource }
  | { ok: false; error: string }

export async function recoverTangleInventoryText(opts: {
  nonce?: string
  contentPreview?: string
  origin?: TangleInventoryOrigin
  localMessages?: readonly Message[]
  packageId?: string
}): Promise<RecoverTangleTextResult> {
  const origin = opts.origin ?? 'unknown'

  if (origin === 'anchor') {
    return {
      ok: false,
      error: 'Protokoll-Verankerung — kein Chat-Text, nur Digest/Explorer.',
    }
  }
  if (origin === 'relay' && !(opts.nonce ?? '').trim()) {
    return {
      ok: false,
      error: 'Relay-Markierung ohne Nonce — nur Explorer-Link.',
    }
  }

  const preview = (opts.contentPreview ?? '').trim()
  if (preview.length > 0) {
    return { ok: true, text: preview, source: 'preview' }
  }

  const nonce = (opts.nonce ?? '').trim()
  if (!nonce) {
    return { ok: false, error: 'Kein Nonce — nur Explorer-Link verfügbar.' }
  }

  const localHit = findLocalMessageByChainNonce(opts.localMessages, nonce)
  if (localHit) {
    const localText = textFromMessage(localHit)
    if (localText.length > 0) {
      if (isEncryptedPlaceholder(localText)) {
        return {
          ok: false,
          error:
            'Im Posteingang verschlüsselt — Peer-Schlüssel/Tresor prüfen oder Chain-Suche versuchen.',
        }
      }
      return { ok: true, text: localText, source: 'local-inbox' }
    }
  }

  let offset = 0
  let scanned = 0
  let lastFetchError = ''
  while (scanned < MAX_ROWS) {
    let pageOk = false
    let rows: InboxApiRow[] = []
    for (let retry = 0; retry < 2; retry++) {
      const r = await fetchMailboxInboxPage({
        limit: PAGE_SIZE,
        offset,
        packageId: opts.packageId,
      })
      if (r.ok) {
        pageOk = true
        rows = r.rows
        break
      }
      lastFetchError = r.error
    }
    if (!pageOk) {
      return {
        ok: false,
        error: lastFetchError || 'Posteingang (Chain/API) nicht ladbar.',
      }
    }
    if (rows.length === 0) break

    const hit = rows.find((row) => chainNoncesMatch(String(row.nonce ?? ''), nonce))
    if (hit) {
      const text = textFromInboxRow(hit).trim()
      if (text.length === 0) {
        return { ok: false, error: 'Eintrag gefunden, aber ohne Textinhalt.' }
      }
      if (isEncryptedPlaceholder(text)) {
        return {
          ok: false,
          error: 'Auf der Chain verschlüsselt — Chat-ECDH/Peer-Pub und Tresor prüfen.',
        }
      }
      return { ok: true, text, source: 'mailbox' }
    }

    scanned += rows.length
    if (rows.length < PAGE_SIZE) break
    offset += rows.length
  }

  const hint =
    origin === 'path4'
      ? 'Pfad-4-Spiegel (Funk→IOTA): Text nicht lokal gespeichert.'
      : localHit
        ? 'Lokal bekannt, aber ohne Klartext.'
        : 'Nicht im Posteingang/Chain (bis ~4000 Zeilen).'
  const tail =
    origin === 'path4'
      ? ' „Text lokal speichern“ nach dem Senden oder Explorer.'
      : ' Posteingang aktualisieren, „Text lokal speichern“ oder Explorer.'
  return {
    ok: false,
    error: `${hint}${tail}`,
  }
}
