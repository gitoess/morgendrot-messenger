'use client'

import {
  enqueueOfflineMailboxFailure,
  isOfflineMailboxQueueEnabled,
  nextChainMessageNonceU64,
  parseMailboxOutNonceMarker,
  prependMailboxOutNonceMarker,
  stableOfflineMailboxThreadId,
} from '@/frontend/lib/api'
import { mailboxHybridErr } from '@/frontend/features/send/chat-view-handle-send-mailbox'
import type { ChatViewMailboxHybridOpts } from '@/frontend/features/send/chat-view-handle-send-mailbox'
import { prependPath4SelfArchiveMarker } from '@/frontend/features/send/mesh-path4-self-archive'
import type { ForcedTransport } from '@/frontend/lib/chat-view-messenger-transport'
import {
  isForensicImageMailboxAttestationEnabled,
  runForensicMailboxAttestationAfterSend,
} from '@/frontend/lib/forensic-mailbox-attestation'
import { formatTxDigestStatusSuffix } from '@/frontend/lib/iota-tx-explorer-hint'
import { parseLoraProgressiveMessage } from '@/frontend/lib/lora-progressive-image-client'
import { sendPlaintextMailboxHybrid } from '@/frontend/lib/mailbox-send-hybrid'
import { addTangleInventoryItem } from '@/frontend/lib/tangle-inventory'
import { trimTangleContentPreview } from '@/frontend/lib/tangle-inventory-recover'
import { maybeAutoSaveDigestToVault } from '@/frontend/lib/tangle-inventory-vault'

const ADDR_64_LOWER = /^0x[a-f0-9]{64}$/

export type Path4MirrorKind = 'text' | 'image_luma' | 'image_chroma'

export type Path4MirrorDispatch = {
  status: 'anchored' | 'queued' | 'duplicate' | 'failed'
  note: string
  txDigest?: string
}

export function formatPath4TextSelfArchiveFootnote(d: Path4MirrorDispatch): string {
  if (d.status === 'failed') return `__PATH4_FAILED__${d.note}`
  if (d.status !== 'anchored') return ` ${d.note}`
  return ` ${d.note}${formatTxDigestStatusSuffix(d.txDigest)}`
}

export type ChatViewPath4SendContext = {
  myAddress: string
  apiStatus?: { locked?: boolean } | null
  deviceTimeTrustWarn?: boolean
  path4SelfArchiveActive: boolean
  meshSelfArchiveAfterLoRa: boolean
  forcedTransport: ForcedTransport
  mailboxOptsFor: (to: string) => ChatViewMailboxHybridOpts
  onOfflineMailboxQueueChanged?: () => void
  throwIfCancelled: () => void
  setStatusMsg: (v: string) => void
}

export function createChatViewPath4SendHandlers(ctx: ChatViewPath4SendContext) {
  const dispatchPath4Mirror = async (
    payload: string,
    messageNonceU64: bigint,
    kind: Path4MirrorKind,
    loraMsgId?: string | null
  ): Promise<Path4MirrorDispatch> => {
    const selfAddr = ctx.myAddress.trim().toLowerCase()
    if (!ADDR_64_LOWER.test(selfAddr)) {
      return { status: 'failed', note: 'Eigen-Archiv: MY_ADDRESS ungültig — keine Mailbox-Kopie.' }
    }
    if (ctx.apiStatus?.locked) {
      return { status: 'failed', note: 'Eigen-Archiv: Tresor gesperrt — Mailbox-Kopie übersprungen.' }
    }
    const res = await sendPlaintextMailboxHybrid(selfAddr, payload, messageNonceU64, ctx.mailboxOptsFor(selfAddr))
    if (res.ok) {
      const txDigest = res.txDigest
      if (txDigest) {
        const previewSource = parseMailboxOutNonceMarker(payload)?.rest ?? payload
        const inv = {
          digest: txDigest,
          type: kind === 'image_luma' || kind === 'image_chroma' ? ('image' as const) : ('text' as const),
          status: 'anchored' as const,
          origin: 'path4' as const,
          nonce: messageNonceU64.toString(),
          encrypted: false,
          contentPreview: trimTangleContentPreview(previewSource),
          ...(kind === 'image_luma' ? { chunkPart: 1, chunkTotal: 2 } : {}),
          ...(kind === 'image_chroma' ? { chunkPart: 2, chunkTotal: 2 } : {}),
        }
        addTangleInventoryItem(inv)
        void maybeAutoSaveDigestToVault({ ...inv, timestamp: Date.now() })
      }
      return {
        status: 'anchored',
        note: 'Eigen-Archiv: Klartext-Mailbox an dich gesendet.',
        txDigest,
      }
    }
    const err = mailboxHybridErr(res)
    if (!isOfflineMailboxQueueEnabled()) return { status: 'failed', note: `Eigen-Archiv (Mailbox): ${err}` }
    const msgIdTag = loraMsgId ? `|msgId=${loraMsgId}` : ''
    const priority = kind === 'text' ? 20 : kind === 'image_luma' ? 50 : kind === 'image_chroma' ? 60 : 100
    const en = await enqueueOfflineMailboxFailure({
      kind: 'plain_send',
      recipient: selfAddr,
      payload,
      encrypted: false,
      timeIsTrusted: !ctx.deviceTimeTrustWarn,
      lastError: `path4:${kind}${msgIdTag} ${err}`.trim(),
      senderAddress: ctx.myAddress.trim(),
      threadId: `${stableOfflineMailboxThreadId(ctx.myAddress.trim(), selfAddr)}|path4:${kind}${msgIdTag}`,
      messageNonceU64,
      priority,
    })
    ctx.onOfflineMailboxQueueChanged?.()
    if (!en.ok) return { status: 'failed', note: `Eigen-Archiv (Queue): ${en.reason}` }
    if (en.queued) return { status: 'queued', note: 'Eigen-Archiv: in Offline-Warteschlange (Opt-in).' }
    return { status: 'duplicate', note: 'Eigen-Archiv: bereits in Offline-Warteschlange (Dedup).' }
  }

  const runPath4MailboxSelfArchive = async (airUtf8: string): Promise<string> => {
    if (!ctx.path4SelfArchiveActive) return ''
    const n = nextChainMessageNonceU64()
    const marked = prependPath4SelfArchiveMarker(airUtf8)
    const wireForApi = prependMailboxOutNonceMarker(marked, n)
    const d = await dispatchPath4Mirror(wireForApi, n, 'text')
    return formatPath4TextSelfArchiveFootnote(d)
  }

  const runPath4SelfMirrorForLoraImage = async (
    lumaText: string,
    chromaText: string,
    segMsgIds?: { luma?: string; chroma?: string }
  ): Promise<string> => {
    if (!ctx.meshSelfArchiveAfterLoRa || ctx.forcedTransport !== 'mesh') return ''
    ctx.throwIfCancelled()
    const loraMsgIdLuma =
      segMsgIds?.luma ??
      parseLoraProgressiveMessage(lumaText)?.msgId ??
      parseLoraProgressiveMessage(chromaText)?.msgId ??
      null
    const loraMsgIdChroma =
      segMsgIds?.chroma ?? parseLoraProgressiveMessage(chromaText)?.msgId ?? loraMsgIdLuma
    const n1 = nextChainMessageNonceU64()
    const w1 = prependMailboxOutNonceMarker(prependPath4SelfArchiveMarker(lumaText), n1)
    const d1 = await dispatchPath4Mirror(w1, n1, 'image_luma', loraMsgIdLuma)
    if (d1.status !== 'anchored') return ` ${d1.note}`
    ctx.throwIfCancelled()
    const n2 = n1 + 1n
    const w2 = prependMailboxOutNonceMarker(prependPath4SelfArchiveMarker(chromaText), n2)
    const d2 = await dispatchPath4Mirror(w2, n2, 'image_chroma', loraMsgIdChroma)
    if (d2.status !== 'anchored') return ` ${d2.note}`
    const mbTx = d2.txDigest ?? d1.txDigest
    if (isForensicImageMailboxAttestationEnabled()) {
      const selfAddr = ctx.myAddress.trim().toLowerCase()
      await runForensicMailboxAttestationAfterSend({
        recipient: selfAddr,
        senderAddress: selfAddr,
        primary: { payloadUtf8: w1, messageNonceU64: n1 },
        secondary: { payloadUtf8: w2, messageNonceU64: n2 },
        imageContentSha256Hex: null,
        deviceTimeTrustWarn: !!ctx.deviceTimeTrustWarn,
        baseSuccessMsg: 'Eigen-Archiv: Bild in eigener Mailbox verankert.',
        setStatusMsg: ctx.setStatusMsg,
        mailboxTxDigest: mbTx,
        silent: true,
      })
    }
    return ` Eigen-Archiv verankert.${formatTxDigestStatusSuffix(mbTx)}`
  }

  return { dispatchPath4Mirror, runPath4MailboxSelfArchive, runPath4SelfMirrorForLoraImage }
}
