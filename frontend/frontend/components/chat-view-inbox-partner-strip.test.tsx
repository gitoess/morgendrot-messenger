import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import {
  ChatViewInboxPartnerStrip,
  type ChatViewInboxPartnerStripProps,
} from '@/frontend/components/chat-view-inbox-partner-strip'
import { TEST_MESSENGER_CAPABILITIES_ALL_WRITE } from '@/frontend/lib/test-fixtures/messenger-capabilities'

const PEER_A = `0x${'a'.repeat(64)}`
const PEER_B = `0x${'b'.repeat(64)}`

function makeProps(over: Partial<ChatViewInboxPartnerStripProps> = {}): ChatViewInboxPartnerStripProps {
  return {
    partnerOptions: [
      { address: PEER_A, label: 'Hans Dampf', unreadCount: 2 },
      { address: PEER_B, label: 'Partner B' },
    ],
    myAddressKnown: true,
    partnerKey: null,
    onPartnerKeyChange: vi.fn(),
    direction: 'all',
    onDirectionChange: vi.fn(),
    sourceFilter: 'all',
    onSourceFilterChange: vi.fn(),
    wireFilter: 'all',
    onWireFilterChange: vi.fn(),
    onPartnerSelectForSend: vi.fn(),
    apiStatus: { capabilities: TEST_MESSENGER_CAPABILITIES_ALL_WRITE },
    ...over,
  }
}

describe('ChatViewInboxPartnerStrip (§ H.1a)', () => {
  it('schaltet Wire-Filter um', () => {
    const onWireFilterChange = vi.fn()
    render(<ChatViewInboxPartnerStrip {...makeProps({ onWireFilterChange })} />)
    fireEvent.click(screen.getByRole('button', { name: /^Verschlüsselt$/i }))
    expect(onWireFilterChange).toHaveBeenCalledWith('encrypted')
  })

  it('schaltet Richtung Eingang/Ausgang', () => {
    const onDirectionChange = vi.fn()
    render(<ChatViewInboxPartnerStrip {...makeProps({ onDirectionChange })} />)
    fireEvent.click(screen.getByRole('button', { name: /^Eingang$/i }))
    expect(onDirectionChange).toHaveBeenCalledWith('in')
  })

  it('zeigt Kanal-Hinweis bei aktivem Quellenfilter', () => {
    render(
      <ChatViewInboxPartnerStrip
        {...makeProps({
          sourceFilter: 'funk',
          direction: 'all',
        })}
      />
    )
    expect(screen.getByRole('status')).toHaveTextContent(/Kanal-Filter aktiv/)
  })

  it('deaktiviert Telegram-Quelle ohne Lese-Recht', () => {
    render(
      <ChatViewInboxPartnerStrip
        {...makeProps({
          apiStatus: {
            capabilities: {
              ...TEST_MESSENGER_CAPABILITIES_ALL_WRITE,
              transport: {
                ...TEST_MESSENGER_CAPABILITIES_ALL_WRITE.transport,
                telegram: { read: false, write: false },
              },
            },
          },
        })}
      />
    )
    expect(screen.getByRole('button', { name: /^Telegram$/i })).toBeDisabled()
  })

  it('Partner-Chip wählt Adresse für Senden', () => {
    const onPartnerSelectForSend = vi.fn()
    render(<ChatViewInboxPartnerStrip {...makeProps({ onPartnerSelectForSend })} />)
    fireEvent.click(screen.getByRole('button', { name: /Hans Dampf/i }))
    expect(onPartnerSelectForSend).toHaveBeenCalledWith(PEER_A)
  })

  it('Partner Alle setzt Filter zurück', () => {
    const onPartnerKeyChange = vi.fn()
    render(
      <ChatViewInboxPartnerStrip
        {...makeProps({
          partnerKey: PEER_A,
          onPartnerKeyChange,
          showWireSection: false,
          showChannelSection: false,
        })}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /^Alle$/i }))
    expect(onPartnerKeyChange).toHaveBeenCalledWith(null)
  })

  it('zeigt Unread-Badge am Partner-Chip', () => {
    render(<ChatViewInboxPartnerStrip {...makeProps()} />)
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('blendet Sektionen aus wenn showWireSection/showPartnerSection false', () => {
    render(
      <ChatViewInboxPartnerStrip
        {...makeProps({
          showWireSection: false,
          showChannelSection: false,
          showPartnerSection: false,
        })}
      />
    )
    expect(screen.queryByText(/Posteingang \(Inhalt\)/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/^Partner$/i)).not.toBeInTheDocument()
  })
})
