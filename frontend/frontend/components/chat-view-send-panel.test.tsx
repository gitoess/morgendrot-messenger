import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MESH_PLAINTEXT_MAX_CHARS } from '@/frontend/lib/chat-view-messenger-transport'
import { ChatViewSendPanel, type ChatViewSendPanelProps } from './chat-view-send-panel'

/** RTL-Fixture: gleiche Defaults wie Smoke-Tests, per Partial überschreibbar (§ H.1a). */
function primarySend(container: HTMLElement) {
  const el = container.querySelector('[data-testid="chat-composer-primary-send"]')
  expect(el).toBeInstanceOf(HTMLButtonElement)
  return el as HTMLButtonElement
}

function delayedMirrorCheckbox(container: HTMLElement) {
  const el = container.querySelector('[data-testid="delayed-mirror-to-iot-checkbox"]')
  expect(el).toBeInstanceOf(HTMLInputElement)
  return el as HTMLInputElement
}

function baseSendPanel(over: Partial<ChatViewSendPanelProps> = {}): ChatViewSendPanelProps {
  return {
    isPrivate: true,
    encrypted: true,
    recipient: '',
    message: 'Hallo Test',
    onRecipientChange: vi.fn(),
    onMessageChange: vi.fn(),
    delayMirrorToIota: false,
    onDelayMirrorToIotaChange: vi.fn(),
    forcedTransport: 'internet',
    voicePhase: 'idle',
    voiceActiveKind: null,
    voiceProgress01: 0,
    voiceMaxSeconds: 35,
    voiceEmergencyMaxSeconds: 30,
    sosVoiceFollowsOnline: false,
    onVoiceToggle: vi.fn(),
    onVoiceEmergencyToggle: vi.fn(),
    voiceNormalBlockedStart: false,
    voiceEmergencyBlockedStart: false,
    voiceBusy: false,
    voiceRecording: false,
    sosVoiceAwaitingSend: false,
    compactFileRef: createRef(),
    compactBusy: false,
    onFileChange: vi.fn(),
    ingestChatAttachmentFile: vi.fn().mockResolvedValue(undefined),
    compactMeta: null,
    attachedBlobBase64: null,
    attachedLora: null,
    attachedTxtFile: null,
    attachedAudioBase64: null,
    clearCompactAttachment: vi.fn(),
    compactPreviewUrl: null,
    loraPreviewUrl: null,
    sending: false,
    loraOnlineFallbackOffer: null,
    onConfirmLoraOnline: vi.fn(),
    onDismissLoraOnlineFallback: vi.fn(),
    apiStatus: null,
    onSend: vi.fn(),
    status: 'idle',
    statusMsg: '',
    ...over,
  }
}

describe('ChatViewSendPanel (RTL smoke)', () => {
  it('zeigt Senden und ruft onSend bei Klick', () => {
    const onSend = vi.fn()
    const { container } = render(<ChatViewSendPanel {...baseSendPanel({ onSend, message: 'Hallo Test' })} />)
    const sendBtn = primarySend(container)
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

  it('deaktiviert Senden bei leerem Inhalt (verschlüsselt, ohne Anhang)', () => {
    const onSend = vi.fn()
    const { container } = render(
      <ChatViewSendPanel
        {...baseSendPanel({
          onSend,
          message: '   ',
        })}
      />
    )
    const sendBtn = primarySend(container)
    expect(sendBtn).toBeDisabled()
    fireEvent.click(sendBtn)
    expect(onSend).not.toHaveBeenCalled()
  })

  it('deaktiviert Senden bei Klartext ohne Empfänger-Adresse', () => {
    const onSend = vi.fn()
    const { container } = render(
      <ChatViewSendPanel
        {...baseSendPanel({
          encrypted: false,
          recipient: '',
          message: 'Ping',
          forcedTransport: 'internet',
          onSend,
        })}
      />
    )
    expect(primarySend(container)).toBeDisabled()
    fireEvent.click(primarySend(container))
    expect(onSend).not.toHaveBeenCalled()
  })

  it('aktiviert Senden bei Klartext mit Empfänger und Kurznachricht', () => {
    const onSend = vi.fn()
    const addr = `0x${'a'.repeat(64)}`
    const { container } = render(
      <ChatViewSendPanel
        {...baseSendPanel({
          encrypted: false,
          recipient: addr,
          message: 'OK',
          forcedTransport: 'internet',
          onSend,
        })}
      />
    )
    const sendBtn = primarySend(container)
    expect(sendBtn).toBeEnabled()
    fireEvent.click(sendBtn)
    expect(onSend).toHaveBeenCalledTimes(1)
  })

  it('ruft onDelayMirrorToIotaChange bei Delayed-Upload-Checkbox (privat, Mesh) auf', () => {
    const onDelayMirrorToIotaChange = vi.fn()
    const { container } = render(
      <ChatViewSendPanel
        {...baseSendPanel({
          forcedTransport: 'mesh',
          delayMirrorToIota: false,
          onDelayMirrorToIotaChange,
        })}
      />
    )
    fireEvent.click(delayedMirrorCheckbox(container))
    expect(onDelayMirrorToIotaChange).toHaveBeenCalledWith(true)
  })

  it('blockiert Klartext-LoRa über Zeichenlimit und zeigt Zähler', () => {
    const long = 'x'.repeat(MESH_PLAINTEXT_MAX_CHARS + 1)
    const { container } = render(
      <ChatViewSendPanel
        {...baseSendPanel({
          encrypted: false,
          recipient: `0x${'b'.repeat(64)}`,
          message: long,
          forcedTransport: 'mesh',
        })}
      />
    )
    expect(screen.getByText(new RegExp(`${MESH_PLAINTEXT_MAX_CHARS + 1}/${MESH_PLAINTEXT_MAX_CHARS}`))).toBeInTheDocument()
    expect(primarySend(container)).toBeDisabled()
  })

  it('LoRa-Online-Fallback: Bestätigen und Abbrechen', () => {
    const onConfirmLoraOnline = vi.fn()
    const onDismissLoraOnlineFallback = vi.fn()
    render(
      <ChatViewSendPanel
        {...baseSendPanel({
          loraOnlineFallbackOffer: { reasonLabel: 'Unit-Test: kein ACK' },
          onConfirmLoraOnline,
          onDismissLoraOnlineFallback,
        })}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /Trotzdem über Online/i }))
    expect(onConfirmLoraOnline).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: /^Abbrechen$/i }))
    expect(onDismissLoraOnlineFallback).toHaveBeenCalledTimes(1)
  })
})
