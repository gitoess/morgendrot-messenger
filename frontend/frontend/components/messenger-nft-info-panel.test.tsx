import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MessengerNftInfoPanel } from '@/frontend/components/messenger-nft-info-panel'

vi.mock('@/frontend/lib/nft-guarded-purse-local-store', () => ({
  findNftGuardedPurseByNft: () => null,
}))
vi.mock('@/frontend/lib/nft-bearer-treasury-local-store', () => ({
  findNftBearerTreasuryByNft: () => null,
}))
vi.mock('@/frontend/lib/nft-time-lease-local-store', () => ({
  findNftTimeLeaseByNft: () => null,
}))
vi.mock('@/frontend/lib/nft-keycard-local-store', () => ({
  getNftKeycard: () => null,
}))
vi.mock('@/frontend/lib/nft-activity-local-log', () => ({
  listNftActivity: () => [],
}))
vi.mock('@/frontend/lib/direct-iota-chain-context', () => ({
  getDirectMailboxChainSnapshot: () => ({ packageId: `0x${'22'.repeat(32)}` }),
}))

const OID = `0x${'aa'.repeat(32)}`

describe('MessengerNftInfoPanel', () => {
  it('zeigt Object-ID und Info-Dialog', () => {
    render(
      <MessengerNftInfoPanel objectId={OID} name="Probe" showInfoButton variant="compact" />
    )
    expect(screen.getByText('Technische IDs')).toBeInTheDocument()
    expect(screen.getByText('Object-ID (NFT)')).toBeInTheDocument()
    expect(screen.getByText(OID)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^Info$/i }))
    expect(screen.getByText(/Info · Probe/i)).toBeInTheDocument()
    expect(screen.getByText('Objekt-Info')).toBeInTheDocument()
  })
})
