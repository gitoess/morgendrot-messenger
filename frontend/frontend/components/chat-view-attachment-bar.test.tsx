import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ChatViewAttachmentBar } from '@/frontend/components/chat-view-attachment-bar'
import type { ChatViewAttachmentBarProps } from '@/frontend/components/chat-view-attachment-bar'

function baseAttachmentBar(over: Partial<ChatViewAttachmentBarProps> = {}): ChatViewAttachmentBarProps {
  return {
    compactFileRef: createRef(),
    compactBusy: false,
    attachmentPipelineHint: null,
    sending: false,
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
    ...over,
  }
}

describe('ChatViewAttachmentBar (§ H.1a)', () => {
  it('zeigt Import- und Kamera-Buttons', () => {
    render(<ChatViewAttachmentBar {...baseAttachmentBar()} />)
    expect(screen.getByRole('button', { name: /Datei importieren/i })).toBeEnabled()
    expect(screen.getByRole('button', { name: /Von Kamera/i })).toBeEnabled()
  })

  it('deaktiviert Pick bei sending oder compactBusy', () => {
    const { rerender } = render(<ChatViewAttachmentBar {...baseAttachmentBar({ sending: true })} />)
    expect(screen.getByRole('button', { name: /Datei importieren/i })).toBeDisabled()

    rerender(<ChatViewAttachmentBar {...baseAttachmentBar({ compactBusy: true })} />)
    expect(screen.getByRole('button', { name: /Anhang wird vorbereitet/i })).toBeDisabled()
  })

  it('zeigt Pipeline-Hinweis mit status role', () => {
    render(
      <ChatViewAttachmentBar
        {...baseAttachmentBar({ attachmentPipelineHint: 'Bild wird komprimiert…' })}
      />
    )
    expect(screen.getByRole('status')).toHaveTextContent(/komprimiert/)
  })

  it('zeigt .txt-Metadaten und Entfernen-Button', () => {
    const clearCompactAttachment = vi.fn()
    render(
      <ChatViewAttachmentBar
        {...baseAttachmentBar({
          attachedTxtFile: { name: 'notiz.txt', text: 'Hallo Welt' },
          compactMeta: { total: 10, luma: 0, chroma: 0, q: 80 },
          clearCompactAttachment,
        })}
      />
    )
    expect(screen.getByText(/notiz\.txt/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Anhang entfernen/i }))
    expect(clearCompactAttachment).toHaveBeenCalledTimes(1)
  })

  it('zeigt LoRa-Fortschrittszeile bei Anhang', () => {
    render(
      <ChatViewAttachmentBar
        {...baseAttachmentBar({
          attachedLora: {
            lumaWire: 'x',
            chromaWire: 'y',
            messageId: 'm1',
            lumaJpegBytes: 100,
            chromaJpegBytes: 100,
          },
          loraMeshProgressLine: 'Luma 2/5 · Chroma 0/5',
        })}
      />
    )
    expect(screen.getByRole('status')).toHaveTextContent(/Luma 2\/5/)
  })
})
