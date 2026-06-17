import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MESH_PLAINTEXT_MAX_CHARS } from '@/frontend/lib/chat-view-messenger-transport'
import { ChatViewSendPanel, type ChatViewSendPanelProps } from './chat-view-send-panel'
import { TEST_API_STATUS_SEND_READY } from '@/frontend/lib/test-fixtures/messenger-capabilities'

/** RTL-Fixture: gleiche Defaults wie Smoke-Tests, per Partial überschreibbar (§ H.1a). */
function openComposerPlusMenu() {
  fireEvent.click(screen.getByRole('button', { name: /Weitere Aktionen/i }))
}

function primarySend(container: HTMLElement) {
  const el = container.querySelector('[data-testid="chat-composer-primary-send"]')
  expect(el).toBeInstanceOf(HTMLButtonElement)
  return el as HTMLButtonElement
}

const READY_API_STATUS = TEST_API_STATUS_SEND_READY

function baseSendPanel(over: Partial<ChatViewSendPanelProps> = {}): ChatViewSendPanelProps {
  return {
    isPrivate: true,
    encrypted: true,
    recipient: '',
    message: 'Hallo Test',
    onRecipientChange: vi.fn(),
    onMessageChange: vi.fn(),
    meshLoRaImagesEnabled: false,
    onMeshLoRaImagesEnabledChange: vi.fn(),
    meshSelfArchiveAfterLoRa: false,
    onMeshSelfArchiveAfterLoRaChange: vi.fn(),
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
    attachmentPipelineHint: null,
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
    apiStatus: READY_API_STATUS as ChatViewSendPanelProps['apiStatus'],
    onSend: vi.fn(),
    status: 'idle',
    statusMsg: '',
    meshPlaintextToNodeEnabled: false,
    onMeshPlaintextToNodeEnabledChange: vi.fn(),
    meshPlaintextNodeId: '',
    onMeshPlaintextNodeIdChange: vi.fn(),
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
        {...baseSendPanel({
          message: '',
          forcedTransport: 'mesh',
          compactMeta: { total: 100, luma: 40, chroma: 60, q: 40, mode: 'lora' },
          attachedLora: {
            lumaWire: '[[MORG_LUMA_V1:msgId=deadbeef|len=4|ABCD]]',
            chromaWire: '[[MORG_CHROMA_V1:msgId=deadbeef|len=4|EFGH]]',
            messageId: 'deadbeef',
            lumaJpegBytes: 40,
            chromaJpegBytes: 60,
          },
          loraPreviewUrl: 'blob:mock',
          loraMeshProgressLine: 'Luma 2/5 · Chroma ausstehend',
          sending: true,
          statusMsg: 'Funk: LUMA …',
        })}
      />
    )
    expect(screen.getByRole('status')).toHaveTextContent(/Luma 2\/5 · Chroma ausstehend/)
  })

  it('zeigt Mailbox-Warteschlange-Banner bei pending > 0 (privat)', () => {
    render(
      <ChatViewSendPanel
        {...baseSendPanel({
          message: '',
          offlineMailboxQueuePending: 2,
        })}
      />
    )
    expect(screen.getByText(/Mailbox-Warteschlange/)).toBeInTheDocument()
    expect(screen.getByText(/2 Nachrichten warten auf die Basis/)).toBeInTheDocument()
  })

  it('blendet Mailbox-Warteschlange aus wenn offlineMailboxQueuePending=0 (§ H.1a)', () => {
    const { container } = render(
      <ChatViewSendPanel {...baseSendPanel({ offlineMailboxQueuePending: 0 })} />
    )
    expect(screen.queryByText(/Mailbox-Warteschlange/)).not.toBeInTheDocument()
    expect(primarySend(container)).toBeEnabled()
  })

  it('zeigt § H.6c-Hinweis wenn Einträge mit unverifizierter Zeit anstehen', () => {
    render(
      <ChatViewSendPanel
        {...baseSendPanel({
          message: '',
          offlineMailboxQueuePending: 1,
          offlineMailboxQueueUntrustedTimeCount: 1,
        })}
      />
    )
    expect(screen.getByText(/Gerätezeit/i)).toBeInTheDocument()
  })

  it('zeigt Backoff- und Fehlerhinweis für Mailbox-Warteschlange (§ H.12 / SYNC)', () => {
    render(
      <ChatViewSendPanel
        {...baseSendPanel({
          message: '',
          offlineMailboxQueuePending: 1,
          offlineMailboxQueueBackoffCount: 1,
          offlineMailboxQueueErrorHint: 'rpc timeout',
        })}
      />
    )
    expect(screen.getByText(/Backoff/i)).toBeInTheDocument()
    expect(screen.getByText(/Letzte Meldung: rpc timeout/)).toBeInTheDocument()
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

  it('deaktiviert primäres Senden während sending=true (§ H.1a Send-Slice)', () => {
    const onSend = vi.fn()
    const { container } = render(
      <ChatViewSendPanel {...baseSendPanel({ onSend, message: 'Noch unterwegs', sending: true })} />
    )
    const sendBtn = primarySend(container)
    expect(sendBtn).toBeDisabled()
    fireEvent.click(sendBtn)
    expect(onSend).not.toHaveBeenCalled()
  })

  it('zeigt Emoji-Popup im privaten Chat', () => {
    render(<ChatViewSendPanel {...baseSendPanel({ isPrivate: true })} />)
    openComposerPlusMenu()
    expect(screen.getByTestId('chat-composer-emoji-trigger')).toBeInTheDocument()
  })

  it('fügt Emoji in die Nachricht ein', () => {
    const onMessageChange = vi.fn()
    render(
      <ChatViewSendPanel
        {...baseSendPanel({
          isPrivate: true,
          message: '',
          onMessageChange,
        })}
      />
    )
    openComposerPlusMenu()
    fireEvent.click(screen.getByTestId('chat-composer-emoji-trigger'))
    fireEvent.click(screen.getByRole('option', { name: /Emoji 👍/ }))
    expect(onMessageChange).toHaveBeenCalledWith('👍')
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

  it('Klartext-Funk-Broadcast: Senden ohne 0x-Empfänger möglich (Heltec-Pfad)', () => {
    const onSend = vi.fn()
    const { container } = render(
      <ChatViewSendPanel
        {...baseSendPanel({
          encrypted: false,
          recipient: '',
          message: 'Hi mesh',
          forcedTransport: 'mesh',
          meshPlaintextToNodeEnabled: false,
          onSend,
        })}
      />
    )
    expect(primarySend(container)).toBeEnabled()
  })

  it('aktiviert Senden bei Klartext mit Partner-Adresse (privat, Empfängerfeld leer)', () => {
    const onSend = vi.fn()
    const addr = `0x${'c'.repeat(64)}`
    const { container } = render(
      <ChatViewSendPanel
        {...baseSendPanel({
          encrypted: false,
          recipient: '',
          partner: addr,
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

  it('zeigt bei Funk + Node-ID kein 0x-Empfängerfeld', () => {
    render(
      <ChatViewSendPanel
        {...baseSendPanel({
          encrypted: false,
          recipient: '',
          message: 'Hi',
          forcedTransport: 'mesh',
          meshPlaintextToNodeEnabled: true,
          meshPlaintextNodeId: '!1a2b3c4d',
        })}
      />
    )
    expect(screen.getByPlaceholderText('!1a2b3c4d')).toBeInTheDocument()
    expect(screen.queryByText(/Empfänger · Wallet \(0x\)/i)).not.toBeInTheDocument()
  })

  it('zeigt getrennte Funk-Checkboxen bei Klartext + Funk (privat)', () => {
    render(
      <ChatViewSendPanel
        {...baseSendPanel({
          encrypted: false,
          recipient: '',
          message: 'Hi',
          forcedTransport: 'mesh',
        })}
      />
    )
    openComposerPlusMenu()
    expect(screen.getByTestId('mesh-lora-images-enabled')).toBeInTheDocument()
    expect(screen.getByTestId('mesh-path4-self-archive')).toBeInTheDocument()
  })

  it('zeigt Kanalindex-Feld nur im Expert-Modus und übernimmt 0..7', () => {
    const onMeshtasticChannelIndexChange = vi.fn()
    const { rerender } = render(
      <ChatViewSendPanel
        {...baseSendPanel({
          encrypted: false,
          forcedTransport: 'mesh',
          showMeshtasticChannelIndexInput: false,
          onMeshtasticChannelIndexChange,
        })}
      />
    )
    expect(screen.queryByLabelText(/Kanalindex \(0–7, optional\)/i)).not.toBeInTheDocument()

    rerender(
      <ChatViewSendPanel
        {...baseSendPanel({
          encrypted: false,
          forcedTransport: 'mesh',
          showMeshtasticChannelIndexInput: true,
          onMeshtasticChannelIndexChange,
        })}
      />
    )
    const input = screen.getByLabelText(/Kanalindex \(0–7, optional\)/i)
    fireEvent.change(input, { target: { value: '3' } })
    expect(onMeshtasticChannelIndexChange).toHaveBeenLastCalledWith(3)
    fireEvent.change(input, { target: { value: '9' } })
    expect(onMeshtasticChannelIndexChange).toHaveBeenLastCalledWith(undefined)
    fireEvent.change(input, { target: { value: '' } })
    expect(onMeshtasticChannelIndexChange).toHaveBeenLastCalledWith(undefined)
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

  it('erlaubt LoRa-Bild nur mit „Bilder über Funk“ (ohne Verankerung)', () => {
    const onSend = vi.fn()
    const { container } = render(
      <ChatViewSendPanel
        {...baseSendPanel({
          encrypted: false,
          forcedTransport: 'mesh',
          meshLoRaImagesEnabled: true,
          meshSelfArchiveAfterLoRa: false,
          attachedLora: {
            lumaWire: '[[MORG_LUMA_V1:msgId=beef|len=4|ABCD]]',
            chromaWire: '[[MORG_CHROMA_V1:msgId=beef|len=4|EFGH]]',
            messageId: 'beef',
            lumaJpegBytes: 40,
            chromaJpegBytes: 60,
          },
          onSend,
        })}
      />
    )
    const sendBtn = primarySend(container)
    expect(sendBtn).toBeEnabled()
    fireEvent.click(sendBtn)
    expect(onSend).toHaveBeenCalledTimes(1)
  })

  it('erlaubt LoRa-Bildzweiteiler mit beiden Optionen', () => {
    const onSend = vi.fn()
    const { container } = render(
      <ChatViewSendPanel
        {...baseSendPanel({
          encrypted: false,
          forcedTransport: 'mesh',
          meshLoRaImagesEnabled: true,
          meshSelfArchiveAfterLoRa: true,
          attachedLora: {
            lumaWire: '[[MORG_LUMA_V1:msgId=beef|len=4|ABCD]]',
            chromaWire: '[[MORG_CHROMA_V1:msgId=beef|len=4|EFGH]]',
            messageId: 'beef',
            lumaJpegBytes: 40,
            chromaJpegBytes: 60,
          },
          onSend,
        })}
      />
    )
    const sendBtn = primarySend(container)
    expect(sendBtn).toBeEnabled()
    fireEvent.click(sendBtn)
    expect(onSend).toHaveBeenCalledTimes(1)
  })

  it('Bilder über Funk bleibt mit Encrypt-Toggle sendbar (Luft Klartext)', () => {
    const onSend = vi.fn()
    const { container } = render(
      <ChatViewSendPanel
        {...baseSendPanel({
          encrypted: true,
          forcedTransport: 'mesh',
          meshLoRaImagesEnabled: true,
          meshSelfArchiveAfterLoRa: true,
          attachedLora: {
            lumaWire: '[[MORG_LUMA_V1:msgId=cafe|len=4|ABCD]]',
            chromaWire: '[[MORG_CHROMA_V1:msgId=cafe|len=4|EFGH]]',
            messageId: 'cafe',
            lumaJpegBytes: 44,
            chromaJpegBytes: 62,
          },
          onSend,
        })}
      />
    )
    openComposerPlusMenu()
    expect(screen.getByTestId('mesh-lora-images-enabled')).toBeChecked()
    const sendBtn = primarySend(container)
    expect(sendBtn).toBeEnabled()
    fireEvent.click(sendBtn)
    expect(onSend).toHaveBeenCalledTimes(1)
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
    fireEvent.click(screen.getByRole('button', { name: /Trotzdem über Online \(IOTA\) senden/i }))
    expect(onConfirmLoraOnline).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: /^Abbrechen$/i }))
    expect(onDismissLoraOnlineFallback).toHaveBeenCalledTimes(1)
  })

  it('Telegram-Sendepfad: ruft onTelegramSend statt onSend (§ H.1a)', () => {
    const onSend = vi.fn()
    const onTelegramSend = vi.fn()
    const { container } = render(
      <ChatViewSendPanel
        {...baseSendPanel({
          composerDelivery: 'telegram',
          canSendTelegram: true,
          recipient: '99317902',
          onSend,
          onTelegramSend,
        })}
      />
    )
    expect(screen.getByText(/Empfänger · Telegram/)).toBeInTheDocument()
    fireEvent.click(primarySend(container))
    expect(onTelegramSend).toHaveBeenCalledTimes(1)
    expect(onSend).not.toHaveBeenCalled()
  })

  it('zeigt Chain-Speicher-Auswahl bei Online + Empfänger (§ H.1a)', () => {
    const partner = `0x${'d'.repeat(64)}`
    render(
      <ChatViewSendPanel
        {...baseSendPanel({
          messagingPersistenceMode: 'mailbox',
          encrypted: true,
          forcedTransport: 'internet',
          partner,
          recipient: partner,
        })}
      />
    )
    expect(screen.getByText(/Speicher auf der Chain/)).toBeInTheDocument()
  })

  it('zeigt Abbrechen-Button während sending und ruft onCancelSend (§ H.1a)', () => {
    const onCancelSend = vi.fn()
    render(
      <ChatViewSendPanel
        {...baseSendPanel({
          sending: true,
          onCancelSend,
        })}
      />
    )
    const cancel = screen.getByTestId('chat-composer-cancel-send')
    expect(cancel).toHaveTextContent(/Stop/)
    fireEvent.click(cancel)
    expect(onCancelSend).toHaveBeenCalledTimes(1)
  })

  it('zeigt Sendestatus im Composer (§ H.1a)', () => {
    render(
      <ChatViewSendPanel
        {...baseSendPanel({
          status: 'success',
          statusMsg: 'Nachricht gesendet.',
        })}
      />
    )
    const statusEl = screen.getByTestId('chat-composer-send-status')
    expect(statusEl).toHaveTextContent('Nachricht gesendet.')
  })
})
