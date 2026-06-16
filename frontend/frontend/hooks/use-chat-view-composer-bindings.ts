'use client'

import type { ChatViewMessengerPorts } from '@/frontend/features/messenger-ports'

/** Aliase aus Core-Ports für `ChatViewMainContent` (Binding-Glue, P10). */
export function useChatViewComposerBindings(messengerPorts: ChatViewMessengerPorts) {
  const {
    shellRouting,
    connectionStatusRead,
    contactDirectoryRead,
    inboxViewUi,
    inboxPanelRead,
    inboxPreviewRead,
    morgPkgArchive,
    meshSendOptions,
    composerDraft,
    composerPartner,
    composerSendPath,
    sendTransportRead,
    sendTransportChoice,
    sendMeshFunkOptions,
    sendActions,
    inboxActions,
    packageExpert,
    meshSetup,
  } = messengerPorts

  const {
    channelMode,
    isPrivate,
    isGroup,
    activeGroup,
    refreshMessengerGroups,
    role,
    myAddress,
  } = shellRouting

  const {
    apiStatus,
    basisUnreachable,
    statusCacheAgeMinutes,
    deviceTimeTrustWarn,
    connectedAddresses: handshakeConnectedAddresses,
  } = connectionStatusRead

  const { directory, isMeshVerifiedForAddress, refreshContactDirectory } = contactDirectoryRead

  const {
    meshPlaintextToNodeEnabled,
    meshPlaintextNodeId,
    setMeshPlaintextNodeId,
    setMeshPlaintextToNodeEnabled,
    setMeshtasticChannelIndex,
  } = meshSendOptions

  const { message, recipient, onMessageChange: setMessage, onRecipientChange: setRecipient } = composerDraft
  const { partner, onPartnerChange: setPartner } = composerPartner
  const { encrypted, forcedTransport } = sendTransportRead
  const {
    onEncryptedChange: setEncrypted,
    onForcedTransportChange: setForcedTransport,
    messagingPersistenceMode,
  } = sendTransportChoice
  const { composerDelivery, onComposerDeliveryChange: setComposerDelivery } = composerSendPath
  const { meshLoRaImagesEnabled, onMeshLoRaImagesEnabledChange: setMeshLoRaImagesEnabled } = sendMeshFunkOptions
  const { meshSelfArchiveAfterLoRa, onMeshSelfArchiveAfterLoRaChange: setMeshSelfArchiveAfterLoRa } =
    sendMeshFunkOptions
  const {
    status,
    statusMsg,
    onStatusChange: setStatus,
    onStatusMsgChange: setStatusMsg,
    onConfirmLoraSendViaOnline: confirmLoraSendViaOnline,
    onDismissLoraOnlineFallback: dismissLoraOnlineFallback,
    onSend: handleSend,
    onCancelSend: cancelSend,
    loraOnlineFallbackOffer,
  } = sendActions
  const {
    selectInboxPartnerForSend,
    selectInboxConversationAll,
    selectInboxConversationPartner,
    selectInboxConversationGroup,
    inboxConversationGroupId,
    inboxPartnerKey,
    inboxPartnerFiltersArmed,
    inboxPartnerOptions,
    inboxOverviewChipsVisible,
    inboxOverviewCategory,
    setInboxOverviewCategory,
    inboxOverviewUnreadCounts,
  } = inboxViewUi

  return {
    shellRouting,
    channelMode,
    isPrivate,
    isGroup,
    activeGroup,
    refreshMessengerGroups,
    role,
    myAddress,
    apiStatus,
    basisUnreachable,
    statusCacheAgeMinutes,
    deviceTimeTrustWarn,
    handshakeConnectedAddresses,
    directory,
    isMeshVerifiedForAddress,
    refreshContactDirectory,
    meshPlaintextToNodeEnabled,
    meshPlaintextNodeId,
    setMeshPlaintextNodeId,
    setMeshPlaintextToNodeEnabled,
    setMeshtasticChannelIndex,
    message,
    recipient,
    setMessage,
    setRecipient,
    partner,
    setPartner,
    encrypted,
    forcedTransport,
    setEncrypted,
    setForcedTransport,
    composerDelivery,
    setComposerDelivery,
    messagingPersistenceMode,
    meshLoRaImagesEnabled,
    setMeshLoRaImagesEnabled,
    meshSelfArchiveAfterLoRa,
    setMeshSelfArchiveAfterLoRa,
    status,
    statusMsg,
    setStatus,
    setStatusMsg,
    confirmLoraSendViaOnline,
    dismissLoraOnlineFallback,
    handleSend,
    cancelSend,
    loraOnlineFallbackOffer,
    selectInboxPartnerForSend,
    selectInboxConversationAll,
    selectInboxConversationPartner,
    selectInboxConversationGroup,
    inboxConversationGroupId,
    inboxPartnerKey,
    inboxPartnerFiltersArmed,
    inboxPartnerOptions,
    inboxOverviewChipsVisible,
    inboxOverviewCategory,
    setInboxOverviewCategory,
    inboxOverviewUnreadCounts,
    composerSendPath,
    connectionStatusRead,
    contactDirectoryRead,
    inboxPanelRead,
    inboxPreviewRead,
    morgPkgArchive,
    meshSetup,
    inboxActions,
    packageExpert,
    sendTransportRead,
    sendTransportChoice,
    sendMeshFunkOptions,
    sendActions,
    meshSendOptions,
  }
}
