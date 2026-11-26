'use client'

import { useEffect, useMemo, useState } from 'react'
import { notifyTelegramContact } from '@/frontend/lib/api/telegram-notify'
import {
  resolveComposerIotaAddress,
  resolveComposerTelegramChatIds,
} from '@/frontend/lib/composer-recipient-fields'
import {
  buildTelegramMessagePreview,
  readTelegramNotifyOnSend,
  resolveTelegramNotifyRecipientAddress,
  writeTelegramNotifyOnSend,
} from '@/frontend/lib/telegram-notify-pref'
import type { ApiStatus, ContactMeshEntryClient } from '@/frontend/lib/api'
import { canTransportWrite } from '@/frontend/lib/messenger-capability-gates'

export function useChatViewTelegramComposer(p: {
  isPrivate: boolean
  composerDelivery?: 'chain' | 'telegram'
  recipient: string
  partner: string
  encrypted: boolean
  message: string
  apiStatus: ApiStatus | null
  contactDirectory: Record<string, ContactMeshEntryClient>
  myAddress: string
  sending: boolean
  attachedTxtFile: { name: string; text: string } | null
  attachedBlobBase64: string | null
  attachedAudioBase64: string | null
  hasLoraAttachment: boolean
  onMessageChange: (v: string) => void
  clearAttachments: () => void
  onStatusFeedback?: (msg: string, status?: 'idle' | 'success' | 'error') => void
  onTelegramDelivered?: (payload: {
    recipientKey: string
    recipientKeys?: string[]
    text: string
  }) => void
}) {
  const [telegramOnlyBusy, setTelegramOnlyBusy] = useState(false)
  const [telegramNotifyOnSend, setTelegramNotifyOnSend] = useState(false)
  /** Composer Telegram + Bild: User bestätigt unverschlüsselte TG-Zustellung. */
  const [telegramUnencryptedMediaAck, setTelegramUnencryptedMediaAck] = useState(false)

  useEffect(() => {
    setTelegramNotifyOnSend(readTelegramNotifyOnSend())
  }, [])

  useEffect(() => {
    if (!p.attachedBlobBase64 || p.composerDelivery !== 'telegram') {
      setTelegramUnencryptedMediaAck(false)
    }
  }, [p.attachedBlobBase64, p.composerDelivery])

  const composerIota = useMemo(
    () => resolveComposerIotaAddress(p.recipient, p.partner, p.encrypted),
    [p.recipient, p.partner, p.encrypted]
  )

  const composerTelegramIds = useMemo(
    () =>
      resolveComposerTelegramChatIds(p.recipient, p.contactDirectory, composerIota, {
        telegramDelivery: p.composerDelivery === 'telegram',
      }),
    [p.recipient, p.contactDirectory, composerIota, p.composerDelivery]
  )

  const composerTelegramId = composerTelegramIds[0] ?? ''

  const notifyRecipientTargets = useMemo(() => {
    const ids = composerTelegramIds
    if (ids.length > 0) return ids.map((id) => `tg:${id}`)
    const resolved = resolveTelegramNotifyRecipientAddress({
      recipient: p.recipient,
      partner: p.partner,
      encrypted: p.encrypted,
      connectedAddresses: p.apiStatus?.connectedAddresses,
    })
    if (resolved) return [resolved]
    return [] as string[]
  }, [
    composerTelegramIds,
    p.recipient,
    p.partner,
    p.encrypted,
    p.apiStatus?.connectedAddresses,
  ])

  const recipientHasTelegram = notifyRecipientTargets.length > 0

  const telegramPreview = useMemo(
    () =>
      buildTelegramMessagePreview({
        message: p.message,
        attachedTxtFile: p.attachedTxtFile,
        attachedBlobBase64: p.attachedBlobBase64,
        attachedAudioBase64: p.attachedAudioBase64,
        hasLoraAttachment: p.hasLoraAttachment,
      }),
    [
      p.message,
      p.attachedTxtFile,
      p.attachedBlobBase64,
      p.attachedAudioBase64,
      p.hasLoraAttachment,
    ]
  )

  const telegramWriteAllowed = canTransportWrite(p.apiStatus, 'telegram')

  const wantsTelegramPhoto =
    p.composerDelivery === 'telegram' && Boolean(p.attachedBlobBase64?.trim())

  const canSendTelegramOnly =
    p.isPrivate &&
    telegramWriteAllowed &&
    (p.composerDelivery === 'telegram' ? composerTelegramIds.length > 0 : recipientHasTelegram) &&
    !telegramOnlyBusy &&
    !p.sending &&
    Boolean(telegramPreview.trim()) &&
    !p.apiStatus?.locked &&
    (!wantsTelegramPhoto || telegramUnencryptedMediaAck)

  const handleTelegramOnly = async () => {
    const targets =
      composerTelegramIds.length > 0
        ? composerTelegramIds.map((id) => `tg:${id}`)
        : notifyRecipientTargets
    if (targets.length === 0 || !p.onStatusFeedback) return
    if (wantsTelegramPhoto && !telegramUnencryptedMediaAck) {
      p.onStatusFeedback(
        'Bild über Telegram: bitte bestätigen (unverschlüsselt auf Telegram-Servern).',
        'error'
      )
      return
    }
    setTelegramOnlyBusy(true)
    p.onStatusFeedback(
      wantsTelegramPhoto ? 'Sende Telegram-Bild (unverschlüsselt)…' : 'Sende Telegram-Hinweis…',
      'idle'
    )
    const myLabel =
      p.contactDirectory[p.myAddress.trim().toLowerCase()]?.label ||
      (p.myAddress.trim() ? `${p.myAddress.trim().slice(0, 10)}…` : 'Morgendrot')

    let delivered = 0
    let lastError = ''
    const deliveredTargets: string[] = []
    for (const target of targets) {
      const r = await notifyTelegramContact({
        recipientAddress: target,
        messagePreview: telegramPreview,
        senderLabel: myLabel,
        skipJournal: true,
        photoBase64: wantsTelegramPhoto ? p.attachedBlobBase64 || undefined : undefined,
        acknowledgeUnencryptedMedia: wantsTelegramPhoto ? true : undefined,
      })
      if (r.delivered) {
        delivered++
        deliveredTargets.push(target)
      } else if (r.error) {
        lastError = r.error
      } else if (r.skipped) {
        lastError = r.skipped
      }
    }

    if (deliveredTargets.length > 0) {
      p.onTelegramDelivered?.({
        recipientKey: deliveredTargets[0]!,
        text: telegramPreview,
        recipientKeys: deliveredTargets,
      })
    }

    if (delivered > 0) {
      p.onMessageChange('')
      p.clearAttachments()
      setTelegramUnencryptedMediaAck(false)
      p.onStatusFeedback(
        delivered === 1
          ? wantsTelegramPhoto
            ? 'Telegram-Bild gesendet (unverschlüsselt bei TG).'
            : 'Telegram gesendet — siehe Ausgang im Posteingang.'
          : `Telegram an ${delivered} Empfänger gesendet.`,
        'success'
      )
    } else {
      p.onStatusFeedback(lastError || 'Telegram-Hinweis fehlgeschlagen', 'error')
    }
    setTelegramOnlyBusy(false)
  }

  return {
    composerTelegramId,
    composerTelegramIds,
    composerIota,
    telegramNotifyOnSend,
    setTelegramNotifyOnSend: (on: boolean) => {
      writeTelegramNotifyOnSend(on)
      setTelegramNotifyOnSend(on)
    },
    wantsTelegramPhoto,
    telegramUnencryptedMediaAck,
    setTelegramUnencryptedMediaAck,
    canSendTelegramOnly,
    telegramOnlyBusy,
    handleTelegramOnly,
    recipientHasTelegram,
  }
}
