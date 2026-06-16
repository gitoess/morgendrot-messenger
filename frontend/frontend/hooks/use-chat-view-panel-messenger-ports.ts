'use client'

import { useCallback, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  assembleChatViewPanelMessengerPorts,
  asHandshakeOffersRead,
  asInboxHandshakePanelActions,
  asInboxPanelLocalActions,
  type ChatViewMessengerPorts,
  type ChatViewPanelMessengerPorts,
  type SendComposerStatus,
} from '@/frontend/features/messenger-ports'
import {
  useChatViewPendingHandshakes,
  type PendingHandshakesPollState,
} from '@/frontend/hooks/use-chat-view-pending-handshakes'
import { saveContactEntry, type ApiStatus, type ContactMeshEntryClient } from '@/frontend/lib/api'
import { contactDisplayLabel } from '@/frontend/lib/contact-display'
import { addressMatchesIdentity } from '@/frontend/features/inbox/inbox-partner-filter'
import { resolveMeshtasticPlaintextDestination } from '@/frontend/lib/meshtastic-node-id'
import {
  tryPurgeHandshakeOfferOnChain,
  type HandshakeOfferSource,
} from '@/frontend/lib/handshake-offer-delete'
import {
  applyReplyContextVariant,
  resolveReplyContextFromInboxMessage,
  type ReplyContextVariant,
} from '@/frontend/lib/inbox-reply-context'
import type { ComposerDeliveryChannel } from '@/frontend/lib/composer-delivery-channel'
import type { MessengerChatChannel } from '@/frontend/lib/messenger-chat-channel'
import type { MessengerGroupDefinition } from '@/frontend/lib/messenger-group-store'
import { recordContactLastContacted } from '@/frontend/lib/contact-phonebook-meta-store'
import type { Message } from '@/frontend/lib/types'

export type ChatViewPanelMessengerPortsComposerReplyTargets = {
  onChannelModeChange?: (c: MessengerChatChannel) => void
  setForcedTransport: (v: 'internet' | 'mesh' | 'adhoc') => void
  setComposerDelivery: (v: ComposerDeliveryChannel) => void
  setPartner: (v: string) => void
  setRecipient: (v: string) => void
  setEncrypted: (v: boolean) => void
  setComposerMailboxObjectId: (v: string) => void
  setMeshtasticChannelIndex: (v: number | undefined) => void
  setMeshPlaintextNodeId: (v: string) => void
  setMeshPlaintextToNodeEnabled: (v: boolean) => void
  selectInboxPartnerForSend: (address: string) => void
  setMessage: (v: string) => void
  refreshMessengerGroups: () => void
}

export type UseChatViewPanelMessengerPortsDeps = {
  messengerPorts: ChatViewMessengerPorts
  myAddress: string
  activeGroup: MessengerGroupDefinition | null
  apiStatus: ApiStatus | null
  contactDirectory: Record<string, ContactMeshEntryClient>
  pendingHandshakes?: PendingHandshakesPollState
  pendingHandshakesPoll: {
    enabled: boolean
    connectedAddresses: readonly string[]
    refreshToken: string
    vaultLocked: boolean
    basisUnreachable: boolean
  }
  onChannelModeChange?: (c: MessengerChatChannel) => void
  setStatus: (v: SendComposerStatus) => void
  setStatusMsg: (v: string) => void
  refreshContactDirectory: () => void
  composeReply: ChatViewPanelMessengerPortsComposerReplyTargets
}

export type ChatViewContactAliasDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  address: string
  defaultLabel: string
  busy: boolean
  onSave: (label: string) => void | Promise<void>
}

export type ChatViewReplyPathChoiceDialogProps = {
  open: boolean
  variants: readonly ReplyContextVariant[]
  onClose: () => void
  onSelect: (variant: ReplyContextVariant) => void
}

export function useChatViewPanelMessengerPorts(deps: UseChatViewPanelMessengerPortsDeps): {
  panelMessengerPorts: ChatViewPanelMessengerPorts
  contactAliasDialog: ChatViewContactAliasDialogProps
  replyPathChoiceDialog: ChatViewReplyPathChoiceDialogProps
} {
  const { messengerPorts, composeReply } = deps
  const { handshakeActions, meshDevice, meshSendOptions, attachmentBar } = messengerPorts
  const { meshPlaintextToNodeEnabled, meshPlaintextNodeId } = meshSendOptions

  const internalPendingHandshakes = useChatViewPendingHandshakes({
    enabled: deps.pendingHandshakesPoll.enabled,
    connectedAddresses: [...deps.pendingHandshakesPoll.connectedAddresses],
    refreshToken: deps.pendingHandshakesPoll.refreshToken,
    contactDirectory: deps.contactDirectory,
    vaultLocked: deps.pendingHandshakesPoll.vaultLocked,
    basisUnreachable: deps.pendingHandshakesPoll.basisUnreachable,
  })

  const {
    offers: pendingHandshakeOffers,
    outgoingOffers: outgoingHandshakeOffers,
    loading: pendingHandshakesLoading,
    reload: reloadPendingHandshakes,
    dismissOffer: dismissPendingHandshake,
    dismissOutgoingOffer: dismissOutgoingPendingHandshake,
  } = deps.pendingHandshakes ?? internalPendingHandshakes

  const pendingHandshakeCount = pendingHandshakeOffers.length + outgoingHandshakeOffers.length

  const [contactAliasDialog, setContactAliasDialog] = useState<{
    address: string
    defaultLabel: string
  } | null>(null)
  const [contactAliasBusy, setContactAliasBusy] = useState(false)
  const [replyPathChoice, setReplyPathChoice] = useState<ReplyContextVariant[] | null>(null)

  const handleResendOutgoingHandshake = useCallback(
    async (recipient: string) => {
      await handshakeActions.onHandshakeForAddress(recipient)
      window.setTimeout(() => void reloadPendingHandshakes(), 3000)
    },
    [handshakeActions, reloadPendingHandshakes]
  )

  const handleAcceptHandshakeFromInbox = useCallback(
    async (sender: string) => {
      composeReply.setPartner(sender.trim())
      await handshakeActions.onConnectAcceptForAddress(sender)
      window.setTimeout(() => void reloadPendingHandshakes(), 4000)
    },
    [composeReply.setPartner, handshakeActions, reloadPendingHandshakes]
  )

  const purgeAndDismissHandshake = useCallback(
    async (p: {
      recipient: string
      sender: string
      source: HandshakeOfferSource
      dismissLocal: () => void
      label: string
    }) => {
      attachmentBar.setSending?.(true)
      try {
        const purge = await tryPurgeHandshakeOfferOnChain({
          recipient: p.recipient,
          sender: p.sender,
          source: p.source,
          apiStatus: deps.apiStatus,
        })
        p.dismissLocal()
        if (purge.ok && purge.onChain) {
          toast.success(`Handshake mit ${p.label} gelöscht (on-chain + lokal).`)
        } else if (purge.ok && !purge.onChain) {
          const hint =
            purge.reason === 'event-only'
              ? 'Nur lokal ausgeblendet — Event-only (kein Mailbox-Purge möglich).'
              : 'Nur lokal ausgeblendet — Purge/Mailbox nicht verfügbar.'
          toast.info(hint)
        } else {
          toast.warning(`Lokal ausgeblendet. On-chain-Purge fehlgeschlagen: ${purge.error}`)
        }
        window.setTimeout(() => void reloadPendingHandshakes(), 2500)
      } finally {
        attachmentBar.setSending?.(false)
      }
    },
    [deps.apiStatus, attachmentBar.setSending, reloadPendingHandshakes]
  )

  const handleDeleteIncomingHandshake = useCallback(
    async (sender: string, nonce: string, source: HandshakeOfferSource) => {
      const me = deps.myAddress.trim()
      if (!/^0x[a-fA-F0-9]{64}$/i.test(me)) {
        toast.error('Eigene Adresse fehlt — Purge nicht möglich.')
        return
      }
      const label =
        contactDisplayLabel(deps.contactDirectory, sender.trim().toLowerCase()) || sender.slice(0, 12)
      await purgeAndDismissHandshake({
        recipient: me,
        sender: sender.trim(),
        source,
        dismissLocal: () => dismissPendingHandshake(sender, nonce),
        label,
      })
    },
    [deps.myAddress, deps.contactDirectory, purgeAndDismissHandshake, dismissPendingHandshake]
  )

  const handleDeleteOutgoingHandshake = useCallback(
    async (recipient: string, nonce: string, source: HandshakeOfferSource) => {
      const me = deps.myAddress.trim()
      if (!/^0x[a-fA-F0-9]{64}$/i.test(me)) {
        toast.error('Eigene Adresse fehlt — Purge nicht möglich.')
        return
      }
      const label =
        contactDisplayLabel(deps.contactDirectory, recipient.trim().toLowerCase()) ||
        recipient.slice(0, 12)
      await purgeAndDismissHandshake({
        recipient: recipient.trim(),
        sender: me,
        source,
        dismissLocal: () => dismissOutgoingPendingHandshake(recipient, nonce),
        label,
      })
    },
    [deps.myAddress, deps.contactDirectory, purgeAndDismissHandshake, dismissOutgoingPendingHandshake]
  )

  const handleUseSenderAsPartnerFromInbox = useCallback(
    (sender: string) => {
      const t = sender.trim()
      composeReply.setPartner(t)
      composeReply.setRecipient(t)
      toast.info('Partner-Adresse übernommen.')
    },
    [composeReply.setPartner, composeReply.setRecipient]
  )

  const applyInboxReplyVariant = useCallback(
    (variant: ReplyContextVariant) => {
      attachmentBar.clearCompactAttachment()
      applyReplyContextVariant(variant, composeReply)
      deps.setStatus('success')
      deps.setStatusMsg(
        variant.hint
          ? `Antworten: ${variant.label} — ${variant.hint}`
          : `Antworten: ${variant.label} — Nachricht ergänzen und senden.`
      )
      toast.success(`Antworten: ${variant.label}`)
      requestAnimationFrame(() => {
        document.getElementById('chat-composer-message')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      })
    },
    [attachmentBar.clearCompactAttachment, composeReply, deps.setStatus, deps.setStatusMsg]
  )

  const handleReplyToInboxMessage = useCallback(
    (msg: Message) => {
      const result = resolveReplyContextFromInboxMessage(msg, {
        myAddress: deps.myAddress,
        contactDirectory: deps.contactDirectory,
        pinnwandBoardAddress: deps.apiStatus?.broadcastPinnwand?.address,
        activeGroup: deps.activeGroup,
      })
      if (!result) {
        toast.error('Antworten: Kein passender Kanal für diese Zeile.')
        return
      }
      if (result.kind === 'choice') {
        setReplyPathChoice(result.variants)
        return
      }
      applyInboxReplyVariant(result.variant)
    },
    [
      deps.myAddress,
      deps.contactDirectory,
      deps.apiStatus?.broadcastPinnwand?.address,
      deps.activeGroup,
      applyInboxReplyVariant,
    ]
  )

  const addInboxSenderToContactBook = useCallback(
    (address: string) => {
      const a = address.trim()
      if (!a.startsWith('0x') || a.length < 66) {
        deps.setStatus('error')
        deps.setStatusMsg('Keine gültige 0x-Absenderadresse.')
        setTimeout(() => deps.setStatus('idle'), 4000)
        return
      }
      if (deps.myAddress.trim() && addressMatchesIdentity(a, deps.myAddress)) {
        deps.setStatus('error')
        deps.setStatusMsg('Das ist deine eigene Adresse — nicht ins Telefonbuch nötig.')
        setTimeout(() => deps.setStatus('idle'), 4000)
        return
      }
      const suggest = contactDisplayLabel(deps.contactDirectory, a) || `${a.slice(0, 10)}…${a.slice(-4)}`
      setContactAliasDialog({ address: a, defaultLabel: suggest })
    },
    [deps.contactDirectory, deps.myAddress, deps.setStatus, deps.setStatusMsg]
  )

  const saveContactAliasFromDialog = useCallback(
    async (label: string) => {
      if (!contactAliasDialog) return
      setContactAliasBusy(true)
      const r = await saveContactEntry({
        address: contactAliasDialog.address,
        label: label || undefined,
      })
      setContactAliasBusy(false)
      if (r.ok) {
        deps.refreshContactDirectory()
        recordContactLastContacted(contactAliasDialog.address)
        deps.setStatus('success')
        deps.setStatusMsg(r.message || 'Kontakt gespeichert.')
        setContactAliasDialog(null)
      } else {
        deps.setStatus('error')
        deps.setStatusMsg(r.error || 'Kontakt speichern fehlgeschlagen.')
      }
      setTimeout(() => deps.setStatus('idle'), 5000)
    },
    [contactAliasDialog, deps.refreshContactDirectory, deps.setStatus, deps.setStatusMsg]
  )

  const onSarqNakWire = useCallback(
    async (wire: string) => {
      if (!meshDevice.connected) return
      const resolved = meshPlaintextToNodeEnabled
        ? resolveMeshtasticPlaintextDestination(true, meshPlaintextNodeId)
        : 'broadcast'
      const dest = resolved === null ? 'broadcast' : resolved
      try {
        await meshDevice.sendMeshText(wire, dest)
      } catch {
        /* NAK optional; Chat bleibt bedienbar */
      }
    },
    [meshDevice, meshPlaintextNodeId, meshPlaintextToNodeEnabled]
  )

  const panelMessengerPorts = useMemo(
    () =>
      assembleChatViewPanelMessengerPorts(
        messengerPorts,
        {
          handshakeOffersRead: asHandshakeOffersRead(
            pendingHandshakeOffers,
            outgoingHandshakeOffers,
            reloadPendingHandshakes
          ),
          inboxHandshakePanelActions: asInboxHandshakePanelActions({
            pendingHandshakesLoading,
            pendingHandshakeCount,
            onAcceptPendingHandshake: handleAcceptHandshakeFromInbox,
            onUseSenderAsPartnerFromInbox: handleUseSenderAsPartnerFromInbox,
            onReplyToMessage: handleReplyToInboxMessage,
            onDeleteIncomingHandshake: handleDeleteIncomingHandshake,
            onDeleteOutgoingHandshake: handleDeleteOutgoingHandshake,
            onResendOutgoingHandshake: handleResendOutgoingHandshake,
          }),
          inboxPanelLocalActions: asInboxPanelLocalActions({
            onAddSenderToContactBook: addInboxSenderToContactBook,
            onSarqNakWire,
          }),
        },
        deps.onChannelModeChange ? { onChannelModeChange: deps.onChannelModeChange } : undefined
      ),
    [
      messengerPorts,
      deps.onChannelModeChange,
      pendingHandshakeOffers,
      outgoingHandshakeOffers,
      reloadPendingHandshakes,
      pendingHandshakesLoading,
      pendingHandshakeCount,
      handleAcceptHandshakeFromInbox,
      handleUseSenderAsPartnerFromInbox,
      handleReplyToInboxMessage,
      handleDeleteIncomingHandshake,
      handleDeleteOutgoingHandshake,
      handleResendOutgoingHandshake,
      addInboxSenderToContactBook,
      onSarqNakWire,
    ]
  )

  const contactAliasDialogProps: ChatViewContactAliasDialogProps = useMemo(
    () => ({
      open: contactAliasDialog != null,
      onOpenChange: (open) => {
        if (!open) setContactAliasDialog(null)
      },
      address: contactAliasDialog?.address ?? '',
      defaultLabel: contactAliasDialog?.defaultLabel ?? '',
      busy: contactAliasBusy,
      onSave: saveContactAliasFromDialog,
    }),
    [contactAliasDialog, contactAliasBusy, saveContactAliasFromDialog]
  )

  const replyPathChoiceDialogProps: ChatViewReplyPathChoiceDialogProps = useMemo(
    () => ({
      open: replyPathChoice != null,
      variants: replyPathChoice ?? [],
      onClose: () => setReplyPathChoice(null),
      onSelect: (variant) => {
        setReplyPathChoice(null)
        applyInboxReplyVariant(variant)
      },
    }),
    [replyPathChoice, applyInboxReplyVariant]
  )

  return {
    panelMessengerPorts,
    contactAliasDialog: contactAliasDialogProps,
    replyPathChoiceDialog: replyPathChoiceDialogProps,
  }
}
