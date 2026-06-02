import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { getDirectIotaHeaderStatusLine } from '@/frontend/lib/autarky-status-line'
import { ChatViewDirectIotaPathBadge } from './chat-view-direct-iota-path-badge'

vi.mock('@/frontend/lib/direct-iota-plain-submit', () => ({
  DIRECT_IOTA_UI_CHANGED: 'morgendrot-direct-iota-ui-changed',
  getDirectIotaPathUiShortLine: vi.fn(() => 'Direkt-RPC aktiv'),
  getDirectIotaPathUiState: vi.fn(() => ({
    mode: 'client',
    headline: 'Direkt-RPC aktiv',
    detail: 'Detail-Tooltip',
  })),
}))

vi.mock('@/frontend/lib/autarky-status-line', () => ({
  getDirectIotaHeaderStatusLine: vi.fn(() => null),
}))

vi.mock('@/frontend/lib/direct-iota-chain-context', () => ({
  getDirectChainSnapshotMeta: vi.fn(() => ({
    hasSnapshot: false,
    stale: true,
    savedAtMs: null,
    ageMinutes: null,
    staleTtlMinutes: 30,
    mailboxTtlDays: null,
  })),
  formatDirectChainSnapshotStatusLine: vi.fn(() => ''),
}))

describe('ChatViewDirectIotaPathBadge', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('zeigt Kurzzeile mit Tooltip', () => {
    render(<ChatViewDirectIotaPathBadge backendOnline />)
    expect(screen.getByText(/IOTA: Direkt-RPC aktiv/)).toBeInTheDocument()
    expect(screen.getByTitle('Detail-Tooltip')).toBeInTheDocument()
  })

  it('zeigt Autarkie-Zeile wenn Autarkie-Modus aktiv', () => {
    vi.mocked(getDirectIotaHeaderStatusLine).mockReturnValue('Autarkie: noch offen — Fullnode-URL gesetzt')
    render(<ChatViewDirectIotaPathBadge backendOnline={false} />)
    expect(screen.getByText(/Autarkie: noch offen/)).toBeInTheDocument()
  })
})
