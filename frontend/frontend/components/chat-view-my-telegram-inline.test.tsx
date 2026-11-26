import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ChatViewMyTelegramInline } from '@/frontend/components/chat-view-my-telegram-inline'

describe('ChatViewMyTelegramInline', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('zeigt nur die eigene Chat-ID — keine Einsatz-Alarmgruppe im Ich-Blatt', () => {
    render(<ChatViewMyTelegramInline myTelegramChatId="12345" variant="panel" />)
    expect(screen.getByText('12345')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Gruppe beitreten/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/Einsatz-Alarmgruppe/i)).not.toBeInTheDocument()
  })

  it('hint ohne Chat-ID, weiterhin ohne Alarmgruppe', () => {
    render(<ChatViewMyTelegramInline variant="panel" />)
    expect(screen.getByText(/nicht im Telefonbuch/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Gruppe beitreten/i })).not.toBeInTheDocument()
  })
})
