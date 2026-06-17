import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ChatViewMyTelegramInline } from '@/frontend/components/chat-view-my-telegram-inline'

vi.mock('@/frontend/lib/api/telegram-integrations', () => ({
  fetchTelegramIntegration: vi.fn(),
}))

import { fetchTelegramIntegration } from '@/frontend/lib/api/telegram-integrations'

describe('ChatViewMyTelegramInline', () => {
  beforeEach(() => {
    vi.mocked(fetchTelegramIntegration).mockResolvedValue({
      ok: true,
      enabled: true,
      botTokenConfigured: true,
      botToken: '',
      botTokenMasked: '',
      botUserId: '123456789',
      adminChatId: '',
      relayBaseUrl: 'http://127.0.0.1:8787',
      relayReachable: false,
      monitorWebhookActive: false,
      inboundMode: 'off',
      inboundPollActive: false,
      einsatzGroupChatId: '-100999',
      einsatzGroupLabel: 'Team Alpha',
      einsatzGroupInviteLink: 'https://t.me/+test',
      einsatzGroupAlarmEnabled: true,
    })
  })

  it('zeigt eigene Chat-ID und Einsatz-Gruppe unter Ich', async () => {
    render(<ChatViewMyTelegramInline myTelegramChatId="1156058618" variant="panel" />)
    expect(await screen.findByText('Meine Telegram Chat-ID')).toBeInTheDocument()
    expect(screen.getByText('1156058618')).toBeInTheDocument()
    expect(screen.getByText('Boss-Bot-ID')).toBeInTheDocument()
    expect(screen.getByText('123456789')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Alarmgruppe beitreten/i })).toBeInTheDocument()
  })

  it('blendet sich aus wenn keine Telegram-Daten', () => {
    vi.mocked(fetchTelegramIntegration).mockResolvedValue({
      ok: true,
      enabled: false,
      botTokenConfigured: false,
      botToken: '',
      botTokenMasked: '',
      botUserId: '',
      adminChatId: '',
      relayBaseUrl: 'http://127.0.0.1:8787',
      relayReachable: false,
      monitorWebhookActive: false,
      inboundMode: 'off',
      inboundPollActive: false,
      einsatzGroupChatId: '',
      einsatzGroupLabel: '',
      einsatzGroupInviteLink: '',
      einsatzGroupAlarmEnabled: false,
    })
    const { container } = render(<ChatViewMyTelegramInline variant="panel" />)
    expect(container).toBeEmptyDOMElement()
  })
})
