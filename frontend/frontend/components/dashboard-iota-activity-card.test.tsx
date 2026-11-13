import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { DashboardIotaActivityCard } from '@/frontend/components/dashboard-iota-activity-card'

const digest = 'DigABCDEF1234567890'
const objectId = `0x${'ab'.repeat(32)}`

vi.mock('@/frontend/lib/iota-activity-local-log', () => ({
  IOTA_ACTIVITY_LISTEN_EVENTS: [],
  iotaActivityKindLabel: (k: string) => k,
  listIotaActivity: () => [
    {
      id: 'act-1',
      atMs: Date.UTC(2026, 0, 2, 12, 0, 0),
      kind: 'nft_mint',
      summary: 'Mint test',
      digest,
      objectId,
    },
    {
      id: 'act-2',
      atMs: Date.UTC(2026, 0, 2, 13, 0, 0),
      kind: 'coin_in',
      summary: 'Index only',
      objectId: `0x${'cd'.repeat(32)}`,
    },
  ],
}))

vi.mock('@/frontend/lib/iota-tx-explorer-hint', () => ({
  explorerTxUrlFromDigest: (d: string) => `https://explorer.test/tx/${d}`,
  explorerObjectUrlFromId: (id: string) => `https://explorer.test/object/${id}`,
}))

describe('DashboardIotaActivityCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('zeigt TX und Objekt-Links; ein Klick öffnet kopierbare IDs', () => {
    render(<DashboardIotaActivityCard />)
    const tx = screen.getByRole('link', { name: /^TX$/i })
    expect(tx).toHaveAttribute('href', `https://explorer.test/tx/${digest}`)
    expect(screen.getAllByRole('link', { name: /^Objekt$/i }).length).toBeGreaterThanOrEqual(1)

    expect(screen.queryByText('TX Digest')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText(/Mint test/i).closest('[role="button"]')!)
    expect(screen.getByText('TX Digest')).toBeInTheDocument()
    expect(screen.getByText('Object-ID')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Alle IDs kopieren/i })).toBeInTheDocument()
  })
})
