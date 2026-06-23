import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { ChatViewMyTelegramInline } from '@/frontend/components/chat-view-my-telegram-inline'

vi.mock('@/frontend/lib/api/telegram-integrations', () => ({
  fetchTelegramIntegration: vi.fn(async () => ({
    ok: true,
    enabled: true,
    einsatzGroupInviteLink: '',
    einsatzGroupLabel: '',
    einsatzGroupChatId: '',
    einsatzGroupAlarmEnabled: false,
  })),
}))

vi.mock('@/frontend/lib/handoff-extras', () => ({
  readTelegramInviteFromHandoffExtras: () => 'https://t.me/+testjoin',
  readTelegramLabelFromHandoffExtras: () => 'Team Alpha',
}))

vi.mock('@/frontend/lib/telegram-alarm-group-prefs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/frontend/lib/telegram-alarm-group-prefs')>()
  return {
    ...actual,
    readTelegramAlarmGroupPending: () => null,
    isTelegramAlarmGroupJoinInitiatedForLink: () => false,
  }
})

describe('ChatViewMyTelegramInline', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('zeigt Gruppe-beitreten aus Handoff auch ohne API-Link', async () => {
    render(<ChatViewMyTelegramInline myTelegramChatId="12345" variant="panel" />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Gruppe beitreten/i })).toBeInTheDocument()
    })
  })
})
