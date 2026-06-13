import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ChatViewPulseSettings } from '@/frontend/components/chat-view-pulse-settings'
import { TEST_API_STATUS_SEND_READY } from '@/frontend/lib/test-fixtures/messenger-capabilities'
import type { ApiStatus } from '@/frontend/lib/api'

function baseApiStatus(over: Partial<ApiStatus> = {}): ApiStatus {
  return {
    ...TEST_API_STATUS_SEND_READY,
    packageId: `0x${'p'.repeat(64)}`,
    myAddressFull: `0x${'m'.repeat(64)}`,
    streams: { active: false, anchorIdFull: '' },
    ...over,
  } as ApiStatus
}

describe('ChatViewPulseSettings (§ H.1a)', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ok: true,
          myAddress: `0x${'m'.repeat(64)}`,
          packageId: `0x${'p'.repeat(64)}`,
          mailboxId: `0x${'x'.repeat(64)}`,
          streamsAnchorId: '',
        }),
      })
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('zeigt eingeklappten Trigger im Chat', () => {
    render(<ChatViewPulseSettings apiStatus={baseApiStatus()} />)
    expect(screen.getByRole('button', { name: /IDs zum Kopieren/i })).toBeInTheDocument()
  })

  it('zeigt Einstellungs-Trigger wenn embedded', () => {
    render(<ChatViewPulseSettings apiStatus={baseApiStatus()} settingsEmbedded />)
    expect(screen.getByRole('button', { name: /Mailbox · Direkt-RPC · Streams-Puls/i })).toBeInTheDocument()
  })

  it('klappt auf und lädt current-ids', async () => {
    render(<ChatViewPulseSettings apiStatus={baseApiStatus()} />)
    fireEvent.click(screen.getByRole('button', { name: /IDs zum Kopieren/i }))
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/current-ids')
    })
    expect(await screen.findByText(/Explorer \/ Prüfen/)).toBeInTheDocument()
  })
})
