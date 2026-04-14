import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ChatViewSendPanel } from './chat-view-send-panel'

describe('ChatViewSendPanel (RTL smoke)', () => {
  it('zeigt Senden und ruft onSend bei Klick', () => {
    const onSend = vi.fn()
    render(
      <ChatViewSendPanel
        isPrivate
        encrypted
        recipient=""
        message="Hallo Test"
        onRecipientChange={vi.fn()}
        onMessageChange={vi.fn()}
        delayMirrorToIota={false}
        onDelayMirrorToIotaChange={vi.fn()}
        forcedTransport="internet"
        voicePhase="idle"
        voiceActiveKind={null}
        voiceProgress01={0}
        voiceMaxSeconds={35}
        voiceEmergencyMaxSeconds={30}
        sosVoiceFollowsOnline={false}
        onVoiceToggle={vi.fn()}
        onVoiceEmergencyToggle={vi.fn()}
        voiceNormalBlockedStart={false}
        voiceEmergencyBlockedStart={false}
        voiceBusy={false}
        voiceRecording={false}
        sosVoiceAwaitingSend={false}
        compactFileRef={createRef()}
        compactBusy={false}
        onFileChange={vi.fn()}
        ingestChatAttachmentFile={vi.fn().mockResolvedValue(undefined)}
        compactMeta={null}
        attachedBlobBase64={null}
        attachedLora={null}
        attachedTxtFile={null}
        attachedAudioBase64={null}
        clearCompactAttachment={vi.fn()}
        compactPreviewUrl={null}
        loraPreviewUrl={null}
        sending={false}
        loraOnlineFallbackOffer={null}
        onConfirmLoraOnline={vi.fn()}
        onDismissLoraOnlineFallback={vi.fn()}
        apiStatus={null}
        onSend={onSend}
        status="idle"
        statusMsg=""
      />
    )
    const sendBtn = screen.getByRole('button', { name: /Senden/i })
    expect(sendBtn).toBeEnabled()
    fireEvent.click(sendBtn)
    expect(onSend).toHaveBeenCalledTimes(1)
  })

  it('zeigt LoRa-Mesh-Fortschritt wenn Anhang und Fortschrittszeile gesetzt', () => {
    render(
      <ChatViewSendPanel
        isPrivate
        encrypted
        recipient=""
        message=""
        onRecipientChange={vi.fn()}
        onMessageChange={vi.fn()}
        delayMirrorToIota={false}
        onDelayMirrorToIotaChange={vi.fn()}
        forcedTransport="mesh"
        voicePhase="idle"
        voiceActiveKind={null}
        voiceProgress01={0}
        voiceMaxSeconds={35}
        voiceEmergencyMaxSeconds={30}
        sosVoiceFollowsOnline={false}
        onVoiceToggle={vi.fn()}
        onVoiceEmergencyToggle={vi.fn()}
        voiceNormalBlockedStart={false}
        voiceEmergencyBlockedStart={false}
        voiceBusy={false}
        voiceRecording={false}
        sosVoiceAwaitingSend={false}
        compactFileRef={createRef()}
        compactBusy={false}
        onFileChange={vi.fn()}
        ingestChatAttachmentFile={vi.fn().mockResolvedValue(undefined)}
        compactMeta={{ total: 100, luma: 40, chroma: 60, q: 40, mode: 'lora' }}
        attachedBlobBase64={null}
        attachedLora={{
          lumaWire: '[[MORG_LUMA_V1:msgId=deadbeef|len=4|ABCD]]',
          chromaWire: '[[MORG_CHROMA_V1:msgId=deadbeef|len=4|EFGH]]',
          messageId: 'deadbeef',
          lumaJpegBytes: 40,
          chromaJpegBytes: 60,
        }}
        attachedTxtFile={null}
        attachedAudioBase64={null}
        clearCompactAttachment={vi.fn()}
        compactPreviewUrl={null}
        loraPreviewUrl="blob:mock"
        loraMeshProgressLine="Luma 2/5 · Chroma ausstehend"
        sending
        loraOnlineFallbackOffer={null}
        onConfirmLoraOnline={vi.fn()}
        onDismissLoraOnlineFallback={vi.fn()}
        apiStatus={null}
        onSend={vi.fn()}
        status="idle"
        statusMsg="Funk: LUMA …"
      />
    )
    expect(screen.getByRole('status')).toHaveTextContent(/Luma 2\/5 · Chroma ausstehend/)
  })

  it('zeigt Mailbox-Warteschlange-Banner bei pending > 0 (privat)', () => {
    render(
      <ChatViewSendPanel
        isPrivate
        encrypted
        recipient=""
        message=""
        onRecipientChange={vi.fn()}
        onMessageChange={vi.fn()}
        delayMirrorToIota={false}
        onDelayMirrorToIotaChange={vi.fn()}
        forcedTransport="internet"
        voicePhase="idle"
        voiceActiveKind={null}
        voiceProgress01={0}
        voiceMaxSeconds={35}
        voiceEmergencyMaxSeconds={30}
        sosVoiceFollowsOnline={false}
        onVoiceToggle={vi.fn()}
        onVoiceEmergencyToggle={vi.fn()}
        voiceNormalBlockedStart={false}
        voiceEmergencyBlockedStart={false}
        voiceBusy={false}
        voiceRecording={false}
        sosVoiceAwaitingSend={false}
        compactFileRef={createRef()}
        compactBusy={false}
        onFileChange={vi.fn()}
        ingestChatAttachmentFile={vi.fn().mockResolvedValue(undefined)}
        compactMeta={null}
        attachedBlobBase64={null}
        attachedLora={null}
        attachedTxtFile={null}
        attachedAudioBase64={null}
        clearCompactAttachment={vi.fn()}
        compactPreviewUrl={null}
        loraPreviewUrl={null}
        sending={false}
        loraOnlineFallbackOffer={null}
        onConfirmLoraOnline={vi.fn()}
        onDismissLoraOnlineFallback={vi.fn()}
        apiStatus={null}
        onSend={vi.fn()}
        status="idle"
        statusMsg=""
        offlineMailboxQueuePending={2}
      />
    )
    expect(screen.getByText(/Mailbox-Warteschlange/)).toBeInTheDocument()
    expect(screen.getByText(/2 Nachrichten warten auf die Basis/)).toBeInTheDocument()
  })

  it('zeigt § H.6c-Hinweis wenn Einträge mit unverifizierter Zeit anstehen', () => {
    render(
      <ChatViewSendPanel
        isPrivate
        encrypted
        recipient=""
        message=""
        onRecipientChange={vi.fn()}
        onMessageChange={vi.fn()}
        delayMirrorToIota={false}
        onDelayMirrorToIotaChange={vi.fn()}
        forcedTransport="internet"
        voicePhase="idle"
        voiceActiveKind={null}
        voiceProgress01={0}
        voiceMaxSeconds={35}
        voiceEmergencyMaxSeconds={30}
        sosVoiceFollowsOnline={false}
        onVoiceToggle={vi.fn()}
        onVoiceEmergencyToggle={vi.fn()}
        voiceNormalBlockedStart={false}
        voiceEmergencyBlockedStart={false}
        voiceBusy={false}
        voiceRecording={false}
        sosVoiceAwaitingSend={false}
        compactFileRef={createRef()}
        compactBusy={false}
        onFileChange={vi.fn()}
        ingestChatAttachmentFile={vi.fn().mockResolvedValue(undefined)}
        compactMeta={null}
        attachedBlobBase64={null}
        attachedLora={null}
        attachedTxtFile={null}
        attachedAudioBase64={null}
        clearCompactAttachment={vi.fn()}
        compactPreviewUrl={null}
        loraPreviewUrl={null}
        sending={false}
        loraOnlineFallbackOffer={null}
        onConfirmLoraOnline={vi.fn()}
        onDismissLoraOnlineFallback={vi.fn()}
        apiStatus={null}
        onSend={vi.fn()}
        status="idle"
        statusMsg=""
        offlineMailboxQueuePending={1}
        offlineMailboxQueueUntrustedTimeCount={1}
      />
    )
    expect(screen.getByText(/Gerätezeit[\s\S]*?Einreihen nicht verifiziert/)).toBeInTheDocument()
  })
})
